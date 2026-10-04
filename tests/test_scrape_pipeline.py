import unittest
from scripts.scrape_all import normalize_menu

class ScrapePipelineTests(unittest.TestCase):
    def test_actual_observed_nutrition_keys(self):
        raw={'meals':{'brunch':{'Hot Cereal':[{'name':'Oatmeal','nutrition':{
            'serving_size':'Cups (253g)','calories':183,'dietary_fiber':'5g','protein':'6g'},
            'traits':['Vegan'],'allergens':['Oats']}]}}}
        item=normalize_menu(raw)['brunch'][0]
        self.assertEqual((item['servingSize'],item['calories'],item['fiber'],item['protein']),('Cups (253g)',183,5,6))
        self.assertEqual(item['station'],'Hot Cereal')
        self.assertEqual(item['traits'],['Vegan'])

    def test_missing_nutrition_and_other_meals(self):
        result=normalize_menu({'meals':{'late night':{'Grill':[{'name':'Chicken'}]},'dinner':{'Grill':[{'name':'Chicken'}]}}})
        self.assertEqual(list(result),['dinner'])
        self.assertIsNone(result['dinner'][0]['fiber'])
        self.assertIsNone(result['dinner'][0]['servingSize'])

if __name__=='__main__':
    unittest.main()
