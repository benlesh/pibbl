import { describe, expect, it } from "vitest";
import {
  boundsOfShape2D,
  boxShape2D,
  circleShape2D,
} from "../../../2d-geometry.js";
import { requireShapeRecord2D } from "../shape-records.js";
import { createPhysicsOwnershipCounters2D } from "../runtime/ownership.js";
import { COLLIDER_SENSOR_2D } from "./contact-cache.js";
import { BODY_TYPE_DYNAMIC_2D } from "./integrator.js";
import { BODY_CCD_2D, BoundedCcd2D } from "./ccd.js";
import { DynamicAabbBroadPhase2D } from "./broad-phase.js";
import { BodyStore2D, ColliderStore2D } from "./storage.js";

interface CcdFixture {
  readonly bodies: BodyStore2D;
  readonly colliders: ColliderStore2D;
  readonly broadPhase: DynamicAabbBroadPhase2D;
  readonly ccd: BoundedCcd2D;
  readonly bodyIndices: number[];
  addCircle(
    options: Readonly<{
      x: number;
      radius: number;
      dynamic?: boolean;
      ccd?: boolean;
      sensor?: boolean;
      restitution?: number;
      localCenterX?: number;
    }>,
  ): Readonly<{ body: number; collider: number }>;
  addWall(x: number, options?: Readonly<{ sensor?: boolean; restitution?: number }>): number;
  resolve(body: number, fromX: number): void;
}

function createFixture(): CcdFixture {
  const counters = createPhysicsOwnershipCounters2D();
  const bodies = new BodyStore2D(counters, 8);
  const colliders = new ColliderStore2D(counters, 8);
  const broadPhase = new DynamicAabbBroadPhase2D(counters, 8, 16);
  const ccd = new BoundedCcd2D(8);
  const bodyIndices: number[] = [];
  const add = (
    shape: ReturnType<typeof circleShape2D> | ReturnType<typeof boxShape2D>,
    options: Readonly<{
      x: number;
      dynamic: boolean;
      ccd: boolean;
      sensor: boolean;
      restitution: number;
      localCenterX: number;
    }>,
  ) => {
    const body = bodies.allocate({
      positionX: options.x + options.localCenterX,
      positionY: 0,
      rotationRadians: 0,
      localCenterX: options.localCenterX,
      localCenterY: 0,
      linearVelocityX: 0,
      linearVelocityY: 0,
      angularVelocity: 0,
      forceX: 0,
      forceY: 0,
      torque: 0,
      inverseMass: options.dynamic ? 1 : 0,
      inverseInertia: options.dynamic ? 1 : 0,
      linearDamping: 0,
      angularDamping: 0,
      gravityScale: 0,
      sleepTime: 0,
      flags: (options.dynamic ? BODY_TYPE_DYNAMIC_2D : 0) | (options.ccd ? BODY_CCD_2D : 0),
      owner: {},
    });
    bodyIndices.push(body);
    const collider = colliders.allocate({
      bodyIndex: body,
      bodyGeneration: bodies.generations[body]!,
      shape: requireShapeRecord2D(shape),
      material: { friction: 0, restitution: options.restitution },
      filter: null,
      tag: null,
      handlers: null,
      owner: shape,
      flags: options.sensor ? COLLIDER_SENSOR_2D : 0,
    });
    const bounds = boundsOfShape2D(shape, {
      position: [options.x, 0],
      rotationDegrees: 0,
    });
    const proxy = broadPhase.createProxy(
      collider,
      colliders.generations[collider]!,
      bounds.min[0],
      bounds.min[1],
      bounds.max[0],
      bounds.max[1],
    );
    colliders.setProxy(collider, colliders.generations[collider]!, proxy, broadPhase.proxyGenerations[proxy]!);
    return { body, collider };
  };
  const fixture: CcdFixture = {
    bodies,
    colliders,
    broadPhase,
    ccd,
    bodyIndices,
    addCircle(options) {
      const localCenterX = options.localCenterX ?? 0;
      return add(
        circleShape2D({
          radius: options.radius,
          center: [localCenterX, 0],
        }),
        {
          x: options.x,
          dynamic: options.dynamic ?? true,
          ccd: options.ccd ?? false,
          sensor: options.sensor ?? false,
          restitution: options.restitution ?? 0,
          localCenterX,
        },
      );
    },
    addWall(x, options = {}) {
      return add(wallShape, {
        x,
        dynamic: false,
        ccd: false,
        sensor: options.sensor ?? false,
        restitution: options.restitution ?? 0,
        localCenterX: 0,
      }).collider;
    },
    resolve(body, fromX) {
      const previousX = new Float64Array(bodies.capacity);
      const previousY = new Float64Array(bodies.capacity);
      const previousRotation = new Float64Array(bodies.capacity);
      previousX[body] = fromX;
      ccd.resolveCandidateBodies(
        bodies,
        colliders,
        broadPhase,
        Int32Array.of(body),
        1,
        previousX,
        previousY,
        previousRotation,
      );
    },
  };
  return fixture;
}

