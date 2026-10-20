"use client";

import * as React from "react";
import { cn } from "./utils";

export interface TabItem {
  id: string;
  label: string;
  count?: number;
  disabled?: boolean;
}

export interface TabsProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  ariaLabel?: string;
}

export function Tabs({
  items,
  value,
  onChange,
  className,
  ariaLabel = "Tabs",
  ...props
}: TabsProps) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn("inline-flex items-center gap-1", className)}
      {...props}
    >
      {items.map((item) => {
        const isSelected = item.id === value;

        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`tab-${item.id}`}
            aria-controls={`tabpanel-${item.id}`}
            aria-selected={isSelected}
            disabled={item.disabled}
            onClick={() => onChange(item.id)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-control px-2.5 text-meta font-medium transition-colors select-none",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
              "disabled:cursor-not-allowed disabled:opacity-50",
              isSelected
                ? "bg-surface-2 text-text font-semibold shadow-xs"
                : "text-muted hover:bg-surface-2/60 hover:text-text"
            )}
          >
            <span>{item.label}</span>
            {typeof item.count === "number" && (
              <span
                className={cn(
                  "font-mono text-label tabular-nums px-1 rounded-sm",
                  isSelected
                    ? "bg-surface text-text"
                    : "bg-surface-2/80 text-muted"
                )}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
