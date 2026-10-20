import * as React from "react";
import { cn } from "./utils";

export type PanelProps = React.HTMLAttributes<HTMLDivElement>;

export function Panel({ className, children, ...props }: PanelProps) {
  return (
    <div
      className={cn(
        "rounded-panel border border-border bg-surface min-w-0 transition-colors",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface PanelHeaderProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
}

export function PanelHeader({
  className,
  title,
  description,
  action,
  children,
  ...props
}: PanelHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 border-b border-border px-3.5 py-2.5",
        className
      )}
      {...props}
    >
      {children ?? (
        <>
          <div className="min-w-0 flex-1">
            {title && (
              <h3 className="text-body font-semibold text-text truncate">
                {title}
              </h3>
            )}
            {description && (
              <p className="text-meta text-muted mt-0.5 truncate">
                {description}
              </p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </>
      )}
    </div>
  );
}

export type PanelBodyProps = React.HTMLAttributes<HTMLDivElement>;

export function PanelBody({ className, children, ...props }: PanelBodyProps) {
  return (
    <div className={cn("p-3.5", className)} {...props}>
      {children}
    </div>
  );
}

export type PanelFooterProps = React.HTMLAttributes<HTMLDivElement>;

export function PanelFooter({ className, children, ...props }: PanelFooterProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 border-t border-border px-3.5 py-2.5",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
