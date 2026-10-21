"use client";

import * as React from "react";
import { AlertCircle, AlertTriangle, Check, Loader2, X } from "lucide-react";
import {
  Input,
  Pill,
  SegmentedControl,
  type SegmentedControlOption,
  Skeleton,
  Textarea,
} from "@/components/ui";
import { cn } from "@/components/ui/utils";
import { generateDraft } from "@/lib/api";
import {
  runGuardrails,
  type CheckName,
} from "@/lib/guardrails";
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
  className,
  ...props
}: EmailEditorProps) {
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
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

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
          // Show error message as is
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
    setEdits((prev) => ({
      ...prev,
      [currentAngle]: {
        subject: prev[currentAngle]?.subject ?? currentDraft?.subject ?? "",
        body: value,
      },
    }));
  };

  // Run live guardrails on current subject and body
  const checkResults = React.useMemo(() => {
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

  const passedChecksCount = checkResults.filter(
    (c) => c.status === "pass"
  ).length;

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

  return (
    <div
      className={cn(
        "rounded-panel border border-border bg-surface p-5 flex flex-col gap-5",
        className
      )}
      {...props}
    >
      {/* Header with Angle Picker and Edited badge */}
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
        </div>
      </div>

      {/* Warning message if generation failed or budget exhausted */}
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
      {isLoadingAngle ? (
        <div className="space-y-3 py-4" aria-busy="true">
          <div className="flex items-center gap-2 text-meta text-muted">
            <Loader2 className="h-4 w-4 animate-spin text-accent" />
            <span>Generating Unconstrained draft...</span>
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
                className="flex items-center justify-between p-2.5 gap-3"
              >
                <div className="flex items-center gap-2 min-w-0">
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

                <span
                  className={cn(
                    "text-label font-mono text-right shrink-0 max-w-[65%] truncate",
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
    </div>
  );
}
