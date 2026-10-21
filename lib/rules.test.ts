// Runs every shared rules case; agent/tests/test_rules.py runs the same file and must agree.
import { describe, expect, it } from "vitest";
import { maxPossibleScore, validateRules, type RulesDoc } from "@/lib/rules";
import defaults from "@/shared/defaults/rules.json";
import fixtures from "@/shared/fixtures/config_cases.json";

type Op = { op: "set" | "delete" | "replace"; path?: string; value?: unknown };
type Case = { name: string; ops: Op[]; errors: { path: string; code: string }[] };

function apply(ops: Op[]): unknown {
  let doc: unknown = structuredClone(defaults);
  for (const op of ops) {
    if (op.op === "replace") {
      doc = op.value;
      continue;
    }
    const keys = op.path!.split(".");
    const last = keys.pop()!;
    let target = doc as Record<string, unknown>;
    for (const key of keys) target = target[key] as Record<string, unknown>;
    if (op.op === "set") target[last] = op.value;
    else delete target[last];
  }
  return doc;
}

describe("rules: shared cases", () => {
  it.each((fixtures.cases as Case[]).map((c) => [c.name, c] as const))("%s", (_name, c) => {
    expect(validateRules(apply(c.ops))).toEqual(c.errors);
  });
});

describe("rules", () => {
  it("allows at most 152 points with the defaults", () => {
    expect(maxPossibleScore(defaults as RulesDoc)).toBe(152);
  });
});
