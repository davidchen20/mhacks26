import test from "node:test";
import assert from "node:assert/strict";
import { toDemoServices, selectDemoServices, demoWasteTrend, demoCostTrend, type DemoResponse } from "../lib/demoData";
import { totals, summarizeHalls, recommendationsForServices, HALLS, getService, servicesForDay } from "../lib/mockData";
const payload = (): DemoResponse => ({food_specs: {Pizza: {portion_lbs: .25, cost_per_lb: 3, category: "Grains"}},
  observations: [{id: "1", food: "Pizza", dining_hall: "MHacks Demo", service_date: "2026-10-04", meal: "dinner",
    waste_percent: 40, observations: 1, simulated: false, station: "Phone camera / mock inference", name: "Pizza",
    serving_size: "4 oz", calories: 285, fiber: 2, protein: 12},
    {id: "2", food: "Pizza", dining_hall: "MHacks Demo", service_date: "2026-10-04", meal: "dinner",
    waste_percent: 20, observations: 3, simulated: false, station: "Phone camera / mock inference", name: "Pizza",
    serving_size: "4 oz", calories: 285, fiber: 2, protein: 12}]});
test("demo adapter reconciles captured portions, weighted percentages, and costs", () => {
  const services = toDemoServices(payload());
  const item = services[0].items[0];
  assert.equal(item.remainingPct, 25);
  assert.equal(item.totalServedLbs, 1);
  assert.equal(totals(services).wasteLbs, .25);
  assert.equal(totals(services).wasteCost, .75);
  assert.equal(services[0].mealsServed, 4);
  assert.equal(services[0].menuSource, "spacetimedb");
  const hall = summarizeHalls(services)[0];
  assert.equal(hall.hall.name, "MHacks Demo");
  assert.equal(hall.wasteLbs, .25);
  assert.equal(recommendationsForServices(services)[0].plateWasteCost, .75);
  assert.equal(recommendationsForServices(services)[0].kitchenWasteCost, undefined);
});
test("demo has no historical mock fallback and never enters All halls mock aggregates", () => {
  assert.equal(HALLS.some((h) => h.id === "mhacks-demo"), false);
  assert.equal(getService("mhacks-demo", "2026-01-01", "dinner").items.length, 0);
  assert.equal(servicesForDay("2026-01-01").some((s) => s.hallId === "mhacks-demo"), false);
  assert.deepEqual(toDemoServices({...payload(), observations: []}), []);
  assert.equal(summarizeHalls([], true)[0].hall.id, "mhacks-demo");
  assert.equal(summarizeHalls([], true)[0].wasteCost, null);
});
test("demo adapter isolates hall/date/meal and rejects missing cost assumptions", () => {
  const p = payload(); p.observations[0].dining_hall = "South Quad";
  assert.throws(() => toDemoServices(p), /Unexpected hall/);
  const services = toDemoServices(payload());
  assert.equal(selectDemoServices(services, ["2026-10-03"], "all").length, 0);
  assert.equal(selectDemoServices(services, ["2026-10-04"], "lunch").length, 0);
  assert.equal(selectDemoServices(services, ["2026-10-04"], "dinner").length, 1);
  assert.throws(() => toDemoServices({...payload(), food_specs: {}}), /Missing demo/);
});
test("demo trends leave missing captures as gaps and deduplicate repeated IDs", () => {
  const p = payload(); p.observations.push(p.observations[0]);
  const services = toDemoServices(p);
  assert.equal(totals(services).wasteCost, .75);
  const waste = demoWasteTrend(services, "2026-10-04", "all");
  assert.equal(waste.length, 28);
  assert.equal(waste[0].value, null);
  assert.equal(waste.at(-1)?.value, .25);
  assert.equal(waste.at(-1)?.movingAverage, .25);
  const cost = demoCostTrend(services, "2026-10-04", "all");
  assert.equal(cost[0].value, null);
  assert.equal(cost.at(-1)?.value, .75 / 4);
});
import { mergeDemoRecommendations } from "../lib/demoData";
import { makeRecommendation } from "../lib/mockData";
test("polling refreshes demo advice without duplicates or changing other halls", () => {
  const first = toDemoServices(payload());
  const initial = recommendationsForServices(first);
  const other = {...initial[0], id: "other", hallId: "south-quad" as const};
  const p = payload(); p.observations[0].waste_percent = 90;
  const latest = toDemoServices(p);
  const updated = mergeDemoRecommendations([other, ...initial], recommendationsForServices(latest),
    ["2026-10-04|dinner"], latest, makeRecommendation);
  assert.equal(updated.length, 2);
  assert.equal(updated[0], other);
  assert.equal(updated[1].id, initial[0].id);
  assert.notEqual(updated[1].wasteCost, initial[0].wasteCost);
  assert.equal(mergeDemoRecommendations(updated, recommendationsForServices(latest),
    ["2026-10-04|dinner"], latest, makeRecommendation), updated);
  const empty = mergeDemoRecommendations(updated, [], ["2026-10-04|dinner"], [], makeRecommendation);
  assert.deepEqual(empty, [other]);
});
