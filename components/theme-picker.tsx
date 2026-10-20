"use client";

import * as React from "react";
import { THEME_CHOICES, type ThemeId } from "@/lib/themes";
import { readStoredTheme, saveTheme } from "@/lib/theme-client";
import { SegmentedControl } from "@/components/ui";

export function ThemePicker() {
  const [theme, setTheme] = React.useState<ThemeId>(() => {
    if (typeof window !== "undefined") {
      return readStoredTheme();
    }
    return "system";
  });

  const handleChange = async (newTheme: ThemeId) => {
    setTheme(newTheme);
    await saveTheme(newTheme);
  };

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-body font-semibold text-text">Theme</h3>
        <p className="text-meta text-muted mt-0.5">
          Choose how Signal Desk looks on this device. System automatically matches your operating system.
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
