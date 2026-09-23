import type { PrivateManifold2D } from "../collision/manifold.js";
import type { ColliderStore2D } from "./storage.js";

export const COLLIDER_SENSOR_2D = 1 << 0;

export const CONTACT_EVENT_BEGIN_2D = 1;
export const CONTACT_EVENT_END_2D = 2;
export const OVERLAP_EVENT_BEGIN_2D = 3;
export const OVERLAP_EVENT_END_2D = 4;

const POINTS_PER_CONTACT = 2;

export interface SortedColliderPairs2D {
  readonly pairFirstColliderIndices: Int32Array;
  readonly pairFirstColliderGenerations: Uint32Array;
  readonly pairSecondColliderIndices: Int32Array;
  readonly pairSecondColliderGenerations: Uint32Array;
  readonly pairCount: number;
}

export type PrivateManifoldProvider2D = (
  firstColliderIndex: number,
  secondColliderIndex: number,
) => PrivateManifold2D | null;

export class ContactCache2D {
  contactCount = 0;
  firstColliderIndices: Int32Array;
  firstColliderGenerations: Uint32Array;
  secondColliderIndices: Int32Array;
  secondColliderGenerations: Uint32Array;
  firstBodyIndices: Int32Array;
  firstBodyGenerations: Uint32Array;
  secondBodyIndices: Int32Array;
  secondBodyGenerations: Uint32Array;
  sensorFlags: Uint8Array;
  mixedFriction: Float64Array;
  mixedRestitution: Float64Array;
  normalX: Float64Array;
  normalY: Float64Array;
  firstLeafIndices: Int32Array;
  secondLeafIndices: Int32Array;
  pointCounts: Uint8Array;
  pointFirstX: Float64Array;
  pointFirstY: Float64Array;
  pointSecondX: Float64Array;
  pointSecondY: Float64Array;
  pointSeparations: Float64Array;
  pointFirstFeatures: Int32Array;
  pointSecondFeatures: Int32Array;
  pointNormalImpulses: Float64Array;
  pointTangentImpulses: Float64Array;

  stagingFirstColliderIndices: Int32Array;
  stagingFirstColliderGenerations: Uint32Array;
  stagingSecondColliderIndices: Int32Array;
  stagingSecondColliderGenerations: Uint32Array;
  stagingFirstBodyIndices: Int32Array;
  stagingFirstBodyGenerations: Uint32Array;
  stagingSecondBodyIndices: Int32Array;
  stagingSecondBodyGenerations: Uint32Array;
  stagingSensorFlags: Uint8Array;
  stagingMixedFriction: Float64Array;
  stagingMixedRestitution: Float64Array;
  stagingNormalX: Float64Array;
  stagingNormalY: Float64Array;
  stagingFirstLeafIndices: Int32Array;
  stagingSecondLeafIndices: Int32Array;
  stagingPointCounts: Uint8Array;
  stagingPointFirstX: Float64Array;
  stagingPointFirstY: Float64Array;
  stagingPointSecondX: Float64Array;
  stagingPointSecondY: Float64Array;
  stagingPointSeparations: Float64Array;
  stagingPointFirstFeatures: Int32Array;
  stagingPointSecondFeatures: Int32Array;
  stagingPointNormalImpulses: Float64Array;
  stagingPointTangentImpulses: Float64Array;

  eventCount = 0;
  eventTypes: Uint8Array;
  eventFirstColliderIndices: Int32Array;
  eventFirstColliderGenerations: Uint32Array;
  eventSecondColliderIndices: Int32Array;
  eventSecondColliderGenerations: Uint32Array;

