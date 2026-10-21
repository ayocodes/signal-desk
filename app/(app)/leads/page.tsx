import { Users } from "lucide-react";
import { listLeadsPage } from "@/lib/data/leads";
import { EmptyState, TablePager } from "@/components/ui";
import { LeadsTableClient } from "./LeadsTableClient";
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
        {/* The shell's top bar already shows "Leads" as the page heading. */}
        <span className="text-meta font-mono text-muted">{data.total.toLocaleString()} leads</span>
        <TablePager
          page={data.page}
          pageSize={data.pageSize}
          total={data.total}
          sort={sort}
          dir={dir}
          basePath="/leads"
        />
      </div>

      <LeadsTableClient data={data} sort={sort} dir={dir} />

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
