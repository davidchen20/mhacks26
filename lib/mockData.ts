/** Shared, fictional data. No network or scraper calls. All dates use the campus calendar. */
export type HallId =
  | "bursley"
  | "south-quad"
  | "east-quad"
  | "mosher-jordan"
  | "markley"
  | "twigs";
export type Meal = "breakfast" | "lunch" | "brunch" | "dinner";
export type Category = "Protein" | "Produce" | "Grains" | "Dairy";
export type Decision = "Accepted" | "Dismissed";
export interface Nutrition {
  fiberGrams: number;
  proteinGrams: number;
  calories: number;
  nutrientDensity: "moderate" | "high";
  densityScore: number;
}
export interface MenuItem {
  id: string;
  name: string;
  category: Category;
  remainingPct: number;
  wasteLbs: number;
  wasteCost: number;
  servings: number;
  nutrition: Nutrition;
  culinarySuggestion: string;
  reductionRange: [number, number];
}
export interface ServiceData {
  hallId: HallId;
  date: string;
  meal: Meal;
  mealsServed: number;
  items: MenuItem[];
  source: "demo" | "illustrative" | "unavailable";
}
export interface Hall {
  id: HallId;
  name: string;
  reporting: boolean;
}
export interface HallSummary {
  hall: Hall;
  wasteLbs: number | null;
  wasteCost: number | null;
  mealsServed: number | null;
  wastePerMeal: number | null;
  topItem: MenuItem | null;
}
export interface TrendPoint {
  date: string;
  value: number | null;
  movingAverage?: number | null;
}
export interface Recommendation {
  id: string;
  hallId: HallId;
  date: string;
  meal: Meal;
  itemId: string;
  itemName: string;
  remainingPct: number;
  reductionRange: [number, number];
  wasteCost: number;
  title: string;
  origin: "production" | "nutrition";
}
export interface HistoryEntry {
  id: string;
  recommendation: Recommendation;
  decision: Decision;
  note: string;
  timestamp: string;
  reopenedAt?: string;
}
export interface TrayReading {
  itemId: string;
  name: string;
  remainingPct: number;
}
export interface Tray {
  id: string;
  sequence: number;
  readings: TrayReading[];
}
export type Range = "today" | "yesterday" | "week";
export type OverviewMeal = "all" | "breakfast" | "lunch" | "dinner";
export const DEMO_DATE = "2026-10-03";
export const LAST_UPDATED = "2026-10-03T18:32:00Z";
export const OPERATING_DAYS = 290;
export const HALLS: Hall[] = [
  { id: "bursley", name: "Bursley", reporting: true },
  { id: "south-quad", name: "South Quad", reporting: true },
  { id: "east-quad", name: "East Quad", reporting: true },
  { id: "mosher-jordan", name: "Mosher-Jordan", reporting: true },
  { id: "markley", name: "Markley", reporting: true },
  { id: "twigs", name: "Twigs", reporting: false },
];
export const round = (n: number, digits = 2) => Number(n.toFixed(digits));
export const hallName = (id: HallId) =>
  HALLS.find((h) => h.id === id)?.name ?? id;
