"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  AlertCircle,
  AlertTriangle,
  Check,
  ChevronDown,
  Loader2,
  RotateCw,
  X,
} from "lucide-react";
import {
  Button,
  Input,
  Kbd,
  Pill,
  SegmentedControl,
  type SegmentedControlOption,
  Skeleton,
  Textarea,
  showToast,
} from "@/components/ui";
import { cn } from "@/components/ui/utils";
import { approveLead, generateDraft } from "@/lib/api";
import {
  passed,
  runGuardrails,
  type CheckName,
  type CheckResult,
} from "@/lib/guardrails";
import { useSelectedLeadContext } from "@/components/queue/lead-context";
import type {
  DraftAngle,
  DraftView,
  DraftWorkspace,
  LeadDetail as LeadDetailType,
} from "@/lib/types";
import { DRAFT_ANGLES } from "@/lib/types";

export interface EmailEditorProps extends React.HTMLAttributes<HTMLDivElement> {
  lead: LeadDetailType;
  workspace: DraftWorkspace;
  nextLeadHref?: string;
  onApproved?: () => void;
}

const ANGLE_OPTIONS: SegmentedControlOption<DraftAngle>[] = [
  { value: "signal", label: "Signal" },
  { value: "peer", label: "Peer" },
  { value: "short", label: "Short" },
  { value: "raw", label: "Unconstrained", tone: "bad" },
];

const CHECK_TITLES: Record<CheckName, string> = {
  angle: "Angle",
  grounding: "Grounding",
  banned_chars: "Banned characters",
  banned_phrases: "Banned phrases",
  word_count: "Word count",
  closing_question: "Closing question",
  numbers: "Numbers",
  claims: "Claims",
  placeholders: "Placeholders",
  subject: "Subject",
};

