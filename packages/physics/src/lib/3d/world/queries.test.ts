import { describe, expect, it } from "vitest";
import {
  boxShape3D,
  sphereShape3D,
  type CRCPhysicsShape3D,
} from "../../../3d-geometry.js";
import { requireShapeRecord3D } from "../shape-records.js";
import type {
  CRCPhysicsBodyHandle3D,
  CRCPhysicsColliderHandle3D,
} from "../types.js";
import { createPhysicsOwnershipCounters3D } from "../runtime/ownership.js";
import { CommittedWorldQueries3D } from "./queries.js";
import {
  BODY_ENABLED_3D,
  COLLIDER_ENABLED_3D,
  COLLIDER_SENSOR_3D,
  BodyStore3D,
  ColliderStore3D,
} from "./storage.js";

interface FakeHandle {
  readonly index: number;
  readonly generation: number;
}

function bodyHandle(index: number, generation: number): CRCPhysicsBodyHandle3D {
  return { index, generation } as unknown as CRCPhysicsBodyHandle3D;
}

function colliderHandle(
  index: number,
  generation: number,
): CRCPhysicsColliderHandle3D {
  return { index, generation } as unknown as CRCPhysicsColliderHandle3D;
}

function identityOf(handle: object): FakeHandle | null {
  const candidate = handle as Partial<FakeHandle>;
  return Number.isInteger(candidate.index) &&
    Number.isInteger(candidate.generation)
    ? { index: candidate.index!, generation: candidate.generation! }
    : null;
}

function committedNumericState(...owners: object[]): readonly number[][] {
  const rows: number[][] = [];
  for (const owner of owners) {
    for (const key of Reflect.ownKeys(owner)) {
      const value = Reflect.get(owner, key) as unknown;
      if (ArrayBuffer.isView(value) && !(value instanceof DataView)) {
        rows.push(Array.from(value as unknown as ArrayLike<number>));
      }
    }
  }
  return rows;
}

function createFixture() {
  const counters = createPhysicsOwnershipCounters3D();
  const bodies = new BodyStore3D(counters, 16);
  const colliders = new ColliderStore3D(counters, 16);
  const materializedBodies = new Map<string, CRCPhysicsBodyHandle3D>();
  const materializedColliders = new Map<string, CRCPhysicsColliderHandle3D>();
  let bodyMaterializations = 0;
  let colliderMaterializations = 0;
  const queries = new CommittedWorldQueries3D({
    generation: 7,
    bodies,
    colliders,
    materializeBody(index, generation) {
      bodyMaterializations += 1;
      const key = `${String(index)}:${String(generation)}`;
      let handle = materializedBodies.get(key);
      if (handle === undefined) {
        handle = bodyHandle(index, generation);
        materializedBodies.set(key, handle);
      }
      return handle;
    },
    materializeCollider(index, generation) {
      colliderMaterializations += 1;
      const key = `${String(index)}:${String(generation)}`;
      let handle = materializedColliders.get(key);
      if (handle === undefined) {
        handle = colliderHandle(index, generation);
        materializedColliders.set(key, handle);
      }
      return handle;
    },
    resolveBody: identityOf,
    resolveCollider: identityOf,
  });
  const add = (
    options: Readonly<{
      x: number;
      y?: number;
      z?: number;
      shape?: CRCPhysicsShape3D;
      sensor?: boolean;
      tag?: unknown;
      category?: number;
      mask?: number;
      group?: number;
      localCenterX?: number;
      colliderOffsetX?: number;
    }>,
  ) => {
    const shape = options.shape ?? sphereShape3D({ radius: 0.5 });
    const localCenterX = options.localCenterX ?? 0;
    const body = bodies.allocate({
      positionX: options.x + localCenterX,
      positionY: options.y ?? 0,
      positionZ: options.z ?? 0,
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
      inverseMass: 0,
      localInverseInertiaXX: 0,
      localInverseInertiaYY: 0,
      localInverseInertiaZZ: 0,
      localInverseInertiaXY: 0,
      localInverseInertiaXZ: 0,
      localInverseInertiaYZ: 0,
      linearDamping: 0,
      angularDamping: 0,
      gravityScale: 0,
      sleepTime: 0,
      translationLocks: 0,
      rotationLocks: 0,
      flags: BODY_ENABLED_3D,
      owner: {},
    });
    const collider = colliders.allocate({
      bodyIndex: body,
      bodyGeneration: bodies.generations[body]!,
      shape: requireShapeRecord3D(shape),
      localPositionX: options.colliderOffsetX ?? 0,
      localPositionY: 0,
      localPositionZ: 0,
      localOrientationX: 0,
      localOrientationY: 0,
      localOrientationZ: 0,
      localOrientationW: 1,
      density: 1,
      friction: 0,
      restitution: 0,
      collisionCategory: options.category ?? 1,
      collisionMask: options.mask ?? 0xffff_ffff,
      collisionGroup: options.group ?? 0,
      tag: options.tag ?? null,
      handlers: null,
      owner: {},
      flags:
        COLLIDER_ENABLED_3D |
        (options.sensor === true ? COLLIDER_SENSOR_3D : 0),
    });
    return {
      body,
      bodyGeneration: bodies.generations[body]!,
      collider,
      colliderGeneration: colliders.generations[collider]!,
    };
  };
  return {
    counters,
    bodies,
    colliders,
    queries,
    add,
    materializationCounts: () => ({
      bodyMaterializations,
      colliderMaterializations,
    }),
  };
}

