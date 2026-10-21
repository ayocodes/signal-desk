// The agent's rules for the web app: the TypeScript twin of agent/config.py load_config().
// Read rules only through getAgentConfig(orgId). Today it returns the /shared JSON defaults;
// Phase 4.5 loads the org's current version from the database, and only this file changes.
import guardrails from "@/shared/guardrails.json";
import outreach from "@/shared/outreach.json";
import scoring from "@/shared/scoring.json";
import sequence from "@/shared/sequence.json";
import type { LeadStatus, ScoreTier } from "@/lib/types";

export type ScoreBandRule = { min: number; label: string };

export type AgentConfig = {
  // "defaults" for the /shared files; a database version id once rules are stored per org.
  version: string;
  scoring: typeof scoring;
  guardrails: typeof guardrails;
  /** Sender, offer and the only claims a draft may make (shared/outreach.json). */
  outreach: typeof outreach;
  /** Default sequence steps created on approval (shared/sequence.json). */
  sequence: typeof sequence;
};

const DEFAULTS: AgentConfig = { version: "defaults", scoring, guardrails, outreach, sequence };

export async function getAgentConfig(orgId: string): Promise<AgentConfig> {
  void orgId; // part of the contract already, so callers don't change in Phase 4.5
  return DEFAULTS;
}

const FILTERED = { label: "Filtered", tier: "lo" } as const;

// Highest band first ("Strong" 90+, "Good" 70+, "Borderline" 50+), mapped to ScoreBadge tiers.
const BAND_TIERS: ScoreTier[] = ["hi", "md", "lo"];

/** The word and badge tier shown next to a lead's score. Only ready-or-later leads get a band. */
export function scoreBand(score: number, status: LeadStatus, config: AgentConfig): { label: string; tier: ScoreTier } {
  if (status === "filtered") return FILTERED;
  const bands = [...config.scoring.scoreBands].sort((a, b) => b.min - a.min);
  const index = bands.findIndex((band) => score >= band.min);
  if (index === -1) return FILTERED;
  return { label: bands[index].label, tier: BAND_TIERS[Math.min(index, BAND_TIERS.length - 1)] };
}
