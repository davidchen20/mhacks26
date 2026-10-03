"use client";
import Link from "next/link";
import { foodLink, hallName, type Recommendation } from "@/lib/mockData";
import { currency, percent, dateLabel, title } from "@/lib/format";
import { statusFor } from "@/lib/status";
import StatusPill from "@/components/shared/StatusPill";
export default function RecommendationCard({
  recommendation: r,
  onReview,
}: {
  recommendation: Recommendation;
  onReview: () => void;
}) {
  return (
    <article
      className="panel p-5"
      aria-label={`${r.itemName} recommendation for ${hallName(r.hallId)}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="muted">
          {hallName(r.hallId)} · {dateLabel(r.date)} · {title(r.meal)}
        </p>
        <StatusPill status={statusFor(r.remainingPct)} />
      </div>
      <h3 className="mt-4 text-xl font-semibold leading-snug text-navy">
        {r.title}
      </h3>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-slate-600">Observed portion remaining</dt>
          <dd className="font-semibold">
            {percent(r.remainingPct)} · simulated
          </dd>
        </div>
        <div>
          <dt className="text-slate-600">
            {r.origin === "nutrition"
              ? "Expected relative waste reduction"
              : "Suggested production reduction"}
          </dt>
          <dd className="font-semibold">
            {r.reductionRange[0]}–{r.reductionRange[1]}% · illustrative
          </dd>
        </div>
      </dl>
      <p className="muted mt-3">
        Waste cost: {currency(r.wasteCost, "per service", 2)} ·{" "}
        {r.origin === "nutrition"
          ? "Nutrition insight"
          : "Production adjustment"}
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button className="btn btn-primary" onClick={onReview}>
          Review recommendation
        </button>
        <Link
          className="inline-flex min-h-10 items-center text-sm font-semibold text-navy underline"
          href={foodLink(r, r.itemId)}
        >
          View supporting item →
        </Link>
      </div>
    </article>
  );
}
