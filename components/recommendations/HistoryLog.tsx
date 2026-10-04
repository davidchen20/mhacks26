"use client";
import { useState } from "react";
import { hallName } from "@/lib/mockData";
import { timestamp } from "@/lib/format";
import { useRecommendations } from "./RecommendationsProvider";
import SegmentedControl from "@/components/shared/SegmentedControl";
import DataTable from "@/components/shared/DataTable";
export default function HistoryLog() {
  const { history, reopen } = useRecommendations();
  const [filter, setFilter] = useState<"All" | "Accepted" | "Dismissed">("All");
  const rows = history.filter((h) => filter === "All" || h.decision === filter);
  return (
    <section
      className="panel overflow-hidden"
      aria-label="Recommendation decision history"
    >
      <div className="p-5">
        <h2 className="section-title">Decision history</h2>
        <p className="muted mt-1 mb-4">
          Accepted and dismissed actions stay in this log after reopening.
        </p>
        <SegmentedControl
          label="Filter history"
          value={filter}
          onChange={setFilter}
          options={(["All", "Accepted", "Dismissed"] as const).map((value) => ({
            value,
            label: value,
          }))}
        />
      </div>
      <DataTable
        caption="Recommendation history"
        rows={rows}
        rowKey={(h) => h.id}
        initialSort="time"
        columns={[
          {
            key: "time",
            label: "Timestamp",
            value: (h) => h.timestamp,
            render: (h) => (
              <time dateTime={h.timestamp}>{timestamp(h.timestamp)}</time>
            ),
          },
          {
            key: "hall",
            label: "Hall",
            value: (h) => hallName(h.recommendation.hallId),
          },
          {
            key: "item",
            label: "Item",
            value: (h) => h.recommendation.itemName,
          },
          {
            key: "decision",
            label: "Decision",
            value: (h) => h.decision,
            render: (h) => (
              <span
                className={`font-semibold ${h.decision === "Accepted" ? "text-emerald-800" : "text-slate-700"}`}
              >
                {h.decision === "Accepted" ? "✓" : "—"} {h.decision}
              </span>
            ),
          },
          {
            key: "note",
            label: "Note",
            value: (h) => h.note,
            render: (h) => (
              <span className="block max-w-xs whitespace-pre-wrap break-words">
                {h.note || "No note"}
              </span>
            ),
          },
          {
            key: "action",
            label: "Review state",
            value: (h) => h.reopenedAt ?? "",
            render: (h) =>
              h.reopenedAt ? (
                <span className="text-[13px] text-slate-600">
                  Reopened {timestamp(h.reopenedAt)}
                </span>
              ) : (
                <button className="btn" onClick={() => reopen(h.id)}>
                  Reopen
                </button>
              ),
          },
        ]}
      />
    </section>
  );
}
