import { getCurrentConfig, listConfigVersions } from "@/lib/data/agent-config";
import { AgentRulesEditor } from "@/components/agent-config";
import type { ApplyStart } from "@/lib/types";

export default async function AgentRulesSettingsPage(props: {
  searchParams?: Promise<{ applying?: string; apply?: string }>;
}) {
  const searchParams = props.searchParams ? await props.searchParams : undefined;
  const applyingVersion = searchParams?.applying ? Number(searchParams.applying) : undefined;
  const applyStart = searchParams?.apply as ApplyStart | undefined;

  const [currentConfig, versions] = await Promise.all([
    getCurrentConfig(),
    listConfigVersions(),
  ]);

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 flex flex-col gap-6">
      {/* The editor keeps the form in state; a new version (after a save, restore or reset) starts it fresh. */}
      <AgentRulesEditor
        key={currentConfig.version}
        config={currentConfig}
        versions={versions}
        initialApplyingVersion={applyingVersion}
        initialApplyStart={applyStart}
      />
    </div>
  );
}
