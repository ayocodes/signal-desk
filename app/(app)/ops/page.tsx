import { Activity } from "lucide-react";
import { EmptyState } from "@/components/ui";
import { LlmBudgetTile } from "@/components/ops";
import { llmBudgetToday } from "@/lib/data/llm";

export default async function OpsPage() {
  const budget = await llmBudgetToday();

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto py-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <LlmBudgetTile budget={budget} />
      </div>

      <div className="py-8 max-w-2xl mx-auto w-full">
        <EmptyState
          icon={Activity}
          title="No operational telemetry"
          body="Mailbox health, agent tick durations, reply rates by signal, and audit logs will appear here after the background worker runs."
        />
      </div>
    </div>
  );
}
