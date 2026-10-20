// The theme list, in one place. app/themes.css holds the colors; this file holds the ids.
// Safe to import from server and client code.

export const THEMES = [
  { id: "paper", label: "Paper", scheme: "light" },
  { id: "mist", label: "Mist", scheme: "light" },
  { id: "graphite", label: "Graphite", scheme: "dark" },
  { id: "midnight", label: "Midnight", scheme: "dark" },
  { id: "forest", label: "Forest", scheme: "dark" },
  { id: "high-contrast", label: "High Contrast", scheme: "dark" },
] as const;

export type ConcreteThemeId = (typeof THEMES)[number]["id"];
export type ThemeId = ConcreteThemeId | "system";

// What the picker lists, in order. "System" follows the OS light/dark setting.
export const THEME_CHOICES: { id: ThemeId; label: string }[] = [
  { id: "system", label: "System" },
  ...THEMES.map(({ id, label }) => ({ id, label })),
];

// "System" maps to Paper (light) or Graphite (dark).
export const SYSTEM_THEMES = { light: "paper", dark: "graphite" } as const satisfies Record<
  "light" | "dark",
  ConcreteThemeId
>;

export const THEME_STORAGE_KEY = "signal-desk.theme";

const THEME_IDS = new Set<string>(THEME_CHOICES.map((choice) => choice.id));

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && THEME_IDS.has(value);
}

export function resolveTheme(choice: ThemeId, prefersDark: boolean): ConcreteThemeId {
  if (choice !== "system") return choice;
  return prefersDark ? SYSTEM_THEMES.dark : SYSTEM_THEMES.light;
}

// Runs inline in <head> before first paint, so the page never flashes the wrong theme.
// Built from the constants above so the ids live in one place.
export const THEME_INIT_SCRIPT = `(function () {
  var root = document.documentElement;
  try {
    var choice = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    if (${JSON.stringify([...THEME_IDS])}.indexOf(choice) < 0) choice = "system";
    var dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.dataset.themeChoice = choice;
    root.dataset.theme = choice === "system" ? (dark ? ${JSON.stringify(SYSTEM_THEMES.dark)} : ${JSON.stringify(SYSTEM_THEMES.light)}) : choice;
  } catch (error) {
    root.dataset.theme = ${JSON.stringify(SYSTEM_THEMES.light)};
  }
})();`;
