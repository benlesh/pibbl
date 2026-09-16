import type {
  PrivateManifold3D,
  PrivateManifoldPoint3D,
} from "../collision/manifold.js";
import { manifoldBetweenShapeRecords3D } from "../collision/pairs.js";
import {
  composePose3D,
  rotateVectorInto,
  type InternalPose3D,
} from "../math.js";
import type { PhysicsOwnershipCounters3D } from "../runtime/ownership.js";
import {
  BODY_ENABLED_3D,
  BODY_TYPE_MASK_3D,
  COLLIDER_ENABLED_3D,
  COLLIDER_SENSOR_3D,
  type BodyStore3D,
  type ColliderStore3D,
} from "./storage.js";

export const CONTACT_EVENT_BEGIN_3D = 1;
export const CONTACT_EVENT_END_3D = 2;
export const OVERLAP_EVENT_BEGIN_3D = 3;
export const OVERLAP_EVENT_END_3D = 4;

const POINTS_PER_CONTACT = 4;
const NO_CONTACT = -1;

export interface SortedColliderPairs3D {
  readonly pairFirstColliderIndices: Int32Array;
  readonly pairFirstColliderGenerations: Uint32Array;
  readonly pairSecondColliderIndices: Int32Array;
  readonly pairSecondColliderGenerations: Uint32Array;
  readonly pairCount: number;
}

export type PrivateManifoldProvider3D = (
  firstColliderIndex: number,
  secondColliderIndex: number,
) => PrivateManifold3D | null;

export class ContactCache3D {
  contactCount = 0;
  eventCount = 0;

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
  normalZ: Float64Array;
  pointCounts: Uint8Array;
  pointFirstX: Float64Array;
  pointFirstY: Float64Array;
  pointFirstZ: Float64Array;
  pointSecondX: Float64Array;
  pointSecondY: Float64Array;
  pointSecondZ: Float64Array;
  pointSeparations: Float64Array;
  pointFirstFeatures: Int32Array;
  pointSecondFeatures: Int32Array;
  pointNormalImpulses: Float64Array;
  pointTangentImpulse1: Float64Array;
  pointTangentImpulse2: Float64Array;

  eventTypes: Uint8Array;
  eventFirstColliderIndices: Int32Array;
  eventFirstColliderGenerations: Uint32Array;
  eventSecondColliderIndices: Int32Array;
  eventSecondColliderGenerations: Uint32Array;

  private stagingFirstColliderIndices: Int32Array;
  private stagingFirstColliderGenerations: Uint32Array;
  private stagingSecondColliderIndices: Int32Array;
  private stagingSecondColliderGenerations: Uint32Array;
  private stagingFirstBodyIndices: Int32Array;
  private stagingFirstBodyGenerations: Uint32Array;
  private stagingSecondBodyIndices: Int32Array;
  private stagingSecondBodyGenerations: Uint32Array;
  private stagingSensorFlags: Uint8Array;
  private stagingMixedFriction: Float64Array;
  private stagingMixedRestitution: Float64Array;
  private stagingNormalX: Float64Array;
  private stagingNormalY: Float64Array;
  private stagingNormalZ: Float64Array;
  private stagingPointCounts: Uint8Array;
  private stagingPointFirstX: Float64Array;
  private stagingPointFirstY: Float64Array;
  private stagingPointFirstZ: Float64Array;
  private stagingPointSecondX: Float64Array;
  private stagingPointSecondY: Float64Array;
  private stagingPointSecondZ: Float64Array;
  private stagingPointSeparations: Float64Array;
  private stagingPointFirstFeatures: Int32Array;
  private stagingPointSecondFeatures: Int32Array;
  private stagingPointNormalImpulses: Float64Array;
  private stagingPointTangentImpulse1: Float64Array;
  private stagingPointTangentImpulse2: Float64Array;
  private readonly pointOrderScratch = new Int32Array(POINTS_PER_CONTACT);
  private disposed = false;

