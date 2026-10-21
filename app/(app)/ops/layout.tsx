// Admin only. proxy.ts already answers reps with a 403; this server-side check renders
// app/forbidden.tsx if the proxy is ever bypassed, and RLS denies the data either way.
// The check waits on the session, so it sits inside <Suspense>: a click into Ops shows the
// placeholder at once, and the page itself renders only after the check passes.
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth";

async function AdminOnly({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return children;
}

export default function OpsLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="p-6 text-meta text-muted">Loading</div>}>
      <AdminOnly>{children}</AdminOnly>
    </Suspense>
  );
}
