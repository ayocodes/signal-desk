import {
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";

export default function LeadsLoading() {
  return (
    <div className="flex flex-col gap-3 h-full" aria-busy="true" aria-label="Loading leads">
      <div className="flex items-center justify-between px-1">
        <Skeleton className="h-4 w-24 rounded-control" />
        <Skeleton className="h-7 w-36 rounded-control" />
      </div>

      <Table>
        <TableHeader>
          <tr>
            <TableHead>Company</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Score</TableHead>
            <TableHead>Top Signal</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Assigned Rep</TableHead>
            <TableHead>Updated</TableHead>
          </tr>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 12 }).map((_, i) => (
            <TableRow key={i}>
              {/* Company */}
              <TableCell>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-28 rounded-control" />
                  <Skeleton className="h-3 w-20 rounded-control" />
                </div>
              </TableCell>

              {/* Contact */}
              <TableCell>
                <Skeleton className="h-3.5 w-32 rounded-control" />
              </TableCell>

              {/* Score */}
              <TableCell>
                <div className="flex items-center gap-1.5">
                  <Skeleton className="h-5 w-7 rounded-control" />
                  <Skeleton className="h-3 w-12 rounded-control" />
                </div>
              </TableCell>

              {/* Top signal */}
              <TableCell>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-14 rounded-control" />
                  <Skeleton className="h-3.5 w-36 rounded-control" />
                </div>
              </TableCell>

              {/* Status */}
              <TableCell>
                <Skeleton className="h-5 w-16 rounded-control" />
              </TableCell>

              {/* Assigned rep */}
              <TableCell>
                <Skeleton className="h-3.5 w-20 rounded-control" />
              </TableCell>

              {/* Updated */}
              <TableCell>
                <Skeleton className="h-3 w-12 rounded-control" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="flex items-center justify-between px-2 py-1">
        <Skeleton className="h-4 w-36 rounded-control" />
        <Skeleton className="h-7 w-36 rounded-control" />
      </div>
    </div>
  );
}
