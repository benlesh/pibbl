import {
  boundsOfShape3D,
  type CRCPhysicsPose3D,
  type CRCPhysicsQuaternion,
  type CRCPhysicsVector3,
} from "../../../3d-geometry.js";
import {
  manifoldResultBetweenShapeRecords3D,
  type PrivateManifoldResult3D,
} from "../collision/pairs.js";
import {
  composePose3D,
  copyCanonicalQuaternion,
  copyFiniteVector3,
  rotateVectorInto,
  type InternalPose3D,
} from "../math.js";
import { isConcaveShapeRecord3D, shapeForRecord3D } from "../shape-records.js";
import { createPhysicsOwnershipCounters3D } from "../runtime/ownership.js";
import { recordPhysicsWorld3DTrace } from "../runtime/trace.js";
import { DynamicAabbBroadPhase3D } from "./broad-phase.js";
import { BoundedCcd3D, collisionFiltersAllow3D } from "./ccd.js";
import {
  CONTACT_EVENT_END_3D,
  OVERLAP_EVENT_END_3D,
  ContactCache3D,
  updateSortedContactCache3D,
} from "./contact-cache.js";
import {
  applyForceAtPointToCandidateBody3D,
  applyImpulseAtPointToCandidateBody3D,
  applyTorqueToCandidateBody3D,
  integrateCandidateBodies3D,
} from "./integrator.js";
import { BODY_SLEEPING_3D, SequentialImpulseSolver3D } from "./solver.js";
import {
  BODY_ENABLED_3D,
  BODY_TYPE_DYNAMIC_3D,
  BODY_TYPE_KINEMATIC_3D,
  BODY_TYPE_MASK_3D,
  COLLIDER_ENABLED_3D,
  COLLIDER_SENSOR_3D,
  BodyStore3D,
  ColliderStore3D,
  type BodyDefinition3D,
  type ColliderDefinition3D,
} from "./storage.js";

const NO_INDEX = -1;
const POINTS_PER_CONTACT = 4;
const DEFAULT_FIXED_STEP_MILLISECONDS = 1000 / 60;
const DEFAULT_MAX_CATCH_UP_STEPS = 4;
const DEFAULT_VELOCITY_ITERATIONS = 8;
const DEFAULT_POSITION_ITERATIONS = 3;
const MAX_CATCH_UP_STEPS = 16;
const MAX_SOLVER_ITERATIONS = 32;
const DEGREES_TO_RADIANS = Math.PI / 180;

export type PhysicsPose3D = CRCPhysicsPose3D;

export interface PhysicsWorld3DConfiguration {
  readonly gravity?: CRCPhysicsVector3;
  readonly fixedStepMilliseconds?: number;
  readonly maxCatchUpSteps?: number;
  readonly interpolation?: "linear" | "none";
  readonly sleeping?: boolean;
  readonly solver?: Readonly<{
    readonly velocityIterations?: number;
    readonly positionIterations?: number;
  }>;
  /** @internal Accepts an already flattened normalized configuration. */
  readonly velocityIterations?: number;
  /** @internal Accepts an already flattened normalized configuration. */
  readonly positionIterations?: number;
}

export interface NormalizedPhysicsWorld3DConfiguration {
  readonly gravityX: number;
  readonly gravityY: number;
  readonly gravityZ: number;
  readonly fixedStepMilliseconds: number;
  readonly maxCatchUpSteps: number;
  readonly interpolation: "linear" | "none";
  readonly sleeping: boolean;
  readonly velocityIterations: number;
  readonly positionIterations: number;
}

export interface PhysicsBodyTopologyRecord3D {
  readonly kind: "body";
  readonly id: number;
  readonly definition: BodyDefinition3D;
}

export interface PhysicsColliderTopologyRecord3D {
  readonly kind: "collider";
  readonly id: number;
  readonly bodyId: number;
  readonly definition: Omit<
    ColliderDefinition3D,
    "bodyIndex" | "bodyGeneration"
  >;
}

export type PhysicsTopologyRecord3D =
  PhysicsBodyTopologyRecord3D | PhysicsColliderTopologyRecord3D;

export type PhysicsCommand3D =
  | Readonly<{
      kind: "apply-force";
      bodyId: number;
      forceX: number;
      forceY: number;
      forceZ: number;
      pointX?: number;
      pointY?: number;
      pointZ?: number;
      wake?: boolean;
    }>
  | Readonly<{
      kind: "apply-torque";
      bodyId: number;
      torqueX: number;
      torqueY: number;
      torqueZ: number;
    }>
  | Readonly<{
      kind: "apply-impulse";
      bodyId: number;
      impulseX: number;
      impulseY: number;
      impulseZ: number;
      pointX?: number;
      pointY?: number;
      pointZ?: number;
      wake?: boolean;
    }>
  | Readonly<{ kind: "set-pose"; bodyId: number; pose: PhysicsPose3D }>
  | Readonly<{
      kind: "set-velocity";
      bodyId: number;
      linearVelocityX: number;
      linearVelocityY: number;
      linearVelocityZ: number;
      angularVelocityXDegrees: number;
      angularVelocityYDegrees: number;
      angularVelocityZDegrees: number;
    }>
  | Readonly<{
      kind: "set-linear-velocity";
      bodyId: number;
      linearVelocityX: number;
      linearVelocityY: number;
      linearVelocityZ: number;
    }>
  | Readonly<{
      kind: "set-angular-velocity";
      bodyId: number;
      angularVelocityXDegrees: number;
      angularVelocityYDegrees: number;
      angularVelocityZDegrees: number;
    }>
  | Readonly<{ kind: "wake"; bodyId: number }>
  | Readonly<{ kind: "sleep"; bodyId: number }>
  | Readonly<{ kind: "disable"; bodyId: number }>
  | Readonly<{
      kind: "enable";
      bodyId: number;
      velocity: "zero" | "preserve";
    }>
  | Readonly<{
      kind: "configure";
      configuration: PhysicsWorld3DConfiguration;
    }>;

export type PhysicsWorld3DFailureStage =
  | "topology"
  | "broad-phase"
  | "narrow-phase"
  | "velocity-solve"
  | "position-solve"
  | "ccd"
  | "event-staging"
  | "output";

type PhysicsWorld3DFailureInjector = (
  stage: PhysicsWorld3DFailureStage,
) => void;

let failureInjector: PhysicsWorld3DFailureInjector | undefined;

/** @internal Test-only deterministic fault seam. */
export function installPhysicsWorld3DFailureInjectorForTest(
  injector: PhysicsWorld3DFailureInjector,
): () => void {
  const previous = failureInjector;
  failureInjector = injector;
  return () => {
    if (failureInjector === injector) failureInjector = previous;
  };
}

interface BodySlot3D {
  readonly index: number;
  readonly generation: number;
}

interface ColliderSlot3D {
  readonly index: number;
  readonly generation: number;
}

interface DisabledBodyState3D {
  readonly flags: number;
  readonly linearVelocityX: number;
  readonly linearVelocityY: number;
  readonly linearVelocityZ: number;
  readonly angularVelocityX: number;
  readonly angularVelocityY: number;
  readonly angularVelocityZ: number;
}

interface ContactEventFact3D {
  readonly normalX: number;
  readonly normalY: number;
  readonly normalZ: number;
  readonly pointCount: number;
  readonly pointFirstX: readonly number[];
  readonly pointFirstY: readonly number[];
  readonly pointFirstZ: readonly number[];
  readonly pointSecondX: readonly number[];
  readonly pointSecondY: readonly number[];
  readonly pointSecondZ: readonly number[];
  readonly pointSeparations: readonly number[];
  readonly totalNormalImpulse: number;
}

interface KinematicTrajectory3D {
  readonly from: PhysicsPose3D;
  readonly to: PhysicsPose3D;
}

interface CoordinatorState3D {
  configuration: NormalizedPhysicsWorld3DConfiguration;
  accumulatorMilliseconds: number;
  previousLogicalTime: number;
  anchored: boolean;
  tick: number;
  topologyRevision: number;
  commandRevision: number;
  bodySlots: Map<number, BodySlot3D>;
  colliderSlots: Map<number, ColliderSlot3D>;
  bodyRecords: Map<number, PhysicsBodyTopologyRecord3D>;
  colliderRecords: Map<number, PhysicsColliderTopologyRecord3D>;
  disabledBodies: Map<number, DisabledBodyState3D>;
  previousPositionX: Float64Array;
  previousPositionY: Float64Array;
  previousPositionZ: Float64Array;
  previousOrientationX: Float64Array;
  previousOrientationY: Float64Array;
  previousOrientationZ: Float64Array;
  previousOrientationW: Float64Array;
  bodyIndices: Int32Array;
  bodyCount: number;
  integrationBodyIndices: Int32Array;
  integrationBodyCount: number;
  eventTicks: Float64Array;
  eventKinds: Uint8Array;
  eventFirstColliderIndices: Int32Array;
  eventFirstColliderGenerations: Uint32Array;
  eventSecondColliderIndices: Int32Array;
  eventSecondColliderGenerations: Uint32Array;
  eventNormalX: Float64Array;
  eventNormalY: Float64Array;
  eventNormalZ: Float64Array;
  eventPointCounts: Uint8Array;
  eventPointFirstX: Float64Array;
  eventPointFirstY: Float64Array;
  eventPointFirstZ: Float64Array;
  eventPointSecondX: Float64Array;
  eventPointSecondY: Float64Array;
  eventPointSecondZ: Float64Array;
  eventPointSeparations: Float64Array;
  eventTotalNormalImpulses: Float64Array;
  eventCount: number;
  contactEventFacts: Map<string, ContactEventFact3D>;
  savedNormalImpulses: Float64Array;
  savedTangentImpulses1: Float64Array;
  savedTangentImpulses2: Float64Array;
}

interface ValueSnapshot {
  readonly key: PropertyKey;
  readonly kind: "value" | "typed-array" | "array" | "map";
  readonly reference: unknown;
  readonly contents?: unknown;
}

interface ObjectSnapshot {
  readonly target: Record<PropertyKey, unknown>;
  readonly values: readonly ValueSnapshot[];
}

interface WorldCheckpoint3D {
  readonly snapshots: readonly ObjectSnapshot[];
}

export interface PhysicsWorld3DSnapshot {
  readonly tick: number;
  readonly accumulatorMilliseconds: number;
  readonly anchored: boolean;
  readonly bodyCount: number;
  readonly colliderCount: number;
  readonly contactCount: number;
  readonly eventCount: number;
  readonly rootNode: number;
  readonly pairCount: number;
  readonly counters: Readonly<Record<string, number>>;
  readonly bodies: readonly Readonly<{
    id: number;
    index: number;
    generation: number;
    positionX: number;
    positionY: number;
    positionZ: number;
    orientationX: number;
    orientationY: number;
    orientationZ: number;
    orientationW: number;
    localCenterX: number;
    localCenterY: number;
    localCenterZ: number;
    linearVelocityX: number;
    linearVelocityY: number;
    linearVelocityZ: number;
    angularVelocityX: number;
    angularVelocityY: number;
    angularVelocityZ: number;
    inverseMass: number;
    localInverseInertiaXX: number;
    localInverseInertiaYY: number;
    localInverseInertiaZZ: number;
    localInverseInertiaXY: number;
    localInverseInertiaXZ: number;
    localInverseInertiaYZ: number;
    flags: number;
  }>[];
}

export class PhysicsWorld3DCandidate {
  private status: "live" | "adopted" | "discarded" = "live";

  constructor(
    readonly owner: PhysicsWorld3DKernel,
    private checkpoint: WorldCheckpoint3D | undefined,
    readonly frameId: number,
    readonly logicalTime: number,
    readonly stepCount: number,
    readonly tick: number,
    readonly accumulatorMilliseconds: number,
    readonly advanceEligible: boolean,
    readonly eventOffset: number,
    readonly eventCount: number,
    readonly eventTicks: Float64Array,
    readonly eventKinds: Uint8Array,
    readonly eventFirstColliderIndices: Int32Array,
    readonly eventFirstColliderGenerations: Uint32Array,
    readonly eventSecondColliderIndices: Int32Array,
    readonly eventSecondColliderGenerations: Uint32Array,
    readonly eventNormalX: Float64Array,
    readonly eventNormalY: Float64Array,
    readonly eventNormalZ: Float64Array,
    readonly eventPointCounts: Uint8Array,
    readonly eventPointFirstX: Float64Array,
    readonly eventPointFirstY: Float64Array,
    readonly eventPointFirstZ: Float64Array,
    readonly eventPointSecondX: Float64Array,
    readonly eventPointSecondY: Float64Array,
    readonly eventPointSecondZ: Float64Array,
    readonly eventPointSeparations: Float64Array,
    readonly eventTotalNormalImpulses: Float64Array,
    readonly topologyRevision: number,
    readonly commandRevision: number,
    readonly commandCount: number,
  ) {}

