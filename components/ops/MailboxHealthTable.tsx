import * as React from "react";
import { Pill, type PillTone } from "@/components/ui/Pill";
import { cn } from "@/components/ui/utils";
import type { MailboxHealth, MailboxStatus } from "@/lib/types";
import { ResumeMailboxButton } from "./ResumeMailboxButton";

export interface MailboxHealthTableProps
  extends React.HTMLAttributes<HTMLDivElement> {
  mailboxes: MailboxHealth[];
}

export function mailboxStatusLabel(status: MailboxStatus): string {
  switch (status) {
    case "healthy":
      return "Healthy";
    case "near_cap":
      return "Near cap";
    case "paused":
      return "Paused";
    case "held":
      return "Held";
    default:
      return status;
  }
}

export function mailboxStatusTone(status: MailboxStatus): PillTone {
  switch (status) {
    case "healthy":
      return "good";
    case "near_cap":
      return "warn";
    case "paused":
      return "bad";
    case "held":
    default:
      return "neutral";
  }
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "No data yet";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toISOString().slice(0, 10);
}

export function MailboxHealthTable({
  mailboxes,
  className,
  ...props
}: MailboxHealthTableProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-panel border border-border bg-surface p-4",
        className
      )}
      {...props}
    >
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-border/60">
        <span className="text-label uppercase tracking-wider font-semibold text-muted">
          Mailbox health
        </span>
      </div>

      {mailboxes.length === 0 ? (
        <p className="text-meta text-muted py-4 text-center">No mailboxes yet.</p>
      ) : (
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse text-meta">
            <thead>
              <tr className="border-b border-border text-label uppercase tracking-wider text-muted font-semibold">
                <th className="py-2.5 pr-4">Mailbox</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4">Sends today</th>
                <th className="py-2.5 px-4">Bounce rate</th>
                <th className="py-2.5 px-4">Complaint rate</th>
                <th className="py-2.5 px-4">DNS auth</th>
                <th className="py-2.5 pl-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {mailboxes.map((box) => {
                const isPaused = box.status === "paused";
                const sentPct = Math.min(
                  100,
                  Math.round((box.sentToday / Math.max(1, box.dailyCap)) * 100)
                );

                return (
                  <tr key={box.id} className="align-top">
                    {/* Mailbox Label & Provider */}
                    <td className="py-3 pr-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-mono text-body font-medium text-text">
                          {box.label}
                        </span>
                        <span className="text-label text-muted uppercase tracking-wider">
                          {box.sendVia}
                        </span>
                      </div>
                    </td>

                    {/* Status & Pause Reason */}
                    <td className="py-3 px-4">
                      <div className="flex flex-col gap-1 items-start">
                        <Pill tone={mailboxStatusTone(box.status)}>
                          {mailboxStatusLabel(box.status)}
                        </Pill>
                        {box.pauseReason && (
                          <span className="text-meta text-warn max-w-xs leading-snug">
                            {box.pauseReason}
                          </span>
                        )}
                        {box.ratesSince && (
                          <span className="text-meta text-muted">
                            Rates since {formatDate(box.ratesSince)}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Sends Today Meter */}
                    <td className="py-3 px-4 min-w-[140px]">
                      <div className="flex flex-col gap-1.5">
                        <span className="font-mono tabular-nums text-text font-medium">
                          {box.sentToday} of {box.dailyCap}
                        </span>
                        <div
                          role="progressbar"
                          aria-label={`${box.label} daily send capacity`}
                          aria-valuenow={box.sentToday}
                          aria-valuemin={0}
                          aria-valuemax={box.dailyCap}
                          className="h-1.5 w-full rounded-full bg-surface-2 overflow-hidden border border-border/40"
                        >
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-300",
                              box.status === "near_cap"
                                ? "bg-warn"
                                : box.status === "paused"
                                ? "bg-bad"
                                : "bg-accent"
                            )}
                            style={{ width: `${sentPct}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Bounce Rate */}
                    <td className="py-3 px-4 font-mono tabular-nums text-text">
                      {box.bounceRate !== null ? `${box.bounceRate}%` : "No data yet"}
                    </td>

                    {/* Complaint Rate */}
                    <td className="py-3 px-4 font-mono tabular-nums text-text">
                      {box.complaintRate !== null
                        ? `${box.complaintRate}%`
                        : "No data yet"}
                    </td>

                    {/* DNS Auth (SPF, DMARC, DKIM) */}
                    <td className="py-3 px-4">
                      {box.auth ? (
                        <div className="flex flex-wrap items-center gap-1.5 text-meta">
                          <span
                            className={cn(
                              "px-1.5 py-0.5 rounded-control text-label font-mono font-medium",
                              box.auth.spf
                                ? "bg-good/15 text-good"
                                : "bg-bad/15 text-bad"
                            )}
                          >
                            SPF {box.auth.spf ? "found" : "missing"}
                          </span>
                          <span
                            className={cn(
                              "px-1.5 py-0.5 rounded-control text-label font-mono font-medium",
                              box.auth.dmarc
                                ? "bg-good/15 text-good"
                                : "bg-bad/15 text-bad"
                            )}
                          >
                            DMARC {box.auth.dmarc ? "found" : "missing"}
                          </span>
                          <span className="px-1.5 py-0.5 rounded-control text-label font-mono font-medium bg-surface-2 text-muted">
                            DKIM {box.auth.dkim || "not checked"}
                          </span>
                        </div>
                      ) : (
                        <span className="text-meta text-muted">No data yet</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3 pl-4 text-right">
                      {isPaused && (
                        <div className="flex flex-col items-end gap-1">
                          <ResumeMailboxButton mailboxId={box.id} />
                          <span className="text-label text-muted max-w-[160px] text-right leading-tight">
                            Its bounce and complaint rates restart from now.
                          </span>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
