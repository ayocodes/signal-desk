import { Users } from "lucide-react";
import { EmptyState } from "@/components/ui";

export default function LeadsPage() {
  return (
    <div className="py-12 max-w-2xl mx-auto">
      <EmptyState
        icon={Users}
        title="No discovered leads"
        body="Discovered companies and scored contacts appear here after the background agent completes an ICP sourcing run."
      />
    </div>
  );
}
