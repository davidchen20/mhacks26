# WolverLean

M Dining menus with simulated waste analytics, using the existing WolverLean visual system.
The web dashboard does **not** ingest camera measurements. The separate Python camera
prototype remains in this repository and is not wired to the dashboard.

## Run the app

Requires Node 20+ and Python 3.10+ (Python is only needed to refresh menus).

```bash
npm ci
npm run next-dev
```

Open http://localhost:3000. `npm run dev` also starts the existing optional FastAPI
prototype and installs its larger camera dependencies; that is not needed for the dashboard.

For the supplied Saturday snapshot, set this in `.env.local` before starting Next:

```dotenv
NEXT_PUBLIC_DEMO_DATE=2026-10-03
```

Without an override, `getToday()` uses the current **America/Detroit** calendar date.
The public override is compiled into a production build: rebuild when changing it.
The committed JSON includes genuine menus scraped for 2026-10-03, not a fabricated
fallback. On a later date, refresh menus or explicitly enable the demo date; old
menus never silently become today's menus. Refresh an open tab when the calendar
crosses midnight. The root layout is dynamic, so new requests do not freeze today's
policy at build time.

## Refresh real menus

```bash
python -m pip install -r scripts/requirements.txt
python scripts/scrape_all.py
# Explicit demo snapshot:
python scripts/scrape_all.py --date 2026-10-03
```

