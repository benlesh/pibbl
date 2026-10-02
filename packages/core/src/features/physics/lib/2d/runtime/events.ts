import type {
  CRCPhysicsContactPoint2D,
  CRCPhysicsVector2,
} from "../../../2d-geometry.js";
import type {
  CRCPhysicsBodyHandle2D,
  CRCPhysicsBodyStateEvent2D,
  CRCPhysicsBodyStateHandler2D,
  CRCPhysicsColliderHandle2D,
  CRCPhysicsCollisionEvent2D,
  CRCPhysicsCollisionHandler2D,
  CRCPhysicsOverlapEvent2D,
  CRCPhysicsOverlapHandler2D,
} from "../types.js";
import type { PhysicsWorld2DController } from "./controller.js";

export interface PhysicsColliderHandleIdentity2D {
  readonly controller: PhysicsWorld2DController;
  readonly index: number;
  readonly generation: number;
}

export interface PhysicsContactEventDelivery2D {
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
  readonly handler: CRCPhysicsCollisionHandler2D | CRCPhysicsOverlapHandler2D;
  readonly selfTag: unknown;
  readonly otherTag: unknown;
  readonly normalX: number;
  readonly normalY: number;
  readonly points: readonly Readonly<{
    readonly firstX: number;
    readonly firstY: number;
    readonly secondX: number;
    readonly secondY: number;
    readonly separation: number;
  }>[];
  readonly totalNormalImpulse: number;
}

export interface PhysicsBodyEventDelivery2D {
  readonly kind: 5 | 6;
  readonly tick: number;
  readonly bodyIndex: number;
  readonly bodyGeneration: number;
  readonly bodyId: number;
  readonly handler: CRCPhysicsBodyStateHandler2D;
}

export type PhysicsEventDelivery2D =
  PhysicsContactEventDelivery2D | PhysicsBodyEventDelivery2D;

export function isPhysicsBodyEventDelivery2D(
  delivery: PhysicsEventDelivery2D,
): delivery is PhysicsBodyEventDelivery2D {
  return delivery.kind === 5 || delivery.kind === 6;
}

export interface PhysicsEventHandles2D {
  readonly body: (index: number, generation: number) => CRCPhysicsBodyHandle2D;
  readonly collider: (
    index: number,
    generation: number,
  ) => CRCPhysicsColliderHandle2D;
}

const colliderHandleIdentities = new WeakMap<
  object,
  PhysicsColliderHandleIdentity2D
>();
let publicEventRecordMaterializations = 0;

export function createPhysicsColliderHandle2D(
  controller: PhysicsWorld2DController,
  index: number,
  generation: number,
): CRCPhysicsColliderHandle2D {
  const handle = Object.freeze({}) as CRCPhysicsColliderHandle2D;
  colliderHandleIdentities.set(
    handle as object,
    Object.freeze({ controller, index, generation }),
  );
  return handle;
}

export function physicsColliderHandleIdentity2D(
  handle: CRCPhysicsColliderHandle2D,
): PhysicsColliderHandleIdentity2D | undefined {
  return typeof handle === "object" && handle !== null
    ? colliderHandleIdentities.get(handle as object)
    : undefined;
}

export function sortPhysicsEventDeliveries2D(
  deliveries: PhysicsEventDelivery2D[],
): readonly PhysicsEventDelivery2D[] {
  deliveries.sort(compareDeliveries);
  return Object.freeze(deliveries);
}

export function materializePhysicsContactEvent2D(
  fact: PhysicsContactEventDelivery2D,
  handles: PhysicsEventHandles2D,
): CRCPhysicsCollisionEvent2D | CRCPhysicsOverlapEvent2D {
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
    fact.points.map((point): CRCPhysicsContactPoint2D =>
      Object.freeze({
        pointOnFirst: freezeVector(
          firstReceiver ? point.firstX : point.secondX,
          firstReceiver ? point.firstY : point.secondY,
        ),
        pointOnSecond: freezeVector(
          firstReceiver ? point.secondX : point.firstX,
          firstReceiver ? point.secondY : point.firstY,
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
    ),
    points,
    totalNormalImpulse: fact.totalNormalImpulse,
    tick: fact.tick,
    selfTag: fact.selfTag,
    otherTag: fact.otherTag,
  });
}

export function materializePhysicsBodyEvent2D(
  fact: PhysicsBodyEventDelivery2D,
  body: CRCPhysicsBodyHandle2D,
): CRCPhysicsBodyStateEvent2D {
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
  first: PhysicsEventDelivery2D,
  second: PhysicsEventDelivery2D,
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

function semanticOrdinal(kind: PhysicsEventDelivery2D["kind"]): number {
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

function firstPairIndex(delivery: PhysicsEventDelivery2D): number {
  return isPhysicsBodyEventDelivery2D(delivery)
    ? delivery.bodyIndex
    : delivery.firstColliderIndex;
}

function firstPairGeneration(delivery: PhysicsEventDelivery2D): number {
  return isPhysicsBodyEventDelivery2D(delivery)
    ? delivery.bodyGeneration
    : delivery.firstColliderGeneration;
}

function secondPairIndex(delivery: PhysicsEventDelivery2D): number {
  return isPhysicsBodyEventDelivery2D(delivery)
    ? -1
    : delivery.secondColliderIndex;
}

function secondPairGeneration(delivery: PhysicsEventDelivery2D): number {
  return isPhysicsBodyEventDelivery2D(delivery)
    ? 0
    : delivery.secondColliderGeneration;
}

function receiverIndex(delivery: PhysicsEventDelivery2D): number {
  if (isPhysicsBodyEventDelivery2D(delivery)) return delivery.bodyIndex;
  return delivery.receiver === "first"
    ? delivery.firstColliderIndex
    : delivery.secondColliderIndex;
}

function receiverGeneration(delivery: PhysicsEventDelivery2D): number {
  if (isPhysicsBodyEventDelivery2D(delivery)) return delivery.bodyGeneration;
  return delivery.receiver === "first"
    ? delivery.firstColliderGeneration
    : delivery.secondColliderGeneration;
}

function freezeVector(x: number, y: number): CRCPhysicsVector2 {
  return Object.freeze([
    Object.is(x, -0) ? 0 : x,
    Object.is(y, -0) ? 0 : y,
  ] as const);
}
