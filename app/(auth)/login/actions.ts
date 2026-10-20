"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { logUserAction } from "@/lib/audit";
import { getProfile } from "@/lib/auth";
import { env } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SignInState = { error: string | null };

const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

const demoRoleSchema = z.enum(["admin", "rep"]);

async function signInWith(email: string, password: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return false;

  const profile = await getProfile();
  if (profile) await logUserAction(profile, { action: "auth.sign_in" });
  return true;
}

export async function signIn(_previous: SignInState, formData: FormData): Promise<SignInState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Enter your email and password." };

  if (!(await signInWith(parsed.data.email, parsed.data.password))) {
    return { error: "That email and password don't match an account." };
  }
  redirect("/queue");
}

// The demo buttons send only the role. Credentials stay on the server and never reach the browser.
export async function signInAsDemo(_previous: SignInState, formData: FormData): Promise<SignInState> {
  const role = demoRoleSchema.safeParse(formData.get("role"));
  if (!role.success) return { error: "Unknown demo account." };

  const { email, password } = env.demo[role.data];
  if (!(await signInWith(email, password))) {
    return { error: "The demo account isn't set up yet. Run npm run seed." };
  }
  redirect("/queue");
}

export async function signOut(): Promise<void> {
  const profile = await getProfile();
  if (profile) await logUserAction(profile, { action: "auth.sign_out" });

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(`Signing out failed: ${error.message}`);
  redirect("/login");
}
