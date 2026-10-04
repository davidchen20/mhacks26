"use client";
import { useState } from "react";
import Link from "next/link";
import {
  servicesForDay,
  totals,
  mealsForDate,
  getToday,
  foodLink,
  hallName,
  type HallId,
} from "@/lib/mockData";
import { lbs, currency, title } from "@/lib/format";
import { portionLabel } from "@/lib/foodWeights";
import SegmentedControl from "@/components/shared/SegmentedControl";
import DataTable from "@/components/shared/DataTable";
import SourceNotice from "@/components/shared/SourceNotice";
import { EmptyState } from "@/components/shared/DataState";
export default function DayWastePanel({
  hall,
  date,
}: {
  hall: HallId;
  date: string;
}) {
  const [scope, setScope] = useState<"hall" | "all">("hall");
  const services = servicesForDay(date, scope === "all" ? "all" : hall),
    total = totals(services);
  const rows = services.flatMap((s) =>
    s.items.map((item) => ({
      ...item,
      key: `${s.hallId}-${s.meal}-${item.id}`,
      hall: hallName(s.hallId),
      meal: s.meal,
      href: foodLink(s, item.id),
    })),
  );
  const meals = mealsForDate(date).map((meal) => ({
    meal,
    ...totals(services.filter((s) => s.meal === meal)),
  }));
  const max = Math.max(1, ...meals.map((m) => m.wasteLbs));
  return (
    <section
      className="panel overflow-hidden"
      aria-label="Total food waste for the day"
    >
      <div className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="section-title">Total food waste for the day</h2>
            <p className="muted">
              All scheduled meals for {date}; independent of the selected meal
              above.
            </p>
          </div>
          <SegmentedControl
            label="Daily waste scope"
            value={scope}
            onChange={setScope}
            options={[
              { value: "hall", label: "This hall" },
              { value: "all", label: "All halls" },
            ]}
          />
        </div>
        {date > getToday() ? (
          <EmptyState title="No data for future dates" />
        ) : !total.hasData ? (
          <EmptyState title="Unavailable: menu not published or scrape failed" />
        ) : (
          <>
            <SourceNotice services={services} />
            <dl className="grid gap-4 sm:grid-cols-4">
              {[
                ["Total waste", lbs(total.wasteLbs)],
                ["Waste cost", currency(total.wasteCost, "per day", 2)],
                ["NOT served", lbs(total.unservedLbs)],
                ["Plate waste", lbs(total.plateWasteLbs)],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-sm text-slate-600">{label}</dt>
                  <dd className="mt-1 text-xl font-semibold text-navy">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
            <div
              role="img"
              aria-label="Daily waste by meal: navy is not served, green is plate waste. Exact values in the following table."
              className="space-y-4"
            >
              {meals.map((m) => (
                <div key={m.meal}>
                  <p className="mb-1 text-sm font-semibold">
                    {title(m.meal)} ·{" "}
                    {m.hasData ? lbs(m.wasteLbs) : "Unavailable"}
                  </p>
                  {m.hasData && (
                    <div className="flex h-6 overflow-hidden rounded bg-slate-100">
                      <div
                        className="bg-navy"
                        style={{ width: `${(100 * m.unservedLbs) / max}%` }}
                      />
                      <div
                        className="bg-emerald-700"
                        style={{ width: `${(100 * m.plateWasteLbs) / max}%` }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
            <p className="muted">
              Navy: NOT served · Green: plate waste. Unavailable meals are
              excluded, never counted as zero.
            </p>
            <table className="sr-only">
              <caption>Daily waste by meal</caption>
              <thead>
                <tr>
                  <th>Meal</th>
                  <th>Not served lbs</th>
                  <th>Plate waste lbs</th>
                  <th>Total lbs</th>
                  <th>Cost dollars</th>
                </tr>
              </thead>
              <tbody>
                {meals.map((m) => (
                  <tr key={m.meal}>
                    <th scope="row">{title(m.meal)}</th>
                    <td>{m.hasData ? m.unservedLbs : "Unavailable"}</td>
                    <td>{m.hasData ? m.plateWasteLbs : "Unavailable"}</td>
                    <td>{m.hasData ? m.wasteLbs : "Unavailable"}</td>
                    <td>{m.hasData ? m.wasteCost : "Unavailable"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
      {date <= getToday() && total.hasData && (
        <DataTable
          caption="Daily items ranked by pounds wasted"
          rows={rows}
          rowKey={(r) => r.key}
          initialSort="waste"
          columns={[
            {
              key: "name",
              label: "Item",
              value: (r) => r.name,
              render: (r) => (
                <>
                  <Link
                    className="inline-flex min-h-10 items-center font-semibold text-navy underline"
                    href={r.href}
                  >
                    {r.name}
                  </Link>
                  <p className="muted">{portionLabel(r)}</p>
                </>
              ),
            },
            { key: "hall", label: "Hall", value: (r) => r.hall },
            { key: "meal", label: "Meal", value: (r) => title(r.meal) },
            {
              key: "unserved",
              label: "NOT served lbs",
              value: (r) => r.unservedLbs,
              render: (r) => lbs(r.unservedLbs),
            },
            {
              key: "plate",
              label: "Plate waste lbs",
              value: (r) => r.plateWasteLbs,
              render: (r) => lbs(r.plateWasteLbs),
            },
            {
              key: "waste",
              label: "Total waste lbs",
              value: (r) => r.wasteLbs,
              render: (r) => lbs(r.wasteLbs),
            },
            {
              key: "cost",
              label: "Cost",
              value: (r) => r.wasteCost,
              render: (r) => currency(r.wasteCost, "", 2),
            },
          ]}
        />
      )}
    </section>
  );
}
