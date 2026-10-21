import Link from "next/link";
import { Users } from "lucide-react";
import { listLeadsPage } from "@/lib/data/leads";
import {
  EmptyState,
  ScoreBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TablePager,
  TableRow,
  TableSortHeader,
  Tag,
} from "@/components/ui";
import { StatusPill } from "@/components/leads";
import { formatSignalAge } from "@/components/leads/SignalCard";
import type { LeadsSort, SortDir } from "@/lib/types";

interface LeadsPageProps {
  searchParams: Promise<{
    sort?: string;
    dir?: string;
    page?: string;
  }>;
}

const VALID_SORTS: readonly LeadsSort[] = ["score", "company", "status", "updated"] as const;

export default async function LeadsPage({ searchParams }: LeadsPageProps) {
  const params = await searchParams;

  const sort: LeadsSort =
    typeof params.sort === "string" && (VALID_SORTS as readonly string[]).includes(params.sort)
      ? (params.sort as LeadsSort)
      : "score";

  const dir: SortDir = params.dir === "asc" ? "asc" : "desc";

  const pageNum = typeof params.page === "string" ? parseInt(params.page, 10) : 1;
  const page = Number.isInteger(pageNum) && pageNum > 0 ? pageNum : 1;

  const data = await listLeadsPage({ sort, dir, page });

  if (data.total === 0) {
    return (
      <div className="py-12 max-w-2xl mx-auto">
        <EmptyState
          icon={Users}
          title="No discovered leads"
          body="Discovered companies and scored contacts appear here after the background agent completes an ICP sourcing run."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-baseline gap-2">
          <h1 className="text-section font-semibold text-text">Leads</h1>
          <span className="text-meta font-mono text-muted">
            ({data.total.toLocaleString()} leads)
          </span>
        </div>
        <TablePager
          page={data.page}
          pageSize={data.pageSize}
          total={data.total}
          sort={sort}
          dir={dir}
          basePath="/leads"
        />
      </div>

      <Table>
        <TableHeader>
          <tr>
            <TableSortHeader
              column="company"
              label="Company"
              currentSort={sort}
              currentDir={dir}
              basePath="/leads"
            />
            <TableHead>Contact</TableHead>
            <TableSortHeader
              column="score"
              label="Score"
              currentSort={sort}
              currentDir={dir}
              basePath="/leads"
            />
            <TableHead>Top Signal</TableHead>
            <TableSortHeader
              column="status"
              label="Status"
              currentSort={sort}
              currentDir={dir}
              basePath="/leads"
            />
            <TableHead>Assigned Rep</TableHead>
            <TableSortHeader
              column="updated"
              label="Updated"
              currentSort={sort}
              currentDir={dir}
              basePath="/leads"
            />
          </tr>
        </TableHeader>
        <TableBody>
          {data.rows.map((lead) => {
            const topSig = lead.topSignal;
            const extraSignals = lead.signalTypes.length - 1;
            const leadQueueHref = `/queue?lead=${lead.id}`;

            return (
              <TableRow key={lead.id} href={leadQueueHref}>
                {/* Company */}
                <TableCell className="font-medium text-text">
                  <div className="flex items-baseline gap-1.5">
                    <Link
                      href={leadQueueHref}
                      className="font-semibold text-text hover:underline truncate max-w-[180px]"
                    >
                      {lead.company.name}
                    </Link>
                    <span className="font-mono text-label text-muted truncate max-w-[140px]">
                      {lead.company.domain}
                    </span>
                  </div>
                </TableCell>

                {/* Contact */}
                <TableCell className="text-muted">
                  {lead.contact ? (
                    <span className="truncate max-w-[180px] inline-block">
                      {lead.contact.name}
                      {lead.contact.title ? ` · ${lead.contact.title}` : ""}
                    </span>
                  ) : (
                    <span className="text-subtle select-none">—</span>
                  )}
                </TableCell>

                {/* Score (with band) */}
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <ScoreBadge score={lead.score} tier={lead.tier} size="sm" />
                    <span className="font-mono text-label uppercase tracking-wider text-muted font-medium">
                      {lead.band}
                    </span>
                  </div>
                </TableCell>

                {/* Top signal */}
                <TableCell>
                  {topSig ? (
                    <div className="flex items-center gap-1.5 text-muted max-w-[280px]">
                      <Tag
                        active={false}
                        className="text-[10px] py-0 px-1 font-mono uppercase shrink-0"
                      >
                        {topSig.type}
                      </Tag>
                      <span className="truncate text-text text-meta">
                        {topSig.title}
                      </span>
                      {extraSignals > 0 && (
                        <span className="font-mono text-label text-subtle font-semibold shrink-0">
                          +{extraSignals}
                        </span>
                      )}
                      <span className="text-muted font-mono text-label shrink-0">
                        · {formatSignalAge(topSig.occurredAt)}
                      </span>
                    </div>
                  ) : (
                    <span className="text-subtle text-meta select-none">—</span>
                  )}
                </TableCell>

                {/* Status */}
                <TableCell>
                  <StatusPill status={lead.status} />
                </TableCell>

                {/* Assigned rep */}
                <TableCell className="text-muted">
                  {lead.assignee ? (
                    lead.assignee.name
                  ) : (
                    <span className="text-subtle">Unassigned</span>
                  )}
                </TableCell>

                {/* Updated */}
                <TableCell className="text-muted font-mono text-label tabular-nums">
                  {formatSignalAge(lead.updatedAt)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <div className="flex items-center justify-between px-2 py-1 text-meta text-muted">
        <span>
          Showing {data.rows.length} of {data.total.toLocaleString()} leads
        </span>
        <TablePager
          page={data.page}
          pageSize={data.pageSize}
          total={data.total}
          sort={sort}
          dir={dir}
          basePath="/leads"
        />
      </div>
    </div>
  );
}
