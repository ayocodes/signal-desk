// Admin only. proxy.ts already answers reps with a 403; this server-side check renders
// app/forbidden.tsx if the proxy is ever bypassed, and RLS denies the data either way.
import { requireAdmin } from "@/lib/auth";

export default async function OpsLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return children;
}
