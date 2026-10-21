// LLM calls used today against the daily budget. Server only. Any member may read the count
// (llm_calls_today() in migration 007); the budget is one number for the whole API key.
import "server-only";
import { getAgentConfig } from "@/lib/data/agent-config";
import { requireProfile } from "@/lib/auth";
import { env } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { LlmBudget, LlmPacing } from "@/lib/types";

export async function llmBudgetToday(): Promise<LlmBudget> {
  const profile = await requireProfile();
  const [supabase, config] = await Promise.all([createSupabaseServerClient(), getAgentConfig(profile.orgId)]);
  const { data, error } = await supabase.rpc("llm_calls_today");
  if (error) throw new Error(`Reading today's LLM calls failed: ${error.message}`);
  const limit = env.llm.dailyBudget;
  return { used: data, limit, agentLimit: Math.floor(limit * config.outreach.llm.agentShare) };
}

/** Drafting's deploy settings, for Ops. Admins only (agent runs are admin-readable). */
export async function llmPacing(): Promise<LlmPacing> {
  const profile = await requireProfile();
  const [supabase, config] = await Promise.all([createSupabaseServerClient(), getAgentConfig(profile.orgId)]);
  const { data, error } = await supabase
    .from("agent_runs")
    .select("stats")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Reading the latest agent run failed: ${error.message}`);
  const stats = data?.stats && typeof data.stats === "object" && !Array.isArray(data.stats) ? data.stats : {};
  const { llm } = config.outreach;
  return {
    draftsPerRun: typeof stats.drafts_per_run === "number" ? stats.drafts_per_run : null,
    agentShare: llm.agentShare,
    maxRetriesPerLead: llm.maxRetriesPerLead,
    minSecondsBetweenCalls: llm.minSecondsBetweenCalls,
    regeneratePerUserPerHour: llm.regeneratePerUserPerHour,
  };
}
