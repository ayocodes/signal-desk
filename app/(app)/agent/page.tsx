import { requireProfile } from "@/lib/auth";
import { getCurrentConfig } from "@/lib/data/agent-config";
import { AgentRulesView } from "@/components/agent-config";

export default async function AgentPage() {
  const profile = await requireProfile();
  const config = await getCurrentConfig();

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto py-6 px-4 md:px-0">
      <AgentRulesView config={config} isAdmin={profile.role === "admin"} />
    </div>
  );
}
