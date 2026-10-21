import * as React from "react";
import { ExternalLink } from "lucide-react";
import { Tag } from "@/components/ui/Tag";
import { cn } from "@/components/ui/utils";
import type { SignalView } from "@/lib/types";

export function formatSignalAge(occurredAt: string, now: Date | number = Date.now()): string {
  const occurred = new Date(occurredAt).getTime();
  const current = typeof now === "number" ? now : now.getTime();
  const diffHours = Math.max(0, Math.floor((current - occurred) / (1000 * 60 * 60)));

  if (diffHours < 1) return "< 1h ago";
  if (diffHours < 48) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  const diffMonths = Math.round(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths}mo ago`;
  return `${Math.round(diffDays / 365)}y ago`;
}

export interface SignalCardProps extends React.HTMLAttributes<HTMLDivElement> {
  signal: SignalView;
  number?: number;
  index?: number;
  now?: Date | number;
}

export function SignalCard({
  signal,
  number,
  index,
  now,
  className,
  ...props
}: SignalCardProps) {
  const displayNumber = number ?? (index !== undefined ? index + 1 : undefined);
  const age = formatSignalAge(signal.occurredAt, now);

  return (
    <div
      className={cn(
        "rounded-panel border border-border bg-surface p-3 flex flex-col gap-2 transition-colors",
        className
      )}
      {...props}
    >
      <div className="flex flex-wrap items-baseline gap-2">
        {displayNumber !== undefined && (
          <span className="font-mono text-label font-semibold text-subtle select-none">
            #{displayNumber}
          </span>
        )}
        <Tag>{signal.type}</Tag>
        <h4 className="text-body font-medium text-text min-w-0 flex-1">
          {signal.title}
        </h4>
        <div className="flex items-center gap-1.5 text-meta font-mono text-muted shrink-0">
          {signal.sourceUrl ? (
            <a
              href={signal.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:text-text hover:underline transition-colors"
              title={`View on ${signal.sourceName}`}
            >
              <span>{signal.sourceName}</span>
              <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
            </a>
          ) : (
            <span>{signal.sourceName}</span>
          )}
          <span className="text-subtle select-none">·</span>
          <span>{age}</span>
        </div>
      </div>

      {signal.excerpt && (
        <p className="m-0 border-l-2 border-border pl-2.5 text-body text-muted italic">
          &ldquo;{signal.excerpt}&rdquo;
        </p>
      )}
    </div>
  );
}
