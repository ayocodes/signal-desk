import * as React from "react";
import { ScoreBadge } from "@/components/ui/ScoreBadge";
import { cn } from "@/components/ui/utils";
import type { ScorePart, ScoreTier } from "@/lib/types";

export interface ScoreMathProps extends React.HTMLAttributes<HTMLDivElement> {
  parts: ScorePart[];
  score?: number;
  band?: string;
  tier?: ScoreTier;
}

export function ScoreMath({
  parts,
  score,
  band,
  tier,
  className,
  ...props
}: ScoreMathProps) {
  const total = score ?? parts.reduce((sum, [, points]) => sum + points, 0);

  return (
    <div
      className={cn(
        "inline-flex flex-wrap items-center gap-1.5 font-mono text-meta text-muted",
        className
      )}
      {...props}
    >
      {parts.map(([label, points], idx) => (
        <React.Fragment key={`${label}-${idx}`}>
          {idx > 0 && <span className="text-subtle select-none">+</span>}
          <span className="text-text">
            {label} <span className="font-semibold text-text tabular-nums">{points}</span>
          </span>
        </React.Fragment>
      ))}
      {parts.length > 0 && <span className="text-subtle select-none">=</span>}
      <ScoreBadge score={total} tier={tier} size="sm" />
      {band && (
        <span className="font-sans text-meta text-muted">
          · <span className="font-medium text-text">{band}</span>
        </span>
      )}
    </div>
  );
}
