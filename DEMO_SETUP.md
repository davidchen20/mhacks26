For the connection fix using your October 4 export, follow [QUICK_FIX.md](QUICK_FIX.md) first. Python now automatically reads `.env.demo` and `.env.local`; process environment variables take priority. The token is optional for public reads.

# WolverLean MHacks Demo setup

## Install the file update

Extract `mhacks_demo_spacetime_update.zip` and merge its contents into the repository folder containing `package.json`. Replace the included existing files; preserve all other files. The archive has no extra project-folder nesting. Back up or commit your work first if your local files differ from the uploaded archive.

This cumulative package includes the initial camera/worker integration plus the correction restoring the original Home, Finances, and Recommendations dashboards for MHacks Demo. The three page files are included to REMOVE the previous DemoGate wrappers; Food keeps its demo-only live-feed view. Complete changed component and data-adapter files are included.

New integration files include `api/demo_store.py`, `demo_worker.py`, `lib/demoData.ts`, `lib/useDemoServices.ts`, `components/demo/DemoGate.tsx` (Food only), the two Next.js proxy routes, `requirements-demo.txt`, `.env.demo.example`, tests, this guide. The old Rust reducer template is superseded by your supplied TypeScript module. The included `ai_detection.py` is an unchanged copy of your attachment; put it beside `demo_worker.py` at the project root.

Home, Finances, and Recommendations now use their ORIGINAL components and layout for MHacks Demo. Home retains metric cards, hall chart, needs-attention list, 28-day trend and hall summary. Finances retains annual trajectory, savings scenario, cost evidence, breakdown table/chart and 12-week trend. Recommendations retains pending cards, review drawer, accept/dismiss/undo/reopen history and nutrition insights. Only their demo data source and source-specific labels change. The supplied Food live feed remains available through supporting-item links.

`HALLS` still lists only the six real halls. The new hall ID is recognized independently, so All halls never includes demo captures. Existing mock calculations, real-hall data sources, menu scraping, themes, chatbot and routing configuration remain intact. The recommendation provider additionally refreshes demo candidates as captures arrive; existing-hall actions and decision histories retain their behavior.

## 1. SpacetimeDB — required external configuration

You need the existing database host, database name or identity, and, if required by your instance, a bearer token authorized to read `menu_waste` and call an insertion reducer. Use credentials for your actual instance; do not use the camera URL as the database host. Credentials remain in the Python environment.

Your supplied `index.ts` is the authoritative SpacetimeDB 2.0 module. Keep it in your existing DATABASE module's `src/index.ts`, not Next.js `app/` or `api/index.py`. The application now uses its existing `recordMenuWaste` reducer. No changes to that module or its `waste_summary` table are required. The earlier `insert_demo_observation.rs` template is obsolete; do not add or publish it.

If your uploaded module is already published to the intended database, skip publishing. Otherwise publish it using your existing module project and SpacetimeDB 2.0 CLI. For example, from the parent of that database module project:

```bash
spacetime publish --server YOUR_SERVER --module-path PATH_TO_DB_MODULE --delete-data never YOUR_DATABASE_NAME
```

Replace the placeholders with your existing server, module folder and database. If a schema conflict appears, resolve that migration before publishing; this command does not delete data. CLI reference: https://spacetimedb.com/docs/cli-reference/

Under your module's default SpacetimeDB 2.0 case-conversion policy, TypeScript fields such as `diningHall`, `serviceDate`, and `wastePercent` are canonical SQL fields `dining_hall`, `service_date`, and `waste_percent`. Its exported `recordMenuWaste` is called through HTTP as `record_menu_waste`. The server adapter sends the 16 arguments in exactly the uploaded declaration order:

```
[id_string, food, diningHall, serviceDate, meal, wastePercent,
 observations, simulated, station, name, servingSize,
 calories_option, fiber_option, protein_option, traits, allergens]
```

The worker explicitly sends `diningHall = "MHacks Demo"` and `simulated = false`. Consequently your reducer preserves that hall; it only changes simulated rows to Bursley. Nutrition options are encoded for SATS JSON and decoded into numbers or null for the frontend. Missing nutrition stays unknown; dietary traits and allergens are preserved. Existing numeric IDs in queued worker JSON are converted to strings before upload. New worker results persist string IDs.

