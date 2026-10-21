// The draft and approve routes with Supabase, the model and auth mocked. The rules, prompts and
// guardrails are the real ones, so these tests also prove the server re-checks drafts.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DraftView, LeadDetail, SignalView } from "@/lib/types";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  getProfile: vi.fn(),
  getLead: vi.fn(),
  getDraft: vi.fn(),
  getRawDraft: vi.fn(),
  generateJson: vi.fn(),
  logUserAction: vi.fn(),
  rpc: vi.fn(),
  updates: [] as { table: string; values: Record<string, unknown> }[],
  inserts: [] as { table: string; row: Record<string, unknown> }[],
}));

vi.mock("@/lib/auth", () => ({ getProfile: mocks.getProfile }));
vi.mock("@/lib/data/leads", () => ({ getLead: mocks.getLead }));
vi.mock("@/lib/data/drafts", () => ({ DRAFT_COLUMNS: "*", getDraft: mocks.getDraft, getRawDraft: mocks.getRawDraft }));
vi.mock("@/lib/audit", () => ({ logUserAction: mocks.logUserAction }));
vi.mock("@/lib/env", () => ({
  env: { llm: { provider: "gemini", apiKey: "k", model: "gemini-test", dailyBudget: 20 }, resend: { from: "a@b.c" } },
}));
vi.mock("@/lib/prompt-templates", () => ({
  promptTemplates: async () => {
    const read = (name: string) => readFileSync(join(process.cwd(), "shared", "prompts", name), "utf8");
    return { draft: read("draft.md"), raw: read("raw.md") };
  },
}));
vi.mock("@/lib/llm", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/llm")>()),
  generateJson: mocks.generateJson,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    rpc: mocks.rpc,
    from: (table: string) => ({
      update: (values: Record<string, unknown>) => ({
        eq: async () => {
          mocks.updates.push({ table, values });
          return { error: null };
        },
      }),
      insert: (row: Record<string, unknown>) => {
        mocks.inserts.push({ table, row });
        return {
          select: () => ({
            single: async () => ({
              data: { ...row, id: "draft-new", created_at: "2026-10-21T12:00:00Z", creator: { id: "rep-1", full_name: "Demo Rep" } },
              error: null,
            }),
          }),
        };
      },
    }),
  }),
}));

const { POST: approve } = await import("@/app/api/leads/[id]/approve/route");
const { POST: draft } = await import("@/app/api/leads/[id]/draft/route");

const LEAD_ID = "11111111-1111-4111-8111-111111111111";
const DRAFT_ID = "22222222-2222-4222-8222-222222222222";
const PROFILE = { id: "rep-1", orgId: "org-1", fullName: "Demo Rep", email: "rep@example.com", role: "rep", theme: "system" };

const SIGNAL: SignalView = {
  id: "s-1",
  type: "hiring",
  category: "sales",
  title: "Founding Account Executive",
  excerpt: "You will build the outbound motion from scratch.",
  sourceName: "Greenhouse",
  sourceUrl: null,
  occurredAt: "2026-10-20T00:00:00Z",
};

const LEAD: LeadDetail = {
  id: LEAD_ID,
  status: "ready",
  score: 92,
  scoreParts: [],
  band: "Strong",
  tier: "hi",
  company: {
    id: "co-1", name: "Acme", domain: "acme.dev", icpTier: "full", icpReasons: [], teamSize: 12,
    ycBatch: "W26", description: "Billing software.", industries: [],
  },
  contact: {
    name: "Jane Doe", title: "CEO", isPlaceholder: false, sendAddress: "delivered+abc@resend.dev",
    buyerStatus: "verified", buyerReason: null,
  },
  topSignal: SIGNAL,
  signalTypes: ["hiring"],
  newestSignalAt: SIGNAL.occurredAt,
  assignee: { id: "rep-1", name: "Demo Rep" },
  updatedAt: "2026-10-21T00:00:00Z",
  filteredReason: null,
  signals: [SIGNAL],
};

