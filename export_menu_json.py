"""Export the public menu_waste table as hall -> service date -> meal -> items."""
import argparse
import json
import math
import time
from pathlib import Path
from urllib.parse import quote
from urllib.request import Request, urlopen


def optional_number(value, field="number"):
    """Decode nullable numbers from SDK values and SATS JSON representations."""
    if isinstance(value, dict):
        if "none" in value or "1" in value:
            return None
        if "some" in value:
            return optional_number(value["some"], field)
        if "0" in value:
            return optional_number(value["0"], field)
        raise ValueError(f"{field}: unrecognized numeric object {value!r}")
    if isinstance(value, list):
        if not value:
            return None
        if len(value) == 1:
            return optional_number(value[0], field)
        if len(value) == 2 and value[0] in (0, 1):
            return None if value[0] == 1 else optional_number(value[1], field)
        raise ValueError(f"{field}: unrecognized numeric list {value!r}")
    if value is None:
        return None
    try:
        number = float(value)
    except (TypeError, ValueError) as error:
        raise ValueError(f"{field}: expected a number, received {value!r}") from error
    if not math.isfinite(number):
        raise ValueError(f"{field}: expected a finite number, received {value!r}")
    return number


def format_menu_rows(rows):
    groups = {}
    for row in rows:
        hall = row["diningHall"]
        key = (hall, row["serviceDate"], row["meal"], row["food"], row["simulated"])
        weight = int(row["observations"])
        percentage = optional_number(row["wastePercent"], "wastePercent")
        if percentage is None:
            raise ValueError("wastePercent is missing.")
        if weight <= 0 or not math.isfinite(percentage):
            raise ValueError("Invalid waste observation.")
        if key not in groups:
            groups[key] = {"row": row, "observations": 0, "weighted": 0}
        group = groups[key]
        group["row"] = row
        group["observations"] += weight
        group["weighted"] += percentage * weight
    result = {}
    for (hall, date, meal, food, simulated), group in sorted(groups.items()):
        row = group["row"]
        item = {
            "station": row["station"],
            "name": row["name"],
            "servingSize": row["servingSize"],
            "calories": optional_number(row.get("calories"), "calories"),
            "fiber": optional_number(row.get("fiber"), "fiber"),
            "protein": optional_number(row.get("protein"), "protein"),
            "traits": row["traits"],
            "allergens": row["allergens"],
            "foodId": food,
            "wastePercent": round(group["weighted"] / group["observations"], 2),
            "observations": group["observations"],
            "simulated": simulated,
        }
        result.setdefault(hall, {}).setdefault(date, {}).setdefault(meal, []).append(item)
    return result


def export_once(database, server, output_file):
    url = f"{server.rstrip('/')}/v1/database/{quote(database, safe='')}/sql"
    request = Request(url, data=b"SELECT * FROM menu_waste", method="POST",
                      headers={"Content-Type": "text/plain"})
    with urlopen(request, timeout=15) as response:
        tables = json.loads(response.read())
    table = tables[0]
    names = [field["name"] if isinstance(field["name"], str) else field["name"]["some"]
             for field in table["schema"]["elements"]]
    # SQL responses use wire column names; SDK rows use camelCase.
    aliases = {"dining_hall": "diningHall", "service_date": "serviceDate",
               "waste_percent": "wastePercent", "serving_size": "servingSize"}
    names = [aliases.get(name, name) for name in names]
    rows = [dict(zip(names, values)) for values in table["rows"]]
    output = format_menu_rows(rows)
    content = json.dumps(output, indent=2, ensure_ascii=False) + "\n"
    if output_file.exists() and output_file.read_text(encoding="utf-8") == content:
        return False
    output_file.parent.mkdir(parents=True, exist_ok=True)
    temporary = output_file.with_suffix(output_file.suffix + ".tmp")
    temporary.write_text(content, encoding="utf-8")
    temporary.replace(output_file)
    print("Updated:", output_file.resolve(), flush=True)
    return True


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database", required=True)
    parser.add_argument("--server", default="https://maincloud.spacetimedb.com")
    parser.add_argument("--output", type=Path, default=Path("menu_waste.json"))
    parser.add_argument("--watch", action="store_true", help="Keep exporting automatically when database data changes")
    parser.add_argument("--interval", type=float, default=5, help="Seconds between checks in watch mode (default 5)")
    args = parser.parse_args()
    if not math.isfinite(args.interval) or args.interval <= 0:
        parser.error("--interval must be a positive number.")
    if not args.watch:
        export_once(args.database, args.server, args.output)
        return
    print(f"Watching database {args.database}; checking every {args.interval:g} seconds. Ctrl+C to stop.", flush=True)
    try:
        while True:
            try:
                export_once(args.database, args.server, args.output)
            except (OSError, ValueError, KeyError, IndexError, TypeError) as error:
                print(f"Export pending; keeping the previous JSON and retrying: {error}", flush=True)
            time.sleep(args.interval)
    except KeyboardInterrupt:
        print("\nExporter stopped.")


if __name__ == "__main__":
    main()