The reducer upserts by ID. Retries reuse the persisted ID and percentages and therefore update the same row rather than adding another observation. Database reads query ONLY `menu_waste WHERE dining_hall = 'MHacks Demo'`; `waste_summary` and other halls' rows are not consumed. Arbitrary string IDs are supported on reads; they are never parsed as integers.

The host, database name, and token are not present in your `index.ts`; you still need to supply them through the Python environment below. If the published reducer name is explicitly customized, set the optional `SPACETIMEDB_MENU_REDUCER` environment variable to its actual wire name. The default matches the uploaded module.

HTTP references: https://spacetimedb.com/docs/http/database/

## 2. Camera computer / network

Run the camera script, background worker, and FastAPI on a computer that can reach the phone stream:

```
http://100.64.14.237:4747/video
```

Open the URL from that computer to confirm connectivity. A 100.64.x.x address may require the same private/VPN network as the phone. If your camera app displays a different URL, edit only `STREAM_URL` in `ai_detection.py`. Set the capture computer's timezone to America/New_York; worker filenames are interpreted in that timezone. The camera window needs a desktop/display environment. If WSL OpenCV cannot open a window, run the camera and Python services from Windows instead.

The worker watches `captures/pending` beside its own file. Camera and worker therefore must live in the same project root. Keep only one worker running. Existing pending photos will be processed when it starts; move old pending photos out if you only want fresh captures. Choose `DEMO_MEAL` before starting the worker; persisted retries keep their original meal and percentages.

## 3. Python environment

From the project root, create/activate a virtual environment if needed and install:

```bash
python -m pip install -r requirements.txt -r requirements-demo.txt
```

The existing requirements include the project's original dependencies. The demo additionally uses httpx and timezone data. It does not require a Gemini key or a trained vision model.

Set the following variables in BOTH terminals running FastAPI and the worker. `.env.demo.example` is only a reference; Python does not automatically load it.

Bash / WSL:

```bash
export SPACETIMEDB_HOST="https://YOUR_SPACETIMEDB_HOST"
export SPACETIMEDB_DATABASE="YOUR_DATABASE_NAME_OR_IDENTITY"
export SPACETIMEDB_TOKEN="YOUR_TOKEN"
export DEMO_MEAL="dinner"
```

Windows PowerShell equivalents:

```powershell
$env:SPACETIMEDB_HOST="https://YOUR_SPACETIMEDB_HOST"
$env:SPACETIMEDB_DATABASE="YOUR_DATABASE_NAME_OR_IDENTITY"
$env:SPACETIMEDB_TOKEN="YOUR_TOKEN"
$env:DEMO_MEAL="dinner"
```

Do not commit tokens or put them in a NEXT_PUBLIC variable.

## 4. Next.js configuration

Append this line to `.env.local` beside `package.json`; preserve your existing Gemini key and other settings:

```dotenv
DEMO_FASTAPI_URL=http://127.0.0.1:8000
```

Restart Next.js after changing it. The new `/api/mhacks-demo` and `/api/mhacks-demo/range` routes proxy to FastAPI using this server-only URL. Existing rewrites and CORS settings do not need changes for local testing.

## 5. Start the demo (four separate terminals)

All commands below run from the project root. Activate the same Python environment where applicable. Supply the Python environment variables in terminals 1 and 2.

```bash
# Terminal 1
python -m uvicorn api.index:app --host 127.0.0.1 --port 8000
```

```bash
# Terminal 2
python demo_worker.py
```

```bash
# Terminal 3
python ai_detection.py
```

```bash
# Terminal 4 (npm ci first if dependencies are not installed)
npm run next-dev
```

Go to the dashboard, select MHacks Demo, select today's date and Dinner (or your DEMO_MEAL). Press S in the camera window. A photo goes pending → processing → processed, with its persisted JSON result. The frontend refreshes after each completed request, with a two-second delay before the next poll. No simulated fallback appears if the backend fails. Switching date/meal clears the displayed old scope; leaving demo stops polling.

Direct demo URLs:

- Home: `/?hall=mhacks-demo&meal=dinner`
- Finances: `/finances?hall=mhacks-demo&meal=dinner`
- Recommendations: `/recommendations?hall=mhacks-demo&meal=dinner`
- Food feed: `/food?hall=mhacks-demo&meal=dinner`

