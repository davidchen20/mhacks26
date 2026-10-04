#!/usr/bin/env python3
"""Refresh committed menus. Only scrape the Detroit date (or explicit demo date).
Raw schema verified against Bursley 2026-10-03: nutrition.serving_size,
calories, dietary_fiber, protein. Missing nutrition remains JSON null.
"""
import argparse
import json
import os
import re
import sys
import time
from datetime import datetime, date
from pathlib import Path
from zoneinfo import ZoneInfo
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from scraper import fetch_menu
HALLS = {'bursley':'bursley','south-quad':'south-quad','east-quad':'east-quad',
         'mosher-jordan':'mosher-jordan','markley':'markley','twigs':'twigs-at-oxford'}
MEALS = {'breakfast', 'brunch', 'lunch', 'dinner'}


def numeric(value):
    if value is None:
        return None
    match = re.search(r'\d+(?:\.\d+)?', str(value))
    return float(match.group()) if match else None


def normalize_menu(raw):
    result = {}
    for meal, stations in raw.get('meals', {}).items():
        if meal.lower() not in MEALS:
            continue
        items = []
        for station, entries in stations.items():
            for item in entries:
                if not item.get('name'):
                    continue
                nutrition = item.get('nutrition') or {}
                items.append({'station':station, 'name':item['name'],
                              'servingSize':nutrition.get('serving_size'),
                              'calories':numeric(nutrition.get('calories')),
                              'fiber':numeric(nutrition.get('dietary_fiber')),
                              'protein':numeric(nutrition.get('protein')),
                              'traits':item.get('traits', []), 'allergens':item.get('allergens', [])})
        if items:
            result[meal.lower()] = items
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--date', default=os.environ.get('NEXT_PUBLIC_DEMO_DATE') or datetime.now(ZoneInfo('America/Detroit')).date().isoformat())
    parser.add_argument('--output', type=Path, default=ROOT/'lib/scrapedMenus.json')
    args = parser.parse_args()
    date.fromisoformat(args.date)
    output, failures, successes = {}, {}, []
    # Preserve other dates; never move old data into today's slot or retain failed today's slots.
    if args.output.exists():
        output = json.loads(args.output.read_text())
    for index, (hall, slug) in enumerate(HALLS.items()):
        if index:
            time.sleep(1)
        output.setdefault(hall, {}).pop(args.date, None)
        for attempt in range(2):
            try:
                raw = fetch_menu(slug, args.date)  # fetch_menu also retries HTTP failures.
                meals = normalize_menu(raw)
                if not meals:
                    raise ValueError('menu not published or empty')
                output[hall][args.date] = meals
                successes.append(hall)
                print(f'{hall}: {sum(map(len, meals.values()))} items', flush=True)
                break
            except Exception as exc:
                if attempt == 0:
                    time.sleep(1)
                else:
                    failures[hall] = str(exc)
                    print(f'{hall}: unavailable ({exc})', file=sys.stderr, flush=True)
        # Bound the static bundle to two weeks of previously successful menus.
        output[hall] = dict(sorted(output[hall].items(), reverse=True)[:14])
    args.output.parent.mkdir(parents=True, exist_ok=True)
    temporary = args.output.with_suffix('.tmp')
    temporary.write_text(json.dumps(output, indent=2) + '\n')
    temporary.replace(args.output)
    args.output.with_name('scrapeStatus.json').write_text(json.dumps({
        'attemptedAt':datetime.now(ZoneInfo('UTC')).isoformat(), 'date':args.date,
        'successfulHalls':successes, 'failures':failures}, indent=2)+'\n')

if __name__ == '__main__':
    main()