  get lifecycle(): "live" | "adopted" | "discarded" {
    return this.status;
  }

  consume(status: "adopted" | "discarded"): WorldCheckpoint3D {
    if (this.status !== "live" || this.checkpoint === undefined) {
      throw new Error("physics world candidate has already been consumed.");
    }
    const checkpoint = this.checkpoint;
    this.checkpoint = undefined;
    this.status = status;
    return checkpoint;
  }
}

export class PhysicsWorld3DKernel {
  readonly counters = createPhysicsOwnershipCounters3D();
  readonly bodies = new BodyStore3D(this.counters);
  readonly colliders = new ColliderStore3D(this.counters);
  readonly broadPhase = new DynamicAabbBroadPhase3D(this.counters);
  readonly contacts = new ContactCache3D(this.counters);
  readonly solver = new SequentialImpulseSolver3D(this.counters);
  readonly positionSolver = new SequentialImpulseSolver3D(this.counters);
  readonly ccd = new BoundedCcd3D();

  private readonly state: CoordinatorState3D;
  private pendingTopology: readonly PhysicsTopologyRecord3D[] | undefined;
  private pendingCommands: readonly PhysicsCommand3D[] = Object.freeze([]);
  private nextTopologyRevision = 0;
  private nextCommandRevision = 0;
  private liveCandidate: PhysicsWorld3DCandidate | undefined;
  private disposed = false;

  constructor(configuration: PhysicsWorld3DConfiguration = {}) {
    const bodyCapacity = this.bodies.capacity;
    const eventCapacity = 4;
    this.state = {
      configuration: normalizePhysicsWorld3DConfiguration(configuration),
      accumulatorMilliseconds: 0,
      previousLogicalTime: 0,
      anchored: false,
      tick: 0,
      topologyRevision: 0,
      commandRevision: 0,
      bodySlots: new Map(),
      colliderSlots: new Map(),
      bodyRecords: new Map(),
      colliderRecords: new Map(),
      disabledBodies: new Map(),
      previousPositionX: new Float64Array(bodyCapacity),
      previousPositionY: new Float64Array(bodyCapacity),
      previousPositionZ: new Float64Array(bodyCapacity),
      previousOrientationX: new Float64Array(bodyCapacity),
      previousOrientationY: new Float64Array(bodyCapacity),
      previousOrientationZ: new Float64Array(bodyCapacity),
      previousOrientationW: new Float64Array(bodyCapacity),
      bodyIndices: new Int32Array(bodyCapacity),
      bodyCount: 0,
      integrationBodyIndices: new Int32Array(bodyCapacity),
      integrationBodyCount: 0,
      eventTicks: new Float64Array(eventCapacity),
      eventKinds: new Uint8Array(eventCapacity),
      eventFirstColliderIndices: new Int32Array(eventCapacity),
      eventFirstColliderGenerations: new Uint32Array(eventCapacity),
      eventSecondColliderIndices: new Int32Array(eventCapacity),
      eventSecondColliderGenerations: new Uint32Array(eventCapacity),
      eventNormalX: new Float64Array(eventCapacity),
      eventNormalY: new Float64Array(eventCapacity),
      eventNormalZ: new Float64Array(eventCapacity),
      eventPointCounts: new Uint8Array(eventCapacity),
      eventPointFirstX: new Float64Array(eventCapacity * POINTS_PER_CONTACT),
      eventPointFirstY: new Float64Array(eventCapacity * POINTS_PER_CONTACT),
      eventPointFirstZ: new Float64Array(eventCapacity * POINTS_PER_CONTACT),
      eventPointSecondX: new Float64Array(eventCapacity * POINTS_PER_CONTACT),
      eventPointSecondY: new Float64Array(eventCapacity * POINTS_PER_CONTACT),
      eventPointSecondZ: new Float64Array(eventCapacity * POINTS_PER_CONTACT),
      eventPointSeparations: new Float64Array(
        eventCapacity * POINTS_PER_CONTACT,
      ),
      eventTotalNormalImpulses: new Float64Array(eventCapacity),
      eventCount: 0,
      contactEventFacts: new Map(),
      savedNormalImpulses: new Float64Array(eventCapacity * POINTS_PER_CONTACT),
      savedTangentImpulses1: new Float64Array(
        eventCapacity * POINTS_PER_CONTACT,
      ),
      savedTangentImpulses2: new Float64Array(
        eventCapacity * POINTS_PER_CONTACT,
      ),
    };
  }

  proposeTopology(records: readonly PhysicsTopologyRecord3D[]): void {
    this.assertUsable();
    validateTopology(records);
    this.pendingTopology = Object.freeze([...records]);
    this.nextTopologyRevision += 1;
  }

  applyBegin(commands: readonly PhysicsCommand3D[]): void {
    this.assertUsable();
    for (const command of commands) validateCommand(command);
    this.pendingCommands = Object.freeze([
      ...this.pendingCommands,
      ...commands,
    ]);
    if (commands.length > 0) this.nextCommandRevision += 1;
  }

  advance(
    input: Readonly<{
      frameId: number;
      logicalTime: number;
      stagedKinematicTargets: ReadonlyMap<number, PhysicsPose3D>;
    }>,
  ): PhysicsWorld3DCandidate {
    this.assertUsable();
    if (this.liveCandidate !== undefined) {
      throw new Error("physics world already has a live candidate.");
    }
    validateId(input.frameId, "frameId");
    if (!Number.isFinite(input.logicalTime)) {
      throw new RangeError("logicalTime must be finite.");
    }
    for (const [bodyId, pose] of input.stagedKinematicTargets) {
      validateId(bodyId, "staged kinematic body id");
      validatePose(pose, "staged kinematic pose");
    }

    const eventOffset = this.state.eventCount;
    const checkpoint = this.captureCheckpoint();
    const topologyRevision = this.nextTopologyRevision;
    const commandRevision = this.nextCommandRevision;
    const commandCount = this.pendingCommands.length;
    let stage: PhysicsWorld3DFailureStage = "topology";
    try {
      if (
        this.pendingTopology !== undefined &&
        topologyRevision > this.state.topologyRevision
      ) {
        this.reconcileTopology(this.pendingTopology);
        this.state.topologyRevision = topologyRevision;
      }
      if (commandRevision > this.state.commandRevision) {
        this.applyCommands(this.pendingCommands);
        this.state.commandRevision = commandRevision;
      }
      injectFailure(stage);

      const logicalTimeMovedBackward =
        this.state.anchored &&
        input.logicalTime < this.state.previousLogicalTime;
      if (logicalTimeMovedBackward) {
        this.state.accumulatorMilliseconds = 0;
        this.state.anchored = false;
        this.capturePreviousPoses();
      }
      const elapsed = this.state.anchored
        ? input.logicalTime - this.state.previousLogicalTime
        : 0;
      this.state.previousLogicalTime = input.logicalTime;
      this.state.anchored = !logicalTimeMovedBackward;
      const configuration = this.state.configuration;
      const maximumElapsed =
        configuration.fixedStepMilliseconds * configuration.maxCatchUpSteps;
      const acceptedElapsed = Math.min(elapsed, maximumElapsed);
      const discardedElapsed = elapsed - acceptedElapsed;
      if (discardedElapsed > 0) {
        recordPhysicsWorld3DTrace({
          kind: "physics-3d-clamp",
          frameId: input.frameId,
          logicalTime: input.logicalTime,
          acceptedElapsedMilliseconds: acceptedElapsed,
          discardedElapsedMilliseconds: discardedElapsed,
        });
      }
      this.state.accumulatorMilliseconds += acceptedElapsed;
      const stepCount = Math.min(
        configuration.maxCatchUpSteps,
        Math.floor(
          (this.state.accumulatorMilliseconds +
            configuration.fixedStepMilliseconds * 1e-12) /
            configuration.fixedStepMilliseconds,
        ),
      );
      const kinematicTrajectories = this.createKinematicTrajectories(
        input.stagedKinematicTargets,
      );
      for (let step = 0; step < stepCount; step += 1) {
        this.simulateFixedTick(
          input,
          kinematicTrajectories,
          step,
          stepCount,
          (current) => {
            stage = current;
          },
        );
        this.state.accumulatorMilliseconds -=
          configuration.fixedStepMilliseconds;
        if (
          this.state.accumulatorMilliseconds <
          configuration.fixedStepMilliseconds * 1e-12
        ) {
          this.state.accumulatorMilliseconds = 0;
        }
      }
      if (!this.hasAdvanceWork(input.stagedKinematicTargets)) {
        this.state.accumulatorMilliseconds = 0;
        this.state.anchored = false;
        this.capturePreviousPoses();
      }
      stage = "output";
      const candidate = new PhysicsWorld3DCandidate(
        this,
        checkpoint,
        input.frameId,
        input.logicalTime,
        stepCount,
        this.state.tick,
        this.state.accumulatorMilliseconds,
        this.hasAdvanceWork(input.stagedKinematicTargets),
        eventOffset,
        this.state.eventCount - eventOffset,
        this.state.eventTicks,
        this.state.eventKinds,
        this.state.eventFirstColliderIndices,
        this.state.eventFirstColliderGenerations,
        this.state.eventSecondColliderIndices,
        this.state.eventSecondColliderGenerations,
        this.state.eventNormalX,
        this.state.eventNormalY,
        this.state.eventNormalZ,
        this.state.eventPointCounts,
        this.state.eventPointFirstX,
        this.state.eventPointFirstY,
        this.state.eventPointFirstZ,
        this.state.eventPointSecondX,
        this.state.eventPointSecondY,
        this.state.eventPointSecondZ,
        this.state.eventPointSeparations,
        this.state.eventTotalNormalImpulses,
        topologyRevision,
        commandRevision,
        commandCount,
      );
      injectFailure(stage);
      this.liveCandidate = candidate;
      recordPhysicsWorld3DTrace({
        kind: "physics-3d-candidate",
        frameId: input.frameId,
        logicalTime: input.logicalTime,
        tick: this.state.tick,
        stepCount,
      });
      return candidate;
    } catch (error) {
      this.restoreCheckpoint(checkpoint);
      recordPhysicsWorld3DTrace({
        kind: "physics-3d-error",
        frameId: input.frameId,
        logicalTime: input.logicalTime,
        stage,
        error,
      });
      throw error;
    }
  }

  adopt(candidate: PhysicsWorld3DCandidate): void {
    this.assertCandidate(candidate);
    candidate.consume("adopted");
    this.liveCandidate = undefined;
    if (candidate.topologyRevision === this.nextTopologyRevision) {
      this.pendingTopology = undefined;
    }
    if (candidate.commandRevision === this.nextCommandRevision) {
      this.pendingCommands = Object.freeze([]);
    } else if (candidate.commandCount > 0) {
      this.pendingCommands = Object.freeze(
        this.pendingCommands.slice(candidate.commandCount),
      );
    }
    this.state.eventCount = 0;
    recordPhysicsWorld3DTrace({
      kind: "physics-3d-adopt",
      frameId: candidate.frameId,
      tick: candidate.tick,
    });
  }

  discard(candidate: PhysicsWorld3DCandidate): void {
    this.assertCandidate(candidate);
    const checkpoint = candidate.consume("discarded");
    this.restoreCheckpoint(checkpoint);
    this.liveCandidate = undefined;
    recordPhysicsWorld3DTrace({
      kind: "physics-3d-discard",
      frameId: candidate.frameId,
      tick: candidate.tick,
    });
  }

  assertCommittedReadable(): void {
    this.assertUsable();
    if (this.liveCandidate !== undefined) {
      throw new Error(
        "committed physics state is unavailable while an uncommitted candidate is live.",
      );
    }
  }

  authoritativePose(bodyId: number): PhysicsPose3D {
    this.assertUsable();
    const slot = this.requireBody(bodyId);
    return publicBodyOriginPose(this.bodies, slot.index);
  }