  constructor(initialCapacity = 4) {
    const capacity = normalizedCapacity(initialCapacity);
    this.firstColliderIndices = new Int32Array(capacity);
    this.firstColliderGenerations = new Uint32Array(capacity);
    this.secondColliderIndices = new Int32Array(capacity);
    this.secondColliderGenerations = new Uint32Array(capacity);
    this.firstBodyIndices = new Int32Array(capacity);
    this.firstBodyGenerations = new Uint32Array(capacity);
    this.secondBodyIndices = new Int32Array(capacity);
    this.secondBodyGenerations = new Uint32Array(capacity);
    this.sensorFlags = new Uint8Array(capacity);
    this.mixedFriction = new Float64Array(capacity);
    this.mixedRestitution = new Float64Array(capacity);
    this.normalX = new Float64Array(capacity);
    this.normalY = new Float64Array(capacity);
    this.firstLeafIndices = new Int32Array(capacity);
    this.secondLeafIndices = new Int32Array(capacity);
    this.pointCounts = new Uint8Array(capacity);
    this.pointFirstX = new Float64Array(capacity * POINTS_PER_CONTACT);
    this.pointFirstY = new Float64Array(capacity * POINTS_PER_CONTACT);
    this.pointSecondX = new Float64Array(capacity * POINTS_PER_CONTACT);
    this.pointSecondY = new Float64Array(capacity * POINTS_PER_CONTACT);
    this.pointSeparations = new Float64Array(capacity * POINTS_PER_CONTACT);
    this.pointFirstFeatures = new Int32Array(capacity * POINTS_PER_CONTACT);
    this.pointSecondFeatures = new Int32Array(capacity * POINTS_PER_CONTACT);
    this.pointNormalImpulses = new Float64Array(capacity * POINTS_PER_CONTACT);
    this.pointTangentImpulses = new Float64Array(capacity * POINTS_PER_CONTACT);

    this.stagingFirstColliderIndices = new Int32Array(capacity);
    this.stagingFirstColliderGenerations = new Uint32Array(capacity);
    this.stagingSecondColliderIndices = new Int32Array(capacity);
    this.stagingSecondColliderGenerations = new Uint32Array(capacity);
    this.stagingFirstBodyIndices = new Int32Array(capacity);
    this.stagingFirstBodyGenerations = new Uint32Array(capacity);
    this.stagingSecondBodyIndices = new Int32Array(capacity);
    this.stagingSecondBodyGenerations = new Uint32Array(capacity);
    this.stagingSensorFlags = new Uint8Array(capacity);
    this.stagingMixedFriction = new Float64Array(capacity);
    this.stagingMixedRestitution = new Float64Array(capacity);
    this.stagingNormalX = new Float64Array(capacity);
    this.stagingNormalY = new Float64Array(capacity);
    this.stagingFirstLeafIndices = new Int32Array(capacity);
    this.stagingSecondLeafIndices = new Int32Array(capacity);
    this.stagingPointCounts = new Uint8Array(capacity);
    this.stagingPointFirstX = new Float64Array(capacity * POINTS_PER_CONTACT);
    this.stagingPointFirstY = new Float64Array(capacity * POINTS_PER_CONTACT);
    this.stagingPointSecondX = new Float64Array(capacity * POINTS_PER_CONTACT);
    this.stagingPointSecondY = new Float64Array(capacity * POINTS_PER_CONTACT);
    this.stagingPointSeparations = new Float64Array(capacity * POINTS_PER_CONTACT);
    this.stagingPointFirstFeatures = new Int32Array(capacity * POINTS_PER_CONTACT);
    this.stagingPointSecondFeatures = new Int32Array(capacity * POINTS_PER_CONTACT);
    this.stagingPointNormalImpulses = new Float64Array(capacity * POINTS_PER_CONTACT);
    this.stagingPointTangentImpulses = new Float64Array(capacity * POINTS_PER_CONTACT);

    this.eventTypes = new Uint8Array(capacity * 2);
    this.eventFirstColliderIndices = new Int32Array(capacity * 2);
    this.eventFirstColliderGenerations = new Uint32Array(capacity * 2);
    this.eventSecondColliderIndices = new Int32Array(capacity * 2);
    this.eventSecondColliderGenerations = new Uint32Array(capacity * 2);
  }

