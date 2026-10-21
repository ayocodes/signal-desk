// UI shapes for leads. Components take these as props; they never see raw database rows.
import type { Database } from "@/lib/database.types";
import type { CheckResult, GuardrailRules } from "@/lib/guardrails";
import type { RulesDoc } from "@/lib/rules";

export type LeadStatus = Database["public"]["Enums"]["lead_status"];
export type SignalType = Database["public"]["Enums"]["signal_type"];
export type BuyerStatus = Database["public"]["Enums"]["buyer_status"];
export type IcpTier = Database["public"]["Enums"]["icp_tier"];

/** One line of the score math: ["ICP match", 40]. */
export type ScorePart = [label: string, points: number];

/** ScoreBadge colors: Strong, Good, Borderline/Filtered. */
export type ScoreTier = "hi" | "md" | "lo";

/** Hiring signals carry the id of the org's hiring category that matched the job title. */
export type HiringCategory = string;

export type SignalView = {
  id: string;
  type: SignalType;
  /** Hiring signals: the org's hiring category id ("sales", "marketing", ...), if it still matches one. */
  category: HiringCategory | null;
  /** How the signal is named everywhere: the hiring category's name, "Launch" or "YC recent". */
  label: string;
  title: string;
  excerpt: string | null;
  sourceName: string;
  sourceUrl: string | null;
  /** When it happened (job posted, story published); falls back to when we detected it. */
  occurredAt: string;
};

export type CompanySummary = { id: string; name: string; domain: string };

export type ContactSummary = { name: string; title: string | null; isPlaceholder: boolean };

export type LeadListItem = {
  id: string;
  status: LeadStatus;
  score: number;
  scoreParts: ScorePart[];
  /** "Strong" | "Good" | "Borderline" | "Filtered" (labels come from the scoring rules). */
  band: string;
  tier: ScoreTier;
  company: CompanySummary;
  contact: ContactSummary | null;
  /** The strongest signal: hiring, then launch, then funding; newest first within a type. */
  topSignal: SignalView | null;
  signalTypes: SignalType[];
  newestSignalAt: string | null;
  assignee: { id: string; name: string } | null;
  updatedAt: string;
};

export type CompanyDetail = CompanySummary & {
  icpTier: IcpTier | null;
  icpReasons: string[];
  teamSize: number | null;
  ycBatch: string | null;
  description: string | null;
  industries: string[];
};

export type ContactDetail = ContactSummary & {
  /** Always a Resend test inbox (hard rule 3). */
  sendAddress: string;
  buyerStatus: BuyerStatus;
  buyerReason: string | null;
};

export type LeadDetail = Omit<LeadListItem, "company" | "contact"> & {
  company: CompanyDetail;
  contact: ContactDetail | null;
  filteredReason: string | null;
  /** Every signal, strongest first (same order as topSignal). */
  signals: SignalView[];
};

export type QueueTab = "ready" | "enrolled" | "bounced" | "replied";
export const QUEUE_TABS: QueueTab[] = ["ready", "enrolled", "bounced", "replied"];

export type LeadCounts = Record<QueueTab | "filtered", number>;

export type FilteredLead = { id: string; companyName: string; domain: string; score: number; reason: string | null };

export type LeadsSort = "score" | "company" | "status" | "updated";
export type SortDir = "asc" | "desc";

export type LeadsPage = {
  rows: LeadListItem[];
  total: number;
  page: number;
  pageSize: number;
  sort: LeadsSort;
  dir: SortDir;
};

// Drafts and the email editor (Phase 4) ---------------------------------------------------

export type DraftAngle = Database["public"]["Enums"]["draft_angle"];
/** Editor order. "raw" is shown as "Unconstrained" and can never be approved. */
export const DRAFT_ANGLES: DraftAngle[] = ["signal", "peer", "short", "raw"];

export type DraftTraceAttempt = {
  attempt: number;
  model: string | null;
  tokensIn: number | null;
  tokensOut: number | null;
  ms: number | null;
  error: string | null;
  /** Checks that failed per angle on this attempt, e.g. { peer: ["claims"] }. */
  failedChecks: Record<string, string[]>;
};

/** How a draft was made: shown in the "Agent trace" collapsible. */
export type DraftTrace = {
  source: "agent" | "regenerate" | "unconstrained";
  promptHash: string;
  /** The signals the prompt listed, strongest first. */
  signals: { label: string; title: string }[];
  attempts: DraftTraceAttempt[];
  chosenAttempt: number;
  /** Agent drafts: one call wrote all three angles, so the tokens are shared. */
  tokensSharedByAngles?: boolean;
};

export type DraftView = {
  id: string;
  angle: DraftAngle;
  subject: string;
  body: string;
  groundedPhrases: string[];
  /** Guardrail results stored when the draft was made. The editor re-runs them live. */
  checks: CheckResult[];
  passed: boolean;
  model: string | null;
  tokensIn: number | null;
  tokensOut: number | null;
  /** The exact prompt sent to the model ("Prompt sent to the model"). */
  prompt: string | null;
  trace: DraftTrace | null;
  createdAt: string;
  /** Who regenerated it; null for agent drafts. */
  createdBy: { id: string; name: string } | null;
};

/** LLM calls today (UTC) against LLM_DAILY_BUDGET. The agent stops at agentLimit. */
export type LlmBudget = { used: number; limit: number; agentLimit: number };

/** Everything the email editor needs besides the lead itself. */
export type DraftWorkspace = {
  /** The latest draft per angle, in DRAFT_ANGLES order. Unconstrained appears once generated. */
  drafts: DraftView[];
  sender: { name: string; company: string; fromAddress: string };
  /** Pass to runGuardrails() for the live checks. */
  guardrailRules: GuardrailRules;
  llmBudget: LlmBudget;
};

// Agent rules (Phase 4.5) -----------------------------------------------------------------

/** The org's current rules, for the editor and the "What our agent looks for" page. */
export type CurrentRules = {
  /** 0 when the org runs on the defaults (no saved version, or the saved one is invalid). */
  version: number;
  rules: RulesDoc;
  savedBy: { id: string; name: string } | null;
  savedAt: string | null;
  /** Why the defaults are shown instead of a saved version, if they are. */
  problem: string | null;
  /** Always banned in emails; shown locked next to the org's extra phrases. */
  builtInBannedPhrases: string[];
  /** The most points any lead could score under these rules (the threshold can't exceed it). */
  maxPossibleScore: number;
};

/** One saved version, newest first in listConfigVersions(). */
export type RulesVersion = {
  version: number;
  savedBy: { id: string; name: string } | null;
  savedAt: string;
  /** Readable change lines, e.g. "Threshold 50 → 55". */
  changeSummary: string[];
  isCurrent: boolean;
};

/** "N leads in the queue at this threshold, was M" (from stored scores). */
export type ThresholdPreview = { threshold: number; wouldBeReady: number; readyNow: number };

/** Deploy settings for drafting, shown read-only in Ops. */
export type LlmPacing = {
  /** From the latest agent run (the DRAFTS_PER_RUN variable on GitHub); null before the first run. */
  draftsPerRun: number | null;
  /** Share of the daily budget the agent may use, e.g. 0.8. */
  agentShare: number;
  maxRetriesPerLead: number;
  minSecondsBetweenCalls: number;
  regeneratePerUserPerHour: number;
};
