"""Adapter for the supplied SpacetimeDB 2.0 TypeScript menu_waste module."""
import math
import os
from collections import defaultdict
from urllib.parse import quote
import httpx

DEMO_HALL = 'MHacks Demo'
# Estimated portion lbs, ingredient $/lb, calories, fiber g, protein g.
FOODS = {
    'Pizza': (0.25, 3.0, 285.0, 2.0, 12.0),
    'Steamed Broccoli': (0.1875, 2.0, 35.0, 2.4, 2.5),
    'Lemon Herb Chicken': (0.25, 4.5, 190.0, 0.0, 28.0),
}
COLUMNS = ('id', 'food', 'dining_hall', 'service_date', 'meal',
           'waste_percent', 'observations', 'simulated', 'station',
           'name', 'serving_size', 'calories', 'fiber', 'protein', 'traits', 'allergens')


def database_url():
    return (os.environ['SPACETIMEDB_HOST'].rstrip('/') + '/v1/database/'
            + quote(os.environ['SPACETIMEDB_DATABASE'], safe=''))


def headers():
    return {'Authorization': 'Bearer ' + os.environ['SPACETIMEDB_TOKEN']}


def encode_option(value):
    # SATS JSON option<f64>; absent values are not zero nutrients.
    return {'none': []} if value is None else {'some': float(value)}


def decode_option(value):
    if value is None or isinstance(value, (int, float)):
        return value
    if isinstance(value, dict):
        if 'some' in value: return value['some']
        if 'Some' in value: return value['Some']
        if 'none' in value or 'None' in value: return None
        if value.get('tag') in {'some', 'Some'}: return value.get('value')
        if value.get('tag') in {'none', 'None'}: return None
    if isinstance(value, list) and len(value) == 2:
        if value[0] == 0: return value[1]
        if value[0] == 1: return None
    raise ValueError('Invalid optional nutrition value')


def insert_observation(record):
    if record['dining_hall'] != DEMO_HALL or record['simulated'] is not False:
        raise ValueError('Worker writes must be MHacks Demo camera observations')
    # Exact declaration order in uploaded recordMenuWaste; canonical wire name
    # is record_menu_waste under the default SpacetimeDB 2.0 case policy.
    args = [str(record['id']), record['food'], DEMO_HALL,
            record['service_date'], record['meal'], record['waste_percent'],
            record['observations'], False, record['station'], record['name'],
            record['serving_size'], encode_option(record.get('calories')),
            encode_option(record.get('fiber')), encode_option(record.get('protein')),
            record.get('traits', []), record.get('allergens', [])]
    reducer = os.environ.get('SPACETIMEDB_MENU_REDUCER', 'record_menu_waste')
    with httpx.Client(timeout=20) as client:
        response = client.post(database_url() + '/call/' + quote(reducer, safe=''),
                               headers=headers(), json=args)
        response.raise_for_status()


def decode_rows(results):
    rows = []
    aliases = {'diningHall': 'dining_hall', 'serviceDate': 'service_date',
               'wastePercent': 'waste_percent', 'servingSize': 'serving_size'}
    for statement in results:
        for values in statement['rows']:
            row = ({aliases.get(key, key): value for key, value in values.items()}
                   if isinstance(values, dict) else dict(zip(COLUMNS, values, strict=True)))
            row['id'] = str(row['id'])
            if row['dining_hall'] != DEMO_HALL:
                raise ValueError('Database returned an unexpected dining hall')
            for key in ('calories', 'fiber', 'protein'):
                row[key] = decode_option(row[key])
            row.setdefault('traits', [])
            row.setdefault('allergens', [])
            rows.append(row)
    # String IDs are arbitrary; numeric-only IDs are NOT required by the module.
    return sorted(rows, key=lambda row: (row['service_date'], row['meal'], row['id']))


def query_observations(service_date, meal):
    # Validate here as well as at the API boundary before constructing SQL.
    from datetime import date
    service_date = date.fromisoformat(service_date).isoformat()
    if meal not in {'all', 'breakfast', 'brunch', 'lunch', 'dinner'}:
        raise ValueError('Invalid meal')
    sql = (f"SELECT {', '.join(COLUMNS)} FROM menu_waste "
           "WHERE dining_hall = 'MHacks Demo' "
           f"AND service_date = '{service_date}'")
    if meal != 'all':
        sql += f" AND meal = '{meal}'"
    with httpx.Client(timeout=20) as client:
        response = client.post(database_url() + '/sql',
            headers={**headers(), 'Content-Type': 'text/plain'}, content=sql)
        response.raise_for_status()
    return decode_rows(response.json())


def summarize(rows):
    dishes = defaultdict(lambda: dict(observations=0, served_lbs=0.0,
                                     waste_lbs=0.0, waste_dollars=0.0))
    for row in rows:
        if row['dining_hall'] != DEMO_HALL:
            raise ValueError('Unexpected dining hall')
        if row['food'] not in FOODS:
            raise ValueError('Missing portion/cost assumptions: ' + row['food'])
        portion_lbs, cost_per_lb, *_ = FOODS[row['food']]
        pct = float(row['waste_percent'])
        n_raw = row['observations']
        n = int(n_raw)
        if (isinstance(n_raw, bool) or n != float(n_raw) or n < 1
                or not math.isfinite(pct) or not 0 <= pct <= 100):
            raise ValueError('Invalid stored observation')
        served = n * portion_lbs
        wasted = served * pct / 100
        dish = dishes[row['food']]
        dish['observations'] += n
        dish['served_lbs'] += served
        dish['waste_lbs'] += wasted
        dish['waste_dollars'] += wasted * cost_per_lb
    items, recommendations = [], []
    for food, dish in dishes.items():
        pct = 100 * dish['waste_lbs'] / dish['served_lbs']
        items.append(dict(food=food, waste_percent=pct, **dish))
        if pct > 20:
            recommendations.append(dict(dish=food, waste_percent=pct, reason=(
                'High observed tray waste; trial smaller portions and review.'
                if pct > 30 else
                'Monitor tray waste and trial a modest portion adjustment.')))
    dollars = sum(d['waste_dollars'] for d in dishes.values())
    return dict(items=items, recommendations=recommendations, summary=dict(
        observations=sum(d['observations'] for d in dishes.values()),
        total_served_lbs=sum(d['served_lbs'] for d in dishes.values()),
        total_waste_lbs=sum(d['waste_lbs'] for d in dishes.values()),
        plate_waste_dollars=dollars,
        unserved_overproduction_dollars=None,
        total_waste_dollars=dollars,
        scope='Captured tray observations only'))


def food_specs():
    categories = {'Pizza': 'Grains', 'Steamed Broccoli': 'Produce',
                  'Lemon Herb Chicken': 'Protein'}
    return {food: dict(portion_lbs=values[0], cost_per_lb=values[1],
                       category=categories[food]) for food, values in FOODS.items()}


def query_observations_range(date_from, date_to):
    from datetime import date
    first, last = date.fromisoformat(date_from), date.fromisoformat(date_to)
    if not 0 <= (last - first).days <= 89:
        raise ValueError('Demo range must be between 1 and 90 days')
    sql = (f"SELECT {', '.join(COLUMNS)} FROM menu_waste "
           "WHERE dining_hall = 'MHacks Demo' "
           f"AND service_date >= '{first.isoformat()}' "
           f"AND service_date <= '{last.isoformat()}'")
    with httpx.Client(timeout=20) as client:
        response = client.post(database_url() + '/sql',
            headers={**headers(), 'Content-Type': 'text/plain'}, content=sql)
        response.raise_for_status()
    return decode_rows(response.json())
