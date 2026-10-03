import { STATUS, type Status } from "@/lib/status";
export default function StatusPill({ status }: { status: Status | null }) {
  if (!status)
    return (
      <span className="inline-flex rounded-full border border-slate-300 bg-slate-100 px-2.5 py-1 text-[13px] font-medium text-slate-700">
        — No data yet
      </span>
    );
  const s = STATUS[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[13px] font-semibold ${s.classes}`}
    >
      <span aria-hidden="true">{s.icon}</span>
      {s.label}
    </span>
  );
}
