import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AgentRulesEditor } from "./AgentRulesEditor";
import type { CurrentRules } from "@/lib/types";
import defaults from "@/shared/defaults/rules.json";
import type { RulesDoc } from "@/lib/rules";

vi.mock("@/lib/api", () => ({
  previewThreshold: vi.fn(),
  saveAgentConfig: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  usePathname: () => "/settings/agent",
}));

describe("AgentRulesEditor", () => {
  const sampleConfig: CurrentRules = {
    version: 1,
    rules: defaults as RulesDoc,
    savedBy: { id: "u-1", name: "Admin User" },
    savedAt: "2026-10-21T12:00:00Z",
    problem: null,
    builtInBannedPhrases: ["I hope this email finds you well", "synergy"],
    maxPossibleScore: 152,
  };

  it("renders all sections and action bar", () => {
    const html = renderToStaticMarkup(
      <AgentRulesEditor config={sampleConfig} />
    );

    expect(html).toContain("Agent rules, version 1");
    expect(html).toContain("Reset to defaults");
    expect(html).toContain("Save new version");
    expect(html).toContain("Discard changes");
    expect(html).toContain("Ideal customer profile (ICP)");
    expect(html).toContain("Hiring categories");
    expect(html).toContain("Other buying signals");
    expect(html).toContain("Queue threshold");
    expect(html).toContain("Score calculation");
    expect(html).toContain("Outreach");
    expect(html).toContain("Email guardrails");
  });

  it("shows applies-to-queue notice on sections but not on threshold", () => {
    const html = renderToStaticMarkup(
      <AgentRulesEditor config={sampleConfig} />
    );

    expect(html).toContain("Applies to the queue after saving");
    expect(html).not.toContain("Effect shows after the next agent run");
  });

  it("explains that category order matters and the first match wins", () => {
    const html = renderToStaticMarkup(
      <AgentRulesEditor config={sampleConfig} />
    );

    expect(html).toContain(
      "Categories are checked in order; the first match wins."
    );
  });

  it("displays locked guardrail rows and reasons", () => {
    const html = renderToStaticMarkup(
      <AgentRulesEditor config={sampleConfig} />
    );

    expect(html).toContain("Grounding:");
    expect(html).toContain("every email must quote a real signal");
    expect(html).toContain("Invented facts:");
    expect(html).toContain(
      "numbers and customer claims must come from the signals or proof points"
    );
    expect(html).toContain("No em or en dashes:");
    expect(html).toContain("house style for every email");
  });

  it("renders built-in banned phrases as read-only chips", () => {
    const html = renderToStaticMarkup(
      <AgentRulesEditor config={sampleConfig} />
    );

    expect(html).toContain("I hope this email finds you well");
    expect(html).toContain("synergy");
  });

  it("names every problem above the form, including ones inside lists", () => {
    const rules = structuredClone(defaults) as RulesDoc;
    rules.outreach.proofPoints[0] = "Used by 40 teams";
    const html = renderToStaticMarkup(<AgentRulesEditor config={{ ...sampleConfig, rules }} />);
    expect(html).toContain("Fix these before saving:");
    expect(html).toContain("outreach.proofPoints.0");
    expect(html).toContain("Proof points cannot contain digits (numbers).");
  });

  it("says when the org is on the defaults", () => {
    const html = renderToStaticMarkup(<AgentRulesEditor config={{ ...sampleConfig, version: 0 }} />);
    expect(html).toContain("Agent rules, defaults");
  });

  it("renders version history section when versions are provided", () => {
    const versions = [
      {
        version: 1,
        savedBy: null,
        savedAt: "2026-10-21T10:00:00Z",
        changeSummary: [],
        isCurrent: true,
        restoredFrom: null,
        sameRulesAs: null,
      },
    ];
    const html = renderToStaticMarkup(
      <AgentRulesEditor config={sampleConfig} versions={versions} />
    );
    expect(html).toContain("Version history");
    expect(html).toContain("First version, from the defaults");
  });

  it("shows the apply status as toasts, not as a card in the page", () => {
    // The toasts come from an effect (browser only); the server render must not include them.
    const html = renderToStaticMarkup(
      <AgentRulesEditor config={sampleConfig} initialApplyingVersion={2} initialApplyStart="dispatched" />
    );
    expect(html).not.toContain("Applying your changes...");
    expect(html).not.toContain('data-testid="apply-status"');
  });
});
