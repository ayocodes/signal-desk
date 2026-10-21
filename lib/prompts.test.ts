// Runs every shared prompt case; agent/tests/test_prompts.py runs the same file and must agree.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { defaultConfig } from "@/lib/agent-config";
import { promptHash, renderDraftPrompt, renderRawPrompt, type PromptFacts } from "@/lib/prompts";
import fixtures from "@/shared/fixtures/prompt_cases.json";

type Case = { name: string; kind: "draft" | "raw"; facts: PromptFacts; expected: string };

const cases = fixtures.cases as Case[];
const config = defaultConfig();
const read = (name: string) => readFileSync(join(process.cwd(), "shared", "prompts", name), "utf8");
const templates = { draft: read("draft.md"), raw: read("raw.md") };

describe("prompts: shared cases", () => {
  it.each(cases.map((c) => [c.name, c] as const))("%s", (_name, c) => {
    const render = c.kind === "draft" ? renderDraftPrompt : renderRawPrompt;
    expect(render(c.facts, config, templates)).toBe(c.expected);
  });
});

describe("prompts", () => {
  it("hashes with sha256, like the agent", () => {
    expect(promptHash("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("refuses a template with an unknown placeholder", () => {
    const facts = cases[0].facts;
    expect(() => renderRawPrompt(facts, config, { ...templates, raw: "Hello {{nobody}}" })).toThrow(/unknown placeholders/);
  });
});
