import { describe, expect, it } from "vitest";
import { getAgentConfig, scoreBand } from "@/lib/agent-config";
import {
  bySignalStrength,
  latestDrafts,
  toDetail,
  toListItem,
  toSignalView,
  type DraftRow,
  type LeadRow,
  type SignalRow,
} from "@/lib/leads-mapping";

const config = await getAgentConfig("test-org");

function signal(overrides: Partial<SignalRow>): SignalRow {
  return {
    id: "s1",
    company_id: "c1",
    type: "hiring",
    title: "Hiring: Founding AE",
    excerpt: "Own the sales cycle.",
    source_name: "Ashby",
    source_url: "https://jobs.example/1",
    occurred_at: "2026-10-18T10:00:00Z",
    detected_at: "2026-10-20T10:00:00Z",
    meta: { category: "sales", founding: true },
    ...overrides,
  };
}

const lead: LeadRow = {
  id: "l1",
  status: "ready",
  score: 70,
  score_parts: [["ICP match", 40], ["Hiring", 30]],
  filtered_reason: null,
  updated_at: "2026-10-21T08:00:00Z",
  company: {
    id: "c1",
    name: "Artisan",
    domain: "artisan.co",
    icp_tier: "full",
    icp_reasons: ["Active", "B2B industry (Sales)"],
    team_size: 35,
    yc_batch: "Winter 2024",
    description: "AI employees",
    industries: ["B2B"],
  },
  contact: {
    name: "Founder",
    title: "Founder",
    is_placeholder: true,
    send_address: "delivered+abc12345@resend.dev",
    buyer_status: "unverified",
    buyer_reason: "At 35 people, a sales leader may own outbound instead of the founder",
  },
  assignee: { id: "r1", full_name: "Demo Rep" },
};

describe("scoreBand", () => {
  it.each([
    [90, "Strong", "hi"],
    [89, "Good", "md"],
    [70, "Good", "md"],
    [69, "Borderline", "lo"],
    [50, "Borderline", "lo"],
  ] as const)("score %i on a ready lead is %s (%s)", (score, label, tier) => {
    expect(scoreBand(score, "ready", config)).toEqual({ label, tier });
  });

  it("calls filtered leads Filtered whatever the score", () => {
    expect(scoreBand(50, "filtered", config)).toEqual({ label: "Filtered", tier: "lo" });
    expect(scoreBand(49, "ready", config)).toEqual({ label: "Filtered", tier: "lo" });
  });
});

describe("signals", () => {
  it("reads the hiring category from meta and falls back to the detection date", () => {
    const view = toSignalView(signal({ occurred_at: null, meta: { category: "marketing" } }));
    expect(view.category).toBe("marketing");
    expect(view.occurredAt).toBe("2026-10-20T10:00:00Z");
    expect(toSignalView(signal({ meta: null })).category).toBeNull();
  });

  it("orders hiring, then launch, then funding, newest first within a type", () => {
    const views = [
      signal({ id: "fund", type: "funding", occurred_at: "2026-10-20T00:00:00Z" }),
      signal({ id: "launch", type: "launch", occurred_at: "2026-10-19T00:00:00Z" }),
      signal({ id: "old-hire", occurred_at: "2026-09-01T00:00:00Z" }),
      signal({ id: "new-hire", occurred_at: "2026-10-10T00:00:00Z" }),
    ].map(toSignalView);
    expect(views.sort(bySignalStrength).map((s) => s.id)).toEqual(["new-hire", "old-hire", "launch", "fund"]);
  });
});

describe("toListItem / toDetail", () => {
  it("maps a lead with its strongest signal, band and assignee", () => {
    const item = toListItem(lead, [signal({ id: "launch", type: "launch" }), signal({ id: "hire" })], config);
    expect(item.topSignal?.id).toBe("hire");
    expect(item.signalTypes.sort()).toEqual(["hiring", "launch"]);
    expect(item.scoreParts).toEqual([["ICP match", 40], ["Hiring", 30]]);
    expect([item.band, item.tier]).toEqual(["Good", "md"]);
    expect(item.assignee).toEqual({ id: "r1", name: "Demo Rep" });
    expect(item.contact).toEqual({ name: "Founder", title: "Founder", isPlaceholder: true });
  });

  it("handles a lead with no signals", () => {
    const item = toListItem({ ...lead, status: "filtered", score: 40 }, [], config);
    expect(item.topSignal).toBeNull();
    expect(item.newestSignalAt).toBeNull();
    expect(item.band).toBe("Filtered");
  });

  it("adds ICP reasons, the test inbox and every signal for the detail view", () => {
    const detail = toDetail(lead, [signal({ id: "a" }), signal({ id: "b", type: "funding" })], config);
    expect(detail.company.icpReasons).toEqual(["Active", "B2B industry (Sales)"]);
    expect(detail.contact?.sendAddress).toBe("delivered+abc12345@resend.dev");
    expect(detail.signals.map((s) => s.id)).toEqual(["a", "b"]);
  });

  it("ignores malformed score parts instead of crashing", () => {
    expect(toListItem({ ...lead, score_parts: [["ok", 1], "bad", [2, "x"]] }, [], config).scoreParts).toEqual([["ok", 1]]);
  });
});


describe("latestDrafts", () => {
  const row = (angle: DraftRow["angle"], createdAt: string, subject: string = angle): DraftRow => ({
    id: `${angle}-${createdAt}`, angle, subject, body: "b", grounded_phrases: ["x"],
    guardrail_results: [{ check: "angle", status: "pass", message: "ok" }, { bogus: true }],
    passed: true, model: "m", tokens_in: 1, tokens_out: 2, prompt: "p",
    trace: { promptHash: "h", source: "agent", signals: [], attempts: [], chosenAttempt: 1 },
    created_at: createdAt, creator: null,
  });

  it("keeps the newest draft per angle, in editor order", () => {
    const views = latestDrafts([
      row("short", "2026-10-21T10:00:00Z"),
      row("signal", "2026-10-21T09:00:00Z", "old"),
      row("signal", "2026-10-21T11:00:00Z", "new"),
      row("peer", "2026-10-21T10:00:00Z"),
    ]);
    expect(views.map((v) => `${v.angle}:${v.subject}`)).toEqual(["signal:new", "peer:peer", "short:short"]);
  });

  it("drops malformed check entries and reads the trace", () => {
    const [view] = latestDrafts([row("signal", "2026-10-21T10:00:00Z")]);
    expect(view.checks).toEqual([{ check: "angle", status: "pass", message: "ok" }]);
    expect(view.trace?.promptHash).toBe("h");
    expect(view.createdBy).toBeNull();
  });
});