  presentationPose(bodyId: number): PhysicsPose3D {
    this.assertUsable();
    const slot = this.requireBody(bodyId);
    const index = slot.index;
    if (this.state.configuration.interpolation === "none") {
      return publicBodyOriginPose(this.bodies, index);
    }
    const alpha =
      this.state.accumulatorMilliseconds /
      this.state.configuration.fixedStepMilliseconds;
    const orientation = slerpCanonical(
      this.state.previousOrientationX[index]!,
      this.state.previousOrientationY[index]!,
      this.state.previousOrientationZ[index]!,
      this.state.previousOrientationW[index]!,
      this.bodies.orientationX[index]!,
      this.bodies.orientationY[index]!,
      this.bodies.orientationZ[index]!,
      this.bodies.orientationW[index]!,
      alpha,
    );
    return publicOriginPoseFromCenter(
      this.bodies,
      index,
      lerp(
        this.state.previousPositionX[index]!,
        this.bodies.positionX[index]!,
        alpha,
      ),
      lerp(
        this.state.previousPositionY[index]!,
        this.bodies.positionY[index]!,
        alpha,
      ),
      lerp(
        this.state.previousPositionZ[index]!,
        this.bodies.positionZ[index]!,
        alpha,
      ),
      orientation,
    );
  }

  isBodyEnabled(bodyId: number): boolean {
    this.assertUsable();
    return (
      this.state.bodySlots.has(bodyId) && !this.state.disabledBodies.has(bodyId)
    );
  }

  bodyIdentity(
    bodyId: number,
  ): Readonly<{ index: number; generation: number }> | undefined {
    this.assertUsable();
    return this.state.bodySlots.get(bodyId);
  }

  colliderIdentity(
    colliderId: number,
  ): Readonly<{ index: number; generation: number }> | undefined {
    this.assertUsable();
    return this.state.colliderSlots.get(colliderId);
  }

  bodyIdForIdentity(index: number, generation: number): number | undefined {
    this.assertUsable();
    for (const [id, slot] of this.state.bodySlots) {
      if (slot.index === index && slot.generation === generation) return id;
    }
    return undefined;
  }

  colliderIdForIdentity(index: number, generation: number): number | undefined {
    this.assertUsable();
    for (const [id, slot] of this.state.colliderSlots) {
      if (slot.index === index && slot.generation === generation) return id;
    }
    return undefined;
  }

  snapshot(): PhysicsWorld3DSnapshot {
    this.assertUsable();
    const bodies = [...this.state.bodySlots.entries()]
      .sort(([first], [second]) => first - second)
      .map(([id, slot]) => {
        const index = slot.index;
        return Object.freeze({
          id,
          index,
          generation: slot.generation,
          positionX: this.bodies.positionX[index]!,
          positionY: this.bodies.positionY[index]!,
          positionZ: this.bodies.positionZ[index]!,
          orientationX: this.bodies.orientationX[index]!,
          orientationY: this.bodies.orientationY[index]!,
          orientationZ: this.bodies.orientationZ[index]!,
          orientationW: this.bodies.orientationW[index]!,
          localCenterX: this.bodies.localCenterX[index]!,
          localCenterY: this.bodies.localCenterY[index]!,
          localCenterZ: this.bodies.localCenterZ[index]!,
          linearVelocityX: this.bodies.linearVelocityX[index]!,
          linearVelocityY: this.bodies.linearVelocityY[index]!,
          linearVelocityZ: this.bodies.linearVelocityZ[index]!,
          angularVelocityX: this.bodies.angularVelocityX[index]!,
          angularVelocityY: this.bodies.angularVelocityY[index]!,
          angularVelocityZ: this.bodies.angularVelocityZ[index]!,
          inverseMass: this.bodies.inverseMass[index]!,
          localInverseInertiaXX: this.bodies.localInverseInertiaXX[index]!,
          localInverseInertiaYY: this.bodies.localInverseInertiaYY[index]!,
          localInverseInertiaZZ: this.bodies.localInverseInertiaZZ[index]!,
          localInverseInertiaXY: this.bodies.localInverseInertiaXY[index]!,
          localInverseInertiaXZ: this.bodies.localInverseInertiaXZ[index]!,
          localInverseInertiaYZ: this.bodies.localInverseInertiaYZ[index]!,
          flags: this.bodies.flags[index]!,
        });
      });
    return Object.freeze({
      tick: this.state.tick,
      accumulatorMilliseconds: this.state.accumulatorMilliseconds,
      anchored: this.state.anchored,
      bodyCount: this.state.bodySlots.size,
      colliderCount: this.state.colliderSlots.size,
      contactCount: this.contacts.contactCount,
      eventCount: this.state.eventCount,
      rootNode: this.broadPhase.rootNode,
      pairCount: this.broadPhase.pairCount,
      counters: Object.freeze({ ...this.counters }),
      bodies: Object.freeze(bodies),
    });
  }

  dispose(): void {
    if (this.disposed) return;
    if (this.liveCandidate !== undefined) this.discard(this.liveCandidate);
    this.reconcileTopology(Object.freeze([]));
    this.contacts.dispose();
    this.solver.dispose();
    this.positionSolver.dispose();
    this.broadPhase.dispose();
    this.colliders.dispose();
    this.bodies.dispose();
    this.state.eventCount = 0;
    this.pendingTopology = undefined;
    this.pendingCommands = Object.freeze([]);
    this.disposed = true;
  }

  private simulateFixedTick(
    input: Readonly<{
      frameId: number;
      logicalTime: number;
      stagedKinematicTargets: ReadonlyMap<number, PhysicsPose3D>;
    }>,
    kinematicTrajectories: ReadonlyMap<number, KinematicTrajectory3D>,
    step: number,
    stepCount: number,
    setStage: (stage: PhysicsWorld3DFailureStage) => void,
  ): void {
    setStage("broad-phase");
    this.ensureBodyScratchCapacity();
    this.capturePreviousPoses();
    const dt = this.state.configuration.fixedStepMilliseconds / 1_000;
    this.applyKinematicTargets(
      input.stagedKinematicTargets,
      kinematicTrajectories,
      step,
      stepCount,
      dt,
    );
    this.rebuildIntegrationBodyIndices();
    integrateCandidateBodies3D(
      this.bodies,
      this.state.integrationBodyIndices,
      this.state.integrationBodyCount,
      this.state.configuration.gravityX,
      this.state.configuration.gravityY,
      this.state.configuration.gravityZ,
      dt,
    );
    this.snapKinematicTargets(kinematicTrajectories, step, stepCount);
    this.moveBroadPhaseProxies();
    injectFailure("broad-phase");
    setStage("ccd");
    this.ccd.resolveCandidateBodies(
      this.bodies,
      this.colliders,
      this.broadPhase,
      this.state.integrationBodyIndices,
      this.state.integrationBodyCount,
      this.state.previousPositionX,
      this.state.previousPositionY,
      this.state.previousPositionZ,
      this.state.previousOrientationX,
      this.state.previousOrientationY,
      this.state.previousOrientationZ,
      this.state.previousOrientationW,
    );
    this.moveBroadPhaseProxies();
    if (this.ccd.capCount > 0) {
      recordPhysicsWorld3DTrace({
        kind: "physics-3d-ccd-cap",
        frameId: input.frameId,
        tick: this.state.tick + 1,
        cappedBodies: this.ccd.capCount,
      });
    }
    injectFailure("ccd");
    setStage("narrow-phase");
    this.broadPhase.publishPairs();
    updateSortedContactCache3D(
      this.contacts,
      this.broadPhase,
      this.bodies,
      this.colliders,
      (first, second) =>
        this.manifoldBetweenColliders(input.frameId, first, second),
      true,
    );
    injectFailure("narrow-phase");
    setStage("velocity-solve");
    this.solver.solveCandidate(
      this.bodies,
      this.state.bodyIndices,
      this.state.bodyCount,
      this.contacts,
      this.state.configuration.velocityIterations,
      0,
    );
    injectFailure("velocity-solve");
    setStage("position-solve");
    this.solvePositions();
    injectFailure("position-solve");
    setStage("event-staging");
    this.solver.updateSleepingCandidate(this.bodies, this.contacts, dt, {
      enabled: this.state.configuration.sleeping,
      recordTransition: (bodyIndex, sleeping) => {
        this.appendEvent(sleeping ? 6 : 5, bodyIndex, NO_INDEX);
      },
    });
    this.stageContactEvents();
    injectFailure("event-staging");
    this.state.tick += 1;
    recordPhysicsWorld3DTrace({
      kind: "physics-3d-tick",
      frameId: input.frameId,
      logicalTime: input.logicalTime,
      tick: this.state.tick,
    });
  }

  private reconcileTopology(records: readonly PhysicsTopologyRecord3D[]): void {
    const desiredBodies = new Map<number, PhysicsBodyTopologyRecord3D>();
    const desiredColliders = new Map<number, PhysicsColliderTopologyRecord3D>();
    for (const record of records) {
      if (record.kind === "body") desiredBodies.set(record.id, record);
      else desiredColliders.set(record.id, record);
    }

    for (const [id, slot] of sortedEntries(this.state.colliderSlots, true)) {
      if (desiredColliders.has(id)) continue;
      this.wakeForSolidColliderTopology(slot);
      this.releaseCollider(slot);
      this.state.colliderSlots.delete(id);
      this.state.colliderRecords.delete(id);
    }
    for (const [id, slot] of sortedEntries(this.state.bodySlots, true)) {
      if (desiredBodies.has(id)) continue;
      this.bodies.release(slot.index, slot.generation);
      this.state.bodySlots.delete(id);
      this.state.bodyRecords.delete(id);
      this.state.disabledBodies.delete(id);
      this.state.anchored = false;
      this.state.accumulatorMilliseconds = 0;
    }

    for (const [id, record] of sortedEntries(desiredBodies)) {
      const existing = this.state.bodySlots.get(id);
      if (existing === undefined) {
        const index = this.bodies.allocate(record.definition);
        const slot = Object.freeze({
          index,
          generation: this.bodies.generations[index]!,
        });
        this.state.bodySlots.set(id, slot);
        this.state.bodyRecords.set(id, record);
        this.state.anchored = false;
        this.state.accumulatorMilliseconds = 0;
        this.ensureBodyScratchCapacity();
        this.snapPreviousPose(index);
        continue;
      }
      const previousRecord = this.state.bodyRecords.get(id);
      if (sameBodyDefinition(previousRecord?.definition, record.definition)) {
        continue;
      }
      const disabled = this.state.disabledBodies.get(id);
      const wasActiveDynamic =
        disabled === undefined &&
        (this.bodies.flags[existing.index]! & BODY_ENABLED_3D) !== 0 &&
        (this.bodies.flags[existing.index]! & BODY_TYPE_MASK_3D) ===
          BODY_TYPE_DYNAMIC_3D;
      const becomesActiveDynamic =
        disabled === undefined &&
        (record.definition.flags & BODY_ENABLED_3D) !== 0 &&
        (record.definition.flags & BODY_TYPE_MASK_3D) === BODY_TYPE_DYNAMIC_3D;
      if (disabled === undefined) {
        this.wakeForBodyTopology(id, existing.index);
      }
      const preserveDynamic =
        disabled === undefined &&
        (this.bodies.flags[existing.index]! & BODY_TYPE_MASK_3D) ===
          BODY_TYPE_DYNAMIC_3D &&
        (record.definition.flags & BODY_TYPE_MASK_3D) === BODY_TYPE_DYNAMIC_3D;
      const preserved = preserveDynamic
        ? {
            pose: publicBodyOriginPose(this.bodies, existing.index),
            linearVelocityX: this.bodies.linearVelocityX[existing.index]!,
            linearVelocityY: this.bodies.linearVelocityY[existing.index]!,
            linearVelocityZ: this.bodies.linearVelocityZ[existing.index]!,
            angularVelocityX: this.bodies.angularVelocityX[existing.index]!,
            angularVelocityY: this.bodies.angularVelocityY[existing.index]!,
            angularVelocityZ: this.bodies.angularVelocityZ[existing.index]!,
            forceX: this.bodies.forceX[existing.index]!,
            forceY: this.bodies.forceY[existing.index]!,
            forceZ: this.bodies.forceZ[existing.index]!,
            torqueX: this.bodies.torqueX[existing.index]!,
            torqueY: this.bodies.torqueY[existing.index]!,
            torqueZ: this.bodies.torqueZ[existing.index]!,
          }
        : null;
      writeBodyDefinition(this.bodies, existing.index, record.definition);
      if (preserved !== null) {
        this.setBodyOriginPose(existing.index, preserved.pose);
        this.bodies.linearVelocityX[existing.index] = preserved.linearVelocityX;
        this.bodies.linearVelocityY[existing.index] = preserved.linearVelocityY;
        this.bodies.linearVelocityZ[existing.index] = preserved.linearVelocityZ;
        this.bodies.angularVelocityX[existing.index] =
          preserved.angularVelocityX;
        this.bodies.angularVelocityY[existing.index] =
          preserved.angularVelocityY;
        this.bodies.angularVelocityZ[existing.index] =
          preserved.angularVelocityZ;
        this.bodies.forceX[existing.index] = preserved.forceX;
        this.bodies.forceY[existing.index] = preserved.forceY;
        this.bodies.forceZ[existing.index] = preserved.forceZ;
        this.bodies.torqueX[existing.index] = preserved.torqueX;
        this.bodies.torqueY[existing.index] = preserved.torqueY;
        this.bodies.torqueZ[existing.index] = preserved.torqueZ;
      }
      if (disabled !== undefined) {
        this.state.disabledBodies.set(
          id,
          Object.freeze({ ...disabled, flags: record.definition.flags }),
        );
        zeroDisabledBody(this.bodies, existing.index);
      }
      this.state.bodyRecords.set(id, record);
      this.snapPreviousPose(existing.index);
      if (!wasActiveDynamic && becomesActiveDynamic) {
        this.state.accumulatorMilliseconds = 0;
        this.state.anchored = false;
      }
    }

    for (const [id, record] of sortedEntries(desiredColliders)) {
      const bodySlot = this.state.bodySlots.get(record.bodyId);
      if (bodySlot === undefined) {
        throw new Error(
          `collider ${String(id)} references missing body ${String(record.bodyId)}.`,
        );
      }
      const existing = this.state.colliderSlots.get(id);
      if (
        existing !== undefined &&
        sameColliderRecord(this.state.colliderRecords.get(id), record)
      ) {
        continue;
      }
      if (existing !== undefined) {
        this.wakeForSolidColliderTopology(existing);
        this.releaseCollider(existing);
        this.state.colliderSlots.delete(id);
      }
      this.state.colliderRecords.set(id, record);
      if (this.state.disabledBodies.has(record.bodyId)) continue;
      this.allocateColliderRecord(id, record, bodySlot);
      this.wakeForNewSolidColliderTopology(this.state.colliderSlots.get(id)!);
    }
    this.rebuildBodyIndices();
    this.moveBroadPhaseProxies();
  }

