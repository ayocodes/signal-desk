import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { LeadDetail } from "@/components/queue/LeadDetail";
import QueueLoading from "./loading";
import QueueError from "./error";
import type { LeadDetail as LeadDetailType } from "@/lib/types";

// The admin's send-address row has a client control that uses the router.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

// A fixed request time, so relative ages ("6h ago") are deterministic.
const TEST_NOW = Date.parse("2026-10-21T12:00:00Z");


describe("LeadDetail component", () => {
  const sampleLead: LeadDetailType = {
    id: "lead-123",
    status: "ready",
    score: 92,
    scoreParts: [
      ["ICP match", 40],
      ["Hiring", 30],
      ["Fresh (under 24h)", 15],
      ["2 signal types", 7],
    ],
    band: "Strong",
    tier: "hi",
    company: {
      id: "comp-1",
      name: "Ledgerline",
      domain: "ledgerline.co",
      icpTier: "full",
      icpReasons: [
        "Active",
        "B2B industry (Sales)",
        "Team of 12 (5 to 60)",
        "YC Summer 2025 (within 3 years)",
      ],
      teamSize: 12,
      ycBatch: "Summer 2025",
      description: "AP automation for mid-market finance",
      industries: ["B2B", "Fintech"],
    },
    contact: {
      name: "Founder",
      title: null,
      isPlaceholder: true,
      sendAddress: "delivered+12345678@resend.dev",
      buyerStatus: "verified",
      buyerReason: "Founder at a 12-person team usually runs outbound",
    },
    topSignal: {
      id: "sig-1",
      type: "hiring",
      category: "sales",
      label: "Sales hire",
      title: "Founding Account Executive",
      excerpt: "Build our outbound motion from scratch",
      sourceName: "Ashby job board",
      sourceUrl: "https://jobs.ashbyhq.com/ledgerline/1",
      occurredAt: new Date(TEST_NOW - 3600000 * 6).toISOString(),
    },
    signals: [
      {
        id: "sig-1",
        type: "hiring",
        category: "sales",
        label: "Sales hire",
        title: "Founding Account Executive",
        excerpt: "Build our outbound motion from scratch",
        sourceName: "Ashby job board",
        sourceUrl: "https://jobs.ashbyhq.com/ledgerline/1",
        occurredAt: new Date(TEST_NOW - 3600000 * 6).toISOString(),
      },
      {
        id: "sig-2",
        type: "launch",
        category: null,
        label: "Launch",
        title: "Launch HN: Ledgerline (YC S25)",
        excerpt: "AP automation for finance teams",
        sourceName: "Hacker News",
        sourceUrl: "https://news.ycombinator.com/item?id=123",
        occurredAt: new Date(TEST_NOW - 3600000 * 48).toISOString(),
      },
    ],
    signalTypes: ["hiring", "launch"],
    newestSignalAt: new Date(TEST_NOW).toISOString(),
    assignee: { id: "rep-1", name: "Demo Rep" },
    updatedAt: new Date(TEST_NOW).toISOString(),
    filteredReason: null,
  };

  it("renders header with company name, contact, domain in mono, and StatusPill", () => {
    const html = renderToStaticMarkup(<LeadDetail now={TEST_NOW} viewerRole="admin" lead={sampleLead} />);

    expect(html).toContain("Ledgerline");
    expect(html).toContain("ledgerline.co");
    expect(html).toContain("font-mono");
    expect(html).toContain("Founder (placeholder)");
    expect(html).toContain("Ready"); // StatusPill label
    expect(html).toContain("12"); // team size
    expect(html).toContain("people");
    expect(html).toContain("Summer 2025"); // YC batch
  });

  it("renders ScoreMath breakdown row with parts and total", () => {
    const html = renderToStaticMarkup(<LeadDetail now={TEST_NOW} viewerRole="admin" lead={sampleLead} />);

    expect(html).toContain("ICP match");
    expect(html).toContain("40");
    expect(html).toContain("Hiring");
    expect(html).toContain("30");
    expect(html).toContain("92"); // Total score
    expect(html).toContain("Strong"); // Band word
  });

  it("renders BuyerCheck row and contact with mono test inbox address", () => {
    const html = renderToStaticMarkup(<LeadDetail now={TEST_NOW} viewerRole="admin" lead={sampleLead} />);

    expect(html).toContain("Buyer verified");
    expect(html).toContain("Founder at a 12-person team usually runs outbound");
    expect(html).toContain("delivered+12345678@resend.dev");
  });

  it("renders ICP reasons", () => {
    const html = renderToStaticMarkup(<LeadDetail now={TEST_NOW} viewerRole="admin" lead={sampleLead} />);

    expect(html).toContain("ICP criteria");
    expect(html).toContain("B2B industry (Sales)");
    expect(html).toContain("Team of 12 (5 to 60)");
    expect(html).toContain("YC Summer 2025 (within 3 years)");
  });

  it("renders numbered SignalCards", () => {
    const html = renderToStaticMarkup(<LeadDetail now={TEST_NOW} viewerRole="admin" lead={sampleLead} />);

    expect(html).toContain("#1");
    expect(html).toContain("Founding Account Executive");
    expect(html).toContain("Ashby job board");
    expect(html).toContain("#2");
    expect(html).toContain("Launch HN: Ledgerline (YC S25)");
  });

  it("renders filtered reason when lead is filtered", () => {
    const filteredLead: LeadDetailType = {
      ...sampleLead,
      status: "filtered",
      filteredReason: "Score 40, under 50: no buying signals yet",
    };

    const html = renderToStaticMarkup(<LeadDetail now={TEST_NOW} viewerRole="admin" lead={filteredLead} />);

    expect(html).toContain("Filtered reason");
    expect(html).toContain("Score 40, under 50: no buying signals yet");
    expect(html).toContain("Filtered"); // StatusPill
  });

  describe("QueueLoading", () => {
    it("renders split view skeleton with tabs, chips, and list rows", () => {
      const html = renderToStaticMarkup(<QueueLoading />);
      expect(html).toContain('aria-busy="true"');
      expect(html).toContain("animate-pulse");
    });
  });

  describe("QueueError", () => {
    it("renders error state with description and retry button", () => {
      const html = renderToStaticMarkup(
        <QueueError error={new Error("Database connection failed")} reset={() => {}} />
      );
      expect(html).toContain("Failed to load outbound queue");
      expect(html).toContain("Database connection failed");
      expect(html).toContain("Try again");
    });
  });
});

