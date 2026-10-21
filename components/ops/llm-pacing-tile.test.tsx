import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LlmPacingTile } from "./LlmPacingTile";
import type { LlmPacing } from "@/lib/types";

describe("LlmPacingTile component", () => {
  const samplePacing: LlmPacing = {
    draftsPerRun: 8,
    agentShare: 0.8,
    maxRetriesPerLead: 2,
    minSecondsBetweenCalls: 3,
    regeneratePerUserPerHour: 10,
  };

  it("renders all pacing values and deploy note", () => {
    const html = renderToStaticMarkup(<LlmPacingTile pacing={samplePacing} />);

    expect(html).toContain("LLM pacing");
    expect(html).toContain("Drafts per run");
    expect(html).toContain("8");
    expect(html).toContain("Agent budget share");
    expect(html).toContain("80%");
    expect(html).toContain("Retries per lead");
    expect(html).toContain("2");
    expect(html).toContain("Between calls");
    expect(html).toContain("3s");
    expect(html).toContain("Regenerate limit");
    expect(html).toContain("10 / user / hr");
    expect(html).toContain(
      "Deploy settings: change them in the environment, not here."
    );
  });

  it("handles null draftsPerRun gracefully", () => {
    const pacingWithoutRuns: LlmPacing = {
      ...samplePacing,
      draftsPerRun: null,
    };

    const html = renderToStaticMarkup(
      <LlmPacingTile pacing={pacingWithoutRuns} />
    );

    expect(html).toContain("Drafts per run");
    expect(html).toContain("None yet");
  });
});
