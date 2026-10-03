"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

/* Requires React, Next.js App Router, Tailwind CSS, and `npm install framer-motion`.
 * GET /api/menu?hall=south-quad&date=2026-10-03&meal=brunch&compact=true
 * Server adapter must run scraper.py with the equivalent CLI arguments and return
 * its parsed JSON, NOT a JSON-encoded string. Never execute Python in this client.
 * Supported response (full and compact):
 * { hall, date, meals: { brunch: { "Station": ["Dish", { name: "Dish 2" }] } } }
 * Non-2xx responses may return {error: "message"}. No route/backend included.
 * History is in-memory for this mounted page session; refresh clears it.
 */
const HALLS = [
  ["bursley", "Bursley"], ["east-quad", "East Quad"],
  ["mosher-jordan", "Mosher–Jordan"], ["south-quad", "South Quad"],
  ["twigs-at-oxford", "Twigs at Oxford"], ["markley", "Markley"],
  ["north-quad", "North Quad"], ["wolverine-village", "Wolverine Village"],
] as const;
type Hall = (typeof HALLS)[number][0];
type Meal = "breakfast" | "lunch" | "brunch" | "dinner";
type Selection = { hall: Hall; date: string; meal: Meal };
type Dish = { id: string; name: string; station: string; waste: number };
type Menu = { dishes: Dish[]; source: "historical" | "scraped" };
type Tray = { id: string; time: string; items: { name: string; waste: number }[] };
type HistoryEntry = Selection & { id: string; dishId: string; dish: string; waste: number; reduction: string; action: "Accepted" | "Dismissed"; at: string };
type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; menu: Menu };
const panel = "rounded-2xl border border-slate-200 bg-white shadow-sm";
const button = "rounded-lg px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
const input = "mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100";
const label = (hall: Hall) => HALLS.find(([value]) => value === hall)?.[1] ?? hall;
const title = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const selectionKey = (s: Selection) => `${s.hall}|${s.date}|${s.meal}`;