  ensureCapacity(required: number): void {
    if (required <= this.firstColliderIndices.length) return;
    let capacity = this.firstColliderIndices.length;
    while (capacity < required) capacity *= 2;
    this.firstColliderIndices = growInt32(this.firstColliderIndices, capacity);
    this.firstColliderGenerations = growUint32(this.firstColliderGenerations, capacity);
    this.secondColliderIndices = growInt32(this.secondColliderIndices, capacity);
    this.secondColliderGenerations = growUint32(this.secondColliderGenerations, capacity);
    this.firstBodyIndices = growInt32(this.firstBodyIndices, capacity);
    this.firstBodyGenerations = growUint32(this.firstBodyGenerations, capacity);
    this.secondBodyIndices = growInt32(this.secondBodyIndices, capacity);
    this.secondBodyGenerations = growUint32(this.secondBodyGenerations, capacity);
    this.sensorFlags = growUint8(this.sensorFlags, capacity);
    this.mixedFriction = growFloat64(this.mixedFriction, capacity);
    this.mixedRestitution = growFloat64(this.mixedRestitution, capacity);
    this.normalX = growFloat64(this.normalX, capacity);
    this.normalY = growFloat64(this.normalY, capacity);
    this.firstLeafIndices = growInt32(this.firstLeafIndices, capacity);
    this.secondLeafIndices = growInt32(this.secondLeafIndices, capacity);
    this.pointCounts = growUint8(this.pointCounts, capacity);
    this.pointFirstX = growFloat64(this.pointFirstX, capacity * POINTS_PER_CONTACT);
    this.pointFirstY = growFloat64(this.pointFirstY, capacity * POINTS_PER_CONTACT);
    this.pointSecondX = growFloat64(this.pointSecondX, capacity * POINTS_PER_CONTACT);
    this.pointSecondY = growFloat64(this.pointSecondY, capacity * POINTS_PER_CONTACT);
    this.pointSeparations = growFloat64(this.pointSeparations, capacity * POINTS_PER_CONTACT);
    this.pointFirstFeatures = growInt32(this.pointFirstFeatures, capacity * POINTS_PER_CONTACT);
    this.pointSecondFeatures = growInt32(this.pointSecondFeatures, capacity * POINTS_PER_CONTACT);
    this.pointNormalImpulses = growFloat64(this.pointNormalImpulses, capacity * POINTS_PER_CONTACT);
    this.pointTangentImpulses = growFloat64(this.pointTangentImpulses, capacity * POINTS_PER_CONTACT);

    this.stagingFirstColliderIndices = growInt32(this.stagingFirstColliderIndices, capacity);
    this.stagingFirstColliderGenerations = growUint32(this.stagingFirstColliderGenerations, capacity);
    this.stagingSecondColliderIndices = growInt32(this.stagingSecondColliderIndices, capacity);
    this.stagingSecondColliderGenerations = growUint32(this.stagingSecondColliderGenerations, capacity);
    this.stagingFirstBodyIndices = growInt32(this.stagingFirstBodyIndices, capacity);
    this.stagingFirstBodyGenerations = growUint32(this.stagingFirstBodyGenerations, capacity);
    this.stagingSecondBodyIndices = growInt32(this.stagingSecondBodyIndices, capacity);
    this.stagingSecondBodyGenerations = growUint32(this.stagingSecondBodyGenerations, capacity);
    this.stagingSensorFlags = growUint8(this.stagingSensorFlags, capacity);
    this.stagingMixedFriction = growFloat64(this.stagingMixedFriction, capacity);
    this.stagingMixedRestitution = growFloat64(this.stagingMixedRestitution, capacity);
    this.stagingNormalX = growFloat64(this.stagingNormalX, capacity);
    this.stagingNormalY = growFloat64(this.stagingNormalY, capacity);
    this.stagingFirstLeafIndices = growInt32(this.stagingFirstLeafIndices, capacity);
    this.stagingSecondLeafIndices = growInt32(this.stagingSecondLeafIndices, capacity);
    this.stagingPointCounts = growUint8(this.stagingPointCounts, capacity);
    this.stagingPointFirstX = growFloat64(this.stagingPointFirstX, capacity * POINTS_PER_CONTACT);
    this.stagingPointFirstY = growFloat64(this.stagingPointFirstY, capacity * POINTS_PER_CONTACT);
    this.stagingPointSecondX = growFloat64(this.stagingPointSecondX, capacity * POINTS_PER_CONTACT);
    this.stagingPointSecondY = growFloat64(this.stagingPointSecondY, capacity * POINTS_PER_CONTACT);
    this.stagingPointSeparations = growFloat64(this.stagingPointSeparations, capacity * POINTS_PER_CONTACT);
    this.stagingPointFirstFeatures = growInt32(this.stagingPointFirstFeatures, capacity * POINTS_PER_CONTACT);
    this.stagingPointSecondFeatures = growInt32(this.stagingPointSecondFeatures, capacity * POINTS_PER_CONTACT);
    this.stagingPointNormalImpulses = growFloat64(this.stagingPointNormalImpulses, capacity * POINTS_PER_CONTACT);
    this.stagingPointTangentImpulses = growFloat64(this.stagingPointTangentImpulses, capacity * POINTS_PER_CONTACT);
    this.ensureEventCapacity(capacity * 2);
  }

