import test from 'node:test';
import assert from 'node:assert/strict';
import { INVALID_MAC_MESSAGE, isValidMacFormat } from '../src/services/deviceService';

test('isValidMacFormat valida formato estricto AA:BB:CC:DD:EE:FF', () => {
  assert.equal(isValidMacFormat('24:6F:28:B1:C0:04'), true);
  assert.equal(isValidMacFormat('aa:bb:cc:dd:ee:ff'), true);
  assert.equal(isValidMacFormat('24-6F-28-B1-C0-04'), false);
  assert.equal(isValidMacFormat('ZZ:6F:28:B1:C0:04'), false);
  assert.equal(isValidMacFormat('24:6F:28'), false);
  assert.equal(INVALID_MAC_MESSAGE, 'La dirección MAC ya existe o no tiene formato válido');
});
