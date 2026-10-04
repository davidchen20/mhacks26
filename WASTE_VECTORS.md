# Kitchen and tray waste update

The archive contains the full code updates, preserving the previous accessibility themes and Gemini chat.

## Formulas and units

`post_consumer_pct` is a number from 0 to 100. Use 20 for 20%, not 0.20. Kitchen units are explicitly `pans` or `lbs` and count only discarded food at service close. Remaining pans that are retained, donated or safely reused are not waste.

```text
plate_lbs = total_served_lbs × post_consumer_pct / 100
kitchen_lbs = unserved_units_wasted × weight_per_pan_lbs   (pans)
kitchen_lbs = unserved_units_wasted                       (lbs)
cost_per_pan = cost_per_lb × weight_per_pan_lbs
plate_dollars = plate_lbs × cost_per_lb
kitchen_dollars = kitchen_lbs × cost_per_lb
               = unserved_pans_wasted × cost_per_pan
total_waste_dollars = plate_dollars + kitchen_dollars
total_waste_lbs = plate_lbs + kitchen_lbs
```

`cost_per_lb` or `cost_per_pan` is required. If both are provided, the model rejects inconsistent costs. Python uses Decimal and rounds each item/vector cost to cents before aggregating. Weight calculations retain precision. Invalid percentages, negative/non-finite measurements, unknown units and zero pan weights receive validation errors.

Annual values are illustrative: `(selected cost / selected calendar days) × 290 equivalent operating days`. Kitchen/tray badges show each vector's share of total **cost**, not its share of pounds. Missing data is excluded and does not mean zero waste. A partial selection does not forecast the complete university budget.

## Backend files and endpoints

- `api/waste.py`: validated `WasteItem`, `WasteService`, `FinancialSummary`, item calculations, unified summaries, and a three-dish example service.
- `recommender.py`: existing legacy functions retained; new `recommend_waste_vectors` and `analyze_waste_vectors` select source-specific advice.
- `api/index.py`: `GET /api/py/waste/mock` and `POST /api/py/waste/analyze` return item calculations, financial summary and source-aware recommendations.
- `app/api/waste/mock/route.ts`: `GET /api/waste/mock?date=2026-09-20&hall=all&meal=all` exposes the **same** shared simulated data used by the UI. Historical dates provide illustrative menus; current missing menus remain unavailable.
- `lib/recommender.ts`: typed `analyzeWasteService` client helper for the Python endpoint.

The Python mock is a separate, explicitly illustrative South Quad dinner fixture. The Next.js mock is the UI-derived dataset; compare equivalent scopes, not these two different fixtures.

POST example:

```json
{
  "hall": "South Quad",
  "date": "2026-10-04",
  "meal": "Dinner",
  "items": [{
    "dish": "Steamed Broccoli",
    "total_served_lbs": 60,
    "post_consumer_pct": 8,
    "unserved_units_wasted": 2.5,
    "unserved_unit": "pans",
    "weight_per_pan_lbs": 10,
    "cost_per_lb": 1.8
  }]
}
```

The returned summary is:

```json
{
  "total_waste_dollars": 53.64,
  "plate_waste_dollars": 8.64,
  "unserved_overproduction_dollars": 45.0,
  "total_waste_lbs": 29.8,
  "plate_waste_lbs": 4.8,
  "unserved_overproduction_lbs": 25.0
}
```

This is $53.64 per service, not per day unless the input covers the complete day. The mock three-item summary is $238.29 per service. Its dishes exercise batch, portion and critical review advice.

## Recommendation rules

| Signal | Action |
| --- | --- |
| Kitchen ≥20%, tray <20% | Trial fewer pans, bounded by observed discarded food; show illustrative food-cost avoidance per service |
| Kitchen <20%, tray ≥20% | Trial 15% smaller scoops, with seconds available |
| Both ≥20% | Critical menu review; investigate demand/preparation and trial up to 35% less production or a reviewed dietary-compatible alternative |
| Both low | Monitor comparable services |

