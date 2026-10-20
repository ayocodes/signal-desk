// Enforces "use the design tokens, never raw colors" (AGENTS.md, docs/DESIGN.md).
// Tailwind's default palette is switched off in app/globals.css, so a class like bg-black
// silently renders nothing. This catches it in `npm run check` instead of in the browser.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..");
const SCAN_DIRS = ["app", "components"];

const DEFAULT_PALETTE =
  "black|white|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const PALETTE_CLASS = new RegExp(
  `\\b(?:bg|text|border|ring|ring-offset|outline|fill|stroke|from|via|to|divide|placeholder|decoration|shadow|accent|caret)-(?:${DEFAULT_PALETTE})(?:-\\d{2,3})?(?:\\/\\d+)?\\b`,
  "g",
);
const RAW_HEX = /#[0-9a-fA-F]{3,8}\b/g;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(tsx|ts)$/.test(name) && !name.endsWith(".test.ts") && !name.endsWith(".test.tsx") ? [path] : [];
  });
}

const files = SCAN_DIRS.flatMap((dir) => sourceFiles(join(ROOT, dir)));

describe("design tokens", () => {
  it("finds source files to scan", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("uses no Tailwind default-palette colors (they render nothing here)", () => {
    const hits = files.flatMap((file) =>
      [...readFileSync(file, "utf-8").matchAll(PALETTE_CLASS)].map((m) => `${relative(ROOT, file)}: ${m[0]}`),
    );
    expect(hits, `Use theme tokens instead (bg-bg, text-muted, bg-surface-2, ...):\n${hits.join("\n")}`).toEqual([]);
  });

  it("uses no raw hex colors outside app/themes.css", () => {
    const hits = files.flatMap((file) =>
      [...readFileSync(file, "utf-8").matchAll(RAW_HEX)].map((m) => `${relative(ROOT, file)}: ${m[0]}`),
    );
    expect(hits, `Raw colors belong only in app/themes.css:\n${hits.join("\n")}`).toEqual([]);
  });
});
