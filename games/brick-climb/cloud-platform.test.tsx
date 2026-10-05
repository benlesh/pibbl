import { afterEach, expect, it, vi } from 'vitest';
import { pibbl, signal } from '@pibbl/core';
import { createMachine } from '@pibbl/core/machines';
import { setLinearVelocity2D } from '@pibbl/core/physics/2d';
import { defineSpriteAnimation, loadSpriteSheet, type SpriteSheet } from '@pibbl/core/sprites';
import { clearSharedState } from '../../packages/core/src/lib/global-state';
import { ManualSchedulerDriver, installSchedulerDriverForTest } from '../../packages/core/src/lib/scheduler/testing';
import { sessionMachine } from './machines';
import { blockX, createGame, type Block } from './model';
import { GameScene, type GameSession } from './scene';

let dispose = () => {};
afterEach(() => { dispose(); dispose = () => {}; vi.restoreAllMocks(); clearSharedState(); document.body.replaceChildren(); });

async function testSheet(): Promise<SpriteSheet> {
  const source = await loadSpriteSheet('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%221%22 height=%221%22%3E%3Crect width=%221%22 height=%221%22 fill=%22white%22/%3E%3C/svg%3E', { grid: { frameWidth: 1, frameHeight: 1 } });
  const frame = source.frames[0];
  const frames = Object.freeze(Object.fromEntries(['standing', 'cloud-0', 'cloud-1', 'cloud-block', 'trampoline', 'brick', 'stone', 'conveyor', 'conveyor-left', 'conveyor-right', 'shard-0', 'shard-1', 'coin-0', 'idle', 'walk', 'jump', 'fall'].map(name => [name, frame])));
  const animation = defineSpriteAnimation({ frames: [frame], fps: 12 });
  return { frames, animations: Object.freeze({ idle: animation, walk: animation, jump: animation, fall: animation, spin: animation, conveyor: animation, 'conveyor-left': animation, 'conveyor-right': animation, 'cloud-block': animation }), dispose: source.dispose };
}

function mountCloud(checkpoint: { x: number; y: number }, phase = 0) {
  const driver = new ManualSchedulerDriver();
  const restore = installSchedulerDriverForTest(driver);
  const game = createGame();
  const motion = { amplitude: 80, period: 4_000, phase };
  const cloud: Block = { id: 1, x: 160, y: 560, width: 40, height: 40, brick: false, platformId: 1, motion };
  game.blocks = Array.from({ length: 4 }, (_, index) => ({ ...cloud, id: index + 1, x: cloud.x + index * 40 }));
  game.coinsLeft = []; game.trampolines = []; game.nextTier = 10_000; game.checkpoint = checkpoint;
  return { driver, restore, game, cloud };
}

it('passes upward through a cloud and lands on top to ride its rounded motion', async () => {
  const { driver, restore, game, cloud } = mountCloud({ x: 280, y: 600 });
  const sheet = await testSheet();
  const cloudDraws: Array<readonly [number, number]> = [];
  vi.spyOn(CanvasRenderingContext2D.prototype, 'drawImage').mockImplementation((function (this: CanvasRenderingContext2D, ...args: unknown[]) {
    if (args.length === 9) {
      const transform = this.getTransform();
      if (Math.abs(transform.a) === 40 && Math.abs(transform.d) === 40) cloudDraws.push([transform.e, transform.f]);
    }
  }) as never);
  let session!: GameSession;
  const flow = createMachine(sessionMachine, { input: { respawn: () => {} } });
  session = { game, revision: signal(0), keys: new Set(['Space']), jump: false, grounded: false, boostUntil: 0, sheet, flow, onUpdate: () => Object.assign(game, flow.snapshot.get().context, { phase: flow.snapshot.get().value }) };
  flow.start(); flow.send({ type: 'START' }); session.onUpdate();
  const canvas = document.createElement('canvas'); canvas.width = 480; canvas.height = 640; document.body.appendChild(canvas);
  const root = pibbl(canvas, <GameScene session={session} />);
  dispose = () => { root.dispose(); flow.stop(); sheet.dispose(); restore(); };
  driver.flush(0);
  setLinearVelocity2D(session.body!, [0, -600]);
  let highest = Infinity;
  for (let tick = 1; tick < 110; tick++) {
    driver.flush(tick * 1000 / 60);
    highest = Math.min(highest, session.body?.position.get()[1] ?? Infinity);
  }
  expect(highest).toBeLessThan(520);
  expect(session.body!.position.get()[1]).toBeCloseTo(520, 0);
  expect(session.grounded).toBe(true);
  expect(Math.abs(session.body!.position.get()[0] - 280)).toBeGreaterThan(10);
  expect(Math.abs(blockX(cloud, game.time) - cloud.x)).toBeGreaterThan(10);
  const firstCloudTileEachRender = cloudDraws.filter((_, index) => index % 4 === 0);
  expect(firstCloudTileEachRender.length).toBeGreaterThan(2);
  expect(Math.abs(firstCloudTileEachRender.at(-1)![0] - firstCloudTileEachRender[0][0])).toBeGreaterThan(10);
  expect(firstCloudTileEachRender.every(([x, y]) => Math.abs(x - Math.round(x)) < 1e-4 && Math.abs(y - Math.round(y)) < 1e-4)).toBe(true);
});

it('never side-pushes a player while the cloud crosses beside them', async () => {
  const { driver, restore, game } = mountCloud({ x: 140, y: 560 }, Math.PI);
  game.camera = 200;
  const sheet = await testSheet();
  let session!: GameSession;
  const flow = createMachine(sessionMachine, { input: { respawn: () => {} } });
  session = { game, revision: signal(0), keys: new Set(), jump: false, grounded: false, boostUntil: 0, sheet, flow, onUpdate: () => Object.assign(game, flow.snapshot.get().context, { phase: flow.snapshot.get().value }) };
  flow.start(); flow.send({ type: 'START' }); session.onUpdate();
  const canvas = document.createElement('canvas'); canvas.width = 480; canvas.height = 640; document.body.appendChild(canvas);
  const root = pibbl(canvas, <GameScene session={session} />);
  dispose = () => { root.dispose(); flow.stop(); sheet.dispose(); restore(); };
  for (let tick = 0; tick < 35; tick++) driver.flush(tick * 1000 / 60);
  expect(session.body!.position.get()[0]).toBeCloseTo(140, 0);
});
