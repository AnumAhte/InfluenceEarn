/** Neutral placeholder shown while an app page streams in. */
export function PageSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="mx-auto flex max-w-[1180px] animate-pulse flex-col gap-7">
      <div className="flex flex-col gap-3">
        <div className="h-7 w-64 rounded-lg bg-line" />
        <div className="h-4 w-96 max-w-full rounded-lg bg-line/70" />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="h-64 rounded-card border border-line bg-surface" />
        <div className="h-64 rounded-card border border-line bg-surface" />
      </div>
    </div>
  );
}
