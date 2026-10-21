// Reads the prompt templates (shared/prompts/*.md) once per server process.
// next.config.ts makes Vercel include these files with the API routes.
import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { PromptTemplates } from "@/lib/prompts";

let templates: Promise<PromptTemplates> | null = null;

function read(name: string): Promise<string> {
  return readFile(join(process.cwd(), "shared", "prompts", name), "utf8");
}

export function promptTemplates(): Promise<PromptTemplates> {
  templates ??= Promise.all([read("draft.md"), read("raw.md")]).then(([draft, raw]) => ({ draft, raw }));
  return templates;
}
