import * as React from "react";
import { cn } from "./utils";

export type AvatarSize = "sm" | "md" | "lg";

export interface AvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  name?: string;
  initials?: string;
  size?: AvatarSize;
}

const sizeStyles: Record<AvatarSize, string> = {
  sm: "h-6 w-6 text-label",
  md: "h-8 w-8 text-meta",
  lg: "h-10 w-10 text-body",
};

function getInitials(name?: string): string {
  if (!name) return "";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({
  className,
  name,
  initials,
  size = "md",
  children,
  ...props
}: AvatarProps) {
  const displayInitials = initials ?? getInitials(name);

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full font-mono font-medium select-none bg-surface-2 text-text border border-border shrink-0",
        sizeStyles[size],
        className
      )}
      aria-label={name}
      {...props}
    >
      {children ?? displayInitials}
    </span>
  );
}
