"use client";

import * as React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui";

export default function LeadsError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  React.useEffect(() => {
    console.error("Leads page error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-bad/10 text-bad mb-4">
        <AlertCircle className="h-6 w-6" aria-hidden="true" />
      </div>

      <h2 className="text-section font-semibold text-text mb-2">
        Failed to load leads table
      </h2>

      <p className="text-body text-muted max-w-md mb-2">
        The application could not query the leads catalog or calculate page totals.
      </p>

      {error.message && (
        <p className="font-mono text-label text-subtle bg-surface-2 px-2.5 py-1 rounded-control mb-6 max-w-lg truncate">
          {error.message}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button variant="primary" onClick={() => retry()} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          <span>Try again</span>
        </Button>
      </div>
    </div>
  );
}
