import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OpsError from "./error";
import OpsLoading from "./loading";
import OpsPage from "./page";
import type {
  AuditRow,
  BoardCoverage,
  EngineStats,
  LlmBudget,
  LlmPacing,
  MailboxHealth,
  OpsKpis,
  SignalReplyRate,
} from "@/lib/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/ops",
}));

const mockGetKpis = vi.fn();
const mockGetReplyRateBySignal = vi.fn();
const mockGetMailboxHealth = vi.fn();
const mockGetEngineStats = vi.fn();
const mockGetBoardCoverage = vi.fn();
const mockListAuditLog = vi.fn();
const mockAuditActionGroups = vi.fn();

vi.mock("@/lib/data/ops", () => ({
  getKpis: () => mockGetKpis(),
  getReplyRateBySignal: () => mockGetReplyRateBySignal(),
  getMailboxHealth: () => mockGetMailboxHealth(),
  getEngineStats: () => mockGetEngineStats(),
  getBoardCoverage: () => mockGetBoardCoverage(),
  listAuditLog: (filter: unknown) => mockListAuditLog(filter),
  auditActionGroups: () => mockAuditActionGroups(),
}));

const mockLlmBudgetToday = vi.fn();
const mockLlmPacing = vi.fn();

vi.mock("@/lib/data/llm", () => ({
  llmBudgetToday: () => mockLlmBudgetToday(),
  llmPacing: () => mockLlmPacing(),
}));

const sampleKpis: OpsKpis = {
  leadsScoredToday: 42,
  enrolled: 15,
  editedBeforeSend: { count: 3, total: 15, pct: 20 },
  bouncesRecovered: { count: 1, total: 2, pct: 50 },
  replyRate: { count: 4, total: 10, pct: 40, simulated: false },
};

const sampleRates: SignalReplyRate[] = [
  { type: "hiring", count: 2, total: 5, pct: 40, simulated: false },
  { type: "launch", count: 1, total: 3, pct: 33.3, simulated: false },
  { type: "funding", count: 1, total: 2, pct: 50, simulated: true },
];

const sampleMailboxes: MailboxHealth[] = [
  {
    id: "mb-1",
    label: "outbound@example.com",
    sendVia: "resend",
    status: "healthy",
    pauseReason: null,
    pausedAt: null,
    sentToday: 12,
    dailyCap: 50,
    bounceRate: 1.2,
    complaintRate: 0.1,
    ratesSince: "2026-10-01T00:00:00Z",
    auth: {
      domain: "example.com",
      spf: "pass",
      dmarc: "pass",
      dkim: "valid",
      checkedOn: "2026-10-20T00:00:00Z",
    },
  },
];

const sampleStats: EngineStats = {
  lastRun: {
    trigger: "cron",
    startedAt: "2026-10-23T07:00:00Z",
    finishedAt: "2026-10-23T07:01:15Z",
    errors: 0,
  },
  runs: 48,
  p50Ms: 75000,
  p95Ms: 120000,
  leadsPerRun: 35,
  tokensPerLead: 2400,
  errorRate: { count: 1, total: 48, pct: 2.1 },
  draftsBlocked: { count: 2, total: 50, pct: 4 },
};

const sampleCoverage: BoardCoverage = {
  companies: 120,
  sites: [
    { site: "greenhouse", checked: 85 },
    { site: "lever", checked: 20 },
    { site: "ashby", checked: 15 },
  ],
  lastLocalRun: "2026-10-22T18:00:00Z",
};

const sampleAuditRows: AuditRow[] = [
  {
    id: "aud-1",
    createdAt: "2026-10-23T07:30:00Z",
    actorType: "agent",
    actorName: null,
    action: "lead.scored",
    entityType: "lead",
    entityId: "lead-12345678",
    detail: {},
  },
  {
    id: "aud-2",
    createdAt: "2026-10-23T07:35:00Z",
    actorType: "user",
    actorName: "Sarah Admin",
    action: "email.approved",
    entityType: "sequence",
    entityId: "seq-87654321",
    detail: {},
  },
];

const sampleGroups = ["agent", "email", "lead", "mailbox"];

