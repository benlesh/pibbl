import { describe, expect, it } from "vitest";
import {
  boundsOfShape2D,
  boxShape2D,
  chainShape2D,
  circleShape2D,
  type CRCPhysicsShape2D,
} from "../../../2d-geometry.js";
import type { CRCPhysicsBodyHandle2D, CRCPhysicsColliderHandle2D } from "../types.js";
import { requireShapeRecord2D } from "../shape-records.js";
import { createPhysicsOwnershipCounters2D } from "../runtime/ownership.js";
import { DynamicAabbBroadPhase2D } from "./broad-phase.js";
import { COLLIDER_SENSOR_2D } from "./contact-cache.js";
import { CommittedWorldQueries2D } from "./queries.js";
import { BodyStore2D, ColliderStore2D } from "./storage.js";

interface FakeHandle {
  readonly index: number;
  readonly generation: number;
}

function bodyHandle(index: number, generation: number): CRCPhysicsBodyHandle2D {
  return { index, generation } as unknown as CRCPhysicsBodyHandle2D;
}

function colliderHandle(index: number, generation: number): CRCPhysicsColliderHandle2D {
  return { index, generation } as unknown as CRCPhysicsColliderHandle2D;
}

function identityOf(handle: object): FakeHandle | null {
  const candidate = handle as Partial<FakeHandle>;
  return Number.isInteger(candidate.index) && Number.isInteger(candidate.generation)
    ? { index: candidate.index!, generation: candidate.generation! }
    : null;
}