  private applyCommands(commands: readonly PhysicsCommand3D[]): void {
    for (const command of commands) {
      if (command.kind === "configure") {
        const previous = this.state.configuration;
        const next = normalizePhysicsWorld3DConfiguration({
          gravity: [previous.gravityX, previous.gravityY, previous.gravityZ],
          fixedStepMilliseconds: previous.fixedStepMilliseconds,
          maxCatchUpSteps: previous.maxCatchUpSteps,
          interpolation: previous.interpolation,
          sleeping: previous.sleeping,
          ...command.configuration,
          solver: {
            velocityIterations: previous.velocityIterations,
            positionIterations: previous.positionIterations,
            ...command.configuration.solver,
          },
        });
        this.state.configuration = next;
        const changesSimulation =
          next.gravityX !== previous.gravityX ||
          next.gravityY !== previous.gravityY ||
          next.gravityZ !== previous.gravityZ ||
          next.fixedStepMilliseconds !== previous.fixedStepMilliseconds ||
          next.velocityIterations !== previous.velocityIterations ||
          next.positionIterations !== previous.positionIterations ||
          (previous.sleeping && !next.sleeping);
        if (changesSimulation) {
          this.state.accumulatorMilliseconds = 0;
          this.state.anchored = false;
          for (const [, slot] of sortedEntries(this.state.bodySlots)) {
            if (
              (this.bodies.flags[slot.index]! & BODY_TYPE_MASK_3D) ===
              BODY_TYPE_DYNAMIC_3D
            ) {
              this.wakeCommandBody(slot.index);
            }
          }
        }
        continue;
      }
      const slot = this.state.bodySlots.get(command.bodyId);
      if (slot === undefined) continue;
      const index = slot.index;
      switch (command.kind) {
        case "apply-force":
          if (command.wake !== false) this.wakeCommandBody(index);
          applyForceAtPointToCandidateBody3D(
            this.bodies,
            index,
            slot.generation,
            command.forceX,
            command.forceY,
            command.forceZ,
            command.pointX ?? this.bodies.positionX[index]!,
            command.pointY ?? this.bodies.positionY[index]!,
            command.pointZ ?? this.bodies.positionZ[index]!,
          );
          break;
        case "apply-torque":
          this.wakeCommandBody(index);
          applyTorqueToCandidateBody3D(
            this.bodies,
            index,
            slot.generation,
            command.torqueX,
            command.torqueY,
            command.torqueZ,
          );
          break;
        case "apply-impulse":
          if (command.wake !== false) this.wakeCommandBody(index);
          applyImpulseAtPointToCandidateBody3D(
            this.bodies,
            index,
            slot.generation,
            command.impulseX,
            command.impulseY,
            command.impulseZ,
            command.pointX ?? this.bodies.positionX[index]!,
            command.pointY ?? this.bodies.positionY[index]!,
            command.pointZ ?? this.bodies.positionZ[index]!,
          );
          break;
        case "set-pose":
          this.wakeCommandBody(index);
          this.setBodyOriginPose(index, command.pose);
          this.snapPreviousPose(index);
          this.moveBroadPhaseProxies();
          break;
        case "set-velocity":
          this.wakeCommandBody(index);
          this.bodies.linearVelocityX[index] = command.linearVelocityX;
          this.bodies.linearVelocityY[index] = command.linearVelocityY;
          this.bodies.linearVelocityZ[index] = command.linearVelocityZ;
          this.bodies.angularVelocityX[index] =
            command.angularVelocityXDegrees * DEGREES_TO_RADIANS;
          this.bodies.angularVelocityY[index] =
            command.angularVelocityYDegrees * DEGREES_TO_RADIANS;
          this.bodies.angularVelocityZ[index] =
            command.angularVelocityZDegrees * DEGREES_TO_RADIANS;
          break;
        case "set-linear-velocity":
          this.wakeCommandBody(index);
          this.bodies.linearVelocityX[index] = command.linearVelocityX;
          this.bodies.linearVelocityY[index] = command.linearVelocityY;
          this.bodies.linearVelocityZ[index] = command.linearVelocityZ;
          break;
        case "set-angular-velocity":
          this.wakeCommandBody(index);
          this.bodies.angularVelocityX[index] =
            command.angularVelocityXDegrees * DEGREES_TO_RADIANS;
          this.bodies.angularVelocityY[index] =
            command.angularVelocityYDegrees * DEGREES_TO_RADIANS;
          this.bodies.angularVelocityZ[index] =
            command.angularVelocityZDegrees * DEGREES_TO_RADIANS;
          break;
        case "wake":
          this.wakeCommandBody(index);
          break;
        case "sleep":
          this.sleepCommandBody(index);
          break;
        case "disable":
          this.disableCommandBody(command.bodyId, slot);
          break;
        case "enable":
          this.enableCommandBody(command.bodyId, slot, command.velocity);
          break;
      }
    }
  }

  private wakeCommandBody(bodyIndex: number): void {
    if (this.wakeBody(bodyIndex)) {
      this.state.anchored = false;
      this.state.accumulatorMilliseconds = 0;
    }
  }

  private sleepCommandBody(bodyIndex: number): void {
    if ((this.bodies.flags[bodyIndex]! & BODY_SLEEPING_3D) !== 0) return;
    this.bodies.flags[bodyIndex] |= BODY_SLEEPING_3D;
    this.bodies.sleepTime[bodyIndex] = 0;
    zeroBodyMotion(this.bodies, bodyIndex);
    this.appendEvent(6, bodyIndex, NO_INDEX);
    this.state.accumulatorMilliseconds = 0;
    this.state.anchored = false;
  }

  private disableCommandBody(bodyId: number, slot: BodySlot3D): void {
    if (this.state.disabledBodies.has(bodyId)) return;
    const index = slot.index;
    this.state.disabledBodies.set(
      bodyId,
      Object.freeze({
        flags: this.bodies.flags[index]!,
        linearVelocityX: this.bodies.linearVelocityX[index]!,
        linearVelocityY: this.bodies.linearVelocityY[index]!,
        linearVelocityZ: this.bodies.linearVelocityZ[index]!,
        angularVelocityX: this.bodies.angularVelocityX[index]!,
        angularVelocityY: this.bodies.angularVelocityY[index]!,
        angularVelocityZ: this.bodies.angularVelocityZ[index]!,
      }),
    );
    for (const [colliderId, record] of sortedEntries(
      this.state.colliderRecords,
    )) {
      if (record.bodyId !== bodyId) continue;
      const colliderSlot = this.state.colliderSlots.get(colliderId);
      if (colliderSlot !== undefined) this.releaseCollider(colliderSlot);
      this.state.colliderSlots.delete(colliderId);
    }
    zeroDisabledBody(this.bodies, index);
    this.broadPhase.publishPairs();
    updateSortedContactCache3D(
      this.contacts,
      this.broadPhase,
      this.bodies,
      this.colliders,
      (first, second) => this.manifoldBetweenColliders(0, first, second),
      true,
    );
    this.stageContactEvents();
    this.state.accumulatorMilliseconds = 0;
    this.state.anchored = false;
  }

  private enableCommandBody(
    bodyId: number,
    slot: BodySlot3D,
    velocity: "zero" | "preserve",
  ): void {
    const disabled = this.state.disabledBodies.get(bodyId);
    const authored = this.state.bodyRecords.get(bodyId)?.definition;
    if (disabled === undefined || authored === undefined) return;
    const index = slot.index;
    const disabledPose = publicBodyOriginPose(this.bodies, index);
    this.state.disabledBodies.delete(bodyId);
    writeBodyDefinition(this.bodies, index, authored);
    this.setBodyOriginPose(index, disabledPose);
    this.bodies.flags[index] = disabled.flags & ~BODY_SLEEPING_3D;
    this.bodies.linearVelocityX[index] =
      velocity === "preserve" ? disabled.linearVelocityX : 0;
    this.bodies.linearVelocityY[index] =
      velocity === "preserve" ? disabled.linearVelocityY : 0;
    this.bodies.linearVelocityZ[index] =
      velocity === "preserve" ? disabled.linearVelocityZ : 0;
    this.bodies.angularVelocityX[index] =
      velocity === "preserve" ? disabled.angularVelocityX : 0;
    this.bodies.angularVelocityY[index] =
      velocity === "preserve" ? disabled.angularVelocityY : 0;
    this.bodies.angularVelocityZ[index] =
      velocity === "preserve" ? disabled.angularVelocityZ : 0;
    this.snapPreviousPose(index);
    for (const [colliderId, record] of sortedEntries(
      this.state.colliderRecords,
    )) {
      if (
        record.bodyId !== bodyId ||
        this.state.colliderSlots.has(colliderId)
      ) {
        continue;
      }
      this.allocateColliderRecord(colliderId, record, slot);
    }
    this.state.anchored = false;
    this.state.accumulatorMilliseconds = 0;
  }

  private allocateColliderRecord(
    id: number,
    record: PhysicsColliderTopologyRecord3D,
    body: BodySlot3D,
  ): void {
    const index = this.colliders.allocate({
      ...record.definition,
      bodyIndex: body.index,
      bodyGeneration: body.generation,
    });
    const generation = this.colliders.generations[index]!;
    if ((record.definition.flags & COLLIDER_ENABLED_3D) !== 0) {
      const bounds = colliderBounds(this.bodies, this.colliders, index);
      const proxy = this.broadPhase.createProxy(
        index,
        generation,
        bounds[0],
        bounds[1],
        bounds[2],
        bounds[3],
        bounds[4],
        bounds[5],
      );
      this.colliders.setProxy(
        index,
        generation,
        proxy,
        this.broadPhase.proxyGenerations[proxy]!,
      );
    }
    this.state.colliderSlots.set(id, Object.freeze({ index, generation }));
  }

  private releaseCollider(slot: ColliderSlot3D): void {
    const proxy = this.colliders.proxyIndices[slot.index]!;
    const proxyGeneration = this.colliders.proxyGenerations[slot.index]!;
    if (proxy !== NO_INDEX) {
      this.broadPhase.destroyProxy(proxy, proxyGeneration);
    }
    this.colliders.release(slot.index, slot.generation);
  }

