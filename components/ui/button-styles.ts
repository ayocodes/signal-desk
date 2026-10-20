// Button styling, kept out of Button.tsx (a client module) so server components can use it too,
// for example to style a <Link> as a button.
import { cn } from "./utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

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

// A <Link> styled this way avoids nesting a <button> inside an <a> (invalid HTML, two tab stops).
export function buttonClassName({
  variant = "secondary",
  size = "md",
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}): string {
  return cn(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control font-medium transition-colors select-none",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
    "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
    variantStyles[variant],
    sizeStyles[size],
    className
  );
}
