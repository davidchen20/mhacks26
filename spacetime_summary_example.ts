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

const spacetimedb = schema({ wasteSummary });
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
