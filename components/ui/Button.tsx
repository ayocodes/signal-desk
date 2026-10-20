"use client";

import * as React from "react";
import { cn } from "./utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-fg border border-transparent hover:opacity-90 active:opacity-85",
  secondary: "bg-surface text-text border border-border hover:bg-surface-2 hover:border-border-strong",
  ghost: "bg-transparent text-text border border-transparent hover:bg-surface-2",
  danger: "bg-bad/15 text-bad border border-bad/30 hover:bg-bad/25 active:bg-bad/30",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-8 px-2.5 text-meta",
  md: "h-9 px-3.5 text-body",
  lg: "h-10 px-4 text-body",
  icon: "h-8 w-8 p-0",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "secondary", size = "md", type = "button", disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled}
        className={cn(
          "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control font-medium transition-colors select-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
          "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";
