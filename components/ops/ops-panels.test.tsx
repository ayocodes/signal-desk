import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MailboxHealthTable } from "./MailboxHealthTable";
import { ResumeMailboxButton } from "./ResumeMailboxButton";
import { EnginePanel } from "./EnginePanel";
import { AuditLogStream } from "./AuditLogStream";
import type {
  AuditRow,
  BoardCoverage,
  EngineStats,
  MailboxHealth,
} from "@/lib/types";

const mockPush = vi.fn();
const mockRefresh = vi.fn();
const mockReplace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh, push: mockPush, replace: mockReplace }),
}));

const mockResumeMailbox = vi.fn();
vi.mock("@/lib/api", () => ({
  resumeMailbox: (id: string) => mockResumeMailbox(id),
}));

describe("ResumeMailboxButton component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a Resume button", () => {
    const html = renderToStaticMarkup(<ResumeMailboxButton mailboxId="mb-1" />);
    expect(html).toContain("Resume");
  });
});

describe("MailboxHealthTable component", () => {
  const sampleMailboxes: MailboxHealth[] = [
    {
      id: "mb-1",
      label: "outbound-primary",
      sendVia: "resend",
      status: "healthy",
      pauseReason: null,
      pausedAt: null,
      sentToday: 15,
      dailyCap: 50,
      bounceRate: 1.2,
      complaintRate: 0,
      ratesSince: null,
      auth: {
        domain: "signaldesk.co",
        spf: "v=spf1 include:resend.com ~all",
        dmarc: "v=DMARC1; p=none;",
        dkim: "managed by provider",
        checkedOn: "2026-10-23",
      },
    },
    {
      id: "mb-2",
      label: "outbound-secondary",
      sendVia: "resend",
      status: "paused",
      pauseReason: "Complaint rate 50.00% (limit 0.3%) after 20 sends",
      pausedAt: "2026-10-22T14:00:00Z",
      sentToday: 50,
      dailyCap: 50,
      bounceRate: 5.0,
      complaintRate: 2.5,
      ratesSince: "2026-10-20T10:00:00Z",
      auth: null,
    },
    {
      id: "mb-3",
      label: "outbound-tertiary",
      sendVia: "resend",
      status: "near_cap",
      pauseReason: null,
      pausedAt: null,
      sentToday: 48,
      dailyCap: 50,
      bounceRate: 0,
      complaintRate: 0,
      ratesSince: null,
      auth: null,
    },
  ];

  it("renders readable status labels instead of raw enum keys", () => {
    const html = renderToStaticMarkup(
      <MailboxHealthTable mailboxes={sampleMailboxes} />
    );

    expect(html).toContain("Healthy");
    expect(html).toContain("Paused");
    expect(html).toContain("Near cap");
    expect(html).not.toContain(">near_cap<");
  });

  it("renders DNS authentication (SPF, DMARC, DKIM) and handles null auth", () => {
    const html = renderToStaticMarkup(
      <MailboxHealthTable mailboxes={sampleMailboxes} />
    );

    expect(html).toContain("SPF pass");
    expect(html).toContain("DMARC pass");
    expect(html).toContain("DKIM");
    expect(html).toContain("No data yet");
  });

  it("renders sent/cap meters, bounce rates, and complaint rates", () => {
    const html = renderToStaticMarkup(
      <MailboxHealthTable mailboxes={sampleMailboxes} />
    );

    expect(html).toContain("15 of 50");
    expect(html).toContain("1.2%");
    expect(html).toContain("5%");
    expect(html).toContain("2.5%");
  });

  it("renders pause reason, Resume button, and restart note for paused mailboxes", () => {
    const html = renderToStaticMarkup(
      <MailboxHealthTable mailboxes={sampleMailboxes} />
    );

    expect(html).toContain(
      "Complaint rate 50.00% (limit 0.3%) after 20 sends"
    );
    expect(html).toContain("Resume");
    expect(html).toContain("Its bounce and complaint rates restart from now.");
  });

  it("shows Rates since date when ratesSince is set", () => {
    const html = renderToStaticMarkup(
      <MailboxHealthTable mailboxes={sampleMailboxes} />
    );

    expect(html).toContain("Rates since 2026-10-20");
  });

  it("does not contain em-dashes or en-dashes", () => {
    const html = renderToStaticMarkup(
      <MailboxHealthTable mailboxes={sampleMailboxes} />
    );

    expect(html).not.toContain("—");
    expect(html).not.toContain("–");
  });
});

