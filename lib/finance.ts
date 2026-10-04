import { addDays, getToday, mealsForDate } from "./dates";
import { getService, sourceSummary, totals } from "./menus";
import {
  HALLS,
  OPERATING_DAYS,
  hallName,
  round,
  type Category,
  type FinancePeriod,
  type HallId,
  type Meal,
  type MenuSource,
  type ScrapedArchive,
  type ServiceData,
} from "./types";

export type GroupBy = "item" | "hall" | "meal" | "category";

export interface FinanceWindow {
  dates: string[];
  services: ServiceData[];
  daily: { date: string; cost: number; lbs: number; mealsServed: number }[];
  daysWithMenu: number;
  averageDailyCost: number;
  annualProjection: number;
  unservedCost: number;
  plateWasteCost: number;
  wasteCost: number;
  wasteLbs: number;
  mealsServed: number;
  summary: ReturnType<typeof sourceSummary>;
}

export interface ItemFinanceRow {
  key: string;
  name: string;
  halls: HallId[];
  hallLabel: string;
  appearances: number;
  portionsPrepared: number;
  unservedLbs: number;
  plateWasteLbs: number;
  wasteLbs: number;
  costPerLb: number;
  costSource: string;
  wasteCost: number;
  avgCost: number;
  unservedShare: number;
  menuSource: MenuSource | "mixed";
  category: Category;
  meal?: Meal;
}

function datesForPeriod(period: FinancePeriod, today: string) {
  if (period === "today") return [today];
  const n = period === "7" ? 7 : 28;
  return Array.from({ length: n }, (_, i) => addDays(today, i - (n - 1))).filter(
    (d) => d <= today,
  );
}

export function servicesInWindow(
  archive: ScrapedArchive,
  period: FinancePeriod,
  hallId: HallId | "all",
  today = getToday(),
): ServiceData[] {
  const dates = datesForPeriod(period, today);
  const halls = hallId === "all" ? HALLS : HALLS.filter((h) => h.id === hallId);
  return dates.flatMap((date) =>
    halls.flatMap((hall) =>
      mealsForDate(date).map((meal) =>
        getService(archive, hall.id, date, meal, today),
      ),
    ),
  );
}

export function buildFinanceWindow(
  archive: ScrapedArchive,
  period: FinancePeriod,
  hallId: HallId | "all",
  today = getToday(),
): FinanceWindow {
  const dates = datesForPeriod(period, today);
  const services = servicesInWindow(archive, period, hallId, today);
  const daily = dates.map((date) => {
    const day = services.filter((s) => s.date === date && s.items.length);
    const t = totals(day);
    return {
      date,
      cost: t.wasteCost,
      lbs: t.wasteLbs,
      mealsServed: t.mealsServed,
    };
  });
  const daysWithMenu = daily.filter((d) => d.mealsServed > 0 || d.cost > 0).length;
  const averageDailyCost = daysWithMenu
    ? round(
        daily.filter((d) => d.mealsServed > 0 || d.cost > 0).reduce((n, d) => n + d.cost, 0) /
          daysWithMenu,
        2,
      )
    : 0;
  const t = totals(services);
  return {
    dates,
    services,
    daily,
    daysWithMenu,
    averageDailyCost,
    annualProjection: round(averageDailyCost * OPERATING_DAYS, 0),
    unservedCost: t.unservedCost,
    plateWasteCost: t.plateWasteCost,
    wasteCost: t.wasteCost,
    wasteLbs: t.wasteLbs,
    mealsServed: t.mealsServed,
    summary: sourceSummary(services),
  };
}

export function targetSavings(annualProjection: number, scenarioPct: number) {
  return round((annualProjection * scenarioPct) / 100, 0);
}

/** Home KPI and Finances page share this. */
export function savingsOpportunity(
  archive: ScrapedArchive,
  period: FinancePeriod,
  hallId: HallId | "all",
  scenarioPct: number,
  today = getToday(),
) {
  const window = buildFinanceWindow(archive, period, hallId, today);
  return {
    ...window,
    scenarioPct,
    savings: targetSavings(window.annualProjection, scenarioPct),
  };
}

function sourceOf(items: { menuSource: MenuSource | "none" }[]): MenuSource | "mixed" {
  const set = new Set(
    items
      .map((i) => i.menuSource)
      .filter((s): s is MenuSource => s === "mdining" || s === "sample"),
  );
  if (set.size === 1) return [...set][0];
  return "mixed";
}

