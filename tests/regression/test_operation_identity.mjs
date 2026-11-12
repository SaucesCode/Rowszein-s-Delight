import assert from 'node:assert/strict';
import { beginIdentity, rejectIdentity } from '../../frontend/src/lib/operationIdentity.ts';

class MemoryStorage {
  values = new Map();
  getItem(name) { return this.values.get(name) ?? null; }
  setItem(name, value) { this.values.set(name, value); }
  removeItem(name) { this.values.delete(name); }
}
const error = (status, data = 'rejected') => ({ isAxiosError: true, response: { status, data } });
const name = 'user:1:sale:create';
const read = (store) => JSON.parse(store.getItem(name));
const fresh = () => { const store = new MemoryStorage(); beginIdentity(store, name, '1', () => 'original-uuid'); return store; };
const tests = [
  ['first attempt is persisted before dispatch', () => {
    const store = fresh();
    assert.deepEqual(read(store), { key: 'original-uuid', revision: '1', hasPriorAttempt: false });
  }],
  ['retry retains UUID and original revision', () => {
    const store = fresh();
    const result = beginIdentity(store, name, '9', () => { throw new Error('must not replace UUID'); });
    assert.deepEqual(result, { key: 'original-uuid', revision: '1', hasPriorAttempt: true });
  }],
  ['first known rejection may clear an uncommitted identity', () => {
    for (const status of [400, 404, 409]) {
      const store = fresh(); rejectIdentity(store, name, error(status)); assert.equal(store.getItem(name), null);
    }
  }],
  ['identity conflict never clears a pending UUID', () => {
    const store = fresh(); rejectIdentity(store, name, error(409, 'This request identity was already used for a different payload.')); assert.equal(read(store).key, 'original-uuid');
  }],
  ['network loss retains identity', () => {
    const store = fresh(); rejectIdentity(store, name, new Error('connection reset')); assert.equal(read(store).key, 'original-uuid');
  }],
  ['first authentication, CSRF, forbidden and rate-limit failures retain the same UUID', () => {
    for (const status of [401, 403, 429]) {
      const store = fresh(); rejectIdentity(store, name, error(status, { error: { code: status === 403 ? 'csrf_failed' : 'authentication_required' } }));
      assert.equal(read(store).key, 'original-uuid');
      assert.equal(beginIdentity(store, name, '99', () => { throw new Error('must not invent a new request'); }).revision, '1');
    }
  }],
  ['later validation cannot forget an uncertain earlier commit', () => {
    const store = fresh(); beginIdentity(store, name, '1', () => 'replacement'); rejectIdentity(store, name, error(400)); assert.equal(read(store).key, 'original-uuid');
  }],
  ['later auth and stale errors cannot forget earlier attempts', () => {
    for (const status of [401, 403, 404, 409]) {
      const store = fresh(); beginIdentity(store, name, '2', () => 'replacement'); rejectIdentity(store, name, error(status)); assert.equal(read(store).key, 'original-uuid');
    }
  }],
  ['server failure is uncertain on the first attempt', () => {
    const store = fresh(); rejectIdentity(store, name, error(500)); assert.equal(read(store).key, 'original-uuid');
  }],
  ['old pending identities migrate conservatively on retry', () => {
    const store = new MemoryStorage(); store.setItem(name, JSON.stringify({ key: 'legacy-key', revision: '3' }));
    beginIdentity(store, name, '9', () => 'replacement'); rejectIdentity(store, name, error(400)); assert.equal(read(store).key, 'legacy-key');
  }],
  ['corrupt storage fails closed instead of inventing a UUID', () => {
    for (const text of ['{invalid', '{}']) {
      const store = new MemoryStorage(); store.setItem(name, text); assert.throws(() => beginIdentity(store, name, '1', () => 'replacement')); assert.equal(store.getItem(name), text);
    }
  }],
  ['storage failure prevents request dispatch', () => {
    const store = fresh(); store.setItem = () => { throw new Error('quota unavailable'); };
    assert.throws(() => beginIdentity(store, name, '1', () => 'replacement'));
  }],
  ['confirmed success permits a new independent operation', () => {
    const store = fresh(); store.removeItem(name);
    assert.equal(beginIdentity(store, name, '2', () => 'new-uuid').key, 'new-uuid');
  }],
];
for (const [name, test] of tests) { test(); console.log('PASS: ' + name); }
console.log(JSON.stringify({ tests: tests.length, failures: 0, database_access: false }, null, 2));
