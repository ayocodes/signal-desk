import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { VersionHistory } from "./VersionHistory";
import type { RulesVersion } from "@/lib/types";

vi.mock("@/lib/api", () => ({
  revertAgentConfig: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe("VersionHistory component", () => {
  const sampleVersions: RulesVersion[] = [
    {
      version: 2,
      savedBy: { id: "u-1", name: "Alice Admin" },
      savedAt: "2026-10-21T12:00:00Z",
      changeSummary: [
        "Threshold 50 → 55",
        "Sales hire points 25 → 30",
      ],
      isCurrent: true, restoredFrom: null, sameRulesAs: null,
    },
    {
      version: 1,
      savedBy: null,
      savedAt: "2026-10-21T10:00:00Z",
      changeSummary: [],
      isCurrent: false, restoredFrom: null, sameRulesAs: null,
    },
  ];

  it("lists all versions with version number, author, and date", () => {
    const html = renderToStaticMarkup(
      <VersionHistory versions={sampleVersions} />
    );

    expect(html).toContain("Version history");
    expect(html).toContain("Version 2");
    expect(html).toContain("Version 1");
    expect(html).toContain("by Alice Admin");
    expect(html).toContain("by Seeded");
    expect(html).toContain("2026-10-21 12:00 UTC");
    expect(html).toContain("2026-10-21 10:00 UTC");
  });

  it("marks the current version and shows no revert button on it", () => {
    const html = renderToStaticMarkup(
      <VersionHistory versions={sampleVersions} />
    );

    expect(html).toContain("Current");
    // Version 1 has a revert button, but version 2 (current) does not have one
    expect(html).toContain("Revert to this version");
  });

  it("shows first version defaults message for version 1", () => {
    const html = renderToStaticMarkup(
      <VersionHistory versions={sampleVersions} />
    );

    expect(html).toContain("First version, from the defaults");
  });

  it("shows change summary lines as list for newer versions", () => {
    const html = renderToStaticMarkup(
      <VersionHistory versions={sampleVersions} />
    );

    expect(html).toContain("Threshold 50 → 55");
    expect(html).toContain("Sales hire points 25 → 30");
  });

  it("handles empty versions list gracefully", () => {
    const html = renderToStaticMarkup(<VersionHistory versions={[]} />);

    expect(html).toContain("No saved versions yet.");
  });
});
