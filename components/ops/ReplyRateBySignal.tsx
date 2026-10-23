import * as React from "react";
import { Tag } from "@/components/ui/Tag";
import { cn } from "@/components/ui/utils";
import type { SignalReplyRate } from "@/lib/types";
import { formatRatio } from "./KpiStrip";

export interface ReplyRateBySignalProps
  extends React.HTMLAttributes<HTMLDivElement> {
  rates: SignalReplyRate[];
}

const SIGNAL_LABELS: Record<string, string> = {
  hiring: "Hiring",
  launch: "Launch",
  funding: "Funding",
};

export function ReplyRateBySignal({
  rates,
  className,
  ...props
}: ReplyRateBySignalProps) {
  const hasSimulated = rates.some((r) => r.simulated);

  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-panel border border-border bg-surface p-4",
        className
      )}
      {...props}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-label uppercase tracking-wider font-semibold text-muted">
          Reply rate by signal
        </span>
        {hasSimulated && <Tag active={false}>Simulated</Tag>}
      </div>

      {rates.length === 0 ? (
        <p className="text-meta text-muted">No data yet</p>
      ) : (
        <div className="flex flex-col gap-3">
          {rates.map((rate) => {
            const label = SIGNAL_LABELS[rate.type] ?? rate.type;
            const valueText = formatRatio(rate);

            return (
              <div key={rate.type} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2 text-meta">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-text">{label}</span>
                    {rate.simulated && <Tag active={false}>Simulated</Tag>}
                  </div>
                  <span
                    className={cn(
                      "font-mono tabular-nums",
                      rate.pct === null ? "text-muted" : "text-text font-medium"
                    )}
                  >
                    {valueText}
                  </span>
                </div>

                {/* Horizontal bar */}
                <div
                  role="progressbar"
                  aria-label={`${label} reply rate`}
                  aria-valuenow={rate.pct ?? undefined}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="h-2 w-full rounded-full bg-surface-2 overflow-hidden border border-border/40"
                >
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-300",
                      rate.pct !== null && rate.pct > 0
                        ? "bg-accent"
                        : "bg-transparent"
                    )}
                    style={
                      rate.pct !== null
                        ? { width: `${Math.min(100, Math.max(0, rate.pct))}%` }
                        : undefined
                    }
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {hasSimulated && (
        <p className="text-meta text-subtle pt-2 border-t border-border mt-auto">
          Includes simulated replies from admin actions.
        </p>
      )}
    </div>
  );
}
