/** Shared data policy. Historical data and ALL waste readings are simulated.
 * Kept at this import path to preserve existing component interfaces.
 */
import { wasteAdvice } from "./wasteAdvice";
import scrapedJSON from "./scrapedMenus.json";
import type {
  Hall,
  HallId,
  HallSummary,
  ServiceData,
  MenuItem,
  Recommendation,
  TrendPoint,
  Tray,
  ScrapedItem,
  ScrapedMenus,
} from "./types";
import {
  getToday,
  validDate,
  mealsForDate,
  datesForRange,
  addDays,
  type Range,
  type Meal,
  type OverviewMeal,
} from "./dates";
import { round, seededRandom } from "./random";
import { scrapedItemsToMenuItems } from "./scrapedItems";
import { trayWeight } from "./foodWeights";
export * from "./types";
export * from "./dates";
export * from "./random";
export const SCRAPED_MENUS: ScrapedMenus = scrapedJSON as ScrapedMenus;
export const OPERATING_DAYS = 290;
export function hasScrapedMenu(
  id: HallId,
  date = getToday(),
  menus = SCRAPED_MENUS,
) {
  return mealsForDate(date).some(
    (m) => (menus[id]?.[date]?.[m]?.length ?? 0) > 0,
  );
}
const hallNames: Record<HallId, string> = {
  bursley: "Bursley",
  "south-quad": "South Quad",
  "east-quad": "East Quad",
  "mosher-jordan": "Mosher-Jordan",
  markley: "Markley",
  twigs: "Twigs",
};
export const HALLS: Hall[] = (Object.keys(hallNames) as HallId[]).map((id) => ({
  id,
  name: hallNames[id],
  get reporting() {
    return hasScrapedMenu(id);
  },
}));
export const hallName = (id: HallId) => hallNames[id];
const illustrative: ScrapedItem[] = [
  {
    name: "Roasted chicken",
    station: "Grill",
    servingSize: "4 oz",
    calories: 210,
    protein: 28,
    fiber: 0,
    traits: [],
    allergens: [],
  },
  {
    name: "Seasonal vegetables",
    station: "Produce",
    servingSize: "1/2 cup",
    calories: 60,
    protein: 3,
    fiber: 4,
    traits: [],
    allergens: [],
  },
  {
    name: "Cooked rice",
    station: "Grains",
    servingSize: "1/2 cup",
    calories: 180,
    protein: 4,
    fiber: 2,
    traits: [],
    allergens: [],
  },
  {
    name: "Yogurt",
    station: "Dairy",
    servingSize: "6 oz",
    calories: 120,
    protein: 12,
    fiber: 0,
    traits: [],
    allergens: [],
  },
];
export function getService(
  hallId: HallId,
  date: string,
  meal: Meal,
  menus: ScrapedMenus = SCRAPED_MENUS,
  today = getToday(),
): ServiceData {
  const historical = date < today;
  const base: ServiceData = {
    hallId,
    date,
    meal,
    items: [],
    mealsServed: 0,
    menuSource: historical ? "illustrative" : "mdining",
    availability: "unavailable",
  };
  if (!validDate(date)) return base;
  if (date > today) return { ...base, availability: "future" };
  if (!mealsForDate(date).includes(meal))
    return { ...base, availability: "no-service" };
  const raw = historical ? illustrative : menus[hallId]?.[date]?.[meal];
  if (!raw?.length) return base;
  const items = scrapedItemsToMenuItems(raw, `${hallId}|${date}|${meal}`);
  if (!items.length) return base;
  // Estimated guest count is at least the largest item's served count.
  const mealsServed = Math.max(...items.map((i) => i.portionsServed));
  return { ...base, items, mealsServed, availability: "available" };
}
export const serviceLabel = (s: ServiceData) =>
  s.availability === "future"
    ? "No data for future dates"
    : s.availability === "no-service"
      ? "No service for the selected meal"
      : s.availability === "unavailable"
        ? "Unavailable: menu not published or scrape failed"
        : s.menuSource === "mdining"
          ? "Menu from M Dining · waste readings simulated"
          : "Illustrative data";
