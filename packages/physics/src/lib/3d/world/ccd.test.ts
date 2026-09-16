import { describe, expect, it } from "vitest";
import {
  boundsOfShape3D,
  boxShape3D,
  sphereShape3D,
  type CRCPhysicsShape3D,
} from "../../../3d-geometry.js";
import { requireShapeRecord3D } from "../shape-records.js";
import { createPhysicsOwnershipCounters3D } from "../runtime/ownership.js";
import { DynamicAabbBroadPhase3D } from "./broad-phase.js";
import { BODY_CCD_3D, BoundedCcd3D } from "./ccd.js";
import { BODY_SLEEPING_3D } from "./solver.js";
import {
  BODY_ENABLED_3D,
  BODY_TYPE_DYNAMIC_3D,
  BODY_TYPE_KINEMATIC_3D,
  COLLIDER_ENABLED_3D,
  COLLIDER_SENSOR_3D,
  BodyStore3D,
  ColliderStore3D,
} from "./storage.js";

function createFixture() {
  const counters = createPhysicsOwnershipCounters3D();
  const bodies = new BodyStore3D(counters, 16);
  const colliders = new ColliderStore3D(counters, 16);
  const broadPhase = new DynamicAabbBroadPhase3D(counters, 16, 32);
  const ccd = new BoundedCcd3D(16);
  const add = (
    shape: CRCPhysicsShape3D,
    options: Readonly<{
      x: number;
      dynamic: boolean;
      kinematic?: boolean;
      ccd: boolean;
      sensor: boolean;
      restitution: number;
      localCenterX?: number;
      category?: number;
      mask?: number;
      group?: number;
    }>,
  ) => {
    const localCenterX = options.localCenterX ?? 0;
    const body = bodies.allocate({
      positionX: options.x + localCenterX,
      positionY: 0,
      positionZ: 0,
      orientationX: 0,
      orientationY: 0,
      orientationZ: 0,
      orientationW: 1,
      localCenterX,
      localCenterY: 0,
      localCenterZ: 0,
      linearVelocityX: 0,
      linearVelocityY: 0,
      linearVelocityZ: 0,
      angularVelocityX: 0,
      angularVelocityY: 0,
      angularVelocityZ: 0,
      forceX: 0,
      forceY: 0,
      forceZ: 0,
      torqueX: 0,
      torqueY: 0,
      torqueZ: 0,
      inverseMass: options.dynamic ? 1 : 0,
      localInverseInertiaXX: options.dynamic ? 1 : 0,
      localInverseInertiaYY: options.dynamic ? 1 : 0,
      localInverseInertiaZZ: options.dynamic ? 1 : 0,
      localInverseInertiaXY: 0,
      localInverseInertiaXZ: 0,
      localInverseInertiaYZ: 0,
      linearDamping: 0,
      angularDamping: 0,
      gravityScale: 0,
      sleepTime: 0,
      translationLocks: 0,
      rotationLocks: 0,
      flags:
        BODY_ENABLED_3D |
        (options.dynamic
          ? BODY_TYPE_DYNAMIC_3D
          : options.kinematic === true
            ? BODY_TYPE_KINEMATIC_3D
            : 0) |
        (options.ccd ? BODY_CCD_3D : 0),
      owner: {},
    });
    const collider = colliders.allocate({
      bodyIndex: body,
      bodyGeneration: bodies.generations[body]!,
      shape: requireShapeRecord3D(shape),
      localPositionX: 0,
      localPositionY: 0,
      localPositionZ: 0,
      localOrientationX: 0,
      localOrientationY: 0,
      localOrientationZ: 0,
      localOrientationW: 1,
      density: 1,
      friction: 0,
      restitution: options.restitution,
      collisionCategory: options.category ?? 1,
      collisionMask: options.mask ?? 0xffff_ffff,
      collisionGroup: options.group ?? 0,
      tag: null,
      handlers: null,
      owner: shape,
      flags: COLLIDER_ENABLED_3D | (options.sensor ? COLLIDER_SENSOR_3D : 0),
    });
    const bounds = boundsOfShape3D(shape, {
      position: [options.x, 0, 0],
      orientation: [0, 0, 0, 1],
    });
    const proxy = broadPhase.createProxy(
      collider,
      colliders.generations[collider]!,
      bounds.min[0],
      bounds.min[1],
      bounds.min[2],
      bounds.max[0],
      bounds.max[1],
      bounds.max[2],
    );
    colliders.setProxy(
      collider,
      colliders.generations[collider]!,
      proxy,
      broadPhase.proxyGenerations[proxy]!,
    );
    return { body, collider };
  };
  const resolveBodies = (
    entries: readonly Readonly<{ body: number; fromX: number }>[],
  ) => {
    const previousX = new Float64Array(bodies.capacity);
    const previousY = new Float64Array(bodies.capacity);
    const previousZ = new Float64Array(bodies.capacity);
    const previousOrientationX = new Float64Array(bodies.capacity);
    const previousOrientationY = new Float64Array(bodies.capacity);
    const previousOrientationZ = new Float64Array(bodies.capacity);
    const previousOrientationW = new Float64Array(bodies.capacity);
    for (let body = 0; body < bodies.capacity; body += 1) {
      previousX[body] = bodies.positionX[body]!;
      previousY[body] = bodies.positionY[body]!;
      previousZ[body] = bodies.positionZ[body]!;
      previousOrientationX[body] = bodies.orientationX[body]!;
      previousOrientationY[body] = bodies.orientationY[body]!;
      previousOrientationZ[body] = bodies.orientationZ[body]!;
      previousOrientationW[body] = bodies.orientationW[body]!;
    }
    for (const entry of entries) previousX[entry.body] = entry.fromX;
    previousOrientationW.fill(1);
    ccd.resolveCandidateBodies(
      bodies,
      colliders,
      broadPhase,
      Int32Array.from(entries.map(({ body }) => body)),
      entries.length,
      previousX,
      previousY,
      previousZ,
      previousOrientationX,
      previousOrientationY,
      previousOrientationZ,
      previousOrientationW,
    );
  };
  const resolve = (body: number, fromX: number) => {
    resolveBodies([{ body, fromX }]);
  };
  return { bodies, colliders, broadPhase, ccd, add, resolve, resolveBodies };
}

