// What the draft and approve routes do. Server only.
//
// Both start by reading the lead through the user's own session (getLead), so RLS proves the
// user may see it. Only then do they write through the service-role client, and only what
// the database can't check alone: a draft made by the LLM, or an approval whose text has
// passed the guardrails here on the server. approve_lead() re-checks access in the database.
import "server-only";
import { z } from "zod";
import type { AgentConfig } from "@/lib/agent-config";
import { getAgentConfig } from "@/lib/data/agent-config";
import type { ApiError } from "@/lib/api";
import { logUserAction } from "@/lib/audit";
import type { Profile } from "@/lib/auth";
import { DRAFT_COLUMNS, getDraft, getRawDraft } from "@/lib/data/drafts";
import { getLead } from "@/lib/data/leads";
import { env } from "@/lib/env";
import { guardrailRules, passed, runGuardrails } from "@/lib/guardrails";
import { toDraftView, type DraftRow } from "@/lib/leads-mapping";
import { generateJson, LlmError, LlmQuotaExhausted, type LlmResult } from "@/lib/llm";
import { promptTemplates } from "@/lib/prompt-templates";
import { promptHash, renderDraftPrompt, renderRawPrompt, signalLabel, type PromptFacts } from "@/lib/prompts";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { DraftAngle, DraftTrace, DraftView, LeadDetail } from "@/lib/types";
import draftSchema from "@/shared/prompts/draft_schema.json";

export type ServiceResult<T> = { ok: true; data: T } | { ok: false; status: number; error: ApiError };

const fail = (status: number, code: ApiError["code"], message: string, extra: Partial<ApiError> = {}) =>
  ({ ok: false, status, error: { code, message, ...extra } }) as const;

const DraftsAnswer = z.object({
  drafts: z.array(
    z.object({
      angle: z.enum(["signal", "peer", "short", "raw"]),
      subject: z.string(),
      body: z.string(),
      grounded_phrases: z.array(z.string()),
    }),
  ),
});

// approve_lead() raises these codes (migration 007); each maps to a status and a plain message.
const APPROVE_ERRORS: Record<string, [number, ApiError["code"], string]> = {
  "42501": [403, "forbidden", "This lead is assigned to someone else."],
  P0002: [404, "not_found", "This lead no longer exists."],
  "23505": [409, "already_enrolled", "This lead is already enrolled."],
  P0001: [409, "not_ready", "Only ready leads can be approved."],
  "22023": [422, "not_approvable", "This draft can't be approved."],
};

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null; // not JSON: the schema check below rejects it
  }
}

function factsFrom(lead: LeadDetail): PromptFacts {
  return {
    companyName: lead.company.name,
    domain: lead.company.domain,
    description: lead.company.description,
    contact: lead.contact
      ? { name: lead.contact.name, title: lead.contact.title, isPlaceholder: lead.contact.isPlaceholder }
      : null,
    // Already strongest first (lib/leads-mapping.ts), the same order the agent uses.
    signals: lead.signals.map((s) => ({
      type: s.type,
      category: s.category,
      title: s.title,
      excerpt: s.excerpt,
      sourceName: s.sourceName,
    })),
  };
}

function guardrailInput(lead: LeadDetail, angle: string, subject: string, body: string, groundedPhrases: string[]) {
  return {
    angle,
    subject,
    body,
    groundedPhrases,
    signals: lead.signals.map((s) => ({ title: s.title, excerpt: s.excerpt })),
  };
}

async function reserveCall(profile: Profile, lead: LeadDetail, angle: DraftAngle, config: AgentConfig) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("reserve_llm_call", {
    p_org: profile.orgId,
    p_source: angle === "raw" ? "unconstrained" : "regenerate",
    p_actor: profile.id,
    p_lead: lead.id,
    p_daily_limit: env.llm.dailyBudget,
    p_actor_hourly_limit: config.outreach.llm.regeneratePerUserPerHour,
  });
  if (error) throw new Error(`Reserving an LLM call failed: ${error.message}`);
  return data[0] ?? { call_id: null, refusal: "budget" };
}

async function finishCall(callId: string, result: LlmResult | null, error: string | null): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { error: updateError } = await admin
    .from("llm_calls")
    .update({
      ok: error === null,
      error,
      ...(result ? { model: result.model, tokens_in: result.tokensIn, tokens_out: result.tokensOut } : {}),
    })
    .eq("id", callId);
  if (updateError) throw new Error(`Recording the LLM call failed: ${updateError.message}`);
}

