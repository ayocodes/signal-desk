import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SequenceTimeline } from "./SequenceTimeline";
import { SimulateMenu } from "./SimulateMenu";
import { TestInboxControl } from "./TestInboxControl";
import { LeadDetail } from "@/components/queue/LeadDetail";
import type { LeadDetail as LeadDetailType, SequenceTimeline as SequenceTimelineType } from "@/lib/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/queue",
}));

vi.mock("@/lib/api", () => ({
  simulateReply: vi.fn(),
  simulateOpen: vi.fn(),
  fastForward: vi.fn(),
  setTestInbox: vi.fn(),
}));

describe("SimulateMenu component", () => {
  const sampleTimeline: SequenceTimelineType = {
    sequenceId: "seq-1",
    status: "active",
    approvedAt: "2026-10-21T10:00:00Z",
    approvedBy: { id: "u-1", name: "Admin User" },
    edited: false,
    steps: [
      {
        id: "step-1",
        key: "d1_open",
        label: "Opening email",
        status: "sent",
        scheduledFor: "2026-10-21T10:00:00Z",
        sentAt: "2026-10-21T10:05:00Z",
        subject: "Hello",
        body: "Body",
        mailbox: "mb-1",
        messageId: "msg-1",
        writtenBy: "approved",
        writtenReason: null,
        branch: null,
        events: [],
      },
    ],
  };

  it("renders the Simulate button with aria attributes", () => {
    const html = renderToStaticMarkup(
      <SimulateMenu leadId="lead-1" timeline={sampleTimeline} />
    );

    expect(html).toContain("Simulate");
    expect(html).toContain('aria-haspopup="true"');
    expect(html).toContain('aria-expanded="false"');
  });

  it("does not contain em-dashes or en-dashes", () => {
    const html = renderToStaticMarkup(
      <SimulateMenu leadId="lead-1" timeline={sampleTimeline} />
    );

    expect(html).not.toContain("—");
    expect(html).not.toContain("–");
  });
});

describe("TestInboxControl component", () => {
  it("renders the current send address in monospace", () => {
    const html = renderToStaticMarkup(
      <TestInboxControl
        leadId="lead-1"
        initialAddress="delivered+abc@resend.dev"
      />
    );

    expect(html).toContain("Send address:");
    expect(html).toContain("delivered+abc@resend.dev");
    expect(html).toContain("font-mono");
  });

  it("renders the three inbox choices: Delivered, Bounced, Complained", () => {
    const html = renderToStaticMarkup(
      <TestInboxControl
        leadId="lead-1"
        initialAddress="delivered+abc@resend.dev"
      />
    );

    expect(html).toContain("Delivered");
    expect(html).toContain("Bounced");
    expect(html).toContain("Complained");
    expect(html).toContain("Test inbox:");
  });

  it("renders the user decision text verbatim", () => {
    const html = renderToStaticMarkup(
      <TestInboxControl
        leadId="lead-1"
        initialAddress="bounced+xyz@resend.dev"
      />
    );

    expect(html).toContain(
      "Real Resend events follow: a bounce or complaint here is genuine, only the inbox was chosen."
    );
  });

  it("marks the matching inbox choice as checked", () => {
    const htmlBounced = renderToStaticMarkup(
      <TestInboxControl
        leadId="lead-1"
        initialAddress="bounced+123@resend.dev"
      />
    );
    expect(htmlBounced).toContain('aria-checked="true"');

    const htmlComplained = renderToStaticMarkup(
      <TestInboxControl
        leadId="lead-1"
        initialAddress="complained+123@resend.dev"
      />
    );
    expect(htmlComplained).toContain('aria-checked="true"');
  });

  it("shows placeholder note when contact is a placeholder", () => {
    const html = renderToStaticMarkup(
      <TestInboxControl
        leadId="lead-1"
        initialAddress="delivered+abc@resend.dev"
        isPlaceholder={true}
      />
    );

    expect(html).toContain("(a test inbox: we never email real people)");
  });

  it("does not contain em-dashes or en-dashes", () => {
    const html = renderToStaticMarkup(
      <TestInboxControl
        leadId="lead-1"
        initialAddress="delivered+abc@resend.dev"
      />
    );

    expect(html).not.toContain("—");
    expect(html).not.toContain("–");
  });
});

describe("Admin vs rep role visibility", () => {
  const sampleTimeline: SequenceTimelineType = {
    sequenceId: "seq-1",
    status: "active",
    approvedAt: "2026-10-21T10:00:00Z",
    approvedBy: { id: "u-1", name: "Admin User" },
    edited: false,
    steps: [],
  };

  const enrolledLead: LeadDetailType = {
    id: "lead-enrolled-1",
    status: "enrolled",
    score: 88,
    scoreParts: [["ICP match", 40]] as [string, number][],
    band: "Strong",
    tier: "hi",
    company: {
      id: "c-1",
      name: "Acme Corp",
      domain: "acme.corp",
      icpTier: "full",
      icpReasons: [],
      teamSize: 25,
      ycBatch: "W24",
      description: "B2B sales tools",
      industries: ["B2B"],
    },
    contact: {
      name: "Jane Doe",
      title: "CEO",
      isPlaceholder: false,
      sendAddress: "delivered+jane@resend.dev",
      buyerStatus: "verified",
      buyerReason: "CEO leads sales",
    },
    topSignal: null,
    signals: [],
    signalTypes: [],
    newestSignalAt: null,
    assignee: null,
    updatedAt: "2026-10-21T10:00:00Z",
    filteredReason: null,
  };

  it("SequenceTimeline renders Simulate button for admin and hides it for rep", () => {
    const adminHtml = renderToStaticMarkup(
      <SequenceTimeline
        timeline={sampleTimeline}
        leadId="lead-enrolled-1"
        viewerRole="admin"
      />
    );
    expect(adminHtml).toContain("Simulate");

    const repHtml = renderToStaticMarkup(
      <SequenceTimeline
        timeline={sampleTimeline}
        leadId="lead-enrolled-1"
        viewerRole="rep"
      />
    );
    expect(repHtml).not.toContain("Simulate");
  });

  it("LeadDetail renders Simulate menu and Test inbox control for admin", () => {
    const html = renderToStaticMarkup(
      <LeadDetail
        lead={enrolledLead}
        viewerRole="admin"
        now={Date.now()}
        timeline={sampleTimeline}
      />
    );

    // Simulate menu is present
    expect(html).toContain("Simulate");

    // Test inbox control is present
    expect(html).toContain("Test inbox:");
    expect(html).toContain("Delivered");
    expect(html).toContain("Bounced");
    expect(html).toContain("Complained");
    expect(html).toContain(
      "Real Resend events follow: a bounce or complaint here is genuine, only the inbox was chosen."
    );
  });

  it("LeadDetail hides Simulate menu and Test inbox control for rep", () => {
    const html = renderToStaticMarkup(
      <LeadDetail
        lead={enrolledLead}
        viewerRole="rep"
        now={Date.now()}
        timeline={sampleTimeline}
      />
    );

    // No Simulate menu anywhere
    expect(html).not.toContain("Simulate");

    // No Test inbox control (Delivered, Bounced, Complained options)
    expect(html).not.toContain("Test inbox:");
    expect(html).not.toContain(
      "Real Resend events follow: a bounce or complaint here is genuine, only the inbox was chosen."
    );

    // Still renders normal send address
    expect(html).toContain("Send address:");
    expect(html).toContain("delivered+jane@resend.dev");
  });
});