  constructor(
    readonly counters: PhysicsOwnershipCounters3D,
    initialCapacity = 4,
  ) {
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
    this.normalZ = new Float64Array(capacity);
    this.pointCounts = new Uint8Array(capacity);
    this.pointFirstX = new Float64Array(capacity * POINTS_PER_CONTACT);
    this.pointFirstY = new Float64Array(capacity * POINTS_PER_CONTACT);
    this.pointFirstZ = new Float64Array(capacity * POINTS_PER_CONTACT);
    this.pointSecondX = new Float64Array(capacity * POINTS_PER_CONTACT);
    this.pointSecondY = new Float64Array(capacity * POINTS_PER_CONTACT);
    this.pointSecondZ = new Float64Array(capacity * POINTS_PER_CONTACT);
    this.pointSeparations = new Float64Array(capacity * POINTS_PER_CONTACT);
    this.pointFirstFeatures = new Int32Array(capacity * POINTS_PER_CONTACT);
    this.pointSecondFeatures = new Int32Array(capacity * POINTS_PER_CONTACT);
    this.pointNormalImpulses = new Float64Array(capacity * POINTS_PER_CONTACT);
    this.pointTangentImpulse1 = new Float64Array(capacity * POINTS_PER_CONTACT);
    this.pointTangentImpulse2 = new Float64Array(capacity * POINTS_PER_CONTACT);

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
    this.stagingNormalZ = new Float64Array(capacity);
    this.stagingPointCounts = new Uint8Array(capacity);
    this.stagingPointFirstX = new Float64Array(capacity * POINTS_PER_CONTACT);
    this.stagingPointFirstY = new Float64Array(capacity * POINTS_PER_CONTACT);
    this.stagingPointFirstZ = new Float64Array(capacity * POINTS_PER_CONTACT);
    this.stagingPointSecondX = new Float64Array(capacity * POINTS_PER_CONTACT);
    this.stagingPointSecondY = new Float64Array(capacity * POINTS_PER_CONTACT);
    this.stagingPointSecondZ = new Float64Array(capacity * POINTS_PER_CONTACT);
    this.stagingPointSeparations = new Float64Array(
      capacity * POINTS_PER_CONTACT,
    );
    this.stagingPointFirstFeatures = new Int32Array(
      capacity * POINTS_PER_CONTACT,
    );
    this.stagingPointSecondFeatures = new Int32Array(
      capacity * POINTS_PER_CONTACT,
    );
    this.stagingPointNormalImpulses = new Float64Array(
      capacity * POINTS_PER_CONTACT,
    );
    this.stagingPointTangentImpulse1 = new Float64Array(
      capacity * POINTS_PER_CONTACT,
    );
    this.stagingPointTangentImpulse2 = new Float64Array(
      capacity * POINTS_PER_CONTACT,
    );

    const eventCapacity = capacity * 2;
    this.eventTypes = new Uint8Array(eventCapacity);
    this.eventFirstColliderIndices = new Int32Array(eventCapacity);
    this.eventFirstColliderGenerations = new Uint32Array(eventCapacity);
    this.eventSecondColliderIndices = new Int32Array(eventCapacity);
    this.eventSecondColliderGenerations = new Uint32Array(eventCapacity);
    counters.contactCacheAllocations += 1;
    counters.liveContactCaches += 1;
    counters.contactCapacity = capacity;
    counters.contactEventCapacity = eventCapacity;
  }

