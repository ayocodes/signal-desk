// The page reads the session and data at request time; this is its Suspense placeholder,
// so a click into the page shows at once (Next's instant navigation needs a boundary here).
import { Skeleton } from "@/components/ui";

export default function OpsLoading() {
  return (
    <div className="flex flex-col gap-3 max-w-4xl mx-auto py-4 w-full" aria-busy="true" aria-label="Loading ops">
      <Skeleton className="h-6 w-48 rounded-control" />
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full rounded-panel" />
      ))}
    </div>
  );
}