export function validDate(s: string) {
  const d = new Date(`${s}T12:00:00Z`);
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    !Number.isNaN(+d) &&
    d.toISOString().slice(0, 10) === s
  );
}
export function addDays(date: string, n: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function mealsForDate(date: string): Meal[] {
  const d = new Date(`${date}T12:00:00Z`).getUTCDay();
  return d === 0 || d === 6
    ? ["brunch", "dinner"]
    : ["breakfast", "lunch", "dinner"];
}
export function hash(s: string) {
  let n = 2166136261;
  for (const c of s) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
  return n >>> 0;
}
export function seededRandom(seed: string) {
  let n = hash(seed);
  return () => {
    n += 0x6d2b79f5;
    let t = n;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const templates: MenuItem[] = [
  {
    id: "chicken",
    name: "Lemon Herb Chicken",
    category: "Protein",
    remainingPct: 12,
    wasteLbs: 20,
    wasteCost: 5,
    servings: 400,
    nutrition: {
      fiberGrams: 0,
      proteinGrams: 28,
      calories: 210,
      nutrientDensity: "high",
      densityScore: 4,
    },
    culinarySuggestion: "Offer smaller first portions with seconds available",
    reductionRange: [5, 9],
  },
  {
    id: "broccoli",
    name: "Steamed Broccoli",
    category: "Produce",
    remainingPct: 60,
    wasteLbs: 32,
    wasteCost: 12,
    servings: 400,
    nutrition: {
      fiberGrams: 5,
      proteinGrams: 4,
      calories: 55,
      nutrientDensity: "high",
      densityScore: 5,
    },
    culinarySuggestion:
      "Switch to Roasted Garlic Broccoli to improve palatability",
    reductionRange: [18, 22],
  },
  {
    id: "rice",
    name: "Brown Rice",
    category: "Grains",
    remainingPct: 24,
    wasteLbs: 18,
    wasteCost: 4,
    servings: 400,
    nutrition: {
      fiberGrams: 3.5,
      proteinGrams: 5,
      calories: 215,
      nutrientDensity: "moderate",
      densityScore: 3,
    },
    culinarySuggestion: "Serve in smaller batches and offer a half scoop",
    reductionRange: [8, 12],
  },
  {
    id: "salad",
    name: "Kale & Chickpea Salad",
    category: "Produce",
    remainingPct: 42,
    wasteLbs: 8,
    wasteCost: 2,
    servings: 250,
    nutrition: {
      fiberGrams: 7,
      proteinGrams: 8,
      calories: 180,
      nutrientDensity: "high",
      densityScore: 5,
    },
    culinarySuggestion:
      "Chop greens finely and offer lemon dressing on the side",
    reductionRange: [12, 18],
  },
  {
    id: "yogurt",
    name: "Greek Yogurt",
    category: "Dairy",
    remainingPct: 9,
    wasteLbs: 2,
    wasteCost: 2,
    servings: 200,
    nutrition: {
      fiberGrams: 0,
      proteinGrams: 16,
      calories: 120,
      nutrientDensity: "high",
      densityScore: 4,
    },
    culinarySuggestion: "Offer smaller cups with fruit as an optional topping",
    reductionRange: [4, 8],
  },
];
const scale: Record<HallId, number> = {
  bursley: 0.8,
  "south-quad": 1,
  "east-quad": 0.65,
  "mosher-jordan": 0.75,
  markley: 0.8,
  twigs: 0,
};
const wasteFactor: Record<HallId, number> = {
  bursley: 0.8,
  "south-quad": 1.55,
  "east-quad": 0.7,
  "mosher-jordan": 1.15,
  markley: 1.4,
  twigs: 0,
};
export function getService(
  hallId: HallId,
  date: string,
  meal: Meal,
): ServiceData {
  const unavailable: ServiceData = {
    hallId,
    date,
    meal,
    mealsServed: 0,
    items: [],
    source: "unavailable",
  };
  if (
    !validDate(date) ||
    date > DEMO_DATE ||
    hallId === "twigs" ||
    !mealsForDate(date).includes(meal)
  )
    return unavailable;
  const historical = date < DEMO_DATE;
  const rand = seededRandom(`${hallId}|${date}|${meal}`);
  const factor = historical ? 0.78 + rand() * 0.38 : 1;
  const items = templates.map((t) => {
    const remainingPct =
      hallId === "south-quad" && !historical
        ? t.remainingPct
        : Math.max(
            3,
            Math.min(75, Math.round(t.remainingPct * (0.7 + rand() * 0.4))),
          );
    const breakfast = meal === "breakfast";
    const name = breakfast
      ? ({
          chicken: "Scrambled Eggs",
          broccoli: "Spinach & Egg Bake",
          rice: "Steel-cut Oatmeal",
          salad: "Seasonal Fruit",
          yogurt: "Greek Yogurt",
        }[t.id] ?? t.name)
      : historical && t.id === "chicken"
        ? ["Lemon Herb Chicken", "Baked Tofu", "Turkey Meatballs"][
            Math.floor(rand() * 3)
          ]
        : t.name;
    return {
      ...t,
      name,
      nutrition: { ...t.nutrition },
      remainingPct,
      servings: Math.round(t.servings * scale[hallId]),
      wasteLbs: round(
        t.wasteLbs * scale[hallId] * wasteFactor[hallId] * factor,
      ),
      wasteCost: round(t.wasteCost * scale[hallId] * factor),
    };
  });
  return {
    hallId,
    date,
    meal,
    items,
    mealsServed: Math.round(800 * scale[hallId] * factor),
    source: historical ? "illustrative" : "demo",
  };
}
export function datesForRange(range: Range, offset = 0) {
  const end = addDays(DEMO_DATE, offset - (range === "yesterday" ? 1 : 0));
  return range === "week"
    ? Array.from({ length: 7 }, (_, i) => addDays(end, i - 6))
    : [end];
}
export function servicesForRange(
  range: Range = "today",
  meal: OverviewMeal = "all",
  offset = 0,
): ServiceData[] {
  return datesForRange(range, offset).flatMap((date) =>
    HALLS.flatMap((hall) =>
      mealsForDate(date)
        .filter((m) => meal === "all" || meal === m)
        .map((m) => getService(hall.id, date, m)),
    ),
  );
}
export function totals(services: ServiceData[]) {
  const items = services.flatMap((s) => s.items);
  return {
    wasteLbs: round(items.reduce((n, i) => n + i.wasteLbs, 0)),
    wasteCost: round(items.reduce((n, i) => n + i.wasteCost, 0)),
    mealsServed: services.reduce((n, s) => n + s.mealsServed, 0),
  };
}
export function summarizeHalls(services: ServiceData[]): HallSummary[] {
  return HALLS.map((hall) => {
    const selected = services.filter(
      (s) => s.hallId === hall.id && s.items.length,
    );
    if (!selected.length)
      return {
        hall,
        wasteLbs: null,
        wasteCost: null,
        mealsServed: null,
        wastePerMeal: null,
        topItem: null,
      };
    const t = totals(selected);
    return {
      hall,
      ...t,
      wastePerMeal: t.mealsServed ? t.wasteLbs / t.mealsServed : null,
      topItem: selected
        .flatMap((s) => s.items)
        .sort((a, b) => b.remainingPct - a.remainingPct)[0],
    };
  });
}
export function foodLink(
  s: Pick<ServiceData, "hallId" | "date" | "meal">,
  itemId?: string,
) {
  const q = new URLSearchParams({ hall: s.hallId, date: s.date, meal: s.meal });
  if (itemId) q.set("item", itemId);
  return `/food?${q}${itemId ? `#item-${itemId}` : ""}`;
}
export function universityTrend(
  end = DEMO_DATE,
  meal: OverviewMeal = "all",
): TrendPoint[] {
  const raw = Array.from({ length: 34 }, (_, i) => {
    const date = addDays(end, i - 33);
    const services = HALLS.flatMap((h) =>
      mealsForDate(date)
        .filter((m) => meal === "all" || meal === m)
        .map((m) => getService(h.id, date, m)),
    );
    const t = totals(services);
    return { date, value: t.mealsServed ? t.wasteLbs : null };
  });
  return raw.slice(6).map((p, i) => {
    const available = raw
      .slice(i, i + 7)
      .filter((d): d is { date: string; value: number } => d.value !== null);
    return {
      ...p,
      movingAverage: available.length
        ? round(available.reduce((n, d) => n + d.value, 0) / available.length)
        : null,
    };
  });
}
export const TODAY_SERVICES = servicesForRange();
export const TODAY_TOTALS = totals(TODAY_SERVICES);
export const ANNUAL_WASTE = round(TODAY_TOTALS.wasteCost * OPERATING_DAYS);
export function financeBreakdown(mode: "category" | "hall") {
  const values = new Map<string, number>();
  for (const s of TODAY_SERVICES)
    for (const item of s.items) {
      const name = mode === "hall" ? hallName(s.hallId) : item.category;
      values.set(name, (values.get(name) ?? 0) + item.wasteCost);
    }
  return [...values].map(([name, value]) => ({
    name,
    value: round(value),
    annual: round(value * OPERATING_DAYS),
  }));
}
export function costTrend(): TrendPoint[] {
  return Array.from({ length: 12 }, (_, i) => {
    const date = addDays(DEMO_DATE, (i - 11) * 7);
    const services = Array.from({ length: 7 }, (_, d) =>
      addDays(date, -d),
    ).flatMap((day) =>
      HALLS.flatMap((h) =>
        mealsForDate(day).map((m) => getService(h.id, day, m)),
      ),
    );
    const t = totals(services);
    return {
      date,
      value: t.mealsServed ? round(t.wasteCost / t.mealsServed, 4) : 0,
    };
  });
}
export function makeRecommendation(
  service: ServiceData,
  item: MenuItem,
  origin: Recommendation["origin"] = "production",
): Recommendation {
  return {
    id: `${origin}:${service.hallId}:${service.date}:${service.meal}:${item.id}`,
    hallId: service.hallId,
    date: service.date,
    meal: service.meal,
    itemId: item.id,
    itemName: item.name,
    remainingPct: item.remainingPct,
    reductionRange: item.reductionRange,
    wasteCost: item.wasteCost,
    origin,
    title:
      origin === "nutrition"
        ? item.culinarySuggestion
        : `Reduce tomorrow’s ${item.name.toLowerCase()} production by ${item.reductionRange[0]}–${item.reductionRange[1]}%`,
  };
}
export const INITIAL_RECOMMENDATIONS = HALLS.filter((h) => h.reporting).map(
  (h) => {
    const s = getService(h.id, DEMO_DATE, "brunch");
    return makeRecommendation(
      s,
      s.items.find((i) => i.id === "broccoli")!,
    );
  },
);
export function makeTray(service: ServiceData, sequence: number): Tray {
  const rand = seededRandom(
    `${service.hallId}|${service.date}|${service.meal}|tray:${sequence}`,
  );
  const pool = [...service.items];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return {
    id: `tray-${sequence}`,
    sequence,
    readings: pool
      .slice(0, 3)
      .map((i) => ({
        itemId: i.id,
        name: i.name,
        remainingPct: Math.max(
          0,
          Math.min(90, Math.round(i.remainingPct + (rand() + rand() - 1) * 22)),
        ),
      })),
  };
}
