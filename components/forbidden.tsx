// Permission-denied state. Bare until Flash designs it in F1.4.
// Rendered by app/forbidden.tsx (forbidden()) and app/403/page.tsx (proxy rewrite).
import Link from "next/link";

export function Forbidden() {
  return (
    <main className="p-6">
      <h1>You don&apos;t have access to this page</h1>
      <p>Ops is for admins. Your leads are waiting in the queue.</p>
      <Link href="/queue">Back to Queue</Link>
    </main>
  );
}
