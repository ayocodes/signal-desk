// lib/rescore.ts with Supabase, env, the audit log and GitHub mocked.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const NOW = Date.parse("2026-10-21T12:00:00Z");
const ago = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString();

const state = vi.hoisted(() => ({
  github: { token: "t", repo: "owner/repo" } as { token: string; repo: string } | null,
  lastDispatch: null as { created_at: string } | null,
  runAfterDispatch: null as Record<string, unknown> | null,
  finishedRun: null as Record<string, unknown> | null,
  fetchStatus: 204,
  logUserAction: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("@/lib/env", () => ({ env: { get githubDispatch() { return state.github; } } }));
vi.mock("@/lib/audit", () => ({ logUserAction: state.logUserAction }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    from: (table: string) => {
      const filters: string[] = [];
      const chain = {
        select: () => chain,
        eq: (column: string, value: unknown) => (filters.push(`${column}=${value}`), chain),
        in: (column: string) => (filters.push(`${column} in`), chain),
        gte: (column: string) => (filters.push(`${column}>=`), chain),
        not: (column: string) => (filters.push(`${column} not`), chain),
        order: () => chain,
        limit: () => chain,
        maybeSingle: async () => {
          if (table === "audit_log") return { data: state.lastDispatch, error: null };
          // agent_runs: "first re-score run after the dispatch" vs "a finished run with this version"
          if (filters.includes("trigger in")) return { data: state.runAfterDispatch, error: null };
          return { data: state.finishedRun, error: null };
        },
      };
      return chain;
    },
  }),
}));

const { startRescore, startSequencesRun, applyState } = await import("@/lib/rescore");
const ADMIN = { id: "a", orgId: "org-1", fullName: "Admin", email: "a@x", role: "admin" as const, theme: "system" };

beforeEach(() => {
  vi.clearAllMocks();
  state.github = { token: "t", repo: "owner/repo" };
  state.lastDispatch = null;
  state.runAfterDispatch = null;
  state.finishedRun = null;
  state.fetchStatus = 204;
  vi.stubGlobal("fetch", state.fetch.mockImplementation(async () => new Response(null, { status: state.fetchStatus })));
});

describe("startRescore", () => {
  it("dispatches the rescore workflow and audit-logs it", async () => {
    expect(await startRescore(ADMIN, 4, NOW)).toBe("dispatched");
    const [url, init] = state.fetch.mock.calls[0];
    expect(url).toBe("https://api.github.com/repos/owner/repo/actions/workflows/rescore.yml/dispatches");
    expect(JSON.parse(init.body)).toEqual({ ref: "main", inputs: { org_id: "org-1", mode: "rescore" } });
    expect(init.headers.Authorization).toBe("Bearer t");
    expect(state.logUserAction).toHaveBeenCalledWith(ADMIN, expect.objectContaining({ action: "agent.rescore_dispatched", detail: { version: 4 } }));
  });

  it("joins a run that is queued (dispatched, not started yet)", async () => {
    state.lastDispatch = { created_at: ago(5) };
    expect(await startRescore(ADMIN, 5, NOW)).toBe("joined");
    expect(state.fetch).not.toHaveBeenCalled();
  });

  it("joins a run that is still running (it loops to pick up newer saves)", async () => {
    state.lastDispatch = { created_at: ago(5) };
    state.runAfterDispatch = { started_at: ago(4), finished_at: null };
    expect(await startRescore(ADMIN, 5, NOW)).toBe("joined");
  });

  it("waits out the 2-minute cooldown after a run that already finished", async () => {
    state.lastDispatch = { created_at: ago(1) };
    state.runAfterDispatch = { started_at: ago(1), finished_at: ago(0.5) };
    expect(await startRescore(ADMIN, 5, NOW)).toBe("deferred");
    expect(state.fetch).not.toHaveBeenCalled();
  });

  it("dispatches again once the cooldown has passed", async () => {
    state.lastDispatch = { created_at: ago(3) };
    state.runAfterDispatch = { started_at: ago(3), finished_at: ago(2) };
    expect(await startRescore(ADMIN, 5, NOW)).toBe("dispatched");
  });

  it("fails without a token, or when GitHub refuses, and logs nothing", async () => {
    state.github = null;
    expect(await startRescore(ADMIN, 5, NOW)).toBe("failed");
    state.github = { token: "t", repo: "owner/repo" };
    state.fetchStatus = 403;
    expect(await startRescore(ADMIN, 5, NOW)).toBe("failed");
    expect(state.logUserAction).not.toHaveBeenCalled();
  });
});

describe("startSequencesRun", () => {
  it("dispatches the sequences mode and logs it as its own action", async () => {
    expect(await startSequencesRun(ADMIN, "lead-1", NOW)).toBe("dispatched");
    expect(JSON.parse(state.fetch.mock.calls[0][1].body).inputs).toEqual({ org_id: "org-1", mode: "sequences" });
    expect(state.logUserAction).toHaveBeenCalledWith(ADMIN, expect.objectContaining({ action: "agent.sequences_dispatched", detail: { lead_id: "lead-1" } }));
  });

  it("queues behind a run that is still going instead of joining it", async () => {
    state.lastDispatch = { created_at: ago(1) };
    state.runAfterDispatch = { started_at: ago(0.5), finished_at: null };
    expect(await startSequencesRun(ADMIN, "lead-1", NOW)).toBe("dispatched");
  });

  it("shares the cooldown with re-scores", async () => {
    state.lastDispatch = { created_at: ago(1) };
    state.runAfterDispatch = { started_at: ago(1), finished_at: ago(0.5) };
    expect(await startSequencesRun(ADMIN, "lead-1", NOW)).toBe("deferred");
  });
});

describe("applyState", () => {
  it("is applied once a finished run scored with this version or newer", async () => {
    state.finishedRun = { errors: [] };
    expect(await applyState("org-1", 4, NOW)).toBe("applied");
  });

  it("is failed when that run's scoring failed", async () => {
    state.finishedRun = { errors: [{ step: "score_leads", message: "boom" }] };
    expect(await applyState("org-1", 4, NOW)).toBe("failed");
  });

  it("is applying while a run is queued or running", async () => {
    state.lastDispatch = { created_at: ago(3) };
    expect(await applyState("org-1", 4, NOW)).toBe("applying");
  });

  it("is failed when a dispatch never started a run after 15 minutes", async () => {
    state.lastDispatch = { created_at: ago(20) };
    expect(await applyState("org-1", 4, NOW)).toBe("failed");
  });
});