const wallShape = boxShape2D({ width: 0.2, height: 10 });

describe("bounded opted-in 2D CCD", () => {
  it("stops an opted-in small circle at the earliest thin solid wall", () => {
    const scene = createFixture();
    const bullet = scene.addCircle({ x: 0, radius: 0.1, ccd: true });
    const wall = scene.addWall(5);
    scene.bodies.positionX[bullet.body] = 10;
    scene.bodies.linearVelocityX[bullet.body] = 10;

    scene.resolve(bullet.body, 0);

    expect(scene.ccd.impactCount).toBe(1);
    expect(scene.ccd.impactColliderIndices[0]).toBe(wall);
    expect(scene.bodies.positionX[bullet.body]).toBeCloseTo(4.8, 5);
    expect(scene.bodies.linearVelocityX[bullet.body]).toBeCloseTo(0, 12);
  });

  it("chooses lower collider identity for equal-time walls", () => {
    const scene = createFixture();
    const bullet = scene.addCircle({ x: 0, radius: 0.1, ccd: true });
    const lower = scene.addWall(5);
    scene.addWall(5);
    scene.bodies.positionX[bullet.body] = 10;
    scene.bodies.linearVelocityX[bullet.body] = 10;

    scene.resolve(bullet.body, 0);

    expect(scene.ccd.impactColliderIndices[0]).toBe(lower);
  });

  it("sweeps an off-origin moving collider from center-of-mass storage", () => {
    const scene = createFixture();
    const bullet = scene.addCircle({
      x: 0,
      radius: 0.1,
      ccd: true,
      localCenterX: 2,
    });
    const wall = scene.addWall(5);
    scene.bodies.positionX[bullet.body] = 12;
    scene.bodies.linearVelocityX[bullet.body] = 10;

    scene.resolve(bullet.body, 2);

    expect(scene.ccd.impactColliderIndices[0]).toBe(wall);
    expect(scene.bodies.positionX[bullet.body]).toBeCloseTo(4.8, 5);
  });

  it("casts against an off-origin target collider from its authored body pose", () => {
    const scene = createFixture();
    const bullet = scene.addCircle({ x: 0, radius: 0.1, ccd: true });
    const target = scene.addCircle({
      x: 5,
      radius: 0.1,
      localCenterX: 2,
    });
    scene.bodies.positionX[bullet.body] = 10;
    scene.bodies.linearVelocityX[bullet.body] = 10;

    scene.resolve(bullet.body, 0);

    expect(scene.ccd.impactColliderIndices[0]).toBe(target.collider);
    expect(scene.bodies.positionX[bullet.body]).toBeCloseTo(6.8, 5);
  });

  it("characterizes disabled CCD and sensors as discrete", () => {
    const disabled = createFixture();
    const ordinary = disabled.addCircle({ x: 0, radius: 0.1 });
    disabled.addWall(5);
    disabled.bodies.positionX[ordinary.body] = 10;
    disabled.bodies.linearVelocityX[ordinary.body] = 10;
    disabled.resolve(ordinary.body, 0);
    expect(disabled.bodies.positionX[ordinary.body]).toBe(10);
    expect(disabled.ccd.impactCount).toBe(0);

    const sensorScene = createFixture();
    const bullet = sensorScene.addCircle({ x: 0, radius: 0.1, ccd: true });
    sensorScene.addWall(5, { sensor: true });
    sensorScene.bodies.positionX[bullet.body] = 10;
    sensorScene.bodies.linearVelocityX[bullet.body] = 10;
    sensorScene.resolve(bullet.body, 0);
    expect(sensorScene.bodies.positionX[bullet.body]).toBe(10);
    expect(sensorScene.ccd.impactCount).toBe(0);
  });

  it("terminates a deterministic pinball corridor at the four-impact cap", () => {
    const run = () => {
      const scene = createFixture();
      const bullet = scene.addCircle({
        x: 0,
        radius: 0.1,
        ccd: true,
        restitution: 1,
      });
      scene.addWall(-1, { restitution: 1 });
      scene.addWall(1, { restitution: 1 });
      scene.bodies.positionX[bullet.body] = 100;
      scene.bodies.linearVelocityX[bullet.body] = 100;
      scene.resolve(bullet.body, 0);
      return {
        position: scene.bodies.positionX[bullet.body],
        velocity: scene.bodies.linearVelocityX[bullet.body],
        impacts: Array.from(scene.ccd.impactColliderIndices.subarray(0, scene.ccd.impactCount)),
        capCount: scene.ccd.capCount,
      };
    };

    const first = run();
    expect(first.impacts).toHaveLength(4);
    expect(first.capCount).toBe(1);
    expect(run()).toEqual(first);
  });
});
