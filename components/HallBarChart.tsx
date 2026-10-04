"use client";
import { useEffect, useRef, useState } from "react";
import {
  makeTray,
  type ServiceData,
  type Tray,
  type Category,
} from "@/lib/mockData";
import { THRESHOLDS, STATUS, statusFor } from "@/lib/status";
import { portionLabel } from "@/lib/foodWeights";
import { percent } from "@/lib/format";
import { EmptyState } from "@/components/shared/DataState";

/* ---------- deterministic helpers (stable across SSR + refresh) ---------- */

type Vessel = "plate" | "bowl";

function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Small seeded PRNG (mulberry32) returning a function that yields 0..1
function seeded(seed: string) {
  let a = hashString(seed);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function vesselFor(tray: Tray): Vessel {
  return seeded(`vessel-${tray.id}`)() < 0.5 ? "plate" : "bowl";
}

const GRAMS_PER_OZ = 28.3495;

function formatWeight(grams: number): string {
  return `${(grams / GRAMS_PER_OZ).toFixed(1)} oz (${grams.toFixed(1)} g)`;
}
function foodColor(category: Category): string {
  return {
    Produce: "#047857",
    Grains: "#a16207",
    Dairy: "#64748b",
    Protein: "#b7793d",
  }[category];
}

/* ---------- vessel illustration ---------- */

const PLATE_SPOTS = [
  { x: 44, y: 54 },
  { x: 78, y: 46 },
  { x: 72, y: 82 },
  { x: 40, y: 84 },
];
const BOWL_SPOTS = [
  { x: 52, y: 56 },
  { x: 70, y: 54 },
  { x: 60, y: 72 },
  { x: 48, y: 74 },
];

function VesselThumbnail({ tray, vessel }: { tray: Tray; vessel: Vessel }) {
  const isBowl = vessel === "bowl";
  const spots = isBowl ? BOWL_SPOTS : PLATE_SPOTS;
  const maxR = isBowl ? 15 : 18;

  return (
    <svg
      viewBox="0 0 120 120"
      className="h-28 w-28 shrink-0 rounded-xl border border-slate-300 bg-slate-100"
      role="img"
      aria-label={`Illustrated simulated ${vessel}, not a camera image`}
    >
      {isBowl ? (
        <>
          {/* outer rim */}
          <circle
            cx="60"
            cy="60"
            r="52"
            fill="#cbd5e1"
            stroke="#64748b"
            strokeWidth="2"
          />
          {/* sloped wall */}
          <circle cx="60" cy="60" r="44" fill="#e2e8f0" stroke="#94a3b8" />
          {/* deep well */}
          <circle cx="60" cy="60" r="34" fill="#f8fafc" stroke="#cbd5e1" />
          {/* rim highlight */}
          <path
            d="M20 44 A44 44 0 0 1 48 18"
            fill="none"
            stroke="#fff"
            strokeWidth="3"
            strokeLinecap="round"
            opacity=".7"
          />
        </>
      ) : (
        <>
          {/* flat rim */}
          <circle
            cx="60"
            cy="60"
            r="54"
            fill="#f1f5f9"
            stroke="#94a3b8"
            strokeWidth="2"
          />
          {/* eating surface */}
          <circle cx="60" cy="60" r="42" fill="#fff" stroke="#cbd5e1" />
        </>
      )}

      {tray.readings.slice(0, spots.length).map((r, i) => {
        const radius = Math.min(
          maxR,
          Math.max(4, 5 + (Math.sqrt(r.remainingPct) / 10) * (maxR - 5)),
        );
        return (
          <g
            key={r.itemId}
            transform={`translate(${spots[i].x},${spots[i].y})`}
          >
            <circle r={radius} fill={foodColor(r.category)} />
            <circle
              cx={-radius / 3}
              cy={-radius / 3}
              r={Math.max(1.5, radius / 6)}
              fill="#fff"
              opacity=".45"
            />
          </g>
        );
      })}
    </svg>
  );
}

/* ---------- main component ---------- */

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
      aria-label="Simulated live plate and bowl feed"
    >
      <div className="border-b border-slate-200 p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="section-title">Live plate &amp; bowl feed</h2>
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
          Illustrated plates and bowls arrive every 6.5 seconds. Seeded by hall,
          date, meal and tray number.
        </p>
      </div>
      {!trays.length ? (
        <div className="p-5">
          <EmptyState title="No readings yet">
            Select a service with menu items.
          </EmptyState>
        </div>
      ) : (
        <ol className="divide-y divide-slate-100 px-5">
          {trays.map((tray) => {
            const vessel = vesselFor(tray);
            const label = vessel === "bowl" ? "Bowl" : "Plate";
            const high = tray.readings.some(
              (r) => r.remainingPct >= THRESHOLDS.highTray,
            );
            const related = tray.readings.some((r) => r.itemId === selectedId);
            const weights = tray.readings.map((r) => r.remainingGrams);
            const totalGrams = weights.reduce((sum, g) => sum + g, 0);

            return (
              <li
                key={tray.id}
                className={`py-5 ${related ? "border-l-4 border-l-amber-600 pl-3" : ""}`}
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">
                    {label} {String(tray.sequence).padStart(3, "0")}
                  </h3>
                  {high && (
                    <span className="rounded bg-rose-50 px-2 py-1 text-[13px] font-semibold text-rose-800">
                      ! High waste
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-3">
                  <VesselThumbnail tray={tray} vessel={vessel} />
                  <div className="min-w-[180px] flex-1">
                    <ul className="space-y-2">
                      {tray.readings.map((r, i) => (
                        <li
                          key={r.itemId}
                          className={`flex items-start justify-between gap-2 rounded p-1 text-[13px] ${selectedId === r.itemId ? "bg-amber-100 font-semibold text-navy" : "text-slate-700"}`}
                        >
                          <span>
                            {r.name}
                            <span className="block font-normal text-slate-600">
                              {portionLabel(r)}
                            </span>
                            {selectedId === r.itemId ? (
                              <span className="sr-only">, selected item</span>
                            ) : null}
                          </span>
                          <span className="shrink-0 text-right">
                            <span
                              className="font-semibold"
                              style={{
                                color: STATUS[statusFor(r.remainingPct)].color,
                              }}
                            >
                              {STATUS[statusFor(r.remainingPct)].label} ·{" "}
                              {percent(r.remainingPct)}
                            </span>
                            <span className="block text-slate-600">
                              ≈ {formatWeight(weights[i])}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 flex items-center justify-between gap-2 border-t border-slate-200 pt-2 text-[13px] font-semibold text-slate-800">
                      <span>Est. food left on {vessel}</span>
                      <span>≈ {formatWeight(totalGrams)}</span>
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <p className="muted border-t border-slate-200 p-5">
        Remaining portions and weights are simulated, not measured. Flag
        threshold: any reading ≥{THRESHOLDS.highTray}%. Feed samples do not
        alter the fixed aggregate metrics.
      </p>
    </aside>
  );
}
