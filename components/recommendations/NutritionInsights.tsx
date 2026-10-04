"use client";
import { useState } from "react";
import { type ServiceData, hallName, makeRecommendation } from "@/lib/mockData";
import { THRESHOLDS } from "@/lib/status";
import { portionLabel } from "@/lib/foodWeights";
import { number, percent, title } from "@/lib/format";
import { useRecommendations } from "./RecommendationsProvider";
import { EmptyState } from "@/components/shared/DataState";
export default function NutritionInsights({
  services,
}: {
  services: ServiceData[];
}) {
  const { create, recommendations } = useRecommendations();
  const [message, setMessage] = useState("");
  const insights = services
    .flatMap((service) =>
      service.items
        .filter(
          (item) =>
            item.nutrition.nutrientDensity !== "unknown" &&
            item.remainingPct > THRESHOLDS.remaining.monitor,
        )
        .map((item) => ({
          service,
          item,
          score: item.remainingPct * item.nutrition.densityScore,
        })),
    )
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
  return (
    <section aria-label="Nutrition and waste insights">
      <div className="mb-4 rounded-2xl bg-navy p-6 text-white">
        <p className="text-[13px] font-semibold uppercase tracking-widest text-maize">
          ✦ Nutrition + Waste Insights
        </p>
        <h2 className="mt-2 text-2xl font-semibold">
          Nutritious food that comes back
        </h2>
        <p className="mt-3 text-sm text-slate-200">
          AI-generated mock insights, manager review required, no medical
          claims. Ranked by simulated waste % × densityScore, an operational
          proxy derived from fiber, protein and calories. Historical nutrition
          is illustrative; today uses published nutrition.
        </p>
      </div>
      <p role="status" className="mb-3 text-sm font-semibold text-emerald-800">
        {message}
      </p>
      {!insights.length ? (
        <EmptyState title="No high-waste nutritious items" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {insights.map(({ service, item, score }) => {
            const rec = makeRecommendation(service, item, "nutrition");
            const exists = recommendations.some((r) => r.id === rec.id);
            return (
              <article
                key={rec.id}
                className="panel p-5"
                aria-label={`Nutrition insight for ${item.name} at ${hallName(service.hallId)}`}
              >
                <p className="muted">
                  {hallName(service.hallId)} · {title(service.meal)} · Ranking
                  score {number(score, 1)}
                </p>
                <h3 className="mt-3 text-lg font-semibold text-rose-800">
                  ! Simulated high waste · {percent(item.remainingPct)} of{" "}
                  {item.name} remains uneaten
                </h3>
                <p className="mt-3 text-sm">
                  <strong>Estimated nutrition impact:</strong>{" "}
                  {number(
                    ((item.nutrition.fiberGrams ?? 0) * item.remainingPct) /
                      100,
                    1,
                  )}{" "}
                  g of the modeled {item.nutrition.fiberGrams} g fiber per
                  serving remains on the tray, assuming waste is uniform. Actual
                  consumption is unknown.
                </p>
                <p className="muted mt-2">
                  Per-serving nutrition (
                  {service.menuSource === "mdining"
                    ? "M Dining"
                    : "illustrative"}
                  ): {item.nutrition.fiberGrams} g fiber ·{" "}
                  {item.nutrition.proteinGrams} g protein ·{" "}
                  {item.nutrition.calories} calories · Density proxy (
                  {item.nutrition.densityScore}/5).
                </p>
                <p className="muted mt-2">{portionLabel(item)}</p>
                <p className="mt-4 text-sm">
                  <strong>Culinary suggestion:</strong>{" "}
                  {item.culinarySuggestion}.
                </p>
                <p className="mt-2 text-sm">
                  <strong>Expected relative waste reduction:</strong>{" "}
                  {item.reductionRange[0]}–{item.reductionRange[1]}% ·
                  illustrative, unvalidated estimate.
                </p>
                <button
                  className="btn mt-5"
                  disabled={exists}
                  onClick={() => {
                    create(rec);
                    setMessage(
                      `Created recommendation for ${item.name} at ${hallName(service.hallId)}. It is now in the pending list.`,
                    );
                  }}
                >
                  {exists ? "Recommendation created" : "Create recommendation"}
                </button>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
