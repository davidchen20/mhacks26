// Standalone SpacetimeDB 2.0 module example.
// If you already have a module, merge this table and reducer into its schema.
import { schema, table, t } from "spacetimedb/server";

const wasteSummary = table(
  { name: "waste_summary", public: true },
  {
    id: t.string().primaryKey(),
    food: t.string(),
    wastePercent: t.f64(),
    observations: t.u32(),
    simulated: t.bool(),
    diningHall: t.string().default("Unknown"),
  }
);

// Menu-shaped observations; the original table remains available to old clients.
const menuWaste = table(
  { name: "menu_waste", public: true },
  {
    id: t.string().primaryKey(),
    food: t.string(),
    diningHall: t.string(),
    serviceDate: t.string(),
    meal: t.string(),
    wastePercent: t.f64(),
    observations: t.u32(),
    simulated: t.bool(),
    station: t.string(),
    name: t.string(),
    servingSize: t.string(),
    calories: t.option(t.f64()),
    fiber: t.option(t.f64()),
    protein: t.option(t.f64()),
    traits: t.array(t.string()),
    allergens: t.array(t.string()),
  }
);

const spacetimedb = schema({ wasteSummary, menuWaste });
export default spacetimedb;

export const recordSummary = spacetimedb.reducer(
  {
    id: t.string(),
    food: t.string(),
    wastePercent: t.f64(),
    observations: t.u32(),
    simulated: t.bool(),
    diningHall: t.string(),
  },
  (ctx, row) => {
    row = { ...row, diningHall: row.simulated ? "Bursley" : row.diningHall };
    if (!Number.isFinite(row.wastePercent) || row.wastePercent < 0 ||
        row.observations === 0) {
      throw new Error("Invalid summary.");
    }
    // Repeated uploads replace the same row, preventing double counting.
    if (ctx.db.wasteSummary.id.find(row.id)) {
      ctx.db.wasteSummary.id.update(row);
    } else {
      ctx.db.wasteSummary.insert(row);
    }
  }
);

export const recordMenuWaste = spacetimedb.reducer(
  {
    id: t.string(),
    food: t.string(),
    diningHall: t.string(),
    serviceDate: t.string(),
    meal: t.string(),
    wastePercent: t.f64(),
    observations: t.u32(),
    simulated: t.bool(),
    station: t.string(),
    name: t.string(),
    servingSize: t.string(),
    calories: t.option(t.f64()),
    fiber: t.option(t.f64()),
    protein: t.option(t.f64()),
    traits: t.array(t.string()),
    allergens: t.array(t.string()),
  },
  (ctx, row) => {
    row = { ...row, diningHall: row.simulated ? "bursley" : row.diningHall };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.serviceDate) ||
        !["breakfast", "lunch", "brunch", "dinner"].includes(row.meal) ||
        !Number.isFinite(row.wastePercent) || row.wastePercent < 0 ||
        !row.observations || !row.name || !row.diningHall) {
      throw new Error("Invalid menu waste observation.");
    }
    const storedRow = {
      ...row,
      calories: row.calories,
      fiber: row.fiber,
      protein: row.protein,
    };
    if (ctx.db.menuWaste.id.find(row.id)) {
      ctx.db.menuWaste.id.update(storedRow);
    } else {
      ctx.db.menuWaste.insert(storedRow);
    }
  }
);
