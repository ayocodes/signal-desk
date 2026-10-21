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

    expect(html).toContain("Agent Rules (Version 1)");
    expect(html).toContain("Save new version");
    expect(html).toContain("Discard changes");
    expect(html).toContain("Ideal Customer Profile (ICP)");
    expect(html).toContain("Hiring Categories");
    expect(html).toContain("Other Buying Signals");
    expect(html).toContain("Queue Threshold");
    expect(html).toContain("Score Calculation");
    expect(html).toContain("Outreach");
    expect(html).toContain("Email Guardrails");
  });

  it("shows 30-minute notice on sections but not on threshold", () => {
    const html = renderToStaticMarkup(
      <AgentRulesEditor config={sampleConfig} />
    );

    expect(html).toContain(
      "Effect shows after the next agent run (every 30 min)"
    );
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
});
