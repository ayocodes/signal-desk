import { listQueue, leadCounts, listFiltered, getLead } from "@/lib/data/leads";
import { getDraftWorkspace } from "@/lib/data/drafts";
import { getRecoveryProposal } from "@/lib/data/sequences";
import { requestTime } from "@/lib/request-time";
import { QueueList, SplitView, LiveStatus } from "@/components/queue";
import { LeadDetail } from "@/components/queue/LeadDetail";
import type { QueueTab, SignalType } from "@/lib/types";
import { QUEUE_TABS } from "@/lib/types";

interface QueuePageProps {
  searchParams: Promise<{
    tab?: string;
    signals?: string;
    lead?: string;
  }>;
}

export default async function QueuePage({ searchParams }: QueuePageProps) {
  const params = await searchParams;
  // One clock reading for the whole page, taken at request time (see lib/request-time.ts).
  const now = await requestTime();

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

  const [leads, counts, filtered, selectedLead, workspace, recoveryProposal] = await Promise.all([
    listQueue({ tab: currentTab, signalTypes: currentSignals }),
    leadCounts(),
    listFiltered({ limit: 50 }),
    selectedLeadId ? getLead(selectedLeadId) : Promise.resolve(null),
    selectedLeadId ? getDraftWorkspace(selectedLeadId) : Promise.resolve(null),
    selectedLeadId ? getRecoveryProposal(selectedLeadId) : Promise.resolve(null),
  ]);

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* The shell's top bar already shows "Queue" as the page heading. */}
      <div className="flex items-center justify-end px-1">
        <LiveStatus />
      </div>

      <SplitView
        list={
          <QueueList
            leads={leads}
            counts={counts}
            filtered={filtered}
            currentTab={currentTab}
            currentSignals={currentSignals}
            selectedLeadId={selectedLeadId}
            now={now}
          />
        }
        detail={
          selectedLead ? (
            <LeadDetail
              lead={selectedLead}
              workspace={workspace ?? undefined}
              recoveryProposal={recoveryProposal}
              now={now}
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center text-muted min-h-[300px]">
              <p className="text-body font-medium text-text">
                {selectedLeadId ? "Lead not found" : "Select a lead"}
              </p>
              <p className="text-meta text-subtle mt-1">
                {selectedLeadId
                  ? "This lead may have been deleted or is not visible to your account."
                  : "Choose a lead from the queue list to inspect buying signals and score breakdown."}
              </p>
            </div>
          )
        }
      />
    </div>
  );
}
