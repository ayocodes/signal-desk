// Every signed-in page renders inside this layout.
// With Cache Components on, anything that reads the session cookie must sit inside
// <Suspense>: the fallback streams first, then the shell once the profile has loaded.
import { Suspense } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { requireProfile } from "@/lib/auth";

async function SignedInShell({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  return (
    <AppShell profile={{ fullName: profile.fullName, email: profile.email, role: profile.role }}>{children}</AppShell>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="p-6">Loading</div>}>
      <SignedInShell>{children}</SignedInShell>
    </Suspense>
  );
}
