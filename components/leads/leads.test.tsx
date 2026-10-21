import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { LeadStatus, ScorePart, SignalView } from "@/lib/types";
import {
  BuyerCheck,
  BUYER_STATUS_CONFIG,
  LEAD_STATUS_CONFIG,
  ScoreMath,
  SignalCard,
  signalLabel,
  StatusPill,
} from "./index";

describe("Lead display components", () => {
  describe("ScoreMath", () => {
    it("renders ScorePart[] formatted with plus signs, equals, total in ScoreBadge and band word", () => {
      const parts: ScorePart[] = [
        ["ICP match", 40],
        ["Hiring", 30],
        ["Fresh", 15],
      ];

      const html = renderToStaticMarkup(
        <ScoreMath parts={parts} score={85} band="Good" tier="md" />
      );

      // Contains mono container
      expect(html).toContain("font-mono");

      // Contains each part label and points
      expect(html).toContain("ICP match");
      expect(html).toContain("40");
      expect(html).toContain("Hiring");
      expect(html).toContain("30");
      expect(html).toContain("Fresh");
      expect(html).toContain("15");

      // Contains math operators
      expect(html).toContain("+");
      expect(html).toContain("=");

      // Total in ScoreBadge
      expect(html).toContain("85");
      expect(html).toContain("bg-warn"); // tier "md" tone

      // Band word next to it ("85 · Good")
      expect(html).toContain("Good");
      expect(html).toContain("·");
    });

    it("calculates total from parts when score prop is omitted", () => {
      const parts: ScorePart[] = [
        ["ICP match", 40],
        ["Launch", 18],
      ];

      const html = renderToStaticMarkup(<ScoreMath parts={parts} band="Borderline" />);
      expect(html).toContain("58");
      expect(html).toContain("Borderline");
    });

    it("handles single-item and empty parts cleanly", () => {
      const single: ScorePart[] = [["ICP match", 40]];
      const singleHtml = renderToStaticMarkup(<ScoreMath parts={single} score={40} band="Filtered" tier="lo" />);
      expect(singleHtml).toContain("ICP match");
      expect(singleHtml).toContain("40");
      expect(singleHtml).not.toContain("+");
      expect(singleHtml).toContain("=");
      expect(singleHtml).toContain("Filtered");

      const emptyHtml = renderToStaticMarkup(<ScoreMath parts={[]} score={0} />);
      expect(emptyHtml).toContain("0");
    });
  });

  describe("StatusPill", () => {
    const allStatuses: LeadStatus[] = [
      "ready",
      "filtered",
      "enrolled",
      "bounced",
      "replied",
      "halted",
      "completed",
    ];

    it("renders every lead status with its corresponding Pill tone and label", () => {
      for (const status of allStatuses) {
        const config = LEAD_STATUS_CONFIG[status];
        const html = renderToStaticMarkup(<StatusPill status={status} />);

        // Checks default label is rendered
        expect(html).toContain(config.label);

        // Checks expected tone styling is present
        if (config.tone === "warn") {
          expect(html).toContain("text-warn");
        } else if (config.tone === "accent") {
          expect(html).toContain("text-accent");
        } else if (config.tone === "good") {
          expect(html).toContain("text-good");
        } else if (config.tone === "bad") {
          expect(html).toContain("text-bad");
        } else if (config.tone === "neutral") {
          expect(html).toContain("text-muted");
        }
      }
    });

    it("allows custom children to override the default status label", () => {
      const html = renderToStaticMarkup(
        <StatusPill status="ready">Needs review</StatusPill>
      );
      expect(html).toContain("Needs review");
      expect(html).toContain("text-warn");
    });

    it("allows custom tone to override default tone", () => {
      const html = renderToStaticMarkup(
        <StatusPill status="ready" tone="good" />
      );
      expect(html).toContain("text-good");
    });
  });

  describe("SignalCard", () => {
    const fixedNow = new Date("2026-10-21T12:00:00Z");

    const sampleSignal: SignalView = {
      id: "sig-1",
      type: "hiring",
      category: "sales",
      title: "Founding Account Executive",
      excerpt: "Build our outbound motion from scratch and own the first $1M in pipeline.",
      sourceName: "Ashby job board",
      sourceUrl: "https://jobs.ashbyhq.com/example/123",
      occurredAt: "2026-10-21T06:00:00Z", // 6 hours before fixedNow
    };

    it("renders numbered card with type Tag, title, source, age, excerpt, and external link", () => {
      const html = renderToStaticMarkup(
        <SignalCard signal={sampleSignal} number={1} now={fixedNow} />
      );

      // Number
      expect(html).toContain("#1");

      // Type Tag uses the score-math words
      expect(html).toContain("Hiring");

      // Title
      expect(html).toContain("Founding Account Executive");

      // Source and external link
      expect(html).toContain("Ashby job board");
      expect(html).toContain('href="https://jobs.ashbyhq.com/example/123"');
      expect(html).toContain('target="_blank"');

      // Age calculation (6h ago)
      expect(html).toContain("6h ago");

      // Excerpt
      expect(html).toContain("Build our outbound motion from scratch");
    });

    it("computes number from index prop when number is not passed", () => {
      const html = renderToStaticMarkup(
        <SignalCard signal={sampleSignal} index={2} now={fixedNow} />
      );
      expect(html).toContain("#3");
    });

    it("renders gracefully without excerpt or sourceUrl", () => {
      const minimalSignal: SignalView = {
        id: "sig-2",
        type: "funding",
        category: null,
        title: "YC Winter 2026 Batch",
        excerpt: null,
        sourceName: "Y Combinator",
        sourceUrl: null,
        occurredAt: "2026-10-19T12:00:00Z", // 2 days before fixedNow
      };

      const html = renderToStaticMarkup(
        <SignalCard signal={minimalSignal} now={fixedNow} />
      );

      expect(html).toContain("YC recent");
      expect(html).toContain("YC Winter 2026 Batch");
      expect(html).toContain("Y Combinator");
      expect(html).toContain("2d ago");
      expect(html).not.toContain("<a");
    });
  });

  describe("BuyerCheck", () => {
    it("renders verified status with good pill and reason", () => {
      const html = renderToStaticMarkup(
        <BuyerCheck
          status="verified"
          reason="CEO at 12 people: owns sales until the founding AE starts"
        />
      );

      expect(html).toContain(BUYER_STATUS_CONFIG.verified.label);
      expect(html).toContain("text-good");
      expect(html).toContain("CEO at 12 people: owns sales until the founding AE starts");
    });

    it("renders rerouted status with accent pill and reason", () => {
      const html = renderToStaticMarkup(
        <BuyerCheck
          status="rerouted"
          reason="Rerouted to Head of Growth, who owns SDR hires"
        />
      );

      expect(html).toContain(BUYER_STATUS_CONFIG.rerouted.label);
      expect(html).toContain("text-accent");
      expect(html).toContain("Rerouted to Head of Growth, who owns SDR hires");
    });

    it("renders unverified status with warn pill and reason", () => {
      const html = renderToStaticMarkup(
        <BuyerCheck
          status="unverified"
          reason="At 80 people, sales leadership is unverified"
        />
      );

      expect(html).toContain(BUYER_STATUS_CONFIG.unverified.label);
      expect(html).toContain("text-warn");
      expect(html).toContain("At 80 people, sales leadership is unverified");
    });

    it("extracts status and reason from contact prop", () => {
      const html = renderToStaticMarkup(
        <BuyerCheck
          contact={{
            name: "Amara",
            title: "CEO",
            isPlaceholder: false,
            sendAddress: "amara@resend.dev",
            buyerStatus: "verified",
            buyerReason: "CEO owns sales",
          }}
        />
      );

      expect(html).toContain(BUYER_STATUS_CONFIG.verified.label);
      expect(html).toContain("CEO owns sales");
    });
  });
});

describe("SignalCard labels and quoting (review of F3.1)", () => {
  const base: SignalView = {
    id: "x",
    type: "hiring",
    category: "sales",
    title: "Hiring: Founding AE",
    excerpt: "Own the sales cycle.",
    sourceName: "Ashby",
    sourceUrl: null,
    occurredAt: "2026-10-20T10:00:00Z",
  };

  it("names signals with the score-math words", () => {
    expect(signalLabel(base)).toBe("Hiring");
    expect(signalLabel({ ...base, category: "marketing" })).toBe("Marketing hire");
    expect(signalLabel({ ...base, type: "launch", category: null })).toBe("Launch");
    expect(signalLabel({ ...base, type: "funding", category: null })).toBe("YC recent");
  });

  it("quotes hiring excerpts only, since launch and YC excerpts are our own summaries", () => {
    expect(renderToStaticMarkup(<SignalCard signal={base} />)).toContain("“Own the sales cycle.”");
    const launch = renderToStaticMarkup(
      <SignalCard signal={{ ...base, type: "launch", category: null, excerpt: "Show HN post with 42 points." }} />,
    );
    expect(launch).not.toContain("“");
    expect(launch).toContain("Show HN post with 42 points.");
  });
});
