import { afterEach, expect, it } from 'vitest';
import { pibbl, Group, Rectangle } from '@pibbl/core';
import { PhysicsWorld2D, staticBody2D, dynamicBody2D, pibblPhysicsBody2D, setLinearVelocity2D, type PibblPhysicsBodyHandle2D } from '@pibbl/core/physics/2d';
import { ManualSchedulerDriver, installSchedulerDriverForTest } from '../../packages/core/src/lib/scheduler/testing';
import { clearSharedState } from '../../packages/core/src/lib/global-state';
import { playerCollider2D } from './player-physics';

let dispose = () => {};
afterEach(() => { dispose(); clearSharedState(); document.body.replaceChildren(); });

it.each([1, -1])('runs across adjoining brick seams in direction %s', direction => {
  const driver = new ManualSchedulerDriver();
  const restore = installSchedulerDriverForTest(driver);
  let player!: PibblPhysicsBodyHandle2D;
  function Scene() {
    player = pibblPhysicsBody2D();
    return <PhysicsWorld2D gravity={[0, 1050]}>
      {[0, 40, 80, 120, 160, 200, 240, 280].map(x => <Rectangle key={x} style={{ left: x, top: 100, width: 40, height: 40 }} physics={staticBody2D({ collider: { friction: 0 } })} />)}
      <Group style={{ translateX: direction > 0 ? 15 : 260, translateY: 60 }} physics={dynamicBody2D({ handle: player, mass: 1, collider: false, fixedRotation: true, ccd: true })}>
        <Rectangle style={{ width: 24, height: 40 }} physics={playerCollider2D()} />
      </Group>
    </PhysicsWorld2D>;
  }
  const canvas = document.createElement('canvas'); canvas.width = 400; canvas.height = 200; document.body.appendChild(canvas);
  const root = pibbl(canvas, <Scene />);
  dispose = () => { root.dispose(); restore(); };
  let tick = 0;
  for (; tick < 30; tick++) driver.flush(tick * 1000 / 60);
  const initial = player.position.get()[0];
  for (; tick < 90; tick++) {
    setLinearVelocity2D(player, [direction * 190, player.linearVelocity.get()[1]]);
    driver.flush(tick * 1000 / 60);
  }
  expect((player.position.get()[0] - initial) * direction).toBeGreaterThan(165);
  // Capsule contacts may lift the body slightly while crossing a tile seam.
  // It must keep moving and remain within the game's 4px feet-support tolerance.
  expect(Math.abs(player.position.get()[1] - 60)).toBeLessThan(3);
});
