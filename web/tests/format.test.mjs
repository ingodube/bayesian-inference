import test from 'node:test';
import assert from 'node:assert/strict';
import {formatNumber} from '../src/format.mjs';
test('extreme finite values stay compact without losing their scale',()=>{
  assert.equal(formatNumber(1.90687e298),'1.90687E298');
  assert.equal(formatNumber(1.2e-12),'1.2E-12');
  assert.equal(formatNumber(0),'0');
  assert.equal(formatNumber(null),'Not defined');
  assert.equal(formatNumber(30.182),'30.182');
});
