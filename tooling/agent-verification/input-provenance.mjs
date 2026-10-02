import assert from 'node:assert/strict';

/** Validate this replay's known input transport; this is not a permission oracle. */
export function assertNativeDeliveryProvenance(input, transport) {
  assert.ok(transport === 'pointer' || transport === 'keyboard', 'Unknown input transport.');
  assert.ok(input && typeof input === 'object', 'Delivered input provenance is missing.');
  assert.deepEqual(input.original, { type: 'click', isTrusted: transport === 'pointer' });
  assert.deepEqual(input.source, transport === 'keyboard' ? { type: 'keydown', isTrusted: true } : null);
  assert.equal(input.permissions, 'not-observed');
  const activation = input.userActivation;
  assert.ok(activation && typeof activation === 'object', 'Window activation observation is missing.');
  assert.equal(activation.scope, 'window-at-delivery');
  if (activation.status === 'unavailable') {
    assert.deepEqual(activation, { status: 'unavailable', scope: 'window-at-delivery' });
  } else {
    assert.equal(activation.status, 'available');
    assert.equal(typeof activation.isActive, 'boolean');
    assert.equal(typeof activation.hasBeenActive, 'boolean');
  }
}
