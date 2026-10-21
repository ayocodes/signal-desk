import { describe, expect, it } from "vitest";
import { DEFAULT_RULES } from "@/lib/agent-config";
import { diffRules } from "@/lib/config-diff";
import type { RulesDoc } from "@/lib/rules";

const edit = (change: (doc: RulesDoc) => void): RulesDoc => {
  const doc = structuredClone(DEFAULT_RULES);
  change(doc);
  return doc;
};

describe("diffRules", () => {
  it("says nothing when nothing changed", () => {
    expect(diffRules(DEFAULT_RULES, structuredClone(DEFAULT_RULES))).toEqual([]);
  });

  it("names threshold and points changes with before and after", () => {
    const after = edit((d) => {
      d.threshold = 55;
      d.scoreBands[2].min = 55;
      d.hiring.categories[1].points = 35;
    });
    expect(diffRules(DEFAULT_RULES, after)).toEqual([
      "Threshold 50 → 55",
      "Sales hire points 30 → 35",
      "Score bands Strong 90, Good 70, Borderline 50 → Strong 90, Good 70, Borderline 55",
    ]);
  });

  it("names keyword, category and switch changes", () => {
    const after = edit((d) => {
      d.hiring.categories[1].keywords.push("revops lead");
      d.hiring.categories[2].enabled = true;
      d.hiring.categories[0].name = "Growth marketing hire";
      d.signals.launch.enabled = false;
    });
    expect(diffRules(DEFAULT_RULES, after)).toEqual([
      "Renamed category Marketing hire → Growth marketing hire",
      'Added keyword "revops lead" to Sales hire',
      "Paid acquisition hire turned on",
      "Launch turned off",
    ]);
  });

  it("names added and removed categories and a new order", () => {
    const after = edit((d) => {
      d.hiring.categories = [
        d.hiring.categories[1],
        d.hiring.categories[0],
        { id: "cs", name: "Customer success hire", enabled: true, points: 15, foundingBonus: 0, keywords: ["customer success"], exclusions: [] },
      ];
    });
    expect(diffRules(DEFAULT_RULES, after)).toEqual([
      "Added category Customer success hire (15 points, on)",
      "Removed category Paid acquisition hire",
      "Category order: Sales hire, Marketing hire, Customer success hire",
    ]);
  });

  it("names outreach and guardrail changes", () => {
    const after = edit((d) => {
      d.outreach.senderName = "Alex";
      d.outreach.proofPoints = [...d.outreach.proofPoints.slice(1), "Set up in an afternoon"];
      d.guardrails.maxBodyWords = 90;
      d.guardrails.extraBannedPhrases = ["quick win"];
    });
    expect(diffRules(DEFAULT_RULES, after)).toEqual([
      "Sender name Sam → Alex",
      'Added proof point "Set up in an afternoon"',
      'Removed proof point "Built for teams without a dedicated SDR"',
      "Max body words 80 → 90",
      'Added banned phrase "quick win"',
    ]);
  });
});
