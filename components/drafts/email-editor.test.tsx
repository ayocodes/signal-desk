import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { EmailEditor } from "./EmailEditor";
import type { DraftWorkspace, LeadDetail as LeadDetailType } from "@/lib/types";

// Always mock lib/api in tests (no real routes called)
vi.mock("@/lib/api", () => ({
  generateDraft: vi.fn(),
  approveLead: vi.fn(),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/queue",
}));

describe("EmailEditor component", () => {
  const sampleLead: LeadDetailType = {
    id: "lead-101",
    status: "ready",
    score: 85,
    scoreParts: [
      ["ICP match", 40],
      ["Hiring", 30],
      ["Fresh", 15],
    ],
    band: "Good",
    tier: "md",
    company: {
      id: "c-101",
      name: "Acme Analytics",
      domain: "acme.io",
      icpTier: "full",
      icpReasons: ["B2B software", "Team of 20"],
      teamSize: 20,
      ycBatch: "W25",
      description: "BI tools for startups",
      industries: ["B2B", "Analytics"],
    },
    contact: {
      name: "Alex Smith",
      title: "Co-Founder",
      isPlaceholder: false,
      sendAddress: "delivered+acme@resend.dev",
      buyerStatus: "verified",
      buyerReason: "Co-Founder leads sales",
    },
    topSignal: {
      id: "sig-1",
      type: "hiring",
      category: "sales",
      title: "Founding AE",
      excerpt: "Building out our initial outbound sales pipeline",
      sourceName: "Ashby",
      sourceUrl: "https://jobs.ashbyhq.com/acme/1",
      occurredAt: "2026-10-21T08:00:00Z",
    },
    signals: [
      {
        id: "sig-1",
        type: "hiring",
        category: "sales",
        title: "Founding AE",
        excerpt: "Building out our initial outbound sales pipeline",
        sourceName: "Ashby",
        sourceUrl: "https://jobs.ashbyhq.com/acme/1",
        occurredAt: "2026-10-21T08:00:00Z",
      },
    ],
    signalTypes: ["hiring"],
    newestSignalAt: "2026-10-21T08:00:00Z",
    assignee: { id: "rep-1", name: "Demo Rep" },
    updatedAt: "2026-10-21T08:00:00Z",
    filteredReason: null,
  };

  const sampleWorkspace: DraftWorkspace = {
    drafts: [
      {
        id: "draft-1",
        angle: "signal",
        subject: "Quick question on outbound at Acme",
        body: "Saw you are hiring a Founding AE to build your initial outbound sales pipeline. We help seed teams scale precision outreach without manual scraping. Worth a short chat?",
        groundedPhrases: ["Founding AE", "outbound sales pipeline"],
        checks: [
          { check: "angle", status: "pass", message: "Approvable angle" },
          {
            check: "grounding",
            status: "pass",
            message: 'Grounded: "Founding AE"',
          },
        ],
        passed: true,
        model: "gemini-2.0-flash",
        tokensIn: 450,
        tokensOut: 85,
        prompt: "Write an outreach email for Acme...",
        trace: {
          source: "agent",
          promptHash: "hash-12345",
          signals: [
            { label: "Signal 1", title: "Founding AE" },
          ],
          attempts: [
            {
              attempt: 1,
              model: "gemini-2.0-flash",
              tokensIn: 450,
              tokensOut: 85,
              ms: 1200,
              error: null,
              failedChecks: {},
            },
          ],
          chosenAttempt: 1,
          tokensSharedByAngles: true,
        },
        createdAt: "2026-10-21T09:00:00Z",
        createdBy: null,
      },
    ],
    sender: {
      name: "Sam",
      company: "Signal Desk",
      fromAddress: "delivered@resend.dev",
    },
    guardrailRules: {
      maxBodyWords: 80,
      requireClosingQuestion: true,
      bannedChars: ["—", "–"],
      bannedPhrases: ["I hope this email finds you well"],
      claimPhrases: ["guarantee 10x ROI"],
      minGroundedPhraseChars: 4,
      maxSubjectChars: 50,
      proofPoints: ["scaled 40 B2B teams"],
    },
    llmBudget: { used: 7, limit: 20, agentLimit: 16 },
  };

  it("renders empty state when workspace has no drafts", () => {
    const emptyWorkspace: DraftWorkspace = {
      ...sampleWorkspace,
      drafts: [],
    };

    const html = renderToStaticMarkup(
      <EmailEditor lead={sampleLead} workspace={emptyWorkspace} />
    );

    expect(html).toContain("No drafts yet");
    expect(html).toContain(
      "The agent will draft this lead on its next run."
    );
  });

  it("renders angle picker with all four angles including Unconstrained in bad tone", () => {
    const html = renderToStaticMarkup(
      <EmailEditor lead={sampleLead} workspace={sampleWorkspace} />
    );

    expect(html).toContain("Signal");
    expect(html).toContain("Peer");
    expect(html).toContain("Short");
    expect(html).toContain("Unconstrained");
  });

  it("renders From and To read-only fields in monospace", () => {
    const html = renderToStaticMarkup(
      <EmailEditor lead={sampleLead} workspace={sampleWorkspace} />
    );

    expect(html).toContain("Sam at delivered@resend.dev");
    expect(html).toContain("delivered+acme@resend.dev");
    expect(html).toContain("font-mono");
  });

  it("renders subject and body fields with draft content", () => {
    const html = renderToStaticMarkup(
      <EmailEditor lead={sampleLead} workspace={sampleWorkspace} />
    );

    expect(html).toContain("Quick question on outbound at Acme");
    expect(html).toContain(
      "Saw you are hiring a Founding AE to build your initial outbound sales pipeline"
    );
  });

  it("renders live checks list with check titles and messages", () => {
    const html = renderToStaticMarkup(
      <EmailEditor lead={sampleLead} workspace={sampleWorkspace} />
    );

    expect(html).toContain("Live checks");
    expect(html).toContain("Grounding");
    expect(html).toContain("Word count");
    expect(html).toContain("Closing question");
    expect(html).toContain("Ends with a question");
  });

  it("renders Regenerate button and Approve and enroll button with ⌘↵ shortcut hint", () => {
    const html = renderToStaticMarkup(
      <EmailEditor lead={sampleLead} workspace={sampleWorkspace} />
    );

    expect(html).toContain("Regenerate");
    expect(html).toContain("Approve and enroll");
    expect(html).toContain("⌘↵");
  });

  function getApproveButton(html: string): string {
    const match = html.match(/<button[^>]*aria-label="Approve and enroll"[^>]*>/);
    return match ? match[0] : "";
  }

  it("enables Approve and enroll button when all checks pass on an approvable angle", () => {
    const html = renderToStaticMarkup(
      <EmailEditor lead={sampleLead} workspace={sampleWorkspace} />
    );

    const btn = getApproveButton(html);
    expect(btn).toBeTruthy();
    expect(btn).not.toMatch(/\sdisabled([=>\s]|$)/);
  });

  it("disables Approve and enroll button on Unconstrained angle", () => {
    const rawWorkspace: DraftWorkspace = {
      ...sampleWorkspace,
      drafts: [
        {
          ...sampleWorkspace.drafts[0],
          id: "draft-raw",
          angle: "raw",
          subject: "Unconstrained cold email",
          body: "Buy our product today for great value.",
        },
      ],
    };

    const html = renderToStaticMarkup(
      <EmailEditor lead={sampleLead} workspace={rawWorkspace} />
    );

    const btn = getApproveButton(html);
    expect(btn).toBeTruthy();
    expect(btn).toMatch(/\sdisabled([=>\s]|$)/);
    expect(html).toContain("Unconstrained drafts can&#x27;t be approved");
  });

  it("disables Approve and enroll button when a guardrail check fails", () => {
    const failingWorkspace: DraftWorkspace = {
      ...sampleWorkspace,
      drafts: [
        {
          ...sampleWorkspace.drafts[0],
          id: "draft-fail",
          subject: "Check this out",
          // Missing signal phrase, no closing question
          body: "Hello there, we provide tools.",
          groundedPhrases: ["Founding AE"],
        },
      ],
    };

    const html = renderToStaticMarkup(
      <EmailEditor lead={sampleLead} workspace={failingWorkspace} />
    );

    const btn = getApproveButton(html);
    expect(btn).toBeTruthy();
    expect(btn).toMatch(/\sdisabled([=>\s]|$)/);
  });

  it("renders Agent trace collapsible with source, attempt, and signal details", () => {
    const html = renderToStaticMarkup(
      <EmailEditor lead={sampleLead} workspace={sampleWorkspace} />
    );

    expect(html).toContain("Agent trace");
    expect(html).toContain("hash-12345");
    expect(html).toContain("Attempt 1");
    expect(html).toContain("450 in / 85 out tokens");
    expect(html).toContain("Tokens were shared across all angles");
  });

  it("renders Prompt sent to the model collapsible with prompt content", () => {
    const html = renderToStaticMarkup(
      <EmailEditor lead={sampleLead} workspace={sampleWorkspace} />
    );

    expect(html).toContain("Prompt sent to the model");
    expect(html).toContain("Write an outreach email for Acme...");
  });

  it("renders fallbacks when trace and prompt are null", () => {
    const noTraceWorkspace: DraftWorkspace = {
      ...sampleWorkspace,
      drafts: [
        {
          ...sampleWorkspace.drafts[0],
          trace: null,
          prompt: null,
        },
      ],
    };

    const html = renderToStaticMarkup(
      <EmailEditor lead={sampleLead} workspace={noTraceWorkspace} />
    );

    expect(html).toContain("No agent trace recorded for this draft.");
    expect(html).toContain("No prompt recorded for this draft.");
  });

  it("lists only the angles that actually failed in the agent trace", () => {
    const base = sampleWorkspace.drafts[0];
    const traced: DraftWorkspace = {
      ...sampleWorkspace,
      drafts: [
        {
          ...base,
          trace: {
            ...base.trace!,
            attempts: [{ ...base.trace!.attempts[0], failedChecks: { signal: [], peer: ["claims"], short: [] } }],
          },
        },
      ],
    };
    const html = renderToStaticMarkup(<EmailEditor lead={sampleLead} workspace={traced} />);
    expect(html).toContain("[peer: claims]");
    expect(html).not.toContain("[signal: ]");

    const clean: DraftWorkspace = {
      ...sampleWorkspace,
      drafts: [
        {
          ...base,
          trace: { ...base.trace!, attempts: [{ ...base.trace!.attempts[0], failedChecks: { signal: [], peer: [] } }] },
        },
      ],
    };
    expect(renderToStaticMarkup(<EmailEditor lead={sampleLead} workspace={clean} />)).not.toContain("Failed checks");
  });

  it("disables Regenerate on Unconstrained (it is generated once and stored)", () => {
    const rawOnly: DraftWorkspace = {
      ...sampleWorkspace,
      drafts: [{ ...sampleWorkspace.drafts[0], id: "draft-raw", angle: "raw" }],
    };
    const html = renderToStaticMarkup(<EmailEditor lead={sampleLead} workspace={rawOnly} />);
    const regenerate = html.match(/<button[^>]*aria-label="Regenerate draft"[^>]*>/)?.[0] ?? "";
    expect(regenerate).toMatch(/\sdisabled([=>\s]|$)/);
  });
});
