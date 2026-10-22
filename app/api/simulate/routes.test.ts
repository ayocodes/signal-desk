// Simulate and resend routes with auth, Supabase, the event handler and GitHub mocked.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type Op = { table: string; op: string; values?: unknown; filters: Record<string, unknown> };
const state = vi.hoisted(() => ({
  profile: null as Record<string, unknown> | null,
  lead: { id: "11111111-1111-4111-8111-111111111111" } as Record<string, unknown> | null,
  sequence: { id: "seq-1", status: "active" } as Record<string, unknown> | null,
  nextStep: { id: "st-3", step_key: "d3_check" } as Record<string, unknown> | null,
  sentStep: { id: "st-1", step_key: "d1_open" } as Record<string, unknown> | null,
  proposal: { id: "p-1", sequence_id: "seq-1", step_id: "st-1", proposed_address: "delivered+abc@resend.dev", status: "pending" } as Record<string, unknown> | null,
  ops: [] as Op[],
  apply: vi.fn(),
  startSequencesRun: vi.fn(),
  logUserAction: vi.fn(),
}));

function client() {
  return {
    from: (table: string) => {
      const op: Op = { table, op: "select", filters: {} };
      const chain = {
        select: () => chain,
        eq: (c: string, v: unknown) => ((op.filters[c] = v), chain),
        not: (c: string) => ((op.filters[`${c} not null`] = true), chain),
        order: () => chain,
        limit: () => chain,
        update: (values: unknown) => (Object.assign(op, { op: "update", values }), state.ops.push(op), chain),
        insert: (values: unknown) => (Object.assign(op, { op: "insert", values }), state.ops.push(op), chain),
        maybeSingle: async () => {
          if (table === "sequences") return { data: state.sequence, error: null };
          if (table === "recovery_proposals") return { data: state.proposal, error: null };
          if (table === "sequence_steps") return { data: op.filters["sent_at not null"] ? state.sentStep : state.nextStep, error: null };
          return { data: null, error: null };
        },
        single: async () => ({ data: table === "leads" ? { contact_id: "ct-1" } : { step_key: "d1_open" }, error: null }),
        then: (resolve: (v: unknown) => unknown) => resolve({ data: null, error: null }),
      };
      return chain;
    },
  };
}

vi.mock("@/lib/auth", () => ({ getProfile: async () => state.profile }));
vi.mock("@/lib/data/leads", () => ({ getLead: async () => state.lead }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: client }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => client() }));
vi.mock("@/lib/email-events", () => ({ applyEmailEvent: state.apply }));
vi.mock("@/lib/rescore", () => ({ startSequencesRun: state.startSequencesRun }));
vi.mock("@/lib/audit", () => ({ logUserAction: state.logUserAction }));

const { POST: simulateRoute } = await import("@/app/api/simulate/[action]/route");
const { POST: resendRoute } = await import("@/app/api/leads/[id]/resend/route");

const LEAD = "11111111-1111-4111-8111-111111111111";
const ADMIN = { id: "admin-1", orgId: "org-1", role: "admin" };
const REP = { id: "rep-1", orgId: "org-1", role: "rep" };
const sim = (action: string) =>
  simulateRoute(new Request("http://x", { method: "POST", body: JSON.stringify({ leadId: LEAD }) }), { params: Promise.resolve({ action }) });
const resend = () =>
  resendRoute(
    new Request("http://x", { method: "POST", body: JSON.stringify({ proposalId: "22222222-2222-4222-8222-222222222222" }) }),
    { params: Promise.resolve({ id: LEAD }) },
  );

beforeEach(() => {
  vi.clearAllMocks();
  state.ops = [];
  state.profile = ADMIN;
  state.lead = { id: LEAD };
  state.sequence = { id: "seq-1", status: "active" };
  state.nextStep = { id: "st-3", step_key: "d3_check" };
  state.sentStep = { id: "st-1", step_key: "d1_open" };
  state.proposal = { id: "p-1", sequence_id: "seq-1", step_id: "st-1", proposed_address: "delivered+abc@resend.dev", status: "pending" };
  state.startSequencesRun.mockResolvedValue("dispatched");
});

describe("POST /api/simulate/[action]", () => {
  it("is admins only, and rejects unknown actions", async () => {
    state.profile = REP;
    expect((await sim("reply")).status).toBe(403);
    state.profile = ADMIN;
    expect((await sim("delete")).status).toBe(400);
  });

  it("simulates a reply on the last sent email through the real event handler", async () => {
    const response = await sim("reply");
    expect(await response.json()).toEqual({ step: "Opening email" });
    expect(state.apply).toHaveBeenCalledWith({
      stepId: "st-1", type: "replied", source: "simulated", providerEventId: null,
      payload: { simulated: true, by: "admin-1" }, actorId: "admin-1",
    });
  });

  it("refuses to simulate on a lead nothing was sent to", async () => {
    state.sentStep = null;
    const response = await sim("open");
    expect(response.status).toBe(409);
    expect((await response.json()).error.message).toBe("Nothing has been sent to this lead yet.");
  });

  it("fast-forwards: makes the next step due now and starts a sequences run", async () => {
    const response = await sim("fast-forward");
    expect(await response.json()).toEqual({ step: "Day 3 check", apply: "dispatched" });
    expect(state.ops.find((o) => o.table === "sequence_steps" && o.op === "update")?.filters).toEqual({ id: "st-3" });
    expect(state.logUserAction).toHaveBeenCalledWith(ADMIN, expect.objectContaining({ action: "sequence.fast_forwarded" }));
  });

  it("won't fast-forward a halted sequence", async () => {
    state.sequence = { id: "seq-1", status: "halted" };
    expect((await sim("fast-forward")).status).toBe(409);
  });
});

describe("POST /api/leads/[id]/resend", () => {
  it("lets the lead's rep approve: corrected address, a retry step, the sequence resumes", async () => {
    state.profile = REP;
    const response = await resend();
    expect(await response.json()).toEqual({ apply: "dispatched" });
    const write = (table: string) => state.ops.find((o) => o.table === table && o.op !== "select");
    expect(write("contacts")?.values).toEqual({ send_address: "delivered+abc@resend.dev" });
    expect(write("recovery_proposals")?.values).toMatchObject({ status: "approved", approved_by: "rep-1" });
    expect(write("sequence_steps")?.values).toMatchObject({ step_key: "d1_open", idempotency_key: "seq-1:d1_open:retry:p-1" });
    expect(write("leads")?.values).toEqual({ status: "enrolled" });
  });

  it("is a 404 for a lead the user can't see, and a 409 when already resent", async () => {
    state.lead = null;
    expect((await resend()).status).toBe(404);
    state.lead = { id: LEAD };
    state.proposal = { ...state.proposal, status: "approved" };
    expect((await resend()).status).toBe(409);
  });
});
