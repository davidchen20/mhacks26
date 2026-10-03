"use client";
import { useEffect, useMemo, useState } from "react";
import {
  DEMO_DATE,
  HALLS,
  getService,
  mealsForDate,
  validDate,
  totals,
  hallName,
  type HallId,
  type Meal,
} from "@/lib/mockData";
import { useQueryState } from "@/lib/useQueryState";
import { currency, dateLabel, lbs, title } from "@/lib/format";
import PageHeader from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/DataState";
import KpiTile from "@/components/shared/KpiTile";
import MenuTable from "./MenuTable";
import TrayFeed from "./TrayFeed";
export default function FoodDashboard() {
  const { params, setQuery } = useQueryState();
  const hall = (
    HALLS.some((h) => h.id === params.get("hall"))
      ? params.get("hall")
      : "south-quad"
  ) as HallId;
  const rawDate = params.get("date");
  const date = rawDate && validDate(rawDate) ? rawDate : DEMO_DATE;
  const allowed = mealsForDate(date);
  const requested = params.get("meal");
  const meal = (
    allowed.includes(requested as Meal) ? requested : allowed[0]
  ) as Meal;
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (requested && requested !== meal) {
      setNotice(
        `Meal changed to ${title(meal)}. ${allowed.includes("brunch") ? "Weekend services are Brunch and Dinner." : "Weekday services are Breakfast, Lunch and Dinner."}`,
      );
      setQuery({ meal }, true);
    }
  }, [requested, meal]); // URL correction happens atomically; no request can use an invalid meal.
  const service = useMemo(
    () => getService(hall, date, meal),
    [hall, date, meal],
  );
  const total = totals([service]);
  const item = params.get("item");
  const selectedId = service.items.some((i) => i.id === item) ? item : null;
  return (
    <div className="space-y-6">
      <PageHeader
        title={`Food Data · ${hallName(hall)} · ${dateLabel(date)}`}
        description={`${title(meal)} service · Inspect menu waste and related tray readings.`}
      />
      <div className="panel grid gap-4 p-5 sm:grid-cols-3">
        <label className="text-sm font-semibold">
          Dining hall
          <select
            className="input mt-2"
            value={hall}
            onChange={(e) => setQuery({ hall: e.target.value, item: null })}
          >
            {HALLS.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold">
          Service date
          <input
            type="date"
            className="input mt-2"
            value={date}
            onChange={(e) => {
              const next = e.target.value;
              if (!validDate(next)) return;
              const options = mealsForDate(next);
              const corrected = options.includes(meal) ? meal : options[0];
              setNotice(
                corrected !== meal
                  ? `Meal changed to ${title(corrected)} for the selected date.`
                  : "",
              );
              setQuery({ date: next, meal: corrected, item: null });
            }}
          />
        </label>
        <label className="text-sm font-semibold">
          Meal
          <select
            className="input mt-2"
            value={meal}
            onChange={(e) => {
              setNotice("");
              setQuery({ meal: e.target.value, item: null });
            }}
          >
            {allowed.map((m) => (
              <option key={m} value={m}>
                {title(m)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div aria-live="polite">
        {notice && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            {notice}
          </p>
        )}
        {rawDate && !validDate(rawDate) && (
          <p className="text-sm text-amber-900">
            Invalid date in URL; showing the demo date.
          </p>
        )}
      </div>
      {service.source === "unavailable" ? (
        <>
          <EmptyState
            title={
              date > DEMO_DATE
                ? "Future service · no data yet"
                : hall === "twigs"
                  ? "Twigs · No data yet"
                  : "No menu for this service"
            }
          >
            {date > DEMO_DATE
              ? "Future dates do not generate menus, trays, or recommendations. Choose October 3, 2026 or an earlier date."
              : "This hall is closed / non-reporting in the demo. Select another dining hall."}
          </EmptyState>
          <div className="grid gap-4 sm:grid-cols-2">
            <EmptyState title="No menu items" />
            <EmptyState title="No tray readings" />
          </div>
        </>
      ) : (
        <>
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {service.source === "illustrative"
              ? "Illustrative data · This historical menu is generated deterministically from hall + date + meal. It is not an archive of actual dining menus."
              : "Demo snapshot · Fictional menu and simulated waste, nutrition and tray data."}
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            <KpiTile
              label="Service waste"
              value={lbs(total.wasteLbs)}
              detail={`${title(meal)} · ${dateLabel(date)}`}
            />
            <KpiTile
              label="Service waste cost"
              value={currency(total.wasteCost, "per service", 2)}
              detail="Sum of item waste costs"
              tone="warning"
            />
            <KpiTile
              label="Meals served"
              value={total.mealsServed}
              detail="Simulated service count"
            />
          </div>
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_370px]">
            <div className="min-w-0">
              <MenuTable
                items={service.items}
                selectedId={selectedId}
                onSelect={(id) =>
                  setQuery({ item: selectedId === id ? null : id })
                }
              />
              {selectedId && (
                <button
                  className="btn mt-4"
                  onClick={() => setQuery({ item: null })}
                >
                  Clear selected item
                </button>
              )}
            </div>
            <TrayFeed
              key={`${hall}|${date}|${meal}`}
              service={service}
              selectedId={selectedId}
            />
          </div>
        </>
      )}
    </div>
  );
}
