import * as React from "react";
import { Cpu } from "lucide-react";
import { cn } from "@/components/ui/utils";
import type { LlmBudget } from "@/lib/types";

export interface LlmBudgetTileProps extends React.HTMLAttributes<HTMLDivElement> {
  budget: LlmBudget;
}

export function LlmBudgetTile({ budget, className, ...props }: LlmBudgetTileProps) {
  const appLimit = Math.max(0, budget.limit - budget.agentLimit);
  const pct = Math.min(100, Math.round((budget.used / Math.max(1, budget.limit)) * 100));
  const isAtLimit = budget.used >= budget.limit;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-panel border border-border bg-surface p-4",
        isAtLimit && "border-warn/40",
        className
      )}
      {...props}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-label uppercase tracking-wider font-semibold text-muted">
          AI budget
        </span>
        <Cpu className="h-4 w-4 text-muted" aria-hidden="true" />
      </div>

      <div className="flex flex-col gap-1">
        <div className="text-body font-semibold text-text">
          AI calls today:{" "}
          <span className="font-mono tabular-nums">
            {budget.used} of {budget.limit}
          </span>
        </div>
        <div className="text-meta text-muted font-mono">
          agent up to {budget.agentLimit}, app {appLimit}
        </div>
      </div>

      {/* Thin meter */}
      <div
        role="progressbar"
        aria-valuenow={budget.used}
        aria-valuemin={0}
        aria-valuemax={budget.limit}
        aria-label="AI calls used today"
        className="h-1.5 w-full rounded-full bg-surface-2 overflow-hidden border border-border/40"
      >
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300",
            isAtLimit ? "bg-warn" : "bg-accent"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>

      {isAtLimit && (
        <p className="text-label text-warn font-medium leading-tight">
          Used up for today. Resets at 00:00 UTC.
        </p>
      )}
    </div>
  );
}