Kitchen rate uses `discarded kitchen lbs / (served lbs + discarded kitchen lbs)`. This denominator assumes all prepared food was served or discarded. If your operation retains/donates food, extend the production logs and denominator with total prepared pounds before interpreting it as the full production waste rate. Tray rate uses returned pounds / served pounds. No-served services cannot create a high tray-waste signal.

Batch trials remove half the observed discarded pans, capped at 20% of prepared weight; their percentage, pan reduction and potential cost avoidance agree. `suggested_change` is a signed fraction: -0.15 means 15% smaller. `change_target` distinguishes portions from production. Critical 35% is a review scenario, not a validated demand forecast. Waste alone does not prove dislike or popularity. Python and TypeScript use matching thresholds/actions. Gemini receives both vectors and the updated source-aware guidance.

## UI changes

- `lib/types.ts`, `lib/foodWeights.ts`, `lib/scrapedItems.ts`, `lib/mockData.ts`: item-level pan weights/costs, served weight, tray percentage, split costs, unified totals and source-aware recommendation titles. Category pan weights and purchase costs are explicitly illustrative. The simulation assumes all unserved portions were discarded at service close and now includes 2–35% kitchen discards to exercise all branches.
- `components/shared/WasteCostSplit.tsx`: reusable annual total with Kitchen Overproduction and Tray Plate Waste badges, actual cost shares, pounds and selected-service dollars. Used in Home and Finances.
- `components/food/KitchenBatchTracker.tsx`: fractional discarded-pan equivalents and dollar values, next to the Live Tray Feed on wide screens; stacks at narrow widths. It is a simulated service-close snapshot, not live kitchen inventory.
- `components/food/ItemWastePanel.tsx`: separate tray/kitchen cost evidence.
- `components/recommendations/RecommendationCard.tsx`, `SlideOver.tsx`, `RecommendationsProvider.tsx`: correct scoop/batch labels, critical-review status and refreshed current recommendation calculations while retaining saved decision history.
- `app/api/chat/route.ts`: includes split waste context; existing chat/persona/theme behavior remains available.

The dashboard uses its shared local mock layer, so Python is optional for viewing the demo. The Python POST endpoint computes submitted measurements without persistence. Connect actual production/tray logs through `analyzeWasteService` when available; this update does not claim to ingest live kitchen sensors.

## Run and test

From the directory containing package.json:

```bash
npm ci
npm run next-dev
```

Open http://localhost:3000. To see a complete illustrative dataset, try `/?range=today&date=2026-09-20` or `/food?hall=south-quad&date=2026-09-20&meal=dinner`. Current-day data depends on published menus.

For Python in a second terminal:

```bash
python -m venv .venv
# Linux/WSL: source .venv/bin/activate
# Windows PowerShell: .venv\Scripts\Activate.ps1
pip install fastapi==0.115.0 'pydantic>=2.8,<3' 'uvicorn[standard]==0.30.6'
python -m uvicorn api.index:app --reload
```

Next.js already proxies `/api/py/*` to port 8000 in development. In production, verify Python hosting and the existing rewrite configuration separately. No new third-party frontend dependency is needed.

```bash
npm run typecheck
npm test
npm run build
pip install httpx
python -m unittest discover -s tests -p test_recommender.py -v
python -m unittest discover -s tests -p test_waste_vectors.py -v
```

Visual/keyboard verification remains manual: test both badges and the batch tracker in every appearance/palette at mobile and desktop widths. The prior browser runtime could not download Chromium; no full WCAG audit is claimed.

Completed verification: 15 frontend tests, 7 legacy recommender tests and 7 waste-vector/backend tests pass; TypeScript and clean production build pass. Home, Food, Finances and Recommendations return HTTP 200. The UI-derived mock endpoint reconciles both waste vectors to total cost. Browser visual/keyboard QA and live Gemini requests remain unverified.
