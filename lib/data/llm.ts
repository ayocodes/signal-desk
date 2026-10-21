// LLM calls used today against the daily budget. Server only. Any member may read the count
// (llm_calls_today() in migration 007); the budget is one number for the whole API key.
import "server-only";
import { getAgentConfig } from "@/lib/data/agent-config";
import { requireProfile } from "@/lib/auth";
import { env } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { LlmBudget } from "@/lib/types";

export async function llmBudgetToday(): Promise<LlmBudget> {
  const profile = await requireProfile();
  const [supabase, config] = await Promise.all([createSupabaseServerClient(), getAgentConfig(profile.orgId)]);
  const { data, error } = await supabase.rpc("llm_calls_today");
  if (error) throw new Error(`Reading today's LLM calls failed: ${error.message}`);
  const limit = env.llm.dailyBudget;
  return { used: data, limit, agentLimit: Math.floor(limit * config.outreach.llm.agentShare) };
}