const sampleBudget: LlmBudget = {
  used: 45,
  limit: 100,
  agentLimit: 70,
};

const samplePacing: LlmPacing = {
  draftsPerRun: 15,
  agentShare: 0.7,
  maxRetriesPerLead: 2,
  minSecondsBetweenCalls: 3,
  regeneratePerUserPerHour: 20,
};

describe("OpsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetKpis.mockResolvedValue(sampleKpis);
    mockGetReplyRateBySignal.mockResolvedValue(sampleRates);
    mockGetMailboxHealth.mockResolvedValue(sampleMailboxes);
    mockGetEngineStats.mockResolvedValue(sampleStats);
    mockGetBoardCoverage.mockResolvedValue(sampleCoverage);
    mockListAuditLog.mockResolvedValue(sampleAuditRows);
    mockAuditActionGroups.mockResolvedValue(sampleGroups);
    mockLlmBudgetToday.mockResolvedValue(sampleBudget);
    mockLlmPacing.mockResolvedValue(samplePacing);
  });

  it("renders all five sections with data", async () => {
    const jsx = await OpsPage({});
    const html = renderToStaticMarkup(jsx);

    // Section 1: KPI strip
    expect(html).toContain("Scored today");
    expect(html).toContain("42");
    expect(html).toContain("Enrolled");
    expect(html).toContain("15");
    expect(html).toContain("Reply rate");

    // Section 2: Reply rate by signal
    expect(html).toContain("Reply rate by signal");
    expect(html).toContain("Hiring");
    expect(html).toContain("Launch");
    expect(html).toContain("Funding");
    expect(html).toContain("Simulated");

    // Section 3: Mailbox health table
    expect(html).toContain("Mailbox health");
    expect(html).toContain("outbound@example.com");
    expect(html).toContain("Healthy");
    expect(html).toContain("12 of 50");

    // Section 4: Engine section (EnginePanel + LlmBudgetTile + LlmPacingTile)
    expect(html).toContain("Engine stats");
    expect(html).toContain("Job board coverage");
    expect(html).toContain("AI budget");
    expect(html).toContain("LLM pacing");
    expect(html).toContain("45 of 100");

    // Section 5: Audit log stream
    expect(html).toContain("Audit log");
    expect(html).toContain("lead.scored");
    expect(html).toContain("email.approved");
    expect(html).toContain("Sarah Admin");
  });

  it("filters audit log when valid actor and group searchParams are provided", async () => {
    const searchParams = Promise.resolve({
      actor: "agent",
      group: "lead",
    });

    const jsx = await OpsPage({ searchParams });
    renderToStaticMarkup(jsx);

    expect(mockListAuditLog).toHaveBeenCalledWith({
      actorType: "agent",
      actionGroup: "lead",
    });
  });

  it("ignores invalid actor and invalid group searchParams", async () => {
    const searchParams = Promise.resolve({
      actor: "hacker",
      group: "nonexistent",
    });

    const jsx = await OpsPage({ searchParams });
    renderToStaticMarkup(jsx);

    expect(mockListAuditLog).toHaveBeenCalledWith({});
  });

  it("accepts user actor and valid email group", async () => {
    const searchParams = Promise.resolve({
      actor: "user",
      group: "email",
    });

    const jsx = await OpsPage({ searchParams });
    renderToStaticMarkup(jsx);

    expect(mockListAuditLog).toHaveBeenCalledWith({
      actorType: "user",
      actionGroup: "email",
    });
  });
});

describe("OpsLoading", () => {
  it("renders layout skeleton with aria-busy", () => {
    const html = renderToStaticMarkup(<OpsLoading />);
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('aria-label="Loading ops telemetry"');
  });
});

describe("OpsError", () => {
  it("renders error state with short message and Try again button", () => {
    const reset = vi.fn();
    const html = renderToStaticMarkup(
      <OpsError error={new Error("Database connection lost")} reset={reset} />
    );

    expect(html).toContain("Failed to load ops telemetry");
    expect(html).toContain("Database connection lost");
    expect(html).toContain("Try again");
  });
});
