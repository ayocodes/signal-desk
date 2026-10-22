// Ops data: every function refuses a rep before it reads anything, plus the small math helpers.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const state = vi.hoisted(() => ({ role: "rep", reads: [] as string[] }));

vi.mock("@/lib/auth", () => ({
  // The real requireAdmin renders the 403 page (forbidden()) for a rep; here it throws the same way.
  requireAdmin: async () => {
    if (state.role !== "admin") throw new Error("NEXT_HTTP_ERROR_FALLBACK;403");
    return { id: "admin-1", orgId: "org-1", role: "admin" };
  },
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    from: (table: string) => {
      state.reads.push(table);
      throw new Error("read attempted");
    },
  }),
}));

const ops = await import("@/lib/data/ops");

describe("ops data is admin only", () => {
  beforeEach(() => {
    state.role = "rep";
    state.reads = [];
  });

  const calls: [string, () => Promise<unknown>][] = [
    ["getKpis", () => ops.getKpis()],
    ["getReplyRateBySignal", () => ops.getReplyRateBySignal()],
    ["getMailboxHealth", () => ops.getMailboxHealth()],
    ["getEngineStats", () => ops.getEngineStats()],
    ["getBoardCoverage", () => ops.getBoardCoverage()],
    ["listAuditLog", () => ops.listAuditLog({ actorType: "agent" })],
    ["auditActionGroups", () => ops.auditActionGroups()],
  ];

  it.each(calls)("%s refuses a rep without reading any table", async (_name, call) => {
    await expect(call()).rejects.toThrow("403");
    expect(state.reads).toEqual([]);
  });
});

describe("ops math", () => {
  it("ratio rounds to one decimal and is null for an empty total", () => {
    expect(ops.ratio(1, 3)).toEqual({ count: 1, total: 3, pct: 33.3 });
    expect(ops.ratio(0, 0)).toEqual({ count: 0, total: 0, pct: null });
  });

  it("percentile uses the nearest rank", () => {
    const sorted = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    expect(ops.percentile(sorted, 50)).toBe(50);
    expect(ops.percentile(sorted, 95)).toBe(100);
    expect(ops.percentile([7], 95)).toBe(7);
    expect(ops.percentile([], 50)).toBeNull();
  });
});
