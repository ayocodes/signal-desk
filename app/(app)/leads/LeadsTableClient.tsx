"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ScoreBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableSortHeader,
  Tag,
} from "@/components/ui";
import { StatusPill } from "@/components/leads";
import { formatSignalAge, signalLabel } from "@/components/leads/SignalCard";
import {
  isTypingInInput,
  setSelectedLeadContext,
} from "@/components/queue/lead-context";
import type { LeadsPage, LeadsSort, SortDir } from "@/lib/types";

export interface LeadsTableClientProps {
  data: LeadsPage;
  sort: LeadsSort;
  dir: SortDir;
}

export function LeadsTableClient({ data, sort, dir }: LeadsTableClientProps) {
  const router = useRouter();
  const [selectedIndex, setSelectedIndex] = React.useState<number>(0);

  const selectedLead =
    selectedIndex >= 0 && selectedIndex < data.rows.length
      ? data.rows[selectedIndex]
      : null;

  // Sync selected lead to global context for CommandPalette actions
  React.useEffect(() => {
    if (selectedLead) {
      const nextLead =
        selectedIndex < data.rows.length - 1
          ? data.rows[selectedIndex + 1]
          : null;

      setSelectedLeadContext({
        id: selectedLead.id,
        domain: selectedLead.company.domain,
        companyName: selectedLead.company.name,
        nextLeadId: nextLead?.id,
        nextLeadHref: nextLead ? `/queue?lead=${nextLead.id}` : undefined,
      });
    } else {
      setSelectedLeadContext(null);
    }

    return () => {
      setSelectedLeadContext(null);
    };
  }, [selectedLead, selectedIndex, data.rows]);

  // J / K keyboard navigation in Leads table
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTypingInInput(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "j" || e.key === "J") {
        if (data.rows.length === 0) return;
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, data.rows.length - 1));
      } else if (e.key === "k" || e.key === "K") {
        if (data.rows.length === 0) return;
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter") {
        if (selectedLead) {
          e.preventDefault();
          router.push(`/queue?lead=${selectedLead.id}`);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [data.rows, selectedLead, router]);

  return (
    <Table>
      <TableHeader>
        <tr>
          <TableSortHeader
            column="company"
            label="Company"
            currentSort={sort}
            currentDir={dir}
            basePath="/leads"
          />
          <TableHead>Contact</TableHead>
          <TableSortHeader
            column="score"
            label="Score"
            currentSort={sort}
            currentDir={dir}
            basePath="/leads"
          />
          <TableHead>Top Signal</TableHead>
          <TableSortHeader
            column="status"
            label="Status"
            currentSort={sort}
            currentDir={dir}
            basePath="/leads"
          />
          <TableHead>Assigned Rep</TableHead>
          <TableSortHeader
            column="updated"
            label="Updated"
            currentSort={sort}
            currentDir={dir}
            basePath="/leads"
          />
        </tr>
      </TableHeader>
      <TableBody>
        {data.rows.map((lead, idx) => {
          const topSig = lead.topSignal;
          const extraSignals = lead.signalTypes.length - 1;
          const leadQueueHref = `/queue?lead=${lead.id}`;
          const isSelected = idx === selectedIndex;

          return (
            <TableRow
              key={lead.id}
              href={leadQueueHref}
              selected={isSelected}
              onClick={() => setSelectedIndex(idx)}
            >
              {/* Company */}
              <TableCell className="font-medium text-text">
                <div className="flex items-baseline gap-1.5">
                  <Link
                    href={leadQueueHref}
                    className="font-semibold text-text hover:underline truncate max-w-[180px]"
                  >
                    {lead.company.name}
                  </Link>
                  <span className="font-mono text-label text-muted truncate max-w-[140px]">
                    {lead.company.domain}
                  </span>
                </div>
              </TableCell>

              {/* Contact */}
              <TableCell className="text-muted">
                {lead.contact ? (
                  <span className="truncate max-w-[180px] inline-block">
                    {lead.contact.name}
                    {lead.contact.title ? ` · ${lead.contact.title}` : ""}
                  </span>
                ) : (
                  <span className="text-subtle">None</span>
                )}
              </TableCell>

              {/* Score (with band) */}
              <TableCell>
                <div className="flex items-center gap-1.5">
                  <ScoreBadge score={lead.score} tier={lead.tier} size="sm" />
                  <span className="font-mono text-label uppercase tracking-wider text-muted font-medium">
                    {lead.band}
                  </span>
                </div>
              </TableCell>

              {/* Top signal */}
              <TableCell>
                {topSig ? (
                  <div className="flex items-center gap-1.5 text-muted max-w-[280px]">
                    <Tag
                      active={false}
                      className="text-label py-0 px-1 font-mono uppercase shrink-0"
                    >
                      {signalLabel(topSig)}
                    </Tag>
                    <span className="truncate text-text text-meta">
                      {topSig.title}
                    </span>
                    {extraSignals > 0 && (
                      <span className="font-mono text-label text-subtle font-semibold shrink-0">
                        +{extraSignals}
                      </span>
                    )}
                    <span className="text-muted font-mono text-label shrink-0">
                      · {formatSignalAge(topSig.occurredAt)}
                    </span>
                  </div>
                ) : (
                  <span className="text-subtle text-meta">No signals yet</span>
                )}
              </TableCell>

              {/* Status */}
              <TableCell>
                <StatusPill status={lead.status} />
              </TableCell>

              {/* Assigned rep */}
              <TableCell className="text-muted">
                {lead.assignee ? (
                  lead.assignee.name
                ) : (
                  <span className="text-subtle">Unassigned</span>
                )}
              </TableCell>

              {/* Updated */}
              <TableCell className="text-muted font-mono text-label tabular-nums">
                {formatSignalAge(lead.updatedAt)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
