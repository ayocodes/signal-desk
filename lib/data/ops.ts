// The Ops page's numbers. Admins only: each function checks the role on the server
// (requireAdmin renders the 403 page for a rep), and RLS hides agent_runs, audit_log,
// mailboxes and llm_calls from reps as well. Every number comes from one query here, so it can
// be traced (C6.3 gives two of them as SQL to spot-check).
import "server-only";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  AuditFilter,
  AuditRow,
  BoardCoverage,
  EngineStats,
  MailboxHealth,
  OpsKpis,
  Ratio,
  SignalReplyRate,
  SignalType,
} from "@/lib/types";

const RUNS_MEASURED = 50;
const AUDIT_ROWS = 100;
const SIGNAL_TYPES: SignalType[] = ["hiring", "launch", "funding"];
const BOARD_SITES = ["greenhouse", "lever", "ashby"] as const;

export function ratio(count: number, total: number): Ratio {
  return { count, total, pct: total > 0 ? Math.round((1000 * count) / total) / 10 : null };
}

/** Nearest-rank percentile of sorted values; null for none. */
export function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
}

function fail(what: string, error: { message: string }): never {
  throw new Error(`${what} failed: ${error.message}`);
}

function statsOf(value: unknown): Record<string, number> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, number>) : {};
}

/** A full agent run scores every tracked lead; quick re-score and sequence runs may not. */
function leadsScored(stats: Record<string, number>): number | null {
  return typeof stats.leads_ready === "number" ? stats.leads_ready + (stats.leads_filtered ?? 0) : null;
}

type SequenceOutcome = {
  edited: boolean;
  companyId: string | null;
  sent: boolean;
  replied: boolean;
  simulatedReply: boolean;
};

async function sequenceOutcomes(): Promise<SequenceOutcome[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("sequences")
    .select("edited, lead:leads(company_id), steps:sequence_steps(status, events:email_events(type, source))");
  if (error) fail("Reading sequences", error);
  return data.map((row) => {
    const steps = row.steps ?? [];
    const replies = steps.flatMap((s) => s.events ?? []).filter((e) => e.type === "replied");
    return {
      edited: row.edited,
      companyId: row.lead?.company_id ?? null,
      sent: steps.some((s) => s.status === "sent"),
      replied: replies.length > 0,
      simulatedReply: replies.some((e) => e.source === "simulated"),
    };
  });
}

export async function getKpis(now = Date.now()): Promise<OpsKpis> {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const today = new Date(now).toISOString().slice(0, 10);
  const [outcomes, runs, proposals] = await Promise.all([
    sequenceOutcomes(),
    supabase.from("agent_runs").select("stats").gte("started_at", today).not("finished_at", "is", null),
    supabase.from("recovery_proposals").select("status"),
  ]);
  if (runs.error) fail("Reading today's agent runs", runs.error);
  if (proposals.error) fail("Reading recovery proposals", proposals.error);

  const scoredToday = runs.data.map((r) => leadsScored(statsOf(r.stats))).filter((n): n is number => n !== null);
  const sent = outcomes.filter((o) => o.sent);
  return {
    leadsScoredToday: scoredToday.length > 0 ? Math.max(...scoredToday) : null,
    enrolled: outcomes.length,
    editedBeforeSend: ratio(outcomes.filter((o) => o.edited).length, outcomes.length),
    bouncesRecovered: ratio(proposals.data.filter((p) => p.status === "approved").length, proposals.data.length),
    replyRate: {
      ...ratio(sent.filter((o) => o.replied).length, sent.length),
      simulated: sent.some((o) => o.simulatedReply),
    },
  };
}

export async function getReplyRateBySignal(): Promise<SignalReplyRate[]> {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const sent = (await sequenceOutcomes()).filter((o) => o.sent && o.companyId);
  const companyIds = [...new Set(sent.map((o) => o.companyId as string))];
  const { data, error } = companyIds.length
    ? await supabase.from("signals").select("company_id, type").in("company_id", companyIds)
    : { data: [], error: null };
  if (error) fail("Reading signals", error);

  const typesOf = new Map<string, Set<SignalType>>();
  for (const s of data) typesOf.set(s.company_id, (typesOf.get(s.company_id) ?? new Set()).add(s.type));
  return SIGNAL_TYPES.map((type) => {
    const withType = sent.filter((o) => typesOf.get(o.companyId as string)?.has(type));
    return {
      type,
      ...ratio(withType.filter((o) => o.replied).length, withType.length),
      simulated: withType.some((o) => o.simulatedReply),
    };
  });
}

type AuthJson = { domain?: string; spf?: string | null; dmarc?: string | null; dkim?: string; checked_on?: string };

