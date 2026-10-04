"""Upload completed waste-monitor summaries to the record_summary reducer."""
import argparse
import json
import os
import time
import math
from datetime import datetime
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen


def optional_number(value):
    if value is None:
        return {"none": []}
    number = float(value)
    if not math.isfinite(number) or number < 0:
        raise ValueError("Nutrition values must be nonnegative numbers or null.")
    return {"some": number}


def upload_run(run, server, database, token, metadata=None, service_date=None, meal=None):
    marker = run / "spacetime_uploaded.json"
    if marker.exists():
        uploaded = json.loads(marker.read_text(encoding="utf-8"))
        if (uploaded.get("server") == server and uploaded.get("database") == database
                and uploaded.get("schema_version") == 4):
            return
    # This file is written after summary.json, so its presence signals completion.
    if not (run / "csv_references_used.json").exists():
        return
    summaries = json.loads((run / "summary.json").read_text(encoding="utf-8"))
    if metadata is None:
        metadata = json.loads((Path(__file__).parent / "menu_items.json").read_text(encoding="utf-8-sig"))
    url = f"{server}/v1/database/{quote(database, safe='')}/call/record_menu_waste"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    count = 0
    for summary in summaries:
        percentage = summary.get("mean_waste_percent")
        observations = summary.get("estimated_rows", 0)
        if percentage is None or not observations:
            continue
        simulated = summary.get("simulated", summary.get("scope", "").startswith("Simulated"))
        dining_hall = "MHacks Demo" if simulated else summary.get("dining_hall", "unknown").lower().replace(" ", "-")
        date = summary.get("service_date") or service_date
        service_meal = summary.get("meal") or meal
        if not date or not service_meal:
            raise ValueError("Old summary has no service date/meal. Supply --service-date YYYY-MM-DD --meal breakfast (or the correct meal).")
        if datetime.strptime(date, "%Y-%m-%d").strftime("%Y-%m-%d") != date:
            raise ValueError("Invalid service date.")
        if service_meal not in ("breakfast", "lunch", "brunch", "dinner"):
            raise ValueError("Invalid service meal.")
        item = metadata.get(summary["food"])
        if item is None:
            raise ValueError(f"Add {summary['food']} to menu_items.json before uploading.")
        arguments = [
            f"{run.name}:{summary['food']}",
            summary["food"],
            dining_hall,
            date,
            service_meal,
            float(percentage),
            int(observations),
            simulated,
            item["station"],
            item["name"],
            item["servingSize"],
            optional_number(item.get("calories")),
            optional_number(item.get("fiber")),
            optional_number(item.get("protein")),
            item.get("traits", []),
            item.get("allergens", []),
        ]
        request = Request(url, data=json.dumps(arguments).encode("utf-8"),
                          headers=headers, method="POST")
        try:
            with urlopen(request, timeout=15) as response:
                response.read()
        except HTTPError as error:
            raise RuntimeError(f"HTTP {error.code}: {error.read().decode('utf-8', errors='replace')}") from error
        count += 1
    marker.write_text(json.dumps({"server": server, "database": database, "schema_version": 4,
                                 "uploaded_food_summaries": count}, indent=2), encoding="utf-8")
    print(f"Uploaded {run.name}: {count} food summaries", flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database", required=True)
    parser.add_argument("--server", default="https://maincloud.spacetimedb.com")
    parser.add_argument("--menu-items", type=Path, default=Path(__file__).parent / "menu_items.json")
    parser.add_argument("--service-date", help="Fallback date for older summaries without a service date")
    parser.add_argument("--meal", choices=["breakfast", "lunch", "brunch", "dinner"],
                        help="Fallback meal for older summaries without a meal")
    parser.add_argument("--folder", type=Path,
                        default=Path(__file__).resolve().parent / "geometry_runs")
    args = parser.parse_args()
    server = args.server.rstrip("/")
    token = os.environ.get("SPACETIMEDB_TOKEN")
    print(f"Watching {args.folder} for completed summaries.", flush=True)
    try:
        while True:
            for summary in sorted(args.folder.glob("*/summary.json")):
                try:
                    metadata = json.loads(args.menu_items.read_text(encoding="utf-8-sig"))
                    upload_run(summary.parent, server, args.database, token, metadata, args.service_date, args.meal)
                except (OSError, ValueError, RuntimeError, URLError, KeyError) as error:
                    print(f"Upload pending for {summary.parent.name}: {error}", flush=True)
            time.sleep(5)
    except KeyboardInterrupt:
        print("\nUploader stopped. Unsent summaries remain available for retry.")


if __name__ == "__main__":
    main()
