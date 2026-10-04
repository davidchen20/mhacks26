import { NextRequest, NextResponse } from "next/server";
import { servicesForDay, getToday, totals, HALLS, validDate, type HallId, type OverviewMeal } from "@/lib/mockData";
export const dynamic = "force-dynamic";
export function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams;
  const date = query.get("date") ?? getToday();
  const hall = query.get("hall") ?? "all";
  const meal = query.get("meal") ?? "all";
  if (!validDate(date) || (hall !== "all" && !HALLS.some(h => h.id === hall)) || !["all", "breakfast", "lunch", "brunch", "dinner"].includes(meal)) return NextResponse.json({error: "Invalid scope"}, {status: 400});
  const services = servicesForDay(date, hall as HallId | "all", meal as OverviewMeal);
  const total = totals(services);
  return NextResponse.json({date, hall, meal, data_source: "Simulated waste; published or illustrative menu", has_data: total.hasData,
    summary: {total_waste_dollars: total.wasteCost, plate_waste_dollars: total.plateWasteDollars, unserved_overproduction_dollars: total.unservedOverproductionDollars, total_waste_lbs: total.wasteLbs, plate_waste_lbs: total.plateWasteLbs, unserved_overproduction_lbs: total.unservedLbs},
    services: services.map(s => ({hall: s.hallId, date: s.date, meal: s.meal, availability: s.availability,
      items: s.items.map(i => ({dish: i.name, total_served_lbs: i.totalServedLbs, post_consumer_pct: i.postConsumerPct,
        unserved_units_wasted: i.unservedUnitsWasted, unserved_unit: i.unservedUnit, weight_per_pan_lbs: i.weightPerPanLbs,
        cost_per_lb: i.costPerLb, cost_per_pan: i.costPerPan, plate_waste_dollars: i.plateWasteDollars,
        unserved_overproduction_dollars: i.unservedOverproductionDollars, total_waste_dollars: i.wasteCost, total_waste_lbs: i.wasteLbs}))}))}, {headers: {"Cache-Control": "no-store"}});
}
