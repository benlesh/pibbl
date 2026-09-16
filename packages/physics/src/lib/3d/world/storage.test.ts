import { describe, expect, it } from "vitest";
import { sphereShape3D } from "../../../3d-geometry.js";
import { requireShapeRecord3D } from "../shape-records.js";
import { createPhysicsOwnershipCounters3D } from "../runtime/ownership.js";
import {
  BODY_ENABLED_3D,
  BODY_TYPE_DYNAMIC_3D,
  COLLIDER_CONTRIBUTES_TO_MASS_3D,
  COLLIDER_ENABLED_3D,
  BodyStore3D,
  ColliderStore3D,
  type BodyDefinition3D,
  type ColliderDefinition3D,
} from "./storage.js";

const shapeRecord = requireShapeRecord3D(sphereShape3D({ radius: 1 }));

function bodyDefinition(seed: number, owner: object): BodyDefinition3D {
  return {
    positionX: seed + 0.1,
    positionY: seed + 0.2,
    positionZ: seed + 0.3,
    orientationX: 0,
    orientationY: 0,
    orientationZ: 0,
    orientationW: -2,
    localCenterX: seed + 0.4,
    localCenterY: seed + 0.5,
    localCenterZ: seed + 0.6,
    linearVelocityX: seed + 0.7,
    linearVelocityY: seed + 0.8,
    linearVelocityZ: seed + 0.9,
    angularVelocityX: seed + 1,
    angularVelocityY: seed + 1.1,
    angularVelocityZ: seed + 1.2,
    forceX: seed + 1.3,
    forceY: seed + 1.4,
    forceZ: seed + 1.5,
    torqueX: seed + 1.6,
    torqueY: seed + 1.7,
    torqueZ: seed + 1.8,
    inverseMass: seed + 1.9,
    localInverseInertiaXX: seed + 2,
    localInverseInertiaYY: seed + 2.1,
    localInverseInertiaZZ: seed + 2.2,
    localInverseInertiaXY: seed + 2.3,
    localInverseInertiaXZ: seed + 2.4,
    localInverseInertiaYZ: seed + 2.5,
    linearDamping: seed + 2.6,
    angularDamping: seed + 2.7,
    gravityScale: seed + 2.8,
    sleepTime: seed + 2.9,
    translationLocks: 0b101,
    rotationLocks: 0b010,
    flags: BODY_ENABLED_3D | BODY_TYPE_DYNAMIC_3D,
    owner,
  };
}

function colliderDefinition(
  seed: number,
  bodyIndex: number,
  bodyGeneration: number,
  references: Readonly<{ tag: object; handlers: object; owner: object }>,
): ColliderDefinition3D {
  return {
    bodyIndex,
    bodyGeneration,
    shape: shapeRecord,
    localPositionX: seed + 0.1,
    localPositionY: seed + 0.2,
    localPositionZ: seed + 0.3,
    localOrientationX: 0,
    localOrientationY: 0,
    localOrientationZ: 0,
    localOrientationW: -4,
    density: seed + 1,
    friction: seed + 0.4,
    restitution: seed + 0.5,
    collisionCategory: 1 << seed,
    collisionMask: 0xffff_ffff,
    collisionGroup: -seed,
    tag: references.tag,
    handlers: references.handlers,
    owner: references.owner,
    flags: COLLIDER_ENABLED_3D | COLLIDER_CONTRIBUTES_TO_MASS_3D,
  };
}

