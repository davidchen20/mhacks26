import {test} from 'node:test';
import assert from 'node:assert/strict';
import {hardcodedRecommendation} from '../lib/hardcodedRecommender';
import rules from '../lib/recommendationRules.json';
import db from '../database.json';
test('every supplied dish matches its category and exact low/high rule',()=> {
 for(const [name,info] of Object.entries(db)) for(const [wasted,severity] of [[30,'low'],[31,'high']] as const) {
  const result=hardcodedRecommendation(name,wasted,100)!;
  const rule=(rules as Record<string,{low:string;high:string}>)[info.category][severity];
  const dietary=info.dietary.toLowerCase()==='none'?'':info.dietary+' ';
  assert.equal(result.recommendation,rule.replaceAll('{food_name}',name).replaceAll('{dietary_text}',dietary));
 }
 assert.equal(hardcodedRecommendation('Brown Rice',20,100),null);
 assert.equal(hardcodedRecommendation('Brown Rice',20,0),null);
});
