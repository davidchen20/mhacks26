// ADD to your existing Rust module. Do not replace its table declaration.
// Template assumes id: u64, observations: u32, numeric values: f64,
// other columns: String/bool, table struct: MenuWaste, accessor: menu_waste().
// Match these to your actual module. Add your module's existing writer
// authorization checks here before publishing to a shared/public instance.
use spacetimedb::Table;

#[spacetimedb::reducer]
pub fn insert_demo_observation(
    ctx: &spacetimedb::ReducerContext,
    id: u64,
    food: String,
    service_date: String,
    meal: String,
    waste_percent: f64,
    serving_size: String,
    calories: f64,
    fiber: f64,
    protein: f64,
) -> Result<(), String> {
    if !waste_percent.is_finite() || !(0.0..=100.0).contains(&waste_percent) {
        return Err("Invalid waste percentage".into());
    }
    if !["Pizza", "Steamed Broccoli", "Lemon Herb Chicken"].contains(&food.as_str()) {
        return Err("Unknown demo food".into());
    }
    if !["breakfast", "brunch", "lunch", "dinner"].contains(&meal.as_str()) {
        return Err("Invalid meal".into());
    }
    if [calories, fiber, protein].iter().any(|n| !n.is_finite() || *n < 0.0) {
        return Err("Invalid nutrition".into());
    }
    // Stable IDs permit retry without inserting duplicate observations.
    if ctx.db.menu_waste().id().find(id).is_some() {
        return Ok(());
    }
    ctx.db.menu_waste().insert(MenuWaste {
        id, name: food.clone(), food,
        dining_hall: "MHacks Demo".into(), service_date, meal, waste_percent,
        observations: 1, simulated: false,
        station: "Phone camera / mock inference".into(),
        serving_size, calories, fiber, protein,
    });
    Ok(())
}
