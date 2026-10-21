import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import defaultRulesJson from "@/shared/defaults/rules.json";
import type { CurrentRules } from "@/lib/types";
import { AgentRulesView } from "./AgentRulesView";

const mockConfig: CurrentRules = {
  version: 1,
  rules: defaultRulesJson as unknown as CurrentRules["rules"],
  savedBy: { id: "u1", name: "Alice Admin" },
  savedAt: "2026-10-21T12:00:00Z",
  problem: null,
  builtInBannedPhrases: ["guarantee", "risk-free"],
  maxPossibleScore: 100,
};

describe("AgentRulesView", () => {
  it("renders plain-language sentences for all rules", () => {
    const html = renderToStaticMarkup(
      <AgentRulesView config={mockConfig} isAdmin={false} />
    );

    // ICP
    expect(html).toContain(
      "We look for active B2B startups with 5 to 60 people from YC batches in the last 3 years."
    );

    // Hiring categories
    expect(html).toContain(
      "A Sales hire adds 30 points (35 for a founding role); a Marketing hire adds 20."
    );
    expect(html).toContain("Paid acquisition hires don&#x27;t count right now.");
    expect(html).toContain("Hiring categories are checked in order: the first matching role wins.");

    // Queue threshold
    expect(html).toContain(
      "A lead reaches your queue at 50 points with at least one hiring or launch signal."
    );

    // Score bands
    expect(html).toContain(
      "90 or more is Strong, 70 or more is Good, 50 or more is Borderline."
    );

    // Offer and proof points
    expect(html).toContain("an AI outbound platform for early-stage B2B teams");
    expect(html).toContain("Built for teams without a dedicated SDR");
    expect(html).toContain("Every first email is approved by a person before it sends");

    // Version
    expect(html).toContain("Version 1");
  });

  it("shows Edit rules link for admin", () => {
    const html = renderToStaticMarkup(
      <AgentRulesView config={mockConfig} isAdmin={true} />
    );

    expect(html).toContain('href="/settings/agent"');
    expect(html).toContain("Edit rules");
  });

  it("does not show Edit rules link for rep", () => {
    const html = renderToStaticMarkup(
      <AgentRulesView config={mockConfig} isAdmin={false} />
    );

    expect(html).not.toContain('href="/settings/agent"');
    expect(html).not.toContain("Edit rules");
  });
});
