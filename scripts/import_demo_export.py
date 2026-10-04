"""Copy only the specified CSV export into MHacks Demo; leave originals intact."""
import argparse
import csv
import json
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from api.demo_store import insert_observation, decode_option, DEMO_HALL


def export_records(path):
    records = []
    with Path(path).open(encoding='utf-8-sig', newline='') as handle:
        for row in csv.DictReader(handle):
            record = dict(row)
            record.update(id='mhacks-demo:import:' + row['id'], dining_hall=DEMO_HALL,
                          simulated=False, waste_percent=float(row['waste_percent']),
                          observations=int(row['observations']))
            for field in ('calories', 'fiber', 'protein'):
                raw = row.get(field, '')
                record[field] = decode_option(json.loads(raw)) if raw else None
            for field in ('traits', 'allergens'):
                record[field] = json.loads(row.get(field) or '[]')
            records.append(record)
    return records


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('csv', nargs='?', default=str(Path(__file__).with_name('demo_export.csv')))
    parser.add_argument('--apply', action='store_true', help='Upsert demo copies in SpacetimeDB')
    args = parser.parse_args()
    records = export_records(args.csv)
    print(f'{len(records)} demo rows; {sum(r["observations"] for r in records)} food observations')
    for record in records:
        print(f'{record["service_date"]} {record["meal"]}: {record["name"]} ({record["waste_percent"]}%)')
    if not args.apply:
        print('Preview only. Add --apply to upload these copies; original rows stay unchanged.')
        return
    for record in records:
        insert_observation(record)
    print('Uploaded MHacks Demo copies. Select the listed date and meal (or All).')


if __name__ == '__main__': main()
