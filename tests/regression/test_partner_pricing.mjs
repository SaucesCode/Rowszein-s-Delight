import assert from 'node:assert/strict';
import {joinPartnerPrice, splitPartnerPrice} from '../../frontend/src/pages/products/partnerPricing.ts';

const tests=[];
tests.push(['shop price is their price plus the patong, in whole centavos',()=>{
  assert.equal(joinPartnerPrice(50,10),60);
  assert.equal(joinPartnerPrice(0.1,0.2),0.3);
  assert.equal(joinPartnerPrice(49.99,0),49.99);
}]);
tests.push(['a saved partner item splits back into their price and patong',()=>{
  assert.deepEqual(splitPartnerPrice('60.00','50.00'),{their:50,patong:10});
  assert.deepEqual(splitPartnerPrice('120.50','100.25'),{their:100.25,patong:20.25});
}]);
for(const [name,run] of tests){await run();console.log('PASS '+name);}
console.log(JSON.stringify({tests:tests.length,failures:0,browser_tests:false,schema_executed:false}));
