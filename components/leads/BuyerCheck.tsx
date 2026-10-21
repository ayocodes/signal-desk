import * as React from "react";
import { Pill, type PillTone } from "@/components/ui/Pill";
import { cn } from "@/components/ui/utils";
import type { BuyerStatus, ContactDetail } from "@/lib/types";

export const BUYER_STATUS_CONFIG: Record<BuyerStatus, { tone: PillTone; label: string }> = {
  verified: { tone: "good", label: "Buyer verified" },
  rerouted: { tone: "accent", label: "Buyer rerouted" },
  unverified: { tone: "warn", label: "Buyer unverified" },
};

export interface BuyerCheckProps extends React.HTMLAttributes<HTMLDivElement> {
  status?: BuyerStatus;
  reason?: string | null;
  contact?: ContactDetail | null;
}

export function BuyerCheck({
  status,
  reason,
  contact,
  className,
  ...props
}: BuyerCheckProps) {
  const resolvedStatus: BuyerStatus =
    status ?? contact?.buyerStatus ?? "unverified";
  const resolvedReason = reason ?? contact?.buyerReason;
  const config = BUYER_STATUS_CONFIG[resolvedStatus] ?? {
    tone: "neutral" as PillTone,
    label: resolvedStatus,
  };

  return (
    <div
      className={cn("inline-flex flex-wrap items-baseline gap-2 text-body", className)}
      {...props}
    >
      <Pill tone={config.tone}>{config.label}</Pill>
      {resolvedReason && (
        <span className="text-muted text-meta">{resolvedReason}</span>
      )}
    </div>
  );
}
