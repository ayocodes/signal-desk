"use client";

// Makes the profile's saved theme win over this device's localStorage, so the theme follows
// the user across devices, and applies it on every mount: coming back from a page outside
// this layout (the 403 page) re-renders <html> with the default theme, and the inline script
// only runs on full page loads. Also re-applies "System" when the OS switches light/dark.
import { useEffect } from "react";
import { applyTheme, readStoredTheme, storeTheme } from "@/lib/theme-client";
import { isThemeId } from "@/lib/themes";

export function ThemeSync({ profileTheme }: { profileTheme: string }) {
  useEffect(() => {
    const theme = isThemeId(profileTheme) ? profileTheme : readStoredTheme();
    if (theme !== readStoredTheme()) storeTheme(theme);
    applyTheme(theme);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemChange = () => {
      if (readStoredTheme() === "system") applyTheme("system");
    };
    media.addEventListener("change", onSystemChange);
    return () => media.removeEventListener("change", onSystemChange);
  }, [profileTheme]);

  return null;
}
