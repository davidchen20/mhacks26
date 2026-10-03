"use client";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import type { TrendPoint } from "@/lib/mockData";
import { dateLabel, currency, lbs } from "@/lib/format";
import { EmptyState } from "./DataState";
export default function TrendChart({
  data,
  title,
  unit = "lbs",
  average = false,
}: {
  data: TrendPoint[];
  title: string;
  unit?: "lbs" | "cost";
  average?: boolean;
}) {
  if (!data.length || data.every((d) => d.value === null))
    return <EmptyState title="No trend data yet" />;
  const fmt = (n: number) =>
    unit === "cost" ? currency(n, "per meal served (week shown)", 3) : lbs(n);
  return (
    <section className="panel p-5" aria-label={title}>
      <h2 className="section-title">{title}</h2>
      <p className="muted mt-1">
        {unit === "cost"
          ? "Weekly waste cost divided by meals served · illustrative"
          : "Daily university waste · solid navy line"}
        {average
          ? " · dashed green: 7-day moving average over reporting days"
          : ""}
      </p>
      <div
        role="img"
        aria-label={`${title}. Exact values available in the following accessible table.`}
        className="mt-5 h-64"
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 10, right: 14, left: 4, bottom: 5 }}
            accessibilityLayer
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" tickFormatter={dateLabel} minTickGap={32} />
            <YAxis
              width={65}
              tickFormatter={(n) =>
                unit === "cost" ? `${Number(n).toFixed(3)}` : String(n)
              }
            />
            <Tooltip
              labelFormatter={(v) => dateLabel(String(v))}
              formatter={(v) => fmt(Number(v))}
            />
            <Line
              type="monotone"
              name={
                unit === "cost" ? "Waste cost per meal served" : "Daily waste"
              }
              dataKey="value"
              stroke="#00274c"
              strokeWidth={2.5}
              dot={false}
              isAnimationActive={false}
            />
            {average && (
              <Line
                type="monotone"
                name="7-day moving average"
                dataKey="movingAverage"
                stroke="#047857"
                strokeWidth={2}
                strokeDasharray="6 4"
                dot={false}
                isAnimationActive={false}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">
              {unit === "cost" ? "Waste cost per meal served" : "Waste (lbs)"}
            </th>
            {average && <th scope="col">7-day average (lbs)</th>}
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.date}>
              <th scope="row">{d.date}</th>
              <td>{d.value === null ? "No data yet" : fmt(d.value)}</td>
              {average && (
                <td>
                  {d.movingAverage == null
                    ? "Unavailable"
                    : lbs(d.movingAverage)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
