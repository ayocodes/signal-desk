import {
  AuditLogStream,
  EnginePanel,
  KpiStrip,
  LlmBudgetTile,
  LlmPacingTile,
  MailboxHealthTable,
  ReplyRateBySignal,
} from "@/components/ops";
import { llmBudgetToday, llmPacing } from "@/lib/data/llm";
import {
  auditActionGroups,
  getBoardCoverage,
  getEngineStats,
  getKpis,
  getMailboxHealth,
  getReplyRateBySignal,
  listAuditLog,
} from "@/lib/data/ops";
import type { AuditFilter } from "@/lib/types";

interface OpsPageProps {
  searchParams?: Promise<{
    actor?: string;
    group?: string;
  }>;
}

export default async function OpsPage({ searchParams }: OpsPageProps) {
  const params = searchParams ? await searchParams : {};
  const rawActor = typeof params.actor === "string" ? params.actor : undefined;
  const actor = rawActor === "agent" || rawActor === "user" ? rawActor : undefined;

  const groupsPromise = auditActionGroups();
  const filterPromise = groupsPromise.then((groups) => {
    const rawGroup = typeof params.group === "string" ? params.group : undefined;
    const group = rawGroup && groups.includes(rawGroup) ? rawGroup : undefined;
    const filter: AuditFilter = {
      ...(actor ? { actorType: actor } : {}),
      ...(group ? { actionGroup: group } : {}),
    };
    return filter;
  });

  const [
    kpis,
    rates,
    mailboxes,
    stats,
    coverage,
    actionGroups,
    activeFilter,
    auditRows,
    budget,
    pacing,
  ] = await Promise.all([
    getKpis(),
    getReplyRateBySignal(),
    getMailboxHealth(),
    getEngineStats(),
    getBoardCoverage(),
    groupsPromise,
    filterPromise,
    filterPromise.then((filter) => listAuditLog(filter)),
    llmBudgetToday(),
    llmPacing(),
  ]);

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto py-6 px-4 w-full">
      {/* 1. KPI strip */}
      <KpiStrip kpis={kpis} />

      {/* 2. Reply rate by signal */}
      <ReplyRateBySignal rates={rates} />

      {/* 3. Mailbox health table */}
      <MailboxHealthTable mailboxes={mailboxes} />

      {/* 4. Engine section: Engine stats, board coverage, AI budget, LLM pacing */}
      <div className="flex flex-col gap-4">
        <EnginePanel stats={stats} coverage={coverage} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <LlmBudgetTile budget={budget} />
          <LlmPacingTile pacing={pacing} />
        </div>
      </div>

      {/* 5. Audit log stream */}
      <AuditLogStream
        rows={auditRows}
        groups={actionGroups}
        filter={activeFilter}
      />
    </div>
  );
}
