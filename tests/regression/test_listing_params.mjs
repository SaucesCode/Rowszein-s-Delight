import assert from 'node:assert/strict';
import { QueryClient, QueryObserver } from '../../frontend/node_modules/@tanstack/react-query/build/modern/index.js';
import { listingParams, uniqueRecords } from '../../frontend/src/lib/listingParams.ts';
import { ingredientKeys, recipeKeys } from '../../frontend/src/lib/managementQueryKeys.ts';
const owner={id:1,role:'admin'},staff={id:1,role:'staff'};
let tests=0;
const test=(name,fn)=>{fn();tests++;console.log('PASS '+name);};
test('canonical request retains false and literal search terms',()=>{
  assert.deepEqual(listingParams({page:2,search:' all ',category:'all',is_featured:false,ordering:'name'}),{page:2,search:'all',is_featured:false,ordering:'name'});
});
test('equivalent empty filters do not create separate cache entries',()=>{
  assert.deepEqual(ingredientKeys.list(owner,1,{search:'  ',category:'all'}),ingredientKeys.list(owner,1));
});
test('query identity separates search, category, order, page and actor',()=>{
  const client=new QueryClient();
  const keys=[ingredientKeys.list(owner,1,{search:'flour',category:'other',ordering:'name'}),
    ingredientKeys.list(owner,1,{search:'milk',category:'other',ordering:'name'}),
    ingredientKeys.list(owner,1,{search:'flour',category:'dairy',ordering:'name'}),
    ingredientKeys.list(owner,1,{search:'flour',category:'other',ordering:'-name'}),
    ingredientKeys.list(owner,2,{search:'flour',category:'other',ordering:'name'}),
    ingredientKeys.list(staff,1,{search:'flour',category:'other',ordering:'name'}),
    ingredientKeys.detail(owner,1),recipeKeys.detail(owner,1),recipeKeys.list(owner,1,{category:'1'})];
  keys.forEach((key,index)=>client.setQueryData(key,index));
  assert.deepEqual(keys.map(key=>client.getQueryData(key)),keys.map((_,index)=>index));
  client.clear();
});
test('older result can populate only its old query, never current search observer',()=>{
  const client=new QueryClient();
  const old=ingredientKeys.list(owner,1,{search:'flour'}),next=ingredientKeys.list(owner,1,{search:'milk'});
  const observer=new QueryObserver(client,{queryKey:old,enabled:false});
  const unsubscribe=observer.subscribe(()=>{});
  observer.setOptions({queryKey:next,enabled:false});
  client.setQueryData(next,[{id:2}]);
  client.setQueryData(old,[{id:1}]);
  assert.deepEqual(observer.getCurrentResult().data,[{id:2}]);
  unsubscribe();client.clear();
});
test('pages and pinned selected record retain one option per ID',()=>{
  assert.deepEqual(uniqueRecords([[{id:1},{id:2}],[{id:2},{id:3}],[{id:25},{id:1}]]).map(row=>row.id),[1,2,3,25]);
});
console.log(JSON.stringify({tests,failures:0}));
