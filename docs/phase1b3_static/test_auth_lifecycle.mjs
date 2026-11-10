import assert from 'node:assert/strict';
import {createAuthLifecycle} from '../../frontend/src/lib/authLifecycle.ts';
import {createCookieApi} from '../../frontend/src/lib/csrfTransport.ts';
import {AxiosError} from '../../frontend/node_modules/axios/index.js';

const tests=[];
tests.push(['one refresh per tab even with parallel callers',async()=>{
  let calls=0,release;
  const gate=new Promise(resolve=>{release=resolve;});
  const auth=createAuthLifecycle(async(name,action)=>action());
  const run=async()=>{calls++;await gate;return 'done';};
  const one=auth.refresh(run),two=auth.refresh(run);
  assert.equal(calls,1);release();assert.deepEqual(await Promise.all([one,two]),['done','done']);
}]);
tests.push(['multiple tabs and logout share the lifecycle lock',async()=>{
  let queue=Promise.resolve(),active=0,max=0;
  const names=[];
  const lock=(name,action)=>{names.push(name);const result=queue.then(action);queue=result.catch(()=>{});return result;};
  const tabA=createAuthLifecycle(lock),tabB=createAuthLifecycle(lock);
  const action=async()=>{active++;max=Math.max(max,active);await Promise.resolve();active--;};
  await Promise.all([tabA.refresh(action),tabB.refresh(action),tabA.transition(action)]);
  assert.equal(max,1);assert.equal(new Set(names).size,1);
}]);
tests.push(['lost refresh response is not retried',async()=>{
  let calls=0;
  const auth=createAuthLifecycle(async(name,action)=>action());
  await assert.rejects(auth.refresh(async()=>{calls++;throw new Error('response lost');}));
  assert.equal(calls,1);
}]);
tests.push(['unsupported cross-tab coordination refuses refresh',async()=>{
  let calls=0;
  await assert.rejects(createAuthLifecycle(undefined).refresh(async()=>{calls++;}));
  assert.equal(calls,0);
}]);
tests.push(['business 401 is never replayed or refreshed',async()=>{
  let dispatch=0;
  const api=createCookieApi('https://testserver',async()=>'A'.repeat(64));
  api.defaults.adapter=async(config)=>{dispatch++;throw new AxiosError('expired','ERR_BAD_REQUEST',config,{},
    {config,status:401,statusText:'',headers:{},data:{error:{code:'access_expired'}}});};
  await assert.rejects(api.post('/sales/',{sale_items:[]},{headers:{'Idempotency-Key':'stable-identity'}}));
  assert.equal(dispatch,1);
}]);
for(const [name,run] of tests){await run();console.log('PASS '+name);}
console.log(JSON.stringify({tests:tests.length,failures:0,browser_tests:false,schema_executed:false}));
