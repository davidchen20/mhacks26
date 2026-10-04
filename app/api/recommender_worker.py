"""JSON stdin/stdout adapter for the supplied food-waste recommender."""

import json
import math
import os
import sys

from recommender import analyze_food_waste


def main() -> int:
    try:
        payload = json.load(sys.stdin)
        items = payload.get("items") if isinstance(payload, dict) else None
        if not isinstance(items, list) or len(items) > 30:
            raise ValueError("items must be a list of at most 30 entries")

        results = []
        model = os.environ.get("OLLAMA_MODEL", "llama3.2")
        for item in items:
            if not isinstance(item, dict):
                continue
            name = item.get("itemName")
            ratio = item.get("wasteRatio")
            wasted = item.get("wasteLbs")
            if not isinstance(name, str) or not name.strip():
                continue
            if isinstance(ratio, bool) or not isinstance(ratio, (int, float)):
                continue
            if isinstance(wasted, bool) or not isinstance(wasted, (int, float)):
                continue
            ratio, wasted = float(ratio), float(wasted)
            if not (0 < ratio <= 1 and wasted > 0 and math.isfinite(wasted)):
                continue

            # App inputs are estimated tray-return percentages and waste weights.
            entries = [(name.strip(), wasted, str(item.get("dietaryCategory", "none")))]
            served = {name.strip(): wasted / ratio}
            generated = analyze_food_waste(
                entries,
                served,
                threshold=0.20,
                model=model,
            )
            if not generated:
                continue
            results.append(
                {
                    **item,
                    "title": generated[0]["recommendation"],
                    "engineSource": generated[0]["engine_source"],
                }
            )

        json.dump({"recommendations": results}, sys.stdout)
        return 0
    except Exception as exc:
        print(f"Recommendation generation failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
