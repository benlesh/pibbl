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
    'standing', 'cloud-0', 'cloud-1', 'trampoline', 'brick', 'stone', 'conveyor', 'shard-0', 'shard-1', 'coin-0', 'idle', 'walk', 'jump', 'fall',
  ].map(name => [name, frame])));
  const animation = defineSpriteAnimation({ frames: [frame], fps: 12 });
  return { frames, animations: Object.freeze({ idle: animation, walk: animation, jump: animation, fall: animation, spin: animation, conveyor: defineSpriteAnimation({ frames: [frame, frame, frame, frame], fps: 8 }) }), dispose: source.dispose };
}

it.each([
  { label: 'right conveyor', speed: 65, direction: 1 },
  { label: 'left conveyor', speed: -65, direction: -1 },
  { label: 'static gray stone', speed: undefined, direction: 0 },
])('moves an idle player only with the $label', async ({ speed, direction }) => {
  const driver = new ManualSchedulerDriver();
  const restore = installSchedulerDriverForTest(driver);
  const sheet = await testSheet();
  const game = createGame();
  game.blocks = Array.from({ length: 12 }, (_, column): Block => ({
    id: column + 1,
    x: column * 40,
    y: 560,
    width: 40,
    height: 40,
    brick: false,
    conveyor: speed,
  }));
  game.coinsLeft = [];
  game.trampolines = [];
  game.nextId = 13;
  game.nextTier = 10_000;
  game.checkpoint = { x: 208, y: 520 };
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

  for (let tick = 0; tick < 20; tick++) driver.flush(tick * 1000 / 60);
  const initialX = session.body!.position.get()[0];
  for (let tick = 20; tick < 60; tick++) driver.flush(tick * 1000 / 60);
  const delta = session.body!.position.get()[0] - initialX;

  if (direction === 0) expect(Math.abs(delta)).toBeLessThan(2);
  else expect(delta * direction).toBeGreaterThan(30);
  expect(session.body!.position.get()[1]).toBeCloseTo(520, 0);
});
