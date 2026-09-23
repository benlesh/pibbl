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
  private stagingEventTypes: Uint8Array;
  private stagingEventFirstColliderIndices: Int32Array;
  private stagingEventFirstColliderGenerations: Uint32Array;
  private stagingEventSecondColliderIndices: Int32Array;
  private stagingEventSecondColliderGenerations: Uint32Array;
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
    this.stagingEventTypes = new Uint8Array(eventCapacity);
    this.stagingEventFirstColliderIndices = new Int32Array(eventCapacity);
    this.stagingEventFirstColliderGenerations = new Uint32Array(eventCapacity);
    this.stagingEventSecondColliderIndices = new Int32Array(eventCapacity);
    this.stagingEventSecondColliderGenerations = new Uint32Array(eventCapacity);
    counters.contactCacheAllocations += 1;
    counters.liveContactCaches += 1;
    counters.contactCapacity = capacity;
    counters.contactEventCapacity = eventCapacity;
  }

  ensureStagingCapacity(required: number): void {
    this.assertUsable();
    const requiredCapacity = Math.max(
      this.firstColliderIndices.length,
      required,
    );
    if (requiredCapacity <= this.stagingFirstColliderIndices.length) return;
    const capacity = nextCapacity(
      this.stagingFirstColliderIndices.length,
      requiredCapacity,
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
  }

  ensureStagingEventCapacity(required: number): void {
    this.assertUsable();
    const requiredCapacity = Math.max(this.eventTypes.length, required);
    if (requiredCapacity <= this.stagingEventTypes.length) return;
    const capacity = nextCapacity(
      this.stagingEventTypes.length,
      requiredCapacity,
    );
    this.stagingEventTypes = growUint8(this.stagingEventTypes, capacity);
    this.stagingEventFirstColliderIndices = growInt32(
      this.stagingEventFirstColliderIndices,
      capacity,
    );
    this.stagingEventFirstColliderGenerations = growUint32(
      this.stagingEventFirstColliderGenerations,
      capacity,
    );
    this.stagingEventSecondColliderIndices = growInt32(
      this.stagingEventSecondColliderIndices,
      capacity,
    );
    this.stagingEventSecondColliderGenerations = growUint32(
      this.stagingEventSecondColliderGenerations,
      capacity,
    );
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
    const previousContactCapacity = this.firstColliderIndices.length;
    const nextContactCapacity = this.stagingFirstColliderIndices.length;
    const previousEventCapacity = this.eventTypes.length;
    const nextEventCapacity = this.stagingEventTypes.length;
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
    float64 = this.normalZ;
    this.normalZ = this.stagingNormalZ;
    this.stagingNormalZ = float64;
    uint8 = this.pointCounts;
    this.pointCounts = this.stagingPointCounts;
    this.stagingPointCounts = uint8;
    float64 = this.pointFirstX;
    this.pointFirstX = this.stagingPointFirstX;
    this.stagingPointFirstX = float64;
    float64 = this.pointFirstY;
    this.pointFirstY = this.stagingPointFirstY;
    this.stagingPointFirstY = float64;
    float64 = this.pointFirstZ;
    this.pointFirstZ = this.stagingPointFirstZ;
    this.stagingPointFirstZ = float64;
    float64 = this.pointSecondX;
    this.pointSecondX = this.stagingPointSecondX;
    this.stagingPointSecondX = float64;
    float64 = this.pointSecondY;
    this.pointSecondY = this.stagingPointSecondY;
    this.stagingPointSecondY = float64;
    float64 = this.pointSecondZ;
    this.pointSecondZ = this.stagingPointSecondZ;
    this.stagingPointSecondZ = float64;
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
    float64 = this.pointTangentImpulse1;
    this.pointTangentImpulse1 = this.stagingPointTangentImpulse1;
    this.stagingPointTangentImpulse1 = float64;
    float64 = this.pointTangentImpulse2;
    this.pointTangentImpulse2 = this.stagingPointTangentImpulse2;
    this.stagingPointTangentImpulse2 = float64;
    uint8 = this.eventTypes;
    this.eventTypes = this.stagingEventTypes;
    this.stagingEventTypes = uint8;
    int32 = this.eventFirstColliderIndices;
    this.eventFirstColliderIndices = this.stagingEventFirstColliderIndices;
    this.stagingEventFirstColliderIndices = int32;
    uint32 = this.eventFirstColliderGenerations;
    this.eventFirstColliderGenerations =
      this.stagingEventFirstColliderGenerations;
    this.stagingEventFirstColliderGenerations = uint32;
    int32 = this.eventSecondColliderIndices;
    this.eventSecondColliderIndices = this.stagingEventSecondColliderIndices;
    this.stagingEventSecondColliderIndices = int32;
    uint32 = this.eventSecondColliderGenerations;
    this.eventSecondColliderGenerations =
      this.stagingEventSecondColliderGenerations;
    this.stagingEventSecondColliderGenerations = uint32;
    this.contactCount = nextCount;
    this.eventCount = nextEventCount;
    this.counters.contactCapacity = nextContactCapacity;
    this.counters.contactEventCapacity = nextEventCapacity;
    if (nextContactCapacity > previousContactCapacity) {
      this.counters.contactCapacityGrowths += 1;
    }
    if (nextEventCapacity > previousEventCapacity) {
      this.counters.contactEventCapacityGrowths += 1;
    }
  }

  writeStagingEvent(
    index: number,
    type: number,
    firstColliderIndex: number,
    firstColliderGeneration: number,
    secondColliderIndex: number,
    secondColliderGeneration: number,
  ): number {
    this.stagingEventTypes[index] = type;
    this.stagingEventFirstColliderIndices[index] = firstColliderIndex;
    this.stagingEventFirstColliderGenerations[index] = firstColliderGeneration;
    this.stagingEventSecondColliderIndices[index] = secondColliderIndex;
    this.stagingEventSecondColliderGenerations[index] =
      secondColliderGeneration;
    return index + 1;
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
  const requiredCapacity = cache.contactCount + pairs.pairCount;
  cache.ensureStagingCapacity(requiredCapacity);
  cache.ensureStagingEventCapacity(observeEvents ? requiredCapacity : 0);
  let oldContact = 0;
  let pair = 0;
  let nextContact = 0;
  let nextEvent = 0;
  let contactAllocations = 0;
  let contactReleases = 0;
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
      const sensor = isSensorPair(colliders, firstIndex, secondIndex);
      const changesSensorState =
        oldIndex !== NO_CONTACT &&
        (cache.sensorFlags[oldIndex] !== 0) !== sensor;
      cache.writeStagingContact(
        nextContact,
        firstIndex,
        firstGeneration,
        secondIndex,
        secondGeneration,
        colliders,
        manifold,
        changesSensorState ? NO_CONTACT : oldIndex,
      );
      if (changesSensorState) {
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
          nextEvent = writeEvent(
            cache,
            nextEvent,
            sensor ? OVERLAP_EVENT_BEGIN_3D : CONTACT_EVENT_BEGIN_3D,
            firstIndex,
            firstGeneration,
            secondIndex,
            secondGeneration,
          );
        }
      } else if (!matchedOld) {
        contactAllocations += 1;
        if (observeEvents) {
          nextEvent = writeEvent(
            cache,
            nextEvent,
            sensor ? OVERLAP_EVENT_BEGIN_3D : CONTACT_EVENT_BEGIN_3D,
            firstIndex,
            firstGeneration,
            secondIndex,
            secondGeneration,
          );
        }
      }
      nextContact += 1;
    } else if (matchedOld) {
      contactReleases += 1;
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
  cache.counters.contactAllocations += contactAllocations;
  cache.counters.contactReleases += contactReleases;
  cache.counters.liveContacts += contactAllocations - contactReleases;
  cache.counters.contactEventFactWrites += observeEvents ? nextEvent : 0;
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
  return cache.writeStagingEvent(
    index,
    type,
    firstIndex,
    firstGeneration,
    secondIndex,
    secondGeneration,
  );
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