describe("EnginePanel component", () => {
  const sampleStats: EngineStats = {
    lastRun: {
      trigger: "schedule",
      startedAt: "2026-10-23T06:00:00Z",
      finishedAt: "2026-10-23T06:01:16Z",
      errors: 0,
    },
    runs: 50,
    p50Ms: 76700,
    p95Ms: 120500,
    leadsPerRun: 18,
    tokensPerLead: 2450,
    errorRate: { count: 2, total: 50, pct: 4 },
    draftsBlocked: { count: 1, total: 30, pct: 3.3 },
  };

  const sampleCoverage: BoardCoverage = {
    companies: 1060,
    sites: [
      { site: "greenhouse", checked: 840 },
      { site: "lever", checked: 420 },
      { site: "ashby", checked: 120 },
    ],
    lastLocalRun: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
  };

  it("renders duration in seconds from milliseconds", () => {
    const html = renderToStaticMarkup(
      <EnginePanel stats={sampleStats} coverage={sampleCoverage} />
    );

    expect(html).toContain("76.7 s");
    expect(html).toContain("120.5 s");
  });

  it("renders ratios and null values cleanly", () => {
    const html = renderToStaticMarkup(
      <EnginePanel stats={sampleStats} coverage={sampleCoverage} />
    );

    expect(html).toContain("2 of 50, 4%");
    expect(html).toContain("1 of 30, 3.3%");
    expect(html).toContain("18");
    expect(html).toContain("2450");
  });

  it("renders readable job-board coverage with note for Ashby", () => {
    const html = renderToStaticMarkup(
      <EnginePanel stats={sampleStats} coverage={sampleCoverage} />
    );

    expect(html).toContain("Greenhouse");
    expect(html).toContain("Lever");
    expect(html).toContain("Ashby");
    expect(html).toContain("Ashby checked for 120 of 1,060 companies");
    expect(html).toContain("last local run 2 hours ago");
    expect(html).toContain("Ashby is checked only on local runs.");
  });

  it("does not contain em-dashes or en-dashes", () => {
    const html = renderToStaticMarkup(
      <EnginePanel stats={sampleStats} coverage={sampleCoverage} />
    );

    expect(html).not.toContain("—");
    expect(html).not.toContain("–");
  });
});

describe("AuditLogStream component", () => {
  const sampleRows: AuditRow[] = [
    {
      id: "a-1",
      createdAt: "2026-10-23T07:15:00Z",
      actorType: "agent",
      actorName: null,
      action: "sequence.step_sent",
      entityType: "sequence_step",
      entityId: "step-123",
      detail: {},
    },
    {
      id: "a-2",
      createdAt: "2026-10-23T07:10:00Z",
      actorType: "user",
      actorName: "Alice Admin",
      action: "lead.approved",
      entityType: "lead",
      entityId: "lead-456",
      detail: {},
    },
  ];

  const groups = ["lead", "sequence", "mailbox", "agent"];

  it("renders readable actor labels instead of raw keys", () => {
    const html = renderToStaticMarkup(
      <AuditLogStream rows={sampleRows} groups={groups} />
    );

    expect(html).toContain("Agent");
    expect(html).toContain("User");
    expect(html).toContain("Alice Admin");
    expect(html).toContain("sequence.step_sent");
    expect(html).toContain("lead.approved");
  });

  it("renders mono timestamps", () => {
    const html = renderToStaticMarkup(
      <AuditLogStream rows={sampleRows} groups={groups} />
    );

    expect(html).toContain("font-mono");
    expect(html).toContain("2026-10-23 07:15 UTC");
  });

  it("does not contain em-dashes or en-dashes", () => {
    const html = renderToStaticMarkup(
      <AuditLogStream rows={sampleRows} groups={groups} />
    );

    expect(html).not.toContain("—");
    expect(html).not.toContain("–");
  });
});
