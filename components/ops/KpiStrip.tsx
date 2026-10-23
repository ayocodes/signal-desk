import * as React from "react";
import { Tag } from "@/components/ui/Tag";
import { cn } from "@/components/ui/utils";
import type { OpsKpis, Ratio } from "@/lib/types";

export function formatRatio(ratio: Ratio): string {
  if (ratio.total === 0 || ratio.pct === null) {
    return "No data yet";
  }
  return `${ratio.count} of ${ratio.total}, ${ratio.pct}%`;
}

export interface KpiStripProps extends React.HTMLAttributes<HTMLDivElement> {
  kpis: OpsKpis;
}

export function KpiStrip({ kpis, className, ...props }: KpiStripProps) {
  const scoredTodayText =
    kpis.leadsScoredToday !== null
      ? String(kpis.leadsScoredToday)
      : "No data yet";

  const cards = [
    {
      label: "Scored today",
      value: scoredTodayText,
      simulated: false,
    },
    {
      label: "Enrolled",
      value: String(kpis.enrolled),
      simulated: false,
    },
    {
      label: "Edited before send",
      value: formatRatio(kpis.editedBeforeSend),
      simulated: false,
    },
    {
      label: "Bounces recovered",
      value: formatRatio(kpis.bouncesRecovered),
      simulated: false,
    },
    {
      label: "Reply rate",
      value: formatRatio(kpis.replyRate),
      simulated: kpis.replyRate.simulated,
    },
  ];

  return (
    <div
      className={cn(
        "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3",
        className
      )}
      {...props}
    >
      {cards.map((card) => (
        <div
          key={card.label}
          className="flex flex-col justify-between gap-2 rounded-panel border border-border bg-surface p-4"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-label uppercase tracking-wider font-semibold text-muted">
              {card.label}
            </span>
            {card.simulated && <Tag active={false}>Simulated</Tag>}
          </div>
          <div className="font-mono text-body sm:text-section font-semibold text-text tabular-nums">
            {card.value}
          </div>
        </div>
      ))}
    </div>
  );
}
