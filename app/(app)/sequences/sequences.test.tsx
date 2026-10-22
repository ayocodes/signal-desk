import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import SequencesPage from "./page";
import type { SequenceRow } from "@/lib/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/sequences",
}));

const mockListSequences = vi.fn();
vi.mock("@/lib/data/sequences", () => ({
  listSequences: () => mockListSequences(),
}));

describe("SequencesPage", () => {
  it("renders empty state when there are no sequences", async () => {
    mockListSequences.mockResolvedValueOnce([]);
    const jsx = await SequencesPage();
    const html = renderToStaticMarkup(jsx);

    expect(html).toContain("No active sequences");
    expect(html).toContain("Approve a lead in the Queue");
  });

  it("renders sequences table with company, assignee, status, steps, and last event", async () => {
    const sampleRows: SequenceRow[] = [
      {
        sequenceId: "seq-1",
        leadId: "lead-abc",
        company: { name: "Ledgerline", domain: "ledgerline.co" },
        assignee: { id: "u-1", name: "Sarah Rep" },
        status: "active",
        currentStep: "Opening email",
        nextStep: {
          label: "Day 3 check",
          scheduledFor: "2026-10-24T10:00:00Z",
        },
        lastEvent: {
          type: "delivered",
          source: "resend",
          at: "2026-10-21T10:05:00Z",
        },
        approvedAt: "2026-10-21T10:00:00Z",
      },
      {
        sequenceId: "seq-2",
        leadId: "lead-xyz",
        company: { name: "Acme Labs", domain: "acme.dev" },
        assignee: null,
        status: "completed",
        currentStep: "Follow-up on another signal",
        nextStep: null,
        lastEvent: {
          type: "replied",
          source: "simulated",
          at: "2026-10-22T08:00:00Z",
        },
        approvedAt: "2026-10-20T10:00:00Z",
      },
    ];

    mockListSequences.mockResolvedValueOnce(sampleRows);
    const jsx = await SequencesPage();
    const html = renderToStaticMarkup(jsx);

    expect(html).toContain("Ledgerline");
    expect(html).toContain("ledgerline.co");
    expect(html).toContain("Sarah Rep");
    expect(html).toContain("active");
    expect(html).toContain("Opening email");
    expect(html).toContain("Day 3 check");
    expect(html).toContain("2026-10-24 10:00 UTC");
    expect(html).toContain("delivered");

    // Second row
    expect(html).toContain("Acme Labs");
    expect(html).toContain("Unassigned");
    expect(html).toContain("replied");
    expect(html).toContain("Simulated");

    // Click link to queue
    expect(html).toContain("/queue?lead=lead-abc");
    expect(html).toContain("/queue?lead=lead-xyz");

    // Check typography rules
    expect(html).not.toContain("—");
    expect(html).not.toContain("–");
  });
});
