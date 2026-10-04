import csv
import os
import unittest
from pathlib import Path
from unittest.mock import patch
from api.demo_config import database_settings
from api.demo_store import food_specs, headers, summarize
from scripts.import_demo_export import export_records

EXPORT = Path(__file__).resolve().parents[1] / 'scripts/demo_export.csv'

class DemoExportTests(unittest.TestCase):
    def test_import_copies_only_and_stable_ids(self):
        with EXPORT.open(encoding='utf-8-sig') as handle:
            originals = list(csv.DictReader(handle))
        records = export_records(EXPORT)
        self.assertEqual(len(records), 9)
        self.assertTrue(all(r['dining_hall'] == 'bursley' for r in originals))
        self.assertTrue(all(r['dining_hall'] == 'MHacks Demo' and r['simulated'] is False for r in records))
        self.assertEqual([r['id'] for r in records], [r['id'] for r in export_records(EXPORT)])
        self.assertTrue(all(r['id'] != source['id'] for r, source in zip(records, originals)))
        self.assertTrue(all(r['calories'] is None for r in records))

    def test_actual_export_aggregation_and_serving_weights(self):
        records = export_records(EXPORT)
        result = summarize(records)
        self.assertEqual(result['summary']['observations'], 43)
        self.assertAlmostEqual(result['summary']['total_waste_lbs'], 1.982074433924)
        self.assertAlmostEqual(result['summary']['total_waste_dollars'], 7.002228719147)
        specs = food_specs(records)
        self.assertAlmostEqual(specs['dominos_cheese_pizza_slice']['portion_lbs'], 120.8 / 453.59237)
        self.assertEqual(specs['doritos_nacho_cheese']['portion_source'], 'serving-size')
        self.assertEqual(specs['lays_potato_chips_original']['portion_source'], 'category-default')
        self.assertEqual(len(result['items']), 3)

    def test_configuration_and_public_reads(self):
        with patch.dict(os.environ, {'SPACETIMEDB_HOST': 'wss://example.com/', 'SPACETIMEDB_DATABASE': 'demo', 'SPACETIMEDB_TOKEN': ''}):
            self.assertEqual(database_settings(), ('https://example.com', 'demo'))
            self.assertEqual(headers(), {})
        with patch.dict(os.environ, {'SPACETIMEDB_HOST': 'https://example.com/console', 'SPACETIMEDB_DATABASE': 'demo'}):
            with self.assertRaises(ValueError): database_settings()

if __name__ == '__main__': unittest.main()
