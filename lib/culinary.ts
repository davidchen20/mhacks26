import type { Category } from "./types";

export function culinarySuggestion(category: Category): string {
  switch (category) {
    case "Protein":
      return "Offer smaller first portions with seconds available";
    case "Produce":
      return "Season or roast for palatability and offer dressing on the side";
    case "Grains":
      return "Serve in smaller batches and offer a half scoop";
    default:
      return "Offer smaller cups with fruit as an optional topping";
  }
}

export function reductionRangeFromRemaining(
  remainingPct: number,
): [number, number] {
  const mid = Math.max(4, Math.min(24, Math.round(remainingPct * 0.35)));
  return [Math.max(3, mid - 2), mid + 2];
}
