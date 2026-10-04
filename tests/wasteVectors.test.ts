import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wasteMetrics } from '../lib/foodWeights';
import { totals, servicesForDay } from '../lib/mockData';
import { wasteAdvice } from '../lib/wasteAdvice';
import { scrapedItemsToMenuItems } from '../lib/scrapedItems';
test('split vector costs reconcile to item, service and university totals', () => {
  const services=servicesForDay('2026-09-20');
  const t=totals(services);
  assert.ok(Math.abs(t.wasteCost-t.plateWasteDollars-t.unservedOverproductionDollars)<1e-8);
  for(const i of services.flatMap(s=>s.items)) {
    assert.ok(Math.abs(i.wasteCost-i.plateWasteDollars-i.unservedOverproductionDollars)<1e-8);
    assert.ok(Math.abs(i.unservedUnitsWasted*i.weightPerPanLbs-i.unservedLbs)<1e-8);
  }
});
test('replacement engine uses total waste over served and no fixed batch rules', () => {
  const base=scrapedItemsToMenuItems([{name:'Broccoli',station:'Produce',servingSize:'4 oz',calories:60,fiber:4,protein:3,traits:[],allergens:[]}], 'test')[0];
  const item={...base,...wasteMetrics({name:'Broccoli',category:'Produce',servingSize:'4 oz'},100,60,8)};
  const advice=wasteAdvice(item);
  assert.equal(advice.result?.category,'UNKNOWN');
  assert.ok(Math.abs((advice.result?.waste_ratio ?? 0)-item.wasteLbs/item.totalServedLbs)<1e-8);
  assert.equal(advice.title,'Replace Broccoli with a different item and adjust the cooking method.');
});
