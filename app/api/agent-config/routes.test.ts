// The agent-rules routes with Supabase and auth mocked; the validator and diff are real.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultConfig, DEFAULT_RULES } from "@/lib/agent-config";
import type { RulesDoc } from "@/lib/rules";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  getProfile: vi.fn(),
  getConfigVersion: vi.fn(),
  thresholdPreview: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getProfile: mocks.getProfile }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ rpc: mocks.rpc }) }));
vi.mock("@/lib/data/agent-config", async () => {
  const { defaultConfig: defaults } = await import("@/lib/agent-config");
  return {
    getAgentConfig: async () => ({ ...defaults(), version: 1 }),
    getConfigVersion: mocks.getConfigVersion,
    thresholdPreview: mocks.thresholdPreview,
  };
});

const { POST: save } = await import("@/app/api/agent-config/route");
const { POST: revert } = await import("@/app/api/agent-config/revert/route");
const { GET: preview } = await import("@/app/api/agent-config/preview/route");

const ADMIN = { id: "admin-1", orgId: "org-1", fullName: "Demo Admin", email: "a@example.com", role: "admin", theme: "system" };
const REP = { ...ADMIN, id: "rep-1", role: "rep" };
const post = (body: unknown) => new Request("http://localhost/api", { method: "POST", body: JSON.stringify(body) });
const withThreshold = (rules: RulesDoc, threshold: number): RulesDoc => {
  const doc = structuredClone(rules);
  doc.threshold = threshold;
  doc.scoreBands[doc.scoreBands.length - 1].min = threshold;
  return doc;
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getProfile.mockResolvedValue(ADMIN);
  mocks.rpc.mockResolvedValue({ data: 2, error: null });
});

describe("POST /api/agent-config", () => {
  it("saves a valid change with readable change lines", async () => {
    const response = await save(post({ rules: withThreshold(DEFAULT_RULES, 55) }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ version: 2 });
    expect(mocks.rpc).toHaveBeenCalledWith("save_agent_config", {
      p_rules: withThreshold(DEFAULT_RULES, 55),
      p_summary: ["Threshold 50 → 55", "Score bands Strong 90, Good 70, Borderline 50 → Strong 90, Good 70, Borderline 55"],
    });
  });

  it("refuses reps before touching the database", async () => {
    mocks.getProfile.mockResolvedValue(REP);
    expect((await save(post({ rules: DEFAULT_RULES }))).status).toBe(403);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("returns the validator's errors for invalid rules", async () => {
    const response = await save(post({ rules: { ...DEFAULT_RULES, threshold: 0 } }));
    const json = await response.json();
    expect(response.status).toBe(422);
    expect(json.error.code).toBe("invalid_rules");
    expect(json.error.errors).toEqual([{ path: "threshold", code: "out_of_range" }]);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("doesn't save a version when nothing changed", async () => {
    const response = await save(post({ rules: DEFAULT_RULES }));
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("no_changes");
  });

  it("maps the database's own admin check to 403", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "Only admins" } });
    expect((await save(post({ rules: withThreshold(DEFAULT_RULES, 55) }))).status).toBe(403);
  });
});

describe("POST /api/agent-config/revert", () => {
  it("copies an old version in, saying which one", async () => {
    mocks.getConfigVersion.mockResolvedValue(withThreshold(DEFAULT_RULES, 60));
    const response = await revert(post({ version: 1 }));
    expect(response.status).toBe(200);
    expect(mocks.rpc.mock.calls[0][1].p_summary[0]).toBe("Reverted to version 1");
  });

  it("is a 404 for a version that doesn't exist", async () => {
    mocks.getConfigVersion.mockResolvedValue(null);
    expect((await revert(post({ version: 9 }))).status).toBe(404);
  });

  it("is a no-op error when the old version equals the current rules", async () => {
    mocks.getConfigVersion.mockResolvedValue(defaultConfig().rules);
    expect((await revert(post({ version: 1 }))).status).toBe(400);
  });
});

describe("GET /api/agent-config/preview", () => {
  it("returns the counts for a threshold", async () => {
    mocks.thresholdPreview.mockResolvedValue({ threshold: 55, wouldBeReady: 9, readyNow: 14 });
    const response = await preview(new Request("http://localhost/api/agent-config/preview?threshold=55"));
    expect(await response.json()).toEqual({ preview: { threshold: 55, wouldBeReady: 9, readyNow: 14 } });
  });

  it("rejects a threshold that isn't a whole number from 1 to 500", async () => {
    for (const t of ["0", "abc", "50.5", "501"]) {
      expect((await preview(new Request(`http://localhost/api/agent-config/preview?threshold=${t}`))).status).toBe(400);
    }
  });
});
