"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { History, Loader2 } from "lucide-react";
import { Button, Pill, showToast } from "@/components/ui";
import { revertAgentConfig } from "@/lib/api";
import type { RulesVersion } from "@/lib/types";

export interface VersionHistoryProps {
  versions: RulesVersion[];
}

export function formatSavedDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toISOString().replace("T", " ").slice(0, 16) + " UTC";
  } catch {
    return isoString;
  }
}

export function VersionHistory({ versions }: VersionHistoryProps) {
  const router = useRouter();
  const [confirmingVersion, setConfirmingVersion] = React.useState<number | null>(null);
  const [isReverting, setIsReverting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const handleRevert = async (version: number) => {
    setIsReverting(true);
    setErrorMessage(null);
    try {
      const res = await revertAgentConfig(version);
      if (!res.ok) {
        setErrorMessage(res.error.message);
        setIsReverting(false);
        return;
      }
      showToast(`Reverted: saved as version ${res.data.version}`, { tone: "good" });
      setConfirmingVersion(null);
      setIsReverting(false);
      router.refresh();
    } catch {
      setErrorMessage("Couldn't reach the server. Check your connection.");
      setIsReverting(false);
    }
  };

  return (
    <div className="rounded-panel border border-border bg-surface p-6 flex flex-col gap-4">
      <div className="flex flex-col gap-1 pb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-accent" />
          <h2 className="text-section font-semibold text-text">Version history</h2>
        </div>
        <p className="text-meta text-muted">
          Every saved configuration for your workspace. Reverting to a prior version creates a new version with those settings.
        </p>
      </div>

      {versions.length === 0 ? (
        <p className="text-meta text-muted py-2">No saved versions yet.</p>
      ) : (
        <div className="flex flex-col divide-y divide-border/60">
          {versions.map((ver) => (
            <div key={ver.version} className="py-4 flex flex-col gap-2.5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="font-semibold text-body text-text font-mono">
                    Version {ver.version}
                  </span>
                  {ver.isCurrent && (
                    <Pill tone="accent" dot={false}>
                      Current
                    </Pill>
                  )}
                  <span className="text-meta text-muted">
                    by {ver.savedBy ? ver.savedBy.name : "Seeded"}
                  </span>
                  <span className="text-meta text-subtle font-mono">
                    {formatSavedDate(ver.savedAt)}
                  </span>
                </div>

                {!ver.isCurrent && confirmingVersion !== ver.version && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setConfirmingVersion(ver.version);
                      setErrorMessage(null);
                    }}
                  >
                    Revert to this version
                  </Button>
                )}
              </div>

              <div className="pl-1">
                {ver.version === 1 ? (
                  <p className="text-meta text-muted">First version, from the defaults</p>
                ) : ver.changeSummary.length > 0 ? (
                  <ul className="list-disc list-inside space-y-1 text-meta text-muted">
                    {ver.changeSummary.map((line, idx) => (
                      <li key={idx} className="font-mono text-meta">
                        {line}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-meta text-muted">No change details recorded</p>
                )}
              </div>

              {confirmingVersion === ver.version && (
                <div className="mt-2 rounded-control border border-border bg-surface-2/60 p-3 flex flex-col gap-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-meta font-medium text-text">
                      Revert to version {ver.version}? This saves a new version.
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="primary"
                        disabled={isReverting}
                        onClick={() => handleRevert(ver.version)}
                      >
                        {isReverting ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            <span>Reverting...</span>
                          </>
                        ) : (
                          <span>Confirm</span>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={isReverting}
                        onClick={() => {
                          setConfirmingVersion(null);
                          setErrorMessage(null);
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>

                  {errorMessage && (
                    <div className="rounded-control border border-bad/30 bg-bad/10 p-2 text-meta text-bad">
                      {errorMessage}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
