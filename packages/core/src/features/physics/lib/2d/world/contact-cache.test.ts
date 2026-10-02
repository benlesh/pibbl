import { describe, expect, it } from "vitest";
import type { PrivateManifold2D } from "../collision/manifold.js";
import type { ShapeRecord2D } from "../shape-records.js";
import { createPhysicsOwnershipCounters2D } from "../runtime/ownership.js";
import { BodyStore2D, ColliderStore2D } from "./storage.js";
import {
  COLLIDER_SENSOR_2D,
  CONTACT_EVENT_BEGIN_2D,
  CONTACT_EVENT_END_2D,
  OVERLAP_EVENT_BEGIN_2D,
  OVERLAP_EVENT_END_2D,
  ContactCache2D,
  updateSortedContactCache2D,
  type SortedColliderPairs2D,
} from "./contact-cache.js";
import { BODY_TYPE_DYNAMIC_2D } from "./integrator.js";

const shapeRecord: ShapeRecord2D = Object.freeze({
  leaves: Object.freeze([]),
  localPose: Object.freeze({ x: 0, y: 0, rotationRadians: 0 }),
  localBounds: new Float64Array([-1, -1, 1, 1]),
  area: 4,
  centroidX: 0,
  centroidY: 0,
  unitInertia: 1,
});

function createFixture(): {
  bodies: BodyStore2D;
  colliders: ColliderStore2D;
  addBody: (dynamic?: boolean) => number;
  addCollider: (
    body: number,
    material?: Readonly<{ friction: number; restitution: number }>,
    flags?: number,
  ) => number;
} {
  const counters = createPhysicsOwnershipCounters2D();
  const bodies = new BodyStore2D(counters, 8);
  const colliders = new ColliderStore2D(counters, 8);
  return {
    bodies,
    colliders,
    addBody(dynamic = true) {
      return bodies.allocate({
        positionX: 0,
        positionY: 0,
        rotationRadians: 0,
        linearVelocityX: 0,
        linearVelocityY: 0,
        angularVelocity: 0,
        forceX: 0,
        forceY: 0,
        torque: 0,
        inverseMass: dynamic ? 1 : 0,
        inverseInertia: dynamic ? 1 : 0,
        linearDamping: 0,
        angularDamping: 0,
        gravityScale: 1,
        sleepTime: 0,
        flags: dynamic ? BODY_TYPE_DYNAMIC_2D : 0,
        owner: {},
      });
    },
    addCollider(body, material = { friction: 0.5, restitution: 0 }, flags = 0) {
      return colliders.allocate({
        bodyIndex: body,
        bodyGeneration: bodies.generations[body]!,
        shape: shapeRecord,
        material,
        filter: null,
        tag: null,
        handlers: null,
        owner: {},
        flags,
      });
    },
  };
}

function pairs(entries: readonly (readonly [number, number])[]): SortedColliderPairs2D {
  const first = new Int32Array(entries.length);
  const firstGenerations = new Uint32Array(entries.length);
  const second = new Int32Array(entries.length);
  const secondGenerations = new Uint32Array(entries.length);
  for (let index = 0; index < entries.length; index += 1) {
    first[index] = entries[index]![0];
    firstGenerations[index] = 1;
    second[index] = entries[index]![1];
    secondGenerations[index] = 1;
  }
  return {
    pairFirstColliderIndices: first,
    pairFirstColliderGenerations: firstGenerations,
    pairSecondColliderIndices: second,
    pairSecondColliderGenerations: secondGenerations,
    pairCount: entries.length,
  };
}

function manifold(
  points: readonly Readonly<{
    firstFeature: number;
    secondFeature: number;
    firstX?: number;
    firstY?: number;
    secondX?: number;
    secondY?: number;
    separation?: number;
  }>[],
  firstLeaf = 0,
  secondLeaf = 0,
): PrivateManifold2D {
  return {
    normalX: 0,
    normalY: -1,
    firstLeaf,
    secondLeaf,
    points: points.map((point) => ({
      firstX: point.firstX ?? 0,
      firstY: point.firstY ?? 0,
      secondX: point.secondX ?? 0,
      secondY: point.secondY ?? 0,
      separation: point.separation ?? -0.1,
      firstFeature: point.firstFeature,
      secondFeature: point.secondFeature,
    })),
  };
}

