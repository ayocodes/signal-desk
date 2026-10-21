// Admin only. proxy.ts already answers reps with a 403; this server-side check renders
// app/forbidden.tsx if the proxy is ever bypassed, and save_agent_config() refuses non-admins
// in the database either way. Same Suspense pattern as Ops: the check waits on the session.
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth";

async function AdminOnly({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return children;
}

export default function AgentRulesLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="p-6 text-meta text-muted">Loading</div>}>
      <AdminOnly>{children}</AdminOnly>
    </Suspense>
  );
}
