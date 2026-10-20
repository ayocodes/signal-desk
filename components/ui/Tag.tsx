"use client";

import * as React from "react";
import { cn } from "./utils";

export interface TagProps extends React.HTMLAttributes<HTMLElement> {
  active?: boolean;
  interactive?: boolean;
}

export function Tag({
  className,
  active = true,
  interactive = false,
  children,
  onClick,
  ...props
}: TagProps) {
  const isInteractive = interactive || Boolean(onClick);
  const Component = isInteractive ? "button" : "span";

  return (
    <Component
      type={isInteractive ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-control px-2 py-0.5 font-mono text-label font-semibold uppercase tracking-wider select-none whitespace-nowrap transition-colors",
        active
          ? "border border-signal/30 bg-signal/15 text-signal"
          : "border border-border bg-surface text-muted hover:border-border-strong hover:text-text",
        isInteractive &&
          "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        className
      )}
      {...props}
    >
      {children}
    </Component>
  );
}
