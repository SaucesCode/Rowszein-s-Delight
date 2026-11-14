import assert from 'node:assert/strict';
import {saleMatchesSearch} from '../../frontend/src/pages/sales/saleSearch.ts';

const sale={notes:'Ana birthday',sale_items:[{product:1,product_name:'Glazed Original',quantity:1,unit_price:35}],
  boxes:[{key:'k',box_size_id:1,size:12,assortment_id:4,name:'Classic dozen',price:'420.00',
    contents:[{product:2,product_name:'Ube Cream',quantity:6,box_extra:'10.00'},{product:3,product_name:'Choco Dip',quantity:6,box_extra:'0.00'}]}]};
const tests=[];
tests.push(['history search finds notes, single items, box names and donuts inside boxes',()=>{
  for(const q of ['ana','glazed','classic dozen','ube','  CHOCO ','']) assert.equal(saleMatchesSearch(sale,q),true,q);
  assert.equal(saleMatchesSearch(sale,'matcha'),false);
  assert.equal(saleMatchesSearch({notes:'',sale_items:[]},'ube'),false);
}]);
for(const [name,run] of tests){await run();console.log('PASS '+name);}
console.log(JSON.stringify({tests:tests.length,failures:0,browser_tests:false,schema_executed:false}));
