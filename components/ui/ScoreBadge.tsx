import * as React from "react";
import { cn } from "./utils";

export type ScoreTier = "hi" | "md" | "lo";
export type ScoreBadgeSize = "sm" | "md" | "lg";

export interface ScoreBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  score?: number | string;
  tier?: ScoreTier;
  size?: ScoreBadgeSize;
}

const tierStyles: Record<ScoreTier, string> = {
  hi: "bg-good/15 text-good border border-good/25",
  md: "bg-warn/15 text-warn border border-warn/25",
  lo: "bg-surface-2 text-muted border border-border",
};

const sizeStyles: Record<ScoreBadgeSize, string> = {
  sm: "h-6 min-w-6 px-1.5 text-meta",
  md: "h-8 min-w-8 px-2 text-body",
  lg: "h-9 min-w-9 px-2.5 text-section",
};

export function ScoreBadge({
  className,
  score,
  tier,
  size = "md",
  children,
  ...props
}: ScoreBadgeProps) {
  const resolvedTier: ScoreTier =
    tier ??
    (typeof score === "number"
      ? score >= 75
        ? "hi"
        : score >= 50
        ? "md"
        : "lo"
      : "lo");

  const content = children ?? score;

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-control font-mono font-semibold tabular-nums select-none",
        tierStyles[resolvedTier],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {content}
    </span>
  );
}
