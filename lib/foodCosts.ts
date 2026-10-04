import type { Category, CostSource } from "./types";
import { wordBoundaryMatch } from "./text";

/**
 * Illustrative wholesale food-cost assumptions (USD per pound), not UDS invoice prices.
 * Used only to translate simulated waste pounds into an illustrative dollar figure.
 */
export const ITEM_PRICE_PER_LB: { keywords: string[]; usdPerLb: number; label: string }[] =
  [
    { keywords: ["chicken"], usdPerLb: 2.4, label: "chicken" },
    { keywords: ["ground beef", "beef"], usdPerLb: 3.8, label: "beef" },
    { keywords: ["turkey"], usdPerLb: 2.8, label: "turkey" },
    { keywords: ["salmon", "fish"], usdPerLb: 8.5, label: "salmon/fish" },
    { keywords: ["tofu"], usdPerLb: 2.2, label: "tofu" },
    { keywords: ["egg", "eggs"], usdPerLb: 1.8, label: "eggs" },
    { keywords: ["bacon"], usdPerLb: 4.5, label: "bacon" },
    { keywords: ["pork", "ham", "sausage"], usdPerLb: 2.9, label: "pork" },
    { keywords: ["rice"], usdPerLb: 0.85, label: "rice" },
    { keywords: ["pasta", "noodle", "spaghetti", "macaroni"], usdPerLb: 1.1, label: "pasta" },
    { keywords: ["potato", "potatoes"], usdPerLb: 0.7, label: "potatoes" },
    { keywords: ["oat", "oats", "oatmeal"], usdPerLb: 0.9, label: "oats" },
    { keywords: ["broccoli"], usdPerLb: 1.8, label: "broccoli" },
    { keywords: ["green beans"], usdPerLb: 1.6, label: "green beans" },
    {
      keywords: ["kale", "spinach", "lettuce", "salad", "spring mix", "greens"],
      usdPerLb: 2.5,
      label: "leafy greens",
    },
    {
      keywords: ["fruit", "melon", "berry", "berries", "apple", "banana", "orange"],
      usdPerLb: 1.4,
      label: "fruit",
    },
    { keywords: ["yogurt"], usdPerLb: 1.7, label: "yogurt" },
    { keywords: ["cheese"], usdPerLb: 3.2, label: "cheese" },
    { keywords: ["milk"], usdPerLb: 0.55, label: "milk" },
    { keywords: ["bean", "beans", "lentil", "chickpea"], usdPerLb: 1.2, label: "beans" },
    { keywords: ["pizza"], usdPerLb: 2.1, label: "pizza" },
    { keywords: ["soup"], usdPerLb: 1.35, label: "soup" },
  ];

export const CATEGORY_PRICE_PER_LB: Record<Category, number> = {
  Protein: 3.0,
  Produce: 1.5,
  Grains: 0.95,
  Dairy: 1.6,
};

const PLANT_MILK = /\b(coconut|almond|oat|soy|rice|cashew)\s+milk\b/i;

export function costPerLb(
  itemName: string,
  category: Category,
): { usdPerLb: number; source: CostSource; label: string } {
  const name = itemName.replace(PLANT_MILK, " ").trim();
  for (const row of ITEM_PRICE_PER_LB) {
    if (row.keywords.some((k) => wordBoundaryMatch(name, k))) {
      return {
        usdPerLb: row.usdPerLb,
        source: "item-keyword",
        label: row.label,
      };
    }
  }
  return {
    usdPerLb: CATEGORY_PRICE_PER_LB[category],
    source: "category-default",
    label: `${category} default`,
  };
}

export function costSourceLabel(source: CostSource) {
  return source === "item-keyword" ? "item price" : "est. category default";
}
