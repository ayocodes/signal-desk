import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { THEMES } from "./themes";

// WCAG 2.1 relative luminance and contrast ratio calculations.
function parseHex(hex: string): [number, number, number] {
  const clean = hex.replace("#", "").trim();
  if (clean.length === 3) {
    return [
      parseInt(clean[0] + clean[0], 16),
      parseInt(clean[1] + clean[1], 16),
      parseInt(clean[2] + clean[2], 16),
    ];
  }
  if (clean.length === 6) {
    return [
      parseInt(clean.slice(0, 2), 16),
      parseInt(clean.slice(2, 4), 16),
      parseInt(clean.slice(4, 6), 16),
    ];
  }
  throw new Error(`Invalid hex color: "${hex}"`);
}

function srgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function relativeLuminance(r: number, g: number, b: number): number {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

function getContrastRatio(hex1: string, hex2: string): number {
  const [r1, g1, b1] = parseHex(hex1);
  const [r2, g2, b2] = parseHex(hex2);
  const l1 = relativeLuminance(r1, g1, b1);
  const l2 = relativeLuminance(r2, g2, b2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

interface ThemeTokens {
  [token: string]: string;
}

function parseThemesCss(css: string): Map<string, ThemeTokens> {
  const themes = new Map<string, ThemeTokens>();
  const blockRegex = /([^{]+)\{([^}]+)\}/g;
  let match: RegExpExecArray | null;

  while ((match = blockRegex.exec(css)) !== null) {
    const selector = match[1];
    const body = match[2];

    const themeMatch = selector.match(/\[data-theme="([^"]+)"\]/);
    if (!themeMatch) continue;

    const themeId = themeMatch[1];
    const tokens: ThemeTokens = {};

    for (const line of body.split("\n")) {
      const declMatch = line.trim().match(/^(--[\w-]+)\s*:\s*([^;]+);/);
      if (declMatch) {
        tokens[declMatch[1]] = declMatch[2].trim();
      }
    }

    themes.set(themeId, tokens);
  }

  return themes;
}

const css = readFileSync(new URL("../app/themes.css", import.meta.url), "utf-8");
const parsedThemes = parseThemesCss(css);

const REQUIRED_TOKENS = [
  "--bg",
  "--surface",
  "--surface-2",
  "--border",
  "--border-strong",
  "--text",
  "--text-muted",
  "--text-subtle",
  "--accent",
  "--accent-fg",
  "--accent-soft",
  "--good",
  "--warn",
  "--bad",
  "--signal",
] as const;

const CONTRAST_PAIRS = [
  { fg: "--text", bg: "--bg" },
  { fg: "--text", bg: "--surface" },
  { fg: "--text-muted", bg: "--bg" },
  { fg: "--accent-fg", bg: "--accent" },
] as const;

describe("Theme contrast and tokens", () => {
  it("defines every theme listed in lib/themes.ts", () => {
    for (const { id } of THEMES) {
      expect(
        parsedThemes.has(id),
        `Theme "${id}" is missing from app/themes.css`
      ).toBe(true);
    }
  });

  for (const { id: themeId, label } of THEMES) {
    describe(`${label} (${themeId})`, () => {
      it("defines all required tokens", () => {
        const tokens = parsedThemes.get(themeId);
        expect(tokens, `Theme "${themeId}" is not defined in app/themes.css`).toBeDefined();
        for (const token of REQUIRED_TOKENS) {
          expect(
            tokens?.[token],
            `Theme "${themeId}" is missing token "${token}"`
          ).toBeDefined();
        }
      });

      for (const pair of CONTRAST_PAIRS) {
        it(`satisfies WCAG AA (>= 4.5:1) for ${pair.fg} on ${pair.bg}`, () => {
          const tokens = parsedThemes.get(themeId);
          expect(tokens, `Theme "${themeId}" is not defined`).toBeDefined();

          const fgColor = tokens?.[pair.fg];
          const bgColor = tokens?.[pair.bg];

          expect(fgColor, `Theme "${themeId}" missing token ${pair.fg}`).toBeDefined();
          expect(bgColor, `Theme "${themeId}" missing token ${pair.bg}`).toBeDefined();

          const contrast = getContrastRatio(fgColor!, bgColor!);
          expect(
            contrast,
            `Theme "${themeId}" failed contrast check for ${pair.fg} on ${pair.bg}: got ${contrast.toFixed(2)}:1, expected at least 4.5:1`
          ).toBeGreaterThanOrEqual(4.5);
        });
      }
    });
  }
});
