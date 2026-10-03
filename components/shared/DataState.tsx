import type { ReactNode } from "react";
export function EmptyState({
  title = "No data yet",
  children,
}: {
  title?: string;
  children?: ReactNode;
}) {
  return (
    <div
      role="status"
      className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center"
    >
      <p className="font-semibold">{title}</p>
      <p className="muted mt-2">{children ?? "Try another selection."}</p>
    </div>
  );
}
export function Skeleton({ label = "Loading dashboard" }: { label?: string }) {
  return (
    <div role="status" aria-label={label} className="space-y-5">
      <span className="sr-only">{label}</span>
      <div className="h-16 w-2/3 animate-pulse rounded-xl bg-slate-200" />
      <div className="grid gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="panel h-36 animate-pulse bg-slate-100" />
        ))}
      </div>
      <div className="panel h-80 animate-pulse bg-slate-100" />
    </div>
  );
}
