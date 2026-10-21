// Drafts for the email editor. Server only. Reads run as the signed-in user, so RLS decides:
// a rep sees drafts of their own leads only.
import "server-only";
import { getAgentConfig } from "@/lib/agent-config";
import { requireProfile } from "@/lib/auth";
import { env } from "@/lib/env";
import { guardrailRules } from "@/lib/guardrails";
import { latestDrafts, toDraftView, type DraftRow } from "@/lib/leads-mapping";
import { llmBudgetToday } from "@/lib/data/llm";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { DraftView, DraftWorkspace } from "@/lib/types";

export const DRAFT_COLUMNS =
  "id, angle, subject, body, grounded_phrases, guardrail_results, passed, model, tokens_in, tokens_out, prompt, trace, created_at, creator:profiles(id, full_name)";

/** The latest draft per angle for one lead, plus what the editor needs to check and send. */
export async function getDraftWorkspace(leadId: string): Promise<DraftWorkspace> {
  const profile = await requireProfile();
  const [supabase, config, llmBudget] = await Promise.all([
    createSupabaseServerClient(),
    getAgentConfig(profile.orgId),
    llmBudgetToday(),
  ]);
  const context = {
    sender: { ...config.outreach.sender, fromAddress: env.resend.from },
    guardrailRules: guardrailRules(config),
    llmBudget,
  };
  const { data, error } = await supabase
    .from("drafts")
    .select(DRAFT_COLUMNS)
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });
  if (error) {
    if (error.code === "22P02") return { drafts: [], ...context }; // malformed id: no drafts, not a crash
    throw new Error(`Loading drafts failed: ${error.message}`);
  }
  return { drafts: latestDrafts(data as unknown as DraftRow[]), ...context };
}

/** One draft of one lead, or null if it doesn't exist or this user may not see it. */
export async function getDraft(leadId: string, draftId: string): Promise<DraftView | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("drafts")
    .select(DRAFT_COLUMNS)
    .eq("id", draftId)
    .eq("lead_id", leadId)
    .maybeSingle();
  if (error) {
    if (error.code === "22P02") return null;
    throw new Error(`Loading the draft failed: ${error.message}`);
  }
  return data ? toDraftView(data as unknown as DraftRow) : null;
}

/** The newest stored Unconstrained draft for a lead, if one was generated already. */
export async function getRawDraft(leadId: string): Promise<DraftView | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("drafts")
    .select(DRAFT_COLUMNS)
    .eq("lead_id", leadId)
    .eq("angle", "raw")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Loading the Unconstrained draft failed: ${error.message}`);
  return data ? toDraftView(data as unknown as DraftRow) : null;
}
