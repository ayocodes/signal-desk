import * as React from "react";
import Link from "next/link";
import { CheckCircle2, ShieldCheck, Sparkles, Target } from "lucide-react";
import { buttonClassName } from "@/components/ui/button-styles";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/Panel";
import { Pill } from "@/components/ui/Pill";
import type { CurrentRules } from "@/lib/types";

export interface AgentRulesViewProps {
  config: CurrentRules;
  isAdmin: boolean;
}

export function formatIcpSentence(rules: CurrentRules["rules"]): string {
  const statusStr = rules.icp.status.toLowerCase();
  const b2bStr = rules.icp.b2b ? "B2B" : "software";
  return `We look for ${statusStr} ${b2bStr} startups with ${rules.icp.teamSizeMin} to ${rules.icp.teamSizeMax} people from YC batches in the last ${rules.icp.maxBatchAgeYears} years.`;
}

export function formatPartialIcpSentence(rules: CurrentRules["rules"]): string {
  return `Startups with ${rules.partial.teamSizeMin} to ${rules.partial.teamSizeMax} people or batches up to ${rules.partial.maxBatchAgeYears} years qualify for partial ICP (${rules.icp.points.partial} points instead of ${rules.icp.points.full}).`;
}

export function formatHiringSentence(rules: CurrentRules["rules"]): string {
  const enabled = [...rules.hiring.categories]
    .filter((c) => c.enabled)
    .sort((a, b) => b.points - a.points);

  if (enabled.length === 0) return "No hiring categories are currently active.";

  const parts = enabled.map((cat, idx) => {
    const article = /^[aeiou]/i.test(cat.name)
      ? idx === 0
        ? "An "
        : "an "
      : idx === 0
        ? "A "
        : "a ";
    let text = `${article}${cat.name} adds ${cat.points}`;
    if (idx === 0) text += " points";
    if (cat.foundingBonus > 0) {
      text += ` (${cat.points + cat.foundingBonus} for a founding role)`;
    }
    return text;
  });

  return parts.join("; ") + ".";
}

export function formatDisabledHiringSentence(
  rules: CurrentRules["rules"]
): string | null {
  const disabled = rules.hiring.categories.filter((c) => !c.enabled);
  if (disabled.length === 0) return null;

  const names = disabled.map((c) => {
    if (c.name.toLowerCase().endsWith("hire")) {
      return `${c.name}s`;
    }
    return `${c.name} roles`;
  });

  return `${names.join(" and ")} don't count right now.`;
}

export function formatThresholdSentence(rules: CurrentRules["rules"]): string {
  // Only signals that are switched on and not "weak" can qualify a lead on their own.
  const weak = new Set<string>(rules.weakSignalTypes);
  const strong = [
    rules.hiring.categories.some((c) => c.enabled) && !weak.has("hiring") ? "hiring" : null,
    rules.signals.launch.enabled && !weak.has("launch") ? "launch" : null,
    rules.signals.ycRecent.enabled && !weak.has("funding") ? "recent YC batch" : null,
  ].filter((name): name is string => name !== null);
  return `A lead reaches your queue at ${rules.threshold} points with at least one ${strong.join(" or ")} signal.`;
}

const span = (hours: number) => (hours < 48 ? `${hours} hours` : `${Math.round(hours / 24)} days`);

export function formatFreshnessSentence(rules: CurrentRules["rules"]): string {
  const first = rules.freshness[0];
  const last = rules.freshness[rules.freshness.length - 1];
  return `A signal under ${span(first.maxHours)} old adds ${first.points} points for freshness, less as it ages, and nothing after ${span(last.maxHours)}.`;
}

export function formatScoreBandsSentence(rules: CurrentRules["rules"]): string {
  const sorted = [...rules.scoreBands].sort((a, b) => b.min - a.min);
  return sorted.map((b) => `${b.min} or more is ${b.label}`).join(", ") + ".";
}

function formatSavedDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return isoString;
  }
}

