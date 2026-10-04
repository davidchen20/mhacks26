import { test } from "node:test";
import assert from "node:assert/strict";
import {
  standardPortionOz,
  GRAMS_PER_OZ,
  wasteMetrics,
  trayWeight,
} from "../lib/foodWeights";
const close = (a: number, b: number) =>
  assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
test("explicit grams override volume and ounces; direct fractional ounces", () => {
  const a = standardPortionOz({
    name: "rice",
    category: "Grains",
    servingSize: "1/2 Cup (105g)",
  });
  assert.equal(a.source, "serving-size");
  close(a.oz, 105 / GRAMS_PER_OZ);
  close(
    standardPortionOz({
      name: "chicken",
      category: "Protein",
      servingSize: "3 1/2 ounces",
    }).oz,
    3.5,
  );
});
test("fluid ounces are volume, not weight; food density changes conversions", () => {
  const salad = standardPortionOz({
    name: "Leafy greens",
    category: "Produce",
    servingSize: "4 fl oz",
  });
  const rice = standardPortionOz({
    name: "Cooked rice",
    category: "Grains",
    servingSize: "1/2 cup",
  });
  assert.equal(salad.source, "converted-volume");
  close(salad.oz, 15 / GRAMS_PER_OZ);
  close(rice.oz, 97.5 / GRAMS_PER_OZ);
  assert.ok(rice.oz > salad.oz * 6);
});
test("fractional cups, ladles, scoops and fallback sources", () => {
  close(
    standardPortionOz({
      name: "Yogurt",
      category: "Dairy",
      servingSize: "½ cup",
    }).oz,
    122.5 / GRAMS_PER_OZ,
  );
  close(
    standardPortionOz({
      name: "Soup",
      category: "Produce",
      servingSize: "1 ladle",
    }).oz,
    120 / GRAMS_PER_OZ,
  );
  close(
    standardPortionOz({
      name: "Pasta",
      category: "Grains",
      servingSize: "2 scoops",
    }).oz,
    140 / GRAMS_PER_OZ,
  );
  assert.deepEqual(
    standardPortionOz({ name: "Leafy salad", category: "Produce" }),
    { oz: 1.5, source: "category-default" },
  );
  assert.deepEqual(
    standardPortionOz({
      name: "Unspecified",
      category: "Dairy",
      servingSize: "1 portion",
    }),
    { oz: 6, source: "category-default" },
  );
});
test("all aggregate and tray weights reconcile using the same portion", () => {
  const m = wasteMetrics(
    { name: "Chicken", category: "Protein", servingSize: "4 oz" },
    100,
    90,
    20,
  );
  close(m.unservedLbs, 2.5);
  close(m.plateWasteLbs, 4.5);
  close(m.wasteLbs, 7);
  close(m.wasteCost, 31.5);
  const tray = trayWeight(m.standardPortionOz, 20);
  close(tray.remainingOz, 0.8);
  close(tray.remainingGrams, 0.8 * GRAMS_PER_OZ);
  close((tray.remainingOz * 90) / 16, m.plateWasteLbs);
  close(trayWeight(4, 0).remainingOz, 0);
  assert.throws(() =>
    wasteMetrics({ name: "Chicken", category: "Protein" }, 10, 11, 20),
  );
});
