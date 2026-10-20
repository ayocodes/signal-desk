import { Send } from "lucide-react";
import { EmptyState } from "@/components/ui";

export default function SequencesPage() {
  return (
    <div className="py-12 max-w-2xl mx-auto">
      <EmptyState
        icon={Send}
        title="No active sequences"
        body="Leads enrolled from the queue run through multi-step email sequences with live deliverability guardrails."
      />
    </div>
  );
}
