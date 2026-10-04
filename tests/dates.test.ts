import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getToday,
  mealOptionsForDates,
  correctOverviewMeal,
  datesForRange,
  mealsForDate,
} from "../lib/dates";
test("Saturday and Sunday only offer All, Brunch and Dinner", () => {
  assert.deepEqual(mealOptionsForDates(["2026-10-03"]), [
    "all",
    "brunch",
    "dinner",
  ]);
  assert.deepEqual(mealsForDate("2026-10-04"), ["brunch", "dinner"]);
  assert.equal(correctOverviewMeal("lunch", ["2026-10-03"]), "all");
  assert.equal(correctOverviewMeal("brunch", ["2026-10-03"]), "brunch");
});
test("weekday and trailing-week controls, revalidation on range change", () => {
  assert.deepEqual(mealOptionsForDates(["2026-10-02"]), [
    "all",
    "breakfast",
    "lunch",
    "dinner",
  ]);
  assert.deepEqual(
    mealOptionsForDates(datesForRange("week", 0, "2026-10-03")),
    ["all", "breakfast", "lunch", "brunch", "dinner"],
  );
  assert.equal(
    correctOverviewMeal("brunch", datesForRange("yesterday", 0, "2026-10-03")),
    "all",
  );
});
test("Detroit midnight and optional date override", () => {
  const previous = process.env.NEXT_PUBLIC_DEMO_DATE;
  try {
    delete process.env.NEXT_PUBLIC_DEMO_DATE;
    assert.equal(getToday(new Date("2026-10-04T02:00:00Z")), "2026-10-03");
    assert.equal(getToday(new Date("2026-10-04T04:00:00Z")), "2026-10-04");
    process.env.NEXT_PUBLIC_DEMO_DATE = "2026-10-03";
    assert.equal(getToday(new Date("2027-01-01")), "2026-10-03");
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_DEMO_DATE;
    else process.env.NEXT_PUBLIC_DEMO_DATE = previous;
  }
});
