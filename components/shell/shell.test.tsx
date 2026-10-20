import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { BRAND_NAME } from "@/lib/brand";
import { AppShell, type ShellProfile } from "./AppShell";

vi.mock("next/navigation", () => ({
  usePathname: () => "/queue",
}));

// Mock server action for signOut
vi.mock("@/app/(auth)/login/actions", () => ({
  signOut: vi.fn(),
}));

describe("AppShell", () => {
  const adminProfile: ShellProfile = {
    fullName: "Alice Admin",
    email: "admin@example.com",
    role: "admin",
  };

  const repProfile: ShellProfile = {
    fullName: "Bob Rep",
    email: "rep@example.com",
    role: "rep",
  };

  it("shows Ops in navigation for admin", () => {
    const html = renderToStaticMarkup(
      <AppShell profile={adminProfile}>
        <div>Admin Content</div>
      </AppShell>
    );

    expect(html).toContain("Ops");
    expect(html).toContain('href="/ops"');
  });

  it("does not show Ops in navigation for rep", () => {
    const html = renderToStaticMarkup(
      <AppShell profile={repProfile}>
        <div>Rep Content</div>
      </AppShell>
    );

    expect(html).not.toContain('href="/ops"');
    expect(html).toContain('href="/queue"');
    expect(html).toContain('href="/leads"');
  });

  it("renders workspace name from BRAND_NAME", () => {
    const html = renderToStaticMarkup(
      <AppShell profile={repProfile}>
        <div>Content</div>
      </AppShell>
    );

    expect(html).toContain(BRAND_NAME);
  });

  it("renders user avatar, name, and role badge pill", () => {
    const html = renderToStaticMarkup(
      <AppShell profile={adminProfile}>
        <div>Content</div>
      </AppShell>
    );

    expect(html).toContain("Alice Admin");
    expect(html).toContain("admin");
    // Avatar initials for Alice Admin: AA
    expect(html).toContain("AA");
  });

  it("renders top bar with page title and ⌘K hint", () => {
    const html = renderToStaticMarkup(
      <AppShell profile={repProfile}>
        <div>Content</div>
      </AppShell>
    );

    expect(html).toContain("⌘K");
    expect(html).toContain("Queue");
  });

  it("renders children content inside main area", () => {
    const html = renderToStaticMarkup(
      <AppShell profile={repProfile}>
        <div id="test-child">Child Element Content</div>
      </AppShell>
    );

    expect(html).toContain('id="test-child"');
    expect(html).toContain("Child Element Content");
  });

  it("renders sign out button", () => {
    const html = renderToStaticMarkup(
      <AppShell profile={repProfile}>
        <div>Content</div>
      </AppShell>
    );

    expect(html).toContain("Sign out");
  });
});
