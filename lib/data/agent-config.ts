// An org's agent rules, read as the signed-in user (members read their org's rules; RLS).
// Server only. The twin of agent/config.py load_config(org_id, db): the newest saved version,
// merged with the locked /shared parts, or the defaults when there is none or it's invalid.
import "server-only";
import { cache } from "react";
import { buildConfig, defaultConfig, type AgentConfig } from "@/lib/agent-config";
import { validateRules, type RulesDoc } from "@/lib/rules";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// cache(): one read per request, however many functions ask.
export const getAgentConfig = cache(async (orgId: string): Promise<AgentConfig> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("agent_configs")
    .select("version, rules")
    .eq("org_id", orgId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Loading the agent rules failed: ${error.message}`);
  if (!data) return defaultConfig("No saved rules for this org yet; using the defaults.");
  const [first] = validateRules(data.rules);
  if (first) {
    return defaultConfig(`Rules version ${data.version} is invalid (${first.path}: ${first.code}); using the defaults.`);
  }
  return buildConfig(data.rules as unknown as RulesDoc, data.version);
});