  ensureCapacity(required: number): void {
    this.assertUsable();
    if (required <= this.firstColliderIndices.length) return;
    const capacity = nextCapacity(this.firstColliderIndices.length, required);
    this.firstColliderIndices = growInt32(this.firstColliderIndices, capacity);
    this.firstColliderGenerations = growUint32(
      this.firstColliderGenerations,
      capacity,
    );
    this.secondColliderIndices = growInt32(
      this.secondColliderIndices,
      capacity,
    );
    this.secondColliderGenerations = growUint32(
      this.secondColliderGenerations,
      capacity,
    );
    this.firstBodyIndices = growInt32(this.firstBodyIndices, capacity);
    this.firstBodyGenerations = growUint32(this.firstBodyGenerations, capacity);
    this.secondBodyIndices = growInt32(this.secondBodyIndices, capacity);
    this.secondBodyGenerations = growUint32(
      this.secondBodyGenerations,
      capacity,
    );
    this.sensorFlags = growUint8(this.sensorFlags, capacity);
    this.mixedFriction = growFloat64(this.mixedFriction, capacity);
    this.mixedRestitution = growFloat64(this.mixedRestitution, capacity);
    this.normalX = growFloat64(this.normalX, capacity);
    this.normalY = growFloat64(this.normalY, capacity);
    this.normalZ = growFloat64(this.normalZ, capacity);
    this.pointCounts = growUint8(this.pointCounts, capacity);
    this.pointFirstX = growFloat64(
      this.pointFirstX,
      capacity * POINTS_PER_CONTACT,
    );
    this.pointFirstY = growFloat64(
      this.pointFirstY,
      capacity * POINTS_PER_CONTACT,
    );
    this.pointFirstZ = growFloat64(
      this.pointFirstZ,
      capacity * POINTS_PER_CONTACT,
    );
    this.pointSecondX = growFloat64(
      this.pointSecondX,
      capacity * POINTS_PER_CONTACT,
    );
    this.pointSecondY = growFloat64(
      this.pointSecondY,
      capacity * POINTS_PER_CONTACT,
    );
    this.pointSecondZ = growFloat64(
      this.pointSecondZ,
      capacity * POINTS_PER_CONTACT,
    );
    this.pointSeparations = growFloat64(
      this.pointSeparations,
      capacity * POINTS_PER_CONTACT,
    );
    this.pointFirstFeatures = growInt32(
      this.pointFirstFeatures,
      capacity * POINTS_PER_CONTACT,
    );
    this.pointSecondFeatures = growInt32(
      this.pointSecondFeatures,
      capacity * POINTS_PER_CONTACT,
    );
    this.pointNormalImpulses = growFloat64(
      this.pointNormalImpulses,
      capacity * POINTS_PER_CONTACT,
    );
    this.pointTangentImpulse1 = growFloat64(
      this.pointTangentImpulse1,
      capacity * POINTS_PER_CONTACT,
    );
    this.pointTangentImpulse2 = growFloat64(
      this.pointTangentImpulse2,
      capacity * POINTS_PER_CONTACT,
    );

    this.stagingFirstColliderIndices = growInt32(
      this.stagingFirstColliderIndices,
      capacity,
    );
    this.stagingFirstColliderGenerations = growUint32(
      this.stagingFirstColliderGenerations,
      capacity,
    );
    this.stagingSecondColliderIndices = growInt32(
      this.stagingSecondColliderIndices,
      capacity,
    );
    this.stagingSecondColliderGenerations = growUint32(
      this.stagingSecondColliderGenerations,
      capacity,
    );
    this.stagingFirstBodyIndices = growInt32(
      this.stagingFirstBodyIndices,
      capacity,
    );
    this.stagingFirstBodyGenerations = growUint32(
      this.stagingFirstBodyGenerations,
      capacity,
    );
    this.stagingSecondBodyIndices = growInt32(
      this.stagingSecondBodyIndices,
      capacity,
    );
    this.stagingSecondBodyGenerations = growUint32(
      this.stagingSecondBodyGenerations,
      capacity,
    );
    this.stagingSensorFlags = growUint8(this.stagingSensorFlags, capacity);
    this.stagingMixedFriction = growFloat64(
      this.stagingMixedFriction,
      capacity,
    );
    this.stagingMixedRestitution = growFloat64(
      this.stagingMixedRestitution,
      capacity,
    );
    this.stagingNormalX = growFloat64(this.stagingNormalX, capacity);
    this.stagingNormalY = growFloat64(this.stagingNormalY, capacity);
    this.stagingNormalZ = growFloat64(this.stagingNormalZ, capacity);
    this.stagingPointCounts = growUint8(this.stagingPointCounts, capacity);
    this.stagingPointFirstX = growFloat64(
      this.stagingPointFirstX,
      capacity * POINTS_PER_CONTACT,
    );
    this.stagingPointFirstY = growFloat64(
      this.stagingPointFirstY,
      capacity * POINTS_PER_CONTACT,
    );
    this.stagingPointFirstZ = growFloat64(
      this.stagingPointFirstZ,
      capacity * POINTS_PER_CONTACT,
    );
    this.stagingPointSecondX = growFloat64(
      this.stagingPointSecondX,
      capacity * POINTS_PER_CONTACT,
    );
    this.stagingPointSecondY = growFloat64(
      this.stagingPointSecondY,
      capacity * POINTS_PER_CONTACT,
    );
    this.stagingPointSecondZ = growFloat64(
      this.stagingPointSecondZ,
      capacity * POINTS_PER_CONTACT,
    );
    this.stagingPointSeparations = growFloat64(
      this.stagingPointSeparations,
      capacity * POINTS_PER_CONTACT,
    );
    this.stagingPointFirstFeatures = growInt32(
      this.stagingPointFirstFeatures,
      capacity * POINTS_PER_CONTACT,
    );
    this.stagingPointSecondFeatures = growInt32(
      this.stagingPointSecondFeatures,
      capacity * POINTS_PER_CONTACT,
    );
    this.stagingPointNormalImpulses = growFloat64(
      this.stagingPointNormalImpulses,
      capacity * POINTS_PER_CONTACT,
    );
    this.stagingPointTangentImpulse1 = growFloat64(
      this.stagingPointTangentImpulse1,
      capacity * POINTS_PER_CONTACT,
    );
    this.stagingPointTangentImpulse2 = growFloat64(
      this.stagingPointTangentImpulse2,
      capacity * POINTS_PER_CONTACT,
    );
    this.counters.contactCapacity = capacity;
    this.counters.contactCapacityGrowths += 1;
  }

