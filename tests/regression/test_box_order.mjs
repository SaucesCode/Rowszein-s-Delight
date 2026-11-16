import assert from 'node:assert/strict';
import {fillingDonuts, parseStoredOrder, toggleFillingFlavour} from '../../frontend/src/pages/shop/useBoxOrder.ts';

const product=(id,name,extra='0.00',partner=null)=>({id,name,price:'40.00',box_extra:extra,partner,image_url:null,category:{id:1,name:'Classics'}});
const glazed=product(1,'Glazed'), ube=product(2,'Ube','10.00'), choco=product(3,'Choco'), muffin=product(9,'Banana muffin','0.00',{id:1,name:'Kape Lokal'});
const box=()=>({size:8,boxPrice:280,maxFlavors:2,flavours:[]});
const pick=(start,...products)=>products.reduce((current,item)=>toggleFillingFlavour(current,item),start);

const tests=[];
tests.push(['customers pick flavours and the box fills evenly',()=>{
  const filled=pick(box(),glazed,ube);
  assert.deepEqual(fillingDonuts(filled).map(d=>d.name),['Glazed','Glazed','Glazed','Glazed','Ube','Ube','Ube','Ube']);
}]);
tests.push(['the flavour limit and partner items are refused with a reason',()=>{
  assert.deepEqual(toggleFillingFlavour(pick(box(),glazed,ube),choco),{error:'This box takes up to 2 flavours'});
  assert.deepEqual(toggleFillingFlavour(box(),muffin),{error:'Not in boxes'});
}]);
tests.push(['tapping a picked flavour takes it out and the box refills',()=>{
  const left=toggleFillingFlavour(pick(box(),glazed,ube),glazed);
  assert.deepEqual(fillingDonuts(left).map(d=>d.name),Array(8).fill('Ube'));
}]);
tests.push(['a box saved in the browser before the flavour rule is cleared, finished boxes kept',()=>{
  const old=JSON.stringify({filling:{size:8,boxPrice:280,donuts:[{product_id:1,name:'Glazed',image_url:null,box_extra:0}]},boxes:[{key:'k',name:'Box of 8',size:8,boxPrice:280,donuts:[]}]});
  const parsed=parseStoredOrder(old);
  assert.equal(parsed.filling,null);
  assert.equal(parsed.boxes.length,1);
  assert.deepEqual(parseStoredOrder('not json'),{filling:null,boxes:[]});
}]);
for(const [name,run] of tests){await run();console.log('PASS '+name);}
console.log(JSON.stringify({tests:tests.length,failures:0,browser_tests:false,schema_executed:false}));
