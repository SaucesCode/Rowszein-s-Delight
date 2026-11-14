import assert from 'node:assert/strict';
import {heroPicks, toShelves} from '../../frontend/src/pages/shop/shelves.ts';
import {orderSummary, orderText} from '../../frontend/src/pages/shop/order.ts';
import {canGoInBox} from '../../frontend/src/pages/shop/useBoxOrder.ts';

const classics={id:1,slug:'classic',name:'Classics',description:'',is_active:true,sort_order:1};
const muffins={id:2,slug:'muffins',name:'Muffins',description:'',is_active:true,sort_order:5};
const kape={id:7,name:'Kape Lokal',blurb:'Muffins from Marikina',is_active:true,sort_order:2};
const atelier={id:8,name:'Cake Atelier',blurb:'',is_active:true,sort_order:1};
const item=(id,name,category,partner=null,featured=false)=>({id,name,price:'60.00',category,partner,is_featured:featured,is_available:true,description:'',image_url:null});
const glazed=item(1,'Glazed Original',classics,null,true), muffin=item(2,'Banana muffin',muffins,kape,true), cake=item(3,'Ube cake',muffins,atelier);

const tests=[];
tests.push(['partner shelves come after the donut shelves, in partner order',()=>{
  const shelves=toShelves([muffin,cake,glazed],[classics,muffins]);
  assert.deepEqual(shelves.map(s=>[s.title,s.partner,s.items.map(i=>i.name)]),[
    ['Classics',false,['Glazed Original']],
    ['From our friends · Cake Atelier',true,['Ube cake']],
    ['From our friends · Kape Lokal',true,['Banana muffin']],
  ]);
  assert.equal(shelves[2].blurb,'Muffins from Marikina');
}]);
tests.push(['partner items never go in a box',()=>{
  assert.equal(canGoInBox(glazed),true);
  assert.equal(canGoInBox(muffin),false);
}]);
tests.push(['the box of donuts up top only ever shows donuts',()=>{
  assert.deepEqual(heroPicks([glazed,muffin],[glazed,muffin,cake],false).map(i=>i.name),['Glazed Original']);
  assert.deepEqual(heroPicks([muffin],[glazed,muffin],false).map(i=>i.name),['Glazed Original']);
}]);
tests.push(['the Messenger message credits the partner',()=>{
  const text=orderText([],[{product_id:2,name:'Banana muffin',price:60,image_url:null,quantity:2,partner:'Kape Lokal'}],120,'Ana');
  assert.match(text,/^2 × Banana muffin \(by Kape Lokal\) \(₱120\.00\)$/m);
}]);
tests.push(['the order summary says items once a partner item is in it',()=>{
  assert.equal(orderSummary(1,3),'1 box, 3 donuts');
  assert.equal(orderSummary(1,3,true),'1 box, 3 items');
}]);
for(const [name,run] of tests){await run();console.log('PASS '+name);}
console.log(JSON.stringify({tests:tests.length,failures:0,browser_tests:false,schema_executed:false}));
