# Menu JSON from plate observations

The public menu_waste table stores one observation per summary/food, with:

- diningHall: lowercase ID, e.g. bursley (all simulated foods use bursley)
- serviceDate: YYYY-MM-DD
- meal: breakfast, lunch, brunch, or dinner
- food: stable food/model ID
- station, name, servingSize, calories, fiber, protein, traits, allergens
- wastePercent, observations, simulated

The original waste_summary table is preserved for existing clients.
New uploads call record_menu_waste and write to menu_waste.

## Edit menu metadata

Edit menu_items.json to match the menu items for the service.
Nutrition values are null until known. Empty traits/allergen arrays are placeholders,
not verified dietary or allergen classifications.
The configured foods currently match chips, cookie, and pizza model labels.
Recognizing oatmeal requires the classifier to produce its corresponding food ID;
adding a name in this metadata file does not train the classifier.

## Publish and run

Publish from the repository root:

    spacetime publish --server maincloud --module-path .\waste-db\spacetimedb mhacks-mdining-waste

Run the monitor in its own terminal, assigning the service being observed:

    python waste_monitor.py --watch-dir captures\plate_results --simulate-reference --service-date 2026-10-04 --meal breakfast

Run the uploader in another terminal:

    python upload_summaries.py --database mhacks-mdining-waste

New summaries include their date and meal. For OLDER summaries that do not have
these fields, you must explicitly assign the correct fallback service:

    python upload_summaries.py --database mhacks-mdining-waste --service-date 2026-10-04 --meal breakfast

Fallbacks affect only summaries missing those fields. Use the actual service
date/meal of those old observations; this command is an example.
Schema-v2 upload markers are refreshed for the new menu_waste table. Stable row
IDs prevent retries from duplicating entries. Different observations of a food
are averaged within hall/date/meal/food, weighted by observation count.
Measured and simulated observations stay separate.

## Export a JSON file

After uploading, run:

    python export_menu_json.py --database mhacks-mdining-waste --output menu_waste.json

This queries SpacetimeDB and writes the requested hall -> date -> meal -> items
shape. Item objects include the original menu fields plus foodId, wastePercent,
observations, and simulated. Only recognized/observed foods appear, so this
export is not a full dining menu.

To keep the JSON file updated automatically, leave this command running in
another terminal:

    python export_menu_json.py --database mhacks-mdining-waste --output menu_waste.json --watch

It checks every five seconds, rewrites the file only when data changes, and
retries failed requests while preserving the last successful export.
This updates the local file. A deployed Vercel app must read the cloud database
or a hosted API to receive updates automatically; it cannot read this local file.

## Use in the Vercel app

Generate updated client bindings for the changed database module. Subscribe to
menu_waste (generated TypeScript accessor: menuWaste), then copy the helper
format_menu_waste.mjs into the app.

    import { formatMenuWaste } from "./format_menu_waste.mjs";
    const menuJson = formatMenuWaste(rows);
    const breakfast = menuJson.bursley?.["2026-10-04"]?.breakfast ?? [];

The helper expects decoded SDK rows, with optional numeric nutrition fields
represented as number or undefined. Recompute it when subscription rows change.
For a static demonstration, the exported JSON file can be copied into the
app's public folder and fetched normally, but that copy updates only on redeploy.
