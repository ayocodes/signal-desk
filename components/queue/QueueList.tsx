"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  AlertCircle,
  ChevronDown,
  Filter,
  Inbox,
  MessageSquare,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ScoreBadge } from "@/components/ui/ScoreBadge";
import { Tabs, type TabItem } from "@/components/ui/Tabs";
import { Tag } from "@/components/ui/Tag";
import { cn } from "@/components/ui/utils";
import { formatSignalAge, signalLabel } from "@/components/leads/SignalCard";
import {
  isTypingInInput,
  setSelectedLeadContext,
} from "@/components/queue/lead-context";
import type {
  FilteredLead,
  LeadCounts,
  LeadListItem,
  QueueTab,
  SignalType,
} from "@/lib/types";

export interface QueueListProps {
  leads: LeadListItem[];
  counts: LeadCounts;
  filtered: { items: FilteredLead[]; total: number };
  currentTab: QueueTab;
  currentSignals: SignalType[];
  selectedLeadId?: string;
  /** The request time from the page, for relative ages. */
  now: number;
  className?: string;
}

const TAB_CONFIG: { id: QueueTab; label: string }[] = [
  { id: "ready", label: "Ready" },
  { id: "enrolled", label: "Enrolled" },
  { id: "bounced", label: "Bounced" },
  { id: "replied", label: "Replied" },
];

const SIGNAL_OPTIONS: { id: SignalType; label: string }[] = [
  { id: "hiring", label: "Hiring" },
  { id: "launch", label: "Launch" },
  { id: "funding", label: "YC recent" },
];

