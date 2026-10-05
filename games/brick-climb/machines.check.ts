import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMachine } from '@pibbl/core/machines';
import { sessionMachine } from './machines.ts';

test('session events own coin thresholds, game over, and a clean restart', () => {
  let respawns = 0;
  const actor = createMachine(sessionMachine, { input: { respawn: () => respawns++ } });
  actor.start();
  assert.equal(actor.snapshot.get().value, 'start');
  actor.send({ type: 'COLLECT', amount: 200 });
  assert.equal(actor.snapshot.get().context.coins, 0);
  actor.send({ type: 'START' });
  actor.send({ type: 'COLLECT', amount: 1_005 });
  assert.equal(actor.snapshot.get().context.lives, 5);
  assert.equal(actor.snapshot.get().context.score, 100_500);
  for (let i = 0; i < 5; i++) actor.send({ type: 'LIFE_LOST' });
  assert.equal(actor.snapshot.get().value, 'over');
  assert.equal(respawns, 4);
  actor.send({ type: 'COLLECT', amount: 100 });
  assert.equal(actor.snapshot.get().context.coins, 1_005);
  actor.send({ type: 'RESTART' });
  assert.equal(actor.snapshot.get().value, 'playing');
  assert.deepEqual(actor.snapshot.get().context, { coins: 0, lives: 3, score: 0 });
  actor.stop();
});

 test('an endless session has no victory state or height-based completion event', () => {
  assert.equal('won' in sessionMachine.states, false);
});
