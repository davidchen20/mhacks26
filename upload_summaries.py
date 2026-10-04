"""Upload completed waste-monitor summaries to the record_summary reducer."""
import argparse
import json
import os
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen


def upload_run(run, server, database, token):
    marker = run / "spacetime_uploaded.json"
    if marker.exists():
        uploaded = json.loads(marker.read_text(encoding="utf-8"))
        if uploaded.get("server") == server and uploaded.get("database") == database:
            return
    # This file is written after summary.json, so its presence signals completion.
    if not (run / "csv_references_used.json").exists():
        return
    summaries = json.loads((run / "summary.json").read_text(encoding="utf-8"))
    url = f"{server}/v1/database/{quote(database, safe='')}/call/record_summary"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    count = 0
    for summary in summaries:
        percentage = summary.get("mean_waste_percent")
        observations = summary.get("estimated_rows", 0)
        if percentage is None or not observations:
            continue
        arguments = [
            f"{run.name}:{summary['food']}",
            summary["food"],
            float(percentage),
            int(observations),
            summary.get("scope", "").startswith("Simulated"),
        ]
        request = Request(url, data=json.dumps(arguments).encode("utf-8"),
                          headers=headers, method="POST")
        try:
            with urlopen(request, timeout=15) as response:
                response.read()
        except HTTPError as error:
            raise RuntimeError(f"HTTP {error.code}: {error.read().decode('utf-8', errors='replace')}") from error
        count += 1
    marker.write_text(json.dumps({"server": server, "database": database,
                                 "uploaded_food_summaries": count}, indent=2), encoding="utf-8")
    print(f"Uploaded {run.name}: {count} food summaries", flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database", required=True)
    parser.add_argument("--server", default="https://maincloud.spacetimedb.com")
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
                    upload_run(summary.parent, server, args.database, token)
                except (OSError, ValueError, RuntimeError, URLError) as error:
                    print(f"Upload pending for {summary.parent.name}: {error}", flush=True)
            time.sleep(5)
    except KeyboardInterrupt:
        print("\nUploader stopped. Unsent summaries remain available for retry.")


if __name__ == "__main__":
    main()
