import * as React from "react";
import { cn } from "@/components/ui/utils";

export interface SplitViewProps extends React.HTMLAttributes<HTMLDivElement> {
  list: React.ReactNode;
  detail: React.ReactNode;
}

export function SplitView({ list, detail, className, ...props }: SplitViewProps) {
  return (
    <div
      className={cn(
        "flex flex-col lg:flex-row h-full min-h-[calc(100vh-theme(spacing.16))] w-full border border-border rounded-panel bg-surface overflow-hidden",
        className
      )}
      {...props}
    >
      <div className="w-full lg:w-[420px] xl:w-[460px] shrink-0 border-b lg:border-b-0 lg:border-r border-border overflow-y-auto bg-surface">
        {list}
      </div>
      <div className="flex-1 min-w-0 overflow-y-auto bg-bg/40">
        {detail}
      </div>
    </div>
  );
}
