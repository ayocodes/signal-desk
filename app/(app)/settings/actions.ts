"use server";

import { logUserAction } from "@/lib/audit";
import { requireProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isThemeId } from "@/lib/themes";

export async function saveThemePreference(theme: unknown): Promise<void> {
  // Server actions accept anything from the browser, so validate before writing.
  if (!isThemeId(theme)) throw new Error("Unknown theme.");

  const profile = await requireProfile();
  if (profile.theme === theme) return;

  const supabase = await createSupabaseServerClient();
  // RLS + column grants: a user can update only their own theme and name.
  const { error } = await supabase.from("profiles").update({ theme }).eq("id", profile.id);
  if (error) throw new Error(`Saving the theme failed: ${error.message}`);

  await logUserAction(profile, {
    action: "profile.theme_changed",
    entityType: "profile",
    entityId: profile.id,
    detail: { from: profile.theme, to: theme },
  });
}
