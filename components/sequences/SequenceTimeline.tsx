import * as React from "react";
import { Pill, type PillTone } from "@/components/ui/Pill";
import { Tag } from "@/components/ui/Tag";
import { cn } from "@/components/ui/utils";
import { stepLabel } from "@/lib/sequence-labels";
import type { Role } from "@/lib/auth";
import type {
  SequenceStatus,
  SequenceTimeline as SequenceTimelineType,
  StepStatus,
  TimelineStep,
} from "@/lib/types";
import { SimulateMenu } from "./SimulateMenu";

export function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toISOString().replace("T", " ").slice(0, 16) + " UTC";
  } catch {
    return iso;
  }
}

export function sequenceStatusTone(status: SequenceStatus): PillTone {
  switch (status) {
    case "active":
      return "accent";
    case "paused":
      return "warn";
    case "halted":
    case "completed":
    default:
      return "neutral";
  }
}

export function stepStatusTone(status: StepStatus): PillTone {
  switch (status) {
    case "done":
    case "sent":
      return "good";
    case "cancelled":
      return "bad";
    case "pending":
    case "skipped":
    default:
      return "neutral";
  }
}

function StepRow({ step, index }: { step: TimelineStep; index: number }) {
  return (
    <div className="rounded-control border border-border bg-surface-2/40 p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-label text-subtle font-semibold select-none">
            #{index + 1}
          </span>
          <span className="text-body font-medium text-text">
            {step.label}
          </span>
          {step.writtenBy && (
            <span className="text-meta text-muted inline-flex items-center gap-1">
              <span>·</span>
              <span>
                {step.writtenBy === "approved"
                  ? "Approved"
                  : step.writtenBy === "ai"
                  ? "AI"
                  : `Template${step.writtenReason ? ` (${step.writtenReason})` : ""}`}
              </span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-meta text-muted">
            {step.sentAt
              ? `Sent ${formatTimestamp(step.sentAt)}`
              : `Scheduled ${formatTimestamp(step.scheduledFor)}`}
          </span>
          <Pill tone={stepStatusTone(step.status)}>
            {step.status}
          </Pill>
        </div>
      </div>

      {/* Branch chosen and reason */}
      {step.branch && (
        <div className="text-meta text-muted flex items-center gap-1.5 flex-wrap">
          <span className="font-medium text-text">Branch:</span>
          <span className="text-text">{stepLabel(step.branch.chosen)}</span>
          {step.branch.reason && (
            <span className="text-subtle">({step.branch.reason})</span>
          )}
          {typeof step.branch.opens === "number" && (
            <span className="text-subtle">
              · {step.branch.opens} {step.branch.opens === 1 ? "open" : "opens"}
            </span>
          )}
        </div>
      )}

      {/* Mailbox and message id (admins only / when present; null for reps) */}
      {(step.mailbox || step.messageId) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-meta text-muted pt-1">
          {step.mailbox && (
            <span>
              Mailbox: <span className="font-mono text-text">{step.mailbox}</span>
            </span>
          )}
          {step.messageId && (
            <span>
              Message ID: <span className="font-mono text-text">{step.messageId}</span>
            </span>
          )}
        </div>
      )}

      {/* Sent subject and body (collapsible) */}
      {(step.subject || step.body) && (
        <details className="mt-1 rounded-control border border-border/80 bg-surface p-2.5 text-meta">
          <summary className="cursor-pointer font-medium text-text select-none">
            <span>Subject: {step.subject || "(No subject)"}</span>
          </summary>
          {step.body && (
            <div className="mt-2 text-muted whitespace-pre-wrap font-sans text-meta border-t border-border pt-2 leading-relaxed">
              {step.body}
            </div>
          )}
        </details>
      )}

      {/* Events */}
      {step.events.length > 0 && (
        <div className="flex flex-col gap-1.5 pt-2 border-t border-border/50">
          <span className="text-label uppercase tracking-wider font-semibold text-muted">
            Step events
          </span>
          <ul className="flex flex-col gap-1 list-none p-0 m-0" role="list">
            {step.events.map((evt, evtIdx) => (
              <li
                key={evtIdx}
                className="flex items-center gap-2 text-meta text-muted flex-wrap"
              >
                <span className="font-medium text-text capitalize">{evt.type}</span>
                <span className="font-mono text-subtle">{formatTimestamp(evt.at)}</span>
                {evt.source === "simulated" && (
                  <Tag active={false}>Simulated</Tag>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export interface SequenceTimelineProps
  extends React.HTMLAttributes<HTMLDivElement> {
  timeline: SequenceTimelineType;
  leadId?: string;
  viewerRole?: Role;
}

export function SequenceTimeline({
  timeline,
  leadId,
  viewerRole,
  className,
  ...props
}: SequenceTimelineProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-panel border border-border bg-surface p-4",
        className
      )}
      {...props}
    >
      <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-border/60">
        <div className="flex items-center gap-2">
          <span className="text-label uppercase tracking-wider font-semibold text-muted">
            Sequence timeline
          </span>
          {timeline.edited && (
            <span className="text-meta text-subtle">(edited)</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {viewerRole === "admin" && leadId && (
            <SimulateMenu leadId={leadId} timeline={timeline} />
          )}
          <Pill tone={sequenceStatusTone(timeline.status)}>
            {timeline.status}
          </Pill>
        </div>
      </div>

      {timeline.approvedAt && (
        <div className="text-meta text-muted">
          Approved
          {timeline.approvedBy ? ` by ${timeline.approvedBy.name}` : ""}{" "}
          at <span className="font-mono text-text">{formatTimestamp(timeline.approvedAt)}</span>
        </div>
      )}

      {timeline.steps.length === 0 ? (
        <div className="p-4 text-center text-muted text-meta">
          No steps in this sequence yet.
        </div>
      ) : (
        <div className="flex flex-col gap-3 mt-1">
          {timeline.steps.map((step, idx) => (
            <StepRow key={step.id || idx} step={step} index={idx} />
          ))}
        </div>
      )}
    </div>
  );
}
