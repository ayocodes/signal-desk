"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button, showToast } from "@/components/ui";
import { resendToCorrected } from "@/lib/api";
import { cn } from "@/components/ui/utils";
import type { RecoveryProposal } from "@/lib/types";

export interface RecoveryPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  leadId: string;
  proposal: RecoveryProposal;
}

export function RecoveryPanel({
  leadId,
  proposal,
  className,
  ...props
}: RecoveryPanelProps) {
  const router = useRouter();
  const [status, setStatus] = React.useState<"pending" | "approved">(proposal.status);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const handleResend = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    const res = await resendToCorrected(leadId, proposal.id);
    if (!res.ok) {
      setErrorMessage(res.error.message);
      showToast(res.error.message, { tone: "bad" });
      setIsSubmitting(false);
      return;
    }

    const apply = res.data.apply;
    if (apply === "dispatched" || apply === "joined") {
      showToast("Resending...", { tone: "good" });
    } else {
      showToast(
        "Couldn't send right now. It will go out on the next scheduled run."
      );
    }

    setStatus("approved");
    setIsSubmitting(false);
    router.refresh();
  };

  return (
    <div
      className={cn(
        "rounded-panel border border-border bg-surface p-4 flex flex-col gap-4",
        className
      )}
      {...props}
    >
      <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-border/60">
        <span className="text-label uppercase tracking-wider font-semibold text-muted">
          Bounce recovery
        </span>
        {status === "approved" ? (
          <span className="font-mono text-label text-good uppercase tracking-wider font-semibold">
            Approved
          </span>
        ) : (
          <span className="font-mono text-label text-warn uppercase tracking-wider font-semibold">
            Action required
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-meta">
        <div className="flex flex-col gap-1">
          <span className="text-muted">Bounce code</span>
          <span className="font-mono text-text bg-surface-2 px-2.5 py-1 rounded-control border border-border">
            {proposal.bounceCode ?? "Unknown"}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-muted">Original address</span>
          <span className="font-mono text-text bg-surface-2 px-2.5 py-1 rounded-control border border-border">
            {proposal.originalAddress}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-1 text-meta">
        <span className="text-muted">Proposed corrected address</span>
        <span className="font-mono text-text bg-surface-2 px-2.5 py-1 rounded-control border border-border">
          {proposal.proposedAddress}
        </span>
      </div>

      <div className="flex flex-col gap-1 text-meta">
        <span className="text-muted">Reason</span>
        <p className="text-body text-text leading-relaxed">
          {proposal.reason}
        </p>
      </div>

      {errorMessage && (
        <div className="rounded-control bg-bad/10 border border-bad/30 p-2.5 text-meta text-bad">
          {errorMessage}
        </div>
      )}

      {status === "approved" ? (
        <div className="rounded-control bg-good/10 border border-good/30 p-3 text-body text-good flex items-baseline gap-1.5 flex-wrap">
          <span>Resent to</span>
          <span className="font-mono font-medium">{proposal.proposedAddress}</span>
        </div>
      ) : (
        <div className="pt-1">
          <Button
            variant="primary"
            disabled={isSubmitting}
            onClick={handleResend}
          >
            {isSubmitting ? "Resending..." : "Resend to corrected address"}
          </Button>
        </div>
      )}
    </div>
  );
}