  ensureEventCapacity(required: number): void {
    this.assertUsable();
    if (required <= this.eventTypes.length) return;
    const capacity = nextCapacity(this.eventTypes.length, required);
    this.eventTypes = growUint8(this.eventTypes, capacity);
    this.eventFirstColliderIndices = growInt32(
      this.eventFirstColliderIndices,
      capacity,
    );
    this.eventFirstColliderGenerations = growUint32(
      this.eventFirstColliderGenerations,
      capacity,
    );
    this.eventSecondColliderIndices = growInt32(
      this.eventSecondColliderIndices,
      capacity,
    );
    this.eventSecondColliderGenerations = growUint32(
      this.eventSecondColliderGenerations,
      capacity,
    );
    this.counters.contactEventCapacity = capacity;
    this.counters.contactEventCapacityGrowths += 1;
  }

  writeStagingContact(
    target: number,
    firstColliderIndex: number,
    firstColliderGeneration: number,
    secondColliderIndex: number,
    secondColliderGeneration: number,
    colliders: ColliderStore3D,
    manifold: PrivateManifold3D,
    oldContact: number,
  ): void {
    this.stagingFirstColliderIndices[target] = firstColliderIndex;
    this.stagingFirstColliderGenerations[target] = firstColliderGeneration;
    this.stagingSecondColliderIndices[target] = secondColliderIndex;
    this.stagingSecondColliderGenerations[target] = secondColliderGeneration;
    this.stagingFirstBodyIndices[target] =
      colliders.bodyIndices[firstColliderIndex]!;
    this.stagingFirstBodyGenerations[target] =
      colliders.bodyGenerations[firstColliderIndex]!;
    this.stagingSecondBodyIndices[target] =
      colliders.bodyIndices[secondColliderIndex]!;
    this.stagingSecondBodyGenerations[target] =
      colliders.bodyGenerations[secondColliderIndex]!;
    this.stagingSensorFlags[target] =
      ((colliders.flags[firstColliderIndex]! |
        colliders.flags[secondColliderIndex]!) &
        COLLIDER_SENSOR_3D) !==
      0
        ? 1
        : 0;
    this.stagingMixedFriction[target] = Math.sqrt(
      colliders.frictions[firstColliderIndex]! *
        colliders.frictions[secondColliderIndex]!,
    );
    this.stagingMixedRestitution[target] = Math.max(
      colliders.restitutions[firstColliderIndex]!,
      colliders.restitutions[secondColliderIndex]!,
    );
    this.stagingNormalX[target] = manifold.normalX;
    this.stagingNormalY[target] = manifold.normalY;
    this.stagingNormalZ[target] = manifold.normalZ;
    const pointCount = Math.min(POINTS_PER_CONTACT, manifold.points.length);
    for (let point = 0; point < pointCount; point += 1) {
      let insertion = point;
      while (
        insertion > 0 &&
        compareManifoldPoints(
          manifold.points[this.pointOrderScratch[insertion - 1]!]!,
          manifold.points[point]!,
        ) > 0
      ) {
        this.pointOrderScratch[insertion] =
          this.pointOrderScratch[insertion - 1]!;
        insertion -= 1;
      }
      this.pointOrderScratch[insertion] = point;
    }
    this.stagingPointCounts[target] = pointCount;
    for (
      let pointOffset = 0;
      pointOffset < POINTS_PER_CONTACT;
      pointOffset += 1
    ) {
      const targetPoint = target * POINTS_PER_CONTACT + pointOffset;
      if (pointOffset >= pointCount) {
        this.clearStagingPoint(targetPoint);
        continue;
      }
      const point = manifold.points[this.pointOrderScratch[pointOffset]!]!;
      this.stagingPointFirstX[targetPoint] = point.firstX;
      this.stagingPointFirstY[targetPoint] = point.firstY;
      this.stagingPointFirstZ[targetPoint] = point.firstZ;
      this.stagingPointSecondX[targetPoint] = point.secondX;
      this.stagingPointSecondY[targetPoint] = point.secondY;
      this.stagingPointSecondZ[targetPoint] = point.secondZ;
      this.stagingPointSeparations[targetPoint] = point.separation;
      this.stagingPointFirstFeatures[targetPoint] = point.firstFeature;
      this.stagingPointSecondFeatures[targetPoint] = point.secondFeature;
      const oldPoint =
        oldContact === NO_CONTACT
          ? NO_CONTACT
          : this.findMatchingPoint(
              oldContact,
              point.firstFeature,
              point.secondFeature,
            );
      this.stagingPointNormalImpulses[targetPoint] =
        oldPoint === NO_CONTACT ? 0 : this.pointNormalImpulses[oldPoint]!;
      this.stagingPointTangentImpulse1[targetPoint] =
        oldPoint === NO_CONTACT ? 0 : this.pointTangentImpulse1[oldPoint]!;
      this.stagingPointTangentImpulse2[targetPoint] =
        oldPoint === NO_CONTACT ? 0 : this.pointTangentImpulse2[oldPoint]!;
    }
  }

