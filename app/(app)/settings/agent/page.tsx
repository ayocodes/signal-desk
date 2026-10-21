import { getCurrentConfig } from "@/lib/data/agent-config";
import { AgentRulesEditor } from "@/components/agent-config";

export default async function AgentRulesSettingsPage() {
  const currentConfig = await getCurrentConfig();

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 flex flex-col gap-6">
      <AgentRulesEditor config={currentConfig} />
    </div>
  );
}
