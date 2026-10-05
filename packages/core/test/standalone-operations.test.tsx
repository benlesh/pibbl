import { afterEach, expect, it } from 'vitest';
import * as core from '@pibbl/core';
import * as physics from '@pibbl/core/physics/2d';
import { installSchedulerDriverForTest, ManualSchedulerDriver } from '../src/lib/scheduler/testing.js';

const driver = new ManualSchedulerDriver();
let restore: (() => void) | undefined;
let mount: core.PibblController | undefined;
afterEach(() => { mount?.dispose(); restore?.(); });

it('provides fixed boolean, nullable, and array contracts for all five world queries', () => {
  restore = installSchedulerDriverForTest(driver);
  let world!: physics.PibblPhysicsWorldHandle2D;
  function Capture() { world = physics.pibblPhysicsWorld2D(); }
  mount = core.pibbl(document.createElement('canvas'),
    <physics.PhysicsWorld2D gravity={[0, 0]}>
      <Capture />
      <core.Circle physics={physics.staticBody2D()} style={{ radius: 5 }} />
    </physics.PhysicsWorld2D>);
  driver.flush(0);
  driver.flush(1);
  const ray = { origin: [-20, 0], direction: [1, 0], maxDistance: 40 } as const;
  const shape = physics.circleShape2D({ radius: 1 });
  const pose = { position: [0, 0], rotationDegrees: 0 } as const;
  const casts = [
    [() => physics.raycastAny2D(world, ray), () => physics.raycastClosest2D(world, ray), () => physics.raycastAll2D(world, ray)],
    [() => physics.shapeCastAny2D(world, shape, { ...pose, position: [-20, 0] }, [40, 0]), () => physics.shapeCastClosest2D(world, shape, { ...pose, position: [-20, 0] }, [40, 0]), () => physics.shapeCastAll2D(world, shape, { ...pose, position: [-20, 0] }, [40, 0])],
    [() => physics.hasShapeOverlap2D(world, shape, pose), () => physics.findShapeOverlap2D(world, shape, pose), () => physics.findAllShapeOverlaps2D(world, shape, pose)],
    [() => physics.hasAabbMatch2D(world, { min: [-1, -1], max: [1, 1] }), () => physics.findAabbMatch2D(world, { min: [-1, -1], max: [1, 1] }), () => physics.findAllAabbMatches2D(world, { min: [-1, -1], max: [1, 1] })],
    [() => physics.hasPointMatch2D(world, [0, 0]), () => physics.findPointMatch2D(world, [0, 0]), () => physics.findAllPointMatches2D(world, [0, 0])],
  ] as const;
  for (const [any, one, all] of casts) {
    expect(any()).toBe(true);
    expect(one()).toMatchObject({ bodyGeneration: expect.any(Number) });
    expect(all()).toEqual([one()]);
    expect(Object.isFrozen(all())).toBe(true);
  }
  expect(physics.hasPointMatch2D(world, [100, 100])).toBe(false);
  expect(physics.findPointMatch2D(world, [100, 100])).toBeNull();
  expect(physics.findAllPointMatches2D(world, [100, 100])).toEqual([]);
});

it('animates spring and generic tween targets without a type selector', () => {
  restore = installSchedulerDriverForTest(driver);
  let spring!: core.Signal<number>;
  let tween!: core.Signal<{ x: number }>;
  function Probe() {
    spring = core.useSpringValue(10, { initial: 0 });
    tween = core.useTweenValue({ x: 10 }, {
      initial: { x: 0 }, duration: 100,
      interpolate: (from, to, progress) => ({ x: from.x + (to.x - from.x) * progress }),
    });
  }
  mount = core.pibbl(document.createElement('canvas'), <Probe />);
  driver.flush(0);
  driver.flush(10);
  driver.flush(60);
  expect(spring.get()).toBeGreaterThan(0);
  expect(tween.get()).toEqual({ x: 5 });
  expect('set' in spring).toBe(false);
  expect('set' in tween).toBe(false);
});