export async function getMailboxHealth(now = Date.now()): Promise<MailboxHealth[]> {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("mailboxes")
    .select("id, label, send_via, status, pause_reason, paused_at, sent_today, sent_today_date, daily_cap, bounce_rate, complaint_rate, rates_since, auth")
    .order("label");
  if (error) fail("Reading mailboxes", error);
  const today = new Date(now).toISOString().slice(0, 10);
  return data.map((m) => {
    const auth = (m.auth ?? {}) as AuthJson;
    return {
      id: m.id,
      label: m.label,
      sendVia: m.send_via,
      status: m.status,
      pauseReason: m.pause_reason,
      pausedAt: m.paused_at,
      sentToday: m.sent_today_date === today ? m.sent_today : 0,
      dailyCap: m.daily_cap,
      bounceRate: Number(m.bounce_rate),
      complaintRate: Number(m.complaint_rate),
      ratesSince: m.rates_since,
      auth: auth.checked_on
        ? { domain: auth.domain ?? "", spf: auth.spf ?? null, dmarc: auth.dmarc ?? null, dkim: auth.dkim ?? "", checkedOn: auth.checked_on }
        : null,
    };
  });
}

export async function getEngineStats(): Promise<EngineStats> {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const [latest, recent, calls, drafts] = await Promise.all([
    supabase.from("agent_runs").select("trigger, started_at, finished_at, errors").order("started_at", { ascending: false }).limit(1).maybeSingle(),
    // Over-fetch, since quick runs are dropped below.
    supabase
      .from("agent_runs")
      .select("started_at, finished_at, stats, errors")
      .not("finished_at", "is", null)
      .order("started_at", { ascending: false })
      .limit(RUNS_MEASURED * 4),
    supabase.from("llm_calls").select("lead_id, tokens_in, tokens_out").not("lead_id", "is", null),
    supabase.from("drafts").select("passed").neq("angle", "raw"),
  ]);
  if (latest.error) fail("Reading the latest agent run", latest.error);
  if (recent.error) fail("Reading agent runs", recent.error);
  if (calls.error) fail("Reading LLM calls", calls.error);
  if (drafts.error) fail("Reading drafts", drafts.error);

  const full = recent.data.filter((r) => leadsScored(statsOf(r.stats)) !== null).slice(0, RUNS_MEASURED);
  const durations = full.map((r) => Date.parse(r.finished_at as string) - Date.parse(r.started_at)).sort((a, b) => a - b);
  const scored = full.map((r) => leadsScored(statsOf(r.stats)) as number);
  const hasErrors = (errors: unknown) => Array.isArray(errors) && errors.length > 0;
  const tokens = calls.data.reduce((sum, c) => sum + (c.tokens_in ?? 0) + (c.tokens_out ?? 0), 0);
  const leadsWithCalls = new Set(calls.data.map((c) => c.lead_id)).size;

  return {
    lastRun: latest.data
      ? {
          trigger: latest.data.trigger,
          startedAt: latest.data.started_at,
          finishedAt: latest.data.finished_at,
          errors: Array.isArray(latest.data.errors) ? latest.data.errors.length : 0,
        }
      : null,
    runs: full.length,
    p50Ms: percentile(durations, 50),
    p95Ms: percentile(durations, 95),
    leadsPerRun: scored.length ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length) : null,
    tokensPerLead: leadsWithCalls ? Math.round(tokens / leadsWithCalls) : null,
    errorRate: ratio(full.filter((r) => hasErrors(r.errors)).length, full.length),
    draftsBlocked: ratio(drafts.data.filter((d) => !d.passed).length, drafts.data.length),
  };
}

export async function getBoardCoverage(): Promise<BoardCoverage> {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const tracked = () => supabase.from("companies").select("id", { count: "exact", head: true }).not("icp_tier", "is", null);
  const [all, local, ...sites] = await Promise.all([
    tracked(),
    supabase.from("agent_runs").select("started_at").eq("trigger", "local").order("started_at", { ascending: false }).limit(1).maybeSingle(),
    ...BOARD_SITES.map((site) => tracked().not(`ats_checked->${site}`, "is", null)),
  ]);
  if (all.error) fail("Counting companies", all.error);
  if (local.error) fail("Reading the latest local run", local.error);
  return {
    companies: all.count ?? 0,
    sites: BOARD_SITES.map((site, i) => {
      const result = sites[i];
      if (result.error) fail(`Counting ${site} checks`, result.error);
      return { site, checked: result.count ?? 0 };
    }),
    lastLocalRun: local.data?.started_at ?? null,
  };
}

/** The newest audit entries, filtered by who acted and by action group ("lead", "email", ...). */
export async function listAuditLog(filter: AuditFilter = {}): Promise<AuditRow[]> {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("audit_log")
    .select("id, created_at, actor_type, action, entity_type, entity_id, detail, actor:profiles(full_name)")
    .order("created_at", { ascending: false })
    .limit(AUDIT_ROWS);
  if (filter.actorType) query = query.eq("actor_type", filter.actorType);
  if (filter.actionGroup) query = query.like("action", `${filter.actionGroup}.%`);
  const { data, error } = await query;
  if (error) fail("Reading the audit log", error);
  return data.map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    actorType: row.actor_type,
    actorName: row.actor?.full_name ?? null,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    detail: row.detail && typeof row.detail === "object" && !Array.isArray(row.detail) ? row.detail : {},
  }));
}

/** The action groups that exist, for the audit log's filter ("agent", "email", "lead", ...). */
export async function auditActionGroups(): Promise<string[]> {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("audit_log").select("action").order("created_at", { ascending: false }).limit(2000);
  if (error) fail("Reading audit actions", error);
  return [...new Set(data.map((r) => r.action.split(".")[0]))].sort();
}