  swapGenerations(nextCount: number, nextEventCount: number): void {
    [this.firstColliderIndices, this.stagingFirstColliderIndices] = [
      this.stagingFirstColliderIndices,
      this.firstColliderIndices,
    ];
    [this.firstColliderGenerations, this.stagingFirstColliderGenerations] = [
      this.stagingFirstColliderGenerations,
      this.firstColliderGenerations,
    ];
    [this.secondColliderIndices, this.stagingSecondColliderIndices] = [
      this.stagingSecondColliderIndices,
      this.secondColliderIndices,
    ];
    [this.secondColliderGenerations, this.stagingSecondColliderGenerations] = [
      this.stagingSecondColliderGenerations,
      this.secondColliderGenerations,
    ];
    [this.firstBodyIndices, this.stagingFirstBodyIndices] = [
      this.stagingFirstBodyIndices,
      this.firstBodyIndices,
    ];
    [this.firstBodyGenerations, this.stagingFirstBodyGenerations] = [
      this.stagingFirstBodyGenerations,
      this.firstBodyGenerations,
    ];
    [this.secondBodyIndices, this.stagingSecondBodyIndices] = [
      this.stagingSecondBodyIndices,
      this.secondBodyIndices,
    ];
    [this.secondBodyGenerations, this.stagingSecondBodyGenerations] = [
      this.stagingSecondBodyGenerations,
      this.secondBodyGenerations,
    ];
    [this.sensorFlags, this.stagingSensorFlags] = [
      this.stagingSensorFlags,
      this.sensorFlags,
    ];
    [this.mixedFriction, this.stagingMixedFriction] = [
      this.stagingMixedFriction,
      this.mixedFriction,
    ];
    [this.mixedRestitution, this.stagingMixedRestitution] = [
      this.stagingMixedRestitution,
      this.mixedRestitution,
    ];
    [this.normalX, this.stagingNormalX] = [this.stagingNormalX, this.normalX];
    [this.normalY, this.stagingNormalY] = [this.stagingNormalY, this.normalY];
    [this.normalZ, this.stagingNormalZ] = [this.stagingNormalZ, this.normalZ];
    [this.pointCounts, this.stagingPointCounts] = [
      this.stagingPointCounts,
      this.pointCounts,
    ];
    [this.pointFirstX, this.stagingPointFirstX] = [
      this.stagingPointFirstX,
      this.pointFirstX,
    ];
    [this.pointFirstY, this.stagingPointFirstY] = [
      this.stagingPointFirstY,
      this.pointFirstY,
    ];
    [this.pointFirstZ, this.stagingPointFirstZ] = [
      this.stagingPointFirstZ,
      this.pointFirstZ,
    ];
    [this.pointSecondX, this.stagingPointSecondX] = [
      this.stagingPointSecondX,
      this.pointSecondX,
    ];
    [this.pointSecondY, this.stagingPointSecondY] = [
      this.stagingPointSecondY,
      this.pointSecondY,
    ];
    [this.pointSecondZ, this.stagingPointSecondZ] = [
      this.stagingPointSecondZ,
      this.pointSecondZ,
    ];
    [this.pointSeparations, this.stagingPointSeparations] = [
      this.stagingPointSeparations,
      this.pointSeparations,
    ];
    [this.pointFirstFeatures, this.stagingPointFirstFeatures] = [
      this.stagingPointFirstFeatures,
      this.pointFirstFeatures,
    ];
    [this.pointSecondFeatures, this.stagingPointSecondFeatures] = [
      this.stagingPointSecondFeatures,
      this.pointSecondFeatures,
    ];
    [this.pointNormalImpulses, this.stagingPointNormalImpulses] = [
      this.stagingPointNormalImpulses,
      this.pointNormalImpulses,
    ];
    [this.pointTangentImpulse1, this.stagingPointTangentImpulse1] = [
      this.stagingPointTangentImpulse1,
      this.pointTangentImpulse1,
    ];
    [this.pointTangentImpulse2, this.stagingPointTangentImpulse2] = [
      this.stagingPointTangentImpulse2,
      this.pointTangentImpulse2,
    ];
    this.contactCount = nextCount;
    this.eventCount = nextEventCount;
  }

