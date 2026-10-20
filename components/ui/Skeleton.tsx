import * as React from "react";
import { cn } from "./utils";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "row" | "circle";
}

export function Skeleton({
  className,
  variant = "default",
  ...props
}: SkeletonProps) {
  if (variant === "row") {
    return <SkeletonRow className={className} {...props} />;
  }

  return (
    <div
      className={cn(
        "animate-pulse bg-surface-2",
        variant === "circle" ? "rounded-full" : "rounded-control",
        className
      )}
      {...props}
    />
  );
}

export type SkeletonRowProps = React.HTMLAttributes<HTMLDivElement>;

export function SkeletonRow({ className, ...props }: SkeletonRowProps) {
  return (
    <div
      className={cn(
        "flex h-9 w-full items-center gap-3 rounded-control border border-border/50 bg-surface px-3",
        className
      )}
      {...props}
    >
      <div className="h-4 w-8 rounded-control bg-surface-2 animate-pulse shrink-0" />
      <div className="h-4 w-32 rounded-control bg-surface-2 animate-pulse shrink-0" />
      <div className="h-4 w-48 rounded-control bg-surface-2 animate-pulse flex-1" />
      <div className="h-4 w-16 rounded-control bg-surface-2 animate-pulse shrink-0" />
    </div>
  );
}
