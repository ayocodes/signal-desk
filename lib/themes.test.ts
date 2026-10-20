import { describe, expect, it } from "vitest";
import { isThemeId, resolveTheme, THEME_CHOICES, THEME_INIT_SCRIPT, THEMES } from "./themes";

describe("resolveTheme", () => {
  it("returns a concrete theme unchanged", () => {
    expect(resolveTheme("midnight", true)).toBe("midnight");
    expect(resolveTheme("mist", true)).toBe("mist");
  });

  it("maps System to Paper (light) or Graphite (dark)", () => {
    expect(resolveTheme("system", false)).toBe("paper");
    expect(resolveTheme("system", true)).toBe("graphite");
  });
});

describe("isThemeId", () => {
  it("accepts every listed choice and rejects anything else", () => {
    for (const choice of THEME_CHOICES) expect(isThemeId(choice.id)).toBe(true);
    expect(isThemeId("solarized")).toBe(false);
    expect(isThemeId(null)).toBe(false);
  });
});

describe("THEME_INIT_SCRIPT", () => {
  it("knows every theme id, so a saved theme is never ignored on first paint", () => {
    for (const theme of THEMES) expect(THEME_INIT_SCRIPT).toContain(`"${theme.id}"`);
  });
});
