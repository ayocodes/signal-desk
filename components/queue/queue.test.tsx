import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { FilteredLead, LeadCounts, LeadListItem } from "@/lib/types";
import { LiveStatus, QueueList, SplitView } from "./index";
import { isTypingInInput, setSelectedLeadContext, getSelectedLeadContext } from "./lead-context";

// A fixed request time, so relative ages ("6h ago") are deterministic.
const TEST_NOW = Date.parse("2026-10-21T12:00:00Z");


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
          label: "Sales hire",
          title: "Founding AE",
          excerpt: "Build outbound",
          sourceName: "Ashby",
          sourceUrl: "https://ashby.com",
          occurredAt: new Date(TEST_NOW - 3600000 * 4).toISOString(), // 4h ago
        },
        signalTypes: ["hiring", "launch"],
        newestSignalAt: new Date(TEST_NOW).toISOString(),
        assignee: { id: "p-1", name: "Demo Rep" },
        updatedAt: new Date(TEST_NOW).toISOString(),
      },
    ];

    it("renders tabs with counts and labels", () => {
      const html = renderToStaticMarkup(
        <QueueList now={TEST_NOW}
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
        <QueueList now={TEST_NOW}
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
      expect(html).toContain("YC recent");
    });

    it("renders lead rows with score, band word, company, contact, top signal and age", () => {
      const html = renderToStaticMarkup(
        <QueueList now={TEST_NOW}
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

    it("renders empty state for ready tab", () => {
      const html = renderToStaticMarkup(
        <QueueList now={TEST_NOW}
          leads={[]}
          counts={mockCounts}
          filtered={mockFiltered}
          currentTab="ready"
          currentSignals={[]}
        />
      );

      expect(html).toContain("No leads ready for review");
      expect(html).toContain("New leads appear here as the agent discovers companies");
    });

    it("renders empty state for enrolled tab", () => {
      const html = renderToStaticMarkup(
        <QueueList now={TEST_NOW}
          leads={[]}
          counts={mockCounts}
          filtered={mockFiltered}
          currentTab="enrolled"
          currentSignals={[]}
        />
      );

      expect(html).toContain("No enrolled leads");
      expect(html).toContain("Leads appear here after you approve and enroll them");
    });

    it("renders empty state for bounced tab", () => {
      const html = renderToStaticMarkup(
        <QueueList now={TEST_NOW}
          leads={[]}
          counts={mockCounts}
          filtered={mockFiltered}
          currentTab="bounced"
          currentSignals={[]}
        />
      );

      expect(html).toContain("No bounced emails");
      expect(html).toContain("Leads with email delivery failures appear here");
    });

    it("renders empty state for replied tab", () => {
      const html = renderToStaticMarkup(
        <QueueList now={TEST_NOW}
          leads={[]}
          counts={mockCounts}
          filtered={mockFiltered}
          currentTab="replied"
          currentSignals={[]}
        />
      );

      expect(html).toContain("No replies yet");
      expect(html).toContain("When a prospect replies to an outreach email");
    });

    it("renders empty state when signal filter matches nothing", () => {
      const html = renderToStaticMarkup(
        <QueueList now={TEST_NOW}
          leads={[]}
          counts={mockCounts}
          filtered={mockFiltered}
          currentTab="ready"
          currentSignals={["funding"]}
        />
      );

      expect(html).toContain("No matching leads");
      expect(html).toContain("Show all signals");
    });

    it("renders collapsed filtered out section with total and item reasons", () => {
      const html = renderToStaticMarkup(
        <QueueList now={TEST_NOW}
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

  describe("lead-context and keyboard helpers", () => {
    it("isTypingInInput detects form controls and contenteditable elements", () => {
      expect(isTypingInInput(null)).toBe(false);
      expect(isTypingInInput({} as EventTarget)).toBe(false);
      expect(isTypingInInput({ tagName: "DIV" } as unknown as EventTarget)).toBe(false);
      expect(isTypingInInput({ tagName: "BUTTON" } as unknown as EventTarget)).toBe(false);

      expect(isTypingInInput({ tagName: "INPUT" } as unknown as EventTarget)).toBe(true);
      expect(isTypingInInput({ tagName: "TEXTAREA" } as unknown as EventTarget)).toBe(true);
      expect(isTypingInInput({ tagName: "SELECT" } as unknown as EventTarget)).toBe(true);

      expect(
        isTypingInInput({
          tagName: "DIV",
          getAttribute: (attr: string) => (attr === "role" ? "textbox" : null),
        } as unknown as EventTarget)
      ).toBe(true);

      expect(
        isTypingInInput({
          tagName: "DIV",
          isContentEditable: true,
        } as unknown as EventTarget)
      ).toBe(true);
    });

    it("setSelectedLeadContext and getSelectedLeadContext manage active lead for Command Palette", () => {
      setSelectedLeadContext({
        id: "lead-abc",
        domain: "acme.inc",
        companyName: "Acme",
        nextLeadId: "lead-xyz",
        nextLeadHref: "/queue?lead=lead-xyz",
      });

      expect(getSelectedLeadContext()).toEqual({
        id: "lead-abc",
        domain: "acme.inc",
        companyName: "Acme",
        nextLeadId: "lead-xyz",
        nextLeadHref: "/queue?lead=lead-xyz",
      });

      setSelectedLeadContext(null);
      expect(getSelectedLeadContext()).toBeNull();
    });
  });
});
