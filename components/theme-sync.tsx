"use client";

// Makes the profile's saved theme win over this device's localStorage, so the theme follows
// the user across devices. Also re-applies "System" when the OS switches light/dark.
import { useEffect } from "react";
import { applyTheme, readStoredTheme, storeTheme } from "@/lib/theme-client";
import { isThemeId } from "@/lib/themes";

export function ThemeSync({ profileTheme }: { profileTheme: string }) {
  useEffect(() => {
    if (isThemeId(profileTheme) && profileTheme !== readStoredTheme()) {
      storeTheme(profileTheme);
      applyTheme(profileTheme);
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemChange = () => {
      if (readStoredTheme() === "system") applyTheme("system");
    };
    media.addEventListener("change", onSystemChange);
    return () => media.removeEventListener("change", onSystemChange);
  }, [profileTheme]);

  return null;
}
