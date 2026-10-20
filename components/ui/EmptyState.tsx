import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "./utils";

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: LucideIcon;
  title: string;
  body: string;
  action?: React.ReactNode;
}

export function EmptyState({
  className,
  icon: Icon,
  title,
  body,
  action,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center p-8 rounded-panel border border-dashed border-border bg-surface/40",
        className
      )}
      {...props}
    >
      {Icon && (
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-muted mb-3">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      )}
      <h3 className="text-section font-semibold text-text mb-1">
        {title}
      </h3>
      <p className="text-meta text-muted max-w-sm mb-4 leading-relaxed">
        {body}
      </p>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
