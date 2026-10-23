import * as React from "react";
import { cn } from "@/components/ui/utils";
import type { BoardCoverage, EngineStats } from "@/lib/types";
import { formatRatio } from "./KpiStrip";

export interface EnginePanelProps extends React.HTMLAttributes<HTMLDivElement> {
  stats: EngineStats;
  coverage?: BoardCoverage;
  now?: number;
}

const SITE_LABELS: Record<string, string> = {
  greenhouse: "Greenhouse",
  lever: "Lever",
  ashby: "Ashby",
};

function formatDurationMs(ms: number | null): string {
  if (ms === null) return "No data yet";
  return `${(ms / 1000).toFixed(1)} s`;
}

export function formatTimeAgo(
  iso: string | null | undefined,
  now = Date.now()
): string {
  if (!iso) return "never";
  const diffMs = now - new Date(iso).getTime();
  if (isNaN(diffMs)) return iso;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} ${mins === 1 ? "minute" : "minutes"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}

export function EnginePanel({
  stats,
  coverage,
  now,
  className,
  ...props
}: EnginePanelProps) {
  const lastRunText = stats.lastRun
    ? `${stats.lastRun.trigger.charAt(0).toUpperCase() + stats.lastRun.trigger.slice(1)}, ${
        stats.lastRun.errors === 0
          ? "0 errors"
          : `${stats.lastRun.errors} ${stats.lastRun.errors === 1 ? "error" : "errors"}`
      }, ${formatTimeAgo(stats.lastRun.startedAt, now)}`
    : "No data yet";

  return (
    <div
      className={cn(
        "flex flex-col gap-5 rounded-panel border border-border bg-surface p-4",
        className
      )}
      {...props}
    >
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-border/60">
        <span className="text-label uppercase tracking-wider font-semibold text-muted">
          Engine stats
        </span>
        <span className="text-meta text-muted font-mono">
          {stats.runs} {stats.runs === 1 ? "run" : "runs"} measured
        </span>
      </div>

      {/* Grid of Engine metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Last Run */}
        <div className="flex flex-col gap-1 p-2.5 rounded-control bg-surface-2/40 border border-border/50">
          <span className="text-label uppercase tracking-wider text-muted font-semibold">
            Last run
          </span>
          <span className="font-mono text-body font-medium text-text tabular-nums truncate">
            {lastRunText}
          </span>
        </div>

        {/* p50 Duration */}
        <div className="flex flex-col gap-1 p-2.5 rounded-control bg-surface-2/40 border border-border/50">
          <span className="text-label uppercase tracking-wider text-muted font-semibold">
            p50 duration
          </span>
          <span className="font-mono text-body font-medium text-text tabular-nums">
            {formatDurationMs(stats.p50Ms)}
          </span>
        </div>

        {/* p95 Duration */}
        <div className="flex flex-col gap-1 p-2.5 rounded-control bg-surface-2/40 border border-border/50">
          <span className="text-label uppercase tracking-wider text-muted font-semibold">
            p95 duration
          </span>
          <span className="font-mono text-body font-medium text-text tabular-nums">
            {formatDurationMs(stats.p95Ms)}
          </span>
        </div>

        {/* Leads per run */}
        <div className="flex flex-col gap-1 p-2.5 rounded-control bg-surface-2/40 border border-border/50">
          <span className="text-label uppercase tracking-wider text-muted font-semibold">
            Leads per run
          </span>
          <span className="font-mono text-body font-medium text-text tabular-nums">
            {stats.leadsPerRun !== null ? stats.leadsPerRun : "No data yet"}
          </span>
        </div>

        {/* Tokens per lead */}
        <div className="flex flex-col gap-1 p-2.5 rounded-control bg-surface-2/40 border border-border/50">
          <span className="text-label uppercase tracking-wider text-muted font-semibold">
            Tokens per lead
          </span>
          <span className="font-mono text-body font-medium text-text tabular-nums">
            {stats.tokensPerLead !== null ? stats.tokensPerLead : "No data yet"}
          </span>
        </div>

        {/* Error rate */}
        <div className="flex flex-col gap-1 p-2.5 rounded-control bg-surface-2/40 border border-border/50">
          <span className="text-label uppercase tracking-wider text-muted font-semibold">
            Error rate
          </span>
          <span className="font-mono text-body font-medium text-text tabular-nums">
            {formatRatio(stats.errorRate)}
          </span>
        </div>
      </div>

      {/* Additional metric row: Drafts blocked */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-meta border-t border-border/40 pt-2">
        <span className="text-muted">Drafts blocked by guardrails:</span>
        <span className="font-mono font-medium text-text tabular-nums">
          {formatRatio(stats.draftsBlocked)}
        </span>
      </div>

      {/* Job board coverage section */}
      {coverage && (
        <div className="flex flex-col gap-2.5 pt-3 border-t border-border/60">
          <div className="flex items-center justify-between gap-2">
            <span className="text-label uppercase tracking-wider font-semibold text-muted">
              Job board coverage
            </span>
            <span className="text-meta text-muted font-mono">
              {coverage.companies.toLocaleString()}{" "}
              {coverage.companies === 1 ? "company" : "companies"} tracked
            </span>
          </div>

          <ul className="flex flex-col gap-1.5 list-none p-0 m-0 text-meta" role="list">
            {coverage.sites.map((site) => {
              const siteLabel = SITE_LABELS[site.site] ?? site.site;
              const isAshby = site.site === "ashby";
              const timeAgo = formatTimeAgo(coverage.lastLocalRun, now);

              return (
                <li
                  key={site.site}
                  className="flex items-center justify-between flex-wrap gap-2 py-1 border-b border-border/30 last:border-b-0"
                >
                  <span className="font-medium text-text">{siteLabel}</span>
                  <span className="font-mono text-muted tabular-nums">
                    {siteLabel} checked for {site.checked.toLocaleString()} of{" "}
                    {coverage.companies.toLocaleString()} companies
                    {isAshby && (
                      <span className="text-subtle">
                        , last local run {timeAgo}
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>

          <p className="text-meta text-subtle pt-1">
            Ashby is checked only on local runs.
          </p>
        </div>
      )}
    </div>
  );
}
