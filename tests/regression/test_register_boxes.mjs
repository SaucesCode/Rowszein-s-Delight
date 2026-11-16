import assert from 'node:assert/strict';
import {canPickMore, evenSplit, fillEvenly} from '../../frontend/src/lib/boxRule.ts';
import {boxPayload, closeOpenBox, openBoxContents, openBoxPrice, readyMadeBox, savedBox, toggleFlavour} from '../../frontend/src/pages/sales/boxTicket.ts';

const glazed={id:1,name:'Glazed',box_extra:'0.00',partner:null};
const ube={id:2,name:'Ube',box_extra:'10.00',partner:null};
const choco={id:3,name:'Choco',box_extra:'0.00',partner:null};
const matcha={id:4,name:'Matcha',box_extra:'0.00',partner:null};
const muffin={id:9,name:'Banana muffin',box_extra:'0.00',partner:{id:1,name:'Kape Lokal'}};
const open=()=>({boxSizeId:5,size:12,maxFlavors:3,basePrice:400,name:'Box of 12',flavours:[]});
const pick=(box,...products)=>products.reduce((current,product)=>toggleFlavour(current,product),box);

const tests=[];
tests.push(['even split matches the server',()=>{
  assert.deepEqual(evenSplit(12,3),[4,4,4]);
  assert.deepEqual(evenSplit(10,3),[4,3,3]);
  assert.deepEqual(evenSplit(8,1),[8]);
  assert.deepEqual(fillEvenly(10,['a','b','c']),[{item:'a',quantity:4},{item:'b',quantity:3},{item:'c',quantity:3}]);
  assert.equal(canPickMore(2,1),true);
  assert.equal(canPickMore(2,2),false);
}]);
tests.push(['picking flavours fills the box evenly, up to the limit',()=>{
  const box=pick(open(),glazed,ube,choco);
  assert.deepEqual(openBoxContents(box).map(d=>[d.name,d.quantity]),[['Glazed',4],['Ube',4],['Choco',4]]);
  assert.deepEqual(toggleFlavour(box,matcha),{error:'This box takes up to 3 flavours'});
}]);
tests.push(['partner items never go in a box',()=>{
  assert.deepEqual(toggleFlavour(open(),muffin),{error:'Not in boxes'});
}]);
tests.push(['unpicking a flavour refills the box evenly',()=>{
  const box=toggleFlavour(pick(open(),glazed,ube,choco),ube);
  assert.deepEqual(openBoxContents(box).map(d=>[d.name,d.quantity]),[['Glazed',6],['Choco',6]]);
}]);
tests.push(['price adds premium extras per donut, to the centavo',()=>{
  assert.equal(openBoxPrice(pick(open(),glazed,ube,choco)),440);
  assert.equal(openBoxPrice(pick({...open(),basePrice:399.9},ube)),519.9);
}]);
tests.push(['what is sent: saved box by key, discount only when changed, ready-made by id',()=>{
  const filled=closeOpenBox(pick(open(),glazed,ube,choco));
  assert.deepEqual(boxPayload(filled),{box_size:5,contents:[{product:1,quantity:4},{product:2,quantity:4},{product:3,quantity:4}]});
  assert.deepEqual(boxPayload({...filled,price:420}),{box_size:5,contents:[{product:1,quantity:4},{product:2,quantity:4},{product:3,quantity:4}],price:420});
  const ready=readyMadeBox({id:7,name:'Classic dozen',price:'460.00',box_size:{id:5,size:12,price:'400.00',is_available:true,max_flavors:3},
    items:[{product_id:2,name:'Ube',category:'Classics',quantity:6,box_extra:'10.00',is_available:true,image_url:null},
           {product_id:3,name:'Choco',category:'Classics',quantity:6,box_extra:'0.00',is_available:true,image_url:null}]});
  assert.deepEqual(boxPayload(ready),{assortment:7});
  const saved=savedBox({key:'abc',box_size_id:5,size:12,assortment_id:null,name:'Box of 12',price:'440.00',
    contents:[{product:1,product_name:'Glazed',quantity:12,box_extra:'0.00'}]});
  assert.deepEqual(boxPayload(saved),{key:'abc'});
  assert.equal(saved.price,440);
}]);
for(const [name,run] of tests){await run();console.log('PASS '+name);}
console.log(JSON.stringify({tests:tests.length,failures:0,browser_tests:false,schema_executed:false}));
