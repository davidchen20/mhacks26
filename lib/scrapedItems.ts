/** Pure scraper-to-UI adapter. Waste is deterministic simulation, never scraped. */
import type { Category, MenuItem, ScrapedItem } from "./types";
import { hash, seededRandom } from "./random";
import { wasteMetrics } from "./foodWeights";
const patterns: [Category, RegExp][] = [
  [
    "Protein",
    /\b(chicken|turkey|beef|pork|ham|bacon|sausage|fish|salmon|tuna|cod|shrimp|tofu|tempeh|egg|eggs|omelet|omelette|lentil|lentils|beans|chickpea|chickpeas|meatball|burger|seitan)\b/i,
  ],
  [
    "Dairy",
    /\b(yogurt|yoghurt|cottage cheese|mac.*cheese|cheese pizza|quesadilla)\b/i,
  ],
  [
    "Grains",
    /\b(rice|pasta|noodles?|spaghetti|macaroni|oatmeal|oats|cereal|granola|quinoa|bread|toast|bagel|roll|biscuit|pancakes?|waffles?|pizza|couscous|bulgur|muffin|tortilla)\b/i,
  ],
  [
    "Produce",
    /\b(salad|greens|lettuce|spinach|kale|broccoli|carrots?|peas|corn|potato\w*|squash|zucchini|cabbage|cauliflower|vegetables?|fruit|apple|banana|berries|strawberr\w*|melon|grapes?|peach\w*|pear|orange|asparagus|beets?|brussels|tomato\w*|cucumber\w*)\b/i,
  ],
];
export function categorize(station: string, name: string): Category | null {
  const text = `${station} ${name}`;
  if (/condiment|beverage|drink station|topping station/i.test(station))
    return null;
  if (
    /\b(ketchup|mustard|mayonnaise|dressing|syrup|sauce|salsa|sugar|salt|pepper shaker|butter|jam|jelly|juice|coffee|tea|soda|water|milk)\b/i.test(
      name,
    ) &&
    !/\b(with|soup|chicken|pasta|rice|tofu|salmon|beef|pork|turkey|macaroni)\b/i.test(
      name,
    )
  )
    return null;
  if (
    /^(shredded|grated|crumbled|sliced) .*cheese$|^cream cheese$|^croutons$/i.test(
      name,
    )
  )
    return null;
  // Prefer the name before station context (e.g. potatoes at a Toast station).
  return (
    patterns.find(([, p]) => p.test(name))?.[0] ??
    patterns.find(([, p]) => p.test(text))?.[0] ??
    null
  );
}
export function culinarySuggestion(category: Category) {
  return {
    Protein:
      "Offer smaller first portions with seconds available; test a smaller finishing batch",
    Produce:
      "Test preparation and seasoning with diners, then adjust batch size while keeping vegetables available",
    Grains:
      "Offer a half scoop and replenish in smaller batches based on demand",
    Dairy:
      "Offer smaller cups with optional refills and review chilled-service demand",
  }[category];
}
export function scrapedItemsToMenuItems(
  input: ScrapedItem[],
  seed: string,
  limit = 12,
): MenuItem[] {
  const seen = new Set<string>();
  const items: MenuItem[] = [];
  for (const raw of input) {
    const category = categorize(raw.station, raw.name);
    if (!category) continue;
    const key = raw.name.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const id = `menu-${hash(key).toString(16)}`;
    const rand = seededRandom(`${seed}|${id}`);
    const portionsPrepared = 120 + Math.floor(rand() * 481);
    const portionsServed =
      Math.ceil(portionsPrepared * 0.65) +
      Math.floor(
        rand() *
          (Math.floor(portionsPrepared * 0.98) -
            Math.ceil(portionsPrepared * 0.65) +
            1),
      );
    const remainingPct = Math.round(5 + rand() * 55);
    const known =
      raw.fiber !== null &&
      raw.protein !== null &&
      raw.calories !== null &&
      raw.calories > 0;
    // Transparent operational ranking proxy (0..5), NOT a health score.
    const densityScore = known
      ? Math.min(
          5,
          Math.round(((raw.fiber! * 2 + raw.protein!) / raw.calories!) * 250) /
            10,
        )
      : 0;
    const weightInput = {
      name: raw.name,
      station: raw.station,
      servingSize: raw.servingSize,
      category,
    };
    const reduction = Math.max(3, Math.min(20, Math.round(remainingPct / 3)));
    items.push({
      id,
      ...weightInput,
      traits: [...raw.traits],
      allergens: [...raw.allergens],
      remainingPct,
      ...wasteMetrics(
        weightInput,
        portionsPrepared,
        portionsServed,
        remainingPct,
      ),
      servings: portionsServed,
      nutrition: {
        fiberGrams: raw.fiber,
        proteinGrams: raw.protein,
        calories: raw.calories,
        densityScore,
        nutrientDensity: !known
          ? "unknown"
          : densityScore >= 3
            ? "high"
            : "moderate",
      },
      culinarySuggestion: culinarySuggestion(category),
      reductionRange: [reduction, reduction + 5],
    });
    if (items.length >= limit) break;
  }
  return items;
}
