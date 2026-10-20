"use client";

// Bare, working shell. Flash designs it in F1.3; keep the props and the signOut form.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/(auth)/login/actions";
import type { Role } from "@/lib/auth";
import { BRAND_NAME } from "@/lib/brand";

export type ShellProfile = {
  fullName: string;
  email: string;
  role: Role;
};

type NavItem = { href: string; label: string; adminOnly?: boolean };

export const NAV_ITEMS: NavItem[] = [
  { href: "/queue", label: "Queue" },
  { href: "/leads", label: "Leads" },
  { href: "/sequences", label: "Sequences" },
  { href: "/ops", label: "Ops", adminOnly: true },
  { href: "/settings", label: "Settings" },
];

export function AppShell({ profile, children }: { profile: ShellProfile; children: React.ReactNode }) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => !item.adminOnly || profile.role === "admin");

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 flex-col gap-4 border-r p-4">
        <div>{BRAND_NAME}</div>
        <nav className="flex flex-col gap-1">
          {items.map((item) => (
            <Link key={item.href} href={item.href} aria-current={pathname.startsWith(item.href) ? "page" : undefined}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-1">
          <span>{profile.fullName}</span>
          <span>{profile.email}</span>
          <span>{profile.role}</span>
          <form action={signOut}>
            <button type="submit">Sign out</button>
          </form>
        </div>
      </aside>
      <div className="flex-1 p-6">{children}</div>
    </div>
  );
}
