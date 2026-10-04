import { mealsForDate, getToday, addDays, datesForRange, validDate } from "./dates";
import { applySimulatedWaste, itemWasteTotals } from "./metrics";
import { buildSampleMenu } from "./sampleMenus";
import { itemsFromScraped } from "./scrapedItems";
import { seededRandom } from "./text";
import {
  HALLS,
  OPERATING_DAYS,
  hallName,
  round,
  type HallId,
  type HallSummary,
  type Meal,
  type MenuItem,
  type MenuSource,
  type OverviewMeal,
  type Range,
  type Recommendation,
  type ScrapedArchive,
  type ServiceData,
  type SourceSummary,
  type Tray,
  type TrendPoint,
} from "./types";

function emptyService(
  hallId: HallId,
  date: string,
  meal: Meal,
): ServiceData {
  return {
    hallId,
    date,
    meal,
    mealsServed: 0,
    items: [],
    menuSource: "none",
  };
}

export function hasScrapedMeal(
  archive: ScrapedArchive,
  hallId: HallId,
  date: string,
  meal: Meal,
) {
  const rows = archive[hallId]?.[date]?.[meal];
  return Array.isArray(rows) && rows.length > 0;
}

export function hallHasScrapedDate(
  archive: ScrapedArchive,
  hallId: HallId,
  date: string,
) {
  const day = archive[hallId]?.[date];
  if (!day) return false;
  return Object.values(day).some((rows) => Array.isArray(rows) && rows.length > 0);
}

export function isReportingHall(
  archive: ScrapedArchive,
  hallId: HallId,
  today = getToday(),
) {
  return hallHasScrapedDate(archive, hallId, today);
}

export function getService(
  archive: ScrapedArchive,
  hallId: HallId,
  date: string,
  meal: Meal,
  today = getToday(),
): ServiceData {
  if (!validDate(date) || date > today || !mealsForDate(date).includes(meal))
    return emptyService(hallId, date, meal);

  const scraped = archive[hallId]?.[date]?.[meal];
  let items: MenuItem[];
  let menuSource: MenuSource;
  if (scraped && scraped.length) {
    items = itemsFromScraped(hallId, scraped);
    menuSource = "mdining";
  } else {
    items = buildSampleMenu(hallId, date, meal);
    menuSource = "sample";
  }
  items = applySimulatedWaste(items, hallId, date, meal);
  const rand = seededRandom(`served|${hallId}|${date}|${meal}`);
  const mealsServed = Math.max(
    40,
    Math.round(
      items.reduce((n, i) => n + i.portionsServed, 0) / Math.max(3, items.length) +
        rand() * 40,
    ),
  );
  return { hallId, date, meal, items, mealsServed, menuSource };
}

export function servicesForDay(
  archive: ScrapedArchive,
  hallId: HallId,
  date: string,
  today = getToday(),
) {
  return mealsForDate(date).map((meal) =>
    getService(archive, hallId, date, meal, today),
  );
}

export function servicesForRange(
  archive: ScrapedArchive,
  range: Range = "today",
  meal: OverviewMeal = "all",
  today = getToday(),
  offset = 0,
): ServiceData[] {
  return datesForRange(range, today, offset).flatMap((date) =>
    HALLS.flatMap((hall) =>
      mealsForDate(date)
        .filter((m) => meal === "all" || meal === m)
        .map((m) => getService(archive, hall.id, date, m, today)),
    ),
  );
}

export function totals(services: ServiceData[]) {
  const items = services.flatMap((s) => s.items);
  const t = itemWasteTotals(items);
  return {
    ...t,
    mealsServed: services.reduce((n, s) => n + s.mealsServed, 0),
  };
}

export function sourceSummary(services: ServiceData[]): SourceSummary {
  const byDate = new Map<string, Set<MenuSource | "none">>();
  for (const s of services) {
    const set = byDate.get(s.date) ?? new Set();
    if (s.items.length && s.menuSource !== "none") set.add(s.menuSource);
    else if (!s.items.length) set.add("none");
    byDate.set(s.date, set);
  }
  let realDays = 0,
    sampleDays = 0,
    noneDays = 0;
  for (const set of byDate.values()) {
    const hasReal = set.has("mdining");
    const hasSample = set.has("sample");
    if (hasReal && !hasSample) realDays += 1;
    else if (hasSample && !hasReal) sampleDays += 1;
    else if (hasReal && hasSample) {
      realDays += 1;
      sampleDays += 1;
    } else noneDays += 1;
  }
  return { realDays, sampleDays, noneDays };
}

