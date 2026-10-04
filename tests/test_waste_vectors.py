import unittest
from pydantic import ValidationError
from fastapi.testclient import TestClient
from api.index import app
from api.waste import WasteItem, calculate_item, financial_summary, MOCK_SERVICE
from api.recommendation_adapter import analyze_waste_vectors

class WasteVectorsTests(unittest.TestCase):
    def item(self, **overrides):
        return WasteItem(**dict(dict(dish='Broccoli', total_served_lbs=60, post_consumer_pct=8,
                       unserved_units_wasted=2.5, weight_per_pan_lbs=10, cost_per_lb=1.8), **overrides))
    def test_financial_formula_and_split(self):
        r=calculate_item(self.item())
        self.assertAlmostEqual(r['plate_waste_lbs'],4.8)
        self.assertEqual(r['plate_waste_dollars'],8.64)
        self.assertEqual(r['unserved_overproduction_dollars'],45)
        self.assertEqual(r['total_waste_dollars'],53.64)
        self.assertEqual(r['total_waste_lbs'],29.8)
    def test_pounds_and_pan_cost_equivalence(self):
        a=calculate_item(self.item())
        b=calculate_item(self.item(unserved_units_wasted=25,unserved_unit='lbs',cost_per_lb=None,cost_per_pan=18))
        for k in ['total_waste_dollars','plate_waste_dollars','unserved_overproduction_dollars','total_waste_lbs']:
            self.assertEqual(a[k],b[k])
    def test_new_engine_uses_total_wasted_over_served(self):
        r=analyze_waste_vectors([self.item()])[0]
        self.assertAlmostEqual(r['waste_ratio'],29.8/60)
        self.assertEqual(r['category'],'UNKNOWN')
        self.assertEqual(r['recommendation'],'Replace Broccoli with a different item and adjust the cooking method.')
    def test_zero_served_and_zero_cost(self):
        self.assertEqual(analyze_waste_vectors([self.item(total_served_lbs=0)]),[])
        self.assertEqual(calculate_item(self.item(cost_per_lb=0))['total_waste_dollars'],0)
    def test_invalid_measurements(self):
        for d in [dict(post_consumer_pct=101),dict(unserved_units_wasted=-1),dict(weight_per_pan_lbs=0),dict(cost_per_lb=None),dict(cost_per_pan=19),dict(cost_per_lb=float('nan')),dict(unserved_unit='kg')]:
            with self.assertRaises(ValidationError): self.item(**d)
    def test_summary_rounding_and_empty(self):
        r=financial_summary(MOCK_SERVICE.items)
        self.assertEqual(round(r.plate_waste_dollars+r.unserved_overproduction_dollars,2),r.total_waste_dollars)
        self.assertAlmostEqual(r.plate_waste_lbs+r.unserved_overproduction_lbs,r.total_waste_lbs)
        self.assertEqual(financial_summary([]).total_waste_dollars,0)
    def test_mock_endpoint_and_post(self):
        c=TestClient(app)
        r=c.get('/api/py/waste/mock')
        self.assertEqual(r.status_code,200)
        data=r.json()
        self.assertEqual(data['summary']['total_waste_dollars'],238.29)
        self.assertEqual(len(data['recommendations']),3)
        self.assertTrue(all('recommendation' in r for r in data['recommendations']))
        response=c.post('/api/py/waste/analyze',json=MOCK_SERVICE.model_dump())
        self.assertEqual(response.json()['summary'],data['summary'])
        body=MOCK_SERVICE.model_dump();body['items'][0]['post_consumer_pct']=999
        self.assertEqual(c.post('/api/py/waste/analyze',json=body).status_code,422)

if __name__=='__main__':unittest.main()