  ensureEventCapacity(required: number): void {
    if (required <= this.eventTypes.length) return;
    let capacity = this.eventTypes.length;
    while (capacity < required) capacity *= 2;
    this.eventTypes = growUint8(this.eventTypes, capacity);
    this.eventFirstColliderIndices = growInt32(this.eventFirstColliderIndices, capacity);
    this.eventFirstColliderGenerations = growUint32(this.eventFirstColliderGenerations, capacity);
    this.eventSecondColliderIndices = growInt32(this.eventSecondColliderIndices, capacity);
    this.eventSecondColliderGenerations = growUint32(this.eventSecondColliderGenerations, capacity);
  }

  swapGenerations(nextCount: number, nextEventCount: number): void {
    let int32 = this.firstColliderIndices;
    this.firstColliderIndices = this.stagingFirstColliderIndices;
    this.stagingFirstColliderIndices = int32;
    let uint32 = this.firstColliderGenerations;
    this.firstColliderGenerations = this.stagingFirstColliderGenerations;
    this.stagingFirstColliderGenerations = uint32;
    int32 = this.secondColliderIndices;
    this.secondColliderIndices = this.stagingSecondColliderIndices;
    this.stagingSecondColliderIndices = int32;
    uint32 = this.secondColliderGenerations;
    this.secondColliderGenerations = this.stagingSecondColliderGenerations;
    this.stagingSecondColliderGenerations = uint32;
    int32 = this.firstBodyIndices;
    this.firstBodyIndices = this.stagingFirstBodyIndices;
    this.stagingFirstBodyIndices = int32;
    uint32 = this.firstBodyGenerations;
    this.firstBodyGenerations = this.stagingFirstBodyGenerations;
    this.stagingFirstBodyGenerations = uint32;
    int32 = this.secondBodyIndices;
    this.secondBodyIndices = this.stagingSecondBodyIndices;
    this.stagingSecondBodyIndices = int32;
    uint32 = this.secondBodyGenerations;
    this.secondBodyGenerations = this.stagingSecondBodyGenerations;
    this.stagingSecondBodyGenerations = uint32;
    let uint8 = this.sensorFlags;
    this.sensorFlags = this.stagingSensorFlags;
    this.stagingSensorFlags = uint8;
    let float64 = this.mixedFriction;
    this.mixedFriction = this.stagingMixedFriction;
    this.stagingMixedFriction = float64;
    float64 = this.mixedRestitution;
    this.mixedRestitution = this.stagingMixedRestitution;
    this.stagingMixedRestitution = float64;
    float64 = this.normalX;
    this.normalX = this.stagingNormalX;
    this.stagingNormalX = float64;
    float64 = this.normalY;
    this.normalY = this.stagingNormalY;
    this.stagingNormalY = float64;
    int32 = this.firstLeafIndices;
    this.firstLeafIndices = this.stagingFirstLeafIndices;
    this.stagingFirstLeafIndices = int32;
    int32 = this.secondLeafIndices;
    this.secondLeafIndices = this.stagingSecondLeafIndices;
    this.stagingSecondLeafIndices = int32;
    uint8 = this.pointCounts;
    this.pointCounts = this.stagingPointCounts;
    this.stagingPointCounts = uint8;
    float64 = this.pointFirstX;
    this.pointFirstX = this.stagingPointFirstX;
    this.stagingPointFirstX = float64;
    float64 = this.pointFirstY;
    this.pointFirstY = this.stagingPointFirstY;
    this.stagingPointFirstY = float64;
    float64 = this.pointSecondX;
    this.pointSecondX = this.stagingPointSecondX;
    this.stagingPointSecondX = float64;
    float64 = this.pointSecondY;
    this.pointSecondY = this.stagingPointSecondY;
    this.stagingPointSecondY = float64;
    float64 = this.pointSeparations;
    this.pointSeparations = this.stagingPointSeparations;
    this.stagingPointSeparations = float64;
    int32 = this.pointFirstFeatures;
    this.pointFirstFeatures = this.stagingPointFirstFeatures;
    this.stagingPointFirstFeatures = int32;
    int32 = this.pointSecondFeatures;
    this.pointSecondFeatures = this.stagingPointSecondFeatures;
    this.stagingPointSecondFeatures = int32;
    float64 = this.pointNormalImpulses;
    this.pointNormalImpulses = this.stagingPointNormalImpulses;
    this.stagingPointNormalImpulses = float64;
    float64 = this.pointTangentImpulses;
    this.pointTangentImpulses = this.stagingPointTangentImpulses;
    this.stagingPointTangentImpulses = float64;
    this.contactCount = nextCount;
    this.eventCount = nextEventCount;
  }

