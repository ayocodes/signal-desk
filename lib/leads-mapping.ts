// Database rows -> UI shapes (lib/types.ts). Pure functions, so they're unit-tested without a database.
import { scoreBand, type AgentConfig } from "@/lib/agent-config";
import type { Json } from "@/lib/database.types";
import type { CheckResult } from "@/lib/guardrails";
import type {
  BuyerStatus,
  DraftAngle,
  DraftTrace,
  DraftView,
  HiringCategory,
  IcpTier,
  LeadDetail,
  LeadListItem,
  LeadStatus,
  ScorePart,
  SignalType,
  SignalView,
} from "@/lib/types";

/** Row shapes as selected in lib/data/leads.ts. */
export type SignalRow = {
  id: string;
  company_id: string;
  type: SignalType;
  title: string;
  excerpt: string | null;
  source_name: string;
  source_url: string | null;
  occurred_at: string | null;
  detected_at: string;
  meta: Json;
};

export type LeadRow = {
  id: string;
  status: LeadStatus;
  score: number;
  score_parts: Json;
  filtered_reason: string | null;
  updated_at: string;
  company: {
    id: string;
    name: string;
    domain: string;
    icp_tier: IcpTier | null;
    icp_reasons: Json;
    team_size: number | null;
    yc_batch: string | null;
    description: string | null;
    industries: string[];
    /** Embedded in the same query (lib/data/leads.ts), filtered by RLS like any read. */
    signals?: SignalRow[];
  } | null;
  contact: {
    name: string;
    title: string | null;
    is_placeholder: boolean;
    send_address: string;
    buyer_status: BuyerStatus;
    buyer_reason: string | null;
  } | null;
  assignee: { id: string; full_name: string } | null;
};

const TYPE_PRIORITY: Record<SignalType, number> = { hiring: 0, launch: 1, funding: 2 };
const CATEGORIES = new Set<string>(["sales", "gtm", "marketing"]);

export function toSignalView(row: SignalRow): SignalView {
  const meta = row.meta && typeof row.meta === "object" && !Array.isArray(row.meta) ? row.meta : {};
  const category = typeof meta.category === "string" && CATEGORIES.has(meta.category) ? meta.category : null;
  return {
    id: row.id,
    type: row.type,
    category: category as HiringCategory | null,
    title: row.title,
    excerpt: row.excerpt,
    sourceName: row.source_name,
    sourceUrl: row.source_url,
    occurredAt: row.occurred_at ?? row.detected_at,
  };
}

/** Strongest first: hiring, then launch, then funding; newest first within a type. */
export function bySignalStrength(a: SignalView, b: SignalView): number {
  return TYPE_PRIORITY[a.type] - TYPE_PRIORITY[b.type] || b.occurredAt.localeCompare(a.occurredAt);
}

function scoreParts(value: Json): ScorePart[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((part) =>
    Array.isArray(part) && typeof part[0] === "string" && typeof part[1] === "number" ? [[part[0], part[1]] as ScorePart] : [],
  );
}

function stringList(value: Json): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function toListItem(row: LeadRow, signals: SignalRow[], config: AgentConfig): LeadListItem {
  const views = signals.map(toSignalView).sort(bySignalStrength);
  const { label, tier } = scoreBand(row.score, row.status, config);
  const newest = views.reduce<string | null>((latest, s) => (latest === null || s.occurredAt > latest ? s.occurredAt : latest), null);
  return {
    id: row.id,
    status: row.status,
    score: row.score,
    scoreParts: scoreParts(row.score_parts),
    band: label,
    tier,
    company: { id: row.company?.id ?? "", name: row.company?.name ?? "Unknown company", domain: row.company?.domain ?? "" },
    contact: row.contact
      ? { name: row.contact.name, title: row.contact.title, isPlaceholder: row.contact.is_placeholder }
      : null,
    topSignal: views[0] ?? null,
    signalTypes: [...new Set(views.map((s) => s.type))],
    newestSignalAt: newest,
    assignee: row.assignee ? { id: row.assignee.id, name: row.assignee.full_name } : null,
    updatedAt: row.updated_at,
  };
}

export function toDetail(row: LeadRow, signals: SignalRow[], config: AgentConfig): LeadDetail {
  const item = toListItem(row, signals, config);
  const company = row.company;
  return {
    ...item,
    company: {
      ...item.company,
      icpTier: company?.icp_tier ?? null,
      icpReasons: stringList(company?.icp_reasons ?? null),
      teamSize: company?.team_size ?? null,
      ycBatch: company?.yc_batch ?? null,
      description: company?.description ?? null,
      industries: company?.industries ?? [],
    },
    contact: row.contact
      ? {
          name: row.contact.name,
          title: row.contact.title,
          isPlaceholder: row.contact.is_placeholder,
          sendAddress: row.contact.send_address,
          buyerStatus: row.contact.buyer_status,
          buyerReason: row.contact.buyer_reason,
        }
      : null,
    filteredReason: row.filtered_reason,
    signals: signals.map(toSignalView).sort(bySignalStrength),
  };
}

/** Draft row shape as selected in lib/data/drafts.ts. */
export type DraftRow = {
  id: string;
  angle: DraftAngle;
  subject: string;
  body: string;
  grounded_phrases: Json;
  guardrail_results: Json;
  passed: boolean;
  model: string | null;
  tokens_in: number | null;
  tokens_out: number | null;
  prompt: string | null;
  trace: Json;
  created_at: string;
  creator: { id: string; full_name: string } | null;
};

const CHECK_STATUSES = new Set(["pass", "fail", "warn"]);

function checkResults(value: Json): CheckResult[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) =>
    item && typeof item === "object" && !Array.isArray(item) && typeof item.check === "string" &&
    typeof item.status === "string" && CHECK_STATUSES.has(item.status) && typeof item.message === "string"
      ? [{ check: item.check, status: item.status, message: item.message } as CheckResult]
      : [],
  );
}

function draftTrace(value: Json): DraftTrace | null {
  // Written only by the agent and the draft route, in this shape (agent/drafting.py _trace).
  return value && typeof value === "object" && !Array.isArray(value) && typeof value.promptHash === "string"
    ? (value as unknown as DraftTrace)
    : null;
}

export function toDraftView(row: DraftRow): DraftView {
  return {
    id: row.id,
    angle: row.angle,
    subject: row.subject,
    body: row.body,
    groundedPhrases: stringList(row.grounded_phrases),
    checks: checkResults(row.guardrail_results),
    passed: row.passed,
    model: row.model,
    tokensIn: row.tokens_in,
    tokensOut: row.tokens_out,
    prompt: row.prompt,
    trace: draftTrace(row.trace),
    createdAt: row.created_at,
    createdBy: row.creator ? { id: row.creator.id, name: row.creator.full_name } : null,
  };
}

const ANGLE_ORDER: DraftAngle[] = ["signal", "peer", "short", "raw"];

/** The newest draft per angle (Regenerate adds a new row; older ones stay for the record). */
export function latestDrafts(rows: DraftRow[]): DraftView[] {
  const newest = new Map<DraftAngle, DraftRow>();
  for (const row of rows) {
    const current = newest.get(row.angle);
    if (!current || row.created_at > current.created_at) newest.set(row.angle, row);
  }
  return ANGLE_ORDER.flatMap((angle) => {
    const row = newest.get(angle);
    return row ? [toDraftView(row)] : [];
  });
}
