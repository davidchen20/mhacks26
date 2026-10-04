import { reductionRangeFromRemaining } from "./culinary";
import { seededRandom } from "./text";
import {
  HALL_SCALE,
  UNSERVED_WASTE_SHARE,
  round,
  type HallId,
  type Meal,
  type MenuItem,
} from "./types";

export function applySimulatedWaste(
  items: MenuItem[],
  hallId: HallId,
  date: string,
  meal: Meal,
): MenuItem[] {
  const rand = seededRandom(`waste|${hallId}|${date}|${meal}`);
  const scale = HALL_SCALE[hallId];
  return items.map((item) => {
    const itemRand = seededRandom(
      `waste|${hallId}|${date}|${meal}|${item.id}`,
    );
    const remainingPct = Math.max(
      4,
      Math.min(72, Math.round(8 + itemRand() * 52 + (rand() - 0.5) * 8)),
    );
    const portionsPrepared = Math.max(
      40,
      Math.round((220 + itemRand() * 280) * scale),
    );
    const serveRatio = 0.85 + itemRand() * 0.13;
    const portionsServed = Math.min(
      portionsPrepared,
      Math.max(1, Math.round(portionsPrepared * serveRatio)),
    );
    const oz = item.standardPortionOz;
    const unservedLbs = round(
      ((portionsPrepared - portionsServed) * oz) / 16,
      3,
    );
    const plateWasteLbs = round(
      (portionsServed * oz * (remainingPct / 100)) / 16,
      3,
    );
    const wasteLbs = round(
      unservedLbs * UNSERVED_WASTE_SHARE + plateWasteLbs,
      3,
    );
    const unservedCost = round(
      unservedLbs * UNSERVED_WASTE_SHARE * item.costPerLb,
      2,
    );
    const plateWasteCost = round(plateWasteLbs * item.costPerLb, 2);
    const wasteCost = round(unservedCost + plateWasteCost, 2);
    return {
      ...item,
      remainingPct,
      portionsPrepared,
      portionsServed,
      servings: portionsServed,
      unservedLbs,
      plateWasteLbs,
      wasteLbs,
      unservedCost,
      plateWasteCost,
      wasteCost,
      reductionRange: reductionRangeFromRemaining(remainingPct),
    };
  });
}

export function itemWasteTotals(items: MenuItem[]) {
  return {
    wasteLbs: round(items.reduce((n, i) => n + i.wasteLbs, 0), 3),
    wasteCost: round(items.reduce((n, i) => n + i.wasteCost, 0), 2),
    unservedLbs: round(items.reduce((n, i) => n + i.unservedLbs, 0), 3),
    plateWasteLbs: round(items.reduce((n, i) => n + i.plateWasteLbs, 0), 3),
    unservedCost: round(items.reduce((n, i) => n + i.unservedCost, 0), 2),
    plateWasteCost: round(items.reduce((n, i) => n + i.plateWasteCost, 0), 2),
    portionsPrepared: items.reduce((n, i) => n + i.portionsPrepared, 0),
    portionsServed: items.reduce((n, i) => n + i.portionsServed, 0),
  };
}
