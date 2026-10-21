import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { FilteredLead, LeadCounts, LeadListItem } from "@/lib/types";
import { LiveStatus, QueueList, SplitView } from "./index";

// Mock next/navigation for client component render testing
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/queue",
  useSearchParams: () => new URLSearchParams(),
}));

let currentMode: "live" | "polling" = "live";

// Mock useLiveLeads so tests don't require public Supabase env keys
vi.mock("@/lib/use-live-leads", () => ({
  useLiveLeads: () => ({ mode: currentMode }),
}));

describe("Queue components", () => {
  describe("SplitView", () => {
    it("renders list and detail slots with responsive layout classes", () => {
      const html = renderToStaticMarkup(
        <SplitView
          list={<div id="list-slot">List Content</div>}
          detail={<div id="detail-slot">Detail Content</div>}
        />
      );

      expect(html).toContain("list-slot");
      expect(html).toContain("List Content");
      expect(html).toContain("detail-slot");
      expect(html).toContain("Detail Content");
      expect(html).toContain("flex-col lg:flex-row");
    });
  });

  describe("LiveStatus", () => {
    it("renders Live mode with good styling", () => {
      currentMode = "live";
      const html = renderToStaticMarkup(<LiveStatus />);
      expect(html).toContain("Live");
      expect(html).toContain("text-good");
    });

    it("renders Polling mode with fallback description", () => {
      currentMode = "polling";
      const html = renderToStaticMarkup(<LiveStatus />);
      expect(html).toContain("Refreshing every minute");
      expect(html).toContain("text-muted");
    });
  });

  describe("QueueList", () => {
    const mockCounts: LeadCounts = {
      ready: 12,
      enrolled: 5,
      bounced: 2,
      replied: 8,
      filtered: 44,
    };

    const mockFiltered: { items: FilteredLead[]; total: number } = {
      items: [
        {
          id: "fl-1",
          companyName: "Filtered Co",
          domain: "filtered.co",
          score: 40,
          reason: "Score 40, under 50: no buying signals yet",
        },
      ],
      total: 44,
    };

    const mockLeads: LeadListItem[] = [
      {
        id: "lead-1",
        status: "ready",
        score: 92,
        scoreParts: [
          ["ICP match", 40],
          ["Hiring", 30],
        ],
        band: "Strong",
        tier: "hi",
        company: { id: "c-1", name: "Acme Corp", domain: "acme.com" },
        contact: { name: "Jane Doe", title: "CEO", isPlaceholder: false },
        topSignal: {
          id: "sig-1",
          type: "hiring",
          category: "sales",
          title: "Founding AE",
          excerpt: "Build outbound",
          sourceName: "Ashby",
          sourceUrl: "https://ashby.com",
          occurredAt: new Date(Date.now() - 3600000 * 4).toISOString(), // 4h ago
        },
        signalTypes: ["hiring", "launch"],
        newestSignalAt: new Date().toISOString(),
        assignee: { id: "p-1", name: "Demo Rep" },
        updatedAt: new Date().toISOString(),
      },
    ];

    it("renders tabs with counts and labels", () => {
      const html = renderToStaticMarkup(
        <QueueList
          leads={mockLeads}
          counts={mockCounts}
          filtered={mockFiltered}
          currentTab="ready"
          currentSignals={[]}
        />
      );

      expect(html).toContain("Ready");
      expect(html).toContain("12");
      expect(html).toContain("Enrolled");
      expect(html).toContain("5");
      expect(html).toContain("Bounced");
      expect(html).toContain("2");
      expect(html).toContain("Replied");
      expect(html).toContain("8");
    });

    it("renders signal filter chips with active states", () => {
      const html = renderToStaticMarkup(
        <QueueList
          leads={mockLeads}
          counts={mockCounts}
          filtered={mockFiltered}
          currentTab="ready"
          currentSignals={["hiring"]}
        />
      );

      expect(html).toContain("All signals");
      expect(html).toContain("Hiring");
      expect(html).toContain("Launch");
      expect(html).toContain("Funding");
    });

    it("renders lead rows with score, band word, company, contact, top signal and age", () => {
      const html = renderToStaticMarkup(
        <QueueList
          leads={mockLeads}
          counts={mockCounts}
          filtered={mockFiltered}
          currentTab="ready"
          currentSignals={[]}
          selectedLeadId="lead-1"
        />
      );

      expect(html).toContain("92");
      expect(html).toContain("Strong");
      expect(html).toContain("Acme Corp");
      expect(html).toContain("Jane Doe · CEO");
      expect(html).toContain("Founding AE");
      expect(html).toContain("4h ago");
      expect(html).toContain("+1"); // extra signal count
      expect(html).toContain('aria-current="true"');
    });

    it("renders empty state when leads list is empty", () => {
      const html = renderToStaticMarkup(
        <QueueList
          leads={[]}
          counts={mockCounts}
          filtered={mockFiltered}
          currentTab="ready"
          currentSignals={[]}
        />
      );

      expect(html).toContain("Queue cleared");
      expect(html).toContain("New leads appear here as the agent finds signals.");
    });

    it("renders collapsed filtered out section with total and item reasons", () => {
      const html = renderToStaticMarkup(
        <QueueList
          leads={mockLeads}
          counts={mockCounts}
          filtered={mockFiltered}
          currentTab="ready"
          currentSignals={[]}
        />
      );

      expect(html).toContain("44 filtered out by the agent");
      expect(html).toContain("Filtered Co");
      expect(html).toContain("filtered.co");
      expect(html).toContain("Score 40, under 50: no buying signals yet");
      expect(html).toContain("and 43 more with lower scores");
    });
  });
});
