"use client";
import { useEffect, useState, type ReactNode } from "react";
import { useQueryState } from "@/lib/useQueryState";
import { HALLS, getToday, validDate } from "@/lib/mockData";
import KpiTile from "@/components/shared/KpiTile";
import PageHeader from "@/components/shared/PageHeader";

type DemoData = {
  observations: { id: string; food: string; waste_percent: number;
    observations: number; service_date: string; meal: string }[];
  recommendations: { dish: string; waste_percent: number; reason: string }[];
  summary: { observations: number; total_waste_lbs: number;
    total_waste_dollars: number; plate_waste_dollars: number;
    unserved_overproduction_dollars: null };
};

// Existing dashboard children mount only outside MHacks Demo.
export default function DemoGate({ children }: { children: ReactNode }) {
  const { params } = useQueryState();
  return params.get("hall") === "mhacks-demo" ? <DemoDashboard /> : <>{children}</>;
}

function DemoDashboard() {
  const { params, setQuery } = useQueryState();
  const rawDate = params.get("date");
  const date = rawDate && validDate(rawDate) ? rawDate : getToday();
  const requested = params.get("meal") ?? "all";
  const meals = ["all", "breakfast", "brunch", "lunch", "dinner"];
  const meal = meals.includes(requested) ? requested : "all";
  const scopeKey = `${date}|${meal}`;
  const [snapshot, setSnapshot] = useState<{ key: string; data: DemoData } | null>(null);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const controller = new AbortController();
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function poll() {
      try {
        const query = new URLSearchParams({ service_date: date, meal });
        const response = await fetch(`/api/mhacks-demo?${query}`, {
          cache: "no-store", signal: controller.signal,
        });
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(typeof body?.detail === "string" ? body.detail : "Live demo data unavailable.");
        }
        const data: DemoData = await response.json();
        if (!stopped) { setSnapshot({ key: scopeKey, data }); setFailure(null); }
      } catch (error) {
        if (!stopped) setFailure({ key: scopeKey,
          message: error instanceof Error ? error.message : "Fetch failed." });
      } finally {
        // Sequential polling, scoped cancellation, no mock fallback.
        if (!stopped) timer = setTimeout(poll, 2000);
      }
    }
    void poll();
    return () => { stopped = true; controller.abort(); if (timer) clearTimeout(timer); };
  }, [date, meal, scopeKey, paused]);

  const data = snapshot?.key === scopeKey ? snapshot.data : null;
  const error = failure?.key === scopeKey ? failure.message : null;
  const money = (value: number) => value.toLocaleString("en-US", {
    style: "currency", currency: "USD", minimumFractionDigits: 2,
  });
  return (
    <div className="space-y-6">
      <PageHeader title="MHacks Demo" description="Phone captures · mocked inference · estimated portion weights and costs" />
      <div className="panel grid gap-4 p-5 sm:grid-cols-3">
        <label className="text-sm font-semibold">Dining hall
          <select className="input mt-2" value="mhacks-demo"
            onChange={(e) => setQuery({ hall: e.target.value, item: null })}>
            <option value="all">All halls</option>
            {HALLS.map((hall) => <option key={hall.id} value={hall.id}>{hall.name}</option>)}
            <option value="mhacks-demo">MHacks Demo</option>
          </select>
        </label>
        <label className="text-sm font-semibold">Service date
          <input className="input mt-2" type="date" value={date}
            onChange={(e) => { if (validDate(e.target.value)) setQuery({ date: e.target.value }); }} />
        </label>
        <label className="text-sm font-semibold">Meal
          <select className="input mt-2" value={meal} onChange={(e) => setQuery({ meal: e.target.value })}>
            {meals.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
      </div>
      <p className="muted" role="status">
        {error ? `${error} ${data ? "Showing last successful readings." : ""}`
          : paused ? "Paused" : data ? "Live database · polling every 2 seconds" : "Loading…"}
      </p>
      {data && <>
        <div className="grid gap-4 sm:grid-cols-3">
          <KpiTile label="Captured food observations" value={data.summary.observations}
            detail="Not a count of unique trays or meals" />
          <KpiTile label="Estimated tray waste" value={`${data.summary.total_waste_lbs.toFixed(3)} lbs`}
            detail="Captured observations in selected services" />
          <KpiTile label="Estimated waste cost" value={money(data.summary.total_waste_dollars)}
            detail="For selected services · tray waste only" />
        </div>
        <p className="muted">Kitchen overproduction: unavailable. Captures do not measure discarded kitchen pans. No annual projection is inferred.</p>
      </>}
      <aside className="panel overflow-hidden" aria-label="Camera capture observations">
        <div className="flex items-center justify-between border-b border-slate-200 p-5">
          <h2 className="section-title">Live Tray Feed</h2>
          <button className="btn btn-primary" aria-pressed={paused} onClick={() => setPaused((v) => !v)}>
            {paused ? "Resume" : "Pause"}
          </button>
        </div>
        <ul className="divide-y divide-slate-100 px-5">
          {data?.observations.slice(-20).reverse().map((row) => <li key={row.id} className="py-4">
            <span className="font-semibold">{row.food}</span> · {row.waste_percent.toFixed(1)}% waste
            <p className="muted">{row.service_date} · {row.meal} · observation {row.id}</p>
          </li>)}
        </ul>
        {!data?.observations.length && <p className="muted p-5">No captures for this service yet.</p>}
      </aside>
      <section className="panel p-5" aria-label="Demo recommendations">
        <h2 className="section-title">AI Recommendations</h2>
        <p className="muted mt-2">Rules applied exclusively to captured demo observations; inference is mocked.</p>
        {data?.recommendations.map((r) => <div key={r.dish} className="mt-4">
          <h3 className="text-sm font-semibold">{r.dish} · {r.waste_percent.toFixed(1)}%</h3>
          <p className="muted">{r.reason}</p>
        </div>)}
        {data && !data.recommendations.length && <p className="muted mt-4">No captured dish exceeds 20% tray waste.</p>}
      </section>
    </div>
  );
}
