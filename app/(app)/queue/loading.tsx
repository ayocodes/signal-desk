import { Skeleton } from "@/components/ui";
import { SplitView } from "@/components/queue/SplitView";

export default function QueueLoading() {
  return (
    <div className="flex flex-col gap-3 h-full" aria-busy="true" aria-label="Loading queue">
      <div className="flex items-center justify-end px-1 h-6">
        <Skeleton className="h-4 w-28 rounded-control" />
      </div>

      <SplitView
        list={
          <div className="flex flex-col h-full divide-y divide-border/60">
            {/* Tab skeletons */}
            <div className="p-3 bg-surface">
              <div className="flex items-center gap-1">
                <Skeleton className="h-8 w-20 rounded-control" />
                <Skeleton className="h-8 w-24 rounded-control" />
                <Skeleton className="h-8 w-24 rounded-control" />
                <Skeleton className="h-8 w-20 rounded-control" />
              </div>
            </div>

            {/* Signal filter chip skeletons */}
            <div className="px-3 py-2 bg-surface-2/40 flex items-center gap-1.5">
              <Skeleton className="h-5 w-20 rounded-control" />
              <Skeleton className="h-5 w-16 rounded-control" />
              <Skeleton className="h-5 w-16 rounded-control" />
              <Skeleton className="h-5 w-16 rounded-control" />
            </div>

            {/* List item skeletons */}
            <div className="flex-1 divide-y divide-border/60">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-surface">
                  <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5 min-w-8">
                    <Skeleton className="h-6 w-7 rounded-control" />
                    <Skeleton className="h-2.5 w-10 rounded-sm" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <Skeleton className="h-4 w-32 rounded-control" />
                      <Skeleton className="h-3 w-12 rounded-control" />
                    </div>
                    <Skeleton className="h-3 w-40 rounded-control" />
                    <div className="flex items-center gap-1.5 pt-0.5">
                      <Skeleton className="h-4 w-14 rounded-control" />
                      <Skeleton className="h-3 w-28 rounded-control" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        }
        detail={
          <div className="p-6 space-y-6">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-border">
              <div className="space-y-2">
                <Skeleton className="h-6 w-48 rounded-control" />
                <Skeleton className="h-4 w-32 rounded-control" />
              </div>
              <Skeleton className="h-8 w-20 rounded-control" />
            </div>

            <div className="space-y-3">
              <Skeleton className="h-4 w-24 rounded-control" />
              <div className="space-y-2">
                <Skeleton className="h-20 w-full rounded-control" />
                <Skeleton className="h-20 w-full rounded-control" />
              </div>
            </div>

            <div className="space-y-3">
              <Skeleton className="h-4 w-28 rounded-control" />
              <Skeleton className="h-16 w-full rounded-control" />
            </div>
          </div>
        }
      />
    </div>
  );
}
