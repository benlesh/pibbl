import { afterEach, expect, it } from 'vitest';
import { pibbl, signal } from '@pibbl/core';
import { createMachine } from '@pibbl/core/machines';
import { defineSpriteAnimation, loadSpriteSheet, type SpriteSheet } from '@pibbl/core/sprites';
import { clearSharedState } from '../../packages/core/src/lib/global-state';
import { ManualSchedulerDriver, installSchedulerDriverForTest, snapshotRealmScheduler } from '../../packages/core/src/lib/scheduler/testing';
import { sessionMachine } from './machines';
import { createGame } from './model';
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

it('keeps the physical player unmounted during initial spawning presentation', async () => {
  const driver = new ManualSchedulerDriver();
  const restore = installSchedulerDriverForTest(driver);
  const sheet = await testSheet();
  const game = createGame();
  let session!: GameSession & { presentation?: 'dying' | 'spawning' };
  const flow = createMachine(sessionMachine, { input: { respawn: () => {} } });
  session = {
    game, revision: signal(0), keys: new Set(), jump: false, grounded: false, boostUntil: 0, sheet, flow,
    presentation: 'spawning',
    onUpdate: () => Object.assign(game, flow.snapshot.get().context, { phase: flow.snapshot.get().value }),
  };
  flow.start();
  flow.send({ type: 'START' });
  session.onUpdate();
  const canvas = document.createElement('canvas');
  canvas.width = 480; canvas.height = 640; document.body.appendChild(canvas);
  const root = pibbl(canvas, <GameScene session={session} />);
  dispose = () => { root.dispose(); expect(driver.pendingHostFrames, JSON.stringify(snapshotRealmScheduler())).toBe(0); flow.stop(); sheet.dispose(); restore(); };

  driver.flush(0);
  expect(session.body).toBeUndefined();
});

it('unmounts the body for death, respawns through Bifrost, and remounts only after arrival', async () => {
  const driver = new ManualSchedulerDriver();
  const restore = installSchedulerDriverForTest(driver);
  const sheet = await testSheet();
  const game = createGame();
  let session!: GameSession;
  const flow = createMachine(sessionMachine, { input: { respawn: () => {
    session.presentation = 'spawning';
    session.game.checkpoint = { x: 200, y: 400 };
  } } });
  session = {
    game, revision: signal(0), keys: new Set(), jump: false, grounded: false, boostUntil: 0, sheet, flow,
    presentation: 'spawning',
    onUpdate: () => Object.assign(game, flow.snapshot.get().context, { phase: flow.snapshot.get().value }),
  };
  flow.start(); flow.send({ type: 'START' }); session.onUpdate();
  const canvas = document.createElement('canvas');
  canvas.width = 480; canvas.height = 640; document.body.appendChild(canvas);
  const root = pibbl(canvas, <GameScene session={session} />);
  dispose = () => { root.dispose(); expect(driver.pendingHostFrames, JSON.stringify(snapshotRealmScheduler())).toBe(0); flow.stop(); sheet.dispose(); restore(); };

  driver.flush(0);
  expect(session.body).toBeUndefined();
  await Promise.resolve();
  driver.flush(1);
  driver.flush(851);
  await Promise.resolve();
  driver.flush(852);
  expect(session.presentation).toBeUndefined();
  expect(session.body).toBeDefined();

  session.presentation = 'dying';
  session.deathPosition = { x: 220, y: 600 };
  session.revision.update(value => value + 1);
  driver.flush(860);
  expect(session.body).toBeUndefined();
  driver.flush(861);
  driver.flush(2_061);
  await Promise.resolve();
  driver.flush(2_062);
  expect(session.game.lives).toBe(2);
  expect(session.presentation).toBe('spawning');
  expect(session.body).toBeUndefined();
  await Promise.resolve();
  driver.flush(2_063);
  driver.flush(2_913);
  await Promise.resolve();
  driver.flush(2_914);
  expect(session.presentation).toBeUndefined();
  expect(session.body).toBeDefined();
});
