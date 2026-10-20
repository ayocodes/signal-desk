// Service-role client: bypasses RLS. Server only, and only where no user session exists
// (the Resend webhook in Phase 5). Never use it to answer a signed-in user's request.
import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { env } from "@/lib/env";

export function createSupabaseAdminClient() {
  return createClient<Database>(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
