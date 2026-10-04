"use client";
import WasteCostSplit from "@/components/shared/WasteCostSplit";
import Link from "next/link";
import { useState } from "react";
import {
  OPERATING_DAYS,
  financeBreakdown,
  costTrend,
  foodLink,
  servicesForDay,
  totals,
  getToday,
  hallName,
} from "@/lib/mockData";
import { currency, percent, dateLabel, lbs, title } from "@/lib/format";
import { portionLabel, COST_PER_LB } from "@/lib/foodWeights";
import PageHeader from "@/components/shared/PageHeader";
import KpiTile from "@/components/shared/KpiTile";
import SegmentedControl from "@/components/shared/SegmentedControl";
import DataTable from "@/components/shared/DataTable";
import TrendChart from "@/components/shared/TrendChart";
import SourceNotice from "@/components/shared/SourceNotice";
import ScopeControls, { useScope } from "@/components/shared/ScopeControls";
import { EmptyState } from "@/components/shared/DataState";
import BreakdownChart from "./BreakdownChart";
export default function FinanceDashboard() {
  const scope = useScope();
  const { date, hall, meal } = scope;
  const [group, setGroup] = useState<"category" | "hall">("category");
  const [reduction, setReduction] = useState<"5" | "10" | "15" | "20">("15");
  const services = servicesForDay(date, hall, meal),
    total = totals(services);
  const annual = total.wasteCost * OPERATING_DAYS;
  const rows = financeBreakdown(group, services).sort(
    (a, b) => b.value - a.value,
  );
  const evidence = services
    .flatMap((service) => service.items.map((item) => ({ service, item })))
    .sort((a, b) => b.item.wasteCost - a.item.wasteCost)[0];
  return (
    <div className="space-y-6">
      <PageHeader
        title={`Finances · ${dateLabel(date)}`}
        description="Translate simulated food waste into a budget estimate and compare savings scenarios."
      />
      <ScopeControls scope={scope} />
      {date > getToday() ? (
        <EmptyState title="No data for future dates" />
      ) : !total.hasData ? (
        <EmptyState title="Unavailable: menu not published or scrape failed" />
      ) : (
        <>
          <SourceNotice services={services} />
          <div className="grid gap-4 lg:grid-cols-2">
            <KpiTile
              label="Current Waste Trajectory"
              value={currency(annual, "per year")}
              detail={
                <>
                  <p>
                    Formula:{" "}
                    {currency(total.wasteCost, "for selected services", 2)} ×{" "}
                    {OPERATING_DAYS} equivalent operating days.
                  </p>
                  <p className="mt-2">
                    Illustrative projection of this selection, not a forecast.
                    Food cost only.
                  </p>
                </>
              }
              tone="warning"
            />
            <KpiTile
              label={`Target Savings · ${reduction}% reduction`}
              value={currency((annual * Number(reduction)) / 100, "per year")}
              detail={`Illustrative annual trajectory × ${reduction}%. Realized savings depend on portions, demand and purchasing.`}
              tone="good"
            />
          </div>
          <WasteCostSplit plate={total.plateWasteDollars} kitchen={total.unservedOverproductionDollars} plateLbs={total.plateWasteLbs} kitchenLbs={total.unservedLbs} />
          <div className="panel p-5">
            <SegmentedControl
              label="Savings scenario · reduction in waste cost"
              value={reduction}
              onChange={setReduction}
              options={(["5", "10", "15", "20"] as const).map((value) => ({
                value,
                label: `${value}%`,
              }))}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <KpiTile
              label="Waste cost per meal served"
              value={currency(
                total.wasteCost / total.mealsServed,
                "per meal served",
                3,
              )}
              detail={`${currency(total.wasteCost, "selected services", 2)} ÷ ${total.mealsServed} simulated meals served`}
            />
            {evidence && (
              <section
                className="panel p-5"
                aria-label="Highest item cost evidence"
              >
                <p className="muted">
                  Item evidence · {hallName(evidence.service.hallId)} ·{" "}
                  {title(evidence.service.meal)}
                </p>
                <h2 className="mt-3 text-xl font-semibold">
                  {evidence.item.name}
                </h2>
                <p className="muted mt-2">{portionLabel(evidence.item)}</p>
                <p className="mt-2">
                  {lbs(evidence.item.wasteLbs)} wasted ·{" "}
                  {currency(evidence.item.wasteCost, "per service", 2)}
                </p>
                <Link
                  className="mt-3 inline-flex min-h-10 items-center font-semibold text-navy underline"
                  href={foodLink(evidence.service, evidence.item.id)}
                >
                  Inspect supporting Food Data →
                </Link>
              </section>
            )}
          </div>
          <section
            className="panel overflow-hidden"
            aria-label="Waste cost breakdown"
          >
            <div className="p-5">
              <div className="flex flex-wrap justify-between gap-4">
                <div>
                  <h2 className="section-title">
                    Where waste costs accumulate
                  </h2>
                  <p className="muted mt-1">
                    Available services only · same calculations as Home and
                    Food.
                  </p>
                </div>
                <SegmentedControl
                  label="Breakdown"
                  value={group}
                  onChange={setGroup}
                  options={[
                    { value: "category", label: "Food category" },
                    { value: "hall", label: "Dining hall" },
                  ]}
                />
              </div>
              <BreakdownChart rows={rows} />
            </div>
            <DataTable
              key={group}
              caption="Waste cost breakdown"
              rows={rows}
              rowKey={(r) => r.name}
              initialSort="cost"
              columns={[
                {
                  key: "name",
                  label: group === "category" ? "Category" : "Dining hall",
                  value: (r) => r.name,
                },
                {
                  key: "cost",
                  label: "Selected service cost",
                  value: (r) => r.value,
                  render: (r) => currency(r.value, "for selected services", 2),
                },
                {
                  key: "share",
                  label: "Share of cost",
                  value: (r) =>
                    total.wasteCost ? r.value / total.wasteCost : 0,
                  render: (r) =>
                    percent(
                      total.wasteCost ? (r.value / total.wasteCost) * 100 : 0,
                    ),
                },
                {
                  key: "annual",
                  label: "Illustrative annual cost",
                  value: (r) => r.annual,
                  render: (r) => currency(r.annual, "per year", 2),
                },
              ]}
            />
            <p className="muted border-t border-slate-200 p-5">
              Total: {currency(total.wasteCost, "selected services", 2)}.
              Illustrative costs per lb:{" "}
              {Object.entries(COST_PER_LB)
                .map(([c, v]) => `${c} $${v.toFixed(2)}`)
                .join(" · ")}
              . Unavailable services are excluded.
            </p>
          </section>
          <p className="muted">
            Includes illustrative data in historical trend points.
          </p>
          <TrendChart
            title="Waste cost per meal served · last 12 weeks"
            data={costTrend(date, hall, meal)}
            unit="cost"
          />
        </>
      )}
    </div>
  );
}
