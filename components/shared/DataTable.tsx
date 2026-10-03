"use client";
import { useState, type ReactNode } from "react";
import { EmptyState } from "./DataState";
export interface Column<T> {
  key: string;
  label: string;
  value: (row: T) => string | number;
  render?: (row: T) => ReactNode;
}
export default function DataTable<T>({
  caption,
  rows,
  columns,
  rowKey,
  initialSort,
  selectedId,
}: {
  caption: string;
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  initialSort?: string;
  selectedId?: string;
}) {
  const [sort, setSort] = useState({
    key: initialSort ?? columns[0]?.key,
    desc: !!initialSort,
  });
  if (!rows.length)
    return <EmptyState title={`No ${caption.toLowerCase()} available`} />;
  const col = columns.find((c) => c.key === sort.key);
  const sorted = [...rows].sort((a, b) => {
    if (!col) return 0;
    const x = col.value(a),
      y = col.value(b);
    const cmp =
      typeof x === "number" && typeof y === "number"
        ? x - y
        : String(x).localeCompare(String(y));
    return sort.desc ? -cmp : cmp;
  });
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">
          {caption}. Activate column headings to sort.
        </caption>
        <thead className="border-b border-slate-200 bg-slate-50">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                aria-sort={
                  sort.key === c.key
                    ? sort.desc
                      ? "descending"
                      : "ascending"
                    : "none"
                }
                className="px-4 py-2"
              >
                <button
                  className="min-h-10 whitespace-nowrap text-left font-semibold"
                  onClick={() =>
                    setSort((s) => ({
                      key: c.key,
                      desc: s.key === c.key ? !s.desc : false,
                    }))
                  }
                >
                  {c.label}{" "}
                  <span aria-hidden="true">
                    {sort.key === c.key ? (sort.desc ? "↓" : "↑") : "↕"}
                  </span>
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {sorted.map((row) => (
            <tr
              key={rowKey(row)}
              id={`item-${rowKey(row)}`}
              className={
                rowKey(row) === selectedId
                  ? "bg-amber-50 outline-2 -outline-offset-2 outline-amber-600"
                  : ""
              }
            >
              {columns.map((c) => (
                <td key={c.key} className="px-4 py-4 align-middle">
                  {c.render ? c.render(row) : c.value(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
