from recommender import analyze_food_waste, load_food_database
from api.waste import calculate_item


def analyze_waste_vectors(items):
    # Total waste includes both recorded vectors; same-weight denominator is served lbs.
    database = load_food_database('database.json')
    entries = [(i.dish, calculate_item(i)['total_waste_lbs']) for i in items]
    served = {}
    for i in items:
        served[i.dish] = served.get(i.dish, 0) + i.total_served_lbs
    return analyze_food_waste(entries, served, database)
