// The agent's rules for the web app: the TypeScript twin of agent/config.py.
// An org's editable rules (lib/rules.ts) merged with the locked parts that always come from
// /shared (built-in banned phrases, sender company, angles, LLM pacing, sequence steps).
// Pure, so the browser and tests can use it. lib/data/agent-config.ts getAgentConfig(orgId)
// loads an org's newest saved version; read rules only through that.
import guardrails from "@/shared/guardrails.json";
import outreach from "@/shared/outreach.json";
import defaults from "@/shared/defaults/rules.json";
import sequence from "@/shared/sequence.json";
import type { RulesDoc } from "@/lib/rules";
import type { LeadStatus, ScoreTier } from "@/lib/types";

export type AgentConfig = {
  /** The org's rules version (stored on each lead it scores); 0 means the defaults. */
  version: number;
  /** Why the defaults are used instead of the org's stored rules, if they are. */
  problem: string | null;
  rules: RulesDoc;
  /** Locked checks plus the org's max body words; bannedPhrases includes the org's extras. */
  guardrails: Omit<typeof guardrails, "bannedPhrases"> & { maxBodyWords: number; bannedPhrases: string[] };
  /** Always banned, whatever the org adds (shown locked in the rules editor). */
  builtInBannedPhrases: string[];
  outreach: Omit<typeof outreach, "sender"> & {
    sender: { name: string; company: string };
    offer: string;
    proofPoints: string[];
  };
  /** Default sequence steps created on approval (shared/sequence.json). */
  sequence: typeof sequence;
};

export const DEFAULT_RULES = defaults as RulesDoc;
export const DEFAULTS_VERSION = 0;

export function buildConfig(rules: RulesDoc, version: number, problem: string | null = null): AgentConfig {
  return {
    version,
    problem,
    rules,
    guardrails: {
      ...guardrails,
      maxBodyWords: rules.guardrails.maxBodyWords,
      bannedPhrases: [...guardrails.bannedPhrases, ...rules.guardrails.extraBannedPhrases],
    },
    builtInBannedPhrases: guardrails.bannedPhrases,
    outreach: {
      ...outreach,
      sender: { name: rules.outreach.senderName, company: outreach.sender.company },
      offer: rules.outreach.offer,
      proofPoints: rules.outreach.proofPoints,
    },
    sequence,
  };
}

/** The /shared defaults (version 0). The fallback, and what tests use. */
export function defaultConfig(problem: string | null = null): AgentConfig {
  return buildConfig(DEFAULT_RULES, DEFAULTS_VERSION, problem);
}

/** How a signal is named everywhere: the hiring category's name, "Launch" or "YC recent". */
export function signalLabelFor(type: string, category: string | null, config: AgentConfig): string {
  if (type === "hiring") return config.rules.hiring.categories.find((c) => c.id === category)?.name ?? "Hiring";
  if (type === "launch") return "Launch";
  return "YC recent";
}

const FILTERED = { label: "Filtered", tier: "lo" } as const;

// Highest band first ("Strong" 90+, "Good" 70+, "Borderline" 50+), mapped to ScoreBadge tiers.
const BAND_TIERS: ScoreTier[] = ["hi", "md", "lo"];

/** The word and badge tier shown next to a lead's score. Only ready-or-later leads get a band. */
export function scoreBand(score: number, status: LeadStatus, config: AgentConfig): { label: string; tier: ScoreTier } {
  if (status === "filtered") return FILTERED;
  const bands = [...config.rules.scoreBands].sort((a, b) => b.min - a.min);
  const index = bands.findIndex((band) => score >= band.min);
  if (index === -1) return FILTERED;
  return { label: bands[index].label, tier: BAND_TIERS[Math.min(index, BAND_TIERS.length - 1)] };
}
