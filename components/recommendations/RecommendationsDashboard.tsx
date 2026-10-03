"use client";
import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import type { Recommendation } from "@/lib/mockData";
import PageHeader from "@/components/shared/PageHeader";
import { EmptyState, Skeleton } from "@/components/shared/DataState";
import { useRecommendations } from "./RecommendationsProvider";
import RecommendationCard from "./RecommendationCard";
import SlideOver from "./SlideOver";
import HistoryLog from "./HistoryLog";
import NutritionInsights from "./NutritionInsights";
export default function RecommendationsDashboard() {
  const { pending, ready, storageAvailable } = useRecommendations();
  const [selected, setSelected] = useState<Recommendation | null>(null);
  return (
    <div className="space-y-8">
      <PageHeader
        title="AI Recommendations · Today, Oct 3"
        description="Review evidence, record a decision, and explore nutrition-aware menu adjustments."
      />
      {!storageAvailable && (
        <p
          role="status"
          className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
        >
          Browser storage is unavailable. Decisions remain available while this
          app is open, but may not survive a refresh.
        </p>
      )}
      {!ready ? (
        <Skeleton label="Loading saved recommendation decisions" />
      ) : (
        <>
          <section aria-label="Pending recommendations">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 data-review-heading tabIndex={-1} className="section-title">
                Pending review{" "}
                <span className="ml-2 rounded-full bg-amber-100 px-3 py-1 text-sm text-navy">
                  {pending.length}
                </span>
              </h2>
              <p className="muted">
                Highest observed waste first · Demo actions only
              </p>
            </div>
            {pending.length ? (
              <div className="grid gap-4 lg:grid-cols-2">
                {[...pending]
                  .sort((a, b) => b.remainingPct - a.remainingPct)
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
                Create a nutrition recommendation below, or reopen a decision in
                History.
              </EmptyState>
            )}
          </section>
          <HistoryLog />
          <NutritionInsights />
        </>
      )}
      <AnimatePresence>
        {selected && (
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
