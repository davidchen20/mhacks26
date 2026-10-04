import unittest
from unittest.mock import patch
from api.demo_store import COLUMNS, decode_rows, insert_observation, query_observations_range

class SpacetimeSchemaTests(unittest.TestCase):
    def row(self, hall='MHacks Demo'):
        return ['camera-tray:pizza:01', 'Pizza', hall, '2026-10-04', 'dinner',
                34.5, 1, False, 'Phone camera / mock inference', 'Pizza', '4 oz',
                {'some': 285}, {'none': []}, [0, 12], ['Vegetarian'], ['Milk', 'Wheat']]

    def test_optional_nutrition_and_arbitrary_string_ids(self):
        row = decode_rows([{'rows': [self.row()]}])[0]
        self.assertEqual(row['id'], 'camera-tray:pizza:01')
        self.assertEqual(row['calories'], 285)
        self.assertIsNone(row['fiber'])
        self.assertEqual(row['protein'], 12)
        self.assertEqual(row['traits'], ['Vegetarian'])
        self.assertEqual(row['allergens'], ['Milk', 'Wheat'])

    def test_query_preserves_exact_demo_filter(self):
        with patch('api.demo_store.database_url', return_value='http://example/db'), \
             patch('api.demo_store.headers', return_value={}), \
             patch('api.demo_store.httpx.Client') as client:
            response = client.return_value.__enter__.return_value.post.return_value
            response.json.return_value = [{'rows': [self.row()]}]
            rows = query_observations_range('2026-10-04', '2026-10-04')
            self.assertEqual(rows[0]['dining_hall'], 'MHacks Demo')
            sql = client.return_value.__enter__.return_value.post.call_args.kwargs['content']
            self.assertIn("WHERE dining_hall = 'MHacks Demo'", sql)
            self.assertIn('traits, allergens', sql)

    def test_reducer_payload_matches_uploaded_argument_order(self):
        record = dict(zip(COLUMNS, self.row()))
        record.update(id=123, calories=285, fiber=None, protein=12)
        with patch.dict('os.environ', {'SPACETIMEDB_MENU_REDUCER': 'record_menu_waste'}), \
             patch('api.demo_store.database_url', return_value='http://example/db'), \
             patch('api.demo_store.headers', return_value={}), \
             patch('api.demo_store.httpx.Client') as client:
            insert_observation(record)
            call = client.return_value.__enter__.return_value.post.call_args
            self.assertEqual(call.args[0], 'http://example/db/call/record_menu_waste')
            args = call.kwargs['json']
            self.assertEqual(len(args), 16)
            self.assertEqual(args[:8], ['123', 'Pizza', 'MHacks Demo', '2026-10-04', 'dinner', 34.5, 1, False])
            self.assertEqual(args[11:14], [{'some': 285.0}, {'none': []}, {'some': 12.0}])
            self.assertEqual(args[-2:], [['Vegetarian'], ['Milk', 'Wheat']])

    def test_non_demo_writes_and_reads_rejected(self):
        record = dict(zip(COLUMNS, self.row('Bursley')))
        with self.assertRaises(ValueError): insert_observation(record)
        with self.assertRaises(ValueError): decode_rows([{'rows': [self.row('Bursley')]}])
        record = dict(zip(COLUMNS, self.row())); record['simulated'] = True
        with self.assertRaises(ValueError): insert_observation(record)

    def test_camel_case_named_rows_decode(self):
        row = dict(zip(COLUMNS, self.row()))
        for old, new in [('dining_hall', 'diningHall'), ('service_date', 'serviceDate'),
                         ('waste_percent', 'wastePercent'), ('serving_size', 'servingSize')]:
            row[new] = row.pop(old)
        self.assertEqual(decode_rows([{'rows': [row]}])[0]['service_date'], '2026-10-04')

if __name__ == '__main__': unittest.main()
