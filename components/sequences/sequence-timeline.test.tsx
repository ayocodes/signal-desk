import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SequenceTimeline } from "./SequenceTimeline";
import type { SequenceTimeline as SequenceTimelineType } from "@/lib/types";

describe("SequenceTimeline component", () => {
  const sampleTimeline: SequenceTimelineType = {
    sequenceId: "seq-123",
    status: "active",
    approvedAt: "2026-10-21T10:00:00Z",
    approvedBy: { id: "user-1", name: "Alice Admin" },
    edited: true,
    steps: [
      {
        id: "step-1",
        key: "d1_open",
        label: "Opening email",
        status: "done",
        scheduledFor: "2026-10-21T10:00:00Z",
        sentAt: "2026-10-21T10:05:00Z",
        subject: "Quick question about outbound",
        body: "Hi Jane,\nSaw the recent hiring announcement.",
        mailbox: "outbound-primary",
        messageId: "msg-resend-abc123",
        writtenBy: "approved",
        writtenReason: null,
        branch: null,
        events: [
          { type: "delivered", source: "resend", at: "2026-10-21T10:06:00Z" },
          { type: "opened", source: "simulated", at: "2026-10-21T11:00:00Z" },
        ],
      },
      {
        id: "step-2",
        key: "d3_check",
        label: "Day 3 check",
        status: "done",
        scheduledFor: "2026-10-24T10:00:00Z",
        sentAt: "2026-10-24T10:01:00Z",
        subject: null,
        body: null,
        mailbox: null,
        messageId: null,
        writtenBy: null,
        writtenReason: null,
        branch: {
          chosen: "d4_followup_signal2",
          reason: "opened 1 time",
          opens: 1,
        },
        events: [],
      },
      {
        id: "step-3",
        key: "d4_followup_signal2",
        label: "Follow-up on another signal",
        status: "pending",
        scheduledFor: "2026-10-25T10:00:00Z",
        sentAt: null,
        subject: "Another angle on outbound",
        body: "Following up with more details.",
        mailbox: null,
        messageId: null,
        writtenBy: "template",
        writtenReason: "quota fallback",
        branch: null,
        events: [],
      },
    ],
  };

  it("renders header with sequence status, approved information, and edited indicator", () => {
    const html = renderToStaticMarkup(<SequenceTimeline timeline={sampleTimeline} />);

    expect(html).toContain("Sequence timeline");
    expect(html).toContain("active");
    expect(html).toContain("(edited)");
    expect(html).toContain("Alice Admin");
    expect(html).toContain("2026-10-21 10:00 UTC");
  });

  it("renders each step with label, status, and scheduled or sent time in mono", () => {
    const html = renderToStaticMarkup(<SequenceTimeline timeline={sampleTimeline} />);

    expect(html).toContain("Opening email");
    expect(html).toContain("Sent 2026-10-21 10:05 UTC");
    expect(html).toContain("Scheduled 2026-10-25 10:00 UTC");
    expect(html).toContain("done");
    expect(html).toContain("pending");
  });

  it("renders author indicator for approved, AI, or template with reason", () => {
    const html = renderToStaticMarkup(<SequenceTimeline timeline={sampleTimeline} />);

    expect(html).toContain("Approved");
    expect(html).toContain("Template (quota fallback)");
  });

  it("renders branch chosen and reason", () => {
    const html = renderToStaticMarkup(<SequenceTimeline timeline={sampleTimeline} />);

    expect(html).toContain("Branch:");
    expect(html).toContain("Follow-up on another signal"); // readable label, not the raw key
    expect(html).not.toContain(">d4_followup_signal2<");
    expect(html).toContain("opened 1 time");
  });

  it("renders mailbox and message ID when present, and never prints the word null", () => {
    const html = renderToStaticMarkup(<SequenceTimeline timeline={sampleTimeline} />);

    expect(html).toContain("outbound-primary");
    expect(html).toContain("msg-resend-abc123");
    // Ensure null is not rendered as text
    expect(html).not.toMatch(/>\s*null\s*</);
  });

  it("renders collapsible subject and body", () => {
    const html = renderToStaticMarkup(<SequenceTimeline timeline={sampleTimeline} />);

    expect(html).toContain("Subject: Quick question about outbound");
    expect(html).toContain("Saw the recent hiring announcement.");
  });

  it("renders events and shows Simulated tag on simulated events", () => {
    const html = renderToStaticMarkup(<SequenceTimeline timeline={sampleTimeline} />);

    expect(html).toContain("delivered");
    expect(html).toContain("opened");
    expect(html).toContain("Simulated");
  });

  it("does not contain em-dashes or en-dashes in rendered text", () => {
    const html = renderToStaticMarkup(<SequenceTimeline timeline={sampleTimeline} />);

    expect(html).not.toContain("—");
    expect(html).not.toContain("–");
  });

  it("is rendered within LeadDetail for enrolled leads", async () => {
    const { LeadDetail } = await import("@/components/queue/LeadDetail");
    const enrolledLead = {
      id: "lead-1",
      status: "enrolled" as const,
      score: 85,
      scoreParts: [["ICP match", 40]] as [string, number][],
      band: "Strong" as const,
      tier: "hi" as const,
      company: {
        id: "c-1",
        name: "Acme",
        domain: "acme.dev",
        icpTier: "full" as const,
        icpReasons: [],
        teamSize: 20,
        ycBatch: null,
        description: null,
        industries: [],
      },
      contact: null,
      topSignal: null,
      signals: [],
      signalTypes: [],
      newestSignalAt: null,
      assignee: null,
      updatedAt: "2026-10-21T10:00:00Z",
      filteredReason: null,
    };

    const html = renderToStaticMarkup(
      <LeadDetail lead={enrolledLead} viewerRole="admin" now={Date.now()} timeline={sampleTimeline} />
    );

    expect(html).toContain("Sequence timeline");
    expect(html).toContain("Opening email");
  });
});
