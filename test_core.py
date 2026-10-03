import unittest
from waste_monitor import summarize, Tracker

class CoreTests(unittest.TestCase):
    def test_denominator_includes_fully_eaten_servings(self):
        rows = summarize([{'item':'rice','estimated_waste_g':30}], {'rice':10},
                         {'rice':{'serving_g':150}})
        self.assertEqual(rows[0]['estimated_waste_percent'], 2)
        self.assertEqual(rows[0]['estimated_waste_g_per_serving'], 3)

    def test_missing_and_over_hundred(self):
        rows = summarize([{'item':'a','estimated_waste_g':200}], {'a':1},
                         {'a':{'serving_g':100},'b':{'serving_g':100}})
        self.assertEqual(rows[0]['estimated_waste_percent'],200)
        self.assertEqual(rows[0]['status'],'check_calibration_or_counts')
        self.assertIsNone(rows[1]['estimated_waste_percent'])

    def test_one_to_one_tracking_and_expiry(self):
        tracker = Tracker(.2, 1)
        first = tracker.update([{'center':(.2,.2)},{'center':(.8,.2)}],0)
        second = tracker.update([{'center':(.8,.3)},{'center':(.2,.3)}],.1)
        self.assertEqual([x[0] for x in second], [first[1][0],first[0][0]])
        third = tracker.update([{'center':(.2,.3)}],2)
        self.assertNotIn(third[0][0], [x[0] for x in first])

if __name__ == '__main__':
    unittest.main()
