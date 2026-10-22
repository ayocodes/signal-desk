// The shared email-event handler with a fake service-role client that records every write.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type Op = { table: string; op: string; values?: unknown; filters: Record<string, unknown>; options?: unknown };
const state = vi.hoisted(() => ({
  ops: [] as Op[],
  rpc: vi.fn(async () => ({ error: null })),
  step: null as Record<string, unknown> | null,
  duplicate: false,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    rpc: state.rpc,
    from: (table: string) => {
      const op: Op = { table, op: "select", filters: {} };
      const chain = {
        select: () => chain,
        eq: (column: string, value: unknown) => ((op.filters[column] = value), chain),
        update: (values: unknown) => (Object.assign(op, { op: "update", values }), state.ops.push(op), chain),
        insert: (values: unknown) => (Object.assign(op, { op: "insert", values }), state.ops.push(op), chain),
        upsert: (values: unknown, options: unknown) => (Object.assign(op, { op: "upsert", values, options }), state.ops.push(op), chain),
        maybeSingle: async () => ({ data: state.step, error: null }),
        single: async () => ({ data: { id: "lead-1", contact: { send_address: "bounced+abc@resend.dev" } }, error: null }),
        then: (resolve: (v: unknown) => unknown) =>
          resolve(table === "email_events" ? { data: state.duplicate ? [] : [{ id: "ev-1" }], error: null } : { data: null, error: null }),
      };
      return chain;
    },
  }),
}));

const { applyEmailEvent, proposedAddress } = await import("@/lib/email-events");
const STEP = { id: "st-1", org_id: "org-1", sequence_id: "seq-1", mailbox_id: "mb-1", sequence: { id: "seq-1", lead_id: "lead-1", status: "active" } };
const event = (type: string, extra: Partial<Parameters<typeof applyEmailEvent>[0]> = {}) =>
  applyEmailEvent({ messageId: "msg-1", type, source: "resend", providerEventId: "evt_1", payload: { type: `email.${type}` }, actorId: null, ...extra });
const writes = (table: string) => state.ops.filter((o) => o.table === table && o.op !== "select");

beforeEach(() => {
  vi.clearAllMocks();
  state.ops = [];
  state.step = STEP;
  state.duplicate = false;
});

describe("applyEmailEvent", () => {
  it("ignores emails this app didn't send", async () => {
    state.step = null;
    expect(await event("delivered")).toEqual({ stored: false, reason: "Not an email this app sent" });
    expect(state.ops).toEqual([]);
  });

  it("stores a repeat only once and changes nothing the second time", async () => {
    state.duplicate = true;
    expect(await event("bounced")).toEqual({ stored: false, reason: "Already received" });
    expect(writes("sequences")).toEqual([]);
  });

  it("stores delivered and opened events without changing the sequence", async () => {
    await event("opened");
    expect(writes("email_events")[0].values).toMatchObject({ step_id: "st-1", type: "opened", source: "resend", provider_event_id: "evt_1" });
    expect(writes("sequences")).toEqual([]);
  });

  it("pauses on a bounce, marks the lead and proposes the delivering test inbox", async () => {
    await event("bounced", { payload: { data: { bounce: { type: "Permanent", subType: "General", message: "Mailbox does not exist" } } } });
    expect(writes("sequences")[0]).toMatchObject({ values: { status: "paused" }, filters: { id: "seq-1" } });
    expect(writes("leads")[0]).toMatchObject({ values: { status: "bounced" } });
    expect(writes("recovery_proposals")[0].values).toMatchObject({
      original_address: "bounced+abc@resend.dev", proposed_address: "delivered+abc@resend.dev",
      bounce_code: "Permanent / General", reason: "Mailbox does not exist",
    });
    expect(state.rpc).toHaveBeenCalledWith("refresh_mailbox_health", { p_mailbox: "mb-1", p_bounce_pct: 4, p_complaint_pct: 0.3, p_min_sends: 20 });
    expect(writes("audit_log")[0].values).toMatchObject({ action: "email.bounced", actor_type: "agent" });
  });

  it("halts on a complaint, cancels pending steps and refreshes the mailbox", async () => {
    await event("complained");
    expect(writes("sequences")[0].values).toEqual({ status: "halted" });
    expect(writes("sequence_steps")[0]).toMatchObject({ values: { status: "cancelled" }, filters: { sequence_id: "seq-1", status: "pending" } });
    expect(writes("leads")[0].values).toEqual({ status: "halted" });
    expect(state.rpc).toHaveBeenCalled();
  });

  it("halts on a reply (simulated by an admin, the same path as a real event)", async () => {
    await event("replied", { source: "simulated", providerEventId: null, actorId: "admin-1", stepId: "st-1", messageId: undefined });
    expect(writes("leads")[0].values).toEqual({ status: "replied" });
    expect(writes("audit_log")[0].values).toMatchObject({ action: "email.replied", actor_type: "user", actor_id: "admin-1" });
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it("proposes the delivered inbox for bounced and complained addresses", () => {
    expect(proposedAddress("bounced+x@resend.dev")).toBe("delivered+x@resend.dev");
    expect(proposedAddress("complained@resend.dev")).toBe("delivered@resend.dev");
  });
});
