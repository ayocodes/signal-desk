import { describe, expect, it } from "vitest";
import { defaultConfig } from "@/lib/agent-config";
import { BRAND_NAME } from "@/lib/brand";

describe("agent config", () => {
  it("sends as the product brand, so a rename in lib/brand.ts can't leave old drafts behind", async () => {
    const cfg = defaultConfig();
    expect(cfg.outreach.sender.company).toBe(BRAND_NAME);
  });

  it("keeps proof points free of numbers (a number in a draft must come from a signal)", async () => {
    const cfg = defaultConfig();
    for (const point of cfg.outreach.proofPoints) expect(point).not.toMatch(/\d/);
  });

  it("starts every sequence with the opening email on day 0", async () => {
    const cfg = defaultConfig();
    expect(cfg.sequence.steps[0]).toEqual({ key: "d1_open", dayOffset: 0 });
    const offsets = cfg.sequence.steps.map((step) => step.dayOffset);
    expect(offsets).toEqual([...offsets].sort((a, b) => a - b));
  });
});
