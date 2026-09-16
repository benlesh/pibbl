import { describe, expect, it } from "vitest";
import type { PrivateManifold3D } from "../collision/manifold.js";
import { sphereShape3D } from "../../../3d-geometry.js";
import { requireShapeRecord3D } from "../shape-records.js";
import { createPhysicsOwnershipCounters3D } from "../runtime/ownership.js";
import {
  CONTACT_EVENT_BEGIN_3D,
  CONTACT_EVENT_END_3D,
  OVERLAP_EVENT_BEGIN_3D,
  OVERLAP_EVENT_END_3D,
  ContactCache3D,
  updateSortedContactCache3D,
  type SortedColliderPairs3D,
} from "./contact-cache.js";
import {
  BODY_ENABLED_3D,
  BODY_TYPE_DYNAMIC_3D,
  COLLIDER_ENABLED_3D,
  COLLIDER_SENSOR_3D,
  BodyStore3D,
  ColliderStore3D,
} from "./storage.js";

const shape = requireShapeRecord3D(sphereShape3D({ radius: 1 }));

function createFixture(): {
  counters: ReturnType<typeof createPhysicsOwnershipCounters3D>;
  bodies: BodyStore3D;
  colliders: ColliderStore3D;
  addBody(dynamic?: boolean, enabled?: boolean): number;
  addCollider(
    body: number,
    options?: Readonly<{
      friction?: number;
      restitution?: number;
      sensor?: boolean;
      category?: number;
      mask?: number;
      group?: number;
      enabled?: boolean;
    }>,
  ): number;
} {
  const counters = createPhysicsOwnershipCounters3D();
  const bodies = new BodyStore3D(counters, 8);
  const colliders = new ColliderStore3D(counters, 8);
  return {
    counters,
    bodies,
    colliders,
    addBody(dynamic = true, enabled = true) {
      return bodies.allocate({
        positionX: 0,
        positionY: 0,
        positionZ: 0,
        orientationX: 0,
        orientationY: 0,
        orientationZ: 0,
        orientationW: 1,
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
        flags:
          (enabled ? BODY_ENABLED_3D : 0) |
          (dynamic ? BODY_TYPE_DYNAMIC_3D : 0),
        owner: {},
      });
    },
    addCollider(body, options = {}) {
      return colliders.allocate({
        bodyIndex: body,
        bodyGeneration: bodies.generations[body]!,
        shape,
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
        collisionCategory: options.category ?? 1,
        collisionMask: options.mask ?? 0xffff_ffff,
        collisionGroup: options.group ?? 0,
        tag: null,
        handlers: null,
        owner: {},
        flags:
          (options.enabled === false ? 0 : COLLIDER_ENABLED_3D) |
          (options.sensor === true ? COLLIDER_SENSOR_3D : 0),
      });
    },
  };
}

function pairs(
  entries: readonly (readonly [number, number])[],
): SortedColliderPairs3D {
  return {
    pairFirstColliderIndices: Int32Array.from(entries.map((entry) => entry[0])),
    pairFirstColliderGenerations: new Uint32Array(entries.length).fill(1),
    pairSecondColliderIndices: Int32Array.from(
      entries.map((entry) => entry[1]),
    ),
    pairSecondColliderGenerations: new Uint32Array(entries.length).fill(1),
    pairCount: entries.length,
  };
}

function manifold(
  points: readonly Readonly<{
    firstFeature: number;
    secondFeature: number;
    firstX?: number;
    separation?: number;
  }>[],
): PrivateManifold3D {
  return {
    normalX: 0,
    normalY: 1,
    normalZ: 0,
    points: points.map((point) => ({
      firstX: point.firstX ?? 0,
      firstY: 0,
      firstZ: 0,
      secondX: 0,
      secondY: 0,
      secondZ: 0,
      separation: point.separation ?? -0.1,
      firstFeature: point.firstFeature,
      secondFeature: point.secondFeature,
    })),
  };
}

function eventRows(cache: ContactCache3D): number[][] {
  const result: number[][] = [];
  for (let index = 0; index < cache.eventCount; index += 1) {
    result.push([
      cache.eventTypes[index]!,
      cache.eventFirstColliderIndices[index]!,
      cache.eventSecondColliderIndices[index]!,
    ]);
  }
  return result;
}