function eventRows(cache: ContactCache2D): number[][] {
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

describe("persistent 2D contact cache", () => {
  it("emits stable begin/end candidates in pair order without active events", () => {
    const fixture = createFixture();
    const bodies = [fixture.addBody(), fixture.addBody(), fixture.addBody()];
    const colliders = bodies.map((body) => fixture.addCollider(body));
    const cache = new ContactCache2D(2);
    const active = new Set(["0:1", "0:2"]);
    const provider = (first: number, second: number) =>
      active.has(`${first}:${second}`)
        ? manifold([{ firstFeature: 0, secondFeature: 0 }])
        : null;

    updateSortedContactCache2D(
      cache,
      pairs([
        [colliders[0]!, colliders[1]!],
        [colliders[0]!, colliders[2]!],
      ]),
      fixture.colliders,
      provider,
    );
    expect(eventRows(cache)).toEqual([
      [CONTACT_EVENT_BEGIN_2D, 0, 1],
      [CONTACT_EVENT_BEGIN_2D, 0, 2],
    ]);

    updateSortedContactCache2D(
      cache,
      pairs([
        [0, 1],
        [0, 2],
      ]),
      fixture.colliders,
      provider,
    );
    expect(cache.eventCount).toBe(0);

    active.delete("0:1");
    updateSortedContactCache2D(
      cache,
      pairs([
        [0, 1],
        [0, 2],
      ]),
      fixture.colliders,
      provider,
    );
    expect(eventRows(cache)).toEqual([[CONTACT_EVENT_END_2D, 0, 1]]);
    expect(cache.contactCount).toBe(1);
    expect(cache.firstColliderIndices[0]).toBe(0);
    expect(cache.secondColliderIndices[0]).toBe(2);
  });

  it("distinguishes sensor overlap transitions and excludes same-body compounds", () => {
    const fixture = createFixture();
    const firstBody = fixture.addBody();
    const secondBody = fixture.addBody();
    const solid = fixture.addCollider(firstBody);
    const compound = fixture.addCollider(firstBody);
    const sensor = fixture.addCollider(secondBody, undefined, COLLIDER_SENSOR_2D);
    const cache = new ContactCache2D();

    updateSortedContactCache2D(
      cache,
      pairs([
        [solid, compound],
        [solid, sensor],
      ]),
      fixture.colliders,
      () => manifold([{ firstFeature: 0, secondFeature: 0 }]),
    );

    expect(cache.contactCount).toBe(1);
    expect(cache.sensorFlags[0]).toBe(1);
    expect(eventRows(cache)).toEqual([[OVERLAP_EVENT_BEGIN_2D, solid, sensor]]);

    updateSortedContactCache2D(
      cache,
      pairs([]),
      fixture.colliders,
      () => null,
    );
    expect(eventRows(cache)).toEqual([[OVERLAP_EVENT_END_2D, solid, sensor]]);
  });

  it("ends the old semantic contact before beginning a sensor-state replacement", () => {
    const fixture = createFixture();
    const first = fixture.addCollider(fixture.addBody());
    const second = fixture.addCollider(fixture.addBody());
    const cache = new ContactCache2D();
    const source = pairs([[first, second]]);
    const provider = () => manifold([{ firstFeature: 0, secondFeature: 0 }]);
    updateSortedContactCache2D(cache, source, fixture.colliders, provider);

    fixture.colliders.flags[first] |= COLLIDER_SENSOR_2D;
    updateSortedContactCache2D(cache, source, fixture.colliders, provider);

    expect(eventRows(cache)).toEqual([
      [CONTACT_EVENT_END_2D, first, second],
      [OVERLAP_EVENT_BEGIN_2D, first, second],
    ]);
  });

  it("mixes materials and reuses impulses only for exact private features", () => {
    const fixture = createFixture();
    const first = fixture.addCollider(
      fixture.addBody(),
      { friction: 0.25, restitution: 0.2 },
    );
    const second = fixture.addCollider(
      fixture.addBody(false),
      { friction: 1, restitution: 0.8 },
    );
    const cache = new ContactCache2D();

    updateSortedContactCache2D(
      cache,
      pairs([[first, second]]),
      fixture.colliders,
      () =>
        manifold([
          { firstFeature: 9, secondFeature: 4, firstX: 1 },
          { firstFeature: 2, secondFeature: 7, firstX: -1 },
        ], 3, 5),
    );
    expect(cache.mixedFriction[0]).toBe(0.5);
    expect(cache.mixedRestitution[0]).toBe(0.8);
    expect(Array.from(cache.pointFirstFeatures.subarray(0, 2))).toEqual([2, 9]);
    cache.pointNormalImpulses[0] = 6;
    cache.pointTangentImpulses[0] = -2;
    cache.pointNormalImpulses[1] = 8;
    cache.pointTangentImpulses[1] = 3;

    updateSortedContactCache2D(
      cache,
      pairs([[first, second]]),
      fixture.colliders,
      () =>
        manifold([
          { firstFeature: 9, secondFeature: 4, firstX: 1 },
          { firstFeature: 2, secondFeature: 99, firstX: -1 },
        ], 3, 5),
    );

    expect(Array.from(cache.pointFirstFeatures.subarray(0, 2))).toEqual([2, 9]);
    expect(Array.from(cache.pointNormalImpulses.subarray(0, 2))).toEqual([0, 8]);
    expect(Array.from(cache.pointTangentImpulses.subarray(0, 2))).toEqual([0, 3]);
  });

  it("merges prior contacts with newly published moved-proxy pairs", () => {
    const fixture = createFixture();
    fixture.addCollider(fixture.addBody());
    fixture.addCollider(fixture.addBody());
    const cache = new ContactCache2D();
    let overlapping = true;
    const provider = () =>
      overlapping
        ? manifold([{ firstFeature: 1, secondFeature: 2 }])
        : null;
    updateSortedContactCache2D(
      cache,
      pairs([[0, 1]]),
      fixture.colliders,
      provider,
    );

    updateSortedContactCache2D(
      cache,
      pairs([]),
      fixture.colliders,
      provider,
    );
    expect(cache.contactCount).toBe(1);
    expect(cache.eventCount).toBe(0);

    overlapping = false;
    updateSortedContactCache2D(
      cache,
      pairs([]),
      fixture.colliders,
      provider,
    );
    expect(cache.contactCount).toBe(0);
    expect(eventRows(cache)).toEqual([[CONTACT_EVENT_END_2D, 0, 1]]);
  });

  it("keeps equal pair and point ties deterministic across two runs", () => {
    const run = () => {
      const fixture = createFixture();
      const body0 = fixture.addBody();
      const body1 = fixture.addBody();
      fixture.addCollider(body0);
      fixture.addCollider(body1);
      const cache = new ContactCache2D(1);
      updateSortedContactCache2D(
        cache,
        pairs([[0, 1]]),
        fixture.colliders,
        () =>
          manifold([
            { firstFeature: 4, secondFeature: 2, firstX: 1 },
            { firstFeature: 4, secondFeature: 2, firstX: -1 },
          ], 1, 1),
      );
      return {
        pairs: [cache.firstColliderIndices[0], cache.secondColliderIndices[0]],
        points: Array.from(cache.pointFirstX.subarray(0, 2)),
        features: Array.from(cache.pointFirstFeatures.subarray(0, 2)),
        events: eventRows(cache),
      };
    };

    expect(run()).toEqual(run());
    expect(run().points).toEqual([-1, 1]);
  });

  it("reuses warmed arrays and leaves the current generation intact on failure", () => {
    const fixture = createFixture();
    fixture.addCollider(fixture.addBody());
    fixture.addCollider(fixture.addBody());
    const cache = new ContactCache2D(2);
    const source = pairs([[0, 1]]);
    updateSortedContactCache2D(
      cache,
      source,
      fixture.colliders,
      () => manifold([{ firstFeature: 1, secondFeature: 2 }]),
    );
    const currentPairs = cache.firstColliderIndices;
    const currentPoints = cache.pointNormalImpulses;

    expect(() =>
      updateSortedContactCache2D(cache, source, fixture.colliders, () => {
        throw new Error("narrow phase failed");
      }),
    ).toThrow("narrow phase failed");
    expect(cache.contactCount).toBe(1);
    expect(cache.firstColliderIndices).toBe(currentPairs);
    expect(cache.pointNormalImpulses).toBe(currentPoints);

    updateSortedContactCache2D(
      cache,
      source,
      fixture.colliders,
      () => manifold([{ firstFeature: 1, secondFeature: 2 }]),
    );
    const warmedCurrentPairs = cache.firstColliderIndices;
    const warmedStagingPairs = cache.stagingFirstColliderIndices;
    for (let iteration = 0; iteration < 20; iteration += 1) {
      updateSortedContactCache2D(
        cache,
        source,
        fixture.colliders,
        () => manifold([{ firstFeature: 1, secondFeature: 2 }]),
      );
    }
    expect(
      [cache.firstColliderIndices, cache.stagingFirstColliderIndices],
    ).toEqual(expect.arrayContaining([warmedCurrentPairs, warmedStagingPairs]));
  });
});
