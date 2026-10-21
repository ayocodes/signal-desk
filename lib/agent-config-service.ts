// What the agent-config routes do. Server only. Admins only: the routes check the role, and
// save_agent_config() checks it again in the database, which also writes the audit row.
// Saving runs as the signed-in admin (their session), not the service role.
import "server-only";
import type { ApiError } from "@/lib/api";
import type { Profile } from "@/lib/auth";
import { diffRules } from "@/lib/config-diff";
import { DEFAULT_RULES } from "@/lib/agent-config";
import { getAgentConfig, getConfigVersion } from "@/lib/data/agent-config";
import { startRescore } from "@/lib/rescore";
import { validateRules, type RulesDoc } from "@/lib/rules";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ApplyStart } from "@/lib/types";

export type ServiceResult<T> = { ok: true; data: T } | { ok: false; status: number; error: ApiError };

const fail = (status: number, code: ApiError["code"], message: string, extra: Partial<ApiError> = {}) =>
  ({ ok: false, status, error: { code, message, ...extra } }) as const;

export type Saved = { version: number; apply: ApplyStart };

/** Saves the next version, then starts (or joins) a re-score so it reaches the leads now. */
async function save(
  profile: Profile,
  rules: RulesDoc,
  summary: string[],
  restoredFrom: number | null = null,
): Promise<ServiceResult<Saved>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("save_agent_config", {
    p_rules: rules,
    p_summary: summary,
    p_restored_from: restoredFrom ?? undefined,
  });
  if (error) {
    if (error.code === "42501") return fail(403, "forbidden", "Only admins can change the agent rules.");
    throw new Error(`Saving the agent rules failed: ${error.message}`);
  }
  return { ok: true, data: { version: data, apply: await startRescore(profile, data) } };
}

/** Validates a rules document, describes what changed, and saves it as the next version. */
export async function saveRules(profile: Profile, rules: unknown): Promise<ServiceResult<Saved>> {
  const errors = validateRules(rules);
  if (errors.length) return fail(422, "invalid_rules", "Some rules aren't valid. Fix them before saving.", { errors });
  const current = await getAgentConfig(profile.orgId);
  const summary = diffRules(current.rules, rules as RulesDoc);
  if (summary.length === 0) return fail(400, "no_changes", "Nothing changed since the current version.");
  return save(profile, rules as RulesDoc, summary);
}

/** Restores an old version's rules as the next version, so history never changes. */
export async function revertRules(profile: Profile, version: number): Promise<ServiceResult<Saved>> {
  const rules = await getConfigVersion(version);
  if (!rules) return fail(404, "not_found", `There is no version ${version}.`);
  const errors = validateRules(rules);
  if (errors.length) return fail(422, "invalid_rules", `Version ${version} isn't valid under today's rules.`, { errors });
  const current = await getAgentConfig(profile.orgId);
  const summary = diffRules(current.rules, rules);
  if (summary.length === 0) return fail(400, "no_changes", `Version ${version} is the same as the current rules.`);
  return save(profile, rules, [`Restored from version ${version}`, ...summary], version);
}

/** Puts every rule back to the defaults as a new version (so a demo can't be left broken). */
export async function resetRules(profile: Profile): Promise<ServiceResult<Saved>> {
  const current = await getAgentConfig(profile.orgId);
  const summary = diffRules(current.rules, DEFAULT_RULES);
  if (summary.length === 0) return fail(400, "no_changes", "The rules are already the defaults.");
  return save(profile, DEFAULT_RULES, ["Reset to defaults", ...summary]);
}