  writeStagingContact(
    target: number,
    firstColliderIndex: number,
    firstColliderGeneration: number,
    secondColliderIndex: number,
    secondColliderGeneration: number,
    colliders: ColliderStore2D,
    manifold: PrivateManifold2D,
    oldContact: number,
  ): void {
    this.stagingFirstColliderIndices[target] = firstColliderIndex;
    this.stagingFirstColliderGenerations[target] = firstColliderGeneration;
    this.stagingSecondColliderIndices[target] = secondColliderIndex;
    this.stagingSecondColliderGenerations[target] = secondColliderGeneration;
    this.stagingFirstBodyIndices[target] = colliders.bodyIndices[firstColliderIndex]!;
    this.stagingFirstBodyGenerations[target] = colliders.bodyGenerations[firstColliderIndex]!;
    this.stagingSecondBodyIndices[target] = colliders.bodyIndices[secondColliderIndex]!;
    this.stagingSecondBodyGenerations[target] = colliders.bodyGenerations[secondColliderIndex]!;
    const sensor =
      ((colliders.flags[firstColliderIndex]! | colliders.flags[secondColliderIndex]!) & COLLIDER_SENSOR_2D) !== 0;
    this.stagingSensorFlags[target] = sensor ? 1 : 0;
    const firstFriction = materialNumberAt(
      colliders,
      firstColliderIndex,
      "friction",
      0.5,
    );
    const secondFriction = materialNumberAt(
      colliders,
      secondColliderIndex,
      "friction",
      0.5,
    );
    this.stagingMixedFriction[target] = Math.sqrt(
      firstFriction * secondFriction,
    );
    this.stagingMixedRestitution[target] = Math.max(
      materialNumberAt(colliders, firstColliderIndex, "restitution", 0),
      materialNumberAt(colliders, secondColliderIndex, "restitution", 0),
    );
    this.stagingNormalX[target] = manifold.normalX;
    this.stagingNormalY[target] = manifold.normalY;
    this.stagingFirstLeafIndices[target] = manifold.firstLeaf;
    this.stagingSecondLeafIndices[target] = manifold.secondLeaf;
    const pointCount = Math.min(POINTS_PER_CONTACT, manifold.points.length);
    this.stagingPointCounts[target] = pointCount;
    let firstPoint = 0;
    let secondPoint = 1;
    if (pointCount === 2 && compareManifoldPoints(manifold.points[0]!, manifold.points[1]!) > 0) {
      firstPoint = 1;
      secondPoint = 0;
    }
    for (let pointIndex = 0; pointIndex < POINTS_PER_CONTACT; pointIndex += 1) {
      const targetPoint = target * POINTS_PER_CONTACT + pointIndex;
      if (pointIndex >= pointCount) {
        clearStagingPoint(this, targetPoint);
        continue;
      }
      const sourcePoint = manifold.points[pointIndex === 0 ? firstPoint : secondPoint]!;
      this.stagingPointFirstX[targetPoint] = sourcePoint.firstX;
      this.stagingPointFirstY[targetPoint] = sourcePoint.firstY;
      this.stagingPointSecondX[targetPoint] = sourcePoint.secondX;
      this.stagingPointSecondY[targetPoint] = sourcePoint.secondY;
      this.stagingPointSeparations[targetPoint] = sourcePoint.separation;
      this.stagingPointFirstFeatures[targetPoint] = sourcePoint.firstFeature;
      this.stagingPointSecondFeatures[targetPoint] = sourcePoint.secondFeature;
      const oldPoint = oldContact < 0
        ? -1
        : this.findMatchingPoint(oldContact, manifold.firstLeaf, manifold.secondLeaf, sourcePoint.firstFeature, sourcePoint.secondFeature);
      this.stagingPointNormalImpulses[targetPoint] = oldPoint < 0 ? 0 : this.pointNormalImpulses[oldPoint]!;
      this.stagingPointTangentImpulses[targetPoint] = oldPoint < 0 ? 0 : this.pointTangentImpulses[oldPoint]!;
    }
  }

