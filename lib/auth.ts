// Who is signed in, and what may they do. Layer 1 of "security in two layers" (RLS is layer 2).
import "server-only";
import { forbidden, redirect } from "next/navigation";
import { cache } from "react";
import type { Database } from "@/lib/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type Role = Database["public"]["Enums"]["app_role"];

export type Profile = {
  id: string;
  orgId: string;
  fullName: string;
  email: string;
  role: Role;
  theme: string;
};

// cache(): one lookup per request, however many components ask.
export const getProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createSupabaseServerClient();
  // getClaims() verifies the session token, unlike getSession() which trusts the cookie.
  const { data: auth, error: authError } = await supabase.auth.getClaims();
  if (authError || !auth) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, org_id, full_name, role, theme")
    .eq("id", auth.claims.sub)
    .maybeSingle();
  if (error) throw new Error(`Loading the profile failed: ${error.message}`);
  if (!data) return null;

  return {
    id: data.id,
    orgId: data.org_id,
    fullName: data.full_name,
    email: auth.claims.email ?? "",
    role: data.role,
    theme: data.theme,
  };
});

export async function requireProfile(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  return profile;
}

// Renders app/forbidden.tsx for reps. proxy.ts already answers /ops with a 403 status;
// this is the server-side check that holds even if the proxy is bypassed.
export async function requireAdmin(): Promise<Profile> {
  const profile = await requireProfile();
  if (profile.role !== "admin") forbidden();
  return profile;
}
