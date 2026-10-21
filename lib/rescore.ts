// Applying a rules change right away: after an admin saves, restores or resets the rules, a
// re-score-only agent run starts on GitHub (.github/workflows/rescore.yml). Server only.
//
// Safeguards (user decision 2026-10-21):
// - workflow_dispatch with a token that only has Actions read/write (GITHUB_DISPATCH_TOKEN);
// - one re-score per org at a time: if one is queued or running, a new save joins it (a
//   queued run hasn't loaded the rules yet, and a running one loops to pick up newer saves);
// - at most one dispatch every 2 minutes per org;
// - every dispatch is written to the audit log.
import "server-only";
import { logUserAction } from "@/lib/audit";
import type { Profile } from "@/lib/auth";
import { env } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ApplyStart, ApplyState } from "@/lib/types";

const COOLDOWN_MS = 2 * 60 * 1000;
// A dispatch whose run never started this long after is treated as lost.
const LOST_AFTER_MS = 15 * 60 * 1000;
const DISPATCH_ACTION = "agent.rescore_dispatched";

type RunRow = { started_at: string; finished_at: string | null; errors: unknown; config_version: number | null };

async function lastDispatchAt(orgId: string): Promise<number | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("audit_log")
    .select("created_at")
    .eq("org_id", orgId)
    .eq("action", DISPATCH_ACTION)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Reading re-score dispatches failed: ${error.message}`);
  return data ? Date.parse(data.created_at) : null;
}

/** The first re-score run that started after a dispatch, if any. */
async function runAfter(orgId: string, since: number): Promise<RunRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("agent_runs")
    .select("started_at, finished_at, errors, config_version")
    .eq("org_id", orgId)
    .eq("trigger", "rescore")
    .gte("started_at", new Date(since).toISOString())
    .order("started_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Reading re-score runs failed: ${error.message}`);
  return data;
}

async function dispatch(orgId: string): Promise<boolean> {
  const github = env.githubDispatch;
  if (!github) return false;
  const response = await fetch(
    `https://api.github.com/repos/${github.repo}/actions/workflows/rescore.yml/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${github.token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ref: "main", inputs: { org_id: orgId } }),
      signal: AbortSignal.timeout(15_000),
    },
  ).catch((error: unknown) => {
    console.warn("Starting the re-score run failed:", error instanceof Error ? error.name : error);
    return null;
  });
  if (response && response.status !== 204) console.warn(`GitHub refused the re-score run (${response.status}).`);
  return response?.status === 204;
}

/** Starts (or joins) a re-score after rules version `version` was saved. Never throws for GitHub. */
export async function startRescore(profile: Profile, version: number, now = Date.now()): Promise<ApplyStart> {
  if (!env.githubDispatch) return "failed";
  const last = await lastDispatchAt(profile.orgId);
  if (last !== null && now - last < LOST_AFTER_MS) {
    const run = await runAfter(profile.orgId, last);
    if (!run || !run.finished_at) return "joined";
  }
  if (last !== null && now - last < COOLDOWN_MS) return "deferred";
  if (!(await dispatch(profile.orgId))) return "failed";
  await logUserAction(profile, {
    action: DISPATCH_ACTION,
    entityType: "organization",
    entityId: profile.orgId,
    detail: { version },
  });
  return "dispatched";
}

function scoringFailed(errors: unknown): boolean {
  return Array.isArray(errors) && errors.some((e) => typeof e?.step === "string" && e.step.startsWith("score_leads"));
}

/** Whether rules version `version` has reached the leads: any agent run (re-score or scheduled)
 *  that scored with this version or a newer one and has finished. */
export async function applyState(orgId: string, version: number, now = Date.now()): Promise<ApplyState> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("agent_runs")
    .select("started_at, finished_at, errors, config_version")
    .eq("org_id", orgId)
    .gte("config_version", version)
    .not("finished_at", "is", null)
    .order("finished_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Reading agent runs failed: ${error.message}`);
  if (data) return scoringFailed(data.errors) ? "failed" : "applied";

  // Nothing has scored with it yet. If the last dispatch never started a run, it was lost.
  const last = await lastDispatchAt(orgId);
  if (last !== null && now - last >= LOST_AFTER_MS && !(await runAfter(orgId, last))) return "failed";
  return "applying";
}
