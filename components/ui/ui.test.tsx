import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AlertCircle } from "lucide-react";
import {
  Avatar,
  Button,
  EmptyState,
  Input,
  Kbd,
  Panel,
  PanelBody,
  PanelFooter,
  PanelHeader,
  Pill,
  ScoreBadge,
  SegmentedControl,
  Skeleton,
  SkeletonRow,
  Tabs,
  Tag,
  Textarea,
  Toast,
} from "./index";

describe("UI Primitives", () => {
  describe("Button", () => {
    it("renders primary, secondary, ghost, and danger variants", () => {
      const primary = renderToStaticMarkup(<Button variant="primary">Primary</Button>);
      expect(primary).toContain("bg-accent");
      expect(primary).toContain("focus-visible:ring-accent");

      const secondary = renderToStaticMarkup(<Button variant="secondary">Secondary</Button>);
      expect(secondary).toContain("bg-surface");

      const ghost = renderToStaticMarkup(<Button variant="ghost">Ghost</Button>);
      expect(ghost).toContain("bg-transparent");

      const danger = renderToStaticMarkup(<Button variant="danger">Danger</Button>);
      expect(danger).toContain("text-bad");
    });
  });

  describe("Input", () => {
    it("renders input with focus-visible ring", () => {
      const html = renderToStaticMarkup(<Input placeholder="Enter domain..." />);
      expect(html).toContain("<input");
      expect(html).toContain("focus-visible:ring-accent");
      expect(html).toContain('placeholder="Enter domain..."');
    });
  });

  describe("Textarea", () => {
    it("renders textarea with focus-visible ring", () => {
      const html = renderToStaticMarkup(<Textarea placeholder="Draft message..." />);
      expect(html).toContain("<textarea");
      expect(html).toContain("focus-visible:ring-accent");
    });
  });

  describe("Kbd", () => {
    it("renders kbd element with monospace styling", () => {
      const html = renderToStaticMarkup(<Kbd>⌘K</Kbd>);
      expect(html).toContain("<kbd");
      expect(html).toContain("font-mono");
      expect(html).toContain("⌘K");
    });
  });

  describe("Pill", () => {
    it("renders status tones and indicator dot", () => {
      const good = renderToStaticMarkup(<Pill tone="good">Enrolled</Pill>);
      expect(good).toContain("text-good");
      expect(good).toContain("Enrolled");

      const warn = renderToStaticMarkup(<Pill tone="warn">Paused</Pill>);
      expect(warn).toContain("text-warn");

      const bad = renderToStaticMarkup(<Pill tone="bad">Bounced</Pill>);
      expect(bad).toContain("text-bad");

      const neutral = renderToStaticMarkup(<Pill tone="neutral">Draft</Pill>);
      expect(neutral).toContain("text-muted");
    });
  });

  describe("Tag", () => {
    it("renders signal tag with signal styling", () => {
      const html = renderToStaticMarkup(<Tag>Hiring</Tag>);
      expect(html).toContain("text-signal");
      expect(html).toContain("Hiring");
    });

    it("renders interactive tag button when onClick is provided", () => {
      const html = renderToStaticMarkup(
        <Tag interactive onClick={() => {}}>
          Filter
        </Tag>
      );
      expect(html).toContain("<button");
      expect(html).toContain("focus-visible:ring-accent");
    });
  });

  describe("ScoreBadge", () => {
    it("renders correct tiers based on score value", () => {
      const hi = renderToStaticMarkup(<ScoreBadge score={85} />);
      expect(hi).toContain("text-good");
      expect(hi).toContain("85");

      const md = renderToStaticMarkup(<ScoreBadge score={60} />);
      expect(md).toContain("text-warn");
      expect(md).toContain("60");

      const lo = renderToStaticMarkup(<ScoreBadge score={30} />);
      expect(lo).toContain("text-muted");
      expect(lo).toContain("30");
    });

    it("respects explicit tier override", () => {
      const html = renderToStaticMarkup(<ScoreBadge score={90} tier="lo" />);
      expect(html).toContain("text-muted");
    });
  });

  describe("Tabs", () => {
    it("renders tablist with count chips", () => {
      const items = [
        { id: "ready", label: "Ready", count: 12 },
        { id: "enrolled", label: "Enrolled", count: 4 },
      ];
      const html = renderToStaticMarkup(
        <Tabs items={items} value="ready" onChange={() => {}} />
      );

      expect(html).toContain('role="tablist"');
      expect(html).toContain('aria-selected="true"');
      expect(html).toContain("Ready");
      expect(html).toContain("12");
      expect(html).toContain("Enrolled");
      expect(html).toContain("4");
    });
  });

  describe("SegmentedControl", () => {
    it("renders radio group with options", () => {
      const options = [
        { value: "admin", label: "Admin" },
        { value: "rep", label: "Rep" },
      ];
      const html = renderToStaticMarkup(
        <SegmentedControl options={options} value="admin" onChange={() => {}} />
      );

      expect(html).toContain('role="group"');
      expect(html).toContain('role="radio"');
      expect(html).toContain('aria-checked="true"');
      expect(html).toContain("Admin");
      expect(html).toContain("Rep");
    });
  });

  describe("Panel", () => {
    it("renders panel with header, body, and footer", () => {
      const html = renderToStaticMarkup(
        <Panel>
          <PanelHeader title="Signals" action={<Button size="sm">Add</Button>} />
          <PanelBody>Panel content</PanelBody>
          <PanelFooter>Footer note</PanelFooter>
        </Panel>
      );

      expect(html).toContain("rounded-panel");
      expect(html).toContain("Signals");
      expect(html).toContain("Panel content");
      expect(html).toContain("Footer note");
    });
  });

  describe("EmptyState", () => {
    it("renders empty state with icon, title, body, and action", () => {
      const html = renderToStaticMarkup(
        <EmptyState
          icon={AlertCircle}
          title="No leads yet"
          body="Your queue will fill automatically as signals arrive."
          action={<Button size="sm">Run agent</Button>}
        />
      );

      expect(html).toContain("No leads yet");
      expect(html).toContain("Your queue will fill automatically");
      expect(html).toContain("Run agent");
    });
  });

  describe("Avatar", () => {
    it("extracts initials from full name", () => {
      const html = renderToStaticMarkup(<Avatar name="Jane Doe" />);
      expect(html).toContain("JD");
      expect(html).toContain('aria-label="Jane Doe"');
    });

    it("uses provided initials directly", () => {
      const html = renderToStaticMarkup(<Avatar initials="SD" />);
      expect(html).toContain("SD");
    });
  });

  describe("Skeleton", () => {
    it("renders base skeleton and skeleton row", () => {
      const base = renderToStaticMarkup(<Skeleton className="h-4 w-20" />);
      expect(base).toContain("animate-pulse");

      const row = renderToStaticMarkup(<SkeletonRow />);
      expect(row).toContain("animate-pulse");
      expect(row).toContain("h-9");
    });
  });

  describe("Toast", () => {
    it("renders toast message with status role", () => {
      const html = renderToStaticMarkup(
        <Toast message="Ledgerline enrolled" tone="good" />
      );
      expect(html).toContain('role="status"');
      expect(html).toContain("Ledgerline enrolled");
      expect(html).toContain("text-good");
    });
  });
});
