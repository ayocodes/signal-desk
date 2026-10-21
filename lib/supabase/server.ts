// Supabase client for Server Components, Server Actions and Route Handlers.
// Acts as the signed-in user (anon key + their session cookie), so RLS applies.
import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import type { Database } from "@/lib/database.types";
import { env } from "@/lib/env";

export async function createSupabaseServerClient() {
  // Everything read through this client belongs to one signed-in user, so it is request-time
  // work, never prerendered. connection() says so to Next before supabase-js checks the
  // session's expiry with Date.now(), which Next otherwise reports as a prerender error.
  await connection();
  const cookieStore = await cookies();

  return createServerClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Expected while rendering a Server Component: Next only allows setting cookies in
          // Server Actions and Route Handlers. proxy.ts refreshes the session cookie on every
          // request, so nothing is lost here.
        }
      },
    },
  });
}
