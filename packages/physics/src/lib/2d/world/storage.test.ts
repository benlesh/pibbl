import { describe, expect, it } from "vitest";
import type { ShapeRecord2D } from "../shape-records.js";
import { createPhysicsOwnershipCounters2D } from "../runtime/ownership.js";
import {
  BodyStore2D,
  ColliderStore2D,
  type BodyDefinition2D,
  type ColliderDefinition2D,
} from "./storage.js";

const shapeRecord: ShapeRecord2D = Object.freeze({
  leaves: Object.freeze([]),
  localPose: Object.freeze({ x: 0, y: 0, rotationRadians: 0 }),
  localBounds: new Float64Array([-1, -1, 1, 1]),
  area: 4,
  centroidX: 0,
  centroidY: 0,
  unitInertia: 2 / 3,
});

function bodyDefinition(seed: number, owner: object): BodyDefinition2D {
  return {
    positionX: seed + 0.1,
    positionY: seed + 0.2,
    rotationRadians: seed + 0.3,
    linearVelocityX: seed + 0.4,
    linearVelocityY: seed + 0.5,
    angularVelocity: seed + 0.6,
    forceX: seed + 0.7,
    forceY: seed + 0.8,
    torque: seed + 0.9,
    inverseMass: seed + 1,
    inverseInertia: seed + 1.1,
    linearDamping: seed + 1.2,
    angularDamping: seed + 1.3,
    gravityScale: seed + 1.4,
    sleepTime: seed + 1.5,
    flags: seed + 1,
    owner,
  };
}

function colliderDefinition(
  seed: number,
  bodyIndex: number,
  bodyGeneration: number,
  references: Readonly<{
    material: object;
    filter: object;
    tag: object;
    handlers: object;
    owner: object;
  }>,
): ColliderDefinition2D {
  return {
    bodyIndex,
    bodyGeneration,
    shape: shapeRecord,
    material: references.material,
    filter: references.filter,
    tag: references.tag,
    handlers: references.handlers,
    owner: references.owner,
    flags: seed + 1,
  };
}

