// Supabase clients for one-off Node scripts (seed, RLS test). Never imported by the app.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { parseServerEnv } from "../lib/env-schema";

export const env = parseServerEnv(process.env);

// Fixed id so re-runs of seed and seed:reset always target the same demo organization.
export const DEMO_ORG_ID = "00000000-0000-4000-8000-000000000001";

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

// Bypasses RLS. Scripts only.
export function serviceClient(): SupabaseClient {
  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, noSession);
}

export function anonClient(): SupabaseClient {
  return createClient(env.supabaseUrl, env.supabaseAnonKey, noSession);
}

export async function signedInClient(email: string, password: string): Promise<SupabaseClient> {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Sign-in failed for ${email}: ${error.message}`);
  return client;
}
