import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertNativeDeliveryProvenance } from './input-provenance.mjs';

const pointer = () => ({ original: { type: 'click', isTrusted: true }, source: null,
  userActivation: { status: 'available', scope: 'window-at-delivery', isActive: false, hasBeenActive: true },
  permissions: 'not-observed' });
const keyboard = () => ({ ...pointer(), original: { type: 'click', isTrusted: false }, source: { type: 'keydown', isTrusted: true } });

test('accepts scoped native pointer and keyboard evidence without claiming activation or permission', () => {
  assertNativeDeliveryProvenance(pointer(), 'pointer');
  assertNativeDeliveryProvenance(keyboard(), 'keyboard');
  assertNativeDeliveryProvenance({ ...pointer(), userActivation: { status: 'unavailable', scope: 'window-at-delivery' } }, 'pointer');
});

test('rejects missing provenance, untrusted input and incorrect source attribution', () => {
  for (const input of [null, undefined, {}, { ...pointer(), original: { type: 'click', isTrusted: false } },
    { ...pointer(), source: { type: 'keydown', isTrusted: true } },
    { ...pointer(), original: { type: 'mousedown', isTrusted: true } }]) {
    assert.throws(() => assertNativeDeliveryProvenance(input, 'pointer'));
  }
  for (const input of [pointer(), { ...keyboard(), source: { type: 'keydown', isTrusted: false } },
    { ...keyboard(), source: null }, { ...keyboard(), original: { type: 'click', isTrusted: true } }]) {
    assert.throws(() => assertNativeDeliveryProvenance(input, 'keyboard'));
  }
  assert.throws(() => assertNativeDeliveryProvenance(pointer(), 'unknown'));
});

test('rejects malformed activation observations and implied permission grants', () => {
  for (const userActivation of [null, {}, { status: 'available', scope: 'window-at-delivery', isActive: 'false', hasBeenActive: true },
    { status: 'available', scope: 'window-at-delivery', isActive: false },
    { status: 'available', scope: 'current-event', isActive: false, hasBeenActive: true },
    { status: 'unavailable', scope: 'window-at-delivery', isActive: false },
    { status: 'unknown', scope: 'window-at-delivery' }]) {
    assert.throws(() => assertNativeDeliveryProvenance({ ...pointer(), userActivation }, 'pointer'));
  }
  assert.throws(() => assertNativeDeliveryProvenance({ ...pointer(), permissions: 'granted' }, 'pointer'));
});
