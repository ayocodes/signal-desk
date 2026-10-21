// What the agent-config routes do. Server only. Admins only: the routes check the role, and
// save_agent_config() checks it again in the database, which also writes the audit row.
// Saving runs as the signed-in admin (their session), not the service role.
import "server-only";
import type { ApiError } from "@/lib/api";
import type { Profile } from "@/lib/auth";
import { diffRules } from "@/lib/config-diff";
import { getAgentConfig, getConfigVersion } from "@/lib/data/agent-config";
import { validateRules, type RulesDoc } from "@/lib/rules";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ServiceResult<T> = { ok: true; data: T } | { ok: false; status: number; error: ApiError };

const fail = (status: number, code: ApiError["code"], message: string, extra: Partial<ApiError> = {}) =>
  ({ ok: false, status, error: { code, message, ...extra } }) as const;

async function save(rules: RulesDoc, summary: string[]): Promise<ServiceResult<{ version: number }>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("save_agent_config", { p_rules: rules, p_summary: summary });
  if (error) {
    if (error.code === "42501") return fail(403, "forbidden", "Only admins can change the agent rules.");
    throw new Error(`Saving the agent rules failed: ${error.message}`);
  }
  return { ok: true, data: { version: data } };
}

/** Validates a rules document, describes what changed, and saves it as the next version. */
export async function saveRules(profile: Profile, rules: unknown): Promise<ServiceResult<{ version: number }>> {
  const errors = validateRules(rules);
  if (errors.length) return fail(422, "invalid_rules", "Some rules aren't valid. Fix them before saving.", { errors });
  const current = await getAgentConfig(profile.orgId);
  const summary = diffRules(current.rules, rules as RulesDoc);
  if (summary.length === 0) return fail(400, "no_changes", "Nothing changed since the current version.");
  return save(rules as RulesDoc, summary);
}

/** Copies an old version in as the next one, so history never changes. */
export async function revertRules(profile: Profile, version: number): Promise<ServiceResult<{ version: number }>> {
  const rules = await getConfigVersion(version);
  if (!rules) return fail(404, "not_found", `There is no version ${version}.`);
  const errors = validateRules(rules);
  if (errors.length) return fail(422, "invalid_rules", `Version ${version} isn't valid under today's rules.`, { errors });
  const current = await getAgentConfig(profile.orgId);
  const summary = diffRules(current.rules, rules);
  if (summary.length === 0) return fail(400, "no_changes", `Version ${version} is the same as the current rules.`);
  return save(rules, [`Reverted to version ${version}`, ...summary]);
}
