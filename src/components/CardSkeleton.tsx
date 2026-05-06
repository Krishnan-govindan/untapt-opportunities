export function CardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-3 flex gap-1.5">
        <div className="skeleton-violet h-4 w-12" />
        <div className="skeleton-violet h-4 w-10" />
      </div>
      <div className="skeleton-violet h-5 w-3/4" />
      <div className="skeleton-violet mt-3 h-3 w-full" />
      <div className="skeleton-violet mt-2 h-3 w-2/3" />
      <div className="mt-5 flex items-center justify-between">
        <div className="skeleton-violet h-4 w-24" />
        <div className="skeleton-violet h-7 w-14" />
      </div>
    </div>
  );
}
