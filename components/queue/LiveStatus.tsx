"use client";

import * as React from "react";
import { useLiveLeads } from "@/lib/use-live-leads";
import { cn } from "@/components/ui/utils";

export type LiveStatusProps = React.HTMLAttributes<HTMLDivElement>;

export function LiveStatus({ className, ...props }: LiveStatusProps) {
  const { mode } = useLiveLeads();
  const isLive = mode === "live";

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 text-meta font-mono select-none",
        isLive ? "text-good" : "text-muted",
        className
      )}
      title={isLive ? "Live updates active via Realtime" : "Polling fallback active (refreshes every minute)"}
      {...props}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full shrink-0",
          isLive ? "bg-good animate-pulse" : "bg-muted"
        )}
        aria-hidden="true"
      />
      <span>{isLive ? "Live" : "Refreshing every minute"}</span>
    </div>
  );
}