describe("committed-authoritative 3D world queries", () => {
  it("supports closest, any, and frozen all ray results sorted by time then collider identity", () => {
    const scene = createFixture();
    const firstTag = { name: "first" };
    const first = scene.add({ x: 3, tag: firstTag });
    const tied = scene.add({ x: 3, tag: "tied" });
    const last = scene.add({ x: 6, tag: "last" });
    const ray = {
      origin: [0, 0, 0],
      direction: [1, 0, 0],
      maxDistance: 10,
    } as const;

    const closest = scene.queries.raycast(7, ray);
    expect(identityOf(closest!.collider)!.index).toBe(first.collider);
    expect(closest!.tag).toBe(firstTag);
    expect(closest!.distance).toBe(2.5);

    const beforeAny = scene.materializationCounts();
    expect(scene.queries.raycast(7, ray, { mode: "any" })).toBe(true);
    expect(scene.materializationCounts()).toEqual(beforeAny);

    const all = scene.queries.raycast(7, ray, { mode: "all" });
    expect(all.map((hit) => identityOf(hit.collider)!.index)).toEqual([
      first.collider,
      tied.collider,
      last.collider,
    ]);
    expect(all.map((hit) => hit.timeOfImpact)).toEqual([0.25, 0.25, 0.55]);
    expect(Object.isFrozen(all)).toBe(true);
    expect(all.every(Object.isFrozen)).toBe(true);
    expect(all.every((hit) => Object.isFrozen(hit.point))).toBe(true);
    expect(all.every((hit) => Object.isFrozen(hit.normal))).toBe(true);
  });

  it("shape casts at fixed orientation with closest/all ordering", () => {
    const scene = createFixture();
    const first = scene.add({ x: 4 });
    const second = scene.add({ x: 7 });
    const moving = boxShape3D({ width: 1, height: 1, depth: 1 });
    const sine = Math.sin(Math.PI / 8);
    const cosine = Math.cos(Math.PI / 8);
    const all = scene.queries.shapeCast(
      7,
      moving,
      { position: [0, 0, 0], orientation: [0, 0, sine, cosine] },
      [10, 0, 0],
      { mode: "all" },
    );

    expect(all.map((hit) => identityOf(hit.collider)!.index)).toEqual([
      first.collider,
      second.collider,
    ]);
    expect(all[0]!.timeOfImpact).toBeLessThan(all[1]!.timeOfImpact);
    expect(
      scene.queries.shapeCast(
        7,
        moving,
        { position: [0, 5, 0], orientation: [0, 0, 0, 1] },
        [10, 0, 0],
        { mode: "any" },
      ),
    ).toBe(false);
  });

  it("queries overlap, tight AABB, and points once per collider using composed local poses", () => {
    const scene = createFixture();
    const target = scene.add({
      x: 4,
      shape: boxShape3D({ width: 2, height: 2, depth: 2 }),
      colliderOffsetX: 2,
      localCenterX: 1,
      tag: "composed",
    });
    scene.add({ x: 12 });

    const overlap = scene.queries.overlapShape(
      7,
      sphereShape3D({ radius: 1 }),
      { position: [6, 0, 0], orientation: [0, 0, 0, 1] },
      { mode: "all" },
    );
    expect(overlap).toHaveLength(1);
    expect(identityOf(overlap[0]!.collider)!.index).toBe(target.collider);
    expect(overlap[0]!.tag).toBe("composed");
    expect(
      scene.queries.queryAabb(
        7,
        { min: [5.9, -0.1, -0.1], max: [6.1, 0.1, 0.1] },
        { mode: "all" },
      ),
    ).toHaveLength(1);
    expect(
      scene.queries.queryAabb(
        7,
        { min: [7.01, -0.1, -0.1], max: [7.1, 0.1, 0.1] },
        { mode: "any" },
      ),
    ).toBe(false);
    expect(scene.queries.queryPoint(7, [6, 0, 0], { mode: "all" })).toHaveLength(
      1,
    );
    expect(scene.queries.queryPoint(7, [6, 3, 0])).toBeNull();
  });

  it("applies sensor modes, filters, exact exclusions, and preserves tag identity", () => {
    const scene = createFixture();
    const sensorTag = { sensor: true };
    const sensor = scene.add({
      x: 2,
      sensor: true,
      category: 0b0010,
      tag: sensorTag,
    });
    const solid = scene.add({ x: 4, category: 0b0100 });
    const negative = scene.add({ x: 6, group: -3 });
    const positive = scene.add({ x: 7, group: 3, mask: 0 });
    const ray = {
      origin: [0, 0, 0],
      direction: [1, 0, 0],
      maxDistance: 10,
    } as const;

    const onlySensors = scene.queries.raycast(7, ray, {
      mode: "all",
      sensors: "only",
    });
    expect(onlySensors).toHaveLength(1);
    expect(onlySensors[0]!.tag).toBe(sensorTag);
    expect(
      scene.queries
        .raycast(7, ray, { mode: "all", sensors: "exclude" })
        .every((hit) => identityOf(hit.collider)!.index !== sensor.collider),
    ).toBe(true);
    expect(
      scene.queries
        .raycast(7, ray, {
          mode: "all",
          collisionFilter: { category: 0b0001, mask: 0b0100 },
        })
        .map((hit) => identityOf(hit.collider)!.index),
    ).toEqual([solid.collider]);
    expect(
      scene.queries
        .raycast(7, ray, {
          mode: "all",
          collisionFilter: { group: -3 },
        })
        .every((hit) => identityOf(hit.collider)!.index !== negative.collider),
    ).toBe(true);
    expect(
      scene.queries
        .raycast(7, ray, {
          mode: "all",
          collisionFilter: { group: 3, mask: 0 },
        })
        .map((hit) => identityOf(hit.collider)!.index),
    ).toEqual([positive.collider]);
    expect(
      scene.queries
        .raycast(7, ray, {
          mode: "all",
          excludeBody: bodyHandle(solid.body, solid.bodyGeneration),
          excludeCollider: colliderHandle(
            sensor.collider,
            sensor.colliderGeneration,
          ),
        })
        .map((hit) => identityOf(hit.collider)!.index),
    ).toEqual([negative.collider, positive.collider]);
  });

  it("fails closed for stale identities and leaves every committed array and counter untouched", () => {
    const scene = createFixture();
    scene.add({ x: 5 });
    const ray = {
      origin: [0, 0, 0],
      direction: [1, 0, 0],
      maxDistance: 10,
    } as const;
    const arrays = committedNumericState(scene.bodies, scene.colliders);
    const counters = { ...scene.counters };

    expect(scene.queries.raycast(6, ray)).toBeNull();
    expect(scene.queries.raycast(6, ray, { mode: "all" })).toEqual([]);
    expect(scene.queries.raycast(6, ray, { mode: "any" })).toBe(false);
    expect(
      scene.queries.raycast(7, ray, {
        excludeBody: bodyHandle(0, 999),
      }),
    ).toBeNull();
    expect(
      scene.queries.raycast(7, ray, {
        excludeCollider: colliderHandle(0, 999),
      }),
    ).toBeNull();
    expect(scene.queries.raycast(7, ray)!.distance).toBe(4.5);
    expect(committedNumericState(scene.bodies, scene.colliders)).toEqual(arrays);
    expect(scene.counters).toEqual(counters);

    scene.queries.invalidate();
    expect(scene.queries.queryPoint(7, [5, 0, 0], { mode: "any" })).toBe(
      false,
    );
  });

  it("explicitly rejects every query while its owner has an uncommitted candidate", () => {
    const counters = createPhysicsOwnershipCounters3D();
    const bodies = new BodyStore3D(counters, 1);
    const colliders = new ColliderStore3D(counters, 1);
    let readable = true;
    const queries = new CommittedWorldQueries3D({
      generation: 1,
      bodies,
      colliders,
      materializeBody: bodyHandle,
      materializeCollider: colliderHandle,
      resolveBody: identityOf,
      resolveCollider: identityOf,
      assertReadable() {
        if (!readable) throw new Error("uncommitted candidate is live");
      },
    });
    readable = false;

    expect(() =>
      queries.raycast(1, {
        origin: [0, 0, 0],
        direction: [1, 0, 0],
        maxDistance: 1,
      }),
    ).toThrow("uncommitted candidate is live");
    expect(() => queries.queryPoint(1, [0, 0, 0])).toThrow(
      "uncommitted candidate is live",
    );
    expect(counters).toMatchObject({
      bodyAllocations: 0,
      colliderAllocations: 0,
    });
  });
});
