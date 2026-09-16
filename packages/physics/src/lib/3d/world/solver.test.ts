import { describe, expect, it } from "vitest";
import { boxShape3D, sphereShape3D } from "../../../3d-geometry.js";
import type { PrivateManifold3D } from "../collision/manifold.js";
import { requireShapeRecord3D, type ShapeRecord3D } from "../shape-records.js";
import { createPhysicsOwnershipCounters3D } from "../runtime/ownership.js";
import {
  ContactCache3D,
  manifoldBetweenStoredColliders3D,
  updateSortedContactCache3D,
  type SortedColliderPairs3D,
} from "./contact-cache.js";
import { integrateCandidateBodies3D } from "./integrator.js";
import { SequentialImpulseSolver3D } from "./solver.js";
import {
  BODY_ENABLED_3D,
  BODY_TYPE_DYNAMIC_3D,
  COLLIDER_ENABLED_3D,
  COLLIDER_SENSOR_3D,
  BodyStore3D,
  ColliderStore3D,
} from "./storage.js";

const sphere = requireShapeRecord3D(sphereShape3D({ radius: 1 }));
const box = requireShapeRecord3D(boxShape3D({ width: 2, height: 2, depth: 2 }));
const ground = requireShapeRecord3D(
  boxShape3D({ width: 20, height: 1, depth: 20 }),
);

interface Fixture3D {
  readonly counters: ReturnType<typeof createPhysicsOwnershipCounters3D>;
  readonly bodies: BodyStore3D;
  readonly colliders: ColliderStore3D;
  readonly cache: ContactCache3D;
  readonly solver: SequentialImpulseSolver3D;
  addBody(
    options?: Readonly<{
      dynamic?: boolean;
      x?: number;
      y?: number;
      z?: number;
      vx?: number;
      vy?: number;
      vz?: number;
      wx?: number;
      wy?: number;
      wz?: number;
    }>,
  ): number;
  addCollider(
    bodyIndex: number,
    shape?: ShapeRecord3D,
    options?: Readonly<{
      friction?: number;
      restitution?: number;
      sensor?: boolean;
    }>,
  ): number;
}

function createFixture(): Fixture3D {
  const counters = createPhysicsOwnershipCounters3D();
  const bodies = new BodyStore3D(counters, 8);
  const colliders = new ColliderStore3D(counters, 8);
  const cache = new ContactCache3D(counters, 8);
  const solver = new SequentialImpulseSolver3D(counters, 8, 8);
  return {
    counters,
    bodies,
    colliders,
    cache,
    solver,
    addBody(options = {}) {
      const dynamic = options.dynamic ?? true;
      return bodies.allocate({
        positionX: options.x ?? 0,
        positionY: options.y ?? 0,
        positionZ: options.z ?? 0,
        orientationX: 0,
        orientationY: 0,
        orientationZ: 0,
        orientationW: 1,
        linearVelocityX: options.vx ?? 0,
        linearVelocityY: options.vy ?? 0,
        linearVelocityZ: options.vz ?? 0,
        angularVelocityX: options.wx ?? 0,
        angularVelocityY: options.wy ?? 0,
        angularVelocityZ: options.wz ?? 0,
        forceX: 0,
        forceY: 0,
        forceZ: 0,
        torqueX: 0,
        torqueY: 0,
        torqueZ: 0,
        inverseMass: dynamic ? 1 : 0,
        localInverseInertiaXX: dynamic ? 1 : 0,
        localInverseInertiaYY: dynamic ? 1 : 0,
        localInverseInertiaZZ: dynamic ? 1 : 0,
        localInverseInertiaXY: 0,
        localInverseInertiaXZ: 0,
        localInverseInertiaYZ: 0,
        linearDamping: 0,
        angularDamping: 0,
        gravityScale: 1,
        sleepTime: 0,
        translationLocks: 0,
        rotationLocks: 0,
        flags: BODY_ENABLED_3D | (dynamic ? BODY_TYPE_DYNAMIC_3D : 0),
        owner: {},
      });
    },
    addCollider(bodyIndex, shapeRecord = sphere, options = {}) {
      return colliders.allocate({
        bodyIndex,
        bodyGeneration: bodies.generations[bodyIndex]!,
        shape: shapeRecord,
        localPositionX: 0,
        localPositionY: 0,
        localPositionZ: 0,
        localOrientationX: 0,
        localOrientationY: 0,
        localOrientationZ: 0,
        localOrientationW: 1,
        density: 1,
        friction: options.friction ?? 0.5,
        restitution: options.restitution ?? 0,
        collisionCategory: 1,
        collisionMask: 0xffff_ffff,
        collisionGroup: 0,
        tag: null,
        handlers: null,
        owner: {},
        flags:
          COLLIDER_ENABLED_3D |
          (options.sensor === true ? COLLIDER_SENSOR_3D : 0),
      });
    },
  };
}

