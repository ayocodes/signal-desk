"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { showToast } from "@/components/ui/Toast";
import { resumeMailbox } from "@/lib/api";

export interface ResumeMailboxButtonProps {
  mailboxId: string;
}

export function ResumeMailboxButton({ mailboxId }: ResumeMailboxButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  const handleResume = async () => {
    setLoading(true);
    const result = await resumeMailbox(mailboxId);
    setLoading(false);

    if (!result.ok) {
      showToast(result.error.message, { tone: "bad" });
      return;
    }

    showToast("Mailbox resumed", { tone: "good" });
    router.refresh();
  };

  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={loading}
      onClick={handleResume}
    >
      {loading ? "Resuming..." : "Resume"}
    </Button>
  );
}