  dispose(): void {
    if (this.disposed) return;
    this.counters.contactReleases += this.contactCount;
    this.counters.liveContacts -= this.contactCount;
    this.contactCount = 0;
    this.eventCount = 0;
    this.disposed = true;
    this.counters.contactCacheReleases += 1;
    this.counters.liveContactCaches -= 1;
  }

  private clearStagingPoint(index: number): void {
    this.stagingPointFirstX[index] = 0;
    this.stagingPointFirstY[index] = 0;
    this.stagingPointFirstZ[index] = 0;
    this.stagingPointSecondX[index] = 0;
    this.stagingPointSecondY[index] = 0;
    this.stagingPointSecondZ[index] = 0;
    this.stagingPointSeparations[index] = 0;
    this.stagingPointFirstFeatures[index] = 0;
    this.stagingPointSecondFeatures[index] = 0;
    this.stagingPointNormalImpulses[index] = 0;
    this.stagingPointTangentImpulse1[index] = 0;
    this.stagingPointTangentImpulse2[index] = 0;
  }

  private findMatchingPoint(
    contact: number,
    firstFeature: number,
    secondFeature: number,
  ): number {
    const base = contact * POINTS_PER_CONTACT;
    for (let offset = 0; offset < this.pointCounts[contact]!; offset += 1) {
      const point = base + offset;
      if (
        this.pointFirstFeatures[point] === firstFeature &&
        this.pointSecondFeatures[point] === secondFeature
      )
        return point;
    }
    return NO_CONTACT;
  }

  private assertUsable(): void {
    if (this.disposed) throw new Error("contact cache is disposed.");
  }
}

