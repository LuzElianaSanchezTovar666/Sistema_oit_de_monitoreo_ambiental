import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidAreaCode } from '../src/services/locationService';

test('isValidAreaCode valida formato consistente de código de área (ej. AREA-01)', () => {
  assert.equal(isValidAreaCode('AREA-01'), true);
  assert.equal(isValidAreaCode('area-05'), true);
  assert.equal(isValidAreaCode('LAB-A2'), true);
  assert.equal(isValidAreaCode('AREA01'), false);
  assert.equal(isValidAreaCode('AREA-'), false);
  assert.equal(isValidAreaCode(''), false);
});
