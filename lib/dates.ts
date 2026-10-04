/** Pure campus-calendar helpers; no browser timezone dependence. */
export type Meal = "breakfast" | "brunch" | "lunch" | "dinner";
export type OverviewMeal = "all" | Meal;
export type Range = "today" | "yesterday" | "week";
export function validDate(s: string) {
  const d = new Date(`${s}T12:00:00Z`);
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    !Number.isNaN(+d) &&
    d.toISOString().slice(0, 10) === s
  );
}
export function getToday(now = new Date()): string {
  const override = process.env.NEXT_PUBLIC_DEMO_DATE;
  if (override && validDate(override)) return override;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Detroit",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function addDays(date: string, n: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function mealsForDate(date: string): Meal[] {
  return [0, 6].includes(new Date(`${date}T12:00:00Z`).getUTCDay())
    ? ["brunch", "dinner"]
    : ["breakfast", "lunch", "dinner"];
}
export function datesForRange(range: Range, offset = 0, today = getToday()) {
  const end = addDays(today, offset - (range === "yesterday" ? 1 : 0));
  return range === "week"
    ? Array.from({ length: 7 }, (_, i) => addDays(end, i - 6))
    : [end];
}
export function mealOptionsForDates(dates: string[]): OverviewMeal[] {
  const available = new Set(dates.flatMap(mealsForDate));
  return (
    ["all", "breakfast", "lunch", "brunch", "dinner"] as OverviewMeal[]
  ).filter((m) => m === "all" || available.has(m));
}
export function correctOverviewMeal(
  requested: string | null,
  dates: string[],
): OverviewMeal {
  return mealOptionsForDates(dates).includes(requested as OverviewMeal)
    ? (requested as OverviewMeal)
    : "all";
}
