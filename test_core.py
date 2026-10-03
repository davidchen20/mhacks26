"""Run with python test_core.py; no camera or ML packages needed."""
import copy
import csv
import tempfile
import unittest
from pathlib import Path
from waste_monitor import DEFAULT_FOODS, default_config, validate_foods, read_servings, summarize, Tracker

PIZZA = 'dominos_cheese_pizza_slice'
COOKIE = 'costco_oatmeal_raisin_cookie'
DORITOS = 'doritos_nacho_cheese'


class CoreTests(unittest.TestCase):
    def setUp(self):
        self.foods = copy.deepcopy(DEFAULT_FOODS)

    def test_only_requested_menu_and_sources(self):
        self.assertEqual(set(self.foods), {PIZZA, COOKIE, DORITOS})
        self.assertAlmostEqual(self.foods[PIZZA]['serving_g'], 61 + 1.8 + 21 + 37)
        self.assertEqual(self.foods[DORITOS]['serving_g'], 28)
        # Values from the newly supplied cookie nutrition screenshot.
        self.assertEqual(self.foods[COOKIE]['serving_g'], 50)
        self.assertEqual(self.foods[COOKIE]['serving_kcal'], 230)
        validate_foods(self.foods)

    def test_pizza_denominator_includes_fully_eaten_slices(self):
        rows = summarize([{'item': PIZZA, 'estimated_waste_g': 120.8}],
                         {PIZZA: 10}, self.foods)
        pizza = next(r for r in rows if r['item'] == PIZZA)
        self.assertEqual(pizza['estimated_waste_percent'], 10)
        self.assertEqual(pizza['estimated_waste_g_per_serving'], 12.08)

    def test_doritos_denominator_uses_28g_portions(self):
        rows = summarize([{'item': DORITOS, 'estimated_waste_g': 14}],
                         {DORITOS: 2}, self.foods)
        doritos = next(r for r in rows if r['item'] == DORITOS)
        self.assertEqual(doritos['estimated_waste_percent'], 25)
        self.assertEqual(doritos['estimated_waste_g_per_serving'], 7)

    def test_missing_cookie_weight_is_handled(self):
        self.foods[COOKIE]['serving_g'] = None
        rows = summarize([{'item': COOKIE, 'estimated_waste_g': 10}],
                         {COOKIE: 2}, self.foods)
        cookie = next(r for r in rows if r['item'] == COOKIE)
        self.assertEqual(cookie['estimated_waste_g_per_serving'], 5)
        self.assertIsNone(cookie['estimated_waste_percent'])
        self.assertEqual(cookie['status'], 'missing_serving_weight')

    def test_cookie_uses_screenshot_serving_weight(self):
        rows = summarize([{'item': COOKIE, 'estimated_waste_g': 25}],
                         {COOKIE: 2}, self.foods)
        cookie = next(r for r in rows if r['item'] == COOKIE)
        self.assertEqual(cookie['estimated_waste_percent'], 25)

    def test_cookie_nutrition_transcription(self):
        self.assertEqual(self.foods[COOKIE]['nutrition_per_serving'], {
            'total_fat_g': 9, 'saturated_fat_g': 0, 'trans_fat_g': None,
            'cholesterol_mg': 0, 'sodium_mg': 90,
            'total_carbohydrate_g': 20, 'net_carbohydrate_g': 20,
            'fiber_g': 0, 'sugar_g': None, 'protein_g': 2,
        })

    def test_missing_counts_and_uncapped_percentages(self):
        rows = summarize([{'item': DORITOS, 'estimated_waste_g': 56}],
                         {DORITOS: 1}, self.foods)
        self.assertEqual(rows[0]['item'], DORITOS)
        self.assertEqual(rows[0]['estimated_waste_percent'], 200)
        self.assertEqual(rows[0]['status'], 'check_calibration_or_counts')
        pizza = next(r for r in rows if r['item'] == PIZZA)
        self.assertIsNone(pizza['estimated_waste_percent'])
        self.assertEqual(pizza['status'], 'missing_servings')

    def test_reject_other_food_events_and_configs(self):
        with self.assertRaises(ValueError):
            summarize([{'item': 'unsupported', 'estimated_waste_g': 1}], {}, self.foods)
        self.foods['unsupported'] = {'serving_g': 100}
        with self.assertRaises(ValueError):
            validate_foods(self.foods)

    def test_defaults_are_independent_and_calibration_missing(self):
        cfg = default_config()
        for spec in cfg['foods'].values():
            self.assertIsNone(spec['grams_per_plate_fraction'])
        cfg['foods'][PIZZA]['serving_g'] = 1
        self.assertEqual(DEFAULT_FOODS[PIZZA]['serving_g'], 120.8)

    def test_servings_csv_matches_menu(self):
        counts = read_servings(Path(__file__).with_name('servings.csv'), self.foods)
        self.assertEqual(set(counts), set(self.foods))
        self.assertTrue(all(n >= 0 for n in counts.values()))

    def test_duplicate_serving_rows_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / 'counts.csv'
            with path.open('w', newline='') as f:
                writer = csv.writer(f)
                writer.writerows([['item', 'servings'], [PIZZA, 1], [PIZZA, 2]])
            with self.assertRaises(ValueError):
                read_servings(path, self.foods)

    def test_one_to_one_tracking_and_expiry(self):
        tracker = Tracker(.2, 1)
        first = tracker.update([{'center': (.2, .2)}, {'center': (.8, .2)}], 0)
        second = tracker.update([{'center': (.8, .3)}, {'center': (.2, .3)}], .1)
        self.assertEqual([x[0] for x in second], [first[1][0], first[0][0]])
        third = tracker.update([{'center': (.2, .3)}], 2)
        self.assertNotIn(third[0][0], [x[0] for x in first])


if __name__ == '__main__':
    unittest.main()