// Calendar date in campus timezone, regardless of the visitor's timezone.
function campusToday(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Detroit", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) => parts.find(p => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
export function mealsForDate(date: string): Meal[] {
  // Noon UTC + getUTCDay avoids date-only parsing shifting to the previous day.
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  return day === 0 || day === 6 ? ["brunch", "dinner"] : ["breakfast", "lunch", "dinner"];
}
function hash(text: string): number {
  let value = 2166136261;
  for (let i = 0; i < text.length; i++) value = Math.imul(value ^ text.charCodeAt(i), 16777619);
  return value >>> 0;
}
function baselineWaste(name: string, seed: string): number {
  const base = /broccoli|vegetable|kale|spinach|sprout|salad/i.test(name) ? 35
    : /rice|pasta|potato|oatmeal/i.test(name) ? 20 : 12;
  return Math.min(60, Math.max(4, base + hash(`${seed}|${name}`) % 17 - 8));
}
function makeDish(name: string, station: string, seed: string): Dish {
  return { id: `${station}::${name}`, name, station, waste: baselineWaste(name, seed) };
}

// Stable per hall/date/meal, so revisiting a historical selection reproduces it.
// These are fictional menus, not an archive of actual university service.
export function generateHistoricalMenu(selection: Selection): Menu {
  const seed = selectionKey(selection);
  const offset = hash(seed);
  const breakfasts = ["Scrambled eggs", "Buttermilk pancakes", "Cinnamon French toast", "Vegetable egg scramble"];
  const mains = ["Lemon herb chicken", "Roasted tofu", "Turkey meatballs", "Chickpea curry", "Baked lemon cod", "Black bean burger", "Beef and vegetable stew", "Pesto pasta"];
  const sides = ["Brown rice", "Roasted potatoes", "Steamed jasmine rice", "Herbed couscous"];
  const vegetables = ["Roasted broccoli", "Garlic green beans", "Roasted Brussels sprouts", "Sautéed spinach"];
  const breakfast = selection.meal === "breakfast" || selection.meal === "brunch";
  const rows: [string, string][] = breakfast
    ? [[breakfasts[offset % breakfasts.length], "Breakfast grill"], ["Steel-cut oatmeal", "Breakfast bar"], ["Roasted breakfast potatoes", "Breakfast grill"], ["Seasonal fruit", "Cold bar"]]
    : [[mains[offset % mains.length], "Main plate"], [mains[(offset + 3) % mains.length], "Plant & protein"], [sides[offset % sides.length], "Sides"], [vegetables[offset % vegetables.length], "Sides"], ["Mixed green salad", "Salad bar"]];
  if (selection.meal === "brunch") rows.push([mains[offset % mains.length], "Lunch favorites"], [vegetables[offset % vegetables.length], "Sides"]);
  return { source: "historical", dishes: rows.map(([name, station]) => makeDish(name, station, seed)) };
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function normalizeMenu(payload: unknown, selection: Selection): Menu {
  if (!record(payload) || !record(payload.meals)) throw new Error("The menu endpoint returned an unexpected format.");
  if (payload.hall !== selection.hall || payload.date !== selection.date) throw new Error("The server returned a menu for a different hall or date.");
  const meal = Object.entries(payload.meals).find(([key]) => key.toLowerCase() === selection.meal)?.[1];
  if (meal === undefined) return { dishes: [], source: "scraped" };
  if (!record(meal)) throw new Error("Expected menu stations grouped under the selected meal.");
  const unique = new Map<string, Dish>();
  for (const [station, items] of Object.entries(meal)) {
    if (!Array.isArray(items)) throw new Error("Expected a list of dishes for each station.");
    for (const item of items) {
      const name = typeof item === "string" ? item.trim() : record(item) && typeof item.name === "string" ? item.name.trim() : "";
      if (!name) continue;
      // The same dish can appear at multiple stations; include it only once.
      const key = name.toLowerCase();
      if (!unique.has(key)) unique.set(key, makeDish(name, station, selectionKey(selection)));
    }
  }
  return { dishes: [...unique.values()], source: "scraped" };
}
function makeTray(dishes: Dish[]): Tray {
  const shuffled = [...dishes];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return {
    id: crypto.randomUUID(), time: new Date().toISOString(),
    items: shuffled.slice(0, 3).map(dish => ({ name: dish.name,
      waste: Math.max(0, Math.min(85, Math.round(dish.waste + (Math.random() + Math.random() - 1) * 24))),
    })),
  };
}
function timeLabel(date: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/Detroit", hour: "numeric", minute: "2-digit", second: "2-digit" }).format(new Date(date));
}
function reductionFor(waste: number): string {
  const center = Math.max(5, Math.min(25, Math.round(waste * 0.44)));
  return `${Math.max(3, center - 2)}–${center + 2}%`;
}

function Selectors({ selection, onChange }: { selection: Selection; onChange: (value: Selection) => void }) {
  return <div className="grid w-full gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:w-auto sm:grid-cols-[180px_155px_120px]">
    <label className="text-xs font-medium text-slate-500">Dining hall<select className={input} value={selection.hall} onChange={e => onChange({ ...selection, hall: e.target.value as Hall })}>{HALLS.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
    <label className="text-xs font-medium text-slate-500">Service date<input type="date" className={input} value={selection.date} onChange={e => {
      const date = e.target.value;
      if (!validDate(date)) return;
      const allowed = mealsForDate(date);
      // One atomic update: never request an invalid weekend lunch/breakfast.
      const meal = allowed.includes(selection.meal) ? selection.meal : allowed.includes("lunch") ? "lunch" : allowed[0];
      onChange({ ...selection, date, meal });
    }} /></label>
    <label className="text-xs font-medium text-slate-500">Meal<select className={input} value={selection.meal} onChange={e => onChange({ ...selection, meal: e.target.value as Meal })}>{mealsForDate(selection.date).map(meal => <option key={meal} value={meal}>{title(meal)}</option>)}</select></label>
  </div>;
}

function MenuWorkspace({ selection, today, history, onDecision }: { selection: Selection; today: string; history: HistoryEntry[]; onDecision: (entry: HistoryEntry) => void }) {
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [retry, setRetry] = useState(0);
  const [trays, setTrays] = useState<Tray[]>([]);
  const [paused, setPaused] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const decisionLock = useRef(false);
  const reduceMotion = useReducedMotion();
  const { hall, date, meal } = selection;
  const context = selectionKey(selection);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    let timedOut = false;
    setLoad({ status: "loading" });
    if (date < today) {
      setLoad({ status: "ready", menu: generateHistoricalMenu({ hall, date, meal }) });
      return () => { active = false; controller.abort(); };
    }
    // Accommodates the scraper's retries. Stale requests are aborted on changes.
    const timeout = window.setTimeout(() => { timedOut = true; controller.abort(); }, 60000);
    async function fetchMenu() {
      try {
        const params = new URLSearchParams({ hall, date, meal, compact: "true" });
        const response = await fetch(`/api/menu?${params.toString()}`, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error(`Menu request failed (${response.status}). Check the API route and hall support.`);
        const payload: unknown = await response.json();
        const menu = normalizeMenu(payload, { hall, date, meal });
        if (active) setLoad({ status: "ready", menu });
      } catch (error) {
        if (!active) return;
        setLoad({ status: "error", message: timedOut ? "The menu request timed out. Please retry." : error instanceof Error ? error.message : "Unable to load this menu." });
      } finally { window.clearTimeout(timeout); }
    }
    void fetchMenu();
    return () => { active = false; window.clearTimeout(timeout); controller.abort(); };
  }, [hall, date, meal, today, retry]);

  const menu = load.status === "ready" ? load.menu : null;
  useEffect(() => {
    setTrays(menu?.dishes.length ? [makeTray(menu.dishes)] : []);
  }, [menu]);
  useEffect(() => {
    if (!menu?.dishes.length || paused) return;
    const timer = window.setInterval(() => {
      const next = makeTray(menu.dishes);
      setTrays(current => [next, ...current].slice(0, 5));
    }, 6500);
    return () => window.clearInterval(timer);
  }, [menu, paused]);

  const ranked = useMemo(() => [...(menu?.dishes ?? [])].sort((a, b) => b.waste - a.waste || a.name.localeCompare(b.name)), [menu]);
  const reviewed = new Set(history.filter(entry => selectionKey(entry) === context).map(entry => entry.dishId));
  const recommendation = ranked.find(dish => dish.waste >= 10 && !reviewed.has(dish.id));
  // Ranking uses the stable mock aggregate, not a single noisy tray observation.
  function decide(action: HistoryEntry["action"]) {
    if (!recommendation || decisionLock.current) return;
    decisionLock.current = true;
    setTransitioning(true);
    onDecision({ ...selection, id: crypto.randomUUID(), dishId: recommendation.id, dish: recommendation.name,
      waste: recommendation.waste, reduction: reductionFor(recommendation.waste), action, at: new Date().toISOString() });
  }
  function unlock() { decisionLock.current = false; setTransitioning(false); }

  if (load.status === "loading") return <div className={`${panel} p-10 text-center text-slate-500`} role="status">Loading {label(hall)} · {title(meal)} menu…</div>;
  if (load.status === "error") return <div className={`${panel} p-8`} role="alert"><h2 className="font-semibold text-rose-700">Menu unavailable</h2><p className="mt-2 text-sm text-slate-600">{load.message}</p><p className="mt-2 text-xs text-slate-500">Today and future dates require /api/menu. Select a past date to try the historical simulation.</p><button className={`${button} mt-4 bg-slate-900 text-white`} onClick={() => setRetry(value => value + 1)}>Retry</button></div>;
  if (!menu?.dishes.length) return <div className={`${panel} p-10 text-center`} role="status"><h2 className="font-semibold">No menu published for this service</h2><p className="mt-2 text-sm text-slate-500">Try a different date or meal. No trays or recommendations will be simulated without menu items.</p></div>;

  return <>
    <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
      {menu.source === "historical" ? "Historical simulation: fictional menu, seeded by hall, date, and meal. No API request made." : "Scraped menu names · waste percentages, tray captures, and recommendations are simulated."}
    </div>
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_370px]">
      <div className="min-w-0 space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className={`${panel} border-l-4 border-l-rose-500 p-6`}><p className="text-sm text-slate-500">Current waste trajectory</p><p className="mt-3 text-4xl font-semibold tracking-tight text-rose-700">$58,000<span className="text-sm font-normal text-slate-500">/year wasted</span></p><p className="mt-4 text-xs text-slate-400">Fixed illustrative projection · not calculated from menu</p></div>
          <div className={`${panel} border-l-4 border-l-emerald-500 p-6`}><p className="text-sm text-slate-500">Target savings · 15% reduction</p><p className="mt-3 text-4xl font-semibold tracking-tight text-emerald-700">$8,700<span className="text-sm font-normal text-slate-500">/year saved</span></p><p className="mt-4 text-xs text-slate-400">Potential savings · $58,000 × 15%</p></div>
        </div>
        <section aria-labelledby="ai-title" className="overflow-hidden rounded-2xl bg-[#00274c] text-white">
          <div className="px-6 pt-6"><p id="ai-title" className="text-xs font-semibold uppercase tracking-widest text-[#ffcb05]">✦ AI production insights</p><p className="mt-2 text-xs text-slate-300">{label(hall)} · {date} · {title(meal)}</p></div>
          <div className="relative min-h-[290px]" aria-live="polite" aria-busy={transitioning}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={recommendation?.id ?? "complete"}
                initial={{ opacity: 0, x: reduceMotion ? 0 : 65 }}
                animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: reduceMotion ? 0 : -65 }}
                transition={{ duration: reduceMotion ? 0 : 0.24, ease: "easeInOut" }}
                onAnimationComplete={definition => { if (typeof definition === "object" && "x" in definition && definition.x === 0) unlock(); }}
                className="p-6">
                {recommendation ? <>
                  <h2 className="max-w-2xl text-2xl font-medium leading-snug sm:text-3xl">Reduce {date < today ? "the next comparable service’s" : "the next service’s"} <span className="text-[#ffcb05]">{recommendation.name}</span> production by {reductionFor(recommendation.waste)}.</h2>
                  <p className="mt-4 text-sm leading-6 text-slate-300">{recommendation.waste}% average portion remaining in the mock aggregate. Keep a reserve batch available for demand.</p>
                  <div className="mt-6 flex gap-3"><button disabled={transitioning} className={`${button} bg-[#ffcb05] text-[#00274c] hover:bg-amber-300`} onClick={() => decide("Accepted")}>Accept</button><button disabled={transitioning} className={`${button} border border-white/30 hover:bg-white/10`} onClick={() => decide("Dismissed")}>Dismiss</button></div>
                </> : <div className="py-10"><h2 className="text-2xl font-medium">You&apos;re all caught up.</h2><p className="mt-3 text-sm text-slate-300">No unreviewed items above the 10% mock waste threshold remain for this selection.</p></div>}
              </motion.div>
            </AnimatePresence>
          </div>
          <p className="border-t border-white/10 px-6 py-3 text-xs text-slate-300">Demo decisions only · no production schedule is changed</p>
        </section>
        <section className={panel}><div className="border-b border-slate-100 p-5"><h2 className="font-semibold">What&apos;s coming back?</h2><p className="mt-1 text-xs text-slate-500">Selected menu · simulated average waste · highest first</p></div><ul className="max-h-[440px] divide-y divide-slate-100 overflow-y-auto">{ranked.map(dish => <li key={dish.id} className="flex items-center gap-4 px-5 py-4"><div className="min-w-0 flex-1"><p className="text-sm font-medium">{dish.name}</p><p className="mt-1 text-xs text-slate-500">{dish.station}</p></div><div className="h-2 w-20 overflow-hidden rounded-full bg-slate-100" aria-hidden="true"><div className={`h-full rounded-full ${dish.waste > 30 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${dish.waste}%` }} /></div><span className="w-10 text-right text-sm font-semibold tabular-nums">{dish.waste}%</span></li>)}</ul></section>
      </div>
      <aside className={panel} aria-labelledby="feed-title"><div className="flex items-center justify-between gap-2 border-b border-slate-100 p-5"><div><h2 id="feed-title" className="font-semibold">Live tray feed</h2><p className="mt-1 text-xs text-slate-500">{paused ? "Paused" : "Simulated capture every 6.5 seconds"}</p></div><button className={`${button} bg-slate-100 hover:bg-slate-200`} aria-pressed={paused} onClick={() => setPaused(value => !value)}>{paused ? "Resume" : "Pause"}</button></div>
        <div className="overflow-hidden px-5"><AnimatePresence initial={false}>{trays.map(tray => <motion.article key={tray.id} initial={{ opacity: 0, y: reduceMotion ? 0 : -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: reduceMotion ? 0 : 0.2 }} className="border-b border-slate-100 py-5"><div className="mb-3 flex justify-between text-xs"><span className="font-medium">Tray {tray.id.slice(0, 6)}</span><time className="text-slate-500" dateTime={tray.time}>{timeLabel(tray.time)}</time></div><div className="flex gap-3"><div role="img" aria-label="Tray image placeholder" className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border-4 border-slate-200 bg-slate-100 text-3xl">🍽️</div><ul className="min-w-0 flex-1 space-y-2">{tray.items.map(item => <li key={item.name} className="flex justify-between gap-2 text-xs"><span className="text-slate-600">{item.name}</span><span className={`shrink-0 font-semibold ${item.waste > 35 ? "text-amber-700" : "text-slate-800"}`}>{item.waste}%</span></li>)}</ul></div></motion.article>)}</AnimatePresence></div>
        <p className="p-5 text-xs leading-5 text-slate-500">Percentages show simulated portions remaining. Capture timestamps are demo time (Eastern), not historical records.</p>
      </aside>
    </div>
  </>;
}

export default function Page() {
  // Initialize on the client to avoid server/client date mismatches at midnight.
  const [today, setToday] = useState("");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const historyRoot = useRef<HTMLDivElement>(null);
  const historyButton = useRef<HTMLButtonElement>(null);
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    const date = campusToday();
    setToday(date);
    setSelection({ hall: "south-quad", date, meal: mealsForDate(date).includes("lunch") ? "lunch" : "brunch" });
    const timer = window.setInterval(() => setToday(campusToday()), 30000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!historyOpen) return;
    function onPointer(event: PointerEvent) { if (event.target instanceof Node && !historyRoot.current?.contains(event.target)) setHistoryOpen(false); }
    function onKey(event: KeyboardEvent) { if (event.key === "Escape") { setHistoryOpen(false); historyButton.current?.focus(); } }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onPointer); document.removeEventListener("keydown", onKey); };
  }, [historyOpen]);
  function recordDecision(entry: HistoryEntry) {
    setHistory(current => current.some(old => selectionKey(old) === selectionKey(entry) && old.dishId === entry.dishId) ? current : [entry, ...current]);
  }
  return <div className="min-h-screen bg-[#f6f7f9] font-sans text-slate-900">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-8"><a href="#dashboard" className="text-xl font-bold tracking-tight text-[#00274c]">Wolver<span className="text-emerald-700">Lean</span><span className="ml-3 rounded bg-amber-50 px-2 py-1 align-middle text-[10px] uppercase tracking-widest text-amber-800">Demo</span></a><span className="text-xs font-medium text-slate-500">University Dining Services</span></div></header>
    <main id="dashboard" className="mx-auto max-w-[1440px] px-5 py-8 sm:px-8">
      <div className="mb-6 flex flex-col justify-between gap-6 2xl:flex-row 2xl:items-end"><div><p className="text-xs uppercase tracking-widest text-slate-500">Operations / Overview</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Less waste. More impact.</h1><p className="mt-2 text-sm text-slate-500">Plan the next service with a clearer picture of what comes back.</p></div>{selection && <Selectors selection={selection} onChange={setSelection} />}</div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-500">Campus calendar: Eastern time · weekends: brunch & dinner</p>
        <div ref={historyRoot} className="relative"><button ref={historyButton} className={`${button} border border-slate-200 bg-white hover:bg-slate-50`} aria-expanded={historyOpen} aria-controls="recommendation-history" onClick={() => setHistoryOpen(value => !value)}>View history <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs">{history.length}</span></button>
          <AnimatePresence>{historyOpen && <motion.section id="recommendation-history" aria-label="Recommendation history" initial={{ opacity: 0, y: reduceMotion ? 0 : -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduceMotion ? 0 : -8 }} transition={{ duration: reduceMotion ? 0 : 0.15 }} className="absolute right-0 z-30 mt-2 w-[min(420px,calc(100vw-40px))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"><div className="flex items-center justify-between border-b border-slate-100 p-4"><h2 className="font-semibold">Session history</h2><button className={`${button} px-2`} onClick={() => { setHistoryOpen(false); historyButton.current?.focus(); }}>Close</button></div><div className="max-h-[420px] overflow-y-auto">{history.length === 0 ? <p className="p-6 text-sm text-slate-500">Accept or dismiss a recommendation to start your log.</p> : <ol className="divide-y divide-slate-100">{history.map(entry => <li key={entry.id} className="p-4"><div className="flex justify-between gap-3"><span className={`text-xs font-semibold ${entry.action === "Accepted" ? "text-emerald-700" : "text-slate-500"}`}>{entry.action}</span><time dateTime={entry.at} className="text-xs text-slate-400">{timeLabel(entry.at)} ET</time></div><p className="mt-2 text-sm font-medium">Reduce {entry.dish} by {entry.reduction}</p><p className="mt-1 text-xs leading-5 text-slate-500">{label(entry.hall)} · {entry.date} · {title(entry.meal)}<br />{entry.waste}% mock waste at decision time</p></li>)}</ol>}</div><p className="border-t border-slate-100 p-3 text-xs text-slate-400">Kept across selections; cleared on refresh.</p></motion.section>}</AnimatePresence>
        </div>
      </div>
      {selection ? <MenuWorkspace key={`${selectionKey(selection)}|${selection.date < today ? "past" : "live"}`} selection={selection} today={today} history={history} onDecision={recordDecision} /> : <p role="status" className="p-10 text-center text-slate-500">Preparing dashboard…</p>}
      <footer className="mt-8 border-t border-slate-200 pt-5 text-xs text-slate-400">WolverLean · Mock waste analytics · Historical menus are fictional · No production changes are submitted</footer>
    </main>
  </div>;
}
