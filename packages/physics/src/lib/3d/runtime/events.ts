import type {
  CRCPhysicsContactPoint3D,
  CRCPhysicsVector3,
} from "../../../3d-geometry.js";
import type {
  CRCPhysicsBodyHandle3D,
  CRCPhysicsBodyStateEvent3D,
  CRCPhysicsBodyStateHandler3D,
  CRCPhysicsColliderHandle3D,
  CRCPhysicsCollisionEvent3D,
  CRCPhysicsCollisionHandler3D,
  CRCPhysicsOverlapEvent3D,
  CRCPhysicsOverlapHandler3D,
} from "../types.js";
import type { PhysicsWorld3DController } from "./controller.js";

export interface PhysicsColliderHandleIdentity3D {
  readonly controller: PhysicsWorld3DController;
  readonly index: number;
  readonly generation: number;
}

export interface PhysicsContactEventDelivery3D {
  readonly kind: 1 | 2 | 3 | 4 | 7;
  readonly tick: number;
  readonly firstColliderIndex: number;
  readonly firstColliderGeneration: number;
  readonly secondColliderIndex: number;
  readonly secondColliderGeneration: number;
  readonly firstBodyIndex: number;
  readonly firstBodyGeneration: number;
  readonly secondBodyIndex: number;
  readonly secondBodyGeneration: number;
  readonly receiver: "first" | "second";
  readonly receiverColliderId: number;
  readonly receiverBodyId: number;
  readonly handler: CRCPhysicsCollisionHandler3D | CRCPhysicsOverlapHandler3D;
  readonly selfTag: unknown;
  readonly otherTag: unknown;
  readonly normalX: number;
  readonly normalY: number;
  readonly normalZ: number;
  readonly points: readonly Readonly<{
    readonly firstX: number;
    readonly firstY: number;
    readonly firstZ: number;
    readonly secondX: number;
    readonly secondY: number;
    readonly secondZ: number;
    readonly separation: number;
  }>[];
  readonly totalNormalImpulse: number;
}

export interface PhysicsBodyEventDelivery3D {
  readonly kind: 5 | 6;
  readonly tick: number;
  readonly bodyIndex: number;
  readonly bodyGeneration: number;
  readonly bodyId: number;
  readonly handler: CRCPhysicsBodyStateHandler3D;
}

export type PhysicsEventDelivery3D =
  PhysicsContactEventDelivery3D | PhysicsBodyEventDelivery3D;

export function isPhysicsBodyEventDelivery3D(
  delivery: PhysicsEventDelivery3D,
): delivery is PhysicsBodyEventDelivery3D {
  return delivery.kind === 5 || delivery.kind === 6;
}

export interface PhysicsEventHandles3D {
  readonly body: (index: number, generation: number) => CRCPhysicsBodyHandle3D;
  readonly collider: (
    index: number,
    generation: number,
  ) => CRCPhysicsColliderHandle3D;
}

const colliderHandleIdentities = new WeakMap<
  object,
  PhysicsColliderHandleIdentity3D
>();
let publicEventRecordMaterializations = 0;

export function createPhysicsColliderHandle3D(
  controller: PhysicsWorld3DController,
  index: number,
  generation: number,
): CRCPhysicsColliderHandle3D {
  const handle = Object.freeze({}) as CRCPhysicsColliderHandle3D;
  colliderHandleIdentities.set(
    handle as object,
    Object.freeze({ controller, index, generation }),
  );
  return handle;
}

export function physicsColliderHandleIdentity3D(
  handle: CRCPhysicsColliderHandle3D,
): PhysicsColliderHandleIdentity3D | undefined {
  return typeof handle === "object" && handle !== null
    ? colliderHandleIdentities.get(handle as object)
    : undefined;
}

export function sortPhysicsEventDeliveries3D(
  deliveries: PhysicsEventDelivery3D[],
): readonly PhysicsEventDelivery3D[] {
  deliveries.sort(compareDeliveries);
  return Object.freeze(deliveries);
}

