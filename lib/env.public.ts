// Browser-safe environment. Next inlines NEXT_PUBLIC_* values only when they are read
// as literal `process.env.NAME` expressions, so each one is spelled out here.
import { parsePublicEnv } from "./env-schema";

export const publicEnv = parsePublicEnv({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});
