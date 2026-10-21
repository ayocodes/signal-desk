import { getCurrentConfig, listConfigVersions } from "@/lib/data/agent-config";
import { AgentRulesEditor } from "@/components/agent-config";

export default async function AgentRulesSettingsPage() {
  const [currentConfig, versions] = await Promise.all([
    getCurrentConfig(),
    listConfigVersions(),
  ]);

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 flex flex-col gap-6">
      {/* The editor keeps the form in state; a new version (after a save or a revert) starts it fresh. */}
      <AgentRulesEditor key={currentConfig.version} config={currentConfig} versions={versions} />
    </div>
  );
}
