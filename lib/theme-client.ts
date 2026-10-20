// Browser-side theme helpers. Used by ThemeSync, the command palette and the Settings picker.
import { saveThemePreference } from "@/app/(app)/settings/actions";
import { isThemeId, resolveTheme, THEME_STORAGE_KEY, type ThemeId } from "@/lib/themes";

function prefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

// Changes the page only. Used for live preview while arrowing through the theme list.
export function applyTheme(choice: ThemeId): void {
  const root = document.documentElement;
  root.dataset.themeChoice = choice;
  root.dataset.theme = resolveTheme(choice, prefersDark());
}

// The user's saved choice on this device ("system" if none). Esc in the picker reverts to it.
export function readStoredTheme(): ThemeId {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeId(stored) ? stored : "system";
  } catch (error) {
    console.warn("Reading the saved theme failed; using System.", error);
    return "system";
  }
}

export function storeTheme(choice: ThemeId): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch (error) {
    // Private browsing can block storage; the theme still applies and saves to the profile.
    console.warn("Saving the theme on this device failed.", error);
  }
}

// Keeps the choice: applies it, remembers it on this device, and saves it to the profile
// so it follows the user to other devices.
export async function saveTheme(choice: ThemeId): Promise<void> {
  applyTheme(choice);
  storeTheme(choice);
  await saveThemePreference(choice);
}
