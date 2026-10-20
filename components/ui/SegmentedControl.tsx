"use client";

import * as React from "react";
import { cn } from "./utils";

export interface SegmentedControlOption<T extends string = string> {
  value: T;
  label: React.ReactNode;
  disabled?: boolean;
  description?: string;
  tone?: "default" | "bad";
}

export interface SegmentedControlProps<T extends string = string> {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "md";
  className?: string;
  ariaLabel?: string;
}

export function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  size = "md",
  className,
  ariaLabel = "Segmented control",
}: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex rounded-control border border-border bg-surface-2 p-1 gap-1",
        className
      )}
    >
      {options.map((option) => {
        const isSelected = option.value === value;
        const isBad = option.tone === "bad";

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex flex-col items-center justify-center rounded-[4px] font-medium transition-all select-none",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
              "disabled:cursor-not-allowed disabled:opacity-50",
              size === "sm" ? "px-2 py-1 text-meta" : "px-3 py-1.5 text-body",
              isSelected
                ? isBad
                  ? "bg-bad/20 text-bad border border-bad/30 shadow-xs font-semibold"
                  : "bg-surface text-text border border-border shadow-xs font-semibold"
                : isBad
                ? "text-bad/80 hover:bg-bad/10 hover:text-bad border border-transparent"
                : "text-muted hover:text-text hover:bg-surface/50 border border-transparent"
            )}
          >
            <span>{option.label}</span>
            {option.description && (
              <span className="text-label text-muted font-normal mt-0.5">
                {option.description}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
