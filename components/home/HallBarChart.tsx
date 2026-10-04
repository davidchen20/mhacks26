"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  Tooltip,
} from "recharts";
import {
  getToday,
  mealsForDate,
  foodLink,
  type HallSummary,
  type ServiceData,
} from "@/lib/mockData";
import { STATUS, statusFor, THRESHOLDS } from "@/lib/status";
import { lbs, number } from "@/lib/format";
import SegmentedControl from "@/components/shared/SegmentedControl";
import { EmptyState } from "@/components/shared/DataState";
export default function HallBarChart({
  halls,
  services,
}: {
  halls: HallSummary[];
  services: ServiceData[];
}) {
  const [mode, setMode] = useState<"rate" | "total">("rate");
  const router = useRouter();
  const link = (h: HallSummary) =>
    foodLink(
      services.find((s) => s.hallId === h.hall.id && s.items.length) ?? {
        hallId: h.hall.id,
        date: services[0]?.date ?? getToday(),
        meal: mealsForDate(services[0]?.date ?? getToday())[0],
      },
    );
  const data = halls.map((h) => ({
    name: h.hall.name + (h.wasteLbs === null ? " · No data yet" : ""),
    value: mode === "rate" ? h.wastePerMeal : h.wasteLbs,
    color:
      h.wastePerMeal === null
        ? "#cbd5e1"
        : STATUS[statusFor(h.wastePerMeal, "perMeal")].color,
    href: link(h),
  }));
  const totalMeals = halls.reduce((n, h) => n + (h.mealsServed ?? 0), 0);
  const reference =
    mode === "rate"
      ? THRESHOLDS.perMeal.onTrack
      : (THRESHOLDS.perMeal.onTrack * totalMeals) /
        Math.max(1, halls.filter((h) => h.mealsServed !== null).length);
  return (
    <section className="panel p-5" aria-label="Dining hall waste comparison">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="section-title">Waste by dining hall</h2>
          <p className="muted mt-1">
            Compare portions, not just hall size. Select a bar to inspect its
            menu.
          </p>
        </div>
        <SegmentedControl
          label="Compare halls by"
          value={mode}
          onChange={setMode}
          options={[
            { value: "rate", label: "Waste per meal served" },
            { value: "total", label: "Total waste (lbs)" },
          ]}
        />
      </div>
      {!totalMeals ? (
        <div className="mt-5">
          <EmptyState title="No reporting services for this selection">
            Unavailable: menu not published or scrape failed. Try another date
            or meal.
          </EmptyState>
        </div>
      ) : (
        <>
          <div
            role="img"
            aria-label={`Hall comparison in ${mode === "rate" ? "pounds per meal served" : "pounds"}. Unavailable halls have no values, not zero waste. Links and exact values follow.`}
            className="mt-5 h-[340px]"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={data}
                margin={{ left: 0, right: 22, top: 12, bottom: 15 }}
                accessibilityLayer
              >
                <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  tickFormatter={(v) =>
                    number(Number(v), mode === "rate" ? 3 : 1)
                  }
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={155}
                  tick={{ fontSize: 13 }}
                />
                <Tooltip
                  formatter={(v) =>
                    mode === "rate"
                      ? `${number(Number(v), 4)} lbs per meal served`
                      : lbs(Number(v))
                  }
                />
                <ReferenceLine
                  x={reference}
                  stroke="#475569"
                  strokeDasharray="5 4"
                />
                <Bar
                  dataKey="value"
                  name={mode === "rate" ? "Waste per meal served" : "Waste"}
                  radius={[0, 5, 5, 0]}
                  maxBarSize={24}
                  isAnimationActive={false}
                  onClick={(data) => {
                    if (data?.payload?.href)
                      router.push(String(data.payload.href));
                  }}
                  cursor="pointer"
                >
                  {data.map((d) => (
                    <Cell key={d.name} fill={d.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="muted">
            Dashed line:{" "}
            {mode === "rate"
              ? "target of 0.10 lbs per meal served"
              : "reference volume at 0.10 lbs × average reporting-hall meal count"}
            . Colors use waste per meal: {STATUS["on-track"].icon}{" "}
            {STATUS["on-track"].label} ≤{THRESHOLDS.perMeal.onTrack.toFixed(2)}{" "}
            · {STATUS.monitor.icon} {STATUS.monitor.label} ≤
            {THRESHOLDS.perMeal.monitor.toFixed(2)} · {STATUS.review.icon}{" "}
            {STATUS.review.label} &gt;{THRESHOLDS.perMeal.monitor.toFixed(2)}.
          </p>
        </>
      )}
      <div
        className="mt-4 flex flex-wrap gap-2"
        aria-label="Keyboard-accessible hall drill-down links"
      >
        {halls.map((h) => (
          <Link key={h.hall.id} href={link(h)} className="btn text-[13px]">
            {h.hall.name}
            {h.wasteLbs === null ? " · No data yet" : " →"}
          </Link>
        ))}
      </div>
      <table className="sr-only">
        <caption>Hall waste comparison. No data is not zero.</caption>
        <thead>
          <tr>
            <th>Hall</th>
            <th>Waste lbs</th>
            <th>Meals served</th>
            <th>lbs per meal served</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {halls.map((h) => (
            <tr key={h.hall.id}>
              <th scope="row">{h.hall.name}</th>
              <td>{h.wasteLbs ?? "No data yet"}</td>
              <td>{h.mealsServed ?? "No data yet"}</td>
              <td>
                {h.wastePerMeal === null
                  ? "No data yet"
                  : number(h.wastePerMeal, 4)}
              </td>
              <td>
                {h.wastePerMeal === null
                  ? "No data yet"
                  : STATUS[statusFor(h.wastePerMeal, "perMeal")].label}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
