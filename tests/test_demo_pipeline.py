"""Run: python -m unittest discover -s tests -p test_demo_pipeline.py"""
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from api.demo_store import summarize, query_observations
import demo_worker

class DemoTests(unittest.TestCase):
    def row(self, pct=40, n=1):
        return dict(food='Pizza', dining_hall='MHacks Demo', waste_percent=pct, observations=n)

    def test_finances_use_observation_weights(self):
        result = summarize([self.row(40, 1), self.row(20, 3)])
        self.assertAlmostEqual(result['summary']['total_served_lbs'], 1)
        self.assertAlmostEqual(result['summary']['total_waste_lbs'], .25)
        self.assertAlmostEqual(result['summary']['total_waste_dollars'], .75)
        self.assertAlmostEqual(result['items'][0]['waste_percent'], 25)
        self.assertIsNone(result['summary']['unserved_overproduction_dollars'])

    def test_empty_has_no_mock_fallback(self):
        self.assertEqual(summarize([])['summary']['total_waste_dollars'], 0)
        self.assertEqual(summarize([])['recommendations'], [])

    def test_hall_isolation(self):
        row = self.row(); row['dining_hall'] = 'South Quad'
        with self.assertRaises(ValueError): summarize([row])

    def test_invalid_observations(self):
        for n in (0, -1, .5, True):
            with self.subTest(n=n), self.assertRaises(ValueError): summarize([self.row(n=n)])

    def test_thresholds(self):
        self.assertEqual(summarize([self.row(20)])['recommendations'], [])
        self.assertIn('Monitor', summarize([self.row(30)])['recommendations'][0]['reason'])
        self.assertIn('High', summarize([self.row(31)])['recommendations'][0]['reason'])

    def test_sql_scope_and_validation(self):
        with patch('api.demo_store.database_url', return_value='http://example/db'), \
             patch('api.demo_store.headers', return_value={}), \
             patch('api.demo_store.httpx.Client') as client:
            response = client.return_value.__enter__.return_value.post.return_value
            response.json.return_value = [{'rows': []}]
            query_observations('2026-10-04', 'dinner')
            sql = client.return_value.__enter__.return_value.post.call_args.kwargs['content']
            self.assertIn("dining_hall = 'MHacks Demo'", sql)
            self.assertIn("meal = 'dinner'", sql)
        with self.assertRaises(ValueError): query_observations('2026-10-04', "'; DELETE")

    def test_worker_persists_retry_and_archives(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); processed = root / 'processed'; processed.mkdir()
            image = root / 'plate_20261004_094500_123456.jpg'; image.write_bytes(b'capture')
            records = [dict(id=1, food='Pizza')]
            with patch.object(demo_worker, 'PROCESSED', processed), \
                 patch.object(demo_worker, 'mock_inference', return_value=records) as inference, \
                 patch.object(demo_worker, 'insert_observation', side_effect=RuntimeError('offline')):
                with self.assertRaises(RuntimeError): demo_worker.process_image(image)
                self.assertTrue(image.exists())
                self.assertEqual(json.loads(image.with_suffix('.jpg.json').read_text()), records)
                self.assertEqual(inference.call_count, 1)
            with patch.object(demo_worker, 'PROCESSED', processed), \
                 patch.object(demo_worker, 'mock_inference') as inference, \
                 patch.object(demo_worker, 'insert_observation') as insert:
                demo_worker.process_image(image)
                inference.assert_not_called(); insert.assert_called_once_with(records[0])
                self.assertTrue((processed / image.name).exists())

    def test_worker_row_contract(self):
        with patch.dict('os.environ', {'DEMO_MEAL': 'dinner'}):
            rows = demo_worker.mock_inference(Path('plate_20261004_094500_123456.jpg'))
        for row in rows:
            self.assertEqual(row['dining_hall'], 'MHacks Demo')
            self.assertIs(row['simulated'], False)
            self.assertEqual(row['service_date'], '2026-10-04')
            self.assertIsInstance(row['id'], str)
            self.assertLess(int(row['id']), 2**53)
            self.assertTrue(0 <= row['waste_percent'] <= 100)

if __name__ == '__main__': unittest.main()

class DemoRangeTests(unittest.TestCase):
    def test_range_sql_is_demo_only(self):
        from api.demo_store import query_observations_range
        with patch('api.demo_store.database_url', return_value='http://example/db'), \
             patch('api.demo_store.headers', return_value={}), \
             patch('api.demo_store.httpx.Client') as client:
            client.return_value.__enter__.return_value.post.return_value.json.return_value = [{'rows': []}]
            query_observations_range('2026-07-13', '2026-10-04')
            sql = client.return_value.__enter__.return_value.post.call_args.kwargs['content']
            self.assertIn("dining_hall = 'MHacks Demo'", sql)
            self.assertIn("service_date >= '2026-07-13'", sql)
            self.assertIn("service_date <= '2026-10-04'", sql)
        with self.assertRaises(ValueError): query_observations_range('2026-01-01', '2026-10-04')
        with self.assertRaises(ValueError): query_observations_range('2026-10-04', '2026-10-03')
