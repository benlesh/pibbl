import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, awardCoins, breakBrick } from './model.ts';
test('coin thresholds award lives once and brick breaks are idempotent', () => {
  const game = createGame(); awardCoins(game, 99); assert.equal(game.lives, 3);
  awardCoins(game, 1); assert.equal(game.lives, 4);
  awardCoins(game, 205); assert.equal(game.lives, 6);
  const brick = game.blocks.find(block => block.brick)!;
  breakBrick(game, brick.id); breakBrick(game, brick.id);
  assert.equal(game.debris.length, 4); assert.equal(game.blocks.some(block => block.id === brick.id), false);
  const fresh = createGame(); assert.equal(fresh.coins, 0); assert.equal(fresh.lives, 3);
});
