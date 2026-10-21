import { getCurrentConfig, listConfigVersions } from "@/lib/data/agent-config";
import { AgentRulesEditor } from "@/components/agent-config";
import type { ApplyStart } from "@/lib/types";

const APPLY_STARTS: ApplyStart[] = ["dispatched", "joined", "deferred", "failed"];

export default async function AgentRulesSettingsPage(props: {
  searchParams?: Promise<{ applying?: string; apply?: string }>;
}) {
  const searchParams = props.searchParams ? await props.searchParams : undefined;
  // Set by the editor after a save, restore or reset, so the apply status survives the
  // editor re-mounting for the new version. Anything else in the URL is ignored.
  const applyingVersion = Number(searchParams?.applying);
  const validVersion = Number.isInteger(applyingVersion) && applyingVersion > 0 ? applyingVersion : undefined;
  const applyStart = APPLY_STARTS.find((value) => value === searchParams?.apply);

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
        initialApplyingVersion={validVersion}
        initialApplyStart={applyStart}
      />
    </div>
  );
}
