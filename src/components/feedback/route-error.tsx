"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

/** Shared body for `error.tsx` boundaries. Never renders raw error messages to users. */
export function RouteError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto flex max-w-[480px] flex-col items-center gap-4 px-6 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-[14px] border border-danger-border bg-danger-bg text-danger">
        <AlertTriangle aria-hidden className="size-5" />
      </span>
      <h1 className="text-xl font-bold tracking-[-0.02em]">Something went wrong</h1>
      <p className="text-sm leading-relaxed text-ink-secondary">
        We couldn&apos;t load this page. Please try again.
        {error.digest ? <span className="mt-1 block text-xs text-ink-muted">Reference: {error.digest}</span> : null}
      </p>
      <Button onClick={() => retry()}>Try again</Button>
    </div>
  );
}
