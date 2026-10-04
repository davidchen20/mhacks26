"use client";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { currency } from "@/lib/format";
import { EmptyState } from "@/components/shared/DataState";
export interface BreakdownRow {
  name: string;
  value: number;
  annual: number;
}
export default function BreakdownChart({ rows }: { rows: BreakdownRow[] }) {
  if (!rows.length) return <EmptyState title="No costs available" />;
  return (
    <>
      <div
        className="h-72"
        role="img"
        aria-label="Waste cost by selected grouping, US dollars for selection. Exact values in the accessible table and sortable table below."
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={rows}
            layout="vertical"
            accessibilityLayer
            margin={{ left: 0, right: 30, top: 15, bottom: 5 }}
          >
            <CartesianGrid horizontal={false} strokeDasharray="3 3" />
            <XAxis
              type="number"
              tickFormatter={(v) => String(v)}
              label={{
                value: "USD for selection",
                position: "insideBottom",
                offset: -3,
                fill: "#475569",
                fontSize: 13,
              }}
            />
            <YAxis dataKey="name" type="category" width={125} />
            <Tooltip
              formatter={(v) => currency(Number(v), "for selection", 2)}
            />
            <Bar
              dataKey="value"
              name="Waste cost for selection"
              fill="#00274c"
              radius={[0, 5, 5, 0]}
              maxBarSize={26}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>Waste cost breakdown</caption>
        <thead>
          <tr>
            <th scope="col">Group</th>
            <th scope="col">Cost for selection</th>
            <th scope="col">Illustrative annual cost</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name}>
              <th scope="row">{r.name}</th>
              <td>{currency(r.value, "for selection", 2)}</td>
              <td>{currency(r.annual, "per year", 2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
