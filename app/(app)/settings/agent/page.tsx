import { getCurrentConfig, listConfigVersions } from "@/lib/data/agent-config";
import { AgentRulesEditor } from "@/components/agent-config";

export default async function AgentRulesSettingsPage() {
  const [currentConfig, versions] = await Promise.all([
    getCurrentConfig(),
    listConfigVersions(),
  ]);

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 flex flex-col gap-6">
      <AgentRulesEditor config={currentConfig} versions={versions} />
    </div>
  );
}
