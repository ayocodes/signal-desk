import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LlmBudgetTile } from "./LlmBudgetTile";
import type { LlmBudget } from "@/lib/types";

describe("LlmBudgetTile component", () => {
  const sampleBudget: LlmBudget = {
    used: 7,
    limit: 20,
    agentLimit: 16,
  };

  it("renders AI calls today count, total limit, and agent/app split", () => {
    const html = renderToStaticMarkup(<LlmBudgetTile budget={sampleBudget} />);

    expect(html).toContain("AI calls today:");
    expect(html).toContain("7 of 20");
    expect(html).toContain("agent up to 16, app 4");
    expect(html).toContain("AI budget");
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="7"');
    expect(html).toContain('aria-valuemax="20"');
    expect(html).toContain("35%"); // (7 / 20) * 100
    expect(html).not.toContain("Used up for today");
  });

  it("renders warning message when at the budget limit", () => {
    const atLimitBudget: LlmBudget = {
      used: 20,
      limit: 20,
      agentLimit: 16,
    };

    const html = renderToStaticMarkup(<LlmBudgetTile budget={atLimitBudget} />);

    expect(html).toContain("20 of 20");
    expect(html).toContain("agent up to 16, app 4");
    expect(html).toContain("Used up for today. Resets at 00:00 UTC.");
    expect(html).toContain("100%");
  });

  it("renders warning message when exceeding the budget limit", () => {
    const overLimitBudget: LlmBudget = {
      used: 22,
      limit: 20,
      agentLimit: 16,
    };

    const html = renderToStaticMarkup(
      <LlmBudgetTile budget={overLimitBudget} />
    );

    expect(html).toContain("22 of 20");
    expect(html).toContain("Used up for today. Resets at 00:00 UTC.");
  });
});
