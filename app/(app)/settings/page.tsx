import { Settings } from "lucide-react";
import { EmptyState } from "@/components/ui";

export default function SettingsPage() {
  return (
    <div className="py-12 max-w-2xl mx-auto">
      <EmptyState
        icon={Settings}
        title="Workspace settings"
        body="Configure themes, ICP target criteria, scoring weights, and delivery guardrails."
      />
    </div>
  );
}