The script imports `fetch_menu` from root `scraper.py`. Halls map to Bursley,
South Quad, East Quad, Mosher-Jordan, Markley, and `twigs` → `twigs-at-oxford`.
It waits one second between halls/retries, retries failures (in addition to the
scraper's HTTP retries), skips failed halls, and atomically replaces
`lib/scrapedMenus.json`. Today's failed slots are removed so a failure is visible;
other dates are retained for at most 14 date slots per hall. `lib/scrapeStatus.json`
records the attempt time and individual failures. An unpublished/empty menu is unavailable.

The raw Bursley output was inspected before implementing the adapter. Observed keys:
`nutrition.serving_size`, `nutrition.calories`, `nutrition.dietary_fiber`,
`nutrition.protein`. For example Oatmeal had `Cups (253g)`, 183 calories, `5g`
fiber and `6g` protein. `scripts/scrape_all.py` normalizes those exact keys to:

```ts
interface ScrapedItem {
  station: string;
  name: string;
  servingSize: string | null;
  calories: number | null;
  fiber: number | null;
  protein: number | null;
  traits: string[];
  allergens: string[];
}
// { [hallId]: { [date]: { [meal]: ScrapedItem[] } } }
```

Only breakfast/brunch/lunch/dinner are stored. The site can publish Breakfast on
weekends; the requested UI policy intentionally uses **Brunch/Dinner** on weekends
and **Breakfast/Lunch/Dinner** on weekdays. Raw Breakfast rows are preserved but
excluded from weekend dashboard totals.

### Daily deployment

`.github/workflows/refresh-menus.yml` runs daily at 10:15 UTC (05:15 EST / 06:15 EDT)
and can be started manually. It installs only scraper dependencies, refreshes all
halls, and commits both JSON files. Enable Actions and allow workflow write access
to the repository; protected branches may need a bot exception or a PR-based variant.
Configure a repository Actions secret named **DEPLOY_HOOK_URL** using your hosting
provider's deployment hook. The final step POSTs that hook after pushing the new
snapshot. A configured hosting Git integration can also deploy commits; the hook
is the explicit mechanism when bot commits do not trigger another workflow.
The ZIP does not configure GitHub secrets or deploy a public site. Enable the
workflow after adding this project to your GitHub repository.

## Date and missing-data contract

- **Today:** only real items from the committed scraper snapshot; prepared/served
  counts and remaining percentages are simulated, seeded by hall + date + meal +
  normalized item ID. UI: `Menu from M Dining · waste readings simulated`.
- **Past:** fully illustrative, deterministic menu/reading/nutrition generation.
  UI: `Illustrative data`. This is not a historical menu archive even if older
  scraped dates exist in the JSON.
- **Future:** no menus, metrics, charts or recommendations, including when raw JSON
  already has that date. UI: `No data for future dates`.
- Missing current menus: `Unavailable: menu not published or scrape failed`.
  Halls have a derived `reporting` getter. Missing is never displayed as zero.
- A service without any supported categorized items is also unavailable. Totals
  cover **up to 12 tracked items per service**, not every ingredient the hall offers.
  Missing services are omitted with a visible partial-coverage label.
- Home's "This week" is the existing trailing seven-day range. Week controls include
  All/Breakfast/Lunch/Brunch/Dinner; single-day options follow the calendar.
  Invalid meal URLs correct to All with an inline notice. Trend points and their
  moving average are null on days with no matching meal. Historical trends and
  comparisons visibly disclose illustrative data.

## Weight and cost model: `lib/foodWeights.ts`

One resolver is used when building every MenuItem. All dashboards aggregate those
item metrics; trays use the same resolved portion weight. No random gram weights.

Resolution order:
1. Explicit grams or ounces in the serving string (including parenthetical grams).
2. Volume × estimated food-specific density. 8 fl oz = 1 cup. An unspecified
   scoop or ladle is assumed to be 1/2 cup; these are marked estimated.
3. Keyword overrides, then category defaults (both labeled `est. category default`).

| Food type | Grams/cup, estimated |
| --- | ---: |
| Leafy greens | 30 |
| Cooked vegetables | 150 |
| Cooked rice | 195 |
| Cooked pasta | 140 |
| Yogurt/dairy | 245 |
| Cooked meat | 140 |
| Soups | 240 |
| Beans/lentils | 175 |
| Fruit | 150 |

Keyword fallbacks: soup 8 oz; pizza slice 4.3 oz; bread/toast 1 oz; egg 1.8 oz;
leafy salad 1.5 oz. Defaults: Protein 4 oz; Produce 3 oz; Grains 5 oz; Dairy 6 oz.
1 oz = 28.349523125 g. These are documented engineering estimates, not verified
recipe-specific densities; replace the table with weighed operational values when available.

| Category | Illustrative purchase cost/lb |
| --- | ---: |
| Protein | $4.50 |
| Produce | $2.00 |
| Grains | $1.20 |
| Dairy | $2.50 |

Each item stores `standardPortionOz`, `weightSource`, `portionsPrepared`,
`portionsServed`, `unservedLbs`, `plateWasteLbs`, `wasteLbs`, and `wasteCost`.
Served portions are seeded at 85–98% of prepared. All calculations retain full
precision; formatters round only for display, so visible rounded rows may differ
slightly from displayed totals.

```text
unservedLbs   = (portionsPrepared - portionsServed) * standardOz / 16
plateWasteLbs = portionsServed * standardOz * remainingPct / 100 / 16
wasteLbs      = unservedLbs + plateWasteLbs
wasteCost     = wasteLbs * costPerLb(category)
trayItemOz   = standardOz * trayRemainingPct / 100
trayItemG    = trayItemOz * 28.349523125
```

Guest count (`mealsServed`) is simulated as the largest served-item count within a
service. It is **not** the sum of item portions. Per-meal rates and annual scenarios
are illustrative until real counts and procurement prices are connected. Annual
scenarios multiply the selected daily service cost by 290 equivalent operating days.

## Food Data and recommendations

Food selection is stored in `?item=` and highlights the menu row and matching tray
readings. "Waste by item" shows counts, portion-weight provenance, NOT-served lbs,
plate waste, total lbs and cost. The daily panel ignores the meal selector, sums all
scheduled meals, and switches between the selected hall and all halls. Its stacked
bars have a hidden exact-value table; its item table sorts by any heading and links
back to the matching hall/date/meal/item. Unavailable meals have no bar.

Recommendations choose the highest-waste item from each hall with available items.
Suggestions are generated by category. Nutrition ranking uses:

```text
densityScore = min(5, round(25 * (2 * fiberGrams + proteinGrams) / calories, 1))
rankingScore = remainingPct * densityScore
```

This is an operational ranking proxy, **not a clinical nutrient-density standard**.
Missing nutrients stay null; insufficient nutrition makes density unknown and
excludes the item from nutrition insights. A score >=3 is labeled high. Insights
require simulated remaining percentage above the monitor threshold in `lib/status.ts`.
All insights retain: **AI-generated mock insights, manager review required, no medical claims**.
Old v1 mock recommendation storage is intentionally not loaded; v2 decisions persist
locally and do not change dining production. The selected scope filters history.

## Architecture and styling

- **Server:** `app/*/page.tsx` wrappers, root layout, and `app/api/menu/route.ts`.
  The API serves the same date-policy data as the UI, not an on-demand Python process.
- **Client:** Home/Food/Finance/Recommendations dashboards, selectors, item/day panels,
  charts, tray feed, and recommendation provider. Query clients sit inside Suspense.
- **Pure shared modules:** `lib/dates.ts`, `random.ts`, `types.ts`, `foodWeights.ts`,
  `scrapedItems.ts`, and `mockData.ts`. The last filename is retained for compatibility
  but now owns the real-vs-illustrative policy. JSON is bundled at build time.
- Existing navy/maize tokens, `.panel`, `.btn`, `.input`, DataTable, SegmentedControl,
  KpiTile, EmptyState, and status thresholds are reused. Text is at least 13px;
  controls at least 40px; status uses text/icons; charts retain table alternatives.

## Validation

```bash
npm test
npm run typecheck
npm run lint
npm run build
python -m unittest discover -s tests -p 'test_*.py'
```

Unit tests cover weight precedence, volume conversion, fractions, fallbacks, mass/cost
reconciliation, category exclusions, real nutrition, deterministic seeds, menu caps,
missing/future date policy, Saturday/week controls, Detroit timezone and URL correction.
A production build and browser checks should be rerun after changing dependencies or
integration settings. No real waste sensor, procurement database, or measured food-density
calibration has been connected in this version.
