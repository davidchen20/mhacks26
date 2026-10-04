/** Converts only persisted MHacks Demo observations to the existing UI model. */
import type { Category, Meal, MenuItem, ServiceData, TrendPoint, OverviewMeal } from "./types";
import { addDays, validDate } from "./dates";
import { WEIGHT_PER_PAN_LBS } from "./foodWeights";
export const DEMO_HALL_ID = "mhacks-demo" as const;
export const DEMO_MEALS: OverviewMeal[] = ["all", "breakfast", "brunch", "lunch", "dinner"];
export interface DemoObservation {
  id: string; food: string; dining_hall: string; service_date: string; meal: string;
  waste_percent: number; observations: number; simulated: boolean; station: string;
  name: string; serving_size: string; calories: number | null; fiber: number | null; protein: number | null;
  traits?: string[]; allergens?: string[];
}
export interface DemoFoodSpec { portion_lbs: number; cost_per_lb: number; category: Category }
export interface DemoResponse { observations: DemoObservation[]; food_specs: Record<string, DemoFoodSpec> }
export function toDemoServices(payload: DemoResponse): ServiceData[] {
  const groups = new Map<string, Map<string, DemoObservation[]>>();
  const ids = new Set<string>();
  for (const row of payload.observations) {
    if (row.dining_hall !== "MHacks Demo") throw new Error("Unexpected hall in demo response");
    if (!validDate(row.service_date)) throw new Error("Invalid demo service date");
    if (!DEMO_MEALS.slice(1).includes(row.meal as Meal)) throw new Error("Invalid demo meal");
    if (!Number.isFinite(row.waste_percent) || row.waste_percent < 0 || row.waste_percent > 100
      || !Number.isInteger(row.observations) || row.observations < 1) throw new Error("Invalid demo observation");
    if (ids.has(row.id)) continue;
    ids.add(row.id);
    const key = `${row.service_date}|${row.meal}`;
    if (!groups.has(key)) groups.set(key, new Map());
    const foods = groups.get(key)!;
    foods.set(row.food, [...(foods.get(row.food) ?? []), row]);
  }
  return [...groups].map(([key, foods]) => {
    const [date, meal] = key.split("|");
    const items: MenuItem[] = [...foods].map(([food, rows]) => {
      const spec = payload.food_specs[food];
      if (!spec || !(spec.portion_lbs > 0) || !Number.isFinite(spec.portion_lbs)
          || !(spec.cost_per_lb >= 0) || !Number.isFinite(spec.cost_per_lb)
          || !["Produce", "Protein", "Grains", "Dairy"].includes(spec.category))
        throw new Error(`Missing demo portion/cost assumptions: ${food}`);
      const count = rows.reduce((n, r) => n + r.observations, 0);
      const pct = rows.reduce((n, r) => n + r.waste_percent * r.observations, 0) / count;
      const served = count * spec.portion_lbs;
      const waste = served * pct / 100;
      const avg = (field: "fiber" | "protein" | "calories") => {
        let total = 0;
        for (const row of rows) {
          const value = row[field];
          if (value === null || !Number.isFinite(value) || value < 0) return null;
          total += value * row.observations;
        }
        return total / count;
      };
      const fiber = avg("fiber"), protein = avg("protein"), calories = avg("calories");
      const density = fiber === null || protein === null || calories === null ? 0
        : Math.min(5, Math.max(1, Math.round((fiber + protein / 5) / Math.max(1, calories / 100))));
      const pan = WEIGHT_PER_PAN_LBS[spec.category];
      return {
        id: `demo-${encodeURIComponent(food)}`, name: food, category: spec.category,
        remainingPct: pct, postConsumerPct: pct, servings: count,
        wasteLbs: waste, wasteCost: waste * spec.cost_per_lb,
        station: rows[0].station, servingSize: `${spec.portion_lbs * 16} oz`,
        traits: [...new Set(rows.flatMap((r) => r.traits ?? []))],
        allergens: [...new Set(rows.flatMap((r) => r.allergens ?? []))], standardPortionOz: spec.portion_lbs * 16,
        weightSource: "category-default", portionsPrepared: count, portionsServed: count,
        totalServedLbs: served, plateWasteLbs: waste, plateWasteDollars: waste * spec.cost_per_lb,
        // Required numeric fields contribute no unmeasured kitchen waste.
        // UI labels the kitchen vector unavailable for SpacetimeDB services.
        unservedLbs: 0, unservedUnitsWasted: 0, unservedUnit: "pans", weightPerPanLbs: pan,
        costPerLb: spec.cost_per_lb, costPerPan: pan * spec.cost_per_lb,
        unservedOverproductionDollars: 0,
        culinarySuggestion: `Trial smaller portions of ${food}; keep seconds available and compare tray returns`,
        reductionRange: [10, 15],
        nutrition: {fiberGrams: fiber, proteinGrams: protein, calories,
          nutrientDensity: density === 0 ? "unknown" : density >= 3 ? "high" : "moderate", densityScore: density},
      };
    });
    return { hallId: DEMO_HALL_ID, date, meal: meal as Meal, items,
      // Counts captured food portions, never invented guest/meal counts.
      mealsServed: items.reduce((n, i) => n + i.servings, 0),
      menuSource: "spacetimedb", availability: "available" };
  });
}
export function selectDemoServices(services: ServiceData[], days: string[], meal: OverviewMeal) {
  return services.filter((s) => days.includes(s.date) && (meal === "all" || s.meal === meal));
}
function valueFor(services: ServiceData[], date: string, meal: OverviewMeal, cost = false) {
  const items = selectDemoServices(services, [date], meal).flatMap((s) => s.items);
  if (!items.length) return null;
  return items.reduce((n, i) => n + (cost ? i.wasteCost : i.wasteLbs), 0);
}
export function demoWasteTrend(services: ServiceData[], end: string, meal: OverviewMeal): TrendPoint[] {
  const raw = Array.from({length: 34}, (_, i) => {
    const date = addDays(end, i - 33);
    return {date, value: valueFor(services, date, meal)};
  });
  return raw.slice(6).map((point, i) => {
    const recorded = raw.slice(i, i + 7).filter((p) => p.value !== null);
    return {...point, movingAverage: point.value === null || !recorded.length ? null
      : recorded.reduce((n, p) => n + p.value!, 0) / recorded.length};
  });
}
export function demoCostTrend(services: ServiceData[], end: string, meal: OverviewMeal): TrendPoint[] {
  return Array.from({length: 12}, (_, i) => {
    const date = addDays(end, (i - 11) * 7);
    const dates = Array.from({length: 7}, (_, day) => addDays(date, -day));
    const items = selectDemoServices(services, dates, meal).flatMap((s) => s.items);
    const count = items.reduce((n, item) => n + item.servings, 0);
    return {date, value: count ? items.reduce((n, item) => n + item.wasteCost, 0) / count : null};
  });
}

/** Refresh live candidates while leaving other halls and decision history untouched. */
export function mergeDemoRecommendations(
  stored: import("./types").Recommendation[],
  incoming: import("./types").Recommendation[],
  scope: string[],
  services: ServiceData[],
  make: (s: ServiceData, i: MenuItem, origin: "production" | "nutrition") => import("./types").Recommendation,
) {
  const inScope = (r: import("./types").Recommendation) =>
    r.hallId === DEMO_HALL_ID && scope.includes(`${r.date}|${r.meal}`);
  const retained = stored.filter((r) => !inScope(r));
  const nutrition = stored.filter((r) => inScope(r) && r.origin === "nutrition").flatMap((r) => {
    const service = services.find((s) => s.date === r.date && s.meal === r.meal);
    const item = service?.items.find((i) => i.id === r.itemId);
    return service && item ? [make(service, item, "nutrition")] : [];
  });
  const current = incoming.filter(inScope);
  const next = [...retained, ...current, ...nutrition];
  return JSON.stringify(next) === JSON.stringify(stored) ? stored : next;
}
