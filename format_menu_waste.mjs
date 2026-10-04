// Pass the rows subscribed from the SpacetimeDB menu_waste table.
export function formatMenuWaste(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = JSON.stringify([row.diningHall, row.serviceDate, row.meal, row.food, row.simulated]);
    const group = groups.get(key) ?? { row, observations: 0, weighted: 0 };
    if (!Number.isInteger(row.observations) || row.observations <= 0 ||
        !Number.isFinite(row.wastePercent)) throw new Error("Invalid waste observation.");
    group.row = row;
    group.observations += row.observations;
    group.weighted += row.wastePercent * row.observations;
    groups.set(key, group);
  }
  const result = Object.create(null);
  for (const { row, observations, weighted } of groups.values()) {
    const dates = result[row.diningHall] ??= Object.create(null);
    const meals = dates[row.serviceDate] ??= Object.create(null);
    const items = meals[row.meal] ??= [];
    items.push({
      station: row.station,
      name: row.name,
      servingSize: row.servingSize,
      calories: row.calories ?? null,
      fiber: row.fiber ?? null,
      protein: row.protein ?? null,
      traits: row.traits,
      allergens: row.allergens,
      foodId: row.food,
      wastePercent: Number((weighted / observations).toFixed(2)),
      observations,
      simulated: row.simulated,
    });
  }
  return result;
}
