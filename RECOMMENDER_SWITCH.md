# Install the supplied hardcoded recommender

Copy the files in `recommendation_update.zip` into your existing repository root (the directory containing package.json), preserving their folders. It is an overlay containing only changed/new recommendation files and recommendation tests. It includes the supplied database unchanged. Back up or commit your local edits first; copying these files replaces local changes to the same files.

The complete updated application is also in `mhacks26_front_updated.zip`. Use the smaller patch if you have edited other parts of your app locally.

## Behavior

- `recommender.py` is the uploaded `recommender-hardcoded.py`, renamed for imports. The sole source adjustment loads database.json relative to the module, rather than the shell's current folder.
- `database.json` is copied unchanged from your attachment.
- The uploaded category templates, wording and dietary formatting are preserved exactly.
- Threshold: waste/served **strictly greater than 20%** creates advice; at exactly 20% none is returned.
- Severity: **strictly greater than 30%** uses `high`; exactly 30% uses `low`.
- Missing/zero-served dishes are skipped. Dishes absent from database.json use the supplied UNKNOWN fallback. Lookup is exact, as in your supplied code; no category or dietary tags are inferred from names.
- Waste amount is `plateWasteLbs + unservedLbs`, divided by `totalServedLbs` in matching units and service scope. This total-waste/served ratio can exceed 100% when unserved waste is large; it is not the percentage left on trays. This mapping replaces the previous separate batch/portion/menu rules, as requested.
- Recommendations appear for all flagged items, sorted by waste ratio; the previous top-one-per-hall selection no longer hides results.
- Recommendation and nutrition-insight advice comes from this engine. Recommendation cards show the actual ratio/category/dietary tags, without invented percentage reductions or financial savings. Pantry/nutrition data and financial values are unchanged.
- Stored active recommendations are refreshed through the new rules; saved acceptance/dismissal history is retained as historical snapshots. Already-decided items remain decided.

Some supplied high templates name specific ingredients without substituting `{dietary_text}`. They are preserved exactly. Database tags and replacement prose are manager-reviewed guidance, not a verified dietary/allergen compliance check.

## Code paths

| File | Role |
| --- | --- |
| `recommender.py` | Supplied Python engine |
| `database.json` | Supplied dish classification and dietary tags |
| `lib/recommendationRules.json` | Generated copy of the supplied Python template dictionary |
| `lib/hardcodedRecommender.ts` | Same rule selection/template interpolation in Next.js |
| `lib/wasteAdvice.ts` | Replaces old source-based suggestion logic with supplied rules |
| `lib/mockData.ts` | Changes only recommendation creation/filtering; totals remain unchanged |
| `lib/types.ts` | Adds recommendation-specific fields |
| `lib/recommender.ts` | Adjusts recommendation response types |
| `api/recommendation_adapter.py` | Connects existing waste measurements to supplied Python inputs |
| `api/index.py` | Switches recommendation endpoints to the new engine; financial response/calculations retained |
| `components/recommendations/*` in the patch | Displays the new rules and refreshes saved current advice |
| `scripts/sync_recommendation_rules.py` | Regenerates frontend template JSON from Python |
| `tests/*` in the patch | Checks rule parity, boundaries and unchanged financial calculations |

No changes were made to `api/waste.py`, `lib/foodWeights.ts`, `lib/scrapedItems.ts`, dashboard/finance/food components, the scraper, chatbot, API key configuration, themes or financial badges. The kitchen tracker automatically reads the new advice through its existing shared helper.

## Edit and run

To change dish classifications, edit the root `database.json` (both Python and Next.js use it).

To change the supplied templates, edit `RECOMMENDATIONS_DB` in `recommender.py`, then run:

```bash
python scripts/sync_recommendation_rules.py
```

The frontend uses the generated snapshot so the existing no-backend demo works. This script keeps it aligned with the Python engine; tests verify every database dish's exact low/high template and JSON parity.

Restart Next.js and, if you run it, FastAPI:

```bash
npm run next-dev
# Separate terminal with Python dependencies installed:
python -m uvicorn api.index:app --reload
```

Existing endpoints:

- POST `/api/py/recommendations`: `waste_entries: [[dish, wasted_amount], ...]`, `served_data: {dish: served_amount}`, optional `threshold`. Legacy three-column waste entries are accepted, but their third field is ignored in favor of database.json. The old menu_items/aliases fields are not used by the supplied engine.
- GET `/api/py/waste/mock` and POST `/api/py/waste/analyze`: same financial summary and measured-input schema; recommendations now have the supplied shape (`food_name`, `category`, `dietary`, `waste_ratio`, `formatted_ratio`, `total_wasted`, `total_served`, `recommendation`).

No Gemini or Ollama key/model is used by this recommender. The separate Gemini chatbot is unchanged.

Verification completed: production build and TypeScript pass; 16 frontend tests and 13 Python tests pass. Financial formula, pan/pound equivalence, total-cost reconciliation and endpoint tests remain passing. No browser visual test was run.
