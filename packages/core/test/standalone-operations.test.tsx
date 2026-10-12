import { afterEach, expect, it, vi } from 'vitest';
import * as core from '@pibbl/core';
import * as physics from '@pibbl/core/physics/2d';


let driver: ManualFrames;

let mount: core.PibblController | undefined;
afterEach(() => { mount?.dispose(); vi.restoreAllMocks(); document.body.replaceChildren(); });
function createCanvas() { const canvas = document.createElement("canvas"); document.body.appendChild(canvas); return canvas; }

it('provides fixed boolean, nullable, and array contracts for all five world queries', () => {
  driver = new ManualFrames();
  driver.install();
  let world!: physics.PibblPhysicsWorldHandle2D;
  function Capture() { world = physics.pibblPhysicsWorld2D(); }
  mount = core.pibbl(createCanvas(),
    <physics.PhysicsWorld2D gravity={[0, 0]}>
      <Capture />
      <core.Circle physics={physics.staticBody2D()} style={{ radius: 5 }} />
    </physics.PhysicsWorld2D>);
  driver.flush(0);
  if (driver.pending) driver.flush(1);
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
  // Foreign JavaScript properties cannot override the named return contract.
  const obsoleteOptions = { mode: 'all', sensors: 'include' as const };
  expect(physics.raycastAny2D(world, ray, obsoleteOptions)).toBe(true);
  const body = physics.findPointMatch2D(world, [0, 0])!.body;
  physics.disableBody2D(body);
  driver.flush(2);
  for (const [any, one, all] of casts) {
    expect(any()).toBe(false);
    expect(one()).toBeNull();
    expect(all()).toEqual([]);
  }
});

it('animates spring and generic tween targets without a type selector', () => {
  driver = new ManualFrames();
  driver.install();
  let spring!: core.Signal<number>;
  let tween!: core.Signal<{ x: number }>;
  function Probe() {
    spring = core.useAnimatedValue(10, { animation: core.spring({ stiffness: 180 }), initial: 0 });
    tween = core.useAnimatedValue({ x: 10 }, {
      initial: { x: 0 },
      animation: core.tween<{ x: number }>({
        duration: 100,
        interpolate: (from, to, progress) => ({ x: from.x + (to.x - from.x) * progress }),
      }),
    });
  }
  mount = core.pibbl(createCanvas(), <Probe />);
  driver.flush(0);
  driver.flush(10);
  driver.flush(60);
  expect(spring.get()).toBeGreaterThan(0);
  expect(tween.get()).toEqual({ x: 5 });
  expect('set' in spring).toBe(false);
  expect('set' in tween).toBe(false);
});

it('accepts a custom animation factory using the hook-owned endpoints', () => {
  driver = new ManualFrames();
  driver.install();
  let output!: core.Signal<number>;
  function Probe() {
    output = core.useAnimatedValue(20, {
      initial: 10,
      animation: ({ from, to }) => core.defineAnimation({
        duration: 100,
        sample: ({ progress }) => from + (to - from) * progress * progress,
      }),
    });
  }
  mount = core.pibbl(createCanvas(), <Probe />);
  driver.flush(0);
  driver.flush(10);
  driver.flush(60);
  expect(output.get()).toBe(12.5);
});

it('reuses definitions across independent targets without changing playback endpoints', () => {
  driver = new ManualFrames();
  driver.install();
  const definition = core.tween({ from: 100, to: 200, duration: 100 });
  const playbackOutput = core.signal(100);
  let first!: core.Signal<number>;
  let second!: core.Signal<number>;
  let play!: () => void;
  function Probe() {
    first = core.useAnimatedValue(10, { animation: definition, initial: 0 });
    second = core.useAnimatedValue(40, { animation: definition, initial: 20 });
    const playback = core.usePlayback(core.drive(playbackOutput, definition));
    play = () => playback.play();
  }
  mount = core.pibbl(createCanvas(), <Probe />);
  driver.flush(0);
  play();
  driver.flush(10);
  driver.flush(60);
  expect(first.get()).toBe(5);
  expect(second.get()).toBe(30);
  expect(playbackOutput.get()).toBe(150);
  expect(Object.isFrozen(definition)).toBe(true);
});

it('rejects targetless definitions outside the target-driven hook', () => {
  for (const definition of [core.spring(), core.tween({ duration: 100 })]) {
    expect(() => core.drive(core.signal(0), definition)).toThrow('supply to');
  }
});

class ManualFrames {
  private callbacks = new Map<number, FrameRequestCallback>();
  private nextId = 0;

  get pending(): number {
    return this.callbacks.size;
  }

  install(): void {
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation(
      (callback) => {
        const id = ++this.nextId;
        this.callbacks.set(id, callback);
        return id;
      },
    );
    vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation((id) => {
      this.callbacks.delete(id);
    });
  }

  flush(time: number): void {
    const entry = this.callbacks.entries().next().value as
      readonly [number, FrameRequestCallback] | undefined;
    if (!entry) throw new Error("No Pibbl host frame is pending.");
    this.callbacks.delete(entry[0]);
    entry[1](time);
  }
}
