import type { ReactNode } from "react";
export default function KpiTile({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  detail: ReactNode;
  tone?: "neutral" | "good" | "warning";
}) {
  return (
    <section
      aria-label={label}
      className={`panel border-l-4 p-5 ${tone === "good" ? "border-l-emerald-600" : tone === "warning" ? "border-l-rose-600" : "border-l-slate-200"}`}
    >
      <h2 className="text-sm font-medium text-slate-600">{label}</h2>
      <div
        className={`mt-3 break-words text-2xl font-semibold tracking-tight ${tone === "good" ? "text-emerald-800" : tone === "warning" ? "text-rose-800" : "text-navy"}`}
      >
        {value}
      </div>
      <div className="muted mt-3">{detail}</div>
    </section>
  );
}
