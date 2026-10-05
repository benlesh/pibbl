import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BLOCK_SIZE,
  advanceEndlessWorld,
  awardCoins,
  blockX,
  breakBrick,
  createGame,
  cutJumpVelocity,
  respawnPoint,
} from './model.ts';
test('coin thresholds award lives once per 500 coins and brick breaks are idempotent', () => {
  const game = createGame(); awardCoins(game, 499); assert.equal(game.lives, 3);
  awardCoins(game, 1); assert.equal(game.lives, 4);
  awardCoins(game, 1_005); assert.equal(game.lives, 6);
  const brick = game.blocks.find(block => block.brick)!;
  breakBrick(game, brick.id); breakBrick(game, brick.id);
  assert.equal(game.debris.length, 4); assert.equal(game.blocks.some(block => block.id === brick.id), false);
  const fresh = createGame(); assert.equal(fresh.coins, 0); assert.equal(fresh.lives, 3);
});
test('initial checkpoint leaves the full player collider outside all blocks', () => {
  const game = createGame();
  const { x, y } = game.checkpoint;
  assert.equal(game.blocks.some(block => x < block.x + block.width && x + 24 > block.x && y < block.y + block.height && y + 40 > block.y), false);
});
test('endless generation is deterministic, stays ahead of the upward camera, and prunes below it', () => {
  const first = createGame();
  const second = createGame();
  assert.deepEqual(first.blocks, second.blocks);
  assert.deepEqual(first.coinsLeft, second.coinsLeft);
  assert.deepEqual(first.trampolines, second.trampolines);
  assert.ok(first.blocks.every(block => block.width === BLOCK_SIZE && block.height === BLOCK_SIZE));
  const firstLedge = first.blocks.find(block => !block.brick && block.y === 520)!;
  assert.equal(firstLedge.y - 400, 120);
  assert.ok(first.trampolines.every(trampoline => first.blocks.some(block =>
    !block.brick && blockX(block, first.time) === trampoline.x && block.y - trampoline.y === 20 && !block.motion,
  )));
  assert.ok(first.blocks.some(block => block.motion), 'expected deterministic moving stone ledges');
  advanceEndlessWorld(first, -5000, 1_000);
  assert.ok(first.camera < 0);
  assert.ok(first.blocks.length > 20, 'expected a generated terrain window');
  assert.ok(first.blocks.every(block => block.y - first.camera < 910));
  assert.equal(new Set(first.blocks.map(block => block.id)).size, first.blocks.length);
  assert.equal(new Set(first.coinsLeft.map(coin => coin.id)).size, first.coinsLeft.length);
});
test('camera accelerates with height, never falls back, and keeps a bounded generated window', () => {
  const game = createGame();
  advanceEndlessWorld(game, 538, 1_000);
  assert.equal(game.camera, -12);
  game.camera = -10_000;
  advanceEndlessWorld(game, 10_000, 1_000);
  assert.equal(game.camera, -10_070);
  advanceEndlessWorld(game, 50_000, 1_000);
  assert.ok(game.camera <= -24);
  for (let frame = 0; frame < 5_000; frame++) advanceEndlessWorld(game, -frame * 18, 1_000 / 60);
  assert.ok(game.blocks.length < 250, `expected pruning, found ${game.blocks.length} blocks`);
  assert.ok(game.coinsLeft.length < 70, `expected pruning, found ${game.coinsLeft.length} coins`);
  assert.ok(game.trampolines.length < 12, `expected pruning, found ${game.trampolines.length} trampolines`);
  const allIds = [...game.blocks.map(block => block.id), ...game.coinsLeft.map(coin => coin.id), ...game.trampolines.map(trampoline => trampoline.id)];
  assert.equal(new Set(allIds).size, allIds.length);
});
test('moving ledges share one deterministic offset across their blocks', () => {
  const game = createGame();
  const moving = game.blocks.filter(block => block.motion);
  assert.ok(moving.length >= 2);
  const [first, second] = moving;
  assert.equal(first.motion, second.motion);
  assert.equal(blockX(first, 0) - blockX(second, 0), first.x - second.x);
  assert.notEqual(blockX(first, first.motion!.period / 4), blockX(first, 0));
  assert.ok(moving.every(block => block.x - block.motion!.amplitude >= 0 && block.x + block.width + block.motion!.amplitude <= 480));
});
test('terrain includes both conveyor directions while gray stone stays still', () => {
  const game = createGame();
  advanceEndlessWorld(game, -12_000, 1_000);
  const belts = game.blocks.filter(block => block.conveyor !== undefined);
  assert.ok(belts.some(block => block.conveyor! > 0));
  assert.ok(belts.some(block => block.conveyor! < 0));
  assert.ok(belts.every(block => !block.motion));
  const beltGroups = new Map<number, number>();
  for (const belt of belts) beltGroups.set(belt.y, (beltGroups.get(belt.y) ?? 0) + 1);
  assert.ok([...beltGroups.values()].every(width => width >= 3));
  const gray = game.blocks.find(block => !block.brick && !block.motion && block.conveyor === undefined)!;
  assert.equal(blockX(gray, 0), blockX(gray, 10_000));
});
test('respawn chooses a visible floor or creates a checkpoint recovery ledge without moving camera', () => {
  const game = createGame();
  game.camera = -10_000;
  game.blocks = [];
  const camera = game.camera;
  const point = respawnPoint(game);
  assert.equal(game.camera, camera);
  assert.equal(game.blocks.length, 3);
  assert.deepEqual(game.checkpoint, point);
  assert.equal(point.y + 40, game.blocks[1].y);
});
test('jump release cuts only upward speed', () => {
  assert.equal(cutJumpVelocity(-560, false), -220);
  assert.equal(cutJumpVelocity(-100, false), -100);
  assert.equal(cutJumpVelocity(-560, true), -560);
  assert.equal(cutJumpVelocity(120, false), 120);
});
