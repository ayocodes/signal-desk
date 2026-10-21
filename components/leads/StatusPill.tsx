import * as React from "react";
import { Pill, type PillProps, type PillTone } from "@/components/ui/Pill";
import type { LeadStatus } from "@/lib/types";

export const LEAD_STATUS_CONFIG: Record<LeadStatus, { tone: PillTone; label: string }> = {
  ready: { tone: "warn", label: "Ready" },
  enrolled: { tone: "accent", label: "Enrolled" },
  replied: { tone: "good", label: "Replied" },
  bounced: { tone: "bad", label: "Bounced" },
  filtered: { tone: "neutral", label: "Filtered" },
  halted: { tone: "neutral", label: "Halted" },
  completed: { tone: "neutral", label: "Completed" },
};

export interface StatusPillProps extends Omit<PillProps, "children"> {
  status: LeadStatus;
  tone?: PillTone;
  children?: React.ReactNode;
}

export function StatusPill({
  status,
  tone,
  children,
  ...props
}: StatusPillProps) {
  const config = LEAD_STATUS_CONFIG[status] ?? { tone: "neutral", label: status };
  const resolvedTone = tone ?? config.tone;
  const content = children ?? config.label;

  return (
    <Pill tone={resolvedTone} {...props}>
      {content}
    </Pill>
  );
}