  private wakeForSolidColliderTopology(slot: ColliderSlot3D): void {
    if ((this.colliders.flags[slot.index]! & COLLIDER_SENSOR_3D) !== 0) {
      return;
    }
    const affectedBodies = new Set<number>([
      this.colliders.bodyIndices[slot.index]!,
    ]);
    for (let contact = 0; contact < this.contacts.contactCount; contact += 1) {
      if (this.contacts.sensorFlags[contact] !== 0) continue;
      const matchesFirst =
        this.contacts.firstColliderIndices[contact] === slot.index &&
        this.contacts.firstColliderGenerations[contact] === slot.generation;
      const matchesSecond =
        this.contacts.secondColliderIndices[contact] === slot.index &&
        this.contacts.secondColliderGenerations[contact] === slot.generation;
      if (!matchesFirst && !matchesSecond) continue;
      affectedBodies.add(this.contacts.firstBodyIndices[contact]!);
      affectedBodies.add(this.contacts.secondBodyIndices[contact]!);
    }
    for (const body of [...affectedBodies].sort(
      (first, second) => first - second,
    )) {
      this.wakeCommandBody(body);
    }
  }

  private wakeForBodyTopology(bodyId: number, bodyIndex: number): void {
    this.wakeCommandBody(bodyIndex);
    for (const [colliderId, record] of sortedEntries(
      this.state.colliderRecords,
    )) {
      if (record.bodyId !== bodyId) continue;
      const slot = this.state.colliderSlots.get(colliderId);
      if (slot !== undefined) this.wakeForSolidColliderTopology(slot);
    }
  }

  private wakeForNewSolidColliderTopology(slot: ColliderSlot3D): void {
    const index = slot.index;
    if (
      (this.colliders.flags[index]! & COLLIDER_ENABLED_3D) === 0 ||
      (this.colliders.flags[index]! & COLLIDER_SENSOR_3D) !== 0
    ) {
      return;
    }
    const affectedBodies = new Set<number>([
      this.colliders.bodyIndices[index]!,
    ]);
    const bounds = colliderBounds(this.bodies, this.colliders, index);
    for (const [, candidate] of sortedEntries(this.state.colliderSlots)) {
      if (candidate.index === index) continue;
      const candidateIndex = candidate.index;
      if (
        (this.colliders.flags[candidateIndex]! & COLLIDER_ENABLED_3D) === 0 ||
        (this.colliders.flags[candidateIndex]! & COLLIDER_SENSOR_3D) !== 0 ||
        !collisionFiltersAllow3D(
          {
            category: this.colliders.collisionCategories[index]!,
            mask: this.colliders.collisionMasks[index]!,
            group: this.colliders.collisionGroup[index]!,
          },
          {
            category: this.colliders.collisionCategories[candidateIndex]!,
            mask: this.colliders.collisionMasks[candidateIndex]!,
            group: this.colliders.collisionGroup[candidateIndex]!,
          },
        ) ||
        !boundsOverlap(
          bounds,
          colliderBounds(this.bodies, this.colliders, candidateIndex),
        )
      ) {
        continue;
      }
      affectedBodies.add(this.colliders.bodyIndices[candidateIndex]!);
    }
    for (const body of [...affectedBodies].sort(
      (first, second) => first - second,
    )) {
      this.wakeCommandBody(body);
    }
  }

  private moveBroadPhaseProxies(): void {
    for (const [, slot] of sortedEntries(this.state.colliderSlots)) {
      const index = slot.index;
      const proxy = this.colliders.proxyIndices[index]!;
      if (proxy === NO_INDEX) continue;
      const body = this.colliders.bodyIndices[index]!;
      const bounds = colliderBounds(this.bodies, this.colliders, index);
      this.broadPhase.moveProxy(
        proxy,
        this.colliders.proxyGenerations[index]!,
        bounds[0],
        bounds[1],
        bounds[2],
        bounds[3],
        bounds[4],
        bounds[5],
        this.bodies.positionX[body]! - this.state.previousPositionX[body]!,
        this.bodies.positionY[body]! - this.state.previousPositionY[body]!,
        this.bodies.positionZ[body]! - this.state.previousPositionZ[body]!,
      );
    }
  }

  private manifoldBetweenColliders(
    frameId: number,
    first: number,
    second: number,
  ) {
    const firstShape = this.colliders.shapes[first];
    const secondShape = this.colliders.shapes[second];
    if (firstShape === null || secondShape === null) return null;
    const result: PrivateManifoldResult3D = manifoldResultBetweenShapeRecords3D(
      firstShape,
      colliderWorldPose(this.bodies, this.colliders, first),
      first,
      secondShape,
      colliderWorldPose(this.bodies, this.colliders, second),
      second,
    );
    if (result.status === "failed") {
      recordPhysicsWorld3DTrace({
        kind: "physics-3d-collision-failure",
        frameId,
        tick: this.state.tick + 1,
        firstCollider: first,
        secondCollider: second,
        reason: result.reason,
      });
      return null;
    }
    return result.status === "contact" ? result.manifold : null;
  }

  private applyKinematicTargets(
    targets: ReadonlyMap<number, PhysicsPose3D>,
    trajectories: ReadonlyMap<number, KinematicTrajectory3D>,
    step: number,
    stepCount: number,
    dt: number,
  ): void {
    for (const [bodyId] of sortedEntries(targets)) {
      const slot = this.state.bodySlots.get(bodyId);
      if (slot === undefined) continue;
      const index = slot.index;
      if (
        (this.bodies.flags[index]! & BODY_TYPE_MASK_3D) !==
        BODY_TYPE_KINEMATIC_3D
      ) {
        continue;
      }
      const trajectory = trajectories.get(bodyId);
      if (trajectory === undefined) continue;
      const alpha = (step + 1) / stepCount;
      const from = trajectory.from;
      const to = trajectory.to;
      const targetOrientation = slerpCanonical(
        from.orientation[0],
        from.orientation[1],
        from.orientation[2],
        from.orientation[3],
        to.orientation[0],
        to.orientation[1],
        to.orientation[2],
        to.orientation[3],
        alpha,
      );
      const targetPosition = Object.freeze([
        lerp(from.position[0], to.position[0], alpha),
        lerp(from.position[1], to.position[1], alpha),
        lerp(from.position[2], to.position[2], alpha),
      ] as const);
      const targetCenter = centerFromOrigin(
        this.bodies,
        index,
        targetPosition,
        targetOrientation,
      );
      this.bodies.linearVelocityX[index] =
        (targetCenter[0]! - this.bodies.positionX[index]!) / dt;
      this.bodies.linearVelocityY[index] =
        (targetCenter[1]! - this.bodies.positionY[index]!) / dt;
      this.bodies.linearVelocityZ[index] =
        (targetCenter[2]! - this.bodies.positionZ[index]!) / dt;
      writeAngularVelocityToTarget(this.bodies, index, targetOrientation, dt);
      this.wakeCommandBody(index);
    }
  }

  private createKinematicTrajectories(
    targets: ReadonlyMap<number, PhysicsPose3D>,
  ): ReadonlyMap<number, KinematicTrajectory3D> {
    const trajectories = new Map<number, KinematicTrajectory3D>();
    for (const [bodyId, pose] of sortedEntries(targets)) {
      const slot = this.state.bodySlots.get(bodyId);
      if (slot === undefined) continue;
      const index = slot.index;
      if (
        (this.bodies.flags[index]! & BODY_TYPE_MASK_3D) !==
        BODY_TYPE_KINEMATIC_3D
      ) {
        continue;
      }
      trajectories.set(
        bodyId,
        Object.freeze({
          from: this.authoritativePose(bodyId),
          to: copyKinematicTargetPose(pose),
        }),
      );
    }
    return trajectories;
  }

  private snapKinematicTargets(
    trajectories: ReadonlyMap<number, KinematicTrajectory3D>,
    step: number,
    stepCount: number,
  ): void {
    const alpha = (step + 1) / stepCount;
    for (const [bodyId, trajectory] of sortedEntries(trajectories)) {
      const slot = this.state.bodySlots.get(bodyId);
      if (slot === undefined) continue;
      const index = slot.index;
      if (
        (this.bodies.flags[index]! & BODY_TYPE_MASK_3D) !==
        BODY_TYPE_KINEMATIC_3D
      ) {
        continue;
      }
      this.setBodyOriginPose(index, {
        position: Object.freeze([
          lerp(trajectory.from.position[0], trajectory.to.position[0], alpha),
          lerp(trajectory.from.position[1], trajectory.to.position[1], alpha),
          lerp(trajectory.from.position[2], trajectory.to.position[2], alpha),
        ] as const),
        orientation: slerpCanonical(
          trajectory.from.orientation[0],
          trajectory.from.orientation[1],
          trajectory.from.orientation[2],
          trajectory.from.orientation[3],
          trajectory.to.orientation[0],
          trajectory.to.orientation[1],
          trajectory.to.orientation[2],
          trajectory.to.orientation[3],
          alpha,
        ) as unknown as CRCPhysicsQuaternion,
      });
    }
  }

  private stageContactEvents(): void {
    for (let event = 0; event < this.contacts.eventCount; event += 1) {
      const first = this.contacts.eventFirstColliderIndices[event]!;
      const firstGeneration =
        this.contacts.eventFirstColliderGenerations[event]!;
      const second = this.contacts.eventSecondColliderIndices[event]!;
      const secondGeneration =
        this.contacts.eventSecondColliderGenerations[event]!;
      const kind = this.contacts.eventTypes[event]!;
      const contact = this.findContact(
        first,
        firstGeneration,
        second,
        secondGeneration,
      );
      const key = contactKey(first, firstGeneration, second, secondGeneration);
      this.appendEvent(
        kind,
        first,
        second,
        firstGeneration,
        secondGeneration,
        kind === CONTACT_EVENT_END_3D || kind === OVERLAP_EVENT_END_3D
          ? this.state.contactEventFacts.get(key)
          : contact === NO_INDEX
            ? undefined
            : this.contactEventFact(contact),
      );
    }
    for (let contact = 0; contact < this.contacts.contactCount; contact += 1) {
      if (this.contacts.sensorFlags[contact] !== 0) continue;
      const first = this.contacts.firstColliderIndices[contact]!;
      const second = this.contacts.secondColliderIndices[contact]!;
      if (
        !hasColliderHandler(this.colliders.handlers[first], "onHit") &&
        !hasColliderHandler(this.colliders.handlers[second], "onHit")
      ) {
        continue;
      }
      const fact = this.contactEventFact(contact);
      if (fact.totalNormalImpulse <= 0) continue;
      this.appendEvent(
        7,
        first,
        second,
        this.contacts.firstColliderGenerations[contact]!,
        this.contacts.secondColliderGenerations[contact]!,
        fact,
      );
    }
    this.state.contactEventFacts.clear();
    for (let contact = 0; contact < this.contacts.contactCount; contact += 1) {
      this.state.contactEventFacts.set(
        contactKey(
          this.contacts.firstColliderIndices[contact]!,
          this.contacts.firstColliderGenerations[contact]!,
          this.contacts.secondColliderIndices[contact]!,
          this.contacts.secondColliderGenerations[contact]!,
        ),
        this.contactEventFact(contact),
      );
    }
  }

  private findContact(
    first: number,
    firstGeneration: number,
    second: number,
    secondGeneration: number,
  ): number {
    for (let contact = 0; contact < this.contacts.contactCount; contact += 1) {
      if (
        this.contacts.firstColliderIndices[contact] === first &&
        this.contacts.firstColliderGenerations[contact] === firstGeneration &&
        this.contacts.secondColliderIndices[contact] === second &&
        this.contacts.secondColliderGenerations[contact] === secondGeneration
      ) {
        return contact;
      }
    }
    return NO_INDEX;
  }

