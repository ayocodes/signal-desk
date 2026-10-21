// UI rules that span several components. Lives in lib/ (outside Flash's cards) so a card
// can't change these expectations to match a regression.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { QueueList } from "@/components/queue/QueueList";
import type { LeadListItem } from "@/lib/types";

// A fixed request time, so relative ages ("6h ago") are deterministic.
const TEST_NOW = Date.parse("2026-10-21T12:00:00Z");


vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/queue" }));

const lead: LeadListItem = {
  id: "l1",
  status: "ready",
  score: 60,
  scoreParts: [["ICP match", 40], ["Marketing hire", 20]],
  band: "Borderline",
  tier: "lo",
  company: { id: "c1", name: "Acme", domain: "acme.dev" },
  contact: { name: "Founder", title: "Founder", isPlaceholder: true },
  topSignal: {
    id: "s1",
    type: "hiring",
    category: "marketing",
    label: "Marketing hire",
    title: "Marketing hire: Head of Marketing",
    excerpt: null,
    sourceName: "Ashby",
    sourceUrl: null,
    occurredAt: "2026-10-20T10:00:00Z",
  },
  signalTypes: ["hiring", "funding"],
  newestSignalAt: "2026-10-20T10:00:00Z",
  assignee: null,
  updatedAt: "2026-10-21T08:00:00Z",
};

describe("signal words match the score math everywhere", () => {
  const html = renderToStaticMarkup(
    <QueueList now={TEST_NOW}
      leads={[lead]}
      counts={{ ready: 1, enrolled: 0, bounced: 0, replied: 0, filtered: 0 }}
      filtered={{ items: [], total: 0 }}
      currentTab="ready"
      currentSignals={[]}
    />,
  );

  it("labels the YC filter chip 'YC recent', not the database word 'funding'", () => {
    expect(html).toContain("YC recent");
    expect(html).not.toMatch(/>\s*Funding\s*</);
  });

  it("tags a queue row's top signal with its label (Marketing hire), not the raw type", () => {
    expect(html).toContain(">Marketing hire<");
    expect(html).not.toMatch(/>\s*hiring\s*</);
  });
});
