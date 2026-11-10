// Pure TypeScript utility checks only. No server, API, database or migrations.
import assert from 'node:assert/strict';
import { stockQuanta, stockText } from '../../frontend/src/lib/stockQuantity.ts';

const cases = [
  () => assert.equal(stockText(stockQuanta('0.000000001')), '0.000000001'),
  () => assert.equal(stockText(stockQuanta('-0.000000001')), '-0.000000001'),
  () => assert.equal(stockText(stockQuanta('99999999999.999999999')), '99999999999.999999999'),
  () => assert.equal(stockText(stockQuanta('1') - stockQuanta('.1'.replace(/^\./, '0.'))), '0.900000000'),
  () => assert.equal(stockText(stockQuanta('19.99') + stockQuanta('0.003333334')), '19.993333334'),
  () => assert.throws(() => stockQuanta('0.0000000001')),
  () => assert.throws(() => stockQuanta('100000000000')),
  () => assert.throws(() => stockQuanta('1e-9')),
  () => assert.throws(() => stockQuanta('NaN')),
  () => assert.equal(stockText(stockQuanta('0.1') + stockQuanta('0.2')), '0.300000000'),
];
for (const test of cases) test();
console.log(JSON.stringify({ tests: cases.length, failures: 0, database_access: false }, null, 2));
