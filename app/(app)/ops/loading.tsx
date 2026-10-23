import { Skeleton } from "@/components/ui";

export default function OpsLoading() {
  return (
    <div
      className="flex flex-col gap-6 max-w-5xl mx-auto py-6 px-4 w-full"
      aria-busy="true"
      aria-label="Loading ops telemetry"
    >
      {/* 1. KPI strip skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col justify-between gap-2 rounded-panel border border-border bg-surface p-4"
          >
            <Skeleton className="h-3 w-20 rounded-control" />
            <Skeleton className="h-6 w-24 rounded-control" />
          </div>
        ))}
      </div>

      {/* 2. Reply rate by signal skeleton */}
      <div className="flex flex-col gap-4 rounded-panel border border-border bg-surface p-4">
        <Skeleton className="h-3.5 w-36 rounded-control" />
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <Skeleton className="h-3.5 w-20 rounded-control" />
                <Skeleton className="h-3.5 w-24 rounded-control" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          ))}
        </div>
      </div>

      {/* 3. Mailbox health table skeleton */}
      <div className="flex flex-col gap-3 rounded-panel border border-border bg-surface p-4">
        <Skeleton className="h-3.5 w-28 rounded-control" />
        <div className="w-full overflow-x-auto">
          <div className="flex flex-col divide-y divide-border/60">
            <div className="flex items-center justify-between py-2.5 gap-4">
              <Skeleton className="h-3 w-16 rounded-control" />
              <Skeleton className="h-3 w-16 rounded-control" />
              <Skeleton className="h-3 w-20 rounded-control" />
              <Skeleton className="h-3 w-20 rounded-control" />
              <Skeleton className="h-3 w-20 rounded-control" />
              <Skeleton className="h-3 w-24 rounded-control" />
            </div>
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between py-3 gap-4">
                <Skeleton className="h-4 w-28 rounded-control" />
                <Skeleton className="h-5 w-16 rounded-control" />
                <Skeleton className="h-3.5 w-24 rounded-control" />
                <Skeleton className="h-3.5 w-12 rounded-control" />
                <Skeleton className="h-3.5 w-12 rounded-control" />
                <Skeleton className="h-5 w-36 rounded-control" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Engine section skeleton */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-5 rounded-panel border border-border bg-surface p-4">
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-border/60">
            <Skeleton className="h-3.5 w-24 rounded-control" />
            <Skeleton className="h-3 w-28 rounded-control" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="flex flex-col gap-1 p-2.5 rounded-control bg-surface-2/40 border border-border/50"
              >
                <Skeleton className="h-3 w-16 rounded-control" />
                <Skeleton className="h-5 w-20 rounded-control" />
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-border/40">
            <Skeleton className="h-3.5 w-44 rounded-control" />
            <Skeleton className="h-3.5 w-20 rounded-control" />
          </div>
          <div className="flex flex-col gap-2 pt-3 border-t border-border/60">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-32 rounded-control" />
              <Skeleton className="h-3 w-28 rounded-control" />
            </div>
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-1 border-b border-border/30 last:border-b-0"
              >
                <Skeleton className="h-3.5 w-20 rounded-control" />
                <Skeleton className="h-3.5 w-48 rounded-control" />
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-3 rounded-panel border border-border bg-surface p-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-20 rounded-control" />
              <Skeleton className="h-4 w-4 rounded-control" />
            </div>
            <Skeleton className="h-5 w-40 rounded-control" />
            <Skeleton className="h-1.5 w-full rounded-full" />
          </div>
          <div className="flex flex-col gap-3 rounded-panel border border-border bg-surface p-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-24 rounded-control" />
              <Skeleton className="h-4 w-4 rounded-control" />
            </div>
            <Skeleton className="h-4 w-32 rounded-control" />
            <Skeleton className="h-4 w-28 rounded-control" />
          </div>
        </div>
      </div>

      {/* 5. Audit log stream skeleton */}
      <div className="flex flex-col gap-4 rounded-panel border border-border bg-surface p-4">
        <div className="flex items-center justify-between gap-3 pb-2 border-b border-border/60">
          <Skeleton className="h-3.5 w-20 rounded-control" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-7 w-28 rounded-control" />
            <Skeleton className="h-7 w-24 rounded-control" />
          </div>
        </div>
        <div className="flex flex-col divide-y divide-border/40">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between py-2.5 gap-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-12 rounded-control" />
                <Skeleton className="h-4 w-36 rounded-control" />
              </div>
              <Skeleton className="h-3.5 w-24 rounded-control" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