  private findMatchingPoint(
    oldContact: number,
    firstLeaf: number,
    secondLeaf: number,
    firstFeature: number,
    secondFeature: number,
  ): number {
    if (
      this.firstLeafIndices[oldContact] !== firstLeaf ||
      this.secondLeafIndices[oldContact] !== secondLeaf
    ) return -1;
    const base = oldContact * POINTS_PER_CONTACT;
    for (let point = 0; point < this.pointCounts[oldContact]!; point += 1) {
      const index = base + point;
      if (
        this.pointFirstFeatures[index] === firstFeature &&
        this.pointSecondFeatures[index] === secondFeature
      ) return index;
    }
    return -1;
  }
}

export function updateSortedContactCache2D(
  cache: ContactCache2D,
  pairs: SortedColliderPairs2D,
  colliders: ColliderStore2D,
  manifoldProvider: PrivateManifoldProvider2D,
): void {
  cache.ensureCapacity(cache.contactCount + pairs.pairCount);
  cache.ensureEventCapacity(cache.contactCount + pairs.pairCount);
  let oldContact = 0;
  let pair = 0;
  let nextContact = 0;
  let nextEvent = 0;

  while (oldContact < cache.contactCount || pair < pairs.pairCount) {
    let firstIndex: number;
    let firstGeneration: number;
    let secondIndex: number;
    let secondGeneration: number;
    let matchesOld = false;
    if (oldContact >= cache.contactCount) {
      firstIndex = pairs.pairFirstColliderIndices[pair]!;
      firstGeneration = pairs.pairFirstColliderGenerations[pair]!;
      secondIndex = pairs.pairSecondColliderIndices[pair]!;
      secondGeneration = pairs.pairSecondColliderGenerations[pair]!;
      pair += 1;
    } else if (pair >= pairs.pairCount) {
      firstIndex = cache.firstColliderIndices[oldContact]!;
      firstGeneration = cache.firstColliderGenerations[oldContact]!;
      secondIndex = cache.secondColliderIndices[oldContact]!;
      secondGeneration = cache.secondColliderGenerations[oldContact]!;
      matchesOld = true;
      oldContact += 1;
    } else {
      const comparison = compareContactToPair(
        cache,
        oldContact,
        pairs.pairFirstColliderIndices[pair]!,
        pairs.pairFirstColliderGenerations[pair]!,
        pairs.pairSecondColliderIndices[pair]!,
        pairs.pairSecondColliderGenerations[pair]!,
      );
      if (comparison <= 0) {
        firstIndex = cache.firstColliderIndices[oldContact]!;
        firstGeneration = cache.firstColliderGenerations[oldContact]!;
        secondIndex = cache.secondColliderIndices[oldContact]!;
        secondGeneration = cache.secondColliderGenerations[oldContact]!;
        matchesOld = true;
        oldContact += 1;
        if (comparison === 0) pair += 1;
      } else {
        firstIndex = pairs.pairFirstColliderIndices[pair]!;
        firstGeneration = pairs.pairFirstColliderGenerations[pair]!;
        secondIndex = pairs.pairSecondColliderIndices[pair]!;
        secondGeneration = pairs.pairSecondColliderGenerations[pair]!;
        pair += 1;
      }
    }
    const collidersLive =
      colliders.has(firstIndex, firstGeneration) &&
      colliders.has(secondIndex, secondGeneration);
    const sameBody =
      collidersLive &&
      colliders.bodyIndices[firstIndex] === colliders.bodyIndices[secondIndex] &&
      colliders.bodyGenerations[firstIndex] === colliders.bodyGenerations[secondIndex];
    const manifold = collidersLive && !sameBody
      ? manifoldProvider(firstIndex, secondIndex)
      : null;
    if (manifold !== null && manifold.points.length > 0) {
      const oldIndex = matchesOld ? oldContact - 1 : -1;
      const sensor =
        ((colliders.flags[firstIndex]! | colliders.flags[secondIndex]!) &
          COLLIDER_SENSOR_2D) !==
        0;
      const changesSensorState =
        oldIndex >= 0 && (cache.sensorFlags[oldIndex] !== 0) !== sensor;
      cache.writeStagingContact(
        nextContact,
        firstIndex,
        firstGeneration,
        secondIndex,
        secondGeneration,
        colliders,
        manifold,
        changesSensorState ? -1 : oldIndex,
      );
      if (changesSensorState) {
        nextEvent = writeEndEvent(cache, nextEvent, oldIndex);
        nextEvent = writeBeginEvent(cache, nextEvent, nextContact);
      } else if (!matchesOld) {
        nextEvent = writeBeginEvent(cache, nextEvent, nextContact);
      }
      nextContact += 1;
    } else if (matchesOld) {
      nextEvent = writeEndEvent(cache, nextEvent, oldContact - 1);
    }
  }
  cache.swapGenerations(nextContact, nextEvent);
}

