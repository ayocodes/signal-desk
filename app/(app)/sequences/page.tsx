import { Send } from "lucide-react";
import { EmptyState } from "@/components/ui";

export default function SequencesPage() {
  return (
    <div className="py-12 max-w-2xl mx-auto">
      <EmptyState
        icon={Send}
        title="No active sequences"
        body="Approve a lead in the Queue and its email sequence starts here, with every step, branch and send."
      />
    </div>
  );
}
