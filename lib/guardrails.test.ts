// Runs every shared guardrail case; agent/tests/test_guardrails.py runs the same file and must agree.
import { describe, expect, it } from "vitest";
import { getAgentConfig } from "@/lib/agent-config";
import { contains, guardrailRules, passed, runGuardrails, type GuardrailInput } from "@/lib/guardrails";
import fixtures from "@/shared/fixtures/guardrails_cases.json";

type Case = {
  name: string;
  input: GuardrailInput;
  proofPoints?: string[];
  expect: Record<string, string>;
  passed: boolean;
};

const cases = fixtures.cases as Case[];
const rules = guardrailRules(await getAgentConfig("any-org"));

describe("guardrails: shared cases", () => {
  it.each(cases.map((c) => [c.name, c] as const))("%s", (_name, c) => {
    const results = runGuardrails(c.input, c.proofPoints ? { ...rules, proofPoints: c.proofPoints } : rules);
    for (const [check, expected] of Object.entries(c.expect)) {
      const r = results.find((x) => x.check === check);
      expect({ check, status: r?.status, message: r?.message }).toMatchObject({ check, status: expected });
    }
    expect(passed(results)).toBe(c.passed);
  });
});

describe("guardrails", () => {
  it("runs every check in a fixed order", () => {
    expect(runGuardrails(cases[0].input, rules).map((r) => r.check)).toEqual([
      "angle", "grounding", "banned_chars", "banned_phrases", "word_count",
      "closing_question", "numbers", "claims", "placeholders", "subject",
    ]);
  });

  it("names the grounded phrases it found", () => {
    const grounding = runGuardrails(cases[0].input, rules).find((r) => r.check === "grounding");
    expect(grounding?.message).toBe('Grounded: "Founding Account Executive", "outbound motion from scratch"');
  });

  it("never prints a dash character in a message", () => {
    const input: GuardrailInput = {
      angle: "signal",
      subject: "Hi",
      body: "Saw the Founding Account Executive role — worth a chat?",
      groundedPhrases: ["Founding Account Executive"],
      signals: [{ title: "Founding Account Executive", excerpt: null }],
    };
    expect(runGuardrails(input, rules).find((r) => r.check === "banned_chars")?.message).toBe("Contains an em dash");
  });

  it("matches whole phrases only", () => {
    expect(contains("Our Sales team", "sales")).toBe(true);
    expect(contains("Salesforce admin", "sales")).toBe(false);
    expect(contains("build the outbound\n motion", "outbound motion")).toBe(true);
    expect(contains("anything", "   ")).toBe(false);
  });
});
