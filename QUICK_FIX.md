# Restore MHacks Demo data

Your uploaded export contains nine `bursley` rows, all marked simulated. There are no `MHacks Demo` rows in that export. The app intentionally queries only `MHacks Demo`; reading Bursley directly would break the isolation you requested. This update supports the actual food IDs, optional nutrition, and serving sizes from your module/export.

1. Extract the update ZIP into your existing app folder, beside `package.json`. Overwrite the included files. This is a cumulative patch, not a complete replacement repository. No `src` directory is required. Your supplied SpacetimeDB module stays unchanged in its separate module project.
2. Install the Python dependencies:

   ```bash
   python -m pip install -r requirements.txt -r requirements-demo.txt
   ```

3. Copy `.env.demo.example` to `.env.demo` in the app root. Replace the host and database placeholders with your existing instance values. The host is the database server base URL, not a console page or phone camera URL. Leave the token blank for public reads; set an authorized token if your server requires authentication or reducer permissions. In `.env.local`, add:

   ```env
   DEMO_FASTAPI_URL=http://127.0.0.1:8000
   ```

4. Start FastAPI from the app root:

   ```bash
   python -m uvicorn api.index:app --host 127.0.0.1 --port 8000
   ```

   Open http://127.0.0.1:8000/api/py/demo/health. `connected: true` confirms the query worked. `demo_rows: 0` means the connection works but no demo rows exist in the recent 90-day window. Errors now explain missing configuration, unreachable servers, invalid credentials, or incorrect database/schema.

5. Import demo copies of your attached export, then start Next.js:

   ```bash
   python scripts/import_demo_export.py
   python scripts/import_demo_export.py --apply
   npm run next-dev
   ```

   The first command previews the data. `--apply` writes nine new rows through your existing `record_menu_waste` reducer. Original Bursley rows are preserved. Stable prefixed IDs prevent duplicates when rerun. Imported copies use `dining_hall = 'MHacks Demo'` and `simulated = false` because your reducer redirects simulated rows to Bursley. These remain copies of simulated observations, not real AI measurements.

Select **MHacks Demo**, **October 4, 2026**, and **Breakfast** (or All meals). Home, Finance, and Recommendations retain their existing layouts and use the live database results. The export represents 43 food observations and approximately **1.982 lb** of tray waste / **$7.00 estimated ingredient loss**. Prices are category assumptions; the missing Lay's portion uses a 28 g fallback. Nutrition remains unknown where absent. The CSV is used only by the import script; the UI always fetches SpacetimeDB.

For future phone captures, run the existing camera script and `python demo_worker.py` in separate terminals with the same `.env.demo`. Set `DEMO_MEAL` to the meal being captured. New records appear when the UI date/meal includes them.

For a hosted app, replace `DEMO_FASTAPI_URL` with a reachable FastAPI server URL and redeploy. A hosted server cannot reach your laptop through `127.0.0.1`.

The supplied files do not contain your actual database host, name, or credentials. Those settings must be supplied before a real connection can be verified. See `DEMO_SETUP.md` for the full setup and file list.
