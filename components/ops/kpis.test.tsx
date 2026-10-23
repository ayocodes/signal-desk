import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { KpiStrip, formatRatio } from "./KpiStrip";
import { ReplyRateBySignal } from "./ReplyRateBySignal";
import type { OpsKpis, SignalReplyRate } from "@/lib/types";

describe("formatRatio helper", () => {
  it("returns 'No data yet' when total is 0 or pct is null", () => {
    expect(formatRatio({ count: 0, total: 0, pct: null })).toBe("No data yet");
  });

  it("formats counts next to percentages when total is greater than 0", () => {
    expect(formatRatio({ count: 2, total: 3, pct: 66.7 })).toBe("2 of 3, 66.7%");
    expect(formatRatio({ count: 1, total: 1, pct: 100 })).toBe("1 of 1, 100%");
    expect(formatRatio({ count: 0, total: 5, pct: 0 })).toBe("0 of 5, 0%");
  });
});

describe("KpiStrip component", () => {
  const sampleKpis: OpsKpis = {
    leadsScoredToday: 142,
    enrolled: 12,
    editedBeforeSend: { count: 2, total: 3, pct: 66.7 },
    bouncesRecovered: { count: 1, total: 2, pct: 50 },
    replyRate: { count: 3, total: 5, pct: 60, simulated: true },
  };

  it("renders all KPI labels and values with mono tabular-nums", () => {
    const html = renderToStaticMarkup(<KpiStrip kpis={sampleKpis} />);

    expect(html).toContain("Scored today");
    expect(html).toContain("142");
    expect(html).toContain("Enrolled");
    expect(html).toContain("12");
    expect(html).toContain("Edited before send");
    expect(html).toContain("2 of 3, 66.7%");
    expect(html).toContain("Bounces recovered");
    expect(html).toContain("1 of 2, 50%");
    expect(html).toContain("Reply rate");
    expect(html).toContain("3 of 5, 60%");
    expect(html).toContain("font-mono");
    expect(html).toContain("tabular-nums");
  });

  it("shows 'No data yet' and never '0%' when total is 0 or pct is null", () => {
    const emptyKpis: OpsKpis = {
      leadsScoredToday: null,
      enrolled: 0,
      editedBeforeSend: { count: 0, total: 0, pct: null },
      bouncesRecovered: { count: 0, total: 0, pct: null },
      replyRate: { count: 0, total: 0, pct: null, simulated: false },
    };

    const html = renderToStaticMarkup(<KpiStrip kpis={emptyKpis} />);

    expect(html).toContain("No data yet");
    expect(html).not.toContain("0%");
  });

  it("renders Simulated Tag when replyRate has simulated true", () => {
    const html = renderToStaticMarkup(<KpiStrip kpis={sampleKpis} />);
    expect(html).toContain("Simulated");
  });

  it("does not render Simulated Tag when replyRate has simulated false", () => {
    const nonSimulatedKpis: OpsKpis = {
      ...sampleKpis,
      replyRate: { count: 1, total: 2, pct: 50, simulated: false },
    };

    const html = renderToStaticMarkup(<KpiStrip kpis={nonSimulatedKpis} />);
    expect(html).not.toContain("Simulated");
  });

  it("does not contain em-dashes or en-dashes", () => {
    const html = renderToStaticMarkup(<KpiStrip kpis={sampleKpis} />);
    expect(html).not.toContain("—");
    expect(html).not.toContain("–");
  });
});

describe("ReplyRateBySignal component", () => {
  const sampleRates: SignalReplyRate[] = [
    { type: "hiring", count: 2, total: 3, pct: 66.7, simulated: false },
    { type: "launch", count: 1, total: 2, pct: 50, simulated: true },
    { type: "funding", count: 0, total: 0, pct: null, simulated: false },
  ];

  it("renders horizontal bars with CSS width and counts next to percentages", () => {
    const html = renderToStaticMarkup(<ReplyRateBySignal rates={sampleRates} />);

    expect(html).toContain("Reply rate by signal");
    expect(html).toContain("Hiring");
    expect(html).toContain("2 of 3, 66.7%");
    expect(html).toContain('style="width:66.7%"');

    expect(html).toContain("Launch");
    expect(html).toContain("1 of 2, 50%");
    expect(html).toContain('style="width:50%"');

    expect(html).toContain("Funding");
    expect(html).toContain("No data yet");
  });

  it("shows 'No data yet' and never '0%' for null pct", () => {
    const emptyRates: SignalReplyRate[] = [
      { type: "hiring", count: 0, total: 0, pct: null, simulated: false },
      { type: "launch", count: 0, total: 0, pct: null, simulated: false },
      { type: "funding", count: 0, total: 0, pct: null, simulated: false },
    ];

    const html = renderToStaticMarkup(<ReplyRateBySignal rates={emptyRates} />);
    expect(html).toContain("No data yet");
    expect(html).not.toContain("0%");
  });

  it("renders Simulated Tag and note when simulated is true", () => {
    const html = renderToStaticMarkup(<ReplyRateBySignal rates={sampleRates} />);
    expect(html).toContain("Simulated");
    expect(html).toContain("Includes simulated replies from admin actions.");
  });

  it("does not render Simulated Tag or note when all simulated are false", () => {
    const cleanRates: SignalReplyRate[] = [
      { type: "hiring", count: 1, total: 2, pct: 50, simulated: false },
    ];

    const html = renderToStaticMarkup(<ReplyRateBySignal rates={cleanRates} />);
    expect(html).not.toContain("Simulated");
    expect(html).not.toContain("Includes simulated replies");
  });

  it("does not contain em-dashes or en-dashes", () => {
    const html = renderToStaticMarkup(<ReplyRateBySignal rates={sampleRates} />);
    expect(html).not.toContain("—");
    expect(html).not.toContain("–");
  });
});
