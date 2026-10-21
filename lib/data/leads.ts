// Lead data for the Queue and Leads pages. Server only.
// Every query runs as the signed-in user (anon key + session), so RLS decides what comes back:
// an admin gets the whole org, a rep only the leads assigned to them.
import "server-only";
import { getAgentConfig } from "@/lib/agent-config";
import { requireProfile } from "@/lib/auth";
import { toDetail, toListItem, type LeadRow, type SignalRow } from "@/lib/leads-mapping";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  FilteredLead,
  LeadCounts,
  LeadDetail,
  LeadListItem,
  LeadsPage,
  LeadsSort,
  QueueTab,
  SignalType,
  SortDir,
} from "@/lib/types";

const LEAD_COLUMNS = `
  id, status, score, score_parts, filtered_reason, updated_at,
  company:companies(id, name, domain, icp_tier, icp_reasons, team_size, yc_batch, description, industries),
  contact:contacts(name, title, is_placeholder, send_address, buyer_status, buyer_reason),
  assignee:profiles(id, full_name)
`;
const SIGNAL_COLUMNS = "id, company_id, type, title, excerpt, source_name, source_url, occurred_at, detected_at, meta";

const QUEUE_LIMIT = 200;
const PAGE_SIZE = 100;
// Sort column per Leads-table sort; "company(name)" orders by the joined company's name.
const SORT_COLUMNS: Record<LeadsSort, string> = {
  score: "score",
  company: "company(name)",
  status: "status",
  updated: "updated_at",
};

async function context() {
  const profile = await requireProfile();
  const [supabase, config] = await Promise.all([createSupabaseServerClient(), getAgentConfig(profile.orgId)]);
  return { supabase, config };
}

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/** Signals for the given companies in one query, grouped by company. */
async function signalsFor(supabase: Supabase, companyIds: string[]): Promise<Map<string, SignalRow[]>> {
  const grouped = new Map<string, SignalRow[]>();
  if (companyIds.length === 0) return grouped;
  const { data, error } = await supabase.from("signals").select(SIGNAL_COLUMNS).in("company_id", companyIds);
  if (error) throw new Error(`Loading signals failed: ${error.message}`);
  for (const signal of data as SignalRow[]) {
    grouped.set(signal.company_id, [...(grouped.get(signal.company_id) ?? []), signal]);
  }
  return grouped;
}

function companyIds(rows: LeadRow[]): string[] {
  return [...new Set(rows.flatMap((row) => (row.company ? [row.company.id] : [])))];
}

/** One Queue tab, best score first. With signalTypes, only leads that have one of those signals. */
export async function listQueue({
  tab,
  signalTypes = [],
}: {
  tab: QueueTab;
  signalTypes?: SignalType[];
}): Promise<LeadListItem[]> {
  const { supabase, config } = await context();
  const { data, error } = await supabase
    .from("leads")
    .select(LEAD_COLUMNS)
    .eq("status", tab)
    .order("score", { ascending: false })
    .order("id")
    .limit(QUEUE_LIMIT);
  if (error) throw new Error(`Loading the ${tab} queue failed: ${error.message}`);

  const rows = data as unknown as LeadRow[];
  const signals = await signalsFor(supabase, companyIds(rows));
  const items = rows.map((row) => toListItem(row, signals.get(row.company?.id ?? "") ?? [], config));
  if (signalTypes.length === 0) return items;
  return items.filter((item) => item.signalTypes.some((type) => signalTypes.includes(type)));
}

export async function leadCounts(): Promise<LeadCounts> {
  const { supabase } = await context();
  const statuses = ["ready", "enrolled", "bounced", "replied", "filtered"] as const;
  const counts = await Promise.all(
    statuses.map(async (status) => {
      const { count, error } = await supabase.from("leads").select("id", { count: "exact", head: true }).eq("status", status);
      if (error) throw new Error(`Counting ${status} leads failed: ${error.message}`);
      return [status, count ?? 0] as const;
    }),
  );
  return Object.fromEntries(counts) as LeadCounts;
}

/** The filtered-out leads with their reasons, highest scores first, plus the total. */
export async function listFiltered({ limit = 50 }: { limit?: number } = {}): Promise<{ items: FilteredLead[]; total: number }> {
  const { supabase } = await context();
  const { data, error, count } = await supabase
    .from("leads")
    .select("id, score, filtered_reason, company:companies(name, domain)", { count: "exact" })
    .eq("status", "filtered")
    .order("score", { ascending: false })
    .order("id")
    .limit(limit);
  if (error) throw new Error(`Loading filtered leads failed: ${error.message}`);
  const items = (data as unknown as { id: string; score: number; filtered_reason: string | null; company: { name: string; domain: string } | null }[]).map(
    (row) => ({
      id: row.id,
      companyName: row.company?.name ?? "Unknown company",
      domain: row.company?.domain ?? "",
      score: row.score,
      reason: row.filtered_reason,
    }),
  );
  return { items, total: count ?? items.length };
}

/** One lead with every signal, or null if it doesn't exist or this user may not see it. */
export async function getLead(id: string): Promise<LeadDetail | null> {
  const { supabase, config } = await context();
  const { data, error } = await supabase.from("leads").select(LEAD_COLUMNS).eq("id", id).maybeSingle();
  if (error) {
    // A malformed id is "not found", not a crash.
    if (error.code === "22P02") return null;
    throw new Error(`Loading the lead failed: ${error.message}`);
  }
  if (!data) return null;
  const row = data as unknown as LeadRow;
  const signals = await signalsFor(supabase, companyIds([row]));
  return toDetail(row, signals.get(row.company?.id ?? "") ?? [], config);
}

/** A page of the Leads table, sorted and paged in the database. */
export async function listLeadsPage({
  sort = "score",
  dir = "desc",
  page = 1,
}: {
  sort?: LeadsSort;
  dir?: SortDir;
  page?: number;
}): Promise<LeadsPage> {
  const { supabase, config } = await context();
  const safePage = Number.isInteger(page) && page > 0 ? page : 1;
  const from = (safePage - 1) * PAGE_SIZE;
  const { data, error, count } = await supabase
    .from("leads")
    .select(LEAD_COLUMNS, { count: "exact" })
    .order(SORT_COLUMNS[sort], { ascending: dir === "asc" })
    .order("id")
    .range(from, from + PAGE_SIZE - 1);
  if (error) throw new Error(`Loading leads failed: ${error.message}`);

  const rows = data as unknown as LeadRow[];
  const signals = await signalsFor(supabase, companyIds(rows));
  return {
    rows: rows.map((row) => toListItem(row, signals.get(row.company?.id ?? "") ?? [], config)),
    total: count ?? rows.length,
    page: safePage,
    pageSize: PAGE_SIZE,
    sort,
    dir,
  };
}