const GOOD_BODY =
  "Hi Jane, saw you're hiring a Founding Account Executive. We help new sales teams draft first emails that cite public signals. Worth a look?";

function storedDraft(overrides: Partial<DraftView> = {}): DraftView {
  return {
    id: DRAFT_ID, angle: "signal", subject: "Your founding AE search", body: GOOD_BODY,
    groundedPhrases: ["Founding Account Executive"], checks: [], passed: true, model: "gemini-test",
    tokensIn: 1, tokensOut: 1, prompt: "p", trace: null, createdAt: "2026-10-21T00:00:00Z", createdBy: null,
    ...overrides,
  };
}

const request = (body: unknown) => new Request("http://localhost/api", { method: "POST", body: JSON.stringify(body) });
const params = { params: Promise.resolve({ id: LEAD_ID }) };
const answer = (angle: string, body = GOOD_BODY) =>
  JSON.stringify({ drafts: [{ angle, subject: "Your founding AE search", body, grounded_phrases: ["Founding Account Executive"] }] });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.updates.length = 0;
  mocks.inserts.length = 0;
  mocks.getProfile.mockResolvedValue(PROFILE);
  mocks.getLead.mockResolvedValue(LEAD);
  mocks.getDraft.mockResolvedValue(storedDraft());
  mocks.getRawDraft.mockResolvedValue(null);
});

describe("POST /api/leads/[id]/approve", () => {
  const input = { draftId: DRAFT_ID, subject: "Your founding AE search", body: GOOD_BODY };

  it("enrolls the lead with the shared sequence steps when every check passes", async () => {
    mocks.rpc.mockResolvedValue({ data: "seq-1", error: null });
    const response = await approve(request(input), params);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ sequenceId: "seq-1" });
    expect(mocks.rpc).toHaveBeenCalledWith("approve_lead", expect.objectContaining({
      p_actor: "rep-1", p_lead: LEAD_ID, p_draft: DRAFT_ID,
      p_steps: expect.arrayContaining([{ key: "d1_open", dayOffset: 0 }]),
    }));
  });

  it("rejects the raw angle without touching the database", async () => {
    mocks.getDraft.mockResolvedValue(storedDraft({ angle: "raw" }));
    const response = await approve(request(input), params);
    expect(response.status).toBe(422);
    expect((await response.json()).error.code).toBe("not_approvable");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects an edited body whose grounding check fails, and says which checks failed", async () => {
    const edited = { ...input, body: "Hi Jane, we help new sales teams draft first emails. Worth a look?" };
    const response = await approve(request(edited), params);
    const json = await response.json();
    expect(response.status).toBe(422);
    expect(json.error.code).toBe("checks_failed");
    expect(json.error.results.find((r: { check: string }) => r.check === "grounding").status).toBe("fail");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("treats a lead the user can't read (another rep's) as not found", async () => {
    mocks.getLead.mockResolvedValue(null);
    const response = await approve(request(input), params);
    expect(response.status).toBe(404);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("maps the database's own checks: someone else's lead is 403, a second approve is 409", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: "42501", message: "assigned to someone else" } });
    expect((await approve(request(input), params)).status).toBe(403);
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: "23505", message: "already enrolled" } });
    const second = await approve(request(input), params);
    expect(second.status).toBe(409);
    expect((await second.json()).error.code).toBe("already_enrolled");
  });

  it("needs a session and a valid body", async () => {
    expect((await approve(request({ ...input, draftId: "nope" }), params)).status).toBe(400);
    mocks.getProfile.mockResolvedValue(null);
    expect((await approve(request(input), params)).status).toBe(401);
  });
});

