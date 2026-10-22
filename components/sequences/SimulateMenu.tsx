"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Tag } from "@/components/ui/Tag";
import { showToast } from "@/components/ui/Toast";
import { cn } from "@/components/ui/utils";
import { fastForward, simulateOpen, simulateReply } from "@/lib/api";
import type { SequenceTimeline } from "@/lib/types";

function useSafeRouter() {
  try {
    return useRouter();
  } catch {
    return { refresh: () => {} };
  }
}

export interface SimulateMenuProps
  extends React.HTMLAttributes<HTMLDivElement> {
  leadId: string;
  timeline?: SequenceTimeline | null;
}

export function SimulateMenu({
  leadId,
  timeline,
  className,
  ...props
}: SimulateMenuProps) {
  const router = useSafeRouter();
  const [open, setOpen] = React.useState(false);
  const [pendingAction, setPendingAction] = React.useState<
    "reply" | "open" | "fastForward" | null
  >(null);
  const pollTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const fastForwardStepRef = React.useRef<string | null>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);

  // Close dropdown on click outside or Escape
  React.useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  // Clean up interval on unmount
  React.useEffect(() => {
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    };
  }, []);

  const handleSimulateReply = async () => {
    setOpen(false);
    setPendingAction("reply");
    const res = await simulateReply(leadId);
    setPendingAction(null);

    if (!res.ok) {
      showToast(res.error.message, { tone: "bad" });
      return;
    }

    showToast(`Simulated reply on ${res.data.step}`, { tone: "good" });
    router.refresh();
  };

  const handleSimulateOpen = async () => {
    setOpen(false);
    setPendingAction("open");
    const res = await simulateOpen(leadId);
    setPendingAction(null);

    if (!res.ok) {
      showToast(res.error.message, { tone: "bad" });
      return;
    }

    showToast(`Simulated open on ${res.data.step}`, { tone: "good" });
    router.refresh();
  };

  const handleFastForward = async () => {
    setOpen(false);
    setPendingAction("fastForward");
    const res = await fastForward(leadId);
    setPendingAction(null);

    if (!res.ok) {
      showToast(res.error.message, { tone: "bad" });
      return;
    }

    const { step, apply } = res.data;
    if (apply === "deferred" || apply === "failed") {
      showToast(
        "Couldn't send right now. It will go out on the next scheduled run."
      );
      return;
    }

    // apply is "dispatched" or "joined"
    showToast("Sending the next step...", { tone: "default", duration: 5000 });
    fastForwardStepRef.current = step;

    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
    }
    let pollCount = 0;
    pollTimerRef.current = setInterval(() => {
      pollCount += 1;
      router.refresh();
      // Check if the step is no longer pending or if we reached maximum polls
      const stepObj = timeline?.steps.find(
        (s) =>
          s.label === fastForwardStepRef.current ||
          s.key === fastForwardStepRef.current
      );
      const isCompleted = stepObj && stepObj.status !== "pending";

      if (isCompleted || pollCount >= 6) {
        if (pollTimerRef.current) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
        fastForwardStepRef.current = null;
      }
    }, 5000);
  };

  return (
    <div
      ref={menuRef}
      className={cn("relative inline-block text-left", className)}
      {...props}
    >
      <Button
        variant="secondary"
        size="sm"
        aria-haspopup="true"
        aria-expanded={open}
        disabled={pendingAction !== null}
        onClick={() => setOpen((prev) => !prev)}
        className="gap-1.5 text-meta font-medium"
      >
        <span>Simulate</span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-muted transition-transform duration-150",
            open && "rotate-180"
          )}
          aria-hidden="true"
        />
      </Button>

      {open && (
        <div
          role="menu"
          aria-label="Simulate actions"
          className="absolute right-0 top-full mt-1.5 z-30 min-w-[240px] rounded-panel border border-border bg-surface p-1 shadow-lg flex flex-col gap-0.5"
        >
          <button
            role="menuitem"
            type="button"
            disabled={pendingAction !== null}
            onClick={handleSimulateReply}
            className="flex items-center justify-between gap-3 px-2.5 py-1.5 text-left rounded-control hover:bg-surface-2 text-text text-meta transition-colors select-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:opacity-50"
          >
            <span className="font-medium">Simulate reply</span>
            <Tag active={false}>Simulated</Tag>
          </button>
          <button
            role="menuitem"
            type="button"
            disabled={pendingAction !== null}
            onClick={handleSimulateOpen}
            className="flex items-center justify-between gap-3 px-2.5 py-1.5 text-left rounded-control hover:bg-surface-2 text-text text-meta transition-colors select-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:opacity-50"
          >
            <span className="font-medium">Simulate open</span>
            <Tag active={false}>Simulated</Tag>
          </button>
          <button
            role="menuitem"
            type="button"
            disabled={pendingAction !== null}
            onClick={handleFastForward}
            className="flex items-center justify-between gap-3 px-2.5 py-1.5 text-left rounded-control hover:bg-surface-2 text-text text-meta transition-colors select-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:opacity-50"
          >
            <span className="font-medium">Fast-forward to next step</span>
            <Tag active={false}>Simulated</Tag>
          </button>
        </div>
      )}
    </div>
  );
}