  private contactEventFact(contact: number): ContactEventFact3D {
    const base = contact * POINTS_PER_CONTACT;
    const pointCount = this.contacts.pointCounts[contact]!;
    const pointFirstX: number[] = [];
    const pointFirstY: number[] = [];
    const pointFirstZ: number[] = [];
    const pointSecondX: number[] = [];
    const pointSecondY: number[] = [];
    const pointSecondZ: number[] = [];
    const pointSeparations: number[] = [];
    let totalNormalImpulse = 0;
    for (let offset = 0; offset < POINTS_PER_CONTACT; offset += 1) {
      const point = base + offset;
      pointFirstX.push(this.contacts.pointFirstX[point]!);
      pointFirstY.push(this.contacts.pointFirstY[point]!);
      pointFirstZ.push(this.contacts.pointFirstZ[point]!);
      pointSecondX.push(this.contacts.pointSecondX[point]!);
      pointSecondY.push(this.contacts.pointSecondY[point]!);
      pointSecondZ.push(this.contacts.pointSecondZ[point]!);
      pointSeparations.push(this.contacts.pointSeparations[point]!);
      totalNormalImpulse += this.contacts.pointNormalImpulses[point]!;
    }
    return Object.freeze({
      normalX: this.contacts.normalX[contact]!,
      normalY: this.contacts.normalY[contact]!,
      normalZ: this.contacts.normalZ[contact]!,
      pointCount,
      pointFirstX: Object.freeze(pointFirstX),
      pointFirstY: Object.freeze(pointFirstY),
      pointFirstZ: Object.freeze(pointFirstZ),
      pointSecondX: Object.freeze(pointSecondX),
      pointSecondY: Object.freeze(pointSecondY),
      pointSecondZ: Object.freeze(pointSecondZ),
      pointSeparations: Object.freeze(pointSeparations),
      totalNormalImpulse,
    });
  }

  private solvePositions(): void {
    const pointCount = this.contacts.contactCount * POINTS_PER_CONTACT;
    this.ensureSavedImpulseCapacity(pointCount);
    this.state.savedNormalImpulses.set(
      this.contacts.pointNormalImpulses.subarray(0, pointCount),
    );
    this.state.savedTangentImpulses1.set(
      this.contacts.pointTangentImpulse1.subarray(0, pointCount),
    );
    this.state.savedTangentImpulses2.set(
      this.contacts.pointTangentImpulse2.subarray(0, pointCount),
    );
    this.contacts.pointNormalImpulses.fill(0, 0, pointCount);
    this.contacts.pointTangentImpulse1.fill(0, 0, pointCount);
    this.contacts.pointTangentImpulse2.fill(0, 0, pointCount);
    this.positionSolver.solveCandidate(
      this.bodies,
      this.state.bodyIndices,
      this.state.bodyCount,
      this.contacts,
      0,
      this.state.configuration.positionIterations,
    );
    this.contacts.pointNormalImpulses.set(
      this.state.savedNormalImpulses.subarray(0, pointCount),
    );
    this.contacts.pointTangentImpulse1.set(
      this.state.savedTangentImpulses1.subarray(0, pointCount),
    );
    this.contacts.pointTangentImpulse2.set(
      this.state.savedTangentImpulses2.subarray(0, pointCount),
    );
    this.solver.positionIterationsPerformed =
      this.positionSolver.positionIterationsPerformed;
  }

  private ensureSavedImpulseCapacity(required: number): void {
    if (required <= this.state.savedNormalImpulses.length) return;
    const capacity = normalizedCapacity(required);
    this.state.savedNormalImpulses = growFloat64(
      this.state.savedNormalImpulses,
      capacity,
    );
    this.state.savedTangentImpulses1 = growFloat64(
      this.state.savedTangentImpulses1,
      capacity,
    );
    this.state.savedTangentImpulses2 = growFloat64(
      this.state.savedTangentImpulses2,
      capacity,
    );
  }

  private appendEvent(
    kind: number,
    first: number,
    second: number,
    firstGeneration = 0,
    secondGeneration = 0,
    fact?: ContactEventFact3D,
  ): void {
    this.ensureEventCapacity(this.state.eventCount + 1);
    const event = this.state.eventCount;
    this.state.eventTicks[event] = this.state.tick + 1;
    this.state.eventKinds[event] = kind;
    this.state.eventFirstColliderIndices[event] = first;
    this.state.eventFirstColliderGenerations[event] = firstGeneration;
    this.state.eventSecondColliderIndices[event] = second;
    this.state.eventSecondColliderGenerations[event] = secondGeneration;
    this.state.eventNormalX[event] = fact?.normalX ?? 0;
    this.state.eventNormalY[event] = fact?.normalY ?? 0;
    this.state.eventNormalZ[event] = fact?.normalZ ?? 0;
    this.state.eventPointCounts[event] = fact?.pointCount ?? 0;
    this.state.eventTotalNormalImpulses[event] = fact?.totalNormalImpulse ?? 0;
    const base = event * POINTS_PER_CONTACT;
    for (let offset = 0; offset < POINTS_PER_CONTACT; offset += 1) {
      const point = base + offset;
      this.state.eventPointFirstX[point] = fact?.pointFirstX[offset] ?? 0;
      this.state.eventPointFirstY[point] = fact?.pointFirstY[offset] ?? 0;
      this.state.eventPointFirstZ[point] = fact?.pointFirstZ[offset] ?? 0;
      this.state.eventPointSecondX[point] = fact?.pointSecondX[offset] ?? 0;
      this.state.eventPointSecondY[point] = fact?.pointSecondY[offset] ?? 0;
      this.state.eventPointSecondZ[point] = fact?.pointSecondZ[offset] ?? 0;
      this.state.eventPointSeparations[point] =
        fact?.pointSeparations[offset] ?? 0;
    }
    this.state.eventCount += 1;
  }

  private ensureEventCapacity(required: number): void {
    if (required <= this.state.eventKinds.length) return;
    const capacity = normalizedCapacity(required);
    this.state.eventTicks = growFloat64(this.state.eventTicks, capacity);
    this.state.eventKinds = growUint8(this.state.eventKinds, capacity);
    this.state.eventFirstColliderIndices = growInt32(
      this.state.eventFirstColliderIndices,
      capacity,
    );
    this.state.eventFirstColliderGenerations = growUint32(
      this.state.eventFirstColliderGenerations,
      capacity,
    );
    this.state.eventSecondColliderIndices = growInt32(
      this.state.eventSecondColliderIndices,
      capacity,
    );
    this.state.eventSecondColliderGenerations = growUint32(
      this.state.eventSecondColliderGenerations,
      capacity,
    );
    this.state.eventNormalX = growFloat64(this.state.eventNormalX, capacity);
    this.state.eventNormalY = growFloat64(this.state.eventNormalY, capacity);
    this.state.eventNormalZ = growFloat64(this.state.eventNormalZ, capacity);
    this.state.eventPointCounts = growUint8(
      this.state.eventPointCounts,
      capacity,
    );
    const pointCapacity = capacity * POINTS_PER_CONTACT;
    this.state.eventPointFirstX = growFloat64(
      this.state.eventPointFirstX,
      pointCapacity,
    );
    this.state.eventPointFirstY = growFloat64(
      this.state.eventPointFirstY,
      pointCapacity,
    );
    this.state.eventPointFirstZ = growFloat64(
      this.state.eventPointFirstZ,
      pointCapacity,
    );
    this.state.eventPointSecondX = growFloat64(
      this.state.eventPointSecondX,
      pointCapacity,
    );
    this.state.eventPointSecondY = growFloat64(
      this.state.eventPointSecondY,
      pointCapacity,
    );
    this.state.eventPointSecondZ = growFloat64(
      this.state.eventPointSecondZ,
      pointCapacity,
    );
    this.state.eventPointSeparations = growFloat64(
      this.state.eventPointSeparations,
      pointCapacity,
    );
    this.state.eventTotalNormalImpulses = growFloat64(
      this.state.eventTotalNormalImpulses,
      capacity,
    );
  }

  private capturePreviousPoses(): void {
    for (let offset = 0; offset < this.state.bodyCount; offset += 1) {
      this.snapPreviousPose(this.state.bodyIndices[offset]!);
    }
  }

  private snapPreviousPose(index: number): void {
    this.state.previousPositionX[index] = this.bodies.positionX[index]!;
    this.state.previousPositionY[index] = this.bodies.positionY[index]!;
    this.state.previousPositionZ[index] = this.bodies.positionZ[index]!;
    this.state.previousOrientationX[index] = this.bodies.orientationX[index]!;
    this.state.previousOrientationY[index] = this.bodies.orientationY[index]!;
    this.state.previousOrientationZ[index] = this.bodies.orientationZ[index]!;
    this.state.previousOrientationW[index] = this.bodies.orientationW[index]!;
  }

  private setBodyOriginPose(index: number, pose: PhysicsPose3D): void {
    const orientation = copyCanonicalQuaternion(
      pose.orientation,
      "body pose orientation",
    );
    const position = copyFiniteVector3(pose.position, "body pose position");
    const center = centerFromOrigin(this.bodies, index, position, orientation);
    this.bodies.positionX[index] = center[0]!;
    this.bodies.positionY[index] = center[1]!;
    this.bodies.positionZ[index] = center[2]!;
    this.bodies.orientationX[index] = orientation[0]!;
    this.bodies.orientationY[index] = orientation[1]!;
    this.bodies.orientationZ[index] = orientation[2]!;
    this.bodies.orientationW[index] = orientation[3]!;
  }

  private rebuildBodyIndices(): void {
    this.ensureBodyScratchCapacity();
    const indices = [...this.state.bodySlots.values()]
      .map((slot) => slot.index)
      .sort((first, second) => first - second);
    this.state.bodyCount = indices.length;
    for (let offset = 0; offset < indices.length; offset += 1) {
      this.state.bodyIndices[offset] = indices[offset]!;
    }
  }

  private rebuildIntegrationBodyIndices(): void {
    let count = 0;
    for (let offset = 0; offset < this.state.bodyCount; offset += 1) {
      const body = this.state.bodyIndices[offset]!;
      if ((this.bodies.flags[body]! & BODY_ENABLED_3D) === 0) continue;
      if ((this.bodies.flags[body]! & BODY_SLEEPING_3D) !== 0) continue;
      this.state.integrationBodyIndices[count] = body;
      count += 1;
    }
    this.state.integrationBodyCount = count;
  }

  private ensureBodyScratchCapacity(): void {
    if (this.bodies.capacity <= this.state.previousPositionX.length) return;
    const capacity = this.bodies.capacity;
    this.state.previousPositionX = growFloat64(
      this.state.previousPositionX,
      capacity,
    );
    this.state.previousPositionY = growFloat64(
      this.state.previousPositionY,
      capacity,
    );
    this.state.previousPositionZ = growFloat64(
      this.state.previousPositionZ,
      capacity,
    );
    this.state.previousOrientationX = growFloat64(
      this.state.previousOrientationX,
      capacity,
    );
    this.state.previousOrientationY = growFloat64(
      this.state.previousOrientationY,
      capacity,
    );
    this.state.previousOrientationZ = growFloat64(
      this.state.previousOrientationZ,
      capacity,
    );
    this.state.previousOrientationW = growFloat64(
      this.state.previousOrientationW,
      capacity,
    );
    this.state.bodyIndices = growInt32(this.state.bodyIndices, capacity);
    this.state.integrationBodyIndices = growInt32(
      this.state.integrationBodyIndices,
      capacity,
    );
  }

  private wakeBody(bodyIndex: number): boolean {
    const wasSleeping =
      (this.bodies.flags[bodyIndex]! & BODY_SLEEPING_3D) !== 0;
    let targetWakeRecorded = false;
    const islandChanged = this.solver.wakeIslandContainingCandidate(
      this.bodies,
      bodyIndex,
      (body, sleeping) => {
        if (body === bodyIndex && !sleeping) targetWakeRecorded = true;
        this.appendEvent(sleeping ? 6 : 5, body, NO_INDEX);
      },
    );
    this.bodies.flags[bodyIndex] &= ~BODY_SLEEPING_3D;
    this.bodies.sleepTime[bodyIndex] = 0;
    if (wasSleeping && !targetWakeRecorded) {
      this.appendEvent(5, bodyIndex, NO_INDEX);
    }
    return wasSleeping || islandChanged;
  }

  private captureCheckpoint(): WorldCheckpoint3D {
    return {
      snapshots: [
        captureObject(this.state),
        captureObject(this.counters),
        captureObject(this.bodies),
        captureObject(this.colliders),
        captureObject(this.broadPhase),
        captureObject(this.contacts),
        captureObject(this.solver),
        captureObject(this.positionSolver),
        captureObject(this.ccd),
      ],
    };
  }

  private restoreCheckpoint(checkpoint: WorldCheckpoint3D): void {
    for (let index = checkpoint.snapshots.length - 1; index >= 0; index -= 1) {
      restoreObject(checkpoint.snapshots[index]!);
    }
  }

