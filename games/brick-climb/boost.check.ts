import { test } from 'node:test';
import assert from 'node:assert/strict';
import { launchBoost, stopBoost, boostVelocity, type BoostState } from './boost.ts';
test('trampoline holds a powerful ascent through brick impacts, then returns to ordinary jumping', () => {
  const state: BoostState = { boostUntil: 0 };
  launchBoost(state, 100);
  assert.equal(boostVelocity(state, 200, 0), -1500);
  assert.equal(boostVelocity(state, 500, 0), -1500);
  assert.equal(boostVelocity(state, 1100, -1500), -560);
  assert.equal(state.boostUntil, 0);
});
test('stone cancels the boost immediately and does not resume on the next frame', () => {
  const state: BoostState = { boostUntil: 0 };
  launchBoost(state, 100);
  stopBoost(state);
  assert.equal(state.jumpVelocity, 0);
  assert.equal(boostVelocity(state, 200, 0), 0);
});

test('a descending player crossing the spring surface launches even when contact began on ascent', async () => {
  const { landedTrampoline } = await import('./boost.ts');
  const spring = { id: 7, x: 200, y: 500 };
  assert.equal(landedTrampoline([spring], [208, 450], [208, 465]), spring);
  assert.equal(landedTrampoline([spring], [208, 470], [208, 450]), undefined);
  assert.equal(landedTrampoline([spring], [150, 450], [150, 465]), undefined);
});
