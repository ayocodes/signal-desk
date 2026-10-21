// Fills in the prompt templates (shared/prompts/*.md) for one lead.
// The TypeScript twin of agent/prompts.py: both must produce the exact same text for the same
// facts, so a stored prompt hash means the same thing everywhere. Both suites run
// shared/fixtures/prompt_cases.json. Templates are passed in (read on the server by
// lib/prompt-templates.ts), which keeps this file pure.
import { createHash } from "node:crypto";
import type { AgentConfig } from "@/lib/agent-config";

export type PromptTemplates = { draft: string; raw: string };

export type PromptFacts = {
  companyName: string;
  domain: string;
  description: string | null;
  contact: { name: string; title: string | null; isPlaceholder: boolean } | null;
  /** Strongest first. */
  signals: { type: string; category: string | null; title: string; excerpt: string | null; sourceName: string }[];
};

const UNFILLED = /\{\{\w+\}\}/g;

/** The same words the UI uses (components/leads/SignalCard.tsx signalLabel). */
function signalLabel(signal: PromptFacts["signals"][number]): string {
  if (signal.type === "hiring") return signal.category === "marketing" ? "Marketing hire" : "Hiring";
  if (signal.type === "launch") return "Launch";
  return "YC recent";
}

function contactLine(contact: PromptFacts["contact"]): string {
  if (!contact || contact.isPlaceholder) return 'the founder (name unknown; open with "Hi there,")';
  return contact.title ? `${contact.name}, ${contact.title}` : contact.name;
}

function signalLines(signals: PromptFacts["signals"]): string {
  if (signals.length === 0) return "None found.";
  return signals
    .map((s, i) => {
      const lines = [`${i + 1}. ${signalLabel(s)}: ${s.title.trim()}`];
      if (s.excerpt?.trim()) lines.push(`   Excerpt: ${s.excerpt.trim()}`);
      lines.push(`   Source: ${s.sourceName}`);
      return lines.join("\n");
    })
    .join("\n");
}

function fill(template: string, values: Record<string, string>): string {
  let text = template;
  for (const [key, value] of Object.entries(values)) text = text.replaceAll(`{{${key}}}`, value);
  const left = text.match(UNFILLED);
  if (left) throw new Error(`Prompt template has unknown placeholders: ${[...new Set(left)].sort().join(", ")}`);
  return text;
}

function common(facts: PromptFacts, config: AgentConfig): Record<string, string> {
  const { sender, offer } = config.outreach;
  return {
    sender_name: sender.name,
    sender_company: sender.company,
    offer,
    contact: contactLine(facts.contact),
    company: facts.companyName,
  };
}

export function renderDraftPrompt(facts: PromptFacts, config: AgentConfig, templates: PromptTemplates): string {
  const out = config.outreach;
  return fill(templates.draft, {
    ...common(facts, config),
    proof_points: out.proofPoints.map((point) => `- ${point}`).join("\n"),
    company_line: facts.domain ? `${facts.companyName} (${facts.domain})` : facts.companyName,
    company_description: facts.description?.trim() || "Not known.",
    signals: signalLines(facts.signals.slice(0, out.maxSignalsInPrompt)),
    angles: `- signal: ${out.angles.signal}\n- peer: ${out.angles.peer}\n- short: ${out.angles.short}`,
    max_words: String(config.guardrails.maxBodyWords),
    banned_phrases: config.guardrails.bannedPhrases.map((p) => `"${p}"`).join(", "),
  });
}

/** The unconstrained baseline: offer and company only, no signals and no rules. */
export function renderRawPrompt(facts: PromptFacts, config: AgentConfig, templates: PromptTemplates): string {
  return fill(templates.raw, common(facts, config));
}

export function promptHash(prompt: string): string {
  return createHash("sha256").update(prompt, "utf8").digest("hex");
}
