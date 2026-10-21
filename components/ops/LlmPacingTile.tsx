import * as React from "react";
import { Gauge } from "lucide-react";
import { cn } from "@/components/ui/utils";
import type { LlmPacing } from "@/lib/types";

export interface LlmPacingTileProps extends React.HTMLAttributes<HTMLDivElement> {
  pacing: LlmPacing;
}

export function LlmPacingTile({ pacing, className, ...props }: LlmPacingTileProps) {
  const draftsText = pacing.draftsPerRun !== null ? String(pacing.draftsPerRun) : "None yet";
  const agentSharePct = Math.round(pacing.agentShare * 100);

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-panel border border-border bg-surface p-4",
        className
      )}
      {...props}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-label uppercase tracking-wider font-semibold text-muted">
          LLM pacing
        </span>
        <Gauge className="h-4 w-4 text-muted" aria-hidden="true" />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-meta">
          <span className="text-muted">Drafts per run</span>
          <span className="font-mono font-medium text-text tabular-nums">
            {draftsText}
          </span>
        </div>

        <div className="flex items-center justify-between text-meta">
          <span className="text-muted">Agent budget share</span>
          <span className="font-mono font-medium text-text tabular-nums">
            {agentSharePct}%
          </span>
        </div>

        <div className="flex items-center justify-between text-meta">
          <span className="text-muted">Retries per lead</span>
          <span className="font-mono font-medium text-text tabular-nums">
            {pacing.maxRetriesPerLead}
          </span>
        </div>

        <div className="flex items-center justify-between text-meta">
          <span className="text-muted">Between calls</span>
          <span className="font-mono font-medium text-text tabular-nums">
            {pacing.minSecondsBetweenCalls}s
          </span>
        </div>

        <div className="flex items-center justify-between text-meta">
          <span className="text-muted">Regenerate limit</span>
          <span className="font-mono font-medium text-text tabular-nums">
            {pacing.regeneratePerUserPerHour} / user / hr
          </span>
        </div>
      </div>

      <p className="text-meta text-subtle leading-tight pt-2 border-t border-border mt-auto">
        Deploy settings: change them in the environment, not here.
      </p>
    </div>
  );
}
