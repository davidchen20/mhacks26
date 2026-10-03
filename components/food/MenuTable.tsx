"use client";
import DataTable from "@/components/shared/DataTable";
import StatusPill from "@/components/shared/StatusPill";
import { STATUS, statusFor, THRESHOLDS } from "@/lib/status";
import { currency, percent } from "@/lib/format";
import type { MenuItem } from "@/lib/mockData";
export default function MenuTable({
  items,
  selectedId,
  onSelect,
}: {
  items: MenuItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="panel overflow-hidden" aria-label="Menu waste by item">
      <div className="border-b border-slate-200 p-5">
        <h2 className="section-title">Menu items</h2>
        <p className="muted mt-1">
          Select an item to highlight related tray readings. Progress marker:{" "}
          {THRESHOLDS.remaining.onTrack}% remaining target.
        </p>
      </div>
      <DataTable
        caption="Menu items"
        rows={items}
        rowKey={(i) => i.id}
        selectedId={selectedId ?? undefined}
        initialSort="remaining"
        columns={[
          {
            key: "name",
            label: "Item",
            value: (i) => i.name,
            render: (i) => (
              <button
                className="min-h-10 text-left font-semibold text-navy underline decoration-slate-300 underline-offset-4"
                aria-pressed={selectedId === i.id}
                onClick={() => onSelect(i.id)}
              >
                {i.name}
              </button>
            ),
          },
          { key: "category", label: "Category", value: (i) => i.category },
          {
            key: "remaining",
            label: "Remaining %",
            value: (i) => i.remainingPct,
            render: (i) => (
              <div className="min-w-28">
                <span className="font-semibold">{percent(i.remainingPct)}</span>
                <div
                  className="relative mt-2 h-2 rounded-full bg-slate-100"
                  role="progressbar"
                  aria-label={`${i.name} portion remaining, target ${THRESHOLDS.remaining.onTrack}%`}
                  aria-valuenow={i.remainingPct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="h-2 rounded-full"
                    style={{
                      width: `${i.remainingPct}%`,
                      background: STATUS[statusFor(i.remainingPct)].color,
                    }}
                  />
                  <span
                    aria-hidden="true"
                    className="absolute -top-1 h-4 border-l-2 border-slate-900"
                    style={{ left: `${THRESHOLDS.remaining.onTrack}%` }}
                  />
                </div>
              </div>
            ),
          },
          {
            key: "cost",
            label: "Waste cost",
            value: (i) => i.wasteCost,
            render: (i) => (
              <span className="whitespace-nowrap">
                {currency(i.wasteCost, "per service", 2)}
              </span>
            ),
          },
          {
            key: "status",
            label: "Status",
            value: (i) => i.remainingPct,
            render: (i) => <StatusPill status={statusFor(i.remainingPct)} />,
          },
        ]}
      />
    </section>
  );
}