export function sourceLabel(services: ServiceData[]) {
  const available = services.filter((s) => s.availability === "available");
  if (!available.length)
    return services.some((s) => s.availability === "future")
      ? "No data for future dates"
      : "Unavailable: menu not published or scrape failed";
  const historical = available.some((s) => s.menuSource === "illustrative");
  const real = available.some((s) => s.menuSource === "mdining");
  return historical && real
    ? "Menu from M Dining · waste readings simulated · Includes illustrative data"
    : historical
      ? "Illustrative data"
      : "Menu from M Dining · waste readings simulated";
}
export function servicesForDay(
  date: string,
  hall: HallId | "all" = "all",
  meal: OverviewMeal = "all",
) {
  return HALLS.filter((h) => hall === "all" || h.id === hall).flatMap((h) =>
    mealsForDate(date)
      .filter((m) => meal === "all" || m === meal)
      .map((m) => getService(h.id, date, m)),
  );
}
export function servicesForRange(
  range: Range = "today",
  meal: OverviewMeal = "all",
  offset = 0,
  today = getToday(),
) {
  return datesForRange(range, offset, today).flatMap((date) =>
    servicesForDay(date, "all", meal),
  );
}
export function totals(services: ServiceData[]) {
  const available = services.filter((s) => s.availability === "available");
  const items = available.flatMap((s) => s.items);
  const sum = (
    key: "wasteLbs" | "wasteCost" | "unservedLbs" | "plateWasteLbs",
  ) => items.reduce((n, i) => n + i[key], 0);
  return {
    hasData: available.length > 0,
    wasteLbs: sum("wasteLbs"),
    wasteCost: items.reduce((n, i) => n + i.plateWasteDollars + i.unservedOverproductionDollars, 0),
    plateWasteDollars: items.reduce((n, i) => n + i.plateWasteDollars, 0),
    unservedOverproductionDollars: items.reduce((n, i) => n + i.unservedOverproductionDollars, 0),
    unservedLbs: sum("unservedLbs"),
    plateWasteLbs: sum("plateWasteLbs"),
    mealsServed: available.reduce((n, s) => n + s.mealsServed, 0),
  };
}
export function summarizeHalls(services: ServiceData[]): HallSummary[] {
  return HALLS.map((hall) => {
    const selected = services.filter(
      (s) => s.hallId === hall.id && s.items.length,
    );
    const t = totals(selected);
    return !t.hasData
      ? {
          hall,
          wasteLbs: null,
          wasteCost: null,
          mealsServed: null,
          wastePerMeal: null,
          topItem: null,
        }
      : {
          hall,
          ...t,
          wastePerMeal: t.mealsServed ? t.wasteLbs / t.mealsServed : null,
          topItem: selected
            .flatMap((s) => s.items)
            .sort((a, b) => b.wasteLbs - a.wasteLbs)[0],
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
  end = getToday(),
  meal: OverviewMeal = "all",
): TrendPoint[] {
  const raw = Array.from({ length: 34 }, (_, i) => {
    const date = addDays(end, i - 33),
      t = totals(servicesForDay(date, "all", meal));
    return { date, value: t.hasData ? t.wasteLbs : null };
  });
  return raw.slice(6).map((p, i) => {
    const available = raw
      .slice(i, i + 7)
      .filter((d): d is { date: string; value: number } => d.value !== null);
    return {
      ...p,
      movingAverage:
        p.value !== null && available.length
          ? available.reduce((n, d) => n + d.value, 0) / available.length
          : null,
    };
  });
}
export function financeBreakdown(
  mode: "category" | "hall",
  services = servicesForDay(getToday()),
) {
  const values = new Map<string, number>();
  for (const s of services)
    for (const i of s.items) {
      const key = mode === "hall" ? hallName(s.hallId) : i.category;
      values.set(key, (values.get(key) ?? 0) + i.wasteCost);
    }
  return [...values].map(([name, value]) => ({
    name,
    value,
    annual: value * OPERATING_DAYS,
  }));
}
export function costTrend(
  end = getToday(),
  hall: HallId | "all" = "all",
  meal: OverviewMeal = "all",
): TrendPoint[] {
  return Array.from({ length: 12 }, (_, i) => {
    const date = addDays(end, (i - 11) * 7);
    if (date > getToday()) return { date, value: null };
    const t = totals(
      Array.from({ length: 7 }, (_, d) => addDays(date, -d)).flatMap((day) =>
        servicesForDay(day, hall, meal),
      ),
    );
    return {
      date,
      value: t.hasData && t.mealsServed ? t.wasteCost / t.mealsServed : null,
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
    reductionRange: [0, 0], // supplied engine returns prose, not a numeric estimate
    recommendationEngine: "hardcoded",
    wasteRatio: wasteAdvice(item).result?.waste_ratio,
    ruleCategory: wasteAdvice(item).result?.category,
    dietary: wasteAdvice(item).result?.dietary,
    wasteOrigin: wasteAdvice(item).origin,
    severity: wasteAdvice(item).severity,
    kitchenWasteCost: item.unservedOverproductionDollars,
    plateWasteCost: item.plateWasteDollars,
    wasteCost: item.wasteCost,
    origin,
    title: wasteAdvice(item).title,
  };
}
export function recommendationsForServices(services: ServiceData[]) {
  return services.flatMap(service => service.items
    .filter(item => wasteAdvice(item).result !== null)
    .map(item => makeRecommendation(service, item)))
    .sort((a,b) => (b.wasteRatio ?? 0) - (a.wasteRatio ?? 0));
}
export const getInitialRecommendations = () =>
  recommendationsForServices(servicesForDay(getToday()));
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
    readings: pool.slice(0, 3).map((i) => {
      const remainingPct = Math.max(
        0,
        Math.min(90, Math.round(i.remainingPct + (rand() + rand() - 1) * 22)),
      );
      return {
        itemId: i.id,
        name: i.name,
        category: i.category,
        remainingPct,
        standardPortionOz: i.standardPortionOz,
        weightSource: i.weightSource,
        ...trayWeight(i.standardPortionOz, remainingPct),
      };
    }),
  };
}