export function materializePhysicsContactEvent3D(
  fact: PhysicsContactEventDelivery3D,
  handles: PhysicsEventHandles3D,
): CRCPhysicsCollisionEvent3D | CRCPhysicsOverlapEvent3D {
  publicEventRecordMaterializations += 1;
  const firstReceiver = fact.receiver === "first";
  const selfBody = handles.body(
    firstReceiver ? fact.firstBodyIndex : fact.secondBodyIndex,
    firstReceiver ? fact.firstBodyGeneration : fact.secondBodyGeneration,
  );
  const otherBody = handles.body(
    firstReceiver ? fact.secondBodyIndex : fact.firstBodyIndex,
    firstReceiver ? fact.secondBodyGeneration : fact.firstBodyGeneration,
  );
  const selfCollider = handles.collider(
    firstReceiver ? fact.firstColliderIndex : fact.secondColliderIndex,
    firstReceiver
      ? fact.firstColliderGeneration
      : fact.secondColliderGeneration,
  );
  const otherCollider = handles.collider(
    firstReceiver ? fact.secondColliderIndex : fact.firstColliderIndex,
    firstReceiver
      ? fact.secondColliderGeneration
      : fact.firstColliderGeneration,
  );
  if (fact.kind === 3 || fact.kind === 4) {
    return Object.freeze({
      selfBody,
      selfCollider,
      otherBody,
      otherCollider,
      tick: fact.tick,
      selfTag: fact.selfTag,
      otherTag: fact.otherTag,
    });
  }
  const points = Object.freeze(
    fact.points.map((point): CRCPhysicsContactPoint3D =>
      Object.freeze({
        pointOnFirst: freezeVector(
          firstReceiver ? point.firstX : point.secondX,
          firstReceiver ? point.firstY : point.secondY,
          firstReceiver ? point.firstZ : point.secondZ,
        ),
        pointOnSecond: freezeVector(
          firstReceiver ? point.secondX : point.firstX,
          firstReceiver ? point.secondY : point.firstY,
          firstReceiver ? point.secondZ : point.firstZ,
        ),
        separation: point.separation,
      }),
    ),
  );
  return Object.freeze({
    selfBody,
    selfCollider,
    otherBody,
    otherCollider,
    normal: freezeVector(
      firstReceiver ? fact.normalX : -fact.normalX,
      firstReceiver ? fact.normalY : -fact.normalY,
      firstReceiver ? fact.normalZ : -fact.normalZ,
    ),
    points,
    totalNormalImpulse: fact.totalNormalImpulse,
    tick: fact.tick,
    selfTag: fact.selfTag,
    otherTag: fact.otherTag,
  });
}

export function materializePhysicsBodyEvent3D(
  fact: PhysicsBodyEventDelivery3D,
  body: CRCPhysicsBodyHandle3D,
): CRCPhysicsBodyStateEvent3D {
  publicEventRecordMaterializations += 1;
  return Object.freeze({
    body,
    sleeping: fact.kind === 6,
    tick: fact.tick,
  });
}

export function snapshotPhysicsEventMaterializationsForTest(): number {
  return publicEventRecordMaterializations;
}

export function resetPhysicsEventMaterializationsForTest(): void {
  publicEventRecordMaterializations = 0;
}

function compareDeliveries(
  first: PhysicsEventDelivery3D,
  second: PhysicsEventDelivery3D,
): number {
  return (
    first.tick - second.tick ||
    semanticOrdinal(first.kind) - semanticOrdinal(second.kind) ||
    firstPairIndex(first) - firstPairIndex(second) ||
    firstPairGeneration(first) - firstPairGeneration(second) ||
    secondPairIndex(first) - secondPairIndex(second) ||
    secondPairGeneration(first) - secondPairGeneration(second) ||
    receiverIndex(first) - receiverIndex(second) ||
    receiverGeneration(first) - receiverGeneration(second)
  );
}

function semanticOrdinal(kind: PhysicsEventDelivery3D["kind"]): number {
  switch (kind) {
    case 1:
      return 0;
    case 7:
      return 1;
    case 2:
      return 2;
    case 3:
      return 3;
    case 4:
      return 4;
    case 5:
      return 5;
    case 6:
      return 6;
  }
}

function firstPairIndex(delivery: PhysicsEventDelivery3D): number {
  return isPhysicsBodyEventDelivery3D(delivery)
    ? delivery.bodyIndex
    : delivery.firstColliderIndex;
}

function firstPairGeneration(delivery: PhysicsEventDelivery3D): number {
  return isPhysicsBodyEventDelivery3D(delivery)
    ? delivery.bodyGeneration
    : delivery.firstColliderGeneration;
}

function secondPairIndex(delivery: PhysicsEventDelivery3D): number {
  return isPhysicsBodyEventDelivery3D(delivery)
    ? -1
    : delivery.secondColliderIndex;
}

function secondPairGeneration(delivery: PhysicsEventDelivery3D): number {
  return isPhysicsBodyEventDelivery3D(delivery)
    ? 0
    : delivery.secondColliderGeneration;
}

function receiverIndex(delivery: PhysicsEventDelivery3D): number {
  if (isPhysicsBodyEventDelivery3D(delivery)) return delivery.bodyIndex;
  return delivery.receiver === "first"
    ? delivery.firstColliderIndex
    : delivery.secondColliderIndex;
}

function receiverGeneration(delivery: PhysicsEventDelivery3D): number {
  if (isPhysicsBodyEventDelivery3D(delivery)) return delivery.bodyGeneration;
  return delivery.receiver === "first"
    ? delivery.firstColliderGeneration
    : delivery.secondColliderGeneration;
}

function freezeVector(x: number, y: number, z: number): CRCPhysicsVector3 {
  return Object.freeze([
    Object.is(x, -0) ? 0 : x,
    Object.is(y, -0) ? 0 : y,
    Object.is(z, -0) ? 0 : z,
  ] as const);
}
