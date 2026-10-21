// An org's agent rules, read as the signed-in user (members read their org's rules; RLS).
// Server only. The twin of agent/config.py load_config(org_id, db): the newest saved version,
// merged with the locked /shared parts, or the defaults when there is none or it's invalid.
import "server-only";
import { cache } from "react";
import { buildConfig, defaultConfig, type AgentConfig } from "@/lib/agent-config";
import { requireProfile } from "@/lib/auth";
import { maxPossibleScore, validateRules, type RulesDoc } from "@/lib/rules";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CurrentRules, RulesVersion, ThresholdPreview } from "@/lib/types";

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

type VersionRow = {
  version: number;
  rules: unknown;
  change_summary: unknown;
  created_at: string;
  saver: { id: string; full_name: string } | null;
};

const VERSION_COLUMNS = "version, rules, change_summary, created_at, saver:profiles(id, full_name)";

function savedBy(row: VersionRow): { id: string; name: string } | null {
  return row.saver ? { id: row.saver.id, name: row.saver.full_name } : null;
}

/** The org's current rules with who saved them, for the editor and the rules page. */
export async function getCurrentConfig(): Promise<CurrentRules> {
  const profile = await requireProfile();
  const [config, supabase] = await Promise.all([getAgentConfig(profile.orgId), createSupabaseServerClient()]);
  const base = {
    version: config.version,
    rules: config.rules,
    savedBy: null,
    savedAt: null,
    problem: config.problem,
    builtInBannedPhrases: config.builtInBannedPhrases,
    maxPossibleScore: maxPossibleScore(config.rules),
  };
  if (config.version === 0) return base;
  const { data, error } = await supabase
    .from("agent_configs")
    .select(VERSION_COLUMNS)
    .eq("org_id", profile.orgId)
    .eq("version", config.version)
    .single();
  if (error) throw new Error(`Loading the current rules failed: ${error.message}`);
  const row = data as unknown as VersionRow;
  return { ...base, savedBy: savedBy(row), savedAt: row.created_at };
}

/** Every saved version, newest first. */
export async function listConfigVersions(): Promise<RulesVersion[]> {
  const profile = await requireProfile();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("agent_configs")
    .select(VERSION_COLUMNS)
    .eq("org_id", profile.orgId)
    .order("version", { ascending: false });
  if (error) throw new Error(`Loading rule versions failed: ${error.message}`);
  const rows = data as unknown as VersionRow[];
  return rows.map((row, index) => ({
    version: row.version,
    savedBy: savedBy(row),
    savedAt: row.created_at,
    changeSummary: Array.isArray(row.change_summary) ? row.change_summary.filter((l): l is string => typeof l === "string") : [],
    isCurrent: index === 0,
  }));
}

/** One saved version's rules (for a revert), or null if this org has no such version. */
export async function getConfigVersion(version: number): Promise<RulesDoc | null> {
  const profile = await requireProfile();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("agent_configs")
    .select("rules")
    .eq("org_id", profile.orgId)
    .eq("version", version)
    .maybeSingle();
  if (error) throw new Error(`Loading rules version ${version} failed: ${error.message}`);
  return data ? (data.rules as unknown as RulesDoc) : null;
}

/** How many leads a threshold would put in the queue, from stored scores. */
export async function thresholdPreview(threshold: number): Promise<ThresholdPreview> {
  const profile = await requireProfile();
  const [config, supabase] = await Promise.all([getAgentConfig(profile.orgId), createSupabaseServerClient()]);
  const { data, error } = await supabase.rpc("threshold_preview", {
    p_threshold: threshold,
    p_weak: config.rules.weakSignalTypes,
  });
  if (error) throw new Error(`Previewing the threshold failed: ${error.message}`);
  const [row] = data;
  return { threshold, wouldBeReady: Number(row?.would_be_ready ?? 0), readyNow: Number(row?.ready_now ?? 0) };
}
