import math
import os
from collections import defaultdict
from urllib.parse import quote

import httpx

DEMO_HALL = "MHacks Demo"

# portion_lbs, cost_per_lb, calories, fiber_g, protein_g
FOODS = {
    "Pizza": (0.25, 3.00, 285.0, 2.0, 12.0),
    "Chips": (0.1875, 2.00, 35.0, 2.4, 2.5),
    #"Lemon Herb Chicken": (0.25, 4.50, 190.0, 0.0, 28.0),
}

COLUMNS = (
    "id", "food", "dining_hall", "service_date", "meal",
    "waste_percent", "observations", "simulated", "station",
    "name", "serving_size", "calories", "fiber", "protein",
)


def database_url():
    host = os.environ["SPACETIMEDB_HOST"].rstrip("/")
    database = quote(os.environ["SPACETIMEDB_DATABASE"], safe="")
    return f"{host}/v1/database/{database}"


def headers():
    return {"Authorization": f"Bearer {os.environ['SPACETIMEDB_TOKEN']}"}


def insert_observation(record):
    # Exact positional arguments for insert_demo_observation above.
    args = [
        record["id"], record["food"], record["service_date"],
        record["meal"], record["waste_percent"], record["serving_size"],
        record["calories"], record["fiber"], record["protein"],
    ]
    with httpx.Client(timeout=20) as client:
        response = client.post(
            f"{database_url()}/call/insert_demo_observation",
            headers=headers(),
            json=args,
        )
        response.raise_for_status()


def query_observations(service_date, meal):
    # service_date and meal are validated by the FastAPI endpoint.
    query = (
        f"SELECT {', '.join(COLUMNS)} FROM menu_waste "
        f"WHERE dining_hall = 'MHacks Demo' "
        f"AND service_date = '{service_date}'"
    )
    if meal != "all":
        query += f" AND meal = '{meal}'"

    with httpx.Client(timeout=20) as client:
        response = client.post(
            f"{database_url()}/sql",
            headers={**headers(), "Content-Type": "text/plain"},
            content=query,
        )
        response.raise_for_status()

    rows = []
    for result in response.json():
        for values in result["rows"]:
            row = dict(zip(COLUMNS, values, strict=True))
            row["id"] = str(row["id"])  # Safe for JavaScript.
            rows.append(row)

    return rows


def summarize(rows):
    dishes = defaultdict(lambda: {
        "observations": 0,
        "served_lbs": 0.0,
        "waste_lbs": 0.0,
        "waste_dollars": 0.0,
    })

    for row in rows:
        if row["dining_hall"] != DEMO_HALL:
            raise ValueError("Unexpected dining hall")
        if row["food"] not in FOODS:
            raise ValueError(f"Missing cost/portion assumptions: {row['food']}")

        portion_lbs, cost_per_lb, *_ = FOODS[row["food"]]
        pct = float(row["waste_percent"])
        observations = int(row["observations"])
        if not math.isfinite(pct) or not 0 <= pct <= 100 or observations < 1:
            raise ValueError("Invalid stored observation")

        # Do not average percentages without weighting observation counts.
        served_lbs = observations * portion_lbs
        wasted_lbs = served_lbs * pct / 100
        dish = dishes[row["food"]]
        dish["observations"] += observations
        dish["served_lbs"] += served_lbs
        dish["waste_lbs"] += wasted_lbs
        dish["waste_dollars"] += wasted_lbs * cost_per_lb

    items = []
    recommendations = []
    for food, dish in dishes.items():
        pct = 100 * dish["waste_lbs"] / dish["served_lbs"]
        items.append({"food": food, "waste_percent": pct, **dish})
        if pct > 20:
            recommendations.append({
                "dish": food,
                "waste_percent": pct,
                "reason": (
                    "High observed tray waste; trial smaller portions and review."
                    if pct > 30 else
                    "Monitor tray waste and trial a modest portion adjustment."
                ),
            })

    plate_dollars = sum(d["waste_dollars"] for d in dishes.values())
    return {
        "items": items,
        "recommendations": recommendations,
        "summary": {
            "observations": sum(d["observations"] for d in dishes.values()),
            "total_served_lbs": sum(d["served_lbs"] for d in dishes.values()),
            "total_waste_lbs": sum(d["waste_lbs"] for d in dishes.values()),
            "plate_waste_dollars": plate_dollars,
            # Camera observations contain no kitchen-discard measurements.
            "unserved_overproduction_dollars": None,
            "total_waste_dollars": plate_dollars,
            "scope": "Captured tray observations only",
        },
    }