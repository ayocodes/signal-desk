// Browser helpers for the draft, approve and agent-rules routes. They never throw on an expected failure:
// they return { ok: false, error } with a code the UI can branch on and a plain message it
// can show as is (for example the daily budget being used up).
import type { CheckResult } from "@/lib/guardrails";
import type { RuleError, RulesDoc } from "@/lib/rules";
import type { ApplyStart, ApplyState, DraftAngle, DraftView, ThresholdPreview } from "@/lib/types";

export type ApiErrorCode =
  | "unauthorized"
  | "invalid"
  | "not_found"
  | "forbidden"
  | "not_ready"
  | "already_enrolled"
  | "checks_failed"
  | "not_approvable"
  | "budget_exhausted"
  | "rate_limited"
  | "llm_failed"
  | "invalid_rules"
  | "no_changes"
  | "network";

export type ApiError = {
  code: ApiErrorCode;
  message: string;
  /** For checks_failed: the server's guardrail results, so the editor can show which failed. */
  results?: CheckResult[];
  /** For invalid_rules: the same {path, code} errors validateRules() gives in the browser. */
  errors?: RuleError[];
};

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };

async function post<T>(url: string, body: unknown, pick: (json: Record<string, unknown>) => T): Promise<ApiResult<T>> {
  return request(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }, pick);
}

async function request<T>(url: string, init: RequestInit, pick: (json: Record<string, unknown>) => T): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    return { ok: false, error: { code: "network", message: "Couldn't reach the server. Check your connection." } };
  }
  const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const error = json.error as ApiError | undefined;
    return { ok: false, error: error ?? { code: "llm_failed", message: `Request failed (${response.status}).` } };
  }
  return { ok: true, data: pick(json) };
}

/** Regenerate one angle, or make the Unconstrained draft ("raw") the first time it's opened. */
export function generateDraft(leadId: string, angle: DraftAngle): Promise<ApiResult<DraftView>> {
  return post(`/api/leads/${leadId}/draft`, { angle }, (json) => json.draft as DraftView);
}

/** Approve the (possibly edited) draft and enroll the lead in a sequence. */
export function approveLead(
  leadId: string,
  input: { draftId: string; subject: string; body: string },
): Promise<ApiResult<{ sequenceId: string }>> {
  return post(`/api/leads/${leadId}/approve`, input, (json) => ({ sequenceId: json.sequenceId as string }));
}

/** A saved rules version, and whether a re-score started to apply it now (see ApplyStart). */
export type SavedRules = { version: number; apply: ApplyStart };
const savedRules = (json: Record<string, unknown>): SavedRules => ({
  version: json.version as number,
  apply: json.apply as ApplyStart,
});

/** Save the edited rules as the next version (admins only). */
export function saveAgentConfig(rules: RulesDoc): Promise<ApiResult<SavedRules>> {
  return post("/api/agent-config", { rules }, savedRules);
}

/** Restore an old version's rules as the next version (admins only). */
export function revertAgentConfig(version: number): Promise<ApiResult<SavedRules>> {
  return post("/api/agent-config/revert", { version }, savedRules);
}

/** Put every rule back to the defaults as the next version (admins only). */
export function resetAgentConfig(): Promise<ApiResult<SavedRules>> {
  return post("/api/agent-config/reset", {}, savedRules);
}

/** Whether a saved version has reached the leads yet: poll while "applying" (admins only). */
export function applyStatus(version: number): Promise<ApiResult<ApplyState>> {
  return request(`/api/agent-config/apply-status?version=${version}`, { method: "GET" }, (json) => json.state as ApplyState);
}

/** How many leads a threshold would put in the queue, from stored scores (admins only). */
export function previewThreshold(threshold: number): Promise<ApiResult<ThresholdPreview>> {
  return request(`/api/agent-config/preview?threshold=${threshold}`, { method: "GET" }, (json) => json.preview as ThresholdPreview);
}
