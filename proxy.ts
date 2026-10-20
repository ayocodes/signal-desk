// Runs before every page request (Next 16 renamed middleware.ts to proxy.ts).
//  1. Refreshes the Supabase session cookie, so Server Components see a valid session.
//  2. Sends logged-out visitors to /login, and logged-in users away from /login.
//  3. Answers /ops with a real 403 status for non-admins. Pages stream with a 200 status
//     before forbidden() can run in them, so the status has to be set here. The ops layout
//     (requireAdmin) and RLS still enforce the same rule if this is bypassed.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";
import { publicEnv } from "@/lib/env.public";

const PUBLIC_PATHS = new Set(["/login"]);
const ADMIN_PREFIXES = ["/ops"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const cacheHeaders: Record<string, string> = {};

  const supabase = createServerClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        Object.assign(cacheHeaders, headers);
      },
    },
  });

  // Also refreshes an expired session; the new cookies arrive through setAll above.
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  const path = request.nextUrl.pathname;

  // Carry refreshed cookies and cache headers onto whatever response we return.
  const finish = (result: NextResponse) => {
    for (const cookie of response.cookies.getAll()) result.cookies.set(cookie);
    for (const [key, value] of Object.entries(cacheHeaders)) result.headers.set(key, value);
    return result;
  };

  if (!userId && !PUBLIC_PATHS.has(path)) {
    return finish(NextResponse.redirect(new URL("/login", request.url)));
  }
  if (userId && (path === "/" || PUBLIC_PATHS.has(path))) {
    return finish(NextResponse.redirect(new URL("/queue", request.url)));
  }

  if (userId && ADMIN_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    // One small query, only on admin paths. RLS lets a user read their own profile.
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
    if (profile?.role !== "admin") {
      const denied = finish(NextResponse.rewrite(new URL("/403", request.url)));
      // The answer depends on who is asking, so no shared cache may store it.
      denied.headers.set("Cache-Control", "private, no-store");
      return denied;
    }
  }

  return finish(response);
}

export const config = {
  // Skip static files, images, and the Resend webhook (it has no session; it checks its signature).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/webhooks|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
