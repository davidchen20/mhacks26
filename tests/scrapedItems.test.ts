import { test } from "node:test";
import assert from "node:assert/strict";
import { categorize, scrapedItemsToMenuItems } from "../lib/scrapedItems";
import type { ScrapedItem } from "../lib/types";
const sample: ScrapedItem = {
  name: "Roasted Chicken",
  station: "Grill",
  servingSize: "4 oz",
  calories: 200,
  fiber: 2,
  protein: 20,
  traits: ["Gluten Free"],
  allergens: [],
};
test("categorizer drops condiments, drinks, toppings and unknown items", () => {
  assert.equal(categorize("Hot cereal", "Brown Sugar"), null);
  assert.equal(categorize("Beverages", "Orange juice"), null);
  assert.equal(categorize("Topping station", "Chickpeas"), null);
  assert.equal(categorize("Other", "Mystery dish"), null);
  assert.equal(categorize("Toast", "O'Brien Potatoes"), "Produce");
  assert.equal(categorize("Entrees", "Butter Chicken"), "Protein");
  assert.equal(categorize("Pasta", "Macaroni and cheese"), "Dairy");
  assert.equal(categorize("Grains", "Brown rice"), "Grains");
});
test("converter preserves real nutrition, caps items and seeds by item, not order", () => {
  const items = Array.from({ length: 20 }, (_, i) => ({
    ...sample,
    name: `Roasted Chicken ${i}`,
  }));
  const a = scrapedItemsToMenuItems(items, "bursley|2026-10-03|brunch");
  assert.equal(a.length, 12);
  assert.equal(a[0].nutrition.proteinGrams, 20);
  assert.equal(a[0].nutrition.fiberGrams, 2);
  assert.equal(a[0].nutrition.calories, 200);
  assert.equal(a[0].nutrition.densityScore, 3);
  assert.deepEqual(
    a,
    scrapedItemsToMenuItems(items, "bursley|2026-10-03|brunch"),
  );
  assert.deepEqual(
    a[0],
    scrapedItemsToMenuItems(
      [items[1], items[0]],
      "bursley|2026-10-03|brunch",
    )[1],
  );
  assert.notEqual(
    a[0].portionsPrepared,
    scrapedItemsToMenuItems(items, "different-seed")[0].portionsPrepared,
  );
  for (const item of a) {
    assert.ok(item.portionsServed / item.portionsPrepared >= 0.85);
    assert.ok(item.portionsServed / item.portionsPrepared <= 0.98);
    assert.equal(item.wasteLbs, item.unservedLbs + item.plateWasteLbs);
  }
});
test("missing nutrition stays unknown, with no fabricated zeros", () => {
  const [item] = scrapedItemsToMenuItems(
    [{ ...sample, protein: null, fiber: null, calories: null }],
    "test",
  );
  assert.equal(item.nutrition.proteinGrams, null);
  assert.equal(item.nutrition.nutrientDensity, "unknown");
  assert.equal(item.nutrition.densityScore, 0);
});
