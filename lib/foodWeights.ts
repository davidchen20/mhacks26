import type { Category, MenuItem } from "./types";
export const GRAMS_PER_OZ = 28.349523125;
/** Illustrative density assumptions, not measurements of M Dining recipes. */
export const GRAMS_PER_CUP = {
  leafyGreens: 30,
  cookedVegetables: 150,
  rice: 195,
  pasta: 140,
  dairy: 245,
  meat: 140,
  soup: 240,
  legumes: 175,
  fruit: 150,
};
export const CATEGORY_PORTION_OZ: Record<Category, number> = {
  Protein: 4,
  Produce: 3,
  Grains: 5,
  Dairy: 6,
};
/** Illustrative purchase-cost estimates; no labor or disposal. */
export const COST_PER_LB: Record<Category, number> = {
  Protein: 4.5,
  Produce: 2,
  Grains: 1.2,
  Dairy: 2.5,
};
export const costPerLb = (category: Category) => COST_PER_LB[category];
export type WeightInput = {
  name: string;
  category: Category;
  servingSize?: string | null;
  station?: string;
};
export type WeightSource = MenuItem["weightSource"];
const amountPattern = "(\\d+\\s+\\d+\\/\\d+|\\d+\\/\\d+|\\d*\\.?\\d+)";
function amount(raw: string) {
  return raw
    .trim()
    .split(/\s+/)
    .reduce((sum, p) => {
      if (!p.includes("/")) return sum + Number(p);
      const [a, b] = p.split("/").map(Number);
      return sum + a / b;
    }, 0);
}
function density(item: WeightInput) {
  const text = `${item.name} ${item.station ?? ""}`.toLowerCase();
  if (/soup|broth|chowder|bisque|stew/.test(text)) return GRAMS_PER_CUP.soup;
  if (/yogurt|milk|cheese|dairy/.test(text)) return GRAMS_PER_CUP.dairy;
  if (/pasta|noodle|spaghetti|macaroni/.test(text)) return GRAMS_PER_CUP.pasta;
  if (/rice|risotto/.test(text)) return GRAMS_PER_CUP.rice;
  if (/bean|lentil|chickpea|hummus/.test(text)) return GRAMS_PER_CUP.legumes;
  if (
    /cooked|steamed|roasted|sauteed|sautéed/.test(text) &&
    item.category === "Produce"
  )
    return GRAMS_PER_CUP.cookedVegetables;
  if (/lettuce|leafy|spring mix|salad|spinach|kale|arugula/.test(text))
    return GRAMS_PER_CUP.leafyGreens;
  if (/fruit|apple|melon|berry|berries|grape|banana/.test(text))
    return GRAMS_PER_CUP.fruit;
  return {
    Protein: GRAMS_PER_CUP.meat,
    Produce: GRAMS_PER_CUP.cookedVegetables,
    Grains: GRAMS_PER_CUP.rice,
    Dairy: GRAMS_PER_CUP.dairy,
  }[item.category];
}
export function standardPortionOz(item: WeightInput): {
  oz: number;
  source: WeightSource;
} {
  const text = (item.servingSize ?? "")
    .toLowerCase()
    .replace(/½/g, " 1/2")
    .replace(/¼/g, " 1/4")
    .replace(/¾/g, " 3/4")
    .replace(/⅓/g, " 1/3")
    .replace(/⅔/g, " 2/3");
  const grams = text.match(new RegExp(amountPattern + "\\s*(?:grams?|g)\\b"));
  if (grams && amount(grams[1]) > 0)
    return { oz: amount(grams[1]) / GRAMS_PER_OZ, source: "serving-size" };
  const withoutFluid = text.replace(
    new RegExp(
      amountPattern + "\\s*(?:fl\\.?\\s*oz\\.?|fluid\\s+ounces?)",
      "g",
    ),
    "",
  );
  const ounces = withoutFluid.match(
    new RegExp(amountPattern + "\\s*(?:ounces?|oz)\\b"),
  );
  if (ounces && amount(ounces[1]) > 0)
    return { oz: amount(ounces[1]), source: "serving-size" };
  const volume = text.match(
    new RegExp(
      "(?:" +
        amountPattern +
        "\\s*)?(cups?|fl\\.?\\s*oz\\.?|fluid\\s+ounces?|ladles?|scoops?)\\b",
    ),
  );
  if (volume) {
    const n = volume[1] ? amount(volume[1]) : 1;
    const cups =
      n *
      (/fl|fluid/.test(volume[2])
        ? 1 / 8
        : /ladle|scoop/.test(volume[2])
          ? 1 / 2
          : 1);
    if (cups > 0)
      return {
        oz: (cups * density(item)) / GRAMS_PER_OZ,
        source: "converted-volume",
      };
  }
  const overrides: [RegExp, number][] = [
    [/soup|broth|chowder/, 8],
    [/pizza/, 4.3],
    [/bread|toast/, 1],
    [/egg/, 1.8],
    [/leafy|lettuce|spring mix|salad/, 1.5],
  ];
  const found = overrides.find(([pattern]) =>
    pattern.test(item.name.toLowerCase()),
  );
  return {
    oz: found?.[1] ?? CATEGORY_PORTION_OZ[item.category],
    source: "category-default",
  };
}
export const weightSourceLabel = (source: WeightSource) =>
  ({
    "serving-size": "from serving size",
    "converted-volume": "est. converted volume",
    "category-default": "est. category default",
  })[source];
export function portionLabel(
  item: Pick<MenuItem, "standardPortionOz" | "weightSource">,
) {
  return `${item.standardPortionOz.toFixed(1)} oz per portion · ${weightSourceLabel(item.weightSource)}`;
}
export function wasteMetrics(
  item: WeightInput,
  portionsPrepared: number,
  portionsServed: number,
  remainingPct: number,
) {
  if (
    ![portionsPrepared, portionsServed, remainingPct].every(Number.isFinite) ||
    portionsServed < 0 ||
    portionsPrepared < portionsServed ||
    remainingPct < 0 ||
    remainingPct > 100
  )
    throw new Error("Invalid portion/waste inputs");
  const { oz, source } = standardPortionOz(item);
  const unservedLbs = ((portionsPrepared - portionsServed) * oz) / 16;
  const plateWasteLbs = (portionsServed * oz * (remainingPct / 100)) / 16;
  const wasteLbs = unservedLbs + plateWasteLbs;
  return {
    standardPortionOz: oz,
    weightSource: source,
    portionsPrepared,
    portionsServed,
    unservedLbs,
    plateWasteLbs,
    wasteLbs,
    wasteCost: wasteLbs * costPerLb(item.category),
  };
}
export function trayWeight(standardOz: number, remainingPct: number) {
  const remainingOz = (standardOz * remainingPct) / 100;
  return { remainingOz, remainingGrams: remainingOz * GRAMS_PER_OZ };
}
