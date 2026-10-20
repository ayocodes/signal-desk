import * as React from "react";
import { cn } from "./utils";

export type KbdProps = React.HTMLAttributes<HTMLElement>;

export function Kbd({ className, children, ...props }: KbdProps) {
  return (
    <kbd
      className={cn(
        "inline-flex items-center justify-center font-mono text-label tabular-nums px-1.5 py-0.5 rounded border border-border bg-surface-2 text-muted uppercase tracking-wider select-none",
        className
      )}
      {...props}
    >
      {children}
    </kbd>
  );
}