export function formatSourceSummary(summary: SourceSummary) {
  const parts: string[] = [];
  if (summary.realDays)
    parts.push(
      `${summary.realDays} day${summary.realDays === 1 ? "" : "s"} real menu`,
    );
  if (summary.sampleDays)
    parts.push(
      `${summary.sampleDays} day${summary.sampleDays === 1 ? "" : "s"} sample`,
    );
  return parts.join(" · ") || "No menu days";
}

export function menuSourceLabel(source: ServiceData["menuSource"]) {
  if (source === "mdining")
    return "Menu from M Dining · waste readings simulated";
  if (source === "sample") return "Sample data · not the actual menu";
  return "No data for future dates";
}

export function summarizeHalls(
  archive: ScrapedArchive,
  services: ServiceData[],
  today = getToday(),
): HallSummary[] {
  return HALLS.map((hall) => {
    const selected = services.filter(
      (s) => s.hallId === hall.id && s.items.length,
    );
    const reporting = isReportingHall(archive, hall.id, today);
    const sources = new Set(selected.map((s) => s.menuSource));
    const menuSource: HallSummary["menuSource"] = !selected.length
      ? "none"
      : sources.size === 1
        ? (selected[0].menuSource as MenuSource)
        : "mixed";
    if (!selected.length)
      return {
        hall: { ...hall, reporting },
        wasteLbs: null,
        wasteCost: null,
        mealsServed: null,
        wastePerMeal: null,
        topItem: null,
        menuSource,
      };
    const t = totals(selected);
    const topItem =
      selected
        .flatMap((s) => s.items)
        .sort((a, b) => b.wasteCost - a.wasteCost || b.wasteLbs - a.wasteLbs)[0] ??
      null;
    return {
      hall: { ...hall, reporting },
      ...t,
      wastePerMeal: t.mealsServed ? t.wasteLbs / t.mealsServed : null,
      topItem,
      menuSource,
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
  archive: ScrapedArchive,
  end = getToday(),
  meal: OverviewMeal = "all",
  today = getToday(),
): TrendPoint[] {
  const raw = Array.from({ length: 34 }, (_, i) => {
    const date = addDays(end, i - 33);
    if (date > today) return { date, value: null as number | null };
    const services = HALLS.flatMap((h) =>
      mealsForDate(date)
        .filter((m) => meal === "all" || meal === m)
        .map((m) => getService(archive, h.id, date, m, today)),
    );
    const t = totals(services);
    const hasMeal = services.some((s) => s.items.length);
    return { date, value: hasMeal ? t.wasteLbs : null };
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
    wasteLbs: item.wasteLbs,
    menuSource: service.menuSource === "none" ? "sample" : service.menuSource,
    origin,
    title:
      origin === "nutrition"
        ? item.culinarySuggestion
        : `Reduce tomorrow’s ${item.name.toLowerCase()} production by ${item.reductionRange[0]}–${item.reductionRange[1]}%`,
  };
}

export function initialRecommendations(
  archive: ScrapedArchive,
  today = getToday(),
): Recommendation[] {
  return HALLS.map((hall) => {
    const meals = mealsForDate(today);
    const services = meals.map((m) =>
      getService(archive, hall.id, today, m, today),
    );
    const ranked = services
      .flatMap((service) => service.items.map((item) => ({ service, item })))
      .sort((a, b) => b.item.wasteCost - a.item.wasteCost);
    const top = ranked[0];
    return top ? makeRecommendation(top.service, top.item) : null;
  }).filter((r): r is Recommendation => r != null);
}

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
    readings: pool.slice(0, 3).map((i) => ({
      itemId: i.id,
      name: i.name,
      category: i.category,
      remainingPct: Math.max(
        0,
        Math.min(90, Math.round(i.remainingPct + (rand() + rand() - 1) * 22)),
      ),
    })),
  };
}

export { hallName, OPERATING_DAYS, HALLS };