describe("pooled 3D world storage", () => {
  it("rejects an invalid body quaternion before acquiring or advancing a slot", () => {
    const counters = createPhysicsOwnershipCounters3D();
    const bodies = new BodyStore3D(counters, 1);
    const invalidOwner = {};
    const invalid = {
      ...bodyDefinition(1, invalidOwner),
      orientationX: 0,
      orientationY: 0,
      orientationZ: 0,
      orientationW: 0,
    };

    expect(() => bodies.allocate(invalid)).toThrow(RangeError);
    expect(bodies.capacity).toBe(1);
    expect(bodies.generations[0]).toBe(0);
    expect(bodies.has(0, 1)).toBe(false);
    expect(bodies.owners[0]).toBeNull();
    expect(bodies.positionX[0]).toBe(0);
    expect(counters.bodyCapacityGrowths).toBe(0);
    expect(counters.freeBodySlots).toBe(1);
    expect(counters.bodyAllocations).toBe(0);
    expect(counters.bodyReleases).toBe(0);
    expect(counters.liveBodies).toBe(0);

    const body = bodies.allocate(bodyDefinition(2, {}));
    expect(body).toBe(0);
    expect(bodies.generations[body]).toBe(1);
    bodies.dispose();
    bodies.dispose();
    expect(counters.bodyAllocations).toBe(1);
    expect(counters.bodyReleases).toBe(1);
    expect(counters.liveBodies).toBe(0);
    expect(counters.bodyStoreAllocations).toBe(1);
    expect(counters.bodyStoreReleases).toBe(1);
    expect(counters.liveBodyStores).toBe(0);
  });

  it("rejects an invalid collider quaternion before acquiring or retaining a slot", () => {
    const counters = createPhysicsOwnershipCounters3D();
    const colliders = new ColliderStore3D(counters, 1);
    const invalidReferences = { tag: {}, handlers: {}, owner: {} };
    const invalid = {
      ...colliderDefinition(1, 3, 7, invalidReferences),
      localOrientationX: 0,
      localOrientationY: 0,
      localOrientationZ: 0,
      localOrientationW: 0,
    };

    expect(() => colliders.allocate(invalid)).toThrow(RangeError);
    expect(colliders.capacity).toBe(1);
    expect(colliders.generations[0]).toBe(0);
    expect(colliders.has(0, 1)).toBe(false);
    expect(colliders.bodyIndices[0]).toBe(-1);
    expect(colliders.proxyIndices[0]).toBe(-1);
    expect(colliders.shapes[0]).toBeNull();
    expect(colliders.tags[0]).toBeNull();
    expect(colliders.handlers[0]).toBeNull();
    expect(colliders.owners[0]).toBeNull();
    expect(counters.colliderCapacityGrowths).toBe(0);
    expect(counters.freeColliderSlots).toBe(1);
    expect(counters.colliderAllocations).toBe(0);
    expect(counters.colliderReleases).toBe(0);
    expect(counters.liveColliders).toBe(0);

    const collider = colliders.allocate(
      colliderDefinition(2, 5, 11, { tag: {}, handlers: {}, owner: {} }),
    );
    expect(collider).toBe(0);
    expect(colliders.generations[collider]).toBe(1);
    colliders.dispose();
    colliders.dispose();
    expect(counters.colliderAllocations).toBe(1);
    expect(counters.colliderReleases).toBe(1);
    expect(counters.liveColliders).toBe(0);
    expect(counters.colliderStoreAllocations).toBe(1);
    expect(counters.colliderStoreReleases).toBe(1);
    expect(counters.liveColliderStores).toBe(0);
  });

  it("rolls back body acquisition if the final reference read throws", () => {
    const counters = createPhysicsOwnershipCounters3D();
    const bodies = new BodyStore3D(counters, 1);
    const invalid = bodyDefinition(1, {}) as BodyDefinition3D & {
      owner: unknown;
    };
    Object.defineProperty(invalid, "owner", {
      get() {
        throw new Error("invalid body owner");
      },
    });

    expect(() => bodies.allocate(invalid)).toThrow("invalid body owner");
    expect(bodies.generations[0]).toBe(0);
    expect(bodies.has(0, 1)).toBe(false);
    expect(bodies.positionX[0]).toBe(0);
    expect(bodies.owners[0]).toBeNull();
    expect(counters.freeBodySlots).toBe(1);
    expect(counters.bodyAllocations).toBe(0);
    expect(counters.bodyReleases).toBe(0);
    expect(counters.liveBodies).toBe(0);

    const body = bodies.allocate(bodyDefinition(2, {}));
    expect(body).toBe(0);
    expect(bodies.generations[body]).toBe(1);
    bodies.dispose();
    expect(counters.bodyAllocations).toBe(counters.bodyReleases);
    expect(counters.liveBodies).toBe(0);
  });

  it("rolls back collider acquisition if the final reference read throws", () => {
    const counters = createPhysicsOwnershipCounters3D();
    const colliders = new ColliderStore3D(counters, 1);
    const invalid = colliderDefinition(1, 3, 7, {
      tag: {},
      handlers: {},
      owner: {},
    }) as ColliderDefinition3D & { owner: unknown };
    Object.defineProperty(invalid, "owner", {
      get() {
        throw new Error("invalid collider owner");
      },
    });

    expect(() => colliders.allocate(invalid)).toThrow("invalid collider owner");
    expect(colliders.generations[0]).toBe(0);
    expect(colliders.has(0, 1)).toBe(false);
    expect(colliders.bodyIndices[0]).toBe(-1);
    expect(colliders.shapes[0]).toBeNull();
    expect(colliders.tags[0]).toBeNull();
    expect(colliders.handlers[0]).toBeNull();
    expect(colliders.owners[0]).toBeNull();
    expect(counters.freeColliderSlots).toBe(1);
    expect(counters.colliderAllocations).toBe(0);
    expect(counters.colliderReleases).toBe(0);
    expect(counters.liveColliders).toBe(0);

    const collider = colliders.allocate(
      colliderDefinition(2, 5, 11, { tag: {}, handlers: {}, owner: {} }),
    );
    expect(collider).toBe(0);
    expect(colliders.generations[collider]).toBe(1);
    colliders.dispose();
    expect(counters.colliderAllocations).toBe(counters.colliderReleases);
    expect(counters.liveColliders).toBe(0);
  });

  it("rejects stale body handles after deterministic reuse and canonicalizes orientation", () => {
    const counters = createPhysicsOwnershipCounters3D();
    const bodies = new BodyStore3D(counters, 4);
    const firstOwner = {};
    const first = bodies.allocate(bodyDefinition(1, firstOwner));
    const generation = bodies.generations[first]!;
    const output = new Float64Array(7);

    expect(first).toBe(0);
    expect(generation).toBe(1);
    expect(bodies.readPoseInto(first, generation, output, 0)).toBe(true);
    expect(Array.from(output)).toEqual([1.1, 1.2, 1.3, 0, 0, 0, 1]);
    expect(bodies.release(first, generation)).toBe(true);
    expect(bodies.owners[first]).toBeNull();

    const replacementOwner = {};
    const replacement = bodies.allocate(bodyDefinition(9, replacementOwner));
    const replacementGeneration = bodies.generations[replacement]!;
    expect(replacement).toBe(first);
    expect(replacementGeneration).toBe(generation + 1);
    output.fill(-1);
    expect(bodies.readPoseInto(first, generation, output, 0)).toBe(false);
    expect(Array.from(output)).toEqual([-1, -1, -1, -1, -1, -1, -1]);
    expect(bodies.setPose(first, generation, 100, 200, 300, 0, 0, 0, 1)).toBe(
      false,
    );
    expect(bodies.positionX[replacement]).toBe(9.1);
    expect(bodies.owners[replacement]).toBe(replacementOwner);

    expect(bodies.release(replacement, replacementGeneration)).toBe(true);
    bodies.dispose();
    expect(counters.bodyAllocations).toBe(2);
    expect(counters.bodyReleases).toBe(2);
    expect(counters.liveBodies).toBe(0);
    expect(counters.bodyStoreAllocations).toBe(1);
    expect(counters.bodyStoreReleases).toBe(1);
    expect(counters.liveBodyStores).toBe(0);
  });

  it("rejects stale collider handles and clears every owned reference and proxy", () => {
    const counters = createPhysicsOwnershipCounters3D();
    const colliders = new ColliderStore3D(counters, 4);
    const references = { tag: {}, handlers: {}, owner: {} };
    const first = colliders.allocate(colliderDefinition(1, 3, 7, references));
    const generation = colliders.generations[first]!;
    expect(colliders.setProxy(first, generation, 12, 4)).toBe(true);
    expect(colliders.localOrientationW[first]).toBe(1);
    expect(colliders.release(first, generation)).toBe(true);

    expect(colliders.shapes[first]).toBeNull();
    expect(colliders.tags[first]).toBeNull();
    expect(colliders.handlers[first]).toBeNull();
    expect(colliders.owners[first]).toBeNull();
    expect(colliders.proxyIndices[first]).toBe(-1);
    expect(colliders.proxyGenerations[first]).toBe(0);

    const replacementReferences = { tag: {}, handlers: {}, owner: {} };
    const replacement = colliders.allocate(
      colliderDefinition(2, 5, 11, replacementReferences),
    );
    expect(replacement).toBe(first);
    expect(colliders.generations[replacement]).toBe(generation + 1);
    expect(colliders.shapeAt(first, generation)).toBeUndefined();
    expect(colliders.setTag(first, generation, {})).toBe(false);
    expect(colliders.tags[replacement]).toBe(replacementReferences.tag);

    expect(
      colliders.release(replacement, colliders.generations[replacement]!),
    ).toBe(true);
    colliders.dispose();
    expect(counters.colliderAllocations).toBe(2);
    expect(counters.colliderReleases).toBe(2);
    expect(counters.liveColliders).toBe(0);
    expect(counters.colliderStoreAllocations).toBe(1);
    expect(counters.colliderStoreReleases).toBe(1);
    expect(counters.liveColliderStores).toBe(0);
  });

  it("retires exhausted generations instead of resurrecting stale identities", () => {
    const counters = createPhysicsOwnershipCounters3D();
    const bodies = new BodyStore3D(counters, 2);
    const colliders = new ColliderStore3D(counters, 2);
    const body = bodies.allocate(bodyDefinition(0, {}));
    const collider = colliders.allocate(
      colliderDefinition(0, body, bodies.generations[body]!, {
        tag: {},
        handlers: {},
        owner: {},
      }),
    );
    bodies.generations[body] = 0xffff_ffff;
    colliders.generations[collider] = 0xffff_ffff;

    expect(bodies.release(body, 0xffff_ffff)).toBe(true);
    expect(colliders.release(collider, 0xffff_ffff)).toBe(true);
    expect(bodies.allocate(bodyDefinition(1, {}))).toBe(1);
    expect(
      colliders.allocate(
        colliderDefinition(1, 1, 1, { tag: {}, handlers: {}, owner: {} }),
      ),
    ).toBe(1);
    expect(bodies.has(0, 1)).toBe(false);
    expect(colliders.has(0, 1)).toBe(false);
    expect(counters.retiredBodySlots).toBe(1);
    expect(counters.retiredColliderSlots).toBe(1);
  });

  it("grows every typed field without changing committed values or references", () => {
    const counters = createPhysicsOwnershipCounters3D();
    const bodies = new BodyStore3D(counters, 2);
    const colliders = new ColliderStore3D(counters, 2);
    const bodyGenerations: number[] = [];
    const colliderGenerations: number[] = [];
    const tags: object[] = [];

    for (let seed = 0; seed < 5; seed += 1) {
      const body = bodies.allocate(bodyDefinition(seed, { seed }));
      bodyGenerations.push(bodies.generations[body]!);
      const tag = { seed };
      tags.push(tag);
      const collider = colliders.allocate(
        colliderDefinition(seed, body, bodies.generations[body]!, {
          tag,
          handlers: {},
          owner: {},
        }),
      );
      colliderGenerations.push(colliders.generations[collider]!);
    }

    expect(bodies.capacity).toBe(8);
    expect(colliders.capacity).toBe(8);
    expect(counters.bodyCapacityGrowths).toBe(2);
    expect(counters.colliderCapacityGrowths).toBe(2);
    for (let seed = 0; seed < 5; seed += 1) {
      expect(bodies.has(seed, bodyGenerations[seed]!)).toBe(true);
      expect(bodies.positionZ[seed]).toBe(seed + 0.3);
      expect(bodies.localCenterY[seed]).toBe(seed + 0.5);
      expect(bodies.angularVelocityZ[seed]).toBe(seed + 1.2);
      expect(bodies.localInverseInertiaXZ[seed]).toBe(seed + 2.4);
      expect(bodies.translationLocks[seed]).toBe(0b101);
      expect(colliders.has(seed, colliderGenerations[seed]!)).toBe(true);
      expect(colliders.bodyIndices[seed]).toBe(seed);
      expect(colliders.localPositionZ[seed]).toBe(seed + 0.3);
      expect(colliders.collisionGroup[seed]).toBe(seed === 0 ? 0 : -seed);
      expect(colliders.tags[seed]).toBe(tags[seed]);
    }
  });
});