function compareContactToPair(
  cache: ContactCache2D,
  contact: number,
  firstIndex: number,
  firstGeneration: number,
  secondIndex: number,
  secondGeneration: number,
): number {
  return (
    compareIdentity(cache.firstColliderIndices[contact]!, cache.firstColliderGenerations[contact]!, firstIndex, firstGeneration) ||
    compareIdentity(cache.secondColliderIndices[contact]!, cache.secondColliderGenerations[contact]!, secondIndex, secondGeneration)
  );
}

function compareIdentity(
  firstIndex: number,
  firstGeneration: number,
  secondIndex: number,
  secondGeneration: number,
): number {
  return firstIndex - secondIndex || firstGeneration - secondGeneration;
}

function writeBeginEvent(
  cache: ContactCache2D,
  event: number,
  stagingContact: number,
): number {
  cache.eventTypes[event] = cache.stagingSensorFlags[stagingContact] !== 0
    ? OVERLAP_EVENT_BEGIN_2D
    : CONTACT_EVENT_BEGIN_2D;
  cache.eventFirstColliderIndices[event] =
    cache.stagingFirstColliderIndices[stagingContact]!;
  cache.eventFirstColliderGenerations[event] =
    cache.stagingFirstColliderGenerations[stagingContact]!;
  cache.eventSecondColliderIndices[event] =
    cache.stagingSecondColliderIndices[stagingContact]!;
  cache.eventSecondColliderGenerations[event] =
    cache.stagingSecondColliderGenerations[stagingContact]!;
  return event + 1;
}