  private requireBody(bodyId: number): BodySlot3D {
    const slot = this.state.bodySlots.get(bodyId);
    if (slot === undefined) {
      throw new Error(`unknown physics body ${String(bodyId)}.`);
    }
    return slot;
  }

  private hasAdvanceWork(
    stagedKinematicTargets: ReadonlyMap<number, PhysicsPose3D>,
  ): boolean {
    if (
      (this.pendingTopology !== undefined &&
        this.nextTopologyRevision > this.state.topologyRevision) ||
      (this.pendingCommands.length > 0 &&
        this.nextCommandRevision > this.state.commandRevision)
    ) {
      return true;
    }
    const stationaryTargetBodies = new Set<number>();
    for (const [bodyId, pose] of sortedEntries(stagedKinematicTargets)) {
      const slot = this.state.bodySlots.get(bodyId);
      if (slot === undefined) continue;
      const body = slot.index;
      if (
        (this.bodies.flags[body]! & BODY_ENABLED_3D) === 0 ||
        (this.bodies.flags[body]! & BODY_TYPE_MASK_3D) !==
          BODY_TYPE_KINEMATIC_3D
      ) {
        continue;
      }
      const orientation = copyCanonicalQuaternion(
        pose.orientation,
        "kinematic target orientation",
      );
      const center = centerFromOrigin(
        this.bodies,
        body,
        pose.position,
        orientation,
      );
      const orientationDot = Math.abs(
        orientation[0]! * this.bodies.orientationX[body]! +
          orientation[1]! * this.bodies.orientationY[body]! +
          orientation[2]! * this.bodies.orientationZ[body]! +
          orientation[3]! * this.bodies.orientationW[body]!,
      );
      if (
        Math.abs(center[0]! - this.bodies.positionX[body]!) > 1e-12 ||
        Math.abs(center[1]! - this.bodies.positionY[body]!) > 1e-12 ||
        Math.abs(center[2]! - this.bodies.positionZ[body]!) > 1e-12 ||
        1 - orientationDot > 1e-12
      ) {
        return true;
      }
      stationaryTargetBodies.add(body);
    }
    for (let offset = 0; offset < this.state.bodyCount; offset += 1) {
      const body = this.state.bodyIndices[offset]!;
      const type = this.bodies.flags[body]! & BODY_TYPE_MASK_3D;
      if (
        type === BODY_TYPE_KINEMATIC_3D &&
        !stationaryTargetBodies.has(body) &&
        (this.bodies.linearVelocityX[body] !== 0 ||
          this.bodies.linearVelocityY[body] !== 0 ||
          this.bodies.linearVelocityZ[body] !== 0 ||
          this.bodies.angularVelocityX[body] !== 0 ||
          this.bodies.angularVelocityY[body] !== 0 ||
          this.bodies.angularVelocityZ[body] !== 0)
      ) {
        return true;
      }
      if (
        type === BODY_TYPE_DYNAMIC_3D &&
        (this.bodies.flags[body]! & BODY_SLEEPING_3D) === 0
      ) {
        return true;
      }
    }
    return false;
  }

  private assertCandidate(candidate: PhysicsWorld3DCandidate): void {
    this.assertUsable();
    if (
      candidate.owner !== this ||
      candidate !== this.liveCandidate ||
      candidate.lifecycle !== "live"
    ) {
      throw new Error("candidate is not the live candidate for this world.");
    }
  }

  private assertUsable(): void {
    if (this.disposed) throw new Error("physics world is disposed.");
  }
}

export function normalizePhysicsWorld3DConfiguration(
  configuration: PhysicsWorld3DConfiguration,
): NormalizedPhysicsWorld3DConfiguration {
  const gravity = configuration.gravity ?? ([0, 0, 0] as const);
  if (
    gravity.length !== 3 ||
    !Number.isFinite(gravity[0]) ||
    !Number.isFinite(gravity[1]) ||
    !Number.isFinite(gravity[2])
  ) {
    throw new RangeError("gravity must contain three finite numbers.");
  }
  const fixedStepMilliseconds =
    configuration.fixedStepMilliseconds ?? DEFAULT_FIXED_STEP_MILLISECONDS;
  if (!Number.isFinite(fixedStepMilliseconds) || fixedStepMilliseconds <= 0) {
    throw new RangeError("fixedStepMilliseconds must be finite and positive.");
  }
  const maxCatchUpSteps =
    configuration.maxCatchUpSteps ?? DEFAULT_MAX_CATCH_UP_STEPS;
  validateIntegerRange(
    maxCatchUpSteps,
    1,
    MAX_CATCH_UP_STEPS,
    "maxCatchUpSteps",
  );
  const interpolation = configuration.interpolation ?? "linear";
  if (interpolation !== "linear" && interpolation !== "none") {
    throw new RangeError('interpolation must be "linear" or "none".');
  }
  const velocityIterations =
    configuration.solver?.velocityIterations ??
    configuration.velocityIterations ??
    DEFAULT_VELOCITY_ITERATIONS;
  const positionIterations =
    configuration.solver?.positionIterations ??
    configuration.positionIterations ??
    DEFAULT_POSITION_ITERATIONS;
  validateIntegerRange(
    velocityIterations,
    1,
    MAX_SOLVER_ITERATIONS,
    "velocityIterations",
  );
  validateIntegerRange(
    positionIterations,
    1,
    MAX_SOLVER_ITERATIONS,
    "positionIterations",
  );
  return Object.freeze({
    gravityX: gravity[0],
    gravityY: gravity[1],
    gravityZ: gravity[2],
    fixedStepMilliseconds,
    maxCatchUpSteps,
    interpolation,
    sleeping: configuration.sleeping ?? true,
    velocityIterations,
    positionIterations,
  });
}

function captureObject(target: object): ObjectSnapshot {
  const record = target as Record<PropertyKey, unknown>;
  const values = Reflect.ownKeys(record).map((key): ValueSnapshot => {
    const value = record[key];
    if (ArrayBuffer.isView(value) && !(value instanceof DataView)) {
      return {
        key,
        kind: "typed-array",
        reference: value,
        contents: (value as Float64Array).slice(),
      };
    }
    if (Array.isArray(value)) {
      return { key, kind: "array", reference: value, contents: [...value] };
    }
    if (value instanceof Map) {
      return {
        key,
        kind: "map",
        reference: value,
        contents: [...value.entries()],
      };
    }
    return { key, kind: "value", reference: value };
  });
  return { target: record, values };
}

function restoreObject(snapshot: ObjectSnapshot): void {
  for (let index = snapshot.values.length - 1; index >= 0; index -= 1) {
    const value = snapshot.values[index]!;
    switch (value.kind) {
      case "typed-array": {
        snapshot.target[value.key] = value.reference;
        const target = value.reference as Float64Array;
        target.set(value.contents as Float64Array);
        break;
      }
      case "array": {
        snapshot.target[value.key] = value.reference;
        const target = value.reference as unknown[];
        target.length = 0;
        target.push(...(value.contents as unknown[]));
        break;
      }
      case "map": {
        snapshot.target[value.key] = value.reference;
        const target = value.reference as Map<unknown, unknown>;
        target.clear();
        for (const [key, entry] of value.contents as readonly (readonly [
          unknown,
          unknown,
        ])[]) {
          target.set(key, entry);
        }
        break;
      }
      case "value":
        snapshot.target[value.key] = value.reference;
        break;
    }
  }
}

function validateTopology(records: readonly PhysicsTopologyRecord3D[]): void {
  const bodyIds = new Set<number>();
  const bodyDefinitions = new Map<number, BodyDefinition3D>();
  const colliderIds = new Set<number>();
  for (const record of records) {
    validateId(record.id, `${record.kind} id`);
    const ids = record.kind === "body" ? bodyIds : colliderIds;
    if (ids.has(record.id)) {
      throw new Error(`duplicate ${record.kind} id ${String(record.id)}.`);
    }
    ids.add(record.id);
    if (record.kind === "body") {
      validateBodyDefinition(record.definition);
      bodyDefinitions.set(record.id, record.definition);
    } else {
      validateId(record.bodyId, "collider bodyId");
      validateColliderDefinition(record.definition);
    }
  }
  for (const record of records) {
    if (record.kind === "collider" && !bodyIds.has(record.bodyId)) {
      throw new Error(
        `collider ${String(record.id)} references missing body ${String(record.bodyId)}.`,
      );
    }
    if (record.kind === "collider") {
      const body = bodyDefinitions.get(record.bodyId);
      if (
        body !== undefined &&
        (body.flags & BODY_TYPE_MASK_3D) !== 0 &&
        isConcaveShapeRecord3D(record.definition.shape)
      ) {
        throw new Error(
          "triangle mesh and heightfield colliders require a static body.",
        );
      }
    }
  }
}

function validateBodyDefinition(definition: BodyDefinition3D): void {
  for (const [name, value] of Object.entries(definition)) {
    if (name === "owner" || name === "flags") continue;
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new RangeError(`body ${name} must be finite.`);
    }
  }
  if (!Number.isSafeInteger(definition.flags) || definition.flags < 0) {
    throw new RangeError("body flags must be a nonnegative safe integer.");
  }
  copyCanonicalQuaternion(
    [
      definition.orientationX,
      definition.orientationY,
      definition.orientationZ,
      definition.orientationW,
    ],
    "body orientation",
  );
}

function validateColliderDefinition(
  definition: Omit<ColliderDefinition3D, "bodyIndex" | "bodyGeneration">,
): void {
  for (const name of [
    "localPositionX",
    "localPositionY",
    "localPositionZ",
    "localOrientationX",
    "localOrientationY",
    "localOrientationZ",
    "localOrientationW",
    "density",
    "friction",
    "restitution",
  ] as const) {
    if (!Number.isFinite(definition[name])) {
      throw new RangeError(`collider ${name} must be finite.`);
    }
  }
  copyCanonicalQuaternion(
    [
      definition.localOrientationX,
      definition.localOrientationY,
      definition.localOrientationZ,
      definition.localOrientationW,
    ],
    "collider local orientation",
  );
}

function validateCommand(command: PhysicsCommand3D): void {
  if (command.kind === "configure") {
    normalizePhysicsWorld3DConfiguration(command.configuration);
    return;
  }
  validateId(command.bodyId, "command bodyId");
  if (command.kind === "set-pose") {
    validatePose(command.pose, "command pose");
    return;
  }
  if (command.kind === "enable") {
    if (command.velocity !== "zero" && command.velocity !== "preserve") {
      throw new RangeError('command velocity must be "zero" or "preserve".');
    }
    return;
  }
  for (const [name, value] of Object.entries(command)) {
    if (name === "kind" || name === "bodyId" || name === "wake") continue;
    if (name.startsWith("point") && value === undefined) continue;
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new RangeError(`command ${name} must be finite.`);
    }
  }
}

function validatePose(pose: PhysicsPose3D, path: string): void {
  copyFiniteVector3(pose.position, `${path}.position`);
  copyCanonicalQuaternion(pose.orientation, `${path}.orientation`);
}

function copyKinematicTargetPose(pose: PhysicsPose3D): PhysicsPose3D {
  const position = copyFiniteVector3(
    pose.position,
    "staged kinematic pose.position",
  );
  const orientation = copyCanonicalQuaternion(
    pose.orientation,
    "staged kinematic pose.orientation",
  );
  return Object.freeze({
    position: Object.freeze([
      position[0]!,
      position[1]!,
      position[2]!,
    ] as const),
    orientation: Object.freeze([
      orientation[0]!,
      orientation[1]!,
      orientation[2]!,
      orientation[3]!,
    ] as const),
  });
}

