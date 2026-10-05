import { afterEach, expect, it } from 'vitest';
import { Group, Rectangle, drive, pibbl, signal, tween } from '@pibbl/core';
import { PhysicsWorld2D, dynamicBody2D, pibblPhysicsBody2D, type PibblPhysicsBodyHandle2D } from '@pibbl/core/physics/2d';
import { clearSharedState } from '../../packages/core/src/lib/global-state';
import { ManualSchedulerDriver, installSchedulerDriverForTest } from '../../packages/core/src/lib/scheduler/testing';
import { setGamePaused, useGameBody, useGamePlayback, type GamePauseSession } from './pause';

let dispose = () => {};

afterEach(() => {
  dispose();
  dispose = () => {};
  clearSharedState();
  document.body.replaceChildren();
});

it('freezes registered physics and playback time, then resumes both', () => {
  const driver = new ManualSchedulerDriver();
  const restore = installSchedulerDriverForTest(driver);
  const session: GamePauseSession = {};
  const progress = signal(0);
  let body!: PibblPhysicsBodyHandle2D;
  function Scene() {
    body = pibblPhysicsBody2D();
    useGameBody(session, body);
    useGamePlayback(session, drive(progress, tween({ from: 0, to: 1, duration: 1_000 })), { autoplay: true });
    return <PhysicsWorld2D gravity={[0, 0]}>
      <Group style={{ translateX: 20, translateY: 20 }} physics={dynamicBody2D({ handle: body, mass: 1, linearVelocity: [80, 0] })}>
        <Rectangle style={{ width: 20, height: 20 }} />
      </Group>
    </PhysicsWorld2D>;
  }
  const canvas = document.createElement('canvas');
  canvas.width = 200;
  canvas.height = 120;
  document.body.appendChild(canvas);
  const root = pibbl(canvas, <Scene />);
  dispose = () => { root.dispose(); restore(); };

  for (let tick = 0; tick < 20; tick++) driver.flush(tick * 1000 / 60);
  const beforePause = { x: body.position.get()[0], progress: progress.get() };
  setGamePaused(session, true);
  // One scheduled frame commits the pause commands; a paused game requests no more work.
  driver.flush(20 * 1000 / 60);
  expect(body.position.get()[0]).toBeCloseTo(beforePause.x, 4);
  expect(progress.get()).toBeCloseTo(beforePause.progress, 4);

  setGamePaused(session, false);
  for (let tick = 80; tick < 110; tick++) driver.flush(tick * 1000 / 60);
  expect(body.position.get()[0]).toBeGreaterThan(beforePause.x + 25);
  expect(progress.get()).toBeGreaterThan(beforePause.progress + 0.25);
});