describe("persistent 3D contact cache", () => {
  it("merges sorted candidates, orders four-point features, and warm-starts exact matches", () => {
    const fixture = createFixture();
    const first = fixture.addCollider(fixture.addBody(), {
      friction: 0.25,
      restitution: 0.2,
    });
    const second = fixture.addCollider(fixture.addBody(false), {
      friction: 1,
      restitution: 0.8,
    });
    const cache = new ContactCache3D(fixture.counters, 1);
    const source = pairs([[first, second]]);

    updateSortedContactCache3D(
      cache,
      source,
      fixture.bodies,
      fixture.colliders,
      () =>
        manifold([
          { firstFeature: 9, secondFeature: 4, firstX: 1, separation: -0.1 },
          { firstFeature: 2, secondFeature: 7, firstX: -1, separation: -0.2 },
          { firstFeature: 5, secondFeature: 1, firstX: 0, separation: -0.1 },
          { firstFeature: 7, secondFeature: 3, firstX: 0.5, separation: -0.1 },
        ]),
    );
    expect(cache.contactCount).toBe(1);
    expect(cache.mixedFriction[0]).toBe(0.5);
    expect(cache.mixedRestitution[0]).toBe(0.8);
    expect(Array.from(cache.pointFirstFeatures.subarray(0, 4))).toEqual([
      2, 5, 7, 9,
    ]);
    cache.pointNormalImpulses[0] = 6;
    cache.pointTangentImpulse1[0] = -2;
    cache.pointTangentImpulse2[0] = 3;

    updateSortedContactCache3D(
      cache,
      source,
      fixture.bodies,
      fixture.colliders,
      () =>
        manifold([
          { firstFeature: 9, secondFeature: 4, firstX: 1, separation: -0.1 },
          { firstFeature: 2, secondFeature: 99, firstX: -1, separation: -0.2 },
        ]),
    );
    expect(Array.from(cache.pointFirstFeatures.subarray(0, 2))).toEqual([2, 9]);
    expect(Array.from(cache.pointNormalImpulses.subarray(0, 2))).toEqual([
      0, 0,
    ]);
    expect(cache.pointNormalImpulses[1]).toBe(0);
    expect(cache.pointTangentImpulse1[0]).toBe(0);
    expect(cache.pointTangentImpulse2[0]).toBe(0);

    cache.pointNormalImpulses[1] = 8;
    cache.pointTangentImpulse1[1] = 4;
    cache.pointTangentImpulse2[1] = -3;
    updateSortedContactCache3D(
      cache,
      source,
      fixture.bodies,
      fixture.colliders,
      () =>
        manifold([
          { firstFeature: 9, secondFeature: 4, firstX: 1, separation: -0.1 },
        ]),
    );
    expect(cache.pointNormalImpulses[0]).toBe(8);
    expect(cache.pointTangentImpulse1[0]).toBe(4);
    expect(cache.pointTangentImpulse2[0]).toBe(-3);
  });

  it("prunes stale pairs without materializing unobserved transition facts", () => {
    const fixture = createFixture();
    const first = fixture.addCollider(fixture.addBody());
    const second = fixture.addCollider(fixture.addBody(false));
    const cache = new ContactCache3D(fixture.counters);
    let overlapping = true;
    const provider = () =>
      overlapping ? manifold([{ firstFeature: 1, secondFeature: 2 }]) : null;
    updateSortedContactCache3D(
      cache,
      pairs([[first, second]]),
      fixture.bodies,
      fixture.colliders,
      provider,
    );
    expect(cache.contactCount).toBe(1);
    expect(cache.eventCount).toBe(0);
    expect(fixture.counters.contactEventFactWrites).toBe(0);

    updateSortedContactCache3D(
      cache,
      pairs([]),
      fixture.bodies,
      fixture.colliders,
      provider,
    );
    expect(cache.contactCount).toBe(1);
    overlapping = false;
    updateSortedContactCache3D(
      cache,
      pairs([]),
      fixture.bodies,
      fixture.colliders,
      provider,
    );
    expect(cache.contactCount).toBe(0);
    expect(cache.eventCount).toBe(0);
    expect(fixture.counters.contactEventFactWrites).toBe(0);
    expect(fixture.counters.contactAllocations).toBe(1);
    expect(fixture.counters.contactReleases).toBe(1);
  });

  it("leaves committed contacts, events, and ownership unchanged when a staged addition throws", () => {
    const fixture = createFixture();
    const first = fixture.addCollider(fixture.addBody());
    const second = fixture.addCollider(fixture.addBody(false));
    const third = fixture.addCollider(fixture.addBody(false));
    const cache = new ContactCache3D(fixture.counters);
    const source = pairs([
      [first, second],
      [first, third],
    ]);
    const committedPairs = cache.firstColliderIndices;
    const committedPoints = cache.pointNormalImpulses;
    const committedEvents = cache.eventTypes;
    let calls = 0;

    expect(() =>
      updateSortedContactCache3D(
        cache,
        source,
        fixture.bodies,
        fixture.colliders,
        () => {
          calls += 1;
          if (calls === 2) throw new Error("narrow phase failed");
          return manifold([{ firstFeature: 1, secondFeature: 2 }]);
        },
        true,
      ),
    ).toThrow("narrow phase failed");

    expect(cache.contactCount).toBe(0);
    expect(cache.eventCount).toBe(0);
    expect(cache.firstColliderIndices).toBe(committedPairs);
    expect(cache.pointNormalImpulses).toBe(committedPoints);
    expect(cache.eventTypes).toBe(committedEvents);
    expect(cache.eventTypes[0]).toBe(0);
    expect(fixture.counters.contactAllocations).toBe(0);
    expect(fixture.counters.contactReleases).toBe(0);
    expect(fixture.counters.liveContacts).toBe(0);
    expect(fixture.counters.contactEventFactWrites).toBe(0);

    updateSortedContactCache3D(
      cache,
      source,
      fixture.bodies,
      fixture.colliders,
      () => manifold([{ firstFeature: 1, secondFeature: 2 }]),
      true,
    );
    expect(cache.contactCount).toBe(2);
    expect(fixture.counters.contactAllocations).toBe(2);
    expect(fixture.counters.liveContacts).toBe(2);
    cache.dispose();
    cache.dispose();
    expect(fixture.counters.contactAllocations).toBe(2);
    expect(fixture.counters.contactReleases).toBe(2);
    expect(fixture.counters.liveContacts).toBe(0);
  });

  it("leaves committed contacts, events, and ownership unchanged when a staged removal throws", () => {
    const fixture = createFixture();
    const first = fixture.addCollider(fixture.addBody());
    const second = fixture.addCollider(fixture.addBody(false));
    const third = fixture.addCollider(fixture.addBody(false));
    const cache = new ContactCache3D(fixture.counters);
    const source = pairs([
      [first, second],
      [first, third],
    ]);
    updateSortedContactCache3D(
      cache,
      source,
      fixture.bodies,
      fixture.colliders,
      () => manifold([{ firstFeature: 1, secondFeature: 2 }]),
      true,
    );
    cache.pointNormalImpulses[0] = 3;
    cache.pointNormalImpulses[4] = 7;
    const committedPairs = cache.firstColliderIndices;
    const committedPoints = cache.pointNormalImpulses;
    const committedEvents = cache.eventTypes;
    const committedEventRows = eventRows(cache);
    let calls = 0;

    expect(() =>
      updateSortedContactCache3D(
        cache,
        source,
        fixture.bodies,
        fixture.colliders,
        () => {
          calls += 1;
          if (calls === 2) throw new Error("narrow phase failed");
          return null;
        },
        true,
      ),
    ).toThrow("narrow phase failed");

    expect(cache.contactCount).toBe(2);
    expect(cache.eventCount).toBe(2);
    expect(cache.firstColliderIndices).toBe(committedPairs);
    expect(cache.pointNormalImpulses).toBe(committedPoints);
    expect(cache.eventTypes).toBe(committedEvents);
    expect(eventRows(cache)).toEqual(committedEventRows);
    expect(Array.from(cache.pointNormalImpulses.subarray(0, 5))).toEqual([
      3, 0, 0, 0, 7,
    ]);
    expect(fixture.counters.contactAllocations).toBe(2);
    expect(fixture.counters.contactReleases).toBe(0);
    expect(fixture.counters.liveContacts).toBe(2);
    expect(fixture.counters.contactEventFactWrites).toBe(2);

    calls = 0;
    updateSortedContactCache3D(
      cache,
      source,
      fixture.bodies,
      fixture.colliders,
      () => {
        calls += 1;
        return calls === 1
          ? null
          : manifold([{ firstFeature: 1, secondFeature: 2 }]);
      },
      true,
    );
    expect(cache.contactCount).toBe(1);
    expect(fixture.counters.contactAllocations).toBe(2);
    expect(fixture.counters.contactReleases).toBe(1);
    expect(fixture.counters.liveContacts).toBe(1);
    cache.dispose();
    expect(fixture.counters.contactAllocations).toBe(2);
    expect(fixture.counters.contactReleases).toBe(2);
    expect(fixture.counters.liveContacts).toBe(0);
  });

  it("ends and begins observed semantics while clearing impulses across sensor-state changes", () => {
    const fixture = createFixture();
    const first = fixture.addCollider(fixture.addBody());
    const second = fixture.addCollider(fixture.addBody(false));
    const cache = new ContactCache3D(fixture.counters);
    const source = pairs([[first, second]]);
    const provider = () => manifold([{ firstFeature: 1, secondFeature: 2 }]);
    updateSortedContactCache3D(
      cache,
      source,
      fixture.bodies,
      fixture.colliders,
      provider,
      true,
    );
    cache.pointNormalImpulses[0] = 6;
    cache.pointTangentImpulse1[0] = -2;
    cache.pointTangentImpulse2[0] = 3;

    fixture.colliders.flags[first] |= COLLIDER_SENSOR_3D;
    updateSortedContactCache3D(
      cache,
      source,
      fixture.bodies,
      fixture.colliders,
      provider,
      true,
    );
    expect(cache.sensorFlags[0]).toBe(1);
    expect(eventRows(cache)).toEqual([
      [CONTACT_EVENT_END_3D, first, second],
      [OVERLAP_EVENT_BEGIN_3D, first, second],
    ]);
    expect(cache.pointNormalImpulses[0]).toBe(0);
    expect(cache.pointTangentImpulse1[0]).toBe(0);
    expect(cache.pointTangentImpulse2[0]).toBe(0);

    cache.pointNormalImpulses[0] = 8;
    cache.pointTangentImpulse1[0] = 4;
    cache.pointTangentImpulse2[0] = -3;
    fixture.colliders.flags[first] &= ~COLLIDER_SENSOR_3D;
    updateSortedContactCache3D(
      cache,
      source,
      fixture.bodies,
      fixture.colliders,
      provider,
      true,
    );
    expect(cache.sensorFlags[0]).toBe(0);
    expect(eventRows(cache)).toEqual([
      [OVERLAP_EVENT_END_3D, first, second],
      [CONTACT_EVENT_BEGIN_3D, first, second],
    ]);
    expect(cache.pointNormalImpulses[0]).toBe(0);
    expect(cache.pointTangentImpulse1[0]).toBe(0);
    expect(cache.pointTangentImpulse2[0]).toBe(0);
  });

  it("clears impulses without transition facts across unobserved sensor-state changes", () => {
    const fixture = createFixture();
    const first = fixture.addCollider(fixture.addBody());
    const second = fixture.addCollider(fixture.addBody(false));
    const cache = new ContactCache3D(fixture.counters);
    const source = pairs([[first, second]]);
    const provider = () => manifold([{ firstFeature: 1, secondFeature: 2 }]);
    updateSortedContactCache3D(
      cache,
      source,
      fixture.bodies,
      fixture.colliders,
      provider,
    );
    cache.pointNormalImpulses[0] = 6;
    cache.pointTangentImpulse1[0] = -2;
    cache.pointTangentImpulse2[0] = 3;

    fixture.colliders.flags[first] |= COLLIDER_SENSOR_3D;
    updateSortedContactCache3D(
      cache,
      source,
      fixture.bodies,
      fixture.colliders,
      provider,
    );
    expect(cache.sensorFlags[0]).toBe(1);
    expect(cache.eventCount).toBe(0);
    expect(cache.pointNormalImpulses[0]).toBe(0);
    expect(cache.pointTangentImpulse1[0]).toBe(0);
    expect(cache.pointTangentImpulse2[0]).toBe(0);

    cache.pointNormalImpulses[0] = 8;
    cache.pointTangentImpulse1[0] = 4;
    cache.pointTangentImpulse2[0] = -3;
    fixture.colliders.flags[first] &= ~COLLIDER_SENSOR_3D;
    updateSortedContactCache3D(
      cache,
      source,
      fixture.bodies,
      fixture.colliders,
      provider,
    );
    expect(cache.sensorFlags[0]).toBe(0);
    expect(cache.eventCount).toBe(0);
    expect(cache.pointNormalImpulses[0]).toBe(0);
    expect(cache.pointTangentImpulse1[0]).toBe(0);
    expect(cache.pointTangentImpulse2[0]).toBe(0);
  });

  it("records observed contact and overlap transitions in pair order", () => {
    const fixture = createFixture();
    const first = fixture.addCollider(fixture.addBody());
    const second = fixture.addCollider(fixture.addBody(false));
    const sensor = fixture.addCollider(fixture.addBody(false), {
      sensor: true,
    });
    const cache = new ContactCache3D(fixture.counters);
    updateSortedContactCache3D(
      cache,
      pairs([
        [first, second],
        [first, sensor],
      ]),
      fixture.bodies,
      fixture.colliders,
      () => manifold([{ firstFeature: 0, secondFeature: 0 }]),
      true,
    );
    expect(eventRows(cache)).toEqual([
      [CONTACT_EVENT_BEGIN_3D, first, second],
      [OVERLAP_EVENT_BEGIN_3D, first, sensor],
    ]);
    expect(fixture.counters.contactEventFactWrites).toBe(2);

    updateSortedContactCache3D(
      cache,
      pairs([]),
      fixture.bodies,
      fixture.colliders,
      () => null,
      true,
    );
    expect(eventRows(cache)).toContainEqual([
      CONTACT_EVENT_END_3D,
      first,
      second,
    ]);
    expect(fixture.counters.contactEventFactWrites).toBe(4);
  });

  it("filters same-body, disabled, mask-rejected, negative-group, and static-static pairs before narrow phase", () => {
    const fixture = createFixture();
    const dynamicBody = fixture.addBody();
    const staticA = fixture.addBody(false);
    const staticB = fixture.addBody(false);
    const disabledBody = fixture.addBody(true, false);
    const sameA = fixture.addCollider(dynamicBody);
    const sameB = fixture.addCollider(dynamicBody);
    const staticColliderA = fixture.addCollider(staticA);
    const staticColliderB = fixture.addCollider(staticB);
    const disabled = fixture.addCollider(disabledBody);
    const masked = fixture.addCollider(fixture.addBody(), {
      category: 2,
      mask: 2,
    });
    const maskOther = fixture.addCollider(fixture.addBody(false), {
      category: 1,
      mask: 1,
    });
    const grouped = fixture.addCollider(fixture.addBody(), { group: -7 });
    const groupedOther = fixture.addCollider(fixture.addBody(false), {
      group: -7,
    });
    const cache = new ContactCache3D(fixture.counters);
    let calls = 0;

    updateSortedContactCache3D(
      cache,
      pairs([
        [sameA, sameB],
        [staticColliderA, staticColliderB],
        [sameA, disabled],
        [masked, maskOther],
        [grouped, groupedOther],
      ]),
      fixture.bodies,
      fixture.colliders,
      () => {
        calls += 1;
        return manifold([{ firstFeature: 0, secondFeature: 0 }]);
      },
    );

    expect(calls).toBe(0);
    expect(cache.contactCount).toBe(0);
  });

  it("releases cache-owned contacts and storage exactly once", () => {
    const fixture = createFixture();
    const first = fixture.addCollider(fixture.addBody());
    const second = fixture.addCollider(fixture.addBody(false));
    const cache = new ContactCache3D(fixture.counters);
    updateSortedContactCache3D(
      cache,
      pairs([[first, second]]),
      fixture.bodies,
      fixture.colliders,
      () => manifold([{ firstFeature: 0, secondFeature: 0 }]),
    );
    cache.dispose();
    cache.dispose();
    expect(fixture.counters.contactAllocations).toBe(1);
    expect(fixture.counters.contactReleases).toBe(1);
    expect(fixture.counters.liveContacts).toBe(0);
    expect(fixture.counters.contactCacheAllocations).toBe(1);
    expect(fixture.counters.contactCacheReleases).toBe(1);
    expect(fixture.counters.liveContactCaches).toBe(0);
  });
});
