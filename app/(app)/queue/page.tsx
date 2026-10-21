import { Suspense } from "react";
import { listQueue, leadCounts, listFiltered } from "@/lib/data/leads";
import { QueueList, SplitView, LiveStatus } from "@/components/queue";
import type { QueueTab, SignalType } from "@/lib/types";
import { QUEUE_TABS } from "@/lib/types";

export const dynamic = "force-dynamic";

interface QueuePageProps {
  searchParams: Promise<{
    tab?: string;
    signals?: string;
    lead?: string;
  }>;
}

export default async function QueuePage({ searchParams }: QueuePageProps) {
  const params = await searchParams;

  const currentTab: QueueTab =
    typeof params.tab === "string" && (QUEUE_TABS as readonly string[]).includes(params.tab)
      ? (params.tab as QueueTab)
      : "ready";

  const currentSignals: SignalType[] =
    typeof params.signals === "string"
      ? (params.signals
          .split(",")
          .map((s) => s.trim().toLowerCase())
          .filter((s): s is SignalType => s === "hiring" || s === "launch" || s === "funding"))
      : [];

  const selectedLeadId = typeof params.lead === "string" ? params.lead : undefined;

  const [leads, counts, filtered] = await Promise.all([
    listQueue({ tab: currentTab, signalTypes: currentSignals }),
    leadCounts(),
    listFiltered({ limit: 50 }),
  ]);

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center justify-between px-1">
        <h1 className="text-section font-semibold text-text">Queue</h1>
        <LiveStatus />
      </div>

      <Suspense fallback={<div className="p-8 text-muted text-meta">Loading queue...</div>}>
        <SplitView
          list={
            <QueueList
              leads={leads}
              counts={counts}
              filtered={filtered}
              currentTab={currentTab}
              currentSignals={currentSignals}
              selectedLeadId={selectedLeadId}
            />
          }
          detail={
            selectedLeadId ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center text-muted">
                <div className="rounded-panel border border-border bg-surface p-6 max-w-sm">
                  <p className="text-body font-medium text-text">Lead Selected</p>
                  <p className="text-meta text-subtle mt-1 font-mono truncate">{selectedLeadId}</p>
                  <p className="text-meta text-muted mt-3">
                    Full lead detail arrives in card F3.3.
                  </p>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center text-muted">
                <p className="text-body font-medium text-text">Select a lead</p>
                <p className="text-meta text-subtle mt-1">
                  Choose a lead from the queue list to inspect buying signals and score breakdown.
                </p>
              </div>
            )
          }
        />
      </Suspense>
    </div>
  );
}
