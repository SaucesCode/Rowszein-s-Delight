import assert from 'node:assert/strict';
import {can, canVisit, homeFor, manilaDate} from '../../frontend/src/lib/permissions.ts';
const staff={role:'staff'}, owner={role:'admin'};
const tests=[
  ['staff capabilities are limited to operational reads and sale creation',()=>{
    for(const action of ['self.read','stock.read','catalog.read','sales.read','sales.create']) assert.equal(can(staff,action),true);
    for(const action of ['stock.manage','stock.adjust','catalog.manage','recipes.manage','sales.update','sales.cancel','sales.export','finance.read','expenses.manage']) assert.equal(can(staff,action),false);
  }],
  ['owner gets explicitly mapped management capabilities',()=>{
    for(const action of ['stock.manage','stock.adjust','catalog.manage','recipes.manage','sales.update','sales.cancel','sales.export','finance.read','expenses.manage']) assert.equal(can(owner,action),true);
    assert.equal(can(owner,'unmapped.new.action'),false);
  }],
  ['unknown missing and anonymous identities fail closed',()=>{
    for(const user of [null,undefined,{role:'unknown'},{role:'ADMIN'},{role:''}]) for(const action of ['self.read','sales.create','finance.read']) assert.equal(can(user,action),false);
  }],
  ['Django technical flags do not grant owner UI access',()=>{
    assert.equal(can({...staff,is_staff:true,is_superuser:true},'stock.adjust'),false);
    assert.equal(can({role:'unknown',is_superuser:true},'finance.read'),false);
  }],
  ['staff read paths and sale entry are allowed',()=>{
    for(const path of ['/sales','/sales/','/sales/new','/products','/ingredients']) assert.equal(canVisit(staff,path),true);
  }],
  ['staff management and financial routes are denied',()=>{
    for(const path of ['/home','/sales/1/edit','/products/new','/products/7/edit','/ingredients/new','/ingredients/8/edit','/recipes','/recipes/new','/recipes/1/edit','/expenses','/expenses/new','/expenses/1/edit','/dashboard','/analytics','/profit-margins','/products/partners']) assert.equal(canVisit(staff,path),false);
  }],
  ['owner approved routes remain usable',()=>{
    for(const path of ['/home','/dashboard','/analytics','/sales','/sales/new','/sales/1/edit','/products','/products/new','/products/7/edit','/ingredients','/ingredients/new','/ingredients/8/edit','/recipes','/recipes/new','/expenses','/expenses/3/edit','/profit-margins','/products/partners']) assert.equal(canVisit(owner,path),true);
  }],
  ['unmapped private routes fail closed for both roles',()=>{
    for(const user of [staff,owner]) for(const path of ['/users','/sales/export','/sales/abc/edit','/new-private-module']) assert.equal(canVisit(user,path),false);
  }],
  ['post-login homes follow role',()=>{
    assert.equal(homeFor(owner),'/home');assert.equal(homeFor(staff),'/sales');assert.equal(homeFor({role:'unknown'}),'/login');
  }],
  ['business date uses Asia Manila across UTC midnight boundaries',()=>{
    assert.equal(manilaDate(new Date('2026-11-09T15:59:00Z')),'2026-11-09');
    assert.equal(manilaDate(new Date('2026-11-09T16:00:00Z')),'2026-11-10');
  }],
];
for(const [name,test] of tests){test();console.log('PASS: '+name);}
console.log(JSON.stringify({tests:tests.length,failures:0,database_access:false},null,2));
