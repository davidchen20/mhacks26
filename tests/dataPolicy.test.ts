import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getService,
  totals,
  universityTrend,
  hasScrapedMenu,
  recommendationsForServices,
} from "../lib/mockData";
import type { ScrapedMenus } from "../lib/types";
const data: ScrapedMenus = {
  bursley: {
    "2026-10-03": {
      brunch: [
        {
          name: "Chicken",
          station: "Grill",
          servingSize: "4 oz",
          calories: 200,
          protein: 20,
          fiber: 0,
          traits: [],
          allergens: [],
        },
      ],
    },
    "2026-10-04": {
      brunch: [
        {
          name: "Future chicken",
          station: "Grill",
          servingSize: "4 oz",
          calories: 200,
          protein: 20,
          fiber: 0,
          traits: [],
          allergens: [],
        },
      ],
    },
  },
};
test("today only comes from published menus; missing halls have no mock fallback", () => {
  const real = getService(
    "bursley",
    "2026-10-03",
    "brunch",
    data,
    "2026-10-03",
  );
  assert.equal(real.menuSource, "mdining");
  assert.equal(real.items[0].name, "Chicken");
  assert.equal(
    getService("twigs", "2026-10-03", "brunch", data, "2026-10-03")
      .availability,
    "unavailable",
  );
  assert.equal(hasScrapedMenu("bursley", "2026-10-03", data), true);
  assert.equal(hasScrapedMenu("twigs", "2026-10-03", data), false);
  assert.deepEqual(
    recommendationsForServices([
      getService("twigs", "2026-10-03", "brunch", data, "2026-10-03"),
    ]),
    [],
  );
});
test("future data is suppressed even when the JSON contains it; past is illustrative", () => {
  const future = getService(
    "bursley",
    "2026-10-04",
    "brunch",
    data,
    "2026-10-03",
  );
  assert.equal(future.availability, "future");
  assert.equal(future.items.length, 0);
  assert.equal(totals([future]).hasData, false);
  assert.equal(
    getService("bursley", "2026-10-02", "lunch", data, "2026-10-03").menuSource,
    "illustrative",
  );
  assert.equal(
    getService("bursley", "2026-10-03", "lunch", data, "2026-10-03")
      .availability,
    "no-service",
  );
});
test("totals are item-derived and weekend lunch trend points are gaps including averages", () => {
  const service = getService(
    "bursley",
    "2026-10-03",
    "brunch",
    data,
    "2026-10-03",
  );
  const total = totals([service]);
  assert.equal(total.wasteLbs, service.items[0].wasteLbs);
  assert.equal(total.wasteLbs, total.unservedLbs + total.plateWasteLbs);
  const previous = process.env.NEXT_PUBLIC_DEMO_DATE;
  process.env.NEXT_PUBLIC_DEMO_DATE = "2026-10-03";
  try {
    const last = universityTrend("2026-10-03", "lunch").at(-1)!;
    assert.equal(last.value, null);
    assert.equal(last.movingAverage, null);
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_DEMO_DATE;
    else process.env.NEXT_PUBLIC_DEMO_DATE = previous;
  }
});
