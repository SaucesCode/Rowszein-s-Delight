import assert from 'node:assert/strict';
import {balanceLabel} from '../../frontend/src/pages/partners/balance.ts';

const tests=[];
tests.push(['what is still owed reads as still to pay',()=>{
  assert.deepEqual(balanceLabel('1350.00'),{label:'Still to pay ₱1,350.00',tone:'owed'});
}]);
tests.push(['an overpayment reads as paid ahead, not a negative amount',()=>{
  assert.deepEqual(balanceLabel('-200.00'),{label:'Paid ahead ₱200.00',tone:'ahead'});
}]);
tests.push(['a zero balance reads as all paid',()=>{
  assert.deepEqual(balanceLabel('0.00'),{label:'All paid',tone:'settled'});
}]);
for(const [name,run] of tests){await run();console.log('PASS '+name);}
console.log(JSON.stringify({tests:tests.length,failures:0,browser_tests:false,schema_executed:false}));
