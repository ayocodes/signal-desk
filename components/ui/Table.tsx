"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "./utils";

export type TableProps = React.HTMLAttributes<HTMLTableElement>;

export function Table({ className, ...props }: TableProps) {
  return (
    // The box scrolls both ways so the sticky header has something to stick to.
    <div className="w-full max-h-[calc(100vh-12rem)] overflow-auto rounded-panel border border-border bg-surface">
      <table
        className={cn(
          "w-full text-left border-collapse text-meta",
          className
        )}
        {...props}
      />
    </div>
  );
}

export function TableHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn(
        "sticky top-0 z-10 bg-surface border-b border-border shadow-xs",
        className
      )}
      {...props}
    />
  );
}

export function TableBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody
      className={cn("divide-y divide-border/60 bg-surface", className)}
      {...props}
    />
  );
}

export interface TableRowProps
  extends React.HTMLAttributes<HTMLTableRowElement> {
  href?: string;
  selected?: boolean;
}

export function TableRow({
  href,
  selected = false,
  className,
  onClick,
  children,
  ...props
}: TableRowProps) {
  const router = useRouter();

  const handleClick = (e: React.MouseEvent<HTMLTableRowElement>) => {
    // If user clicked directly on an anchor or button inside the row, let it handle the event
    const target = e.target as HTMLElement;
    if (target.closest("a, button, input, [role='button']")) {
      onClick?.(e);
      return;
    }

    onClick?.(e);
    if (href) {
      router.push(href);
    }
  };

  return (
    <tr
      onClick={handleClick}
      aria-selected={selected ? "true" : undefined}
      className={cn(
        "h-8 border-b border-border/60 transition-colors",
        href && "cursor-pointer hover:bg-surface-2/70",
        selected && "bg-accent-soft",
        className
      )}
      {...props}
    >
      {children}
    </tr>
  );
}

export function TableHead({
  className,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "h-8 px-3 text-label uppercase tracking-wider font-semibold text-muted text-left whitespace-nowrap",
        className
      )}
      {...props}
    />
  );
}

export function TableCell({
  className,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn(
        "h-8 px-3 py-1 text-meta whitespace-nowrap align-middle",
        className
      )}
      {...props}
    />
  );
}

export interface TableSortHeaderProps
  extends React.ThHTMLAttributes<HTMLTableCellElement> {
  column: string;
  label: string;
  currentSort?: string;
  currentDir?: "asc" | "desc";
  basePath?: string;
}

export function TableSortHeader({
  column,
  label,
  currentSort,
  currentDir = "desc",
  basePath = "/leads",
  className,
  ...props
}: TableSortHeaderProps) {
  const isSorted = currentSort === column;
  // If clicking currently sorted column: flip dir; else default to "desc" for score/updated, "asc" for others
  const nextDir = isSorted
    ? currentDir === "asc"
      ? "desc"
      : "asc"
    : column === "score" || column === "updated"
    ? "desc"
    : "asc";

  const href = `${basePath}?sort=${column}&dir=${nextDir}`;

  return (
    <th
      className={cn(
        "h-8 px-3 text-label uppercase tracking-wider font-semibold text-muted text-left whitespace-nowrap",
        className
      )}
      {...props}
    >
      <Link
        href={href}
        className="inline-flex items-center gap-1.5 hover:text-text transition-colors select-none group"
        title={`Sort by ${label}`}
      >
        <span>{label}</span>
        {isSorted ? (
          currentDir === "asc" ? (
            <ArrowUp className="h-3 w-3 text-text" aria-hidden="true" />
          ) : (
            <ArrowDown className="h-3 w-3 text-text" aria-hidden="true" />
          )
        ) : (
          <ArrowUpDown
            className="h-3 w-3 text-subtle opacity-0 group-hover:opacity-100 transition-opacity"
            aria-hidden="true"
          />
        )}
      </Link>
    </th>
  );
}

export interface TablePagerProps extends React.HTMLAttributes<HTMLDivElement> {
  page: number;
  pageSize: number;
  total: number;
  sort?: string;
  dir?: string;
  basePath?: string;
}

export function TablePager({
  page,
  pageSize,
  total,
  sort,
  dir,
  basePath = "/leads",
  className,
  ...props
}: TablePagerProps) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const hasPrev = page > 1;
  const hasNext = to < total;

  const buildPageUrl = (targetPage: number) => {
    const params = new URLSearchParams();
    if (sort) params.set("sort", sort);
    if (dir) params.set("dir", dir);
    if (targetPage > 1) params.set("page", String(targetPage));
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  return (
    <div
      className={cn("flex items-center gap-3 text-meta text-muted select-none", className)}
      {...props}
    >
      <span className="font-mono tabular-nums text-text font-medium">
        {from.toLocaleString()}-{to.toLocaleString()} of {total.toLocaleString()}
      </span>

      <div className="inline-flex items-center gap-1">
        {hasPrev ? (
          <Link
            href={buildPageUrl(page - 1)}
            className="inline-flex h-7 w-7 items-center justify-center rounded-control border border-border bg-surface text-muted hover:border-border-strong hover:text-text transition-colors"
            title="Previous page"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
        ) : (
          <span
            className="inline-flex h-7 w-7 items-center justify-center rounded-control border border-border/50 bg-surface text-subtle/50 cursor-not-allowed"
            aria-disabled="true"
          >
            <ChevronLeft className="h-4 w-4" />
          </span>
        )}

        {hasNext ? (
          <Link
            href={buildPageUrl(page + 1)}
            className="inline-flex h-7 w-7 items-center justify-center rounded-control border border-border bg-surface text-muted hover:border-border-strong hover:text-text transition-colors"
            title="Next page"
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        ) : (
          <span
            className="inline-flex h-7 w-7 items-center justify-center rounded-control border border-border/50 bg-surface text-subtle/50 cursor-not-allowed"
            aria-disabled="true"
          >
            <ChevronRight className="h-4 w-4" />
          </span>
        )}
      </div>
    </div>
  );
}
