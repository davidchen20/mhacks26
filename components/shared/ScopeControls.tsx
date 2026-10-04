"use client";
import { useEffect, useState } from "react";
import {
  HALLS,
  getToday,
  validDate,
  correctOverviewMeal,
  mealOptionsForDates,
  type HallId,
} from "@/lib/mockData";
import { useQueryState } from "@/lib/useQueryState";
import { title } from "@/lib/format";
export function useScope() {
  const { params, setQuery } = useQueryState();
  const rawDate = params.get("date");
  const date = rawDate && validDate(rawDate) ? rawDate : getToday();
  const rawHall = params.get("hall");
  const hall: HallId | "all" = HALLS.some((h) => h.id === rawHall)
    ? (rawHall as HallId)
    : "all";
  const requested = params.get("meal");
  const meal = correctOverviewMeal(requested, [date]);
  return { params, setQuery, date, hall, meal, requested };
}
export default function ScopeControls({
  scope,
}: {
  scope: ReturnType<typeof useScope>;
}) {
  const { date, hall, meal, requested, setQuery } = scope;
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (requested && requested !== meal) {
      setNotice("Meal changed to All for the selected date.");
      setQuery({ meal: "all" }, true);
    }
  }, [requested, meal]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="panel p-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="text-sm font-semibold">
          Dining hall
          <select
            className="input mt-2"
            value={hall}
            onChange={(e) => setQuery({ hall: e.target.value })}
          >
            <option value="all">All halls</option>
            {HALLS.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold">
          Date
          <input
            className="input mt-2"
            type="date"
            value={date}
            onChange={(e) => {
              if (validDate(e.target.value)) setQuery({ date: e.target.value });
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
              setQuery({ meal: e.target.value });
            }}
          >
            {mealOptionsForDates([date]).map((m) => (
              <option key={m} value={m}>
                {title(m)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {notice && (
        <p role="status" className="mt-3 text-sm text-amber-900">
          {notice}
        </p>
      )}
    </div>
  );
}
