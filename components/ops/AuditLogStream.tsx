"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pill, type PillTone } from "@/components/ui/Pill";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { cn } from "@/components/ui/utils";
import type { AuditFilter, AuditRow } from "@/lib/types";

export interface AuditLogStreamProps
  extends React.HTMLAttributes<HTMLDivElement> {
  rows: AuditRow[];
  groups: string[];
  filter?: AuditFilter;
}

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

export function actorTone(actorType: "agent" | "user"): PillTone {
  return actorType === "agent" ? "accent" : "neutral";
}

export function actorLabel(actorType: "agent" | "user"): string {
  return actorType === "agent" ? "Agent" : "User";
}

export function AuditLogStream({
  rows,
  groups,
  filter,
  className,
  ...props
}: AuditLogStreamProps) {
  const router = useRouter();

  const currentActor = filter?.actorType ?? "";
  const currentGroup = filter?.actionGroup ?? "";

  const handleActorChange = (newActor: string) => {
    const params = new URLSearchParams();
    if (newActor && newActor !== "all") {
      params.set("actor", newActor);
    }
    if (filter?.actionGroup && filter.actionGroup !== "all") {
      params.set("group", filter.actionGroup);
    }
    const query = params.toString();
    router.push(query ? `?${query}` : "/ops");
  };

  const handleGroupChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newGroup = e.target.value;
    const params = new URLSearchParams();
    if (filter?.actorType) {
      params.set("actor", filter.actorType);
    }
    if (newGroup && newGroup !== "all") {
      params.set("group", newGroup);
    }
    const query = params.toString();
    router.push(query ? `?${query}` : "/ops");
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-panel border border-border bg-surface p-4",
        className
      )}
      {...props}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-border/60">
        <div className="flex items-center gap-2">
          <span className="text-label uppercase tracking-wider font-semibold text-muted">
            Audit log
          </span>
          <span className="text-meta text-muted font-mono">
            {rows.length} {rows.length === 1 ? "event" : "events"}
          </span>
        </div>

        {/* Filter controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Actor filter */}
          <SegmentedControl
            size="sm"
            options={[
              { value: "", label: "All" },
              { value: "agent", label: "Agent" },
              { value: "user", label: "User" },
            ]}
            value={currentActor}
            onChange={handleActorChange}
            ariaLabel="Filter by actor"
          />

          {/* Group filter */}
          <select
            value={currentGroup}
            onChange={handleGroupChange}
            aria-label="Filter by action group"
            className="h-8 rounded-control border border-border bg-surface px-2.5 text-meta text-text font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
          >
            <option value="">All groups</option>
            {groups.map((group) => (
              <option key={group} value={group}>
                {group}
              </option>
            ))}
          </select>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-meta text-muted py-8 text-center">
          No audit log events found.
        </p>
      ) : (
        <div className="flex flex-col divide-y divide-border/40">
          {rows.map((row) => (
            <div
              key={row.id}
              className="flex items-start justify-between flex-wrap gap-2 py-2.5 text-meta"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone={actorTone(row.actorType)}>
                  {actorLabel(row.actorType)}
                </Pill>
                {row.actorName && (
                  <span className="text-muted font-medium">{row.actorName}</span>
                )}
                <span className="font-mono text-text font-medium">
                  {row.action}
                </span>
                {row.entityType && (
                  <span className="text-subtle">
                    ({row.entityType}
                    {row.entityId ? `: ${row.entityId.slice(0, 8)}` : ""})
                  </span>
                )}
              </div>

              <span className="font-mono text-muted text-meta shrink-0">
                {formatTimestamp(row.createdAt)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