export function updateSortedContactCache3D(
  cache: ContactCache3D,
  pairs: SortedColliderPairs3D,
  bodies: BodyStore3D,
  colliders: ColliderStore3D,
  manifoldProvider: PrivateManifoldProvider3D,
  observeEvents = false,
): void {
  cache.ensureCapacity(cache.contactCount + pairs.pairCount);
  if (observeEvents)
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
    let matchedOld = false;
    let oldIndex = NO_CONTACT;
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
      matchedOld = true;
      oldIndex = oldContact;
      oldContact += 1;
    } else {
      const comparison = compareContactToPair(cache, oldContact, pairs, pair);
      if (comparison < 0) {
        firstIndex = cache.firstColliderIndices[oldContact]!;
        firstGeneration = cache.firstColliderGenerations[oldContact]!;
        secondIndex = cache.secondColliderIndices[oldContact]!;
        secondGeneration = cache.secondColliderGenerations[oldContact]!;
        matchedOld = true;
        oldIndex = oldContact;
        oldContact += 1;
      } else if (comparison > 0) {
        firstIndex = pairs.pairFirstColliderIndices[pair]!;
        firstGeneration = pairs.pairFirstColliderGenerations[pair]!;
        secondIndex = pairs.pairSecondColliderIndices[pair]!;
        secondGeneration = pairs.pairSecondColliderGenerations[pair]!;
        pair += 1;
      } else {
        firstIndex = cache.firstColliderIndices[oldContact]!;
        firstGeneration = cache.firstColliderGenerations[oldContact]!;
        secondIndex = cache.secondColliderIndices[oldContact]!;
        secondGeneration = cache.secondColliderGenerations[oldContact]!;
        matchedOld = true;
        oldIndex = oldContact;
        oldContact += 1;
        pair += 1;
      }
    }
    const accepted = acceptsPair(
      bodies,
      colliders,
      firstIndex,
      firstGeneration,
      secondIndex,
      secondGeneration,
    );
    const manifold = accepted
      ? manifoldProvider(firstIndex, secondIndex)
      : null;
    if (manifold !== null && manifold.points.length > 0) {
      cache.writeStagingContact(
        nextContact,
        firstIndex,
        firstGeneration,
        secondIndex,
        secondGeneration,
        colliders,
        manifold,
        oldIndex,
      );
      if (!matchedOld) {
        cache.counters.contactAllocations += 1;
        cache.counters.liveContacts += 1;
        if (observeEvents) {
          nextEvent = writeEvent(
            cache,
            nextEvent,
            isSensorPair(colliders, firstIndex, secondIndex)
              ? OVERLAP_EVENT_BEGIN_3D
              : CONTACT_EVENT_BEGIN_3D,
            firstIndex,
            firstGeneration,
            secondIndex,
            secondGeneration,
          );
        }
      }
      nextContact += 1;
    } else if (matchedOld) {
      cache.counters.contactReleases += 1;
      cache.counters.liveContacts -= 1;
      if (observeEvents) {
        nextEvent = writeEvent(
          cache,
          nextEvent,
          cache.sensorFlags[oldIndex] !== 0
            ? OVERLAP_EVENT_END_3D
            : CONTACT_EVENT_END_3D,
          firstIndex,
          firstGeneration,
          secondIndex,
          secondGeneration,
        );
      }
    }
  }
  cache.swapGenerations(nextContact, observeEvents ? nextEvent : 0);
}

export function manifoldBetweenStoredColliders3D(
  bodies: BodyStore3D,
  colliders: ColliderStore3D,
  firstColliderIndex: number,
  secondColliderIndex: number,
): PrivateManifold3D | null {
  const firstShape = colliders.shapes[firstColliderIndex];
  const secondShape = colliders.shapes[secondColliderIndex];
  if (firstShape === null || secondShape === null) return null;
  const firstPose = colliderWorldPose(bodies, colliders, firstColliderIndex);
  const secondPose = colliderWorldPose(bodies, colliders, secondColliderIndex);
  return manifoldBetweenShapeRecords3D(
    firstShape,
    firstPose,
    firstColliderIndex,
    secondShape,
    secondPose,
    secondColliderIndex,
  );
}

function colliderWorldPose(
  bodies: BodyStore3D,
  colliders: ColliderStore3D,
  colliderIndex: number,
): InternalPose3D {
  const body = colliders.bodyIndices[colliderIndex]!;
  const bodyOrientation = new Float64Array([
    bodies.orientationX[body]!,
    bodies.orientationY[body]!,
    bodies.orientationZ[body]!,
    bodies.orientationW[body]!,
  ]);
  const centerOffset = new Float64Array(3);
  rotateVectorInto(
    centerOffset,
    [
      bodies.localCenterX[body]!,
      bodies.localCenterY[body]!,
      bodies.localCenterZ[body]!,
    ],
    bodyOrientation,
  );
  const bodyPose: InternalPose3D = {
    position: new Float64Array([
      bodies.positionX[body]! - centerOffset[0]!,
      bodies.positionY[body]! - centerOffset[1]!,
      bodies.positionZ[body]! - centerOffset[2]!,
    ]),
    orientation: bodyOrientation,
  };
  return composePose3D(bodyPose, {
    position: new Float64Array([
      colliders.localPositionX[colliderIndex]!,
      colliders.localPositionY[colliderIndex]!,
      colliders.localPositionZ[colliderIndex]!,
    ]),
    orientation: new Float64Array([
      colliders.localOrientationX[colliderIndex]!,
      colliders.localOrientationY[colliderIndex]!,
      colliders.localOrientationZ[colliderIndex]!,
      colliders.localOrientationW[colliderIndex]!,
    ]),
  });
}

