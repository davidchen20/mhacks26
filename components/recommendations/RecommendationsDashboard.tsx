"use client";
import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import {
  type Recommendation,
  servicesForDay,
  recommendationsForServices,
  totals,
  getToday,
} from "@/lib/mockData";
import { dateLabel } from "@/lib/format";
import PageHeader from "@/components/shared/PageHeader";
import { EmptyState, Skeleton } from "@/components/shared/DataState";
import ScopeControls, { useScope } from "@/components/shared/ScopeControls";
import SourceNotice from "@/components/shared/SourceNotice";
import { useRecommendations } from "./RecommendationsProvider";
import RecommendationCard from "./RecommendationCard";
import SlideOver from "./SlideOver";
import HistoryLog from "./HistoryLog";
import NutritionInsights from "./NutritionInsights";
export default function RecommendationsDashboard() {
  const scope = useScope();
  const { date, hall, meal } = scope;
  const { pending, ready, storageAvailable, create, recommendations } =
    useRecommendations();
  const [selected, setSelected] = useState<Recommendation | null>(null);
  const services = servicesForDay(date, hall, meal);
  const available = totals(services).hasData;
  const candidates = recommendationsForServices(services);
  const candidateKey = candidates.map((r) => r.id).join("|");
  const knownKey = recommendations.map((r) => r.id).join("|");
  useEffect(() => {
    if (ready)
      candidates
        .filter((r) => !recommendations.some((x) => x.id === r.id))
        .forEach(create);
  }, [ready, candidateKey, knownKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => setSelected(null), [date, hall, meal]);
  const scopedPending = pending.filter((r) =>
    services.some(
      (s) =>
        s.date === r.date &&
        s.hallId === r.hallId &&
        s.meal === r.meal &&
        s.items.some((i) => i.id === r.itemId),
    ),
  );
  return (
    <div className="space-y-8">
      <PageHeader
        title={`AI Recommendations · ${dateLabel(date)}`}
        description="Review evidence, record a decision, and explore nutrition-aware menu adjustments."
      />
      <ScopeControls scope={scope} />
      {date > getToday() ? (
        <EmptyState title="No data for future dates" />
      ) : !available ? (
        <EmptyState title="Unavailable: menu not published or scrape failed" />
      ) : (
        <>
          <SourceNotice services={services} />
          <p className="muted">
            AI-generated mock insights, manager review required, no medical
            claims.
          </p>
          {!storageAvailable && (
            <p
              role="status"
              className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
            >
              Browser storage is unavailable. Decisions may not survive a
              refresh.
            </p>
          )}
          {!ready ? (
            <Skeleton label="Loading saved recommendation decisions" />
          ) : (
            <>
              <section aria-label="Pending recommendations">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h2
                    data-review-heading
                    tabIndex={-1}
                    className="section-title"
                  >
                    Pending review{" "}
                    <span className="ml-2 rounded-full bg-amber-100 px-3 py-1 text-sm text-navy">
                      {scopedPending.length}
                    </span>
                  </h2>
                  <p className="muted">
                    Highest simulated waste first · Manager review required
                  </p>
                </div>
                {scopedPending.length ? (
                  <div className="grid gap-4 lg:grid-cols-2">
                    {[...scopedPending]
                      .sort((a, b) => b.wasteCost - a.wasteCost)
                      .map((r) => (
                        <RecommendationCard
                          key={r.id}
                          recommendation={r}
                          onReview={() => setSelected(r)}
                        />
                      ))}
                  </div>
                ) : (
                  <EmptyState title="All recommendations reviewed">
                    Create a nutrition recommendation below, or reopen a
                    decision in History.
                  </EmptyState>
                )}
              </section>
              <HistoryLog services={services} />
              <NutritionInsights services={services} />
            </>
          )}
        </>
      )}
      <AnimatePresence>
        {selected && date <= getToday() && available && (
          <SlideOver
            key={selected.id}
            recommendation={selected}
            onClose={() => setSelected(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