Home fetches the selected date's recent history and filters its Today/Yesterday/This week and meal controls locally. Finances fetches up to 84 days for the original 12-week chart. Recommendations fetches the selected date. Polling is scoped only to demo selections; requests stop on departure. Missing history stays a gap, never generated mock history. A failed refresh retains the last successful snapshot for that date range with an error notice; initial failures show no fabricated data.

## 6. Calculation and inference limits

Camera capture is real, database writes are real, but food recognition and waste percentages are random MOCK inference. `simulated=false` is written as requested; the UI and station explicitly disclose mocked inference.

Each food row estimates one standard portion. Portion and ingredient-cost assumptions live in `api/demo_store.py`:

| Food | Portion lbs | Cost per lb |
| --- | ---: | ---: |
| Pizza | 0.25 | $3.00 |
| Steamed Broccoli | 0.1875 | $2.00 |
| Lemon Herb Chicken | 0.25 | $4.50 |

For each dish: served lbs = observations × assumed portion lbs; tray waste lbs = served lbs × waste_percent / 100; tray loss dollars = waste lbs × cost/lb. The API sums these values across the selected captured observations. Percentages are weighted by observation counts. Values are estimates for captured samples, not whole-dining-hall daily totals.

Kitchen waste is unknown (`null`) at the API, not assumed measured zero. Existing UI calculation fields use zero contribution for that unmeasured vector, while the kitchen badge explicitly shows Unavailable. Total dollars cover captured tray waste only.

To preserve the original Home/Finances layout, the existing annual projection and reduction-scenario cards remain. They extrapolate captured tray samples using the same 290-day illustrative formula; they are NOT measured hall-wide annual waste or forecasts. The source notice discloses this coverage. Per-meal metrics become per-captured-portion metrics because the table has no unique meal/guest count.

Demo recommendations are generated from the adapted live service items using the same recommendation function as the other halls. Batch waste is not fabricated; high tray waste leads to portion advice under those existing rules. Pending candidates refresh on new data without duplicating IDs. Accepted/dismissed history retains the evidence at decision time. Nutrition fields are dummy values persisted by the worker and labeled accordingly.

## 7. Hosted website

A hosted Next.js server cannot access FastAPI on your laptop via `127.0.0.1`. For a hosted demo, expose the persistent FastAPI server through a reachable HTTPS endpoint (for example your own server or an HTTPS tunnel), and set DEMO_FASTAPI_URL to that base URL in the hosting environment, then redeploy. Protect exposed services using your existing access controls. Keep the camera and worker running locally on the computer that can reach the phone; they write directly to SpacetimeDB.

Do not put the infinite worker into a serverless request handler. It needs a continuously running process. Frontend browsers never need access to the phone stream or SpacetimeDB token; they call the Next.js proxy.

## 8. Troubleshooting / checks

- No data: check date and meal, worker upload logs, database reducer name and permissions. Nutrition/serving fields must match the schema.
- HTTP 503: set DEMO_FASTAPI_URL and restart/redeploy Next.js.
- HTTP 502: inspect FastAPI terminal logs. Check DB host/token, reducer/table schema, and network connectivity.
- Worker errors: images stay in processing with their JSON for retry. Do not delete the JSON to retry; retaining it preserves IDs and inference results.
- Export food IDs: supported dynamically using serving-size weights where present and category estimates otherwise. Costs remain estimates. Only rows explicitly labeled MHacks Demo are read. Use the included importer to create demo copies of your Bursley export.
- Camera failure: verify STREAM_URL and desktop OpenCV support. Press Q to close it.

Automated checks:

```bash
npm run typecheck
npm test
npm run build
python -m unittest discover -s tests -p 'test_demo*.py' -v
```

Verified for this update: production build/type checking, 21 frontend tests, 14 Python demo/schema tests, mocked FastAPI responses, and type checking of the unchanged uploaded index.ts against spacetimedb 2.0.0.

Live DB/camera connectivity cannot be validated without your host, database name and credentials. End-to-end verification requires your supplied module to be published, taking a capture, confirming its row in menu_waste, and watching it appear under MHacks Demo. Also switch to an existing hall to confirm its original simulated view remains intact.