function acceptsPair(
  bodies: BodyStore3D,
  colliders: ColliderStore3D,
  firstIndex: number,
  firstGeneration: number,
  secondIndex: number,
  secondGeneration: number,
): boolean {
  if (
    !colliders.has(firstIndex, firstGeneration) ||
    !colliders.has(secondIndex, secondGeneration) ||
    (colliders.flags[firstIndex]! & COLLIDER_ENABLED_3D) === 0 ||
    (colliders.flags[secondIndex]! & COLLIDER_ENABLED_3D) === 0
  )
    return false;
  const firstBody = colliders.bodyIndices[firstIndex]!;
  const secondBody = colliders.bodyIndices[secondIndex]!;
  const firstBodyGeneration = colliders.bodyGenerations[firstIndex]!;
  const secondBodyGeneration = colliders.bodyGenerations[secondIndex]!;
  if (
    firstBody === secondBody ||
    !bodies.has(firstBody, firstBodyGeneration) ||
    !bodies.has(secondBody, secondBodyGeneration) ||
    (bodies.flags[firstBody]! & BODY_ENABLED_3D) === 0 ||
    (bodies.flags[secondBody]! & BODY_ENABLED_3D) === 0
  )
    return false;
  if (
    (bodies.flags[firstBody]! & BODY_TYPE_MASK_3D) === 0 &&
    (bodies.flags[secondBody]! & BODY_TYPE_MASK_3D) === 0
  )
    return false;
  const firstGroup = colliders.collisionGroup[firstIndex]!;
  const secondGroup = colliders.collisionGroup[secondIndex]!;
  if (firstGroup !== 0 && firstGroup === secondGroup) return firstGroup > 0;
  return (
    (colliders.collisionMasks[firstIndex]! &
      colliders.collisionCategories[secondIndex]!) !==
      0 &&
    (colliders.collisionMasks[secondIndex]! &
      colliders.collisionCategories[firstIndex]!) !==
      0
  );
}

function isSensorPair(
  colliders: ColliderStore3D,
  firstIndex: number,
  secondIndex: number,
): boolean {
  return (
    ((colliders.flags[firstIndex]! | colliders.flags[secondIndex]!) &
      COLLIDER_SENSOR_3D) !==
    0
  );
}

function writeEvent(
  cache: ContactCache3D,
  index: number,
  type: number,
  firstIndex: number,
  firstGeneration: number,
  secondIndex: number,
  secondGeneration: number,
): number {
  cache.eventTypes[index] = type;
  cache.eventFirstColliderIndices[index] = firstIndex;
  cache.eventFirstColliderGenerations[index] = firstGeneration;
  cache.eventSecondColliderIndices[index] = secondIndex;
  cache.eventSecondColliderGenerations[index] = secondGeneration;
  return index + 1;
}

function compareContactToPair(
  cache: ContactCache3D,
  contact: number,
  pairs: SortedColliderPairs3D,
  pair: number,
): number {
  return compareIdentity(
    cache.firstColliderIndices[contact]!,
    cache.firstColliderGenerations[contact]!,
    cache.secondColliderIndices[contact]!,
    cache.secondColliderGenerations[contact]!,
    pairs.pairFirstColliderIndices[pair]!,
    pairs.pairFirstColliderGenerations[pair]!,
    pairs.pairSecondColliderIndices[pair]!,
    pairs.pairSecondColliderGenerations[pair]!,
  );
}

function compareIdentity(
  firstIndexA: number,
  firstGenerationA: number,
  secondIndexA: number,
  secondGenerationA: number,
  firstIndexB: number,
  firstGenerationB: number,
  secondIndexB: number,
  secondGenerationB: number,
): number {
  return (
    firstIndexA - firstIndexB ||
    firstGenerationA - firstGenerationB ||
    secondIndexA - secondIndexB ||
    secondGenerationA - secondGenerationB
  );
}

function compareManifoldPoints(
  first: PrivateManifoldPoint3D,
  second: PrivateManifoldPoint3D,
): number {
  return (
    first.separation - second.separation ||
    first.firstFeature - second.firstFeature ||
    first.secondFeature - second.secondFeature
  );
}

function normalizedCapacity(initialCapacity: number): number {
  if (!Number.isInteger(initialCapacity) || initialCapacity < 1) {
    throw new RangeError("initialCapacity must be a positive integer.");
  }
  return nextCapacity(1, initialCapacity);
}

function nextCapacity(current: number, required: number): number {
  let capacity = current;
  while (capacity < required) capacity *= 2;
  return capacity;
}

function growFloat64(source: Float64Array, capacity: number): Float64Array {
  const result = new Float64Array(capacity);
  result.set(source);
  return result;
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