function pairs(
  entries: readonly (readonly [number, number])[],
  fixture: Fixture3D,
): SortedColliderPairs3D {
  return {
    pairFirstColliderIndices: Int32Array.from(entries.map((entry) => entry[0])),
    pairFirstColliderGenerations: Uint32Array.from(
      entries.map((entry) => fixture.colliders.generations[entry[0]]!),
    ),
    pairSecondColliderIndices: Int32Array.from(
      entries.map((entry) => entry[1]),
    ),
    pairSecondColliderGenerations: Uint32Array.from(
      entries.map((entry) => fixture.colliders.generations[entry[1]]!),
    ),
    pairCount: entries.length,
  };
}

function collide(
  fixture: Fixture3D,
  entries: readonly (readonly [number, number])[],
): void {
  updateSortedContactCache3D(
    fixture.cache,
    pairs(entries, fixture),
    fixture.bodies,
    fixture.colliders,
    (first, second) =>
      manifoldBetweenStoredColliders3D(
        fixture.bodies,
        fixture.colliders,
        first,
        second,
      ),
  );
}

function manualManifold(
  options: Readonly<{
    normal?: readonly [number, number, number];
    first?: readonly [number, number, number];
    second?: readonly [number, number, number];
    separation?: number;
  }> = {},
): PrivateManifold3D {
  const normal = options.normal ?? [0, 1, 0];
  const first = options.first ?? [0, -1, 0];
  const second = options.second ?? first;
  return {
    normalX: normal[0],
    normalY: normal[1],
    normalZ: normal[2],
    points: [
      {
        firstX: first[0],
        firstY: first[1],
        firstZ: first[2],
        secondX: second[0],
        secondY: second[1],
        secondZ: second[2],
        separation: options.separation ?? -0.1,
        firstFeature: 1,
        secondFeature: 2,
      },
    ],
  };
}

function solve(
  fixture: Fixture3D,
  bodyIndices: readonly number[],
  velocityIterations = 8,
  positionIterations = 3,
): void {
  fixture.solver.solveCandidate(
    fixture.bodies,
    Int32Array.from(bodyIndices),
    bodyIndices.length,
    fixture.cache,
    velocityIterations,
    positionIterations,
  );
}

