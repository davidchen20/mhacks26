import type { MenuItem } from "./types";
import { hardcodedRecommendation } from "./hardcodedRecommender";
export function wasteAdvice(item: MenuItem) {
  const result = hardcodedRecommendation(item.name, item.wasteLbs, item.totalServedLbs);
  return {origin: result ? "menu-review" as const : "monitor" as const,
    severity: result ? "review" : "on-track", change: 0,
    title: result?.recommendation ?? (item.totalServedLbs <= 0 ? "No recommendation: served quantity is zero." : "No recommendation: waste ratio is at or below 20%."), result};
}
