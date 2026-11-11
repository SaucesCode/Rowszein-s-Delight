import assert from 'node:assert/strict';
import {QueryClient, QueryObserver} from '../../frontend/node_modules/@tanstack/react-query/build/modern/index.js';
import {ingredientKeys,recipeKeys,validRecordId,requestedRecord} from '../../frontend/src/lib/managementQueryKeys.ts';

const owner={id:1,role:'admin'},staff={id:1,role:'staff'},other={id:2,role:'admin'};
let tests=0;
async function test(name,run) { await run(); tests++; console.log('PASS '+name); }
const makeClient=()=>new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});
await test('ingredient list page and detail ID preserve different response shapes',async()=>{
  const client=makeClient();
  await client.fetchQuery({queryKey:ingredientKeys.list(owner,1),queryFn:async()=>({data:{results:[{id:1}]}})});
  await client.fetchQuery({queryKey:ingredientKeys.detail(owner,1),queryFn:async()=>requestedRecord(1,{id:1,name:'one'})});
  assert.equal(client.getQueryData(ingredientKeys.detail(owner,1)).name,'one');
  assert.equal(client.getQueryData(ingredientKeys.list(owner,1)).data.results.length,1);
  client.clear();
});
await test('recipe list/detail and ingredient/recipe resources cannot collide',async()=>{
  const keys=[recipeKeys.list(owner,1),recipeKeys.detail(owner,1),ingredientKeys.list(owner,1),ingredientKeys.detail(owner,1)];
  const client=makeClient();
  keys.forEach((key,i)=>client.setQueryData(key,i));
  assert.deepEqual(keys.map(key=>client.getQueryData(key)),[0,1,2,3]);
  client.clear();
});
await test('list pages 1 and 2 are distinct from detail ID 2',async()=>{
  const client=makeClient();
  const keys=[ingredientKeys.list(owner,1),ingredientKeys.list(owner,2),ingredientKeys.detail(owner,2)];
  keys.forEach((key,i)=>client.setQueryData(key,i));
  assert.deepEqual(keys.map(key=>client.getQueryData(key)),[0,1,2]);
  client.clear();
});
await test('actor, role and anonymous scopes cannot read owner cache entries',async()=>{
  for (const keys of [ingredientKeys,recipeKeys]) {
    const client=makeClient();
    client.setQueryData(keys.list(owner,1),{secret:'owner'});
    client.setQueryData(keys.detail(owner,1),{id:1,secret:'owner'});
    for (const actor of [staff,other,undefined]) {
      assert.equal(client.getQueryData(keys.list(actor,1)),undefined);
      assert.equal(client.getQueryData(keys.detail(actor,1)),undefined);
    }
    client.clear();
  }
});
await test('ingredient prefix invalidation includes every page/detail/low-stock without invalidating recipes',async()=>{
  const client=makeClient();
  const keys=[ingredientKeys.list(owner,1),ingredientKeys.list(owner,2),ingredientKeys.detail(owner,1),ingredientKeys.lowStock(owner),ingredientKeys.list(staff,1)];
  keys.forEach(key=>client.setQueryData(key,{id:1}));
  client.setQueryData(recipeKeys.list(owner,1),{unchanged:true});
  await client.invalidateQueries({queryKey:ingredientKeys.all});
  assert.ok(keys.every(key=>client.getQueryState(key).isInvalidated));
  assert.equal(client.getQueryState(recipeKeys.list(owner,1)).isInvalidated,false);
  client.clear();
});
await test('recipe prefix invalidation includes all lists and details',async()=>{
  const client=makeClient();
  const keys=[recipeKeys.list(owner,1),recipeKeys.list(owner,2),recipeKeys.detail(owner,1),recipeKeys.detail(owner,2)];
  keys.forEach(key=>client.setQueryData(key,{id:1}));
  await client.invalidateQueries({queryKey:recipeKeys.all});
  assert.ok(keys.every(key=>client.getQueryState(key).isInvalidated));
  client.clear();
});
await test('invalid IDs are disabled candidates, positive safe integers are accepted',async()=>{
  for (const id of [0,-1,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1]) assert.equal(validRecordId(id),false);
  assert.equal(validRecordId(1),true); assert.equal(validRecordId(99999),true);
});
await test('wrong-ID and list responses cannot populate a successful detail cache',async()=>{
  for (const bad of [{id:2},{data:{results:[{id:1}]}},null]) {
    const client=makeClient();
    await assert.rejects(client.fetchQuery({queryKey:ingredientKeys.detail(owner,1),queryFn:async()=>requestedRecord(1,bad)}));
    assert.equal(client.getQueryData(ingredientKeys.detail(owner,1)),undefined);
    assert.equal(client.getQueryState(ingredientKeys.detail(owner,1)).status,'error');
    client.clear();
  }
});
await test('switching a live observer never supplies previous record as placeholder',async()=>{
  const client=makeClient();
  client.setQueryData(ingredientKeys.detail(owner,1),{id:1,name:'one'});
  const observer=new QueryObserver(client,{queryKey:ingredientKeys.detail(owner,1),enabled:false});
  const unsubscribe=observer.subscribe(()=>{});
  observer.setOptions({queryKey:ingredientKeys.detail(owner,2),enabled:false});
  assert.equal(observer.getCurrentResult().data,undefined);
  assert.equal(client.getQueryData(ingredientKeys.detail(owner,1)).id,1);
  unsubscribe(); client.clear();
});
console.log(JSON.stringify({tests,failures:0,real_query_client:true,browser_tests:false}));
