import assert from 'node:assert/strict';
import { AxiosError } from '../../frontend/node_modules/axios/index.js';
import { createCookieApi, createCsrfState, apiErrorMessage } from '../../frontend/src/lib/csrfTransport.ts';

const A = 'A'.repeat(64), B = 'B'.repeat(64), C = 'C'.repeat(64);
const deferred = () => { let resolve, reject; const promise = new Promise((ok, bad) => { resolve = ok; reject = bad; }); return {promise, resolve, reject}; };
const response = (config, data = {}, status = 200) => ({config, data, status, statusText: '', headers: {}});
const failure = (config, status, error = {}) => new AxiosError('rejected', 'ERR_BAD_REQUEST', config, {}, response(config, {error}, status));
const tests = [
  ['parallel bootstrap is single-flight', async () => {
    const wait = deferred(); let calls = 0;
    const state = createCsrfState(() => { calls++; return wait.promise; });
    const one = state.get(), two = state.get(); assert.equal(calls, 1); wait.resolve(A);
    assert.deepEqual(await Promise.all([one, two]), [A, A]); assert.equal(await state.get(), A); assert.equal(calls, 1);
  }],
  ['bootstrap failure is recoverable without dispatch', async () => {
    let calls = 0; const state = createCsrfState(async () => { if (++calls === 1) throw new Error('offline'); return A; });
    await assert.rejects(state.get()); assert.equal(await state.get(), A);
  }],
  ['late bootstrap cannot replace a rotated login token', async () => {
    const wait = deferred(); const state = createCsrfState(() => wait.promise); const before = state.get();
    state.adopt(B); wait.resolve(A); assert.equal(await before, B); assert.equal(await state.get(), B);
  }],
  ['parallel rejection recovery is single-flight and reuses newer token', async () => {
    let calls = 0; const state = createCsrfState(async () => { calls++; return calls === 1 ? A : B; });
    await state.get(); assert.deepEqual(await Promise.all([state.refresh(A), state.refresh(A)]), [B, B]);
    assert.equal(await state.refresh(A), B); assert.equal(calls, 2);
  }],
  ['masked-token validation rejects malformed values', async () => {
    for (const value of [null, '', 'x'.repeat(32), '!'.repeat(64), A + 'x']) {
      const state = createCsrfState(async () => value); await assert.rejects(state.get()); assert.throws(() => state.adopt(value));
    }
  }],
  ['safe reads avoid bootstrap and unsafe requests use masked header', async () => {
    let bootstraps = 0; const seen = []; const api = createCookieApi('https://shop.example', async () => { bootstraps++; return A; });
    api.defaults.adapter = async config => { seen.push(config); return response(config); };
    await api.get('/products/'); assert.equal(bootstraps, 0);
    for (const method of ['post', 'put', 'patch', 'delete']) await api.request({method, url: '/sales/'});
    assert.equal(bootstraps, 1); assert.equal(seen[0].headers.get('X-CSRFToken'), undefined);
    for (const config of seen.slice(1)) { assert.equal(config.headers.get('X-CSRFToken'), A); assert.equal(config.withCredentials, true); }
  }],
  ['foreign and non-API destinations are rejected before dispatch or bootstrap', async () => {
    let dispatches = 0, bootstraps = 0; const api = createCookieApi('https://shop.example', async () => { bootstraps++; return A; });
    api.defaults.adapter = async config => { dispatches++; return response(config); };
    for (const url of ['https://evil.example/api/sales/', '//evil.example/api/sales/', 'https://shop.example/private/', 'https://shop.example/api/../private/']) await assert.rejects(api.post(url, {}));
    assert.equal(dispatches, 0); assert.equal(bootstraps, 0);
  }],
  ['bootstrap errors prevent a business request', async () => {
    let dispatches = 0; const api = createCookieApi('https://shop.example', async () => 'bad');
    api.defaults.adapter = async config => { dispatches++; return response(config); };
    await assert.rejects(api.post('/sales/', {})); assert.equal(dispatches, 0);
  }],
  ['one CSRF retry preserves exact body UUID revision and uses new token', async () => {
    let calls = 0; const seen = []; const api = createCookieApi('https://shop.example', async () => ++calls === 1 ? A : B);
    api.defaults.adapter = async config => { seen.push({body:config.data, id:config.headers.get('Idempotency-Key'), revision:config.headers.get('If-Match'), token:config.headers.get('X-CSRFToken')});
      if (seen.length === 1) throw failure(config, 403, {code:'csrf_failed', retryable:true}); return response(config); };
    await api.patch('/sales/7/', {quantity:'0.000000001', notes:'same intent'}, {headers:{'Idempotency-Key':'stable-uuid', 'If-Match':'"8"'}});
    assert.equal(seen.length, 2); assert.deepEqual({...seen[0], token:B}, seen[1]); assert.equal(seen[0].token, A); assert.equal(calls, 2);
  }],
  ['repeated CSRF rejection stops after one recovery', async () => {
    let calls = 0, dispatches = 0; const api = createCookieApi('https://shop.example', async () => ++calls === 1 ? A : B);
    api.defaults.adapter = async config => { dispatches++; throw failure(config, 403, {code:'csrf_failed', retryable:true}); };
    await assert.rejects(api.post('/sales/', {})); assert.equal(dispatches, 2); assert.equal(calls, 2);
  }],
  ['401 general403 Origin failures and429 never auto-replay', async () => {
    for (const [status, error] of [[401, {code:'authentication_required'}], [403, {code:'forbidden'}], [403, {code:'csrf_failed',retryable:false}], [429, {code:'rate_limited',retry_after:60}], [500, {}]]) {
      let dispatches = 0, calls = 0; const api = createCookieApi('https://shop.example', async () => { calls++; return A; });
      api.defaults.adapter = async config => { dispatches++; throw failure(config, status, error); };
      await assert.rejects(api.post('/sales/', {})); assert.equal(dispatches, 1); assert.equal(calls, 1);
    }
  }],
  ['safe request403 is never auto-retried', async () => {
    let dispatches = 0; const api = createCookieApi('https://shop.example', async () => { throw new Error('unexpected bootstrap'); });
    api.defaults.adapter = async config => { dispatches++; throw failure(config, 403, {code:'csrf_failed',retryable:true}); };
    await assert.rejects(api.get('/products/')); assert.equal(dispatches, 1);
  }],
  ['successful login and logout adopt rotated token for next operation', async () => {
    const seen = []; const api = createCookieApi('https://shop.example', async () => A);
    api.defaults.adapter = async config => { seen.push(config.headers.get('X-CSRFToken')); return response(config, config.url === '/auth/login/' ? {csrf_token:B} : config.url === '/auth/logout/' ? {csrf_token:C} : {}); };
    await api.post('/auth/login/', {}); await api.post('/sales/', {}); await api.post('/auth/logout/'); await api.post('/auth/login/', {});
    assert.deepEqual(seen, [A, B, B, C]);
  }],
  ['structured authentication errors and legacy business fallbacks remain readable', async () => {
    assert.equal(apiErrorMessage(failure({}, 403, {message:'Request verification failed.'}), 'fallback'), 'Request verification failed.');
    assert.equal(apiErrorMessage(failure({}, 401), 'fallback'), 'Sign in before retrying this operation.');
    assert.equal(apiErrorMessage(failure({}, 403), 'fallback'), 'This request is not permitted.');
    assert.equal(apiErrorMessage(failure({}, 429), 'fallback'), 'Too many requests. Wait before retrying.');
    assert.equal(apiErrorMessage(failure({}, 400, {quantity:['invalid']}), 'fallback'), 'fallback');
    assert.equal(apiErrorMessage(failure({}, 409, 'Sale revision is stale; reload before editing.'), 'fallback'), 'fallback');
    assert.equal(apiErrorMessage(new Error('offline'), 'fallback'), 'fallback');
  }],
];
for (const [name, test] of tests) { await test(); console.log('PASS: ' + name); }
console.log(JSON.stringify({tests:tests.length, failures:0, database_access:false}, null, 2));