describe("pooled 2D world storage", () => {
  it("retires exhausted generation slots instead of resurrecting stale identities", () => {
    const counters = createPhysicsOwnershipCounters2D();
    const bodies = new BodyStore2D(counters, 4);
    const colliders = new ColliderStore2D(counters, 4);
    const body = bodies.allocate(bodyDefinition(1, {}));
    const collider = colliders.allocate(
      colliderDefinition(1, body, 1, {
        material: {},
        filter: {},
        tag: {},
        handlers: {},
        owner: {},
      }),
    );
    bodies.generations[body] = 0xffff_ffff;
    colliders.generations[collider] = 0xffff_ffff;

    expect(bodies.release(body, 0xffff_ffff)).toBe(true);
    expect(colliders.release(collider, 0xffff_ffff)).toBe(true);
    expect(bodies.allocate(bodyDefinition(2, {}))).toBe(1);
    expect(
      colliders.allocate(
        colliderDefinition(2, 1, 1, {
          material: {},
          filter: {},
          tag: {},
          handlers: {},
          owner: {},
        }),
      ),
    ).toBe(1);
    expect(bodies.has(body, 1)).toBe(false);
    expect(colliders.has(collider, 1)).toBe(false);
    expect(counters.retiredBodySlots).toBe(1);
    expect(counters.retiredColliderSlots).toBe(1);
  });

  it("rejects stale body generations after deterministic slot reuse", () => {
    const counters = createPhysicsOwnershipCounters2D();
    const bodies = new BodyStore2D(counters, 4);
    const firstOwner = {};
    const firstIndex = bodies.allocate(bodyDefinition(1, firstOwner));
    const firstGeneration = bodies.generations[firstIndex]!;
    const read = new Float64Array(2);

    expect(firstIndex).toBe(0);
    expect(firstGeneration).toBe(1);
    expect(bodies.readPositionInto(firstIndex, firstGeneration, read, 0)).toBe(
      true,
    );
    expect(Array.from(read)).toEqual([1.1, 1.2]);
    expect(bodies.release(firstIndex, firstGeneration)).toBe(true);
    expect(bodies.owners[firstIndex]).toBeNull();

    const replacementOwner = {};
    const replacementIndex = bodies.allocate(
      bodyDefinition(9, replacementOwner),
    );
    const replacementGeneration = bodies.generations[replacementIndex]!;
    expect(replacementIndex).toBe(firstIndex);
    expect(replacementGeneration).toBe(firstGeneration + 1);

    read.set([-7, -8]);
    expect(bodies.readPositionInto(firstIndex, firstGeneration, read, 0)).toBe(
      false,
    );
    expect(Array.from(read)).toEqual([-7, -8]);
    expect(bodies.setPosition(firstIndex, firstGeneration, 100, 200)).toBe(
      false,
    );
    expect(bodies.positionX[replacementIndex]).toBe(9.1);
    expect(bodies.positionY[replacementIndex]).toBe(9.2);
    expect(bodies.release(firstIndex, firstGeneration)).toBe(false);
    expect(bodies.owners[replacementIndex]).toBe(replacementOwner);

    expect(bodies.release(replacementIndex, replacementGeneration)).toBe(true);
    expect(counters.liveBodies).toBe(0);
    expect(counters.freeBodySlots).toBe(4);
    expect(counters.bodyCapacity).toBe(4);
    expect(counters.bodyAllocations).toBe(2);
    expect(counters.bodyReleases).toBe(2);
  });

  it("rejects stale collider generations and clears every owned reference", () => {
    const counters = createPhysicsOwnershipCounters2D();
    const colliders = new ColliderStore2D(counters, 4);
    const firstReferences = {
      material: {},
      filter: {},
      tag: {},
      handlers: {},
      owner: {},
    };
    const firstIndex = colliders.allocate(
      colliderDefinition(1, 3, 7, firstReferences),
    );
    const firstGeneration = colliders.generations[firstIndex]!;
    expect(colliders.setProxy(firstIndex, firstGeneration, 12, 4)).toBe(true);
    expect(colliders.release(firstIndex, firstGeneration)).toBe(true);

    expect(colliders.shapes[firstIndex]).toBeNull();
    expect(colliders.materials[firstIndex]).toBeNull();
    expect(colliders.filters[firstIndex]).toBeNull();
    expect(colliders.tags[firstIndex]).toBeNull();
    expect(colliders.handlers[firstIndex]).toBeNull();
    expect(colliders.owners[firstIndex]).toBeNull();
    expect(colliders.proxyIndices[firstIndex]).toBe(-1);
    expect(colliders.proxyGenerations[firstIndex]).toBe(0);

    const replacementReferences = {
      material: {},
      filter: {},
      tag: {},
      handlers: {},
      owner: {},
    };
    const replacementIndex = colliders.allocate(
      colliderDefinition(9, 5, 11, replacementReferences),
    );
    const replacementGeneration = colliders.generations[replacementIndex]!;
    expect(replacementIndex).toBe(firstIndex);
    expect(replacementGeneration).toBe(firstGeneration + 1);
    expect(colliders.shapeAt(firstIndex, firstGeneration)).toBeUndefined();
    expect(colliders.tagAt(firstIndex, firstGeneration)).toBeUndefined();
    expect(colliders.setTag(firstIndex, firstGeneration, {})).toBe(false);
    expect(colliders.tags[replacementIndex]).toBe(replacementReferences.tag);
    expect(colliders.release(firstIndex, firstGeneration)).toBe(false);

    expect(colliders.release(replacementIndex, replacementGeneration)).toBe(
      true,
    );
    expect(counters.liveColliders).toBe(0);
    expect(counters.freeColliderSlots).toBe(4);
    expect(counters.colliderCapacity).toBe(4);
    expect(counters.colliderAllocations).toBe(2);
    expect(counters.colliderReleases).toBe(2);
  });

  it("grows body and collider stores from four to eight without changing live identities or state", () => {
    const counters = createPhysicsOwnershipCounters2D();
    const bodies = new BodyStore2D(counters, 4);
    const colliders = new ColliderStore2D(counters, 4);
    const bodyIndices: number[] = [];
    const bodyGenerations: number[] = [];
    const colliderIndices: number[] = [];
    const colliderGenerations: number[] = [];
    const colliderReferences: object[] = [];

    for (let seed = 0; seed < 5; seed += 1) {
      const bodyIndex = bodies.allocate(bodyDefinition(seed, { seed }));
      bodyIndices.push(bodyIndex);
      bodyGenerations.push(bodies.generations[bodyIndex]!);
      const tag = { seed };
      colliderReferences.push(tag);
      const colliderIndex = colliders.allocate(
        colliderDefinition(seed, bodyIndex, bodies.generations[bodyIndex]!, {
          material: {},
          filter: {},
          tag,
          handlers: {},
          owner: {},
        }),
      );
      colliderIndices.push(colliderIndex);
      colliderGenerations.push(colliders.generations[colliderIndex]!);
    }

    expect(bodies.capacity).toBe(8);
    expect(colliders.capacity).toBe(8);
    expect(counters.bodyCapacityGrowths).toBe(1);
    expect(counters.colliderCapacityGrowths).toBe(1);
    expect(counters.freeBodySlots).toBe(3);
    expect(counters.freeColliderSlots).toBe(3);
    for (let seed = 0; seed < 5; seed += 1) {
      const bodyIndex = bodyIndices[seed]!;
      const colliderIndex = colliderIndices[seed]!;
      expect(bodies.has(bodyIndex, bodyGenerations[seed]!)).toBe(true);
      expect(bodies.positionX[bodyIndex]).toBe(seed + 0.1);
      expect(bodies.angularVelocity[bodyIndex]).toBe(seed + 0.6);
      expect(bodies.inverseInertia[bodyIndex]).toBe(seed + 1.1);
      expect(bodies.flags[bodyIndex]).toBe(seed + 1);
      expect(colliders.has(colliderIndex, colliderGenerations[seed]!)).toBe(
        true,
      );
      expect(colliders.bodyIndices[colliderIndex]).toBe(bodyIndex);
      expect(colliders.bodyGenerations[colliderIndex]).toBe(
        bodyGenerations[seed],
      );
      expect(colliders.tags[colliderIndex]).toBe(colliderReferences[seed]);
    }
  });
});
