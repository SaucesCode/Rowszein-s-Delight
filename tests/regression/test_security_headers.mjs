import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const vercel=JSON.parse(readFileSync(new URL('../../frontend/vercel.json',import.meta.url),'utf8'));
const everyPage=(vercel.headers??[]).find(rule=>rule.source==='/(.*)');
const header=name=>everyPage?.headers.find(h=>h.key.toLowerCase()===name.toLowerCase())?.value;
const directives=()=>Object.fromEntries(header('Content-Security-Policy').split(';').map(d=>d.trim()).filter(Boolean)
  .map(d=>{const [name,...sources]=d.split(/\s+/);return [name,sources];}));

const tests=[];
tests.push(['every page sends a Content-Security-Policy',()=>{
  assert.ok(everyPage,'vercel.json needs a headers rule for /(.*)');
  assert.ok(header('Content-Security-Policy'));
}]);
tests.push(['scripts only come from the site itself',()=>{
  const csp=directives();
  assert.deepEqual(csp['script-src'],["'self'"]);
  assert.deepEqual(csp['default-src'],["'self'"]);
}]);
tests.push(['no plugins, framing, base or form hijacking',()=>{
  const csp=directives();
  assert.deepEqual(csp['object-src'],["'none'"]);
  assert.deepEqual(csp['frame-ancestors'],["'none'"]);
  assert.deepEqual(csp['base-uri'],["'self'"]);
  assert.deepEqual(csp['form-action'],["'self'"]);
}]);
tests.push(['photos may load from Cloudinary over HTTPS only',()=>{
  const csp=directives();
  assert.ok(csp['img-src'].includes('https://res.cloudinary.com'));
  assert.ok(!csp['img-src'].some(s=>s==='*'||s==='https:'||s==='http:'));
}]);
tests.push(['companion headers are set',()=>{
  assert.equal(header('X-Content-Type-Options'),'nosniff');
  assert.equal(header('Referrer-Policy'),'strict-origin-when-cross-origin');
  assert.match(header('Permissions-Policy'),/camera=\(\)/);
}]);

for(const [name,run] of tests){await run();console.log('PASS '+name);}
console.log(JSON.stringify({tests:tests.length,failures:0,browser_tests:false,schema_executed:false}));
