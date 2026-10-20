"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Inbox,
  LogOut,
  type LucideIcon,
  Menu,
  PanelLeft,
  PanelLeftClose,
  Search,
  Send,
  Settings,
  Users,
  X,
} from "lucide-react";
import { signOut } from "@/app/(auth)/login/actions";
import { CommandPalette } from "@/components/command-palette";
import { Avatar, Kbd, Pill } from "@/components/ui";
import type { Role } from "@/lib/auth";
import { BRAND_NAME } from "@/lib/brand";

export type ShellProfile = {
  fullName: string;
  email: string;
  role: Role;
};

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/queue", label: "Queue", icon: Inbox },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/sequences", label: "Sequences", icon: Send },
  { href: "/ops", label: "Ops", adminOnly: true, icon: Activity },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({
  profile,
  children,
}: {
  profile: ShellProfile;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [paletteOpen, setPaletteOpen] = React.useState(false);

  // Close mobile drawer when pathname changes
  const [prevPathname, setPrevPathname] = React.useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setMobileOpen(false);
  }

  // Close mobile drawer on Escape key
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && mobileOpen) {
        setMobileOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileOpen]);

  const items = NAV_ITEMS.filter((item) => !item.adminOnly || profile.role === "admin");
  const activeItem = items.find((item) => pathname.startsWith(item.href));
  const pageTitle = activeItem?.label ?? BRAND_NAME;

  return (
    <div className="flex min-h-screen w-full bg-bg text-text">
      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          role="presentation"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-bg/70 backdrop-blur-xs md:hidden"
        />
      )}

      {/* Mobile Drawer (Sheet) */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Mobile Navigation"
        // While closed it is off-screen: inert keeps Tab and screen readers out of it.
        inert={!mobileOpen}
        className={`fixed inset-y-0 left-0 z-50 flex w-[260px] max-w-[85vw] flex-col justify-between border-r border-border bg-surface shadow-2xl transition-transform duration-200 ease-in-out md:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col">
          {/* Header */}
          <div className="flex h-14 items-center justify-between border-b border-border px-4">
            <span className="font-semibold text-text tracking-tight truncate">
              {BRAND_NAME}
            </span>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation"
              className="rounded-control p-1.5 text-muted hover:bg-surface-2 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation Items */}
          <nav aria-label="Mobile" className="flex flex-col gap-1 p-3">
            {items.map((item) => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex h-9 items-center gap-3 rounded-control px-3 text-body font-medium transition-colors select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                    isActive
                      ? "bg-surface-2 text-text font-semibold shadow-xs"
                      : "text-muted hover:bg-surface-2/60 hover:text-text"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Menu Footer */}
        <div className="border-t border-border p-3">
          <div className="flex items-center gap-3 mb-3">
            <Avatar name={profile.fullName} size="md" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-body font-medium text-text truncate">
                  {profile.fullName}
                </span>
                <Pill
                  tone={profile.role === "admin" ? "accent" : "neutral"}
                  dot={false}
                >
                  {profile.role}
                </Pill>
              </div>
              <span className="text-meta text-muted truncate block">
                {profile.email}
              </span>
            </div>
          </div>
          <form action={signOut} className="w-full">
            <button
              type="submit"
              className="flex w-full h-8 items-center justify-center gap-2 rounded-control border border-border bg-surface-2 px-3 text-meta font-medium text-muted hover:border-bad/30 hover:bg-bad/10 hover:text-bad transition-colors select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <LogOut className="h-3.5 w-3.5 shrink-0" />
              <span>Sign out</span>
            </button>
          </form>
        </div>
      </aside>

      {/* Desktop Sidebar (240px or Collapsible to Icons) */}
      <aside
        className={`hidden md:flex flex-col justify-between sticky top-0 h-screen border-r border-border bg-surface select-none transition-[width] duration-200 ease-in-out shrink-0 ${
          collapsed ? "w-14" : "w-60"
        }`}
      >
        <div className="flex flex-col min-w-0">
          {/* Workspace Title & Toggle */}
          <div
            className={`flex h-14 items-center border-b border-border ${
              collapsed ? "justify-center px-2" : "justify-between px-4"
            }`}
          >
            {!collapsed ? (
              <>
                <span className="font-semibold text-text tracking-tight truncate text-body">
                  {BRAND_NAME}
                </span>
                <button
                  type="button"
                  onClick={() => setCollapsed(true)}
                  aria-label="Collapse sidebar"
                  title="Collapse sidebar"
                  className="rounded-control p-1 text-muted hover:bg-surface-2 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setCollapsed(false)}
                aria-label="Expand sidebar"
                title="Expand sidebar"
                className="rounded-control p-1.5 text-muted hover:bg-surface-2 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <PanelLeft className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Nav Items */}
          <nav aria-label="Main" className="flex flex-col gap-1 p-2">
            {items.map((item) => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  title={collapsed ? item.label : undefined}
                  className={`flex h-9 items-center rounded-control transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                    collapsed
                      ? "justify-center w-10 mx-auto"
                      : "gap-3 px-3 text-body font-medium"
                  } ${
                    isActive
                      ? "bg-surface-2 text-text font-semibold shadow-xs"
                      : "text-muted hover:bg-surface-2/60 hover:text-text"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Menu Footer */}
        <div
          className={`border-t border-border p-2 ${
            collapsed ? "flex flex-col items-center gap-2" : "flex flex-col gap-2"
          }`}
        >
          {!collapsed ? (
            <>
              <div className="flex items-center gap-2.5 px-1 py-1">
                <Avatar name={profile.fullName} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-body font-medium text-text truncate">
                      {profile.fullName}
                    </span>
                    <Pill
                      tone={profile.role === "admin" ? "accent" : "neutral"}
                      dot={false}
                    >
                      {profile.role}
                    </Pill>
                  </div>
                  <span className="text-meta text-muted truncate block">
                    {profile.email}
                  </span>
                </div>
              </div>
              <form action={signOut} className="w-full">
                <button
                  type="submit"
                  className="flex w-full h-8 items-center gap-2 rounded-control px-2.5 text-meta text-muted hover:border-bad/30 hover:bg-bad/10 hover:text-bad transition-colors select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <LogOut className="h-3.5 w-3.5 shrink-0" />
                  <span>Sign out</span>
                </button>
              </form>
            </>
          ) : (
            <>
              <div title={`${profile.fullName} (${profile.role})`}>
                <Avatar name={profile.fullName} size="sm" />
              </div>
              <form action={signOut}>
                <button
                  type="submit"
                  aria-label="Sign out"
                  title="Sign out"
                  className="flex h-8 w-8 items-center justify-center rounded-control text-muted hover:bg-bad/10 hover:text-bad transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </form>
            </>
          )}
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex flex-1 flex-col min-w-0 max-w-full">
        {/* Top Bar */}
        <header className="sticky top-0 z-20 flex h-14 w-full items-center justify-between border-b border-border bg-surface/90 px-4 md:px-6 backdrop-blur-xs">
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile Hamburger Button */}
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
              className="rounded-control p-1.5 text-muted hover:bg-surface-2 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent md:hidden shrink-0"
            >
              <Menu className="h-5 w-5" />
            </button>
            {/* Page Title Slot */}
            <h1 className="text-section font-semibold text-text tracking-tight truncate">
              {pageTitle}
            </h1>
          </div>

          {/* ⌘K Command Palette Hint */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="flex h-8 items-center gap-2 rounded-control border border-border bg-surface-2 px-2.5 text-meta text-muted hover:border-border-strong hover:text-text transition-colors select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              aria-label="Command palette (⌘K)"
            >
              <Search className="h-3.5 w-3.5 text-muted shrink-0" aria-hidden="true" />
              <span className="hidden sm:inline">Search...</span>
              <Kbd>⌘K</Kbd>
            </button>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 p-4 md:p-6 overflow-x-hidden min-w-0 max-w-full">
          {children}
        </main>
      </div>

      {/* Command Palette */}
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        role={profile.role}
      />
    </div>
  );
}
