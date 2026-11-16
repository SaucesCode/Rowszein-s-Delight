import assert from 'node:assert/strict';
import { AxiosError } from '../../frontend/node_modules/axios/index.js';
import {saleRefusalMessage} from '../../frontend/src/pages/sales/saleErrors.ts';
import {orderItemsText} from '../../frontend/src/pages/owner-home/orderText.ts';

const refused=(status,error)=>new AxiosError('bad','ERR_BAD_REQUEST',{},{},{status,data:{success:false,error},statusText:'',headers:{},config:{}});
const tests=[];
tests.push(['box refusals nested by box and field reach the ticket',()=>{
  assert.equal(saleRefusalMessage(refused(400,{boxes:{'0':{price:['Ensure this value is greater than or equal to 0.01.']}}})),'Ensure this value is greater than or equal to 0.01.');
  assert.equal(saleRefusalMessage(refused(400,{boxes:{'0':{non_field_errors:['Choose the flavours for this box.']}}})),'Choose the flavours for this box.');
  assert.equal(saleRefusalMessage(refused(400,{boxes:"Staff must use the shop's box price."})),"Staff must use the shop's box price.");
  assert.equal(saleRefusalMessage(refused(400,['Add at least one item or box.'])),'Add at least one item or box.');
  assert.equal(saleRefusalMessage(refused(400,{sale_items:['Staff must use current catalog prices.']})),'Staff must use current catalog prices.');
}]);
tests.push(['network trouble is not mistaken for a refusal',()=>{
  assert.equal(saleRefusalMessage(new Error('offline')),null);
  assert.equal(saleRefusalMessage(refused(500,'Server error')),null);
}]);
tests.push(['the home order feed lists boxes as well as single items',()=>{
  const sale={sale_items:[{product:1,product_name:'Glazed Original',quantity:2,unit_price:35}],
    boxes:[{key:'k',box_size_id:1,size:12,assortment_id:null,name:'Box of 12',price:'440.00',contents:[]}]};
  assert.equal(orderItemsText(sale),'Box of 12, 2× Glazed Original');
  assert.equal(orderItemsText({sale_items:[],boxes:[sale.boxes[0],sale.boxes[0]]}),'Box of 12, Box of 12');
}]);
for(const [name,run] of tests){await run();console.log('PASS '+name);}
console.log(JSON.stringify({tests:tests.length,failures:0,browser_tests:false,schema_executed:false}));
