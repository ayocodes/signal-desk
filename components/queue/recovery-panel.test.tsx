import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { RecoveryPanel } from "./RecoveryPanel";
import { LeadDetail } from "./LeadDetail";
import type { LeadDetail as LeadDetailType, RecoveryProposal } from "@/lib/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => "/queue",
}));

const mockResendToCorrected = vi.fn();
vi.mock("@/lib/api", () => ({
  resendToCorrected: (leadId: string, proposalId: string) =>
    mockResendToCorrected(leadId, proposalId),
}));

describe("RecoveryPanel component", () => {
  const pendingProposal: RecoveryProposal = {
    id: "prop-1",
    originalAddress: "bounced+jane@resend.dev",
    proposedAddress: "delivered+jane@resend.dev",
    bounceCode: "5.1.1",
    reason: "Recipient address does not exist, corrected to primary inbox",
    status: "pending",
    createdAt: "2026-10-21T10:00:00Z",
  };

  const approvedProposal: RecoveryProposal = {
    ...pendingProposal,
    id: "prop-2",
    status: "approved",
  };

  it("renders bounce code, original address, and proposed address in monospace", () => {
    const html = renderToStaticMarkup(
      <RecoveryPanel leadId="lead-1" proposal={pendingProposal} />
    );

    expect(html).toContain("5.1.1");
    expect(html).toContain("bounced+jane@resend.dev");
    expect(html).toContain("delivered+jane@resend.dev");
    expect(html).toContain("font-mono");
    expect(html).toContain("Recipient address does not exist, corrected to primary inbox");
    expect(html).toContain("Resend to corrected address");
  });

  it("renders approved state showing Resent to address", () => {
    const html = renderToStaticMarkup(
      <RecoveryPanel leadId="lead-1" proposal={approvedProposal} />
    );

    expect(html).toContain("Resent to");
    expect(html).toContain("delivered+jane@resend.dev");
    expect(html).not.toContain("Resend to corrected address");
  });

  it("does not contain em-dashes or en-dashes in rendered text", () => {
    const html = renderToStaticMarkup(
      <RecoveryPanel leadId="lead-1" proposal={pendingProposal} />
    );

    expect(html).not.toContain("—");
    expect(html).not.toContain("–");
  });

  it("is rendered inside LeadDetail when lead is bounced and has recovery proposal", () => {
    const bouncedLead: LeadDetailType = {
      id: "lead-bounced",
      status: "bounced",
      score: 75,
      scoreParts: [["ICP match", 40]] as [string, number][],
      band: "Borderline",
      tier: "md",
      company: {
        id: "comp-1",
        name: "Ledgerline",
        domain: "ledgerline.co",
        icpTier: "full",
        icpReasons: [],
        teamSize: 15,
        ycBatch: null,
        description: null,
        industries: [],
      },
      contact: {
        name: "Jane Founder",
        title: "CEO",
        isPlaceholder: false,
        sendAddress: "bounced+jane@resend.dev",
        buyerStatus: "verified",
        buyerReason: "CEO runs outbound",
      },
      topSignal: null,
      signals: [],
      signalTypes: [],
      newestSignalAt: null,
      assignee: null,
      updatedAt: "2026-10-21T10:00:00Z",
      filteredReason: null,
    };

    const html = renderToStaticMarkup(
      <LeadDetail
        lead={bouncedLead}
        viewerRole="admin"
        now={Date.now()}
        recoveryProposal={pendingProposal}
      />
    );

    expect(html).toContain("Bounce recovery");
    expect(html).toContain("5.1.1");
    expect(html).toContain("bounced+jane@resend.dev");
    expect(html).toContain("delivered+jane@resend.dev");
    expect(html).toContain("Resend to corrected address");
  });
});