function writeEndEvent(cache: ContactCache2D, event: number, contact: number): number {
  cache.eventTypes[event] = cache.sensorFlags[contact] !== 0
    ? OVERLAP_EVENT_END_2D
    : CONTACT_EVENT_END_2D;
  cache.eventFirstColliderIndices[event] = cache.firstColliderIndices[contact]!;
  cache.eventFirstColliderGenerations[event] = cache.firstColliderGenerations[contact]!;
  cache.eventSecondColliderIndices[event] = cache.secondColliderIndices[contact]!;
  cache.eventSecondColliderGenerations[event] = cache.secondColliderGenerations[contact]!;
  return event + 1;
}

function materialNumberAt(
  colliders: ColliderStore2D,
  colliderIndex: number,
  property: "friction" | "restitution",
  fallback: number,
): number {
  const material = colliders.materials[colliderIndex] as Partial<{
    friction: number;
    restitution: number;
  }> | null;
  return material?.[property] ?? fallback;
}

function compareManifoldPoints(
  first: PrivateManifold2D["points"][number],
  second: PrivateManifold2D["points"][number],
): number {
  return (
    first.firstFeature - second.firstFeature ||
    first.secondFeature - second.secondFeature ||
    first.firstX - second.firstX ||
    first.firstY - second.firstY ||
    first.secondX - second.secondX ||
    first.secondY - second.secondY
  );
}

function clearStagingPoint(cache: ContactCache2D, point: number): void {
  cache.stagingPointFirstX[point] = 0;
  cache.stagingPointFirstY[point] = 0;
  cache.stagingPointSecondX[point] = 0;
  cache.stagingPointSecondY[point] = 0;
  cache.stagingPointSeparations[point] = 0;
  cache.stagingPointFirstFeatures[point] = 0;
  cache.stagingPointSecondFeatures[point] = 0;
  cache.stagingPointNormalImpulses[point] = 0;
  cache.stagingPointTangentImpulses[point] = 0;
}

function normalizedCapacity(initialCapacity: number): number {
  if (!Number.isInteger(initialCapacity) || initialCapacity < 1) {
    throw new RangeError("initialCapacity must be a positive integer.");
  }
  let capacity = 1;
  while (capacity < initialCapacity) capacity *= 2;
  return capacity;
}

function growInt32(source: Int32Array, capacity: number): Int32Array {
  const result = new Int32Array(capacity);
  result.set(source);
  return result;
}

function growUint32(source: Uint32Array, capacity: number): Uint32Array {
  const result = new Uint32Array(capacity);
  result.set(source);
  return result;
}

function growUint8(source: Uint8Array, capacity: number): Uint8Array {
  const result = new Uint8Array(capacity);
  result.set(source);
  return result;
}

function growFloat64(source: Float64Array, capacity: number): Float64Array {
  const result = new Float64Array(capacity);
  result.set(source);
  return result;
}
