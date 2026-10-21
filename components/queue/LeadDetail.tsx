import * as React from "react";
import { ExternalLink } from "lucide-react";
import {
  BuyerCheck,
  ScoreMath,
  SignalCard,
  StatusPill,
} from "@/components/leads";
import { EmailEditor } from "@/components/drafts";
import { cn } from "@/components/ui/utils";
import type { DraftWorkspace, LeadDetail as LeadDetailType } from "@/lib/types";

export interface LeadDetailProps extends React.HTMLAttributes<HTMLDivElement> {
  lead: LeadDetailType;
  /** The request time from the page, for relative ages. */
  now: number;
  /** Draft workspace for the email editor (ready leads). */
  workspace?: DraftWorkspace;
}

export function LeadDetail({
  lead,
  now,
  workspace,
  className,
  ...props
}: LeadDetailProps) {
  const company = lead.company;
  const contact = lead.contact;
  const isPlaceholderContact = contact?.isPlaceholder ?? false;
  const contactDisplayName = contact
    ? isPlaceholderContact
      ? "Founder (placeholder)"
      : contact.name
    : "No contact";

  return (
    <div
      className={cn("p-6 flex flex-col gap-6 max-w-4xl mx-auto", className)}
      {...props}
    >
      {/* Header */}
      <div className="flex flex-col gap-2 pb-4 border-b border-border">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex flex-col gap-1">
            <span className="text-label uppercase tracking-wider font-semibold text-muted">
              Lead
            </span>
            <div className="flex items-baseline gap-2 flex-wrap">
              <h2 className="text-section font-semibold text-text">
                {company.name}
              </h2>
              <a
                href={`https://${company.domain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-mono text-meta text-muted hover:text-text transition-colors"
                title={`Visit ${company.domain}`}
              >
                <span>{company.domain}</span>
                <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
              </a>
            </div>
          </div>
          <StatusPill status={lead.status} />
        </div>

        {/* Company meta facts */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-meta text-muted">
          {contactDisplayName && (
            <span className="text-text font-medium">{contactDisplayName}</span>
          )}
          {contact?.title && !isPlaceholderContact && (
            <>
              <span className="text-subtle select-none">·</span>
              <span>{contact.title}</span>
            </>
          )}
          {company.teamSize !== null && (
            <>
              <span className="text-subtle select-none">·</span>
              <span>
                <span className="font-mono font-medium text-text tabular-nums">
                  {company.teamSize}
                </span>{" "}
                people
              </span>
            </>
          )}
          {company.ycBatch && (
            <>
              <span className="text-subtle select-none">·</span>
              <span>YC {company.ycBatch}</span>
            </>
          )}
          {company.industries.length > 0 && (
            <>
              <span className="text-subtle select-none">·</span>
              <span>{company.industries.join(", ")}</span>
            </>
          )}
        </div>

        {company.description && (
          <p className="text-body text-muted mt-1 leading-relaxed">
            {company.description}
          </p>
        )}
      </div>

      {/* Filtered reason (when lead is filtered) */}
      {(lead.status === "filtered" || lead.filteredReason) && (
        <div className="rounded-panel border border-warn/30 bg-warn/10 p-3.5 flex flex-col gap-1 text-warn">
          <span className="text-label uppercase tracking-wider font-semibold text-warn">
            Filtered reason
          </span>
          <p className="text-body text-warn/90">
            {lead.filteredReason ?? "Did not meet qualification threshold."}
          </p>
        </div>
      )}

      {/* Score math section */}
      <div className="flex flex-col gap-2 rounded-panel border border-border bg-surface p-4">
        <span className="text-label uppercase tracking-wider font-semibold text-muted">
          Lead score breakdown
        </span>
        <ScoreMath
          parts={lead.scoreParts}
          score={lead.score}
          band={lead.band}
          tier={lead.tier}
        />
      </div>

      {/* Buyer check and contact inbox */}
      <div className="flex flex-col gap-3 rounded-panel border border-border bg-surface p-4">
        <span className="text-label uppercase tracking-wider font-semibold text-muted">
          Contact and buyer check
        </span>
        <BuyerCheck contact={contact} />
        {contact && (
          <div className="flex flex-wrap items-baseline gap-2 pt-2 border-t border-border/60 text-meta">
            <span className="text-muted">Send address:</span>
            <span className="font-mono text-text bg-surface-2 px-2 py-0.5 rounded-control border border-border">
              {contact.sendAddress}
            </span>
            {isPlaceholderContact && (
              <span className="text-subtle italic">
                (a test inbox: we never email real people)
              </span>
            )}
          </div>
        )}
      </div>

      {/* ICP evaluation reasons */}
      {company.icpReasons.length > 0 && (
        <div className="flex flex-col gap-2 rounded-panel border border-border bg-surface p-4">
          <span className="text-label uppercase tracking-wider font-semibold text-muted">
            ICP criteria {company.icpTier ? `(${company.icpTier} match)` : ""}
          </span>
          <ul className="flex flex-wrap gap-2 list-none p-0 m-0" role="list">
            {company.icpReasons.map((reason, idx) => (
              <li
                key={idx}
                className="inline-flex items-center rounded-control bg-surface-2 px-2.5 py-1 text-meta text-muted border border-border"
              >
                {reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Buying signals */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-label uppercase tracking-wider font-semibold text-muted">
            Buying signals ({lead.signals.length} detected)
          </span>
        </div>
        {lead.signals.length === 0 ? (
          <div className="rounded-panel border border-dashed border-border p-6 text-center text-muted">
            <p className="text-body font-medium text-text">No buying signals</p>
            <p className="text-meta text-subtle mt-1">
              The agent has not detected hiring, launch, or funding signals for this company yet.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {lead.signals.map((signal, idx) => (
              <SignalCard
                key={signal.id}
                signal={signal}
                number={idx + 1}
                now={now}
              />
            ))}
          </div>
        )}
      </div>

      {/* Email editor (for ready leads) */}
      {lead.status === "ready" && workspace && (
        <EmailEditor lead={lead} workspace={workspace} />
      )}
    </div>
  );
}
