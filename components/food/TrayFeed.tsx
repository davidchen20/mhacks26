"use client";
import { useEffect, useRef, useState } from "react";
import { makeTray, type ServiceData, type Tray } from "@/lib/mockData";
import { THRESHOLDS, STATUS, statusFor } from "@/lib/status";
import { percent } from "@/lib/format";
import { EmptyState } from "@/components/shared/DataState";
function TrayThumbnail({ tray }: { tray: Tray }) {
  return (
    <svg
      viewBox="0 0 120 100"
      className="h-24 w-28 shrink-0 rounded-xl border border-slate-300 bg-slate-100"
      role="img"
      aria-label="Illustrated simulated tray, not a camera image"
    >
      <rect
        x="7"
        y="8"
        width="106"
        height="84"
        rx="12"
        fill="#e2e8f0"
        stroke="#94a3b8"
      />
      <rect x="14" y="15" width="54" height="70" rx="8" fill="#fff" />
      <rect x="74" y="15" width="32" height="32" rx="7" fill="#fff" />
      <rect x="74" y="53" width="32" height="32" rx="7" fill="#fff" />
      {tray.readings.map((r, i) => (
        <g
          key={r.itemId}
          transform={`translate(${i === 0 ? 40 : 90},${i === 0 ? 50 : i === 1 ? 31 : 69})`}
        >
          <ellipse
            rx={Math.max(
              5,
              (Math.sqrt(r.remainingPct) / 10) * (i === 0 ? 21 : 12),
            )}
            ry={i === 0 ? 18 : 10}
            fill={
              r.itemId === "broccoli" || r.itemId === "salad"
                ? "#047857"
                : r.itemId === "rice"
                  ? "#d6b16c"
                  : r.itemId === "yogurt"
                    ? "#cbd5e1"
                    : "#b7793d"
            }
          />
          <circle cx="-3" cy="-3" r="2" fill="#fff" opacity=".45" />
        </g>
      ))}
    </svg>
  );
}
export default function TrayFeed({
  service,
  selectedId,
}: {
  service: ServiceData;
  selectedId: string | null;
}) {
  const [paused, setPaused] = useState(false);
  const [trays, setTrays] = useState(() =>
    service.items.length
      ? [makeTray(service, 3), makeTray(service, 2), makeTray(service, 1)]
      : [],
  );
  const sequence = useRef(3);
  useEffect(() => {
    if (paused || !service.items.length) return;
    const timer = window.setInterval(() => {
      sequence.current += 1;
      const next = makeTray(service, sequence.current);
      setTrays((old) => [next, ...old].slice(0, 5));
    }, 6500);
    return () => window.clearInterval(timer);
  }, [paused, service]);
  return (
    <aside
      className="panel overflow-hidden"
      aria-label="Simulated live tray feed"
    >
      <div className="border-b border-slate-200 p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="section-title">Live tray feed</h2>
          <button
            className="btn btn-primary"
            aria-pressed={paused}
            onClick={() => setPaused((v) => !v)}
          >
            {paused ? "Resume" : "Pause"}
          </button>
        </div>
        <p
          role="status"
          className={`mt-3 text-sm font-semibold ${paused ? "text-slate-700" : "text-emerald-800"}`}
        >
          {paused ? "Ⅱ Paused" : "● Live · simulated"}
        </p>
        <p className="muted mt-1">
          Illustrated trays arrive every 6.5 seconds. Seeded by hall, date, meal
          and tray number.
        </p>
      </div>
      {!trays.length ? (
        <div className="p-5">
          <EmptyState title="No tray readings yet">
            Select a service with menu items.
          </EmptyState>
        </div>
      ) : (
        <ol className="divide-y divide-slate-100 px-5">
          {trays.map((tray) => {
            const high = tray.readings.some(
              (r) => r.remainingPct >= THRESHOLDS.highTray,
            );
            const related = tray.readings.some((r) => r.itemId === selectedId);
            return (
              <li
                key={tray.id}
                className={`py-5 ${related ? "border-l-4 border-l-amber-600 pl-3" : ""}`}
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">
                    Tray {String(tray.sequence).padStart(3, "0")}
                  </h3>
                  {high && (
                    <span className="rounded bg-rose-50 px-2 py-1 text-[13px] font-semibold text-rose-800">
                      ! High waste
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-3">
                  <TrayThumbnail tray={tray} />
                  <ul className="min-w-[160px] flex-1 space-y-2">
                    {tray.readings.map((r) => (
                      <li
                        key={r.itemId}
                        className={`flex justify-between gap-2 rounded p-1 text-[13px] ${selectedId === r.itemId ? "bg-amber-100 font-semibold text-navy" : "text-slate-700"}`}
                      >
                        <span>
                          {r.name}
                          {selectedId === r.itemId ? (
                            <span className="sr-only">, selected item</span>
                          ) : null}
                        </span>
                        <span
                          className="shrink-0 font-semibold"
                          style={{
                            color: STATUS[statusFor(r.remainingPct)].color,
                          }}
                        >
                          {percent(r.remainingPct)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <p className="muted border-t border-slate-200 p-5">
        Remaining portions are simulated, not measured. Flag threshold: any
        reading ≥{THRESHOLDS.highTray}%. Feed samples do not alter the fixed
        aggregate metrics.
      </p>
    </aside>
  );
}
