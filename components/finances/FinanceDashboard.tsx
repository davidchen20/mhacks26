"use client";
import Link from "next/link";
import { useState } from "react";
import {
  ANNUAL_WASTE,
  TODAY_TOTALS,
  OPERATING_DAYS,
  financeBreakdown,
  costTrend,
  getService,
  DEMO_DATE,
  foodLink,
} from "@/lib/mockData";
import { currency, percent } from "@/lib/format";
import PageHeader from "@/components/shared/PageHeader";
import KpiTile from "@/components/shared/KpiTile";
import SegmentedControl from "@/components/shared/SegmentedControl";
import DataTable from "@/components/shared/DataTable";
import TrendChart from "@/components/shared/TrendChart";
import BreakdownChart from "./BreakdownChart";
export default function FinanceDashboard() {
  const [group, setGroup] = useState<"category" | "hall">("category");
  const [reduction, setReduction] = useState<"5" | "10" | "15" | "20">("15");
  const rows = financeBreakdown(group).sort((a, b) => b.value - a.value);
  const service = getService("south-quad", DEMO_DATE, "brunch");
  const broccoli = service.items.find((i) => i.id === "broccoli")!;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Finances · Today, Oct 3"
        description="Translate simulated food waste into a budget estimate and compare savings scenarios."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <KpiTile
          label="Current Waste Trajectory"
          value={currency(ANNUAL_WASTE, "per year")}
          detail={
            <>
              <p>
                Formula: {currency(TODAY_TOTALS.wasteCost, "today", 2)} ×{" "}
                {OPERATING_DAYS} equivalent operating days per year.
              </p>
              <p className="mt-2">
                Illustrative projection; assumes this daily cost repeats. Food
                cost only, excluding labor and disposal.
              </p>
            </>
          }
          tone="warning"
        />
        <KpiTile
          label={`Target Savings · ${reduction}% reduction`}
          value={currency((ANNUAL_WASTE * Number(reduction)) / 100, "per year")}
          detail={
            <>
              <p>
                Formula: {currency(ANNUAL_WASTE, "per year")} × {reduction}%.
              </p>
              <p className="mt-2">
                Illustrative projection; realized savings depend on demand,
                portions and purchasing.
              </p>
            </>
          }
          tone="good"
        />
      </div>
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
        <p className="muted mt-3" aria-live="polite">
          Selected scenario:{" "}
          {currency((ANNUAL_WASTE * Number(reduction)) / 100, "per year")}{" "}
          potential savings, illustrative.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <KpiTile
          label="Waste cost per meal served"
          value={currency(
            TODAY_TOTALS.wasteCost / TODAY_TOTALS.mealsServed,
            "per meal served",
            3,
          )}
          detail={
            <>
              Today: {currency(TODAY_TOTALS.wasteCost, "today", 2)} ÷{" "}
              {TODAY_TOTALS.mealsServed.toLocaleString("en-US")} meals served.
            </>
          }
        />
        <section className="panel p-5" aria-label="Broccoli cost evidence">
          <p className="text-sm font-medium text-slate-600">
            Item evidence · South Quad Brunch
          </p>
          <h2 className="mt-3 text-xl font-semibold">{broccoli.name}</h2>
          <p className="mt-2">
            {percent(broccoli.remainingPct)} remaining ·{" "}
            <strong>{currency(broccoli.wasteCost, "per service", 2)}</strong>
          </p>
          <Link
            className="mt-3 inline-flex min-h-10 items-center font-semibold text-navy underline"
            href={foodLink(service, broccoli.id)}
          >
            Inspect supporting Food Data →
          </Link>
        </section>
      </div>
      <section
        className="panel overflow-hidden"
        aria-label="Waste cost breakdown"
      >
        <div className="p-5">
          <div className="flex flex-wrap justify-between gap-4">
            <div>
              <h2 className="section-title">Where waste costs accumulate</h2>
              <p className="muted mt-1">
                Reporting halls only · totals agree with Home.
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
              label: "Waste cost today",
              value: (r) => r.value,
              render: (r) => currency(r.value, "today", 2),
            },
            {
              key: "share",
              label: "Share of cost",
              value: (r) => r.value / TODAY_TOTALS.wasteCost,
              render: (r) => percent((r.value / TODAY_TOTALS.wasteCost) * 100),
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
          Total: {currency(TODAY_TOTALS.wasteCost, "today", 2)} ·{" "}
          {currency(ANNUAL_WASTE, "per year")} illustrative. Twigs is
          non-reporting and excluded, not counted as zero.
        </p>
      </section>
      <TrendChart
        title="Waste cost per meal served · last 12 weeks"
        data={costTrend()}
        unit="cost"
      />
    </div>
  );
}
