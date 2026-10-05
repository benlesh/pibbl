import { afterEach, expect, it } from 'vitest';
import { pibbl, signal } from '@pibbl/core';
import { createMachine } from '@pibbl/core/machines';
import { defineSpriteAnimation, loadSpriteSheet, type SpriteSheet } from '@pibbl/core/sprites';
import { clearSharedState } from '../../packages/core/src/lib/global-state';
import { ManualSchedulerDriver, installSchedulerDriverForTest } from '../../packages/core/src/lib/scheduler/testing';
import { sessionMachine } from './machines';
import { createGame, type Block } from './model';
import { GameScene, type GameSession } from './scene';

let dispose = () => {};

afterEach(() => {
  dispose();
  dispose = () => {};
  clearSharedState();
  document.body.replaceChildren();
});

async function testSheet(): Promise<SpriteSheet> {
  const source = await loadSpriteSheet(
    'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%221%22 height=%221%22%3E%3Crect width=%221%22 height=%221%22 fill=%22white%22/%3E%3C/svg%3E',
    { grid: { frameWidth: 1, frameHeight: 1 } },
  );
  const frame = source.frames[0];
  const frames = Object.freeze(Object.fromEntries([
    'standing', 'cloud-0', 'cloud-1', 'trampoline', 'brick', 'stone', 'shard-0', 'shard-1', 'coin-0', 'idle', 'walk', 'jump', 'fall',
  ].map(name => [name, frame])));
  const animation = defineSpriteAnimation({ frames: [frame], fps: 12 });
  return { frames, animations: Object.freeze({ idle: animation, walk: animation, jump: animation, fall: animation, spin: animation }), dispose: source.dispose };
}

/** The gameplay contract: a sensor launch can break a shaft, but solid stone ends it. */
it('launches through two brick rows and stops at a gray stone cap', async () => {
  const driver = new ManualSchedulerDriver();
  const restore = installSchedulerDriverForTest(driver);
  const sheet = await testSheet();
  const game = createGame();
  const support: Block = { id: 1, x: 200, y: 560, width: 40, height: 40, brick: false };
  const firstBrick: Block = { id: 2, x: 200, y: 440, width: 40, height: 40, brick: true };
  const secondBrick: Block = { id: 3, x: 200, y: 340, width: 40, height: 40, brick: true };
  const cap: Block = { id: 4, x: 200, y: 200, width: 40, height: 40, brick: false };
  game.blocks = [support, firstBrick, secondBrick, cap];
  game.trampolines = [{ id: 5, x: 200, y: 540 }];
  game.coinsLeft = [];
  game.nextId = 6;
  // Keep generated terrain out of this intentionally small collision fixture.
  game.nextTier = 10_000;
  game.checkpoint = { x: 208, y: 480 };

  let session!: GameSession;
  const flow = createMachine(sessionMachine, { input: { respawn: () => {} } });
  session = {
    game,
    revision: signal(0),
    keys: new Set(),
    jump: false,
    grounded: false,
    boostUntil: 0,
    sheet,
    flow,
    onUpdate: () => Object.assign(game, flow.snapshot.get().context, { phase: flow.snapshot.get().value }),
  };
  flow.start();
  flow.send({ type: 'START' });
  session.onUpdate();

  const canvas = document.createElement('canvas');
  canvas.width = 480;
  canvas.height = 640;
  document.body.appendChild(canvas);
  const root = pibbl(canvas, <GameScene session={session} />);
  dispose = () => { root.dispose(); flow.stop(); sheet.dispose(); restore(); };

  let fastestAscent = 0;
  for (let tick = 0; tick < 180; tick++) {
    driver.flush(tick * 1000 / 60);
    fastestAscent = Math.min(fastestAscent, session.body?.linearVelocity.get()[1] ?? 0);
  }

  expect(game.trampolines).toHaveLength(0);
  expect(fastestAscent).toBeLessThanOrEqual(-1_400);
  expect(game.blocks.filter(block => block.brick)).toHaveLength(0);
  expect(game.blocks).toContainEqual(cap);
  expect(session.boostUntil).toBe(0);
  expect(session.body?.position.get()[1]).toBeGreaterThanOrEqual(240);
});
