import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TablePager,
  TableRow,
  TableSortHeader,
} from "@/components/ui/Table";
import LeadsLoading from "./loading";
import LeadsError from "./error";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/leads",
}));

describe("Table UI components", () => {
  describe("Table and Rows", () => {
    it("renders sticky header and 32px rows (h-8)", () => {
      const html = renderToStaticMarkup(
        <Table>
          <TableHeader>
            <tr>
              <TableHead>Company</TableHead>
            </tr>
          </TableHeader>
          <TableBody>
            <TableRow href="/queue?lead=123">
              <TableCell>Acme</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      );

      // Sticky header check
      expect(html).toContain("sticky top-0");

      // 32px row height check (h-8 in Tailwind is 32px)
      expect(html).toContain("h-8");

      // Clickable row styles check
      expect(html).toContain("cursor-pointer");
      expect(html).toContain("Acme");
    });
  });

  describe("TableSortHeader", () => {
    it("renders sort link setting sort and dir", () => {
      const html = renderToStaticMarkup(
        <TableSortHeader
          column="score"
          label="Score"
          currentSort="score"
          currentDir="desc"
          basePath="/leads"
        />
      );

      expect(html).toContain("Score");
      expect(html).toContain('href="/leads?sort=score&amp;dir=asc"');
      expect(html).toContain("<svg"); // ArrowDown icon for desc
    });

    it("defaults to desc for score/updated when not yet sorted", () => {
      const html = renderToStaticMarkup(
        <TableSortHeader
          column="score"
          label="Score"
          currentSort="company"
          currentDir="asc"
          basePath="/leads"
        />
      );

      expect(html).toContain('href="/leads?sort=score&amp;dir=desc"');
    });

    it("defaults to asc for company when not yet sorted", () => {
      const html = renderToStaticMarkup(
        <TableSortHeader
          column="company"
          label="Company"
          currentSort="score"
          currentDir="desc"
          basePath="/leads"
        />
      );

      expect(html).toContain('href="/leads?sort=company&amp;dir=asc"');
    });
  });

  describe("TablePager", () => {
    it('renders "1-100 of 1,060" text and pagination links', () => {
      const html = renderToStaticMarkup(
        <TablePager
          page={1}
          pageSize={100}
          total={1060}
          sort="score"
          dir="desc"
          basePath="/leads"
        />
      );

      // Plain hyphen text check (no en-dash)
      expect(html).toContain("1-100 of 1,060");

      // First page: previous is disabled, next is active link
      expect(html).toContain('href="/leads?sort=score&amp;dir=desc&amp;page=2"');
      expect(html).toContain('aria-disabled="true"');
    });

    it("renders middle page range and both prev/next links", () => {
      const html = renderToStaticMarkup(
        <TablePager
          page={3}
          pageSize={100}
          total={1060}
          sort="score"
          dir="desc"
          basePath="/leads"
        />
      );

      expect(html).toContain("201-300 of 1,060");
      expect(html).toContain('href="/leads?sort=score&amp;dir=desc&amp;page=2"');
      expect(html).toContain('href="/leads?sort=score&amp;dir=desc&amp;page=4"');
    });

    it("disables next link on the final page", () => {
      const html = renderToStaticMarkup(
        <TablePager
          page={11}
          pageSize={100}
          total={1060}
          sort="score"
          dir="desc"
          basePath="/leads"
        />
      );

      expect(html).toContain("1,001-1,060 of 1,060");
      expect(html).toContain('aria-disabled="true"');
    });
  });

  describe("LeadsLoading", () => {
    it("renders skeleton table with header and rows", () => {
      const html = renderToStaticMarkup(<LeadsLoading />);
      expect(html).toContain('aria-busy="true"');
      expect(html).toContain("Company");
      expect(html).toContain("Contact");
      expect(html).toContain("animate-pulse");
    });
  });

  describe("LeadsError", () => {
    it("renders error state with description and retry button", () => {
      const html = renderToStaticMarkup(
        <LeadsError error={new Error("Network timeout")} retry={() => {}} />
      );
      expect(html).toContain("Failed to load leads table");
      expect(html).toContain("Network timeout");
      expect(html).toContain("Try again");
    });
  });
});

