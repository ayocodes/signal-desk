// Browser helpers for the draft and approve routes. They never throw on an expected failure:
// they return { ok: false, error } with a code the UI can branch on and a plain message it
// can show as is (for example the daily budget being used up).
import type { CheckResult } from "@/lib/guardrails";
import type { DraftAngle, DraftView } from "@/lib/types";

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
  | "network";

export type ApiError = {
  code: ApiErrorCode;
  message: string;
  /** For checks_failed: the server's guardrail results, so the editor can show which failed. */
  results?: CheckResult[];
};

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };

async function post<T>(url: string, body: unknown, pick: (json: Record<string, unknown>) => T): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
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