describe("deterministic 3D sequential impulse solver", () => {
  it("counts each configured solver pass from inside the loops and resets per solve", () => {
    const fixture = createFixture();
    const body = fixture.addBody();

    solve(fixture, [body], 2, 3);
    expect(fixture.solver.velocityIterationsPerformed).toBe(2);
    expect(fixture.solver.positionIterationsPerformed).toBe(3);

    solve(fixture, [body], 1, 0);
    expect(fixture.solver.velocityIterationsPerformed).toBe(1);
    expect(fixture.solver.positionIterationsPerformed).toBe(0);
  });

  it("rests a sphere on the ground and executes exactly configured iterations", () => {
    const fixture = createFixture();
    const sphereBody = fixture.addBody({ y: 0.9, vy: -1 });
    const groundBody = fixture.addBody({ dynamic: false, y: -0.5 });
    const sphereCollider = fixture.addCollider(sphereBody, sphere);
    const groundCollider = fixture.addCollider(groundBody, ground);
    collide(fixture, [[sphereCollider, groundCollider]]);

    solve(fixture, [sphereBody, groundBody], 7, 2);

    expect(fixture.cache.contactCount).toBe(1);
    expect(fixture.solver.constraintCount).toBe(1);
    expect(fixture.solver.islandCount).toBe(1);
    expect(fixture.solver.velocityIterationsPerformed).toBe(7);
    expect(fixture.solver.positionIterationsPerformed).toBe(2);
    expect(fixture.bodies.linearVelocityY[sphereBody]).toBeCloseTo(0, 9);
    expect(fixture.bodies.positionY[sphereBody]).toBeGreaterThan(0.9);
    expect(fixture.cache.pointNormalImpulses[0]).toBeGreaterThan(0);
  });

  it("builds ascending deterministic islands for a supported two-box stack", () => {
    const fixture = createFixture();
    const lower = fixture.addBody({ y: 0.9, vy: -1 });
    const upper = fixture.addBody({ y: 2.8, vy: -1 });
    const groundBody = fixture.addBody({ dynamic: false, y: -0.5 });
    const lowerCollider = fixture.addCollider(lower, box);
    const upperCollider = fixture.addCollider(upper, box);
    const groundCollider = fixture.addCollider(groundBody, ground);
    collide(fixture, [
      [lowerCollider, upperCollider],
      [lowerCollider, groundCollider],
    ]);

    solve(fixture, [upper, groundBody, lower]);

    expect(fixture.cache.contactCount).toBe(2);
    expect(fixture.solver.islandCount).toBe(1);
    expect(Array.from(fixture.solver.islandBodyIndices.subarray(0, 2))).toEqual(
      [lower, upper],
    );
    expect(fixture.bodies.linearVelocityY[lower]).toBeGreaterThan(-0.05);
    expect(fixture.bodies.linearVelocityY[upper]).toBeGreaterThan(-0.05);
  });

  it("turns an off-center impact into box rotation", () => {
    const fixture = createFixture();
    const moving = fixture.addBody({ vy: -2 });
    const fixed = fixture.addBody({ dynamic: false });
    const movingCollider = fixture.addCollider(moving, box);
    const fixedCollider = fixture.addCollider(fixed, ground);
    updateSortedContactCache3D(
      fixture.cache,
      pairs([[movingCollider, fixedCollider]], fixture),
      fixture.bodies,
      fixture.colliders,
      () => manualManifold({ first: [1, -1, 0], second: [1, -1, 0] }),
    );

    solve(fixture, [moving, fixed]);
    expect(fixture.bodies.angularVelocityZ[moving]).toBeGreaterThan(0);

    integrateCandidateBodies3D(
      fixture.bodies,
      new Int32Array([moving]),
      1,
      0,
      0,
      0,
      0.1,
    );
    expect(fixture.bodies.orientationZ[moving]).toBeGreaterThan(0);
    expect(
      Math.hypot(
        fixture.bodies.orientationX[moving]!,
        fixture.bodies.orientationY[moving]!,
        fixture.bodies.orientationZ[moving]!,
        fixture.bodies.orientationW[moving]!,
      ),
    ).toBeCloseTo(1, 14);
  });

  it("uses maximum restitution above the fixed threshold and none below it", () => {
    function impact(speed: number): number {
      const fixture = createFixture();
      const moving = fixture.addBody({ vx: speed });
      const fixed = fixture.addBody({ dynamic: false });
      const first = fixture.addCollider(moving, sphere, { restitution: 0.25 });
      const second = fixture.addCollider(fixed, sphere, { restitution: 1 });
      updateSortedContactCache3D(
        fixture.cache,
        pairs([[first, second]], fixture),
        fixture.bodies,
        fixture.colliders,
        () =>
          manualManifold({
            normal: [-1, 0, 0],
            first: [0, 0, 0],
            second: [0, 0, 0],
          }),
      );
      solve(fixture, [moving, fixed]);
      return fixture.bodies.linearVelocityX[moving]!;
    }

    expect(impact(2)).toBeCloseTo(-2, 9);
    expect(impact(0.5)).toBeCloseTo(0, 9);
  });

  it("mixes friction geometrically across two deterministic tangent axes", () => {
    const fixture = createFixture();
    const moving = fixture.addBody({ vx: 4, vy: -2, vz: 2 });
    const fixed = fixture.addBody({ dynamic: false });
    const first = fixture.addCollider(moving, box, { friction: 0.25 });
    const second = fixture.addCollider(fixed, ground, { friction: 1 });
    updateSortedContactCache3D(
      fixture.cache,
      pairs([[first, second]], fixture),
      fixture.bodies,
      fixture.colliders,
      () => manualManifold(),
    );

    solve(fixture, [moving, fixed]);

    expect(fixture.cache.mixedFriction[0]).toBe(0.5);
    expect(
      Math.hypot(
        fixture.cache.pointTangentImpulse1[0]!,
        fixture.cache.pointTangentImpulse2[0]!,
      ),
    ).toBeLessThanOrEqual(
      fixture.cache.mixedFriction[0]! * fixture.cache.pointNormalImpulses[0]! +
        1e-12,
    );
    expect(
      Math.hypot(
        fixture.bodies.linearVelocityX[moving]!,
        fixture.bodies.linearVelocityZ[moving]!,
      ),
    ).toBeLessThan(Math.hypot(4, 2));
  });

  it("retains sensor contacts without applying impulses", () => {
    const fixture = createFixture();
    const moving = fixture.addBody({ vy: -3 });
    const fixed = fixture.addBody({ dynamic: false });
    const first = fixture.addCollider(moving, sphere, { sensor: true });
    const second = fixture.addCollider(fixed, ground);
    updateSortedContactCache3D(
      fixture.cache,
      pairs([[first, second]], fixture),
      fixture.bodies,
      fixture.colliders,
      () => manualManifold(),
    );

    solve(fixture, [moving, fixed]);

    expect(fixture.cache.contactCount).toBe(1);
    expect(fixture.cache.sensorFlags[0]).toBe(1);
    expect(fixture.solver.constraintCount).toBe(0);
    expect(fixture.bodies.linearVelocityY[moving]).toBe(-3);
    expect(fixture.cache.pointNormalImpulses[0]).toBe(0);
  });

  it("is bit-repeatable from identical definitions and releases solver storage exactly once", () => {
    function run(): number[] {
      const fixture = createFixture();
      const firstBody = fixture.addBody({
        x: -0.2,
        y: 0.9,
        vx: 1.25,
        vy: -2,
        vz: 0.75,
      });
      const secondBody = fixture.addBody({ dynamic: false, y: -0.5 });
      const first = fixture.addCollider(firstBody, box, {
        friction: 0.3,
        restitution: 0.4,
      });
      const second = fixture.addCollider(secondBody, ground, {
        friction: 0.7,
        restitution: 0.1,
      });
      collide(fixture, [[first, second]]);
      solve(fixture, [secondBody, firstBody]);
      const result = [
        fixture.bodies.positionX[firstBody]!,
        fixture.bodies.positionY[firstBody]!,
        fixture.bodies.positionZ[firstBody]!,
        fixture.bodies.linearVelocityX[firstBody]!,
        fixture.bodies.linearVelocityY[firstBody]!,
        fixture.bodies.linearVelocityZ[firstBody]!,
        fixture.bodies.angularVelocityX[firstBody]!,
        fixture.bodies.angularVelocityY[firstBody]!,
        fixture.bodies.angularVelocityZ[firstBody]!,
        ...fixture.cache.pointNormalImpulses.subarray(0, 4),
        ...fixture.cache.pointTangentImpulse1.subarray(0, 4),
        ...fixture.cache.pointTangentImpulse2.subarray(0, 4),
      ];
      fixture.solver.dispose();
      fixture.solver.dispose();
      fixture.cache.dispose();
      fixture.cache.dispose();
      fixture.colliders.dispose();
      fixture.colliders.dispose();
      fixture.bodies.dispose();
      fixture.bodies.dispose();
      expect(fixture.counters.solverAllocations).toBe(1);
      expect(fixture.counters.solverReleases).toBe(1);
      expect(fixture.counters.liveSolvers).toBe(0);
      expect(fixture.counters.contactCacheAllocations).toBe(
        fixture.counters.contactCacheReleases,
      );
      expect(fixture.counters.liveContactCaches).toBe(0);
      expect(fixture.counters.contactAllocations).toBe(
        fixture.counters.contactReleases,
      );
      expect(fixture.counters.liveContacts).toBe(0);
      expect(fixture.counters.colliderStoreAllocations).toBe(
        fixture.counters.colliderStoreReleases,
      );
      expect(fixture.counters.liveColliderStores).toBe(0);
      expect(fixture.counters.colliderAllocations).toBe(
        fixture.counters.colliderReleases,
      );
      expect(fixture.counters.liveColliders).toBe(0);
      expect(fixture.counters.bodyStoreAllocations).toBe(
        fixture.counters.bodyStoreReleases,
      );
      expect(fixture.counters.liveBodyStores).toBe(0);
      expect(fixture.counters.bodyAllocations).toBe(
        fixture.counters.bodyReleases,
      );
      expect(fixture.counters.liveBodies).toBe(0);
      return result;
    }

    expect(run()).toEqual(run());
  });
});
