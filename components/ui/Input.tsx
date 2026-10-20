"use client";

import * as React from "react";
import { cn } from "./utils";

export type InputSize = "sm" | "md";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  inputSize?: InputSize;
}

const sizeStyles: Record<InputSize, string> = {
  sm: "h-8 px-2.5 text-meta",
  md: "h-9 px-3 text-body",
};

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, inputSize = "md", type = "text", disabled, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        disabled={disabled}
        className={cn(
          "w-full rounded-control border border-border bg-surface text-text placeholder:text-subtle transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:border-border-strong",
          "disabled:cursor-not-allowed disabled:opacity-50",
          sizeStyles[inputSize],
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";
