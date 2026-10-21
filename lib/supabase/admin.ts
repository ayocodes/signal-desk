// Service-role Supabase client: bypasses RLS. Server only, and only for writes the database
// can't check on its own (ARCHITECTURE.md "Roles and RLS"): the approve and draft routes,
// after they have read the lead through the user's own session, and the webhook handler.
import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { env } from "@/lib/env";

export function createSupabaseAdminClient() {
  return createClient<Database>(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
