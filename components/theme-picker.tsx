"use client";

import { showToast, SegmentedControl } from "@/components/ui";
import { saveTheme, useStoredTheme } from "@/lib/theme-client";
import { THEME_CHOICES, type ThemeId } from "@/lib/themes";

export function ThemePicker() {
  const theme = useStoredTheme();

  const handleChange = (newTheme: ThemeId) => {
    saveTheme(newTheme).catch((error: unknown) => {
      console.error("Saving the theme to the profile failed.", error);
      showToast("Theme changed here, but saving it to your profile failed.", { tone: "bad" });
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-body font-semibold text-text">Theme</h3>
        <p className="text-meta text-muted mt-0.5">
          Saved to your profile, so it follows you to other devices. System matches your
          operating system&apos;s light or dark setting.
        </p>
      </div>

      <div className="flex flex-wrap pt-1">
        <SegmentedControl<ThemeId>
          options={THEME_CHOICES.map((choice) => ({
            value: choice.id,
            label: choice.label,
          }))}
          value={theme}
          onChange={handleChange}
          className="flex-wrap"
          ariaLabel="Theme picker"
        />
      </div>
    </div>
  );
}
