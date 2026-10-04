"use client";
import { useEffect, useMemo, useState } from "react";
import {
  getToday,
  serviceLabel,
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
import KitchenBatchTracker from "./KitchenBatchTracker";
import TrayFeed from "./TrayFeed";
import SourceNotice from "@/components/shared/SourceNotice";
import ItemWastePanel from "./ItemWastePanel";
import DayWastePanel from "./DayWastePanel";
export default function FoodDashboard() {
  const { params, setQuery } = useQueryState();
  const hall = (
    HALLS.some((h) => h.id === params.get("hall"))
      ? params.get("hall")
      : "south-quad"
  ) as HallId;
  const rawDate = params.get("date");
  const date = rawDate && validDate(rawDate) ? rawDate : getToday();
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
  }, [requested, meal]); // eslint-disable-line react-hooks/exhaustive-deps
  const service = useMemo(
    () => getService(hall, date, meal),
    [hall, date, meal],
  );
  const total = totals([service]);
  const item = params.get("item");
  const selectedId = service.items.some((i) => i.id === item)
    ? item!
    : (service.items[0]?.id ?? null);
  useEffect(() => {
    if (selectedId && item !== selectedId) setQuery({ item: selectedId }, true);
  }, [selectedId, item]); // eslint-disable-line react-hooks/exhaustive-deps
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
            <option value="mhacks-demo">MHacks Demo</option>
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
            Invalid date in URL; showing today.
          </p>
        )}
      </div>
      {service.availability !== "available" ? (
        <EmptyState title={serviceLabel(service)}>
          Choose an available hall, date and meal.
        </EmptyState>
      ) : (
        <>
          <SourceNotice services={[service]} />
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
          <div className="space-y-6">
            <div className="min-w-0 space-y-6">
              <ItemWastePanel
                items={service.items}
                selectedId={selectedId!}
                onSelect={(id) => setQuery({ item: id })}
              />
              <MenuTable
                items={service.items}
                selectedId={selectedId}
                onSelect={(id) => setQuery({ item: id })}
              />
            </div>
            <div className="grid items-start gap-6 lg:grid-cols-2">
              <TrayFeed key={`${hall}|${date}|${meal}`} service={service} selectedId={selectedId} />
              <KitchenBatchTracker service={service} />
            </div>
          </div>
        </>
      )}
      <DayWastePanel hall={hall} date={date} />
    </div>
  );
}
