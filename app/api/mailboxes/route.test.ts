// POST /api/mailboxes/:id/resume with auth, Supabase and the audit log mocked.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const state = vi.hoisted(() => ({
  profile: null as Record<string, unknown> | null,
  box: { id: "mb-1", label: "outbound-3", status: "paused", pause_reason: "Complaint rate 5.00%" } as Record<string, unknown> | null,
  updates: [] as Record<string, unknown>[],
  rpcs: [] as string[],
  logUserAction: vi.fn(),
}));

function client() {
  return {
    from: () => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        update: (values: Record<string, unknown>) => (state.updates.push(values), chain),
        maybeSingle: async () => ({ data: state.box, error: null }),
        single: async () => ({ data: { status: "healthy" }, error: null }),
        then: (resolve: (v: unknown) => unknown) => resolve({ data: null, error: null }),
      };
      return chain;
    },
    rpc: async (name: string) => (state.rpcs.push(name), { error: null }),
  };
}

vi.mock("@/lib/auth", () => ({ getProfile: async () => state.profile }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: client }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => client() }));
vi.mock("@/lib/audit", () => ({ logUserAction: state.logUserAction }));

const { POST } = await import("@/app/api/mailboxes/[id]/resume/route");
const call = () =>
  POST(new Request("http://x/api/mailboxes/mb-1/resume", { method: "POST" }), {
    params: Promise.resolve({ id: "mb-1" }),
  } as never);

describe("resume a mailbox", () => {
  beforeEach(() => {
    state.profile = { id: "admin-1", orgId: "org-1", role: "admin" };
    state.box = { id: "mb-1", label: "outbound-3", status: "paused", pause_reason: "Complaint rate 5.00%" };
    state.updates = [];
    state.rpcs = [];
    state.logUserAction.mockReset();
  });

  it("needs a session", async () => {
    state.profile = null;
    expect((await call()).status).toBe(401);
  });

  it("refuses a rep", async () => {
    state.profile = { id: "rep-1", orgId: "org-1", role: "rep" };
    expect((await call()).status).toBe(403);
    expect(state.updates).toEqual([]);
  });

  it("refuses a mailbox that isn't paused", async () => {
    state.box = { ...state.box, status: "healthy" };
    expect((await call()).status).toBe(409);
    expect(state.updates).toEqual([]);
  });

  it("resumes, restarts the rates, re-checks health and logs it", async () => {
    const response = await call();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "healthy" });
    expect(state.updates[0]).toMatchObject({ status: "healthy", pause_reason: null, paused_at: null });
    expect(typeof state.updates[0].rates_since).toBe("string");
    expect(state.rpcs).toEqual(["refresh_mailbox_health"]);
    expect(state.logUserAction).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: "mailbox.resumed" }));
  });
});
