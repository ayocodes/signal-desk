import * as React from "react";
import { cn } from "./utils";

export type PillTone = "good" | "warn" | "bad" | "neutral" | "accent";

export interface PillProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: PillTone;
  dot?: boolean;
}

const toneStyles: Record<PillTone, { wrapper: string; dot: string }> = {
  good: {
    wrapper: "bg-good/15 text-good border border-good/25",
    dot: "bg-good",
  },
  warn: {
    wrapper: "bg-warn/15 text-warn border border-warn/25",
    dot: "bg-warn",
  },
  bad: {
    wrapper: "bg-bad/15 text-bad border border-bad/25",
    dot: "bg-bad",
  },
  neutral: {
    wrapper: "bg-surface-2 text-muted border border-border",
    dot: "bg-muted",
  },
  accent: {
    wrapper: "bg-accent-soft text-accent border border-accent/25",
    dot: "bg-accent",
  },
};

export function Pill({
  className,
  tone = "neutral",
  dot = true,
  children,
  ...props
}: PillProps) {
  const styles = toneStyles[tone] ?? toneStyles.neutral;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-label font-semibold uppercase tracking-wider select-none whitespace-nowrap",
        styles.wrapper,
        className
      )}
      {...props}
    >
      {dot && (
        <span
          className={cn("h-1.5 w-1.5 rounded-full shrink-0", styles.dot)}
          aria-hidden="true"
        />
      )}
      <span>{children}</span>
    </span>
  );
}