describe("POST /api/leads/[id]/draft", () => {
  const reserved = { data: [{ call_id: "call-1", refusal: null }], error: null };

  it("regenerates one angle: reserves a call, checks the draft, stores it as the user's", async () => {
    mocks.rpc.mockResolvedValue(reserved);
    mocks.generateJson.mockResolvedValue({ text: answer("peer"), model: "gemini-test", tokensIn: 700, tokensOut: 300, ms: 900 });
    const response = await draft(request({ angle: "peer" }), params);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.draft).toMatchObject({ id: "draft-new", angle: "peer", passed: true, createdBy: { id: "rep-1", name: "Demo Rep" } });
    expect(mocks.rpc).toHaveBeenCalledWith("reserve_llm_call", expect.objectContaining({
      p_source: "regenerate", p_actor: "rep-1", p_daily_limit: 20, p_actor_hourly_limit: 5,
    }));
    expect(mocks.generateJson.mock.calls[0][0]).toContain("1. Hiring: Founding Account Executive");
    const row = mocks.inserts[0].row;
    expect(row).toMatchObject({ created_by: "rep-1", llm_call_id: "call-1", tokens_in: 700, passed: true });
    expect(row.trace).toMatchObject({ source: "regenerate", chosenAttempt: 1 });
    expect(mocks.updates).toEqual([{ table: "llm_calls", values: expect.objectContaining({ ok: true, tokens_out: 300 }) }]);
    expect(mocks.logUserAction).toHaveBeenCalledWith(PROFILE, expect.objectContaining({ action: "draft.regenerated" }));
  });

  it("returns the stored Unconstrained draft instead of calling the model again", async () => {
    mocks.getRawDraft.mockResolvedValue(storedDraft({ angle: "raw" }));
    const response = await draft(request({ angle: "raw" }), params);
    expect(response.status).toBe(200);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.generateJson).not.toHaveBeenCalled();
  });

  it("makes the Unconstrained draft once, from the prompt without signals, and it fails the angle check", async () => {
    mocks.rpc.mockResolvedValue(reserved);
    mocks.generateJson.mockResolvedValue({ text: answer("raw"), model: "gemini-test", tokensIn: 100, tokensOut: 100, ms: 500 });
    const response = await draft(request({ angle: "raw" }), params);
    const json = await response.json();
    expect(json.draft.passed).toBe(false);
    expect(mocks.rpc).toHaveBeenCalledWith("reserve_llm_call", expect.objectContaining({ p_source: "unconstrained" }));
    expect(mocks.generateJson.mock.calls[0][0]).not.toContain("Founding Account Executive");
  });

  it("says plainly when today's budget is used up", async () => {
    mocks.rpc.mockResolvedValue({ data: [{ call_id: null, refusal: "budget" }], error: null });
    const response = await draft(request({ angle: "signal" }), params);
    expect(response.status).toBe(429);
    expect((await response.json()).error).toEqual({
      code: "budget_exhausted",
      message: "Today's AI budget is used up (20 of 20 calls). It resets at 00:00 UTC.",
    });
    expect(mocks.generateJson).not.toHaveBeenCalled();
  });

  it("limits each user per hour", async () => {
    mocks.rpc.mockResolvedValue({ data: [{ call_id: null, refusal: "rate_limited" }], error: null });
    const response = await draft(request({ angle: "signal" }), params);
    expect(response.status).toBe(429);
    expect((await response.json()).error.code).toBe("rate_limited");
  });

  it("records Google's daily quota as a failed call and explains it", async () => {
    const { LlmQuotaExhausted } = await import("@/lib/llm");
    mocks.rpc.mockResolvedValue(reserved);
    mocks.generateJson.mockRejectedValue(new LlmQuotaExhausted("Gemini's daily request quota is used up"));
    const response = await draft(request({ angle: "signal" }), params);
    expect(response.status).toBe(429);
    expect((await response.json()).error.code).toBe("budget_exhausted");
    expect(mocks.updates[0].values).toMatchObject({ ok: false, error: "Gemini's daily request quota is used up" });
  });

  it("only drafts for ready leads", async () => {
    mocks.getLead.mockResolvedValue({ ...LEAD, status: "enrolled" });
    expect((await draft(request({ angle: "signal" }), params)).status).toBe(409);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
