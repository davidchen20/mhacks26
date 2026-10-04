import unittest
from pathlib import Path
import os,tempfile,json
from recommender import analyze_food_waste, generate_recommendation, load_food_database, RECOMMENDATIONS_DB

class HardcodedTests(unittest.TestCase):
    def test_exact_thresholds(self):
        db=load_food_database('database.json')
        self.assertEqual(analyze_food_waste([('Brown Rice',20)],{'Brown Rice':100},db),[])
        for wasted,level in [(30,'low'),(31,'high')]:
            r=analyze_food_waste([('Brown Rice',wasted)],{'Brown Rice':100},db)[0]
            expected=RECOMMENDATIONS_DB['PLAIN GRAINS & STARCHES'][level].format(food_name='Brown Rice',dietary_text='gluten-free, vegan ')
            self.assertEqual(r['recommendation'],expected)
    def test_aggregation_order_and_missing_served(self):
        r=analyze_food_waste([('Brown Rice',15),('Brown Rice',10),('Garlic Roasted Broccoli',40),('missing',50)],{'Brown Rice':100,'Garlic Roasted Broccoli':100},load_food_database('database.json'))
        self.assertEqual([i['food_name'] for i in r],['Garlic Roasted Broccoli','Brown Rice'])
        self.assertEqual(r[1]['total_wasted'],25)
    def test_all_templates_fill(self):
        for category in RECOMMENDATIONS_DB:
            for ratio in [.25,.4]:
                rec=generate_recommendation('Test Dish',ratio,category,'vegan')
                self.assertNotIn('{food_name}',rec);self.assertNotIn('{dietary_text}',rec)
    def test_unknown_category_fallback(self):
        self.assertEqual(generate_recommendation('Other',.4,'UNKNOWN','none'),'Replace Other with a different item and adjust the cooking method.')
    def test_database_load_not_cwd(self):
        old=os.getcwd()
        try:
            with tempfile.TemporaryDirectory() as d:
                os.chdir(d);self.assertIn('Brown Rice',load_food_database('database.json'))
        finally:os.chdir(old)
    def test_frontend_snapshot_matches_python(self):
        self.assertEqual(json.loads((Path(__file__).resolve().parents[1]/'lib/recommendationRules.json').read_text()),RECOMMENDATIONS_DB)

if __name__=='__main__':unittest.main()
