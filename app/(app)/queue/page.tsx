import { Inbox } from "lucide-react";
import { EmptyState } from "@/components/ui";

export default function QueuePage() {
  return (
    <div className="py-12 max-w-2xl mx-auto">
      <EmptyState
        icon={Inbox}
        title="No leads ready for review"
        body="Leads appear here after the agent's next run, every 30 minutes. Once scored and grounded with buying signals, you can review and enroll them."
      />
    </div>
  );
}