export function QueueList({
  leads,
  counts,
  filtered,
  currentTab,
  currentSignals,
  selectedLeadId,
  now,
  className,
}: QueueListProps) {
  const router = useRouter();
  const pathname = usePathname();

  const navigate = React.useCallback(
    (tab: QueueTab, signals: SignalType[], leadId?: string | null) => {
      const params = new URLSearchParams();
      if (tab !== "ready") {
        params.set("tab", tab);
      }
      if (signals.length > 0) {
        params.set("signals", signals.join(","));
      }
      if (leadId) {
        params.set("lead", leadId);
      }
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router]
  );

  // Sync selected lead to global context for CommandPalette actions
  React.useEffect(() => {
    const selectedIndex = leads.findIndex((l) => l.id === selectedLeadId);
    const currentLead = selectedIndex >= 0 ? leads[selectedIndex] : null;
    const nextLead =
      selectedIndex >= 0 && selectedIndex < leads.length - 1
        ? leads[selectedIndex + 1]
        : null;

    if (currentLead) {
      const params = new URLSearchParams();
      if (currentTab !== "ready") params.set("tab", currentTab);
      if (currentSignals.length > 0) params.set("signals", currentSignals.join(","));
      if (nextLead) params.set("lead", nextLead.id);
      const qs = params.toString();

      setSelectedLeadContext({
        id: currentLead.id,
        domain: currentLead.company.domain,
        companyName: currentLead.company.name,
        nextLeadId: nextLead?.id,
        nextLeadHref: nextLead ? `${pathname}?${qs}` : undefined,
      });
    } else {
      setSelectedLeadContext(null);
    }

    return () => {
      setSelectedLeadContext(null);
    };
  }, [leads, selectedLeadId, currentTab, currentSignals, pathname]);

  // J / K or arrow keys move the selection (ignored while typing in an input)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTypingInInput(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "j" || e.key === "J" || e.key === "ArrowDown") {
        if (leads.length === 0) return;
        e.preventDefault();
        const currentIndex = leads.findIndex((l) => l.id === selectedLeadId);
        if (currentIndex === -1) {
          navigate(currentTab, currentSignals, leads[0].id);
        } else if (currentIndex < leads.length - 1) {
          navigate(currentTab, currentSignals, leads[currentIndex + 1].id);
        }
      } else if (e.key === "k" || e.key === "K" || e.key === "ArrowUp") {
        if (leads.length === 0) return;
        e.preventDefault();
        const currentIndex = leads.findIndex((l) => l.id === selectedLeadId);
        if (currentIndex === -1) {
          navigate(currentTab, currentSignals, leads[0].id);
        } else if (currentIndex > 0) {
          navigate(currentTab, currentSignals, leads[currentIndex - 1].id);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [leads, selectedLeadId, currentTab, currentSignals, navigate]);

  // The list scrolls inside its own column: keep the selected row visible as it moves.
  React.useEffect(() => {
    if (!selectedLeadId) return;
    document
      .querySelector(`[data-lead-id="${CSS.escape(selectedLeadId)}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [selectedLeadId]);

  const tabItems: TabItem[] = TAB_CONFIG.map((t) => ({
    id: t.id,
    label: t.label,
    count: counts[t.id] ?? 0,
  }));

  const handleTabChange = (newTabId: string) => {
    navigate(newTabId as QueueTab, currentSignals, null);
  };

  const handleToggleSignal = (sig: SignalType) => {
    const isSelected = currentSignals.includes(sig);
    const nextSignals = isSelected
      ? currentSignals.filter((s) => s !== sig)
      : [...currentSignals, sig];
    navigate(currentTab, nextSignals, selectedLeadId);
  };

  const handleClearSignals = () => {
    navigate(currentTab, [], selectedLeadId);
  };

  const handleSelectLead = (leadId: string) => {
    navigate(currentTab, currentSignals, leadId);
  };

  const isAllSignalsActive = currentSignals.length === 0;

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Tabs */}
      <div className="p-3 border-b border-border bg-surface">
        <Tabs
          items={tabItems}
          value={currentTab}
          onChange={handleTabChange}
          ariaLabel="Queue status tabs"
          className="w-full flex-wrap"
        />
      </div>

      {/* Signal filter chips */}
      <div className="px-3 py-2 border-b border-border bg-surface-2/40 flex flex-wrap items-center gap-1.5">
        <Tag
          active={isAllSignalsActive}
          interactive
          onClick={handleClearSignals}
          className="text-label"
        >
          All signals
        </Tag>
        {SIGNAL_OPTIONS.map((opt) => {
          const isActive = currentSignals.includes(opt.id);
          return (
            <Tag
              key={opt.id}
              active={isActive}
              interactive
              onClick={() => handleToggleSignal(opt.id)}
              className="text-label"
            >
              {opt.label}
            </Tag>
          );
        })}
      </div>

      {/* List items */}
      <div className="flex-1 overflow-y-auto">
        {leads.length === 0 ? (
          <div className="p-6">
            {currentSignals.length > 0 ? (
              <EmptyState
                icon={Filter}
                title="No matching leads"
                body={`No leads in the ${currentTab} queue match the active signal filters.`}
                action={
                  <Button variant="secondary" size="sm" onClick={handleClearSignals}>
                    Show all signals
                  </Button>
                }
              />
            ) : currentTab === "ready" ? (
              <EmptyState
                icon={Inbox}
                title="No leads ready for review"
                body="New leads appear here as the agent discovers companies and detects buying signals. Once scored and grounded, you can review and enroll them."
              />
            ) : currentTab === "enrolled" ? (
              <EmptyState
                icon={Send}
                title="No enrolled leads"
                body="Leads appear here after you approve and enroll them from the Ready queue. Multi-step sequences will begin sending emails according to their schedule."
              />
            ) : currentTab === "bounced" ? (
              <EmptyState
                icon={AlertCircle}
                title="No bounced emails"
                body="Leads with email delivery failures appear here. You can correct the recipient address and approve a retry to recover the sequence."
              />
            ) : (
              <EmptyState
                icon={MessageSquare}
                title="No replies yet"
                body="When a prospect replies to an outreach email, the sequence halts automatically and the lead appears here for follow-up."
              />
            )}
          </div>
        ) : (
          <ul className="divide-y divide-border/60" role="list">
            {leads.map((lead) => {
              const isSelected = lead.id === selectedLeadId;
              const topSig = lead.topSignal;
              const extraSignals = lead.signalTypes.length - 1;

              return (
                <li key={lead.id}>
                  <button
                    type="button"
                    data-lead-id={lead.id}
                    onClick={() => handleSelectLead(lead.id)}
                    aria-current={isSelected ? "true" : undefined}
                    className={cn(
                      "w-full text-left p-3 transition-colors flex items-start gap-3 select-none",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset",
                      isSelected
                        ? "bg-accent-soft border-l-2 border-accent"
                        : "hover:bg-surface-2/60 border-l-2 border-transparent"
                    )}
                  >
                    {/* Score badge & band */}
                    <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5 min-w-8">
                      <ScoreBadge score={lead.score} tier={lead.tier} size="sm" />
                      <span className="text-label font-mono uppercase tracking-wider text-muted font-medium">
                        {lead.band}
                      </span>
                    </div>

                    {/* Lead info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-medium text-body text-text truncate">
                          {lead.company.name}
                        </span>
                        {topSig && (
                          <span className="text-meta font-mono text-muted shrink-0">
                            {formatSignalAge(topSig.occurredAt, now)}
                          </span>
                        )}
                      </div>

                      {/* Contact */}
                      <p className="text-meta text-muted truncate">
                        {lead.contact
                          ? `${lead.contact.name}${lead.contact.title ? ` · ${lead.contact.title}` : ""}`
                          : lead.company.domain}
                      </p>

                      {/* Top signal */}
                      {topSig && (
                        <div className="mt-1 flex items-center gap-1.5 text-meta text-muted">
                          <Tag
                            active={false}
                            className="text-label py-0 px-1 font-mono uppercase tracking-wider shrink-0"
                          >
                            {signalLabel(topSig)}
                          </Tag>
                          <span className="truncate text-text">{topSig.title}</span>
                          {extraSignals > 0 && (
                            <span className="text-label font-mono text-subtle font-semibold shrink-0">
                              +{extraSignals}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {/* Collapsed filtered section */}
        {filtered.total > 0 && (
          <details className="group border-t border-border mt-2 p-3">
            <summary className="flex items-center justify-between py-1.5 text-meta text-muted hover:text-text cursor-pointer select-none font-medium">
              <span>{filtered.total} filtered out by the agent</span>
              <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180 text-subtle" />
            </summary>
            <div className="mt-2 flex flex-col gap-1.5 max-h-80 overflow-y-auto pr-1">
              {filtered.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-2 p-1.5 rounded-control text-meta hover:bg-surface-2 transition-colors"
                >
                  <ScoreBadge score={item.score} tier="lo" size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-medium text-text truncate">
                        {item.companyName}
                      </span>
                      <span className="font-mono text-label text-muted truncate">
                        {item.domain}
                      </span>
                    </div>
                    {item.reason && (
                      <p className="text-subtle text-label truncate">
                        {item.reason}
                      </p>
                    )}
                  </div>
                </div>
              ))}
              {filtered.total > filtered.items.length && (
                <p className="text-label text-subtle italic py-1 px-1.5">
                  and {filtered.total - filtered.items.length} more with lower scores
                </p>
              )}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
