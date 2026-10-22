"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { showToast } from "@/components/ui/Toast";
import { cn } from "@/components/ui/utils";
import { setTestInbox } from "@/lib/api";

export interface TestInboxControlProps
  extends React.HTMLAttributes<HTMLDivElement> {
  leadId: string;
  initialAddress: string;
  isPlaceholder?: boolean;
}

export function TestInboxControl({
  leadId,
  initialAddress,
  isPlaceholder = false,
  className,
  ...props
}: TestInboxControlProps) {
  const router = useRouter();
  const [overrideAddress, setOverrideAddress] = React.useState<string | null>(
    null
  );
  const [prevInitialAddress, setPrevInitialAddress] =
    React.useState(initialAddress);
  const [isChanging, setIsChanging] = React.useState(false);

  if (prevInitialAddress !== initialAddress) {
    setPrevInitialAddress(initialAddress);
    setOverrideAddress(null);
  }

  const address = overrideAddress ?? initialAddress;

  const currentInbox: "delivered" | "bounced" | "complained" =
    React.useMemo(() => {
      const lower = address.toLowerCase();
      if (lower.startsWith("bounced")) return "bounced";
      if (lower.startsWith("complained")) return "complained";
      return "delivered";
    }, [address]);

  const handleInboxChange = async (
    inbox: "delivered" | "bounced" | "complained"
  ) => {
    if (inbox === currentInbox || isChanging) return;
    setIsChanging(true);
    const res = await setTestInbox(leadId, inbox);
    setIsChanging(false);

    if (!res.ok) {
      showToast(res.error.message, { tone: "bad" });
      return;
    }

    setOverrideAddress(res.data.sendAddress);
    showToast(`Test inbox set to ${inbox}`, { tone: "good" });
    router.refresh();
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-2.5 pt-2 border-t border-border/60",
        className
      )}
      {...props}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-2 text-meta">
          <span className="text-muted">Send address:</span>
          <span className="font-mono text-text bg-surface-2 px-2 py-0.5 rounded-control border border-border">
            {address}
          </span>
          {isPlaceholder && (
            <span className="text-subtle italic">
              (a test inbox: we never email real people)
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-meta text-muted font-medium">Test inbox:</span>
          <SegmentedControl<"delivered" | "bounced" | "complained">
            size="sm"
            options={[
              { value: "delivered", label: "Delivered", disabled: isChanging },
              { value: "bounced", label: "Bounced", disabled: isChanging },
              { value: "complained", label: "Complained", disabled: isChanging },
            ]}
            value={currentInbox}
            onChange={handleInboxChange}
            ariaLabel="Test inbox choice"
          />
        </div>
      </div>
      <p className="text-meta text-subtle">
        Real Resend events follow: a bounce or complaint here is genuine, only the inbox was chosen.
      </p>
    </div>
  );
}
