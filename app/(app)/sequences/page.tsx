import { Send } from "lucide-react";
import Link from "next/link";
import {
  EmptyState,
  Pill,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
} from "@/components/ui";
import { formatTimestamp, sequenceStatusTone } from "@/components/sequences";
import { listSequences } from "@/lib/data/sequences";

export default async function SequencesPage() {
  const sequences = await listSequences();

  if (sequences.length === 0) {
    return (
      <div className="py-12 max-w-2xl mx-auto">
        <EmptyState
          icon={Send}
          title="No active sequences"
          body="Approve a lead in the Queue and its email sequence starts here, with every step, branch and send."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-panel border border-border bg-surface overflow-hidden">
        <Table>
          <TableHeader>
            <tr>
              <TableHead>Company</TableHead>
              <TableHead>Assignee</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Current step</TableHead>
              <TableHead>Next step</TableHead>
              <TableHead>Last event</TableHead>
            </tr>
          </TableHeader>
          <TableBody>
            {sequences.map((seq) => {
              const leadQueueHref = `/queue?lead=${seq.leadId}`;

              return (
                <TableRow key={seq.sequenceId} href={leadQueueHref}>
                  {/* Company */}
                  <TableCell className="font-medium text-text">
                    <div className="flex items-baseline gap-1.5">
                      <Link
                        href={leadQueueHref}
                        className="font-semibold text-text hover:underline truncate max-w-[200px]"
                      >
                        {seq.company.name}
                      </Link>
                      <span className="font-mono text-label text-muted truncate max-w-[150px]">
                        {seq.company.domain}
                      </span>
                    </div>
                  </TableCell>

                  {/* Assignee */}
                  <TableCell className="text-muted">
                    {seq.assignee?.name ?? (
                      <span className="text-subtle">Unassigned</span>
                    )}
                  </TableCell>

                  {/* Status */}
                  <TableCell>
                    <Pill tone={sequenceStatusTone(seq.status)}>
                      {seq.status}
                    </Pill>
                  </TableCell>

                  {/* Current step */}
                  <TableCell className="text-text">
                    {seq.currentStep ?? (
                      <span className="text-subtle">None</span>
                    )}
                  </TableCell>

                  {/* Next step */}
                  <TableCell className="text-muted">
                    {seq.nextStep ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-text">{seq.nextStep.label}</span>
                        <span className="font-mono text-subtle text-meta">
                          ({formatTimestamp(seq.nextStep.scheduledFor)})
                        </span>
                      </div>
                    ) : (
                      <span className="text-subtle">None</span>
                    )}
                  </TableCell>

                  {/* Last event */}
                  <TableCell className="text-muted">
                    {seq.lastEvent ? (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-text capitalize">
                          {seq.lastEvent.type}
                        </span>
                        <span className="font-mono text-subtle text-meta">
                          {formatTimestamp(seq.lastEvent.at)}
                        </span>
                        {seq.lastEvent.source === "simulated" && (
                          <Tag active={false}>Simulated</Tag>
                        )}
                      </div>
                    ) : (
                      <span className="text-subtle">None</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
