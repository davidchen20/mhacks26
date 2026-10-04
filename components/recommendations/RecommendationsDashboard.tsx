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
import { useDemoServices } from "@/lib/useDemoServices";
import { DEMO_HALL_ID, DEMO_MEALS, selectDemoServices } from "@/lib/demoData";
export default function RecommendationsDashboard() {
  const scope = useScope();
  const { date, hall, meal } = scope;
  const { pending, ready, storageAvailable, create, recommendations, syncDemo } =
    useRecommendations();
  const [selected, setSelected] = useState<Recommendation | null>(null);
  const isDemo = hall === DEMO_HALL_ID;
  const live = useDemoServices(isDemo, date, date);
  const services = isDemo ? selectDemoServices(live.services, [date], meal) : servicesForDay(date, hall, meal);
  const available = totals(services).hasData;
  const candidates = recommendationsForServices(services);
  const candidateKey = isDemo ? JSON.stringify(candidates) : candidates.map((r) => r.id).join("|");
  const demoScope = JSON.stringify((meal === "all" ? DEMO_MEALS.filter((m) => m !== "all") : [meal]).map((m) => `${date}|${m}`));
  const knownKey = recommendations.map((r) => r.id).join("|");
  useEffect(() => {
    if (isDemo) {
      if (ready && live.loaded) syncDemo(candidates, JSON.parse(demoScope), services);
      return;
    }
    if (ready)
      candidates
        .filter((r) => !recommendations.some((x) => x.id === r.id))
        .forEach(create);
  }, [ready, candidateKey, knownKey, isDemo, live.loaded, demoScope, syncDemo]); // eslint-disable-line react-hooks/exhaustive-deps
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
      {isDemo && <p role="status" className="muted">{live.error ? `${live.error}. ${live.loaded ? "Showing last successful data." : ""}` : live.loading ? "Loading SpacetimeDB captures…" : "SpacetimeDB · polling every 2 seconds · captured portions only"}</p>}
      {date > getToday() ? (
        <EmptyState title="No data for future dates" />
      ) : !available ? (
        <EmptyState title={isDemo ? "No captured demo observations for this selection" : "Unavailable: menu not published or scrape failed"} />
      ) : (
        <>
          <SourceNotice services={services} />
          <p className="muted">
            {isDemo ? "Recommendations use captured SpacetimeDB observations with mocked inference. Manager review required; no medical claims." : "AI-generated mock insights, manager review required, no medical claims."}
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
                    {isDemo ? "Highest captured tray waste first · Manager review required" : "Highest simulated waste first · Manager review required"}
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
            recommendation={isDemo ? recommendations.find((r) => r.id === selected.id) ?? selected : selected}
            onClose={() => setSelected(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