export function groupFinance(
  services: ServiceData[],
  groupBy: GroupBy,
): ItemFinanceRow[] {
  const map = new Map<
    string,
    {
      name: string;
      halls: Set<HallId>;
      appearances: number;
      portionsPrepared: number;
      unservedLbs: number;
      plateWasteLbs: number;
      wasteLbs: number;
      wasteCost: number;
      unservedPortions: number;
      preparedPortions: number;
      costPerLb: number;
      costSource: string;
      category: Category;
      meal?: Meal;
      sources: ServiceData["menuSource"][];
    }
  >();
  for (const s of services) {
    for (const item of s.items) {
      const key =
        groupBy === "item"
          ? item.name.toLowerCase()
          : groupBy === "hall"
            ? s.hallId
            : groupBy === "meal"
              ? s.meal
              : item.category;
      const name =
        groupBy === "item"
          ? item.name
          : groupBy === "hall"
            ? hallName(s.hallId)
            : groupBy === "meal"
              ? s.meal
              : item.category;
      const cur = map.get(key) ?? {
        name,
        halls: new Set<HallId>(),
        appearances: 0,
        portionsPrepared: 0,
        unservedLbs: 0,
        plateWasteLbs: 0,
        wasteLbs: 0,
        wasteCost: 0,
        unservedPortions: 0,
        preparedPortions: 0,
        costPerLb: item.costPerLb,
        costSource: item.costSource,
        category: item.category,
        meal: s.meal,
        sources: [] as ServiceData["menuSource"][],
      };
      cur.halls.add(s.hallId);
      cur.appearances += 1;
      cur.portionsPrepared += item.portionsPrepared;
      cur.unservedLbs += item.unservedLbs;
      cur.plateWasteLbs += item.plateWasteLbs;
      cur.wasteLbs += item.wasteLbs;
      cur.wasteCost += item.wasteCost;
      cur.unservedPortions += item.portionsPrepared - item.portionsServed;
      cur.preparedPortions += item.portionsPrepared;
      cur.costPerLb = item.costPerLb;
      cur.costSource = item.costSource;
      cur.category = item.category;
      cur.sources.push(s.menuSource);
      map.set(key, cur);
    }
  }
  return [...map.entries()]
    .map(([key, r]) => ({
      key,
      name: r.name,
      halls: [...r.halls],
      hallLabel: [...r.halls].map(hallName).join(", "),
      appearances: r.appearances,
      portionsPrepared: r.portionsPrepared,
      unservedLbs: round(r.unservedLbs, 3),
      plateWasteLbs: round(r.plateWasteLbs, 3),
      wasteLbs: round(r.wasteLbs, 3),
      costPerLb: r.costPerLb,
      costSource: r.costSource,
      wasteCost: round(r.wasteCost, 2),
      avgCost: round(r.wasteCost / Math.max(1, r.appearances), 2),
      unservedShare: r.preparedPortions
        ? r.unservedPortions / r.preparedPortions
        : 0,
      menuSource: sourceOf(r.sources.map((menuSource) => ({ menuSource }))),
      category: r.category,
      meal: r.meal,
    }))
    .sort((a, b) => b.wasteCost - a.wasteCost);
}

export function categoryRowsEqualItemSum(services: ServiceData[]) {
  const items = groupFinance(services, "item");
  const cats = groupFinance(services, "category");
  const fromItems = new Map<string, number>();
  for (const row of items)
    fromItems.set(row.category, (fromItems.get(row.category) ?? 0) + row.wasteCost);
  return cats.every(
    (c) => round(fromItems.get(c.name as Category) ?? 0, 2) === c.wasteCost,
  );
}

export function costPerMealServed(window: FinanceWindow) {
  return window.mealsServed
    ? round(window.wasteCost / window.mealsServed, 4)
    : null;
}

export function costTrend12Weeks(
  archive: ScrapedArchive,
  hallId: HallId | "all",
  today = getToday(),
) {
  return Array.from({ length: 12 }, (_, i) => {
    const end = addDays(today, (i - 11) * 7);
    const days = Array.from({ length: 7 }, (_, d) => addDays(end, d - 6));
    const halls = hallId === "all" ? HALLS : HALLS.filter((h) => h.id === hallId);
    const services = days.flatMap((day) =>
      day > today
        ? []
        : halls.flatMap((h) =>
            mealsForDate(day).map((m) => getService(archive, h.id, day, m, today)),
          ),
    );
    const t = totals(services);
    const summary = sourceSummary(services);
    return {
      date: end,
      value: t.mealsServed ? round(t.wasteCost / t.mealsServed, 4) : null,
      label:
        summary.realDays && !summary.sampleDays
          ? "real"
          : summary.sampleDays && !summary.realDays
            ? "sample"
            : summary.realDays || summary.sampleDays
              ? "mixed"
              : "none",
    };
  });
}

export function financeCsv(rows: ItemFinanceRow[]) {
  const header = [
    "item",
    "halls",
    "appearances",
    "portions_prepared",
    "lbs_not_served",
    "lbs_plate_waste",
    "lbs_total",
    "usd_per_lb",
    "cost_source",
    "waste_cost_usd",
    "avg_cost_per_appearance",
    "menu_source",
  ];
  const lines = rows.map((r) =>
    [
      r.name,
      r.hallLabel,
      r.appearances,
      r.portionsPrepared,
      r.unservedLbs,
      r.plateWasteLbs,
      r.wasteLbs,
      r.costPerLb,
      r.costSource,
      r.wasteCost,
      r.avgCost,
      r.menuSource,
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}
