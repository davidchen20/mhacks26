"use client";
import Link from "next/link";
import {
  datesForRange,
  servicesForRange,
  totals,
  summarizeHalls,
  universityTrend,
  foodLink,
  OPERATING_DAYS,
  type Range,
  type OverviewMeal,
} from "@/lib/mockData";
import { useQueryState } from "@/lib/useQueryState";
import { currency, dateLabel, lbs, percent } from "@/lib/format";
import { statusFor, THRESHOLDS } from "@/lib/status";
import PageHeader from "@/components/shared/PageHeader";
import SegmentedControl from "@/components/shared/SegmentedControl";
import KpiTile from "@/components/shared/KpiTile";
import StatusPill from "@/components/shared/StatusPill";
import TrendChart from "@/components/shared/TrendChart";
import { EmptyState } from "@/components/shared/DataState";
import { useRecommendations } from "@/components/recommendations/RecommendationsProvider";
import HallBarChart from "./HallBarChart";
export default function HomeDashboard() {
  const { params, setQuery } = useQueryState();
  const range: Range = ["today", "yesterday", "week"].includes(
    params.get("range") ?? "",
  )
    ? (params.get("range") as Range)
    : "today";
  const meal: OverviewMeal = ["all", "breakfast", "lunch", "dinner"].includes(
    params.get("meal") ?? "",
  )
    ? (params.get("meal") as OverviewMeal)
    : "all";
  const services = servicesForRange(range, meal),
    total = totals(services),
    halls = summarizeHalls(services),
    previous = totals(servicesForRange(range, meal, -7));
  const { pending, ready } = useRecommendations();
  const days = datesForRange(range);
  const period =
    range === "today"
      ? "today"
      : range === "yesterday"
        ? "yesterday"
        : "this week";
  const change = previous.wasteLbs
    ? ((total.wasteLbs - previous.wasteLbs) / previous.wasteLbs) * 100
    : null;
  const ranked = services
    .flatMap((service) => service.items.map((item) => ({ service, item })))
    .sort((a, b) => b.item.remainingPct - a.item.remainingPct);
  const attention = ranked
    .filter(
      (r, i, a) =>
        a.findIndex(
          (x) =>
            x.service.hallId === r.service.hallId && x.item.id === r.item.id,
        ) === i && r.item.remainingPct > THRESHOLDS.remaining.monitor,
    )
    .slice(0, 5);
  const referenceDate = days[days.length - 1];
  return (
    <div className="space-y-6">
      <PageHeader
        title={`University Overview · ${range === "week" ? `${dateLabel(days[0])}–${dateLabel(referenceDate)}` : `${range === "today" ? "Today" : "Yesterday"}, ${dateLabel(referenceDate)}`}`}
        description="Compare dining halls, investigate high-waste items, and review production opportunities."
      />
      <div className="flex flex-wrap gap-6">
        <SegmentedControl
          label="Date range"
          value={range}
          onChange={(v) => setQuery({ range: v })}
          options={[
            { value: "today", label: "Today" },
            { value: "yesterday", label: "Yesterday" },
            { value: "week", label: "This week" },
          ]}
        />
        <SegmentedControl
          label="Meal"
          value={meal}
          onChange={(v) => setQuery({ meal: v })}
          options={[
            { value: "all", label: "All" },
            { value: "breakfast", label: "Breakfast" },
            { value: "lunch", label: "Lunch" },
            { value: "dinner", label: "Dinner" },
          ]}
        />
      </div>
      <p className="muted">
        {range === "week"
          ? "This week = trailing 7 days ending on the demo date. "
          : ""}
        All includes weekend Brunch. Today means the fixed October 3 demo date.{" "}
        {range !== "today"
          ? "Historical values are deterministic illustrative data."
          : ""}
      </p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiTile
          label="Total waste"
          value={total.mealsServed ? lbs(total.wasteLbs) : "No data yet"}
          detail={`${period} · ${halls.filter((h) => h.wasteLbs !== null).length} reporting halls`}
        />
        <KpiTile
          label="Total waste cost"
          value={
            total.mealsServed
              ? currency(total.wasteCost, period, 2)
              : "No data yet"
          }
          detail="Food cost only · simulated"
          tone="warning"
        />
        <KpiTile
          label="Change vs. last week"
          value={
            change !== null && total.mealsServed
              ? `${change <= 0 ? "↓" : "↑"} ${percent(Math.abs(change))}`
              : "No comparison"
          }
          detail="Total lbs · same period, 7 days earlier"
          tone={change !== null && change <= 0 ? "good" : "warning"}
        />
        <KpiTile
          label="Savings opportunity"
          value={
            total.mealsServed
              ? currency(
                  (total.wasteCost / days.length) * OPERATING_DAYS * 0.15,
                  "per year",
                )
              : "No data yet"
          }
          detail="Illustrative · daily average × 290 days × 15%"
          tone="good"
        />
        <KpiTile
          label="Open recommendations"
          value={ready ? pending.length : "…"}
          detail={
            <Link
              href="/recommendations"
              className="inline-flex min-h-10 items-center font-semibold text-navy underline"
            >
              Review pending →
            </Link>
          }
        />
      </div>
      <HallBarChart halls={halls} services={services} />
      <section className="panel p-5" aria-label="Items needing attention">
        <h2 className="section-title">Needs attention</h2>
        <p className="muted mt-1">
          Highest remaining portions across the selected services.
        </p>
        {attention.length ? (
          <ul className="mt-4 divide-y divide-slate-100">
            {attention.map(({ service, item }) => (
              <li
                key={`${service.hallId}-${item.id}`}
                className="flex flex-wrap items-center justify-between gap-3 py-4"
              >
                <div>
                  <Link
                    className="inline-flex min-h-10 items-center font-semibold text-navy underline decoration-slate-300 underline-offset-4"
                    href={foodLink(service, item.id)}
                  >
                    {item.name} →
                  </Link>
                  <p className="muted">
                    {halls.find((h) => h.hall.id === service.hallId)?.hall.name}{" "}
                    · {dateLabel(service.date)} · {service.meal}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold">
                    {percent(item.remainingPct)} remaining
                  </span>
                  <StatusPill status={statusFor(item.remainingPct)} />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-4">
            <EmptyState title="No high-waste items in this selection" />
          </div>
        )}
      </section>
      {total.mealsServed ? (
        <TrendChart
          title={`University waste · 28 days ending ${dateLabel(referenceDate)}`}
          data={universityTrend(referenceDate, meal)}
          average
        />
      ) : (
        <EmptyState title="No trend for this selection" />
      )}
      <section aria-label="Hall summaries">
        <h2 className="section-title mb-4">Dining halls · {period}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {halls.map((h) => {
            const s = services.find(
              (s) => s.hallId === h.hall.id && s.items.length,
            ) ?? {
              hallId: h.hall.id,
              date: referenceDate,
              meal: "brunch" as const,
            };
            return (
              <Link
                key={h.hall.id}
                href={foodLink(s, h.topItem?.id)}
                className="panel block p-5 transition hover:border-slate-400 hover:shadow-md"
                aria-label={`${h.hall.name}, ${h.wasteLbs === null ? "No data yet" : lbs(h.wasteLbs) + " wasted " + period}. Open Food Data.`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold">{h.hall.name}</h3>
                  <StatusPill
                    status={
                      h.wastePerMeal === null
                        ? null
                        : statusFor(h.wastePerMeal, "perMeal")
                    }
                  />
                </div>
                <p className="mt-4 text-2xl font-semibold text-navy">
                  {h.wasteLbs === null ? "No data yet" : lbs(h.wasteLbs)}
                </p>
                <p className="muted mt-2">
                  {h.topItem
                    ? `Top remaining item: ${h.topItem.name} · ${percent(h.topItem.remainingPct)}`
                    : h.hall.reporting
                      ? "No service for the selected meal."
                      : "Closed / non-reporting in this demo."}
                </p>
                <p className="mt-4 text-sm font-semibold text-navy">
                  Open Food Data →
                </p>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
