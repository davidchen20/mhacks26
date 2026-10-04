// Server route: serve the same date-governed snapshot as every dashboard.
import { NextRequest, NextResponse } from "next/server";
import {
  HALLS,
  getToday,
  validDate,
  servicesForDay,
  type HallId,
  type OverviewMeal,
} from "@/lib/mockData";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const date = p.get("date") ?? getToday(),
    hall = p.get("hall") ?? "all",
    meal = p.get("meal") ?? "all";
  if (
    !validDate(date) ||
    !(hall === "all" || HALLS.some((h) => h.id === hall)) ||
    !["all", "breakfast", "brunch", "lunch", "dinner"].includes(meal)
  )
    return NextResponse.json(
      { error: "Invalid hall, date or meal" },
      { status: 400 },
    );
  if (date > getToday())
    return NextResponse.json({
      message: "No data for future dates",
      services: [],
    });
  return NextResponse.json({
    services: servicesForDay(
      date,
      hall as HallId | "all",
      meal as OverviewMeal,
    ),
  });
}