const bulletSphere = sphereShape3D({ radius: 0.1 });
const thinWall = boxShape3D({ width: 0.2, height: 10, depth: 10 });

describe("bounded opted-in 3D CCD", () => {
  it("casts crossing dynamic bodies from target start poses with relative translation", () => {
    const scene = createFixture();
    const first = scene.add(bulletSphere, {
      x: -1,
      dynamic: true,
      ccd: true,
      sensor: false,
      restitution: 0,
    });
    const second = scene.add(bulletSphere, {
      x: 1,
      dynamic: true,
      ccd: true,
      sensor: false,
      restitution: 0,
    });
    scene.bodies.positionX[first.body] = 1;
    scene.bodies.positionX[second.body] = -1;
    scene.bodies.linearVelocityX[first.body] = 2;
    scene.bodies.linearVelocityX[second.body] = -2;

    scene.resolveBodies([
      { body: first.body, fromX: -1 },
      { body: second.body, fromX: 1 },
    ]);

    expect(scene.ccd.impactCount).toBe(2);
    expect(scene.bodies.positionX[first.body]).toBeLessThan(
      scene.bodies.positionX[second.body]!,
    );
    expect(scene.bodies.linearVelocityX[first.body]).toBeLessThanOrEqual(0);
    expect(scene.bodies.linearVelocityX[second.body]).toBeGreaterThanOrEqual(0);
  });

  it("casts a dynamic mover against a crossing kinematic target using relative motion", () => {
    const scene = createFixture();
    const moving = scene.add(bulletSphere, {
      x: -1,
      dynamic: true,
      ccd: true,
      sensor: false,
      restitution: 0,
    });
    const kinematic = scene.add(bulletSphere, {
      x: 1,
      dynamic: false,
      kinematic: true,
      ccd: false,
      sensor: false,
      restitution: 0,
    });
    scene.bodies.positionX[moving.body] = 1;
    scene.bodies.positionX[kinematic.body] = -1;
    scene.bodies.linearVelocityX[moving.body] = 2;
    scene.bodies.linearVelocityX[kinematic.body] = -2;

    scene.resolveBodies([
      { body: moving.body, fromX: -1 },
      { body: kinematic.body, fromX: 1 },
    ]);

    expect(scene.ccd.impactCount).toBe(1);
    expect(scene.ccd.impactColliderIndices[0]).toBe(kinematic.collider);
    expect(scene.bodies.positionX[moving.body]).toBeLessThan(
      scene.bodies.positionX[kinematic.body]!,
    );
    expect(scene.bodies.linearVelocityX[moving.body]).toBeLessThanOrEqual(-2);
  });

  it("stops opted-in sphere and box bodies at the earliest thin solid target with stable ties", () => {
    for (const movingShape of [
      bulletSphere,
      boxShape3D({ width: 0.2, height: 0.2, depth: 0.2 }),
    ]) {
      const scene = createFixture();
      const bullet = scene.add(movingShape, {
        x: 0,
        dynamic: true,
        ccd: true,
        sensor: false,
        restitution: 0,
      });
      const lower = scene.add(thinWall, {
        x: 5,
        dynamic: false,
        ccd: false,
        sensor: false,
        restitution: 0,
      });
      scene.add(thinWall, {
        x: 5,
        dynamic: false,
        ccd: false,
        sensor: false,
        restitution: 0,
      });
      scene.bodies.positionX[bullet.body] = 10;
      scene.bodies.linearVelocityX[bullet.body] = 10;

      scene.resolve(bullet.body, 0);

      expect(scene.ccd.impactCount).toBe(1);
      expect(scene.ccd.impactColliderIndices[0]).toBe(lower.collider);
      expect(scene.bodies.positionX[bullet.body]).toBeCloseTo(4.8, 5);
      expect(scene.bodies.linearVelocityX[bullet.body]).toBeCloseTo(0, 12);
    }
  });

  it("keeps disabled CCD, sensors, and rejected collision filters discrete", () => {
    const ordinary = createFixture();
    const bullet = ordinary.add(bulletSphere, {
      x: 0,
      dynamic: true,
      ccd: false,
      sensor: false,
      restitution: 0,
    });
    ordinary.add(thinWall, {
      x: 5,
      dynamic: false,
      ccd: false,
      sensor: false,
      restitution: 0,
    });
    ordinary.bodies.positionX[bullet.body] = 10;
    ordinary.resolve(bullet.body, 0);
    expect(ordinary.bodies.positionX[bullet.body]).toBe(10);
    expect(ordinary.ccd.impactCount).toBe(0);

    for (const target of [
      { sensor: true, category: 1, mask: 0xffff_ffff, group: 0 },
      { sensor: false, category: 2, mask: 0, group: 0 },
      { sensor: false, category: 1, mask: 0xffff_ffff, group: -7 },
    ]) {
      const scene = createFixture();
      const moving = scene.add(bulletSphere, {
        x: 0,
        dynamic: true,
        ccd: true,
        sensor: false,
        restitution: 0,
        category: target.group === -7 ? 1 : 1,
        mask: target.group === -7 ? 0xffff_ffff : 1,
        group: target.group,
      });
      scene.add(thinWall, {
        x: 5,
        dynamic: false,
        ccd: false,
        restitution: 0,
        ...target,
      });
      scene.bodies.positionX[moving.body] = 10;
      scene.resolve(moving.body, 0);
      expect(scene.bodies.positionX[moving.body]).toBe(10);
      expect(scene.ccd.impactCount).toBe(0);
    }
  });

  it("excludes disabled bodies, sleeping movers, and same-body colliders", () => {
    for (const excluded of [
      "disabled-mover",
      "disabled-target",
      "sleeping-mover",
      "same-body",
    ] as const) {
      const scene = createFixture();
      const moving = scene.add(bulletSphere, {
        x: 0,
        dynamic: true,
        ccd: true,
        sensor: false,
        restitution: 0,
      });
      const target = scene.add(thinWall, {
        x: 5,
        dynamic: false,
        ccd: false,
        sensor: false,
        restitution: 0,
      });
      if (excluded === "disabled-mover") {
        scene.bodies.flags[moving.body] &= ~BODY_ENABLED_3D;
      } else if (excluded === "disabled-target") {
        scene.bodies.flags[target.body] &= ~BODY_ENABLED_3D;
      } else if (excluded === "sleeping-mover") {
        scene.bodies.flags[moving.body] |= BODY_SLEEPING_3D;
      } else {
        scene.colliders.bodyIndices[target.collider] = moving.body;
      }
      scene.bodies.positionX[moving.body] = 10;

      scene.resolve(moving.body, 0);

      expect(scene.ccd.impactCount, excluded).toBe(0);
      expect(scene.bodies.positionX[moving.body], excluded).toBe(10);
    }
  });

  it("terminates a deterministic pinball corridor at exactly four impacts and completes the remainder discretely", () => {
    const run = () => {
      const scene = createFixture();
      const bullet = scene.add(bulletSphere, {
        x: 0,
        dynamic: true,
        ccd: true,
        sensor: false,
        restitution: 1,
      });
      for (const x of [-1, 1]) {
        scene.add(thinWall, {
          x,
          dynamic: false,
          ccd: false,
          sensor: false,
          restitution: 1,
        });
      }
      scene.bodies.positionX[bullet.body] = 100;
      scene.bodies.linearVelocityX[bullet.body] = 100;
      scene.resolve(bullet.body, 0);
      return {
        position: scene.bodies.positionX[bullet.body],
        velocity: scene.bodies.linearVelocityX[bullet.body],
        impacts: Array.from(
          scene.ccd.impactColliderIndices.subarray(0, scene.ccd.impactCount),
        ),
        capCount: scene.ccd.capCount,
      };
    };

    const first = run();
    expect(first.impacts).toHaveLength(4);
    expect(first.capCount).toBe(1);
    expect(Number.isFinite(first.position)).toBe(true);
    expect(run()).toEqual(first);
  });
});