function validateId(value: number, path: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${path} must be a nonnegative safe integer.`);
  }
}

function validateIntegerRange(
  value: number,
  minimum: number,
  maximum: number,
  path: string,
): void {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(
      `${path} must be an integer from ${String(minimum)} through ${String(maximum)}.`,
    );
  }
}

function injectFailure(stage: PhysicsWorld3DFailureStage): void {
  failureInjector?.(stage);
}

function hasColliderHandler(handlers: unknown, name: "onHit"): boolean {
  return (
    typeof handlers === "object" &&
    handlers !== null &&
    typeof (handlers as Readonly<Record<string, unknown>>)[name] === "function"
  );
}

function contactKey(
  first: number,
  firstGeneration: number,
  second: number,
  secondGeneration: number,
): string {
  return `${String(first)}:${String(firstGeneration)}:${String(second)}:${String(secondGeneration)}`;
}

function writeBodyDefinition(
  bodies: BodyStore3D,
  index: number,
  definition: BodyDefinition3D,
): void {
  const orientation = copyCanonicalQuaternion(
    [
      definition.orientationX,
      definition.orientationY,
      definition.orientationZ,
      definition.orientationW,
    ],
    "body orientation",
  );
  bodies.positionX[index] = definition.positionX;
  bodies.positionY[index] = definition.positionY;
  bodies.positionZ[index] = definition.positionZ;
  bodies.orientationX[index] = orientation[0]!;
  bodies.orientationY[index] = orientation[1]!;
  bodies.orientationZ[index] = orientation[2]!;
  bodies.orientationW[index] = orientation[3]!;
  bodies.localCenterX[index] = definition.localCenterX ?? 0;
  bodies.localCenterY[index] = definition.localCenterY ?? 0;
  bodies.localCenterZ[index] = definition.localCenterZ ?? 0;
  bodies.linearVelocityX[index] = definition.linearVelocityX;
  bodies.linearVelocityY[index] = definition.linearVelocityY;
  bodies.linearVelocityZ[index] = definition.linearVelocityZ;
  bodies.angularVelocityX[index] = definition.angularVelocityX;
  bodies.angularVelocityY[index] = definition.angularVelocityY;
  bodies.angularVelocityZ[index] = definition.angularVelocityZ;
  bodies.forceX[index] = definition.forceX;
  bodies.forceY[index] = definition.forceY;
  bodies.forceZ[index] = definition.forceZ;
  bodies.torqueX[index] = definition.torqueX;
  bodies.torqueY[index] = definition.torqueY;
  bodies.torqueZ[index] = definition.torqueZ;
  bodies.inverseMass[index] = definition.inverseMass;
  bodies.localInverseInertiaXX[index] = definition.localInverseInertiaXX;
  bodies.localInverseInertiaYY[index] = definition.localInverseInertiaYY;
  bodies.localInverseInertiaZZ[index] = definition.localInverseInertiaZZ;
  bodies.localInverseInertiaXY[index] = definition.localInverseInertiaXY;
  bodies.localInverseInertiaXZ[index] = definition.localInverseInertiaXZ;
  bodies.localInverseInertiaYZ[index] = definition.localInverseInertiaYZ;
  bodies.linearDamping[index] = definition.linearDamping;
  bodies.angularDamping[index] = definition.angularDamping;
  bodies.gravityScale[index] = definition.gravityScale;
  bodies.sleepTime[index] = definition.sleepTime;
  bodies.translationLocks[index] = definition.translationLocks;
  bodies.rotationLocks[index] = definition.rotationLocks;
  bodies.flags[index] = definition.flags;
  bodies.owners[index] = definition.owner;
}

function sameBodyDefinition(
  first: BodyDefinition3D | undefined,
  second: BodyDefinition3D,
): boolean {
  if (first === undefined) return false;
  const keys = Reflect.ownKeys(second) as (keyof BodyDefinition3D)[];
  const firstKeys = Reflect.ownKeys(first);
  if (keys.length !== firstKeys.length) return false;
  return keys.every((key) => first[key] === second[key]);
}

function sameColliderRecord(
  first: PhysicsColliderTopologyRecord3D | undefined,
  second: PhysicsColliderTopologyRecord3D,
): boolean {
  if (first === undefined || first.bodyId !== second.bodyId) return false;
  const firstDefinition = first.definition as Record<PropertyKey, unknown>;
  const secondDefinition = second.definition as Record<PropertyKey, unknown>;
  const keys = Reflect.ownKeys(secondDefinition);
  if (keys.length !== Reflect.ownKeys(firstDefinition).length) return false;
  return keys.every((key) => firstDefinition[key] === secondDefinition[key]);
}

function zeroBodyMotion(bodies: BodyStore3D, index: number): void {
  bodies.linearVelocityX[index] = 0;
  bodies.linearVelocityY[index] = 0;
  bodies.linearVelocityZ[index] = 0;
  bodies.angularVelocityX[index] = 0;
  bodies.angularVelocityY[index] = 0;
  bodies.angularVelocityZ[index] = 0;
  bodies.forceX[index] = 0;
  bodies.forceY[index] = 0;
  bodies.forceZ[index] = 0;
  bodies.torqueX[index] = 0;
  bodies.torqueY[index] = 0;
  bodies.torqueZ[index] = 0;
}

function zeroDisabledBody(bodies: BodyStore3D, index: number): void {
  bodies.flags[index] = 0;
  zeroBodyMotion(bodies, index);
}

function publicBodyOriginPose(
  bodies: BodyStore3D,
  index: number,
): PhysicsPose3D {
  return publicOriginPoseFromCenter(
    bodies,
    index,
    bodies.positionX[index]!,
    bodies.positionY[index]!,
    bodies.positionZ[index]!,
    new Float64Array([
      bodies.orientationX[index]!,
      bodies.orientationY[index]!,
      bodies.orientationZ[index]!,
      bodies.orientationW[index]!,
    ]),
  );
}

function publicOriginPoseFromCenter(
  bodies: BodyStore3D,
  index: number,
  centerX: number,
  centerY: number,
  centerZ: number,
  orientation: ArrayLike<number>,
): PhysicsPose3D {
  const offset = new Float64Array(3);
  rotateVectorInto(
    offset,
    [
      bodies.localCenterX[index]!,
      bodies.localCenterY[index]!,
      bodies.localCenterZ[index]!,
    ],
    orientation,
  );
  return Object.freeze({
    position: Object.freeze([
      cleanZero(centerX - offset[0]!),
      cleanZero(centerY - offset[1]!),
      cleanZero(centerZ - offset[2]!),
    ] as const),
    orientation: Object.freeze([
      cleanZero(orientation[0]!),
      cleanZero(orientation[1]!),
      cleanZero(orientation[2]!),
      cleanZero(orientation[3]!),
    ] as const),
  });
}

function centerFromOrigin(
  bodies: BodyStore3D,
  index: number,
  origin: ArrayLike<number>,
  orientation: ArrayLike<number>,
): Float64Array {
  const offset = new Float64Array(3);
  rotateVectorInto(
    offset,
    [
      bodies.localCenterX[index]!,
      bodies.localCenterY[index]!,
      bodies.localCenterZ[index]!,
    ],
    orientation,
  );
  return new Float64Array([
    cleanZero(origin[0]! + offset[0]!),
    cleanZero(origin[1]! + offset[1]!),
    cleanZero(origin[2]! + offset[2]!),
  ]);
}

function colliderWorldPose(
  bodies: BodyStore3D,
  colliders: ColliderStore3D,
  collider: number,
): InternalPose3D {
  const body = colliders.bodyIndices[collider]!;
  const orientation = new Float64Array([
    bodies.orientationX[body]!,
    bodies.orientationY[body]!,
    bodies.orientationZ[body]!,
    bodies.orientationW[body]!,
  ]);
  const origin = publicBodyOriginPose(bodies, body).position;
  return composePose3D(
    {
      position: new Float64Array(origin),
      orientation,
    },
    {
      position: new Float64Array([
        colliders.localPositionX[collider]!,
        colliders.localPositionY[collider]!,
        colliders.localPositionZ[collider]!,
      ]),
      orientation: new Float64Array([
        colliders.localOrientationX[collider]!,
        colliders.localOrientationY[collider]!,
        colliders.localOrientationZ[collider]!,
        colliders.localOrientationW[collider]!,
      ]),
    },
  );
}

function colliderBounds(
  bodies: BodyStore3D,
  colliders: ColliderStore3D,
  collider: number,
): readonly [number, number, number, number, number, number] {
  const record = colliders.shapes[collider];
  if (record === null) return [0, 0, 0, 0, 0, 0];
  const pose = colliderWorldPose(bodies, colliders, collider);
  const bounds = boundsOfShape3D(shapeForRecord3D(record), {
    position: [pose.position[0]!, pose.position[1]!, pose.position[2]!],
    orientation: [
      pose.orientation[0]!,
      pose.orientation[1]!,
      pose.orientation[2]!,
      pose.orientation[3]!,
    ],
  });
  return [
    bounds.min[0],
    bounds.min[1],
    bounds.min[2],
    bounds.max[0],
    bounds.max[1],
    bounds.max[2],
  ];
}

function boundsOverlap(
  first: readonly [number, number, number, number, number, number],
  second: readonly [number, number, number, number, number, number],
): boolean {
  return (
    first[0] <= second[3] &&
    first[3] >= second[0] &&
    first[1] <= second[4] &&
    first[4] >= second[1] &&
    first[2] <= second[5] &&
    first[5] >= second[2]
  );
}

function writeAngularVelocityToTarget(
  bodies: BodyStore3D,
  index: number,
  target: ArrayLike<number>,
  dt: number,
): void {
  const currentX = bodies.orientationX[index]!;
  const currentY = bodies.orientationY[index]!;
  const currentZ = bodies.orientationZ[index]!;
  const currentW = bodies.orientationW[index]!;
  let deltaX =
    target[0]! * currentW -
    target[3]! * currentX -
    target[1]! * currentZ +
    target[2]! * currentY;
  let deltaY =
    target[1]! * currentW -
    target[3]! * currentY -
    target[2]! * currentX +
    target[0]! * currentZ;
  let deltaZ =
    target[2]! * currentW -
    target[3]! * currentZ -
    target[0]! * currentY +
    target[1]! * currentX;
  let deltaW =
    target[3]! * currentW +
    target[0]! * currentX +
    target[1]! * currentY +
    target[2]! * currentZ;
  if (deltaW < 0) {
    deltaX = -deltaX;
    deltaY = -deltaY;
    deltaZ = -deltaZ;
    deltaW = -deltaW;
  }
  const vectorLength = Math.hypot(deltaX, deltaY, deltaZ);
  if (vectorLength <= Number.EPSILON) {
    bodies.angularVelocityX[index] = 0;
    bodies.angularVelocityY[index] = 0;
    bodies.angularVelocityZ[index] = 0;
    return;
  }
  const scale =
    (2 * Math.atan2(vectorLength, Math.max(0, deltaW))) / (vectorLength * dt);
  bodies.angularVelocityX[index] = deltaX * scale;
  bodies.angularVelocityY[index] = deltaY * scale;
  bodies.angularVelocityZ[index] = deltaZ * scale;
}

function slerpCanonical(
  fromX: number,
  fromY: number,
  fromZ: number,
  fromW: number,
  toX: number,
  toY: number,
  toZ: number,
  toW: number,
  alpha: number,
): Float64Array {
  let targetX = toX;
  let targetY = toY;
  let targetZ = toZ;
  let targetW = toW;
  let dot =
    fromX * targetX + fromY * targetY + fromZ * targetZ + fromW * targetW;
  if (dot < 0) {
    targetX = -targetX;
    targetY = -targetY;
    targetZ = -targetZ;
    targetW = -targetW;
    dot = -dot;
  }
  let x: number;
  let y: number;
  let z: number;
  let w: number;
  if (dot >= 1 - 1e-12) {
    x = lerp(fromX, targetX, alpha);
    y = lerp(fromY, targetY, alpha);
    z = lerp(fromZ, targetZ, alpha);
    w = lerp(fromW, targetW, alpha);
  } else {
    const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
    const sine = Math.sin(angle);
    const firstScale = Math.sin((1 - alpha) * angle) / sine;
    const secondScale = Math.sin(alpha * angle) / sine;
    x = fromX * firstScale + targetX * secondScale;
    y = fromY * firstScale + targetY * secondScale;
    z = fromZ * firstScale + targetZ * secondScale;
    w = fromW * firstScale + targetW * secondScale;
  }
  return copyCanonicalQuaternion([x, y, z, w], "interpolated orientation");
}

function lerp(first: number, second: number, alpha: number): number {
  return cleanZero(first + (second - first) * alpha);
}

function cleanZero(value: number): number {
  return value === 0 ? 0 : value;
}

function sortedEntries<K extends number, V>(
  map: ReadonlyMap<K, V>,
  descending = false,
): readonly (readonly [K, V])[] {
  return [...map.entries()].sort(([first], [second]) =>
    descending ? second - first : first - second,
  );
}

function normalizedCapacity(required: number): number {
  let capacity = 1;
  while (capacity < Math.max(1, required)) capacity *= 2;
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
