import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { buttonClassName } from "@/components/ui/button-styles";

export function Forbidden() {
  return (
    <main className="flex min-h-[60vh] w-full flex-col items-center justify-center p-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-warn/15 text-warn mb-4">
        <ShieldAlert className="h-6 w-6" aria-hidden="true" />
      </div>

      <h1 className="text-title font-semibold tracking-tight text-text mb-2">
        You don&apos;t have access to this page
      </h1>

      <p className="text-meta text-muted max-w-sm mb-6 leading-relaxed">
        This page is for admins. Your leads are waiting in the queue.
      </p>

      <Link href="/queue" className={buttonClassName({ variant: "secondary" })}>
        Back to Queue
      </Link>
    </main>
  );
}
