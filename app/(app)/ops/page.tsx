import { Activity } from "lucide-react";
import { EmptyState } from "@/components/ui";

export default function OpsPage() {
  return (
    <div className="py-12 max-w-2xl mx-auto">
      <EmptyState
        icon={Activity}
        title="No operational telemetry"
        body="Mailbox health, agent tick durations, reply rates by signal, and audit logs will appear here after the background worker runs."
      />
    </div>
  );
}