/** Regenerate one angle, or make the Unconstrained ("raw") draft the first time it's asked for. */
export async function generateDraft(profile: Profile, leadId: string, angle: DraftAngle): Promise<ServiceResult<DraftView>> {
  const lead = await getLead(leadId);
  if (!lead) return fail(404, "not_found", "Lead not found.");
  if (lead.status !== "ready") return fail(409, "not_ready", "Drafts can only be made for ready leads.");

  if (angle === "raw") {
    const existing = await getRawDraft(lead.id);
    if (existing) return { ok: true, data: existing };
  }

  const config = await getAgentConfig(profile.orgId);
  const reservation = await reserveCall(profile, lead, angle, config);
  if (!reservation.call_id) {
    if (reservation.refusal === "rate_limited") {
      const perHour = config.outreach.llm.regeneratePerUserPerHour;
      return fail(429, "rate_limited", `You can make ${perHour} drafts an hour. Try again a little later.`);
    }
    const limit = env.llm.dailyBudget;
    return fail(429, "budget_exhausted", `Today's AI budget is used up (${limit} of ${limit} calls). It resets at 00:00 UTC.`);
  }
  const callId = reservation.call_id;

  const facts = factsFrom(lead);
  const templates = await promptTemplates();
  const prompt = angle === "raw" ? renderRawPrompt(facts, config, templates) : renderDraftPrompt(facts, config, templates);

  let result: LlmResult;
  try {
    result = await generateJson(prompt, draftSchema);
  } catch (error) {
    if (!(error instanceof LlmError)) throw error;
    await finishCall(callId, null, error.message);
    if (error instanceof LlmQuotaExhausted) {
      return fail(429, "budget_exhausted", "Google's daily limit for this model is used up. It resets at midnight Pacific time.");
    }
    return fail(502, "llm_failed", "The AI model didn't answer. Try again in a minute.");
  }

  const parsed = DraftsAnswer.safeParse(parseJson(result.text));
  const draft = parsed.success
    ? (parsed.data.drafts.find((d) => d.angle === angle) ?? (angle === "raw" ? parsed.data.drafts[0] : undefined))
    : undefined;
  if (!draft) {
    await finishCall(callId, result, `The answer had no ${angle} draft`);
    return fail(502, "llm_failed", "The AI model's answer couldn't be used. Try again.");
  }
  await finishCall(callId, result, null);

  const checks = runGuardrails(guardrailInput(lead, angle, draft.subject, draft.body, draft.grounded_phrases), guardrailRules(config));
  const digest = promptHash(prompt);
  const trace: DraftTrace = {
    source: angle === "raw" ? "unconstrained" : "regenerate",
    promptHash: digest,
    signals:
      angle === "raw"
        ? [] // the baseline prompt carries no signals
        : facts.signals
            .slice(0, config.outreach.maxSignalsInPrompt)
            .map((s) => ({ label: signalLabel(s, config), title: s.title })),
    attempts: [
      {
        attempt: 1,
        model: result.model,
        tokensIn: result.tokensIn,
        tokensOut: result.tokensOut,
        ms: result.ms,
        error: null,
        failedChecks: { [angle]: checks.filter((c) => c.status === "fail").map((c) => c.check) },
      },
    ],
    chosenAttempt: 1,
  };

  const admin = createSupabaseAdminClient();
  const { data: row, error } = await admin
    .from("drafts")
    .insert({
      org_id: profile.orgId,
      lead_id: lead.id,
      angle,
      subject: draft.subject,
      body: draft.body,
      grounded_phrases: draft.grounded_phrases,
      guardrail_results: checks,
      passed: passed(checks),
      model: result.model,
      prompt_hash: digest,
      prompt,
      tokens_in: result.tokensIn,
      tokens_out: result.tokensOut,
      trace,
      created_by: profile.id,
      llm_call_id: callId,
    })
    .select(DRAFT_COLUMNS)
    .single();
  if (error) throw new Error(`Saving the draft failed: ${error.message}`);
  const view = toDraftView(row as unknown as DraftRow);

  await logUserAction(profile, {
    action: angle === "raw" ? "draft.unconstrained_generated" : "draft.regenerated",
    entityType: "lead",
    entityId: lead.id,
    detail: { draftId: view.id, angle, passed: view.passed },
  });
  return { ok: true, data: view };
}

/** Approve a draft (possibly edited) and enroll the lead. The guardrails run again here. */
export async function approveLead(
  profile: Profile,
  leadId: string,
  input: { draftId: string; subject: string; body: string },
): Promise<ServiceResult<{ sequenceId: string }>> {
  const lead = await getLead(leadId);
  if (!lead) return fail(404, "not_found", "Lead not found.");
  const draft = await getDraft(lead.id, input.draftId);
  if (!draft) return fail(404, "not_found", "Draft not found for this lead.");
  if (draft.angle === "raw") return fail(422, "not_approvable", "Unconstrained drafts can't be approved.");

  const config = await getAgentConfig(profile.orgId);
  const checks = runGuardrails(
    guardrailInput(lead, draft.angle, input.subject, input.body, draft.groundedPhrases),
    guardrailRules(config),
  );
  if (!passed(checks)) {
    return fail(422, "checks_failed", "Some checks fail. Fix them before approving.", { results: checks });
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("approve_lead", {
    p_actor: profile.id,
    p_lead: lead.id,
    p_draft: draft.id,
    p_subject: input.subject,
    p_body: input.body,
    p_steps: config.sequence.steps,
  });
  if (error) {
    const mapped = APPROVE_ERRORS[error.code];
    if (mapped) return fail(...mapped);
    throw new Error(`Approving the lead failed: ${error.message}`);
  }
  return { ok: true, data: { sequenceId: data } };
}