export function AgentRulesView({ config, isAdmin }: AgentRulesViewProps) {
  const { rules } = config;
  const hiringSentence = formatHiringSentence(rules);
  const disabledHiringSentence = formatDisabledHiringSentence(rules);
  const icpSentence = formatIcpSentence(rules);
  const partialIcpSentence = formatPartialIcpSentence(rules);
  const thresholdSentence = formatThresholdSentence(rules);
  const scoreBandsSentence = formatScoreBandsSentence(rules);

  const savedDateText = config.savedAt
    ? `Saved ${formatSavedDate(config.savedAt)}${config.savedBy ? ` by ${config.savedBy.name}` : ""}`
    : "Running on default rules";

  return (
    <div className="flex flex-col gap-6">
      {/* Overview header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-section font-semibold text-text tracking-tight">
              What our agent looks for
            </h2>
            <Pill tone="neutral" dot={false}>
              Version {config.version}
            </Pill>
          </div>
          <p className="text-meta text-muted">
            {savedDateText} · Max score {config.maxPossibleScore} pts
          </p>
        </div>

        {isAdmin && (
          <div className="shrink-0">
            <Link
              href="/settings/agent"
              className={buttonClassName({ variant: "secondary", size: "sm" })}
            >
              Edit rules
            </Link>
          </div>
        )}
      </div>

      {config.problem && (
        <div className="rounded-control border border-warn/30 bg-warn/10 p-3 text-meta text-warn">
          Using default rules: {config.problem}
        </div>
      )}

      {/* ICP Panel */}
      <Panel>
        <PanelHeader
          title={
            <span className="flex items-center gap-2">
              <Target className="h-4 w-4 text-accent" />
              <span>Ideal customer profile</span>
            </span>
          }
          description="Target company profile and qualification criteria"
        />
        <PanelBody className="flex flex-col gap-3">
          <p className="text-body font-medium text-text">{icpSentence}</p>
          <p className="text-meta text-muted">{partialIcpSentence}</p>
        </PanelBody>
      </Panel>

      {/* Hiring & Buying Signals Panel */}
      <Panel>
        <PanelHeader
          title={
            <span className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-accent" />
              <span>Buying signals</span>
            </span>
          }
          description="Roles and company events that trigger outbound"
        />
        <PanelBody className="flex flex-col gap-4">
          <div>
            <p className="text-body font-medium text-text">{hiringSentence}</p>
            <p className="text-meta text-muted mt-1.5">
              Hiring categories are checked in order: the first matching role wins.
            </p>
            {disabledHiringSentence && (
              <p className="text-meta text-subtle mt-1.5">
                {disabledHiringSentence}
              </p>
            )}
          </div>

          <div className="pt-3 border-t border-border flex flex-col gap-1.5 text-meta text-muted">
            <p>
              {rules.signals.launch.enabled
                ? `A Launch post adds ${rules.signals.launch.points} points.`
                : "Launch signals are currently off."}
            </p>
            <p>
              {rules.signals.ycRecent.enabled
                ? `A recent YC batch adds ${rules.signals.ycRecent.points} points.`
                : "Recent YC batch signals are currently off."}
            </p>
            <p>{formatFreshnessSentence(rules)}</p>
            <p>
              Each additional signal type adds {rules.stackedPerExtraSignalType}{" "}
              points.
            </p>
          </div>
        </PanelBody>
      </Panel>

      {/* Threshold & Bands Panel */}
      <Panel>
        <PanelHeader
          title={
            <span className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-accent" />
              <span>Queue threshold and score bands</span>
            </span>
          }
          description="Point thresholds required to route leads to reps"
        />
        <PanelBody className="flex flex-col gap-3">
          <p className="text-body font-medium text-text">{thresholdSentence}</p>
          <p className="text-meta text-muted">{scoreBandsSentence}</p>
        </PanelBody>
      </Panel>

      {/* Outreach & Guardrails Panel */}
      <Panel>
        <PanelHeader
          title={
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-accent" />
              <span>Outreach and grounding</span>
            </span>
          }
          description="Offer positioning and email verification guardrails"
        />
        <PanelBody className="flex flex-col gap-4">
          <div>
            <p className="text-body font-medium text-text">
              Emails are sent by {rules.outreach.senderName}.
            </p>
            <p className="text-meta text-muted mt-1.5">
              <span className="font-medium text-text">Offer:</span>{" "}
              {rules.outreach.offer}
            </p>
          </div>

          {rules.outreach.proofPoints.length > 0 && (
            <div className="pt-3 border-t border-border">
              <span className="text-label uppercase tracking-wider text-muted font-mono block mb-2">
                Approved proof points emails may use:
              </span>
              <ul className="list-disc list-inside space-y-1 text-meta text-muted">
                {rules.outreach.proofPoints.map((point, idx) => (
                  <li key={idx}>{point}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="pt-3 border-t border-border flex flex-col gap-1.5 text-meta text-muted">
            <span className="text-label uppercase tracking-wider text-muted font-mono block mb-1">
              Guardrails:
            </span>
            <p>
              Length: emails are kept concise, capped at{" "}
              {rules.guardrails.maxBodyWords} words.
            </p>
            <p>
              Grounding: every email must quote a real signal from the lead.
            </p>
            <p>
              Invented facts: numbers and claims must come directly from signals
              or approved proof points.
            </p>
            <p>Style: no em or en dashes.</p>
          </div>
        </PanelBody>
      </Panel>
    </div>
  );
}