function createFixture() {
  const counters = createPhysicsOwnershipCounters2D();
  const bodies = new BodyStore2D(counters, 16);
  const colliders = new ColliderStore2D(counters, 16);
  const broadPhase = new DynamicAabbBroadPhase2D(counters, 16, 32);
  const materializedBodies = new Map<string, CRCPhysicsBodyHandle2D>();
  const materializedColliders = new Map<string, CRCPhysicsColliderHandle2D>();
  let bodyMaterializations = 0;
  let colliderMaterializations = 0;
  const queries = new CommittedWorldQueries2D({
    generation: 7,
    bodies,
    colliders,
    broadPhase,
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
      shape?: CRCPhysicsShape2D;
      sensor?: boolean;
      tag?: unknown;
      filter?: Readonly<{ category?: number; mask?: number; group?: number }>;
      presentationX?: number;
    }>,
  ) => {
    const shape = options.shape ?? circleShape2D({ radius: 0.5 });
    const body = bodies.allocate({
      positionX: options.x,
      positionY: options.y ?? 0,
      rotationRadians: 0,
      linearVelocityX: 0,
      linearVelocityY: 0,
      angularVelocity: 0,
      forceX: 0,
      forceY: 0,
      torque: 0,
      inverseMass: 0,
      inverseInertia: 0,
      linearDamping: 0,
      angularDamping: 0,
      gravityScale: 0,
      sleepTime: 0,
      flags: 0,
      owner: { presentationX: options.presentationX ?? options.x },
    });
    const collider = colliders.allocate({
      bodyIndex: body,
      bodyGeneration: bodies.generations[body]!,
      shape: requireShapeRecord2D(shape),
      material: null,
      filter: options.filter ?? null,
      tag: options.tag ?? null,
      handlers: null,
      owner: {},
      flags: options.sensor === true ? COLLIDER_SENSOR_2D : 0,
    });
    const bounds = boundsOfShape2D(shape, {
      position: [options.x, options.y ?? 0],
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
    return {
      body,
      bodyGeneration: bodies.generations[body]!,
      collider,
      colliderGeneration: colliders.generations[collider]!,
    };
  };
  return {
    bodies,
    colliders,
    broadPhase,
    queries,
    add,
    materializationCounts: () => ({
      bodyMaterializations,
      colliderMaterializations,
    }),
  };
}

describe("committed-authoritative 2D world queries", () => {
  it("supports closest, any, and sorted immutable all ray results with exact tie identity", () => {
    const scene = createFixture();
    const firstTag = { name: "first" };
    const first = scene.add({ x: 3, tag: firstTag });
    const tied = scene.add({ x: 3, tag: "tied" });
    scene.add({ x: 6, tag: "last" });
    const ray = { origin: [0, 0], direction: [1, 0], maxDistance: 10 } as const;

    const closest = scene.queries.raycast(7, ray);
    expect(closest?.colliderGeneration).toBe(first.colliderGeneration);
    expect(identityOf(closest!.collider)!.index).toBe(first.collider);
    expect(closest?.tag).toBe(firstTag);

    const beforeAny = scene.materializationCounts();
    expect(scene.queries.raycast(7, ray, { mode: "any" })).toBe(true);
    expect(scene.materializationCounts()).toEqual(beforeAny);

    const all = scene.queries.raycast(7, ray, { mode: "all" });
    expect(all.map((hit) => identityOf(hit.collider)!.index)).toEqual([first.collider, tied.collider, 2]);
    expect(all.map((hit) => hit.distance)).toEqual([2.5, 2.5, 5.5]);
    expect(Object.isFrozen(all)).toBe(true);
    expect(all.every(Object.isFrozen)).toBe(true);
  });

  it("shape casts at fixed orientation and applies closest/all ordering", () => {
    const scene = createFixture();
    const first = scene.add({ x: 4 });
    const second = scene.add({ x: 7 });
    const shape = boxShape2D({ width: 1, height: 1 });
    const all = scene.queries.shapeCast(7, shape, { position: [0, 0], rotationDegrees: 17 }, [10, 0], { mode: "all" });

    expect(all.map((hit) => identityOf(hit.collider)!.index)).toEqual([first.collider, second.collider]);
    expect(all[0]!.timeOfImpact).toBeLessThan(all[1]!.timeOfImpact);
    expect(scene.queries.shapeCast(7, shape, { position: [0, 5], rotationDegrees: 17 }, [10, 0], { mode: "any" })).toBe(
      false,
    );
  });

  it("queries overlap, tight AABB, and points once per compound collider", () => {
    const scene = createFixture();
    const compound = scene.add({
      x: 4,
      shape: chainShape2D({
        points: [
          [-1, 0],
          [0, 0],
          [1, 0],
        ],
        radius: 0.5,
      }),
      tag: "compound",
    });
    scene.add({ x: 9 });

    const overlap = scene.queries.overlapShape(
      7,
      circleShape2D({ radius: 1 }),
      { position: [4, 0], rotationDegrees: 0 },
      { mode: "all" },
    );
    expect(overlap).toHaveLength(1);
    expect(identityOf(overlap[0]!.collider)!.index).toBe(compound.collider);
    expect(overlap[0]!.tag).toBe("compound");
    expect(scene.queries.queryAabb(7, { min: [3.8, -0.1], max: [4.2, 0.1] }, { mode: "all" })).toHaveLength(1);
    expect(scene.queries.queryAabb(7, { min: [2.41, -0.1], max: [2.45, 0.1] }, { mode: "any" })).toBe(false);
    expect(scene.queries.queryPoint(7, [4, 0], { mode: "all" })).toHaveLength(1);
    expect(scene.queries.queryPoint(7, [4, 2], { mode: "closest" })).toBeNull();
  });

  it("applies sensor modes, group/category/mask filters, and exact exclusions", () => {
    const scene = createFixture();
    const sensor = scene.add({
      x: 2,
      sensor: true,
      filter: { category: 0b0010 },
    });
    const solid = scene.add({ x: 4, filter: { category: 0b0100 } });
    const negativeGroup = scene.add({ x: 6, filter: { group: -3 } });
    scene.add({ x: 7, filter: { group: 3, mask: 0 } });
    const ray = { origin: [0, 0], direction: [1, 0], maxDistance: 10 } as const;

    expect(scene.queries.raycast(7, ray, { mode: "all", sensors: "only" })).toHaveLength(1);
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
        .every((hit) => identityOf(hit.collider)!.index !== negativeGroup.collider),
    ).toBe(true);
    expect(
      scene.queries
        .raycast(7, ray, {
          mode: "all",
          collisionFilter: { group: 3, mask: 0 },
        })
        .map((hit) => identityOf(hit.collider)!.index),
    ).toEqual([3]);
    expect(
      scene.queries
        .raycast(7, ray, {
          mode: "all",
          excludeBody: bodyHandle(solid.body, solid.bodyGeneration),
          excludeCollider: colliderHandle(sensor.collider, sensor.colliderGeneration),
        })
        .map((hit) => identityOf(hit.collider)!.index),
    ).toEqual([negativeGroup.collider, 3]);
  });

  it("fails closed for stale world/exclusion handles and reads only committed poses without tree mutation", () => {
    const scene = createFixture();
    scene.add({ x: 5, presentationX: 1 });
    const ray = { origin: [0, 0], direction: [1, 0], maxDistance: 10 } as const;
    const root = scene.broadPhase.rootNode;
    const parents = Array.from(scene.broadPhase.nodeParents);
    const moved = Array.from(scene.broadPhase.proxyMoved);

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
    expect(scene.queries.raycast(7, ray)?.distance).toBe(4.5);
    expect(scene.broadPhase.rootNode).toBe(root);
    expect(Array.from(scene.broadPhase.nodeParents)).toEqual(parents);
    expect(Array.from(scene.broadPhase.proxyMoved)).toEqual(moved);

    scene.queries.invalidate();
    expect(scene.queries.queryPoint(7, [5, 0], { mode: "any" })).toBe(false);
  });
});