export function EmailEditor({
  lead,
  workspace,
  nextLeadHref,
  onApproved,
  className,
  ...props
}: EmailEditorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const selectedLead = useSelectedLeadContext();
  const resolvedNextLeadHref = nextLeadHref ?? selectedLead?.nextLeadHref;

  // If the lead has no drafts at all yet
  const hasAnyDrafts = workspace.drafts.length > 0;

  // Map of loaded drafts by angle
  const [draftsByAngle, setDraftsByAngle] = React.useState<
    Partial<Record<DraftAngle, DraftView>>
  >(() => {
    const map: Partial<Record<DraftAngle, DraftView>> = {};
    for (const draft of workspace.drafts) {
      map[draft.angle] = draft;
    }
    return map;
  });

  // Track initial angle: pick first angle that has a draft, or default to "signal"
  const [currentAngle, setCurrentAngle] = React.useState<DraftAngle>(() => {
    for (const angle of DRAFT_ANGLES) {
      if (workspace.drafts.some((d) => d.angle === angle)) {
        return angle;
      }
    }
    return "signal";
  });

  // Editable text per angle
  const [edits, setEdits] = React.useState<
    Partial<Record<DraftAngle, { subject: string; body: string }>>
  >(() => {
    const map: Partial<Record<DraftAngle, { subject: string; body: string }>> =
      {};
    for (const draft of workspace.drafts) {
      map[draft.angle] = { subject: draft.subject, body: draft.body };
    }
    return map;
  });

  const [isLoadingAngle, setIsLoadingAngle] = React.useState(false);
  const [isRegenerating, setIsRegenerating] = React.useState(false);
  const [isApproving, setIsApproving] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [serverCheckResults, setServerCheckResults] = React.useState<
    CheckResult[] | null
  >(null);

  // Current draft and current edit
  const currentDraft = draftsByAngle[currentAngle];
  const currentEdit = edits[currentAngle] ?? {
    subject: currentDraft?.subject ?? "",
    body: currentDraft?.body ?? "",
  };

  const isEdited = currentDraft
    ? currentEdit.subject !== currentDraft.subject ||
      currentEdit.body !== currentDraft.body
    : false;

  // Handle switching angles
  const handleAngleChange = async (angle: DraftAngle) => {
    setCurrentAngle(angle);
    setErrorMessage(null);
    setServerCheckResults(null);

    // If switching to raw and it has not been generated yet, generate it
    if (angle === "raw" && !draftsByAngle.raw) {
      setIsLoadingAngle(true);
      try {
        const res = await generateDraft(lead.id, "raw");
        if (res.ok) {
          const newDraft = res.data;
          setDraftsByAngle((prev) => ({ ...prev, raw: newDraft }));
          setEdits((prev) => ({
            ...prev,
            raw: { subject: newDraft.subject, body: newDraft.body },
          }));
        } else {
          setErrorMessage(res.error.message);
        }
      } catch {
        setErrorMessage("Request failed. Please try again.");
      } finally {
        setIsLoadingAngle(false);
      }
    }
  };

  const handleSubjectChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (serverCheckResults) setServerCheckResults(null);
    setEdits((prev) => ({
      ...prev,
      [currentAngle]: {
        subject: value,
        body: prev[currentAngle]?.body ?? currentDraft?.body ?? "",
      },
    }));
  };

  const handleBodyChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (serverCheckResults) setServerCheckResults(null);
    setEdits((prev) => ({
      ...prev,
      [currentAngle]: {
        subject: prev[currentAngle]?.subject ?? currentDraft?.subject ?? "",
        body: value,
      },
    }));
  };

  // Run live guardrails on current subject and body
  const liveCheckResults = React.useMemo(() => {
    return runGuardrails(
      {
        angle: currentAngle,
        subject: currentEdit.subject,
        body: currentEdit.body,
        groundedPhrases: currentDraft?.groundedPhrases ?? [],
        signals: lead.signals.map((s) => ({
          title: s.title,
          excerpt: s.excerpt,
        })),
      },
      workspace.guardrailRules
    );
  }, [
    currentAngle,
    currentEdit.subject,
    currentEdit.body,
    currentDraft?.groundedPhrases,
    lead.signals,
    workspace.guardrailRules,
  ]);

  const checkResults = serverCheckResults ?? liveCheckResults;

  const passedChecksCount = checkResults.filter(
    (c) => c.status === "pass"
  ).length;

  const canApprove =
    currentAngle !== "raw" &&
    passed(checkResults) &&
    !isApproving &&
    !isRegenerating &&
    !isLoadingAngle &&
    Boolean(currentDraft?.id);

  // Handle Regenerate action
  const handleRegenerate = async () => {
    if (isRegenerating || isApproving || isLoadingAngle) return;
    setIsRegenerating(true);
    setErrorMessage(null);
    setServerCheckResults(null);

    try {
      const res = await generateDraft(lead.id, currentAngle);
      if (res.ok) {
        const newDraft = res.data;
        setDraftsByAngle((prev) => ({ ...prev, [currentAngle]: newDraft }));
        setEdits((prev) => ({
          ...prev,
          [currentAngle]: { subject: newDraft.subject, body: newDraft.body },
        }));
      } else {
        setErrorMessage(res.error.message);
      }
    } catch {
      setErrorMessage("Request failed. Please try again.");
    } finally {
      setIsRegenerating(false);
    }
  };

  // Handle Approve action
  const handleApprove = async () => {
    if (!canApprove || !currentDraft) return;
    setIsApproving(true);
    setErrorMessage(null);

    try {
      const res = await approveLead(lead.id, {
        draftId: currentDraft.id,
        subject: currentEdit.subject,
        body: currentEdit.body,
      });

      if (res.ok) {
        showToast(`${lead.company.name} enrolled`, { tone: "good" });
        onApproved?.();
        if (resolvedNextLeadHref) {
          router.push(resolvedNextLeadHref);
        } else if (selectedLead?.queueHref) {
          router.push(selectedLead.queueHref);
        } else if (typeof window !== "undefined") {
          const params = new URLSearchParams(window.location.search);
          params.delete("lead");
          const qs = params.toString();
          router.push(qs ? `${pathname}?${qs}` : pathname);
        } else {
          router.push(pathname);
        }
        // No router.refresh() here: pushing a new URL already loads fresh server data, and a
        // refresh fired at the same moment can cancel the push (Safari then reloads the page).
      } else {
        setIsApproving(false);
        const err = res.error;
        setErrorMessage(err.message);

        if (err.code === "checks_failed") {
          if (err.results && err.results.length > 0) {
            setServerCheckResults(err.results);
          }
        } else if (err.code === "already_enrolled" || err.code === "forbidden") {
          showToast(err.message, { tone: "bad" });
          router.refresh();
        }
      }
    } catch {
      setIsApproving(false);
      setErrorMessage(
        "Approval failed. Please check your connection and try again."
      );
    }
  };

  // Keyboard shortcut: ⌘↵ (or Ctrl+Enter) triggers approve while focus is inside editor and button is enabled
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      if (canApprove) {
        e.preventDefault();
        void handleApprove();
      }
    }
  };

  if (!hasAnyDrafts) {
    return (
      <div
        className={cn(
          "rounded-panel border border-dashed border-border bg-surface p-6 text-center text-muted",
          className
        )}
        {...props}
      >
        <p className="text-body font-medium text-text">No drafts yet</p>
        <p className="text-meta text-subtle mt-1">
          The agent will draft this lead on its next run.
        </p>
      </div>
    );
  }

  const isBusy = isLoadingAngle || isRegenerating;

  return (
    <div
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className={cn(
        "rounded-panel border border-border bg-surface p-5 flex flex-col gap-5 outline-none",
        className
      )}
      {...props}
    >
      {/* Header with Angle Picker, Edited badge, and Regenerate button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
        <div className="flex items-center gap-2.5">
          <span className="text-label uppercase tracking-wider font-semibold text-muted">
            Angle
          </span>
          <SegmentedControl
            options={ANGLE_OPTIONS}
            value={currentAngle}
            onChange={handleAngleChange}
            size="sm"
            ariaLabel="Draft angle"
          />
        </div>

        <div className="flex items-center gap-2">
          {isEdited && (
            <Pill tone="neutral" dot={false}>
              Edited
            </Pill>
          )}
          {currentAngle === "raw" && (
            <Pill tone="bad" dot={false}>
              Unconstrained
            </Pill>
          )}
          <Button
            variant="secondary"
            size="sm"
            aria-label="Regenerate draft"
            onClick={handleRegenerate}
            // Unconstrained is generated once and stored; regenerating returns the same draft.
            disabled={isBusy || isApproving || currentAngle === "raw"}
          >
            {isRegenerating ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Regenerating...</span>
              </>
            ) : (
              <>
                <RotateCw className="h-3.5 w-3.5" />
                <span>Regenerate</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Warning message if generation or approval failed */}
      {errorMessage && (
        <div className="rounded-control border border-warn/30 bg-warn/10 p-3 text-meta text-warn flex items-start gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* From / To read-only fields */}
      <div className="flex flex-col gap-2 rounded-control border border-border/60 bg-surface-2/40 p-3">
        <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2 text-meta">
          <span className="text-muted w-14 shrink-0">From:</span>
          <span className="font-mono text-text bg-surface px-2 py-0.5 rounded-control border border-border truncate">
            {workspace.sender.name} at {workspace.sender.fromAddress}
          </span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2 text-meta">
          <span className="text-muted w-14 shrink-0">To:</span>
          <span className="font-mono text-text bg-surface px-2 py-0.5 rounded-control border border-border truncate">
            {lead.contact?.sendAddress ?? "No address"}
          </span>
        </div>
      </div>

      {/* Editor or loading state */}
      {isBusy ? (
        <div className="space-y-3 py-4" aria-busy="true">
          <div className="flex items-center gap-2 text-meta text-muted">
            <Loader2 className="h-4 w-4 animate-spin text-accent" />
            <span>
              {isRegenerating
                ? `Regenerating ${currentAngle === "raw" ? "Unconstrained" : currentAngle} draft...`
                : `Generating ${currentAngle === "raw" ? "Unconstrained" : currentAngle} draft...`}
            </span>
          </div>
          <Skeleton className="h-9 w-full rounded-control" />
          <Skeleton className="h-32 w-full rounded-control" />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Subject field */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="email-subject-input"
              className="text-label uppercase tracking-wider font-semibold text-muted"
            >
              Subject
            </label>
            <Input
              id="email-subject-input"
              value={currentEdit.subject}
              onChange={handleSubjectChange}
              placeholder="Subject line"
              className="font-medium text-body"
            />
          </div>

          {/* Body field */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="email-body-input"
              className="text-label uppercase tracking-wider font-semibold text-muted"
            >
              Body
            </label>
            <Textarea
              id="email-body-input"
              value={currentEdit.body}
              onChange={handleBodyChange}
              placeholder="Email draft body..."
              rows={8}
              className="font-sans text-body min-h-[160px] leading-relaxed"
            />
          </div>
        </div>
      )}

      {/* Live checks list */}
      <div className="flex flex-col gap-2 pt-2 border-t border-border">
        <div className="flex items-center justify-between">
          <span className="text-label uppercase tracking-wider font-semibold text-muted">
            Live checks ({passedChecksCount} of {checkResults.length} passing)
          </span>
        </div>

        <ul className="divide-y divide-border/60 rounded-control border border-border bg-surface text-meta">
          {checkResults.map((checkRes) => {
            const isPass = checkRes.status === "pass";
            const isWarn = checkRes.status === "warn";
            const isFail = checkRes.status === "fail";

            return (
              <li
                key={checkRes.check}
                className="flex items-start justify-between p-2.5 gap-3"
              >
                <div className="flex items-center gap-2 shrink-0">
                  {isPass && (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-good/15 text-good shrink-0">
                      <Check className="h-2.5 w-2.5 stroke-[3]" />
                    </span>
                  )}
                  {isWarn && (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-warn/15 text-warn shrink-0">
                      <AlertTriangle className="h-2.5 w-2.5 stroke-[3]" />
                    </span>
                  )}
                  {isFail && (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-bad/15 text-bad shrink-0">
                      <X className="h-2.5 w-2.5 stroke-[3]" />
                    </span>
                  )}
                  <span className="font-medium text-text truncate">
                    {CHECK_TITLES[checkRes.check] ?? checkRes.check}
                  </span>
                </div>

                {/* Wraps instead of truncating: the grounding message names the phrases found. */}
                <span
                  className={cn(
                    "text-label font-mono text-right min-w-0 break-words",
                    isPass && "text-muted",
                    isWarn && "text-warn font-medium",
                    isFail && "text-bad font-semibold"
                  )}
                  title={checkRes.message}
                >
                  {checkRes.message}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Action bar: Sender stats and Approve and enroll button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-border">
        <div className="flex items-center gap-2 text-meta text-muted">
          <span>
            Sending as {workspace.sender.name} ({workspace.sender.fromAddress})
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="primary"
            aria-label="Approve and enroll"
            onClick={handleApprove}
            disabled={!canApprove}
            className="font-medium"
          >
            {isApproving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-accent-fg" />
                <span>Enrolling...</span>
              </>
            ) : (
              <>
                <span>Approve and enroll</span>
                <Kbd className="bg-accent-fg/15 border-accent-fg/20 text-accent-fg">
                  ⌘↵
                </Kbd>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Collapsibles: Agent trace and Prompt sent to the model */}
      <div className="flex flex-col gap-3 pt-3 border-t border-border">
        {/* Agent trace */}
        <details className="group rounded-control border border-border bg-surface-2/30 p-3">
          <summary className="flex items-center justify-between cursor-pointer select-none text-meta font-medium text-muted hover:text-text">
            <span>Agent trace</span>
            <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180 text-subtle" />
          </summary>
          <div className="mt-3 pt-3 border-t border-border/60 flex flex-col gap-3 text-meta">
            {currentDraft?.trace ? (
              <>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted">Source:</span>
                    <span className="font-mono text-text bg-surface px-1.5 py-0.5 rounded-control border border-border text-label">
                      {currentDraft.trace.source}
                    </span>
                  </div>
                  {currentDraft.trace.promptHash && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-muted">Prompt hash:</span>
                      <span
                        className="font-mono text-text bg-surface px-1.5 py-0.5 rounded-control border border-border text-label truncate max-w-xs"
                        title={currentDraft.trace.promptHash}
                      >
                        {currentDraft.trace.promptHash}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted">Chosen attempt:</span>
                    <span className="font-mono text-text">
                      {currentDraft.trace.chosenAttempt} of{" "}
                      {currentDraft.trace.attempts.length}
                    </span>
                  </div>
                </div>

                {currentDraft.trace.signals.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-label uppercase tracking-wider font-semibold text-muted">
                      Signals in prompt
                    </span>
                    <ul className="flex flex-col gap-1 list-none p-0 m-0">
                      {currentDraft.trace.signals.map((sig, idx) => (
                        <li
                          key={idx}
                          className="flex items-baseline gap-2 text-meta"
                        >
                          <span className="font-mono text-label text-muted px-1.5 py-0.5 rounded-control bg-surface border border-border shrink-0">
                            {sig.label}
                          </span>
                          <span className="text-text truncate">
                            {sig.title}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <span className="text-label uppercase tracking-wider font-semibold text-muted">
                    Generation attempts
                  </span>
                  <div className="flex flex-col gap-2">
                    {currentDraft.trace.attempts.map((att) => {
                      // The agent records every angle, passing ones with an empty list.
                      const failed = Object.entries(att.failedChecks).filter(
                        ([, checks]) => checks.length > 0
                      );
                      return (
                        <div
                          key={att.attempt}
                          className="rounded-control border border-border bg-surface p-2.5 flex flex-col gap-1.5"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 text-label font-mono">
                            <span className="font-semibold text-text">
                              Attempt {att.attempt}
                              {att.attempt ===
                                currentDraft?.trace?.chosenAttempt &&
                                " (selected)"}
                            </span>
                            <div className="flex items-center gap-2 text-muted">
                              {att.model && <span>{att.model}</span>}
                              {att.ms !== null && <span>{att.ms}ms</span>}
                              {att.tokensIn !== null &&
                                att.tokensOut !== null && (
                                  <span>
                                    {att.tokensIn} in / {att.tokensOut} out
                                    tokens
                                  </span>
                                )}
                            </div>
                          </div>

                          {att.error && (
                            <p className="text-meta text-bad">{att.error}</p>
                          )}

                          {failed.length > 0 && (
                            <div className="text-label text-warn">
                              <span>Failed checks: </span>
                              {failed.map(
                                ([angleKey, checks]) => (
                                  <span
                                    key={angleKey}
                                    className="font-mono mr-2"
                                  >
                                    [{angleKey}: {checks.join(", ")}]
                                  </span>
                                )
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {currentDraft.trace.tokensSharedByAngles && (
                  <p className="text-label text-subtle italic">
                    Tokens were shared across all angles generated in this
                    single call.
                  </p>
                )}
              </>
            ) : (
              <p className="text-meta text-subtle">
                No agent trace recorded for this draft.
              </p>
            )}
          </div>
        </details>

        {/* Prompt sent to the model */}
        <details className="group rounded-control border border-border bg-surface-2/30 p-3">
          <summary className="flex items-center justify-between cursor-pointer select-none text-meta font-medium text-muted hover:text-text">
            <span>Prompt sent to the model</span>
            <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180 text-subtle" />
          </summary>
          <div className="mt-3 pt-3 border-t border-border/60">
            {currentDraft?.prompt ? (
              <pre className="font-mono text-meta text-text bg-surface p-3 rounded-control border border-border overflow-x-auto overflow-y-auto max-h-72 whitespace-pre-wrap break-words leading-relaxed">
                {currentDraft.prompt}
              </pre>
            ) : (
              <p className="text-meta text-subtle">
                No prompt recorded for this draft.
              </p>
            )}
          </div>
        </details>
      </div>
    </div>
  );
}
