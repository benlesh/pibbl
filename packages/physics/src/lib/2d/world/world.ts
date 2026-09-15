import type { CRCPhysicsPose2D } from "../../../2d-geometry.js";
import { manifoldBetweenShapeRecords2D } from "../collision/pairs.js";
import type { InternalPose2D } from "../math.js";
import {
  DEFAULT_FIXED_STEP_MILLISECONDS,
  DEFAULT_GRAVITY,
  DEFAULT_INTERPOLATION,
  DEFAULT_MAX_CATCH_UP_STEPS,
  DEFAULT_POSITION_ITERATIONS,
  DEFAULT_SLEEPING,
  DEFAULT_VELOCITY_ITERATIONS,
  MAX_CATCH_UP_STEPS,
  MAX_SOLVER_ITERATIONS,
  MIN_CATCH_UP_STEPS,
  MIN_SOLVER_ITERATIONS,
  RADIANS_TO_DEGREES,
} from "../numeric-policy.js";
import { recordPhysicsWorld2DTrace } from "../runtime/trace.js";
import { createPhysicsOwnershipCounters2D } from "../runtime/ownership.js";
import { DynamicAabbBroadPhase2D } from "./broad-phase.js";
import { BoundedCcd2D, collisionFiltersAllow2D } from "./ccd.js";
import { ContactCache2D, updateSortedContactCache2D } from "./contact-cache.js";
import {
  BODY_TYPE_DYNAMIC_2D,
  BODY_TYPE_KINEMATIC_2D,
  applyForceAtPointToCandidateBody2D,
  applyImpulseAtPointToCandidateBody2D,
  applyTorqueToCandidateBody2D,
  integrateCandidateBodies2D,
} from "./integrator.js";
import { BODY_SLEEPING_2D, SequentialImpulseSolver2D } from "./solver.js";
import {
  BodyStore2D,
  ColliderStore2D,
  type BodyDefinition2D,
  type ColliderDefinition2D,
} from "./storage.js";

const NO_INDEX = -1;

export type PhysicsPose2D = CRCPhysicsPose2D;

export interface PhysicsWorld2DConfiguration {
  readonly gravity?: readonly [number, number];
  readonly fixedStepMilliseconds?: number;
  readonly maxCatchUpSteps?: number;
  readonly interpolation?: "linear" | "none";
  readonly sleeping?: boolean;
  readonly solver?: Readonly<{
    readonly velocityIterations?: number;
    readonly positionIterations?: number;
  }>;
  /** @internal Accepts already-flattened normalized configuration. */
  readonly velocityIterations?: number;
  /** @internal Accepts already-flattened normalized configuration. */
  readonly positionIterations?: number;
}

export interface NormalizedPhysicsWorld2DConfiguration {
  readonly gravityX: number;
  readonly gravityY: number;
  readonly fixedStepMilliseconds: number;
  readonly maxCatchUpSteps: number;
  readonly interpolation: "linear" | "none";
  readonly sleeping: boolean;
  readonly velocityIterations: number;
  readonly positionIterations: number;
}

export interface PhysicsBodyTopologyRecord2D {
  readonly kind: "body";
  readonly id: number;
  readonly definition: BodyDefinition2D;
}

export interface PhysicsColliderTopologyRecord2D {
  readonly kind: "collider";
  readonly id: number;
  readonly bodyId: number;
  readonly definition: Omit<
    ColliderDefinition2D,
    "bodyIndex" | "bodyGeneration"
  >;
}

export type PhysicsTopologyRecord2D =
  PhysicsBodyTopologyRecord2D | PhysicsColliderTopologyRecord2D;

export type PhysicsCommand2D =
  | Readonly<{
      kind: "apply-force";
      bodyId: number;
      forceX: number;
      forceY: number;
      pointX?: number;
      pointY?: number;
      wake?: boolean;
    }>
  | Readonly<{ kind: "apply-torque"; bodyId: number; torque: number }>
  | Readonly<{
      kind: "apply-impulse";
      bodyId: number;
      impulseX: number;
      impulseY: number;
      pointX?: number;
      pointY?: number;
      wake?: boolean;
    }>
  | Readonly<{
      kind: "set-pose";
      bodyId: number;
      pose: PhysicsPose2D;
    }>
  | Readonly<{
      kind: "set-velocity";
      bodyId: number;
      linearVelocityX: number;
      linearVelocityY: number;
      angularVelocityDegrees: number;
    }>
  | Readonly<{
      kind: "set-linear-velocity";
      bodyId: number;
      linearVelocityX: number;
      linearVelocityY: number;
    }>
  | Readonly<{
      kind: "set-angular-velocity";
      bodyId: number;
      angularVelocityDegrees: number;
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
      configuration: PhysicsWorld2DConfiguration;
    }>;

export type PhysicsBodyCommand2D = Exclude<
  PhysicsCommand2D,
  Readonly<{ kind: "configure"; configuration: PhysicsWorld2DConfiguration }>
>;

export type PhysicsWorld2DFailureStage =
  | "topology"
  | "broad-phase"
  | "narrow-phase"
  | "velocity-solve"
  | "position-solve"
  | "ccd"
  | "event-staging";

type PhysicsWorld2DFailureInjector = (
  stage: PhysicsWorld2DFailureStage,
) => void;

let failureInjector: PhysicsWorld2DFailureInjector | undefined;

/** @internal Test-only deterministic fault seam. */
export function installPhysicsWorld2DFailureInjectorForTest(
  injector: PhysicsWorld2DFailureInjector,
): () => void {
  const previous = failureInjector;
  failureInjector = injector;
  return () => {
    if (failureInjector === injector) failureInjector = previous;
  };
}

interface BodySlot2D {
  readonly index: number;
  readonly generation: number;
}

interface ColliderSlot2D {
  readonly index: number;
  readonly generation: number;
}

interface CoordinatorState2D {
  configuration: NormalizedPhysicsWorld2DConfiguration;
  accumulatorMilliseconds: number;
  previousLogicalTime: number;
  anchored: boolean;
  tick: number;
  topologyRevision: number;
  commandRevision: number;
  bodySlots: Map<number, BodySlot2D>;
  colliderSlots: Map<number, ColliderSlot2D>;
  bodyRecords: Map<number, PhysicsBodyTopologyRecord2D>;
  colliderRecords: Map<number, PhysicsColliderTopologyRecord2D>;
  disabledBodies: Map<number, DisabledBodyState2D>;
  previousPositionX: Float64Array;
  previousPositionY: Float64Array;
  previousRotationRadians: Float64Array;
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
  eventPointCounts: Uint8Array;
  eventPointFirstX: Float64Array;
  eventPointFirstY: Float64Array;
  eventPointSecondX: Float64Array;
  eventPointSecondY: Float64Array;
  eventPointSeparations: Float64Array;
  eventTotalNormalImpulses: Float64Array;
  eventCount: number;
  contactEventFacts: Map<string, ContactEventFact2D>;
  savedNormalImpulses: Float64Array;
  savedTangentImpulses: Float64Array;
}

interface ContactEventFact2D {
  readonly normalX: number;
  readonly normalY: number;
  readonly pointCount: number;
  readonly pointFirstX: readonly [number, number];
  readonly pointFirstY: readonly [number, number];
  readonly pointSecondX: readonly [number, number];
  readonly pointSecondY: readonly [number, number];
  readonly pointSeparations: readonly [number, number];
  readonly totalNormalImpulse: number;
}

interface DisabledBodyState2D {
  readonly flags: number;
  readonly linearVelocityX: number;
  readonly linearVelocityY: number;
  readonly angularVelocity: number;
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

interface WorldCheckpoint2D {
  readonly snapshots: readonly ObjectSnapshot[];
}

export interface PhysicsWorld2DSnapshot {
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
    rotationRadians: number;
    localCenterX: number;
    localCenterY: number;
    linearVelocityX: number;
    linearVelocityY: number;
    angularVelocity: number;
    inverseMass: number;
    inverseInertia: number;
    flags: number;
  }>[];
}

export class PhysicsWorld2DCandidate {
  private status: "live" | "adopted" | "discarded" = "live";

  constructor(
    readonly owner: PhysicsWorld2DKernel,
    private checkpoint: WorldCheckpoint2D | undefined,
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
    readonly eventPointCounts: Uint8Array,
    readonly eventPointFirstX: Float64Array,
    readonly eventPointFirstY: Float64Array,
    readonly eventPointSecondX: Float64Array,
    readonly eventPointSecondY: Float64Array,
    readonly eventPointSeparations: Float64Array,
    readonly eventTotalNormalImpulses: Float64Array,
    readonly topologyRevision: number,
    readonly commandRevision: number,
    readonly commandCount: number,
  ) {}

  get lifecycle(): "live" | "adopted" | "discarded" {
    return this.status;
  }

  consume(status: "adopted" | "discarded"): WorldCheckpoint2D {
    if (this.status !== "live") {
      throw new Error("physics world candidate has already been consumed.");
    }
    const checkpoint = this.checkpoint!;
    this.checkpoint = undefined;
    this.status = status;
    return checkpoint;
  }
}

export class PhysicsWorld2DKernel {
  readonly counters = createPhysicsOwnershipCounters2D();
  readonly bodies = new BodyStore2D(this.counters);
  readonly colliders = new ColliderStore2D(this.counters);
  readonly broadPhase = new DynamicAabbBroadPhase2D(this.counters);
  readonly contacts = new ContactCache2D();
  readonly solver = new SequentialImpulseSolver2D();
  private readonly positionSolver = new SequentialImpulseSolver2D();
  readonly ccd = new BoundedCcd2D();

  private readonly state: CoordinatorState2D;
  private pendingTopology: readonly PhysicsTopologyRecord2D[] | undefined;
  private pendingCommands: readonly PhysicsCommand2D[] = Object.freeze([]);
  private nextTopologyRevision = 0;
  private nextCommandRevision = 0;
  private liveCandidate: PhysicsWorld2DCandidate | undefined;
  private disposed = false;

  constructor(configuration: PhysicsWorld2DConfiguration = {}) {
    this.state = {
      configuration: normalizePhysicsWorld2DConfiguration(configuration),
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
      previousPositionX: new Float64Array(this.bodies.capacity),
      previousPositionY: new Float64Array(this.bodies.capacity),
      previousRotationRadians: new Float64Array(this.bodies.capacity),
      bodyIndices: new Int32Array(this.bodies.capacity),
      bodyCount: 0,
      integrationBodyIndices: new Int32Array(this.bodies.capacity),
      integrationBodyCount: 0,
      eventTicks: new Float64Array(4),
      eventKinds: new Uint8Array(4),
      eventFirstColliderIndices: new Int32Array(4),
      eventFirstColliderGenerations: new Uint32Array(4),
      eventSecondColliderIndices: new Int32Array(4),
      eventSecondColliderGenerations: new Uint32Array(4),
      eventNormalX: new Float64Array(4),
      eventNormalY: new Float64Array(4),
      eventPointCounts: new Uint8Array(4),
      eventPointFirstX: new Float64Array(8),
      eventPointFirstY: new Float64Array(8),
      eventPointSecondX: new Float64Array(8),
      eventPointSecondY: new Float64Array(8),
      eventPointSeparations: new Float64Array(8),
      eventTotalNormalImpulses: new Float64Array(4),
      eventCount: 0,
      contactEventFacts: new Map(),
      savedNormalImpulses: new Float64Array(8),
      savedTangentImpulses: new Float64Array(8),
    };
  }

  proposeTopology(records: readonly PhysicsTopologyRecord2D[]): void {
    this.assertUsable();
    validateTopology(records);
    this.pendingTopology = Object.freeze([...records]);
    this.nextTopologyRevision += 1;
  }

  applyBegin(commands: readonly PhysicsCommand2D[]): void {
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
      stagedKinematicTargets: ReadonlyMap<number, PhysicsPose2D>;
    }>,
  ): PhysicsWorld2DCandidate | undefined {
    this.assertUsable();
    if (this.liveCandidate !== undefined) {
      throw new Error("physics world already has a live candidate.");
    }
    if (!Number.isSafeInteger(input.frameId) || input.frameId < 0) {
      throw new RangeError("frameId must be a nonnegative safe integer.");
    }
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
    try {
      const topologyPending =
        this.pendingTopology !== undefined &&
        topologyRevision > this.state.topologyRevision;
      const commandsPending = commandRevision > this.state.commandRevision;
      if (topologyPending) {
        this.reconcileTopology(this.pendingTopology!);
        this.state.topologyRevision = topologyRevision;
      }
      if (commandsPending) {
        this.applyCommands(this.pendingCommands);
        this.state.commandRevision = commandRevision;
      }
      injectFailure("topology");

      const reanchor = !this.state.anchored;
      const elapsed = reanchor
        ? 0
        : Math.max(0, input.logicalTime - this.state.previousLogicalTime);
      this.state.previousLogicalTime = input.logicalTime;
      this.state.anchored = true;
      const configuration = this.state.configuration;
      const maximumElapsed =
        configuration.fixedStepMilliseconds * configuration.maxCatchUpSteps;
      const acceptedElapsed = Math.min(elapsed, maximumElapsed);
      const discardedElapsed = elapsed - acceptedElapsed;
      if (discardedElapsed > 0) {
        recordPhysicsWorld2DTrace({
          kind: "physics-2d-clamp",
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
          (this.state.accumulatorMilliseconds + Number.EPSILON) /
            configuration.fixedStepMilliseconds,
        ),
      );
      for (let step = 0; step < stepCount; step += 1) {
        this.simulateFixedTick(input);
        this.state.accumulatorMilliseconds -=
          configuration.fixedStepMilliseconds;
        if (this.state.accumulatorMilliseconds < Number.EPSILON) {
          this.state.accumulatorMilliseconds = 0;
        }
      }
      if (stepCount > 0 && !this.solver.advanceEligible) {
        this.state.accumulatorMilliseconds = 0;
        this.state.anchored = false;
        this.capturePreviousPoses();
      }
      const candidate = new PhysicsWorld2DCandidate(
        this,
        checkpoint,
        input.frameId,
        input.logicalTime,
        stepCount,
        this.state.tick,
        this.state.accumulatorMilliseconds,
        this.hasAdvanceWork(),
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
        this.state.eventPointCounts,
        this.state.eventPointFirstX,
        this.state.eventPointFirstY,
        this.state.eventPointSecondX,
        this.state.eventPointSecondY,
        this.state.eventPointSeparations,
        this.state.eventTotalNormalImpulses,
        topologyRevision,
        commandRevision,
        commandCount,
      );
      this.liveCandidate = candidate;
      recordPhysicsWorld2DTrace({
        kind: "physics-2d-candidate",
        frameId: input.frameId,
        logicalTime: input.logicalTime,
        tick: this.state.tick,
        stepCount,
      });
      return candidate;
    } catch (error) {
      this.restoreCheckpoint(checkpoint);
      recordPhysicsWorld2DTrace({
        kind: "physics-2d-error",
        frameId: input.frameId,
        logicalTime: input.logicalTime,
        error,
      });
      throw error;
    }
  }

  adopt(candidate: PhysicsWorld2DCandidate): void {
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
    recordPhysicsWorld2DTrace({
      kind: "physics-2d-adopt",
      frameId: candidate.frameId,
      tick: candidate.tick,
    });
  }

  discard(candidate: PhysicsWorld2DCandidate): void {
    this.assertCandidate(candidate);
    const checkpoint = candidate.consume("discarded");
    this.restoreCheckpoint(checkpoint);
    this.liveCandidate = undefined;
    recordPhysicsWorld2DTrace({
      kind: "physics-2d-discard",
      frameId: candidate.frameId,
      tick: candidate.tick,
    });
  }

  authoritativePose(bodyId: number): PhysicsPose2D {
    this.assertUsable();
    const slot = this.requireBody(bodyId);
    return publicBodyOriginPose(this.bodies, slot.index);
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

  colliderIdentity(
    colliderId: number,
  ): Readonly<{ index: number; generation: number }> | undefined {
    this.assertUsable();
    return this.state.colliderSlots.get(colliderId);
  }

  presentationPose(bodyId: number): PhysicsPose2D {
    this.assertUsable();
    const slot = this.requireBody(bodyId);
    const index = slot.index;
    if (this.state.configuration.interpolation === "none") {
      return this.authoritativePose(bodyId);
    }
    const alpha =
      this.state.accumulatorMilliseconds /
      this.state.configuration.fixedStepMilliseconds;
    const previousRotation = this.state.previousRotationRadians[index]!;
    const currentRotation = this.bodies.rotationRadians[index]!;
    return publicPoseFromCenter(
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
      previousRotation + shortestRadians(previousRotation, currentRotation) * alpha,
    );
  }

  snapshot(): PhysicsWorld2DSnapshot {
    const bodies = [...this.state.bodySlots.entries()]
      .sort(([first], [second]) => first - second)
      .map(([id, slot]) =>
        Object.freeze({
          id,
          index: slot.index,
          generation: slot.generation,
          positionX: this.bodies.positionX[slot.index]!,
          positionY: this.bodies.positionY[slot.index]!,
          rotationRadians: this.bodies.rotationRadians[slot.index]!,
          localCenterX: this.bodies.localCenterX[slot.index]!,
          localCenterY: this.bodies.localCenterY[slot.index]!,
          linearVelocityX: this.bodies.linearVelocityX[slot.index]!,
          linearVelocityY: this.bodies.linearVelocityY[slot.index]!,
          angularVelocity: this.bodies.angularVelocity[slot.index]!,
          inverseMass: this.bodies.inverseMass[slot.index]!,
          inverseInertia: this.bodies.inverseInertia[slot.index]!,
          flags: this.bodies.flags[slot.index]!,
        }),
      );
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
    this.state.eventCount = 0;
    this.pendingTopology = undefined;
    this.pendingCommands = Object.freeze([]);
    this.disposed = true;
  }

  private simulateFixedTick(
    input: Readonly<{
      frameId: number;
      logicalTime: number;
      stagedKinematicTargets: ReadonlyMap<number, PhysicsPose2D>;
    }>,
  ): void {
    this.ensureBodyScratchCapacity();
    this.capturePreviousPoses();
    const dt = this.state.configuration.fixedStepMilliseconds / 1_000;
    this.applyKinematicTargets(input.stagedKinematicTargets, dt);
    this.rebuildIntegrationBodyIndices();
    integrateCandidateBodies2D(
      this.bodies,
      this.state.integrationBodyIndices,
      this.state.integrationBodyCount,
      this.state.configuration.gravityX,
      this.state.configuration.gravityY,
      dt,
    );
    this.moveBroadPhaseProxies();
    injectFailure("broad-phase");
    this.ccd.resolveCandidateBodies(
      this.bodies,
      this.colliders,
      this.broadPhase,
      this.state.integrationBodyIndices,
      this.state.integrationBodyCount,
      this.state.previousPositionX,
      this.state.previousPositionY,
      this.state.previousRotationRadians,
    );
    this.moveBroadPhaseProxies();
    injectFailure("ccd");
    this.broadPhase.publishPairs();
    updateSortedContactCache2D(
      this.contacts,
      this.broadPhase,
      this.colliders,
      (firstCollider, secondCollider) =>
        this.manifoldBetweenColliders(firstCollider, secondCollider),
    );
    injectFailure("narrow-phase");
    this.solver.solveCandidate(
      this.bodies,
      this.state.bodyIndices,
      this.state.bodyCount,
      this.contacts,
      this.state.configuration.velocityIterations,
      0,
    );
    injectFailure("velocity-solve");
    this.solvePositions();
    injectFailure("position-solve");
    this.solver.updateSleepingCandidate(this.bodies, this.contacts, dt, {
      enabled: this.state.configuration.sleeping,
      recordTransition: (bodyIndex, sleeping) => {
        this.appendEvent(sleeping ? 6 : 5, bodyIndex, NO_INDEX);
      },
    });
    this.stageContactEvents();
    injectFailure("event-staging");
    this.state.tick += 1;
    recordPhysicsWorld2DTrace({
      kind: "physics-2d-tick",
      frameId: input.frameId,
      logicalTime: input.logicalTime,
      tick: this.state.tick,
    });
  }

  private reconcileTopology(records: readonly PhysicsTopologyRecord2D[]): void {
    const desiredBodies = new Map<number, PhysicsBodyTopologyRecord2D>();
    const desiredColliders = new Map<number, PhysicsColliderTopologyRecord2D>();
    for (const record of records) {
      if (record.kind === "body") desiredBodies.set(record.id, record);
      else desiredColliders.set(record.id, record);
    }

    for (const [id, slot] of sortedEntries(this.state.colliderSlots, true)) {
      if (desiredColliders.has(id)) continue;
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
        this.state.anchored = false;
        this.state.accumulatorMilliseconds = 0;
        this.ensureBodyScratchCapacity();
        this.snapPreviousPose(index);
        this.state.bodyRecords.set(id, record);
      } else if (
        !sameBodyDefinition(
          this.state.bodyRecords.get(id)?.definition,
          record.definition,
        )
      ) {
        const disabledState = this.state.disabledBodies.get(id);
        if (disabledState === undefined && this.wakeBody(existing.index)) {
          this.state.anchored = false;
          this.state.accumulatorMilliseconds = 0;
        }
        const preserveDynamicPose =
          disabledState === undefined &&
          (this.bodies.flags[existing.index]! & BODY_TYPE_DYNAMIC_2D) !== 0 &&
          (record.definition.flags & BODY_TYPE_DYNAMIC_2D) !== 0;
        const dynamicState = preserveDynamicPose
          ? {
              pose: publicBodyOriginPose(this.bodies, existing.index),
              linearVelocityX: this.bodies.linearVelocityX[existing.index]!,
              linearVelocityY: this.bodies.linearVelocityY[existing.index]!,
              angularVelocity: this.bodies.angularVelocity[existing.index]!,
              forceX: this.bodies.forceX[existing.index]!,
              forceY: this.bodies.forceY[existing.index]!,
              torque: this.bodies.torque[existing.index]!,
            }
          : null;
        writeBodyDefinition(this.bodies, existing.index, record.definition);
        if (dynamicState !== null) {
          this.setBodyOriginPose(existing.index, dynamicState.pose);
          this.bodies.linearVelocityX[existing.index] =
            dynamicState.linearVelocityX;
          this.bodies.linearVelocityY[existing.index] =
            dynamicState.linearVelocityY;
          this.bodies.angularVelocity[existing.index] =
            dynamicState.angularVelocity;
          this.bodies.forceX[existing.index] = dynamicState.forceX;
          this.bodies.forceY[existing.index] = dynamicState.forceY;
          this.bodies.torque[existing.index] = dynamicState.torque;
        }
        if (disabledState !== undefined) {
          this.state.disabledBodies.set(
            id,
            Object.freeze({
              ...disabledState,
              flags: record.definition.flags,
            }),
          );
          this.bodies.flags[existing.index] = 0;
          this.bodies.linearVelocityX[existing.index] = 0;
          this.bodies.linearVelocityY[existing.index] = 0;
          this.bodies.angularVelocity[existing.index] = 0;
          this.bodies.forceX[existing.index] = 0;
          this.bodies.forceY[existing.index] = 0;
          this.bodies.torque[existing.index] = 0;
        }
        this.snapPreviousPose(existing.index);
        this.state.bodyRecords.set(id, record);
      }
    }
    for (const [id, record] of sortedEntries(desiredColliders)) {
      const body = this.state.bodySlots.get(record.bodyId);
      if (body === undefined) {
        throw new Error(
          `collider ${id} references missing body ${record.bodyId}.`,
        );
      }
      const existing = this.state.colliderSlots.get(id);
      if (
        existing !== undefined &&
        sameColliderRecord(this.state.colliderRecords.get(id), record)
      ) {
        continue;
      }
      if (existing !== undefined) this.releaseCollider(existing);
      this.state.colliderRecords.set(id, record);
      if (this.state.disabledBodies.has(record.bodyId)) continue;
      this.allocateColliderRecord(id, record, body);
      if (this.wakeBody(body.index)) {
        this.state.anchored = false;
        this.state.accumulatorMilliseconds = 0;
      }
    }
    this.rebuildBodyIndices();
    this.moveBroadPhaseProxies();
  }

  private applyCommands(commands: readonly PhysicsCommand2D[]): void {
    for (const command of commands) {
      if (command.kind === "configure") {
        const previousStep = this.state.configuration.fixedStepMilliseconds;
        const sleepingWasEnabled = this.state.configuration.sleeping;
        this.state.configuration = normalizePhysicsWorld2DConfiguration({
          gravity: [
            this.state.configuration.gravityX,
            this.state.configuration.gravityY,
          ],
          fixedStepMilliseconds: this.state.configuration.fixedStepMilliseconds,
          maxCatchUpSteps: this.state.configuration.maxCatchUpSteps,
          interpolation: this.state.configuration.interpolation,
          sleeping: this.state.configuration.sleeping,
          ...command.configuration,
          solver: {
            velocityIterations: this.state.configuration.velocityIterations,
            positionIterations: this.state.configuration.positionIterations,
            ...command.configuration.solver,
          },
        });
        if (this.state.configuration.fixedStepMilliseconds !== previousStep) {
          this.state.accumulatorMilliseconds = 0;
          this.state.anchored = false;
        }
        if (sleepingWasEnabled && !this.state.configuration.sleeping) {
          for (let offset = 0; offset < this.state.bodyCount; offset += 1) {
            this.wakeBody(this.state.bodyIndices[offset]!);
          }
          this.state.accumulatorMilliseconds = 0;
          this.state.anchored = false;
        }
        continue;
      }
      const slot = this.state.bodySlots.get(command.bodyId);
      if (slot === undefined) continue;
      switch (command.kind) {
        case "apply-force":
          if (command.wake !== false) this.wakeCommandBody(slot.index);
          applyForceAtPointToCandidateBody2D(
            this.bodies,
            slot.index,
            slot.generation,
            command.forceX,
            command.forceY,
            command.pointX ?? this.bodies.positionX[slot.index]!,
            command.pointY ?? this.bodies.positionY[slot.index]!,
          );
          break;
        case "apply-torque":
          this.wakeCommandBody(slot.index);
          applyTorqueToCandidateBody2D(
            this.bodies,
            slot.index,
            slot.generation,
            command.torque,
          );
          break;
        case "apply-impulse":
          if (command.wake !== false) this.wakeCommandBody(slot.index);
          applyImpulseAtPointToCandidateBody2D(
            this.bodies,
            slot.index,
            slot.generation,
            command.impulseX,
            command.impulseY,
            command.pointX ?? this.bodies.positionX[slot.index]!,
            command.pointY ?? this.bodies.positionY[slot.index]!,
          );
          break;
        case "set-pose":
          this.wakeCommandBody(slot.index);
          this.setBodyOriginPose(slot.index, command.pose);
          this.snapPreviousPose(slot.index);
          this.moveBroadPhaseProxies();
          break;
        case "set-velocity":
          this.wakeCommandBody(slot.index);
          this.bodies.linearVelocityX[slot.index] = command.linearVelocityX;
          this.bodies.linearVelocityY[slot.index] = command.linearVelocityY;
          this.bodies.angularVelocity[slot.index] =
            command.angularVelocityDegrees / RADIANS_TO_DEGREES;
          break;
        case "set-linear-velocity":
          this.wakeCommandBody(slot.index);
          this.bodies.linearVelocityX[slot.index] = command.linearVelocityX;
          this.bodies.linearVelocityY[slot.index] = command.linearVelocityY;
          break;
        case "set-angular-velocity":
          this.wakeCommandBody(slot.index);
          this.bodies.angularVelocity[slot.index] =
            command.angularVelocityDegrees / RADIANS_TO_DEGREES;
          break;
        case "wake":
          this.wakeCommandBody(slot.index);
          break;
        case "sleep":
          this.sleepCommandBody(slot.index);
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
    if ((this.bodies.flags[bodyIndex]! & BODY_SLEEPING_2D) !== 0) return;
    this.bodies.flags[bodyIndex] |= BODY_SLEEPING_2D;
    this.bodies.linearVelocityX[bodyIndex] = 0;
    this.bodies.linearVelocityY[bodyIndex] = 0;
    this.bodies.angularVelocity[bodyIndex] = 0;
    this.bodies.forceX[bodyIndex] = 0;
    this.bodies.forceY[bodyIndex] = 0;
    this.bodies.torque[bodyIndex] = 0;
    this.appendEvent(6, bodyIndex, NO_INDEX);
  }

  private disableCommandBody(bodyId: number, slot: BodySlot2D): void {
    if (this.state.disabledBodies.has(bodyId)) return;
    this.state.disabledBodies.set(
      bodyId,
      Object.freeze({
        flags: this.bodies.flags[slot.index]!,
        linearVelocityX: this.bodies.linearVelocityX[slot.index]!,
        linearVelocityY: this.bodies.linearVelocityY[slot.index]!,
        angularVelocity: this.bodies.angularVelocity[slot.index]!,
      }),
    );
    for (const [colliderId, record] of this.state.colliderRecords) {
      if (record.bodyId !== bodyId) continue;
      const collider = this.state.colliderSlots.get(colliderId);
      if (collider !== undefined) this.releaseCollider(collider);
      this.state.colliderSlots.delete(colliderId);
    }
    this.bodies.flags[slot.index] = 0;
    this.bodies.linearVelocityX[slot.index] = 0;
    this.bodies.linearVelocityY[slot.index] = 0;
    this.bodies.angularVelocity[slot.index] = 0;
    this.bodies.forceX[slot.index] = 0;
    this.bodies.forceY[slot.index] = 0;
    this.bodies.torque[slot.index] = 0;
    this.broadPhase.publishPairs();
    updateSortedContactCache2D(
      this.contacts,
      this.broadPhase,
      this.colliders,
      (first, second) => this.manifoldBetweenColliders(first, second),
    );
    this.stageContactEvents();
  }

  private enableCommandBody(
    bodyId: number,
    slot: BodySlot2D,
    velocity: "zero" | "preserve",
  ): void {
    const disabled = this.state.disabledBodies.get(bodyId);
    if (disabled === undefined) return;
    const authored = this.state.bodyRecords.get(bodyId)?.definition;
    if (authored === undefined) return;
    const disabledPose = publicBodyOriginPose(this.bodies, slot.index);
    this.state.disabledBodies.delete(bodyId);
    writeBodyDefinition(this.bodies, slot.index, authored);
    this.setBodyOriginPose(slot.index, disabledPose);
    this.bodies.flags[slot.index] = disabled.flags & ~BODY_SLEEPING_2D;
    this.bodies.linearVelocityX[slot.index] =
      velocity === "preserve" ? disabled.linearVelocityX : 0;
    this.bodies.linearVelocityY[slot.index] =
      velocity === "preserve" ? disabled.linearVelocityY : 0;
    this.bodies.angularVelocity[slot.index] =
      velocity === "preserve" ? disabled.angularVelocity : 0;
    this.snapPreviousPose(slot.index);
    for (const [colliderId, record] of sortedEntries(
      this.state.colliderRecords,
    )) {
      if (record.bodyId !== bodyId || this.state.colliderSlots.has(colliderId))
        continue;
      this.allocateColliderRecord(colliderId, record, slot);
    }
    this.state.anchored = false;
    this.state.accumulatorMilliseconds = 0;
  }

  private allocateColliderRecord(
    id: number,
    record: PhysicsColliderTopologyRecord2D,
    body: BodySlot2D,
  ): void {
    const index = this.colliders.allocate({
      ...record.definition,
      bodyIndex: body.index,
      bodyGeneration: body.generation,
    });
    const generation = this.colliders.generations[index]!;
    const pose = internalPose(this.bodies, body.index);
    const bounds = colliderBounds(
      record.definition.shape,
      pose.x,
      pose.y,
      pose.rotationRadians,
    );
    const proxy = this.broadPhase.createProxy(
      index,
      generation,
      bounds[0],
      bounds[1],
      bounds[2],
      bounds[3],
    );
    this.colliders.setProxy(
      index,
      generation,
      proxy,
      this.broadPhase.proxyGenerations[proxy]!,
    );
    this.state.colliderSlots.set(id, Object.freeze({ index, generation }));
  }

  private manifoldBetweenColliders(first: number, second: number) {
    if (
      !collisionFiltersAllow2D(
        this.colliders.filters[first],
        this.colliders.filters[second],
      )
    ) {
      return null;
    }
    const firstShape = this.colliders.shapes[first];
    const secondShape = this.colliders.shapes[second];
    if (firstShape === null || secondShape === null) return null;
    const firstBody = this.colliders.bodyIndices[first]!;
    const secondBody = this.colliders.bodyIndices[second]!;
    return manifoldBetweenShapeRecords2D(
      firstShape,
      internalPose(this.bodies, firstBody),
      first,
      secondShape,
      internalPose(this.bodies, secondBody),
      second,
    );
  }

  private moveBroadPhaseProxies(): void {
    for (const [, slot] of sortedEntries(this.state.colliderSlots)) {
      const body = this.colliders.bodyIndices[slot.index]!;
      const shape = this.colliders.shapes[slot.index];
      if (shape === null) continue;
      const pose = internalPose(this.bodies, body);
      const bounds = colliderBounds(
        shape,
        pose.x,
        pose.y,
        pose.rotationRadians,
      );
      this.broadPhase.moveProxy(
        this.colliders.proxyIndices[slot.index]!,
        this.colliders.proxyGenerations[slot.index]!,
        bounds[0],
        bounds[1],
        bounds[2],
        bounds[3],
        this.bodies.positionX[body]! - this.state.previousPositionX[body]!,
        this.bodies.positionY[body]! - this.state.previousPositionY[body]!,
      );
    }
  }

  private applyKinematicTargets(
    targets: ReadonlyMap<number, PhysicsPose2D>,
    dt: number,
  ): void {
    for (const [bodyId, pose] of targets) {
      const slot = this.state.bodySlots.get(bodyId);
      if (slot === undefined) continue;
      const index = slot.index;
      if ((this.bodies.flags[index]! & BODY_TYPE_KINEMATIC_2D) === 0) continue;
      const targetRadians = pose.rotationDegrees / RADIANS_TO_DEGREES;
      const targetCenter = centerFromOrigin(
        this.bodies,
        index,
        pose.position[0],
        pose.position[1],
        targetRadians,
      );
      this.bodies.linearVelocityX[index] =
        (targetCenter[0] - this.bodies.positionX[index]!) / dt;
      this.bodies.linearVelocityY[index] =
        (targetCenter[1] - this.bodies.positionY[index]!) / dt;
      this.bodies.angularVelocity[index] =
        shortestRadians(this.bodies.rotationRadians[index]!, targetRadians) /
        dt;
      if (this.wakeBody(index)) {
        this.state.anchored = false;
        this.state.accumulatorMilliseconds = 0;
      }
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
        kind === 2 || kind === 4
          ? this.state.contactEventFacts.get(key)
          : contact < 0
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
    return -1;
  }

  private contactEventFact(contact: number): ContactEventFact2D {
    const base = contact * 2;
    const pointCount = this.contacts.pointCounts[contact]!;
    return Object.freeze({
      normalX: this.contacts.normalX[contact]!,
      normalY: this.contacts.normalY[contact]!,
      pointCount,
      pointFirstX: Object.freeze([
        this.contacts.pointFirstX[base]!,
        this.contacts.pointFirstX[base + 1]!,
      ] as const),
      pointFirstY: Object.freeze([
        this.contacts.pointFirstY[base]!,
        this.contacts.pointFirstY[base + 1]!,
      ] as const),
      pointSecondX: Object.freeze([
        this.contacts.pointSecondX[base]!,
        this.contacts.pointSecondX[base + 1]!,
      ] as const),
      pointSecondY: Object.freeze([
        this.contacts.pointSecondY[base]!,
        this.contacts.pointSecondY[base + 1]!,
      ] as const),
      pointSeparations: Object.freeze([
        this.contacts.pointSeparations[base]!,
        this.contacts.pointSeparations[base + 1]!,
      ] as const),
      totalNormalImpulse:
        this.contacts.pointNormalImpulses[base]! +
        this.contacts.pointNormalImpulses[base + 1]!,
    });
  }

  private solvePositions(): void {
    const pointCount = this.contacts.contactCount * 2;
    this.ensureSavedImpulseCapacity(pointCount);
    this.state.savedNormalImpulses.set(
      this.contacts.pointNormalImpulses.subarray(0, pointCount),
      0,
    );
    this.state.savedTangentImpulses.set(
      this.contacts.pointTangentImpulses.subarray(0, pointCount),
      0,
    );
    this.contacts.pointNormalImpulses.fill(0, 0, pointCount);
    this.contacts.pointTangentImpulses.fill(0, 0, pointCount);
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
      0,
    );
    this.contacts.pointTangentImpulses.set(
      this.state.savedTangentImpulses.subarray(0, pointCount),
      0,
    );
    this.solver.positionIterationsPerformed =
      this.positionSolver.positionIterationsPerformed;
  }

  private ensureSavedImpulseCapacity(required: number): void {
    if (required <= this.state.savedNormalImpulses.length) return;
    let capacity = this.state.savedNormalImpulses.length * 2;
    while (capacity < required) capacity *= 2;
    this.state.savedNormalImpulses = growFloat64(
      this.state.savedNormalImpulses,
      capacity,
    );
    this.state.savedTangentImpulses = growFloat64(
      this.state.savedTangentImpulses,
      capacity,
    );
  }

  private appendEvent(
    kind: number,
    first: number,
    second: number,
    firstGeneration = 0,
    secondGeneration = 0,
    fact?: ContactEventFact2D,
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
    this.state.eventPointCounts[event] = fact?.pointCount ?? 0;
    this.state.eventTotalNormalImpulses[event] = fact?.totalNormalImpulse ?? 0;
    const pointBase = event * 2;
    for (let point = 0; point < 2; point += 1) {
      this.state.eventPointFirstX[pointBase + point] =
        fact?.pointFirstX[point] ?? 0;
      this.state.eventPointFirstY[pointBase + point] =
        fact?.pointFirstY[point] ?? 0;
      this.state.eventPointSecondX[pointBase + point] =
        fact?.pointSecondX[point] ?? 0;
      this.state.eventPointSecondY[pointBase + point] =
        fact?.pointSecondY[point] ?? 0;
      this.state.eventPointSeparations[pointBase + point] =
        fact?.pointSeparations[point] ?? 0;
    }
    this.state.eventCount += 1;
  }

  private ensureEventCapacity(required: number): void {
    if (required <= this.state.eventKinds.length) return;
    let capacity = this.state.eventKinds.length * 2;
    while (capacity < required) capacity *= 2;
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
    this.state.eventPointCounts = growUint8(
      this.state.eventPointCounts,
      capacity,
    );
    this.state.eventPointFirstX = growFloat64(
      this.state.eventPointFirstX,
      capacity * 2,
    );
    this.state.eventPointFirstY = growFloat64(
      this.state.eventPointFirstY,
      capacity * 2,
    );
    this.state.eventPointSecondX = growFloat64(
      this.state.eventPointSecondX,
      capacity * 2,
    );
    this.state.eventPointSecondY = growFloat64(
      this.state.eventPointSecondY,
      capacity * 2,
    );
    this.state.eventPointSeparations = growFloat64(
      this.state.eventPointSeparations,
      capacity * 2,
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
    this.state.previousRotationRadians[index] =
      this.bodies.rotationRadians[index]!;
  }

  private setBodyOriginPose(index: number, pose: PhysicsPose2D): void {
    const rotationRadians = pose.rotationDegrees / RADIANS_TO_DEGREES;
    const center = centerFromOrigin(
      this.bodies,
      index,
      pose.position[0],
      pose.position[1],
      rotationRadians,
    );
    this.bodies.positionX[index] = center[0];
    this.bodies.positionY[index] = center[1];
    this.bodies.rotationRadians[index] = rotationRadians;
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
      if ((this.bodies.flags[body]! & BODY_SLEEPING_2D) !== 0) continue;
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
    this.state.previousRotationRadians = growFloat64(
      this.state.previousRotationRadians,
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
      (this.bodies.flags[bodyIndex]! & BODY_SLEEPING_2D) !== 0;
    let targetWakeRecorded = false;
    const islandChanged = this.solver.wakeIslandContainingCandidate(
      this.bodies,
      bodyIndex,
      (body, sleeping) => {
        if (body === bodyIndex && !sleeping) targetWakeRecorded = true;
        this.appendEvent(sleeping ? 6 : 5, body, NO_INDEX);
      },
    );
    this.bodies.flags[bodyIndex] &= ~BODY_SLEEPING_2D;
    this.bodies.sleepTime[bodyIndex] = 0;
    if (wasSleeping && !targetWakeRecorded) {
      this.appendEvent(5, bodyIndex, NO_INDEX);
    }
    return wasSleeping || islandChanged;
  }

  private releaseCollider(slot: ColliderSlot2D): void {
    const proxy = this.colliders.proxyIndices[slot.index]!;
    const proxyGeneration = this.colliders.proxyGenerations[slot.index]!;
    if (proxy !== NO_INDEX)
      this.broadPhase.destroyProxy(proxy, proxyGeneration);
    this.colliders.release(slot.index, slot.generation);
  }

  private captureCheckpoint(): WorldCheckpoint2D {
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

  private restoreCheckpoint(checkpoint: WorldCheckpoint2D): void {
    for (let index = checkpoint.snapshots.length - 1; index >= 0; index -= 1) {
      restoreObject(checkpoint.snapshots[index]!);
    }
  }

  private requireBody(bodyId: number): BodySlot2D {
    const slot = this.state.bodySlots.get(bodyId);
    if (slot === undefined) throw new Error(`unknown physics body ${bodyId}.`);
    return slot;
  }

  private hasAdvanceWork(): boolean {
    if (this.pendingTopology !== undefined || this.pendingCommands.length > 0) {
      return true;
    }
    for (let offset = 0; offset < this.state.bodyCount; offset += 1) {
      const body = this.state.bodyIndices[offset]!;
      if ((this.bodies.flags[body]! & BODY_TYPE_KINEMATIC_2D) !== 0)
        return true;
      if ((this.bodies.flags[body]! & BODY_SLEEPING_2D) === 0) return true;
    }
    return false;
  }

  private assertCandidate(candidate: PhysicsWorld2DCandidate): void {
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

export function normalizePhysicsWorld2DConfiguration(
  configuration: PhysicsWorld2DConfiguration,
): NormalizedPhysicsWorld2DConfiguration {
  const gravity = configuration.gravity ?? DEFAULT_GRAVITY;
  if (
    gravity.length !== 2 ||
    !Number.isFinite(gravity[0]) ||
    !Number.isFinite(gravity[1])
  ) {
    throw new RangeError("gravity must contain two finite numbers.");
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
    MIN_CATCH_UP_STEPS,
    MAX_CATCH_UP_STEPS,
    "maxCatchUpSteps",
  );
  const interpolation = configuration.interpolation ?? DEFAULT_INTERPOLATION;
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
    MIN_SOLVER_ITERATIONS,
    MAX_SOLVER_ITERATIONS,
    "velocityIterations",
  );
  validateIntegerRange(
    positionIterations,
    MIN_SOLVER_ITERATIONS,
    MAX_SOLVER_ITERATIONS,
    "positionIterations",
  );
  return Object.freeze({
    gravityX: gravity[0],
    gravityY: gravity[1],
    fixedStepMilliseconds,
    maxCatchUpSteps,
    interpolation,
    sleeping: configuration.sleeping ?? DEFAULT_SLEEPING,
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

function validateTopology(records: readonly PhysicsTopologyRecord2D[]): void {
  const bodies = new Set<number>();
  const colliders = new Set<number>();
  for (const record of records) {
    validateId(record.id, `${record.kind} id`);
    const ids = record.kind === "body" ? bodies : colliders;
    if (ids.has(record.id)) {
      throw new Error(`duplicate ${record.kind} id ${record.id}.`);
    }
    ids.add(record.id);
    if (record.kind === "body") validateBodyDefinition(record.definition);
    else validateId(record.bodyId, "collider bodyId");
  }
  for (const record of records) {
    if (record.kind === "collider" && !bodies.has(record.bodyId)) {
      throw new Error(
        `collider ${record.id} references missing body ${record.bodyId}.`,
      );
    }
  }
}

function hasColliderHandler(handlers: unknown, name: "onHit"): boolean {
  return (
    typeof handlers === "object" &&
    handlers !== null &&
    typeof (handlers as Readonly<Record<string, unknown>>)[name] === "function"
  );
}

function validateBodyDefinition(definition: BodyDefinition2D): void {
  for (const [name, value] of Object.entries(definition)) {
    if (name === "owner" || name === "flags") continue;
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new RangeError(`body ${name} must be finite.`);
    }
  }
  if (!Number.isSafeInteger(definition.flags) || definition.flags < 0) {
    throw new RangeError("body flags must be a nonnegative safe integer.");
  }
}

function validateCommand(command: PhysicsCommand2D): void {
  if (command.kind === "configure") {
    normalizePhysicsWorld2DConfiguration(command.configuration);
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
    if ((name === "pointX" || name === "pointY") && value === undefined)
      continue;
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new RangeError(`command ${name} must be finite.`);
    }
  }
}

function injectFailure(stage: PhysicsWorld2DFailureStage): void {
  failureInjector?.(stage);
}

function validatePose(pose: PhysicsPose2D, path: string): void {
  if (
    pose.position.length !== 2 ||
    !Number.isFinite(pose.position[0]) ||
    !Number.isFinite(pose.position[1]) ||
    !Number.isFinite(pose.rotationDegrees)
  ) {
    throw new RangeError(`${path} must contain finite position and rotation.`);
  }
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
      `${path} must be an integer from ${minimum} through ${maximum}.`,
    );
  }
}

function writeBodyDefinition(
  bodies: BodyStore2D,
  index: number,
  definition: BodyDefinition2D,
): void {
  bodies.positionX[index] = definition.positionX;
  bodies.positionY[index] = definition.positionY;
  bodies.rotationRadians[index] = definition.rotationRadians;
  bodies.localCenterX[index] = definition.localCenterX ?? 0;
  bodies.localCenterY[index] = definition.localCenterY ?? 0;
  bodies.linearVelocityX[index] = definition.linearVelocityX;
  bodies.linearVelocityY[index] = definition.linearVelocityY;
  bodies.angularVelocity[index] = definition.angularVelocity;
  bodies.forceX[index] = definition.forceX;
  bodies.forceY[index] = definition.forceY;
  bodies.torque[index] = definition.torque;
  bodies.inverseMass[index] = definition.inverseMass;
  bodies.inverseInertia[index] = definition.inverseInertia;
  bodies.linearDamping[index] = definition.linearDamping;
  bodies.angularDamping[index] = definition.angularDamping;
  bodies.gravityScale[index] = definition.gravityScale;
  bodies.sleepTime[index] = definition.sleepTime;
  bodies.flags[index] = definition.flags;
  bodies.owners[index] = definition.owner;
}

function sameBodyDefinition(
  first: BodyDefinition2D | undefined,
  second: BodyDefinition2D,
): boolean {
  return (
    first !== undefined &&
    first.positionX === second.positionX &&
    first.positionY === second.positionY &&
    first.rotationRadians === second.rotationRadians &&
    (first.localCenterX ?? 0) === (second.localCenterX ?? 0) &&
    (first.localCenterY ?? 0) === (second.localCenterY ?? 0) &&
    first.linearVelocityX === second.linearVelocityX &&
    first.linearVelocityY === second.linearVelocityY &&
    first.angularVelocity === second.angularVelocity &&
    first.forceX === second.forceX &&
    first.forceY === second.forceY &&
    first.torque === second.torque &&
    first.inverseMass === second.inverseMass &&
    first.inverseInertia === second.inverseInertia &&
    first.linearDamping === second.linearDamping &&
    first.angularDamping === second.angularDamping &&
    first.gravityScale === second.gravityScale &&
    first.sleepTime === second.sleepTime &&
    first.flags === second.flags &&
    first.owner === second.owner
  );
}

function sameColliderRecord(
  first: PhysicsColliderTopologyRecord2D | undefined,
  second: PhysicsColliderTopologyRecord2D,
): boolean {
  return (
    first !== undefined &&
    first.bodyId === second.bodyId &&
    first.definition.shape === second.definition.shape &&
    first.definition.flags === second.definition.flags &&
    first.definition.tag === second.definition.tag &&
    first.definition.handlers === second.definition.handlers &&
    first.definition.owner === second.definition.owner &&
    shallowRecordEqual(first.definition.material, second.definition.material) &&
    shallowRecordEqual(first.definition.filter, second.definition.filter)
  );
}

function shallowRecordEqual(first: unknown, second: unknown): boolean {
  if (first === second) return true;
  if (
    typeof first !== "object" ||
    first === null ||
    typeof second !== "object" ||
    second === null
  ) {
    return false;
  }
  const firstEntries = Object.entries(first);
  const secondRecord = second as Record<string, unknown>;
  if (firstEntries.length !== Object.keys(secondRecord).length) return false;
  return firstEntries.every(([key, value]) => secondRecord[key] === value);
}

function colliderBounds(
  shape: ColliderDefinition2D["shape"],
  x: number,
  y: number,
  rotation: number,
): readonly [number, number, number, number] {
  const bounds = shape.localBounds;
  const cosine = Math.cos(rotation);
  const sine = Math.sin(rotation);
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (let corner = 0; corner < 4; corner += 1) {
    const localX = corner % 2 === 0 ? bounds[0]! : bounds[2]!;
    const localY = corner < 2 ? bounds[1]! : bounds[3]!;
    const worldX = x + cosine * localX - sine * localY;
    const worldY = y + sine * localX + cosine * localY;
    minX = Math.min(minX, worldX);
    minY = Math.min(minY, worldY);
    maxX = Math.max(maxX, worldX);
    maxY = Math.max(maxY, worldY);
  }
  return [minX, minY, maxX, maxY];
}

function internalPose(bodies: BodyStore2D, index: number): InternalPose2D {
  const rotationRadians = bodies.rotationRadians[index]!;
  const cosine = Math.cos(rotationRadians);
  const sine = Math.sin(rotationRadians);
  const localCenterX = bodies.localCenterX[index]!;
  const localCenterY = bodies.localCenterY[index]!;
  return {
    x:
      bodies.positionX[index]! -
      cosine * localCenterX +
      sine * localCenterY,
    y:
      bodies.positionY[index]! -
      sine * localCenterX -
      cosine * localCenterY,
    rotationRadians,
  };
}

function centerFromOrigin(
  bodies: BodyStore2D,
  index: number,
  originX: number,
  originY: number,
  rotationRadians: number,
): readonly [number, number] {
  const cosine = Math.cos(rotationRadians);
  const sine = Math.sin(rotationRadians);
  const localCenterX = bodies.localCenterX[index]!;
  const localCenterY = bodies.localCenterY[index]!;
  return [
    originX + cosine * localCenterX - sine * localCenterY,
    originY + sine * localCenterX + cosine * localCenterY,
  ];
}

function publicBodyOriginPose(
  bodies: BodyStore2D,
  index: number,
): PhysicsPose2D {
  const pose = internalPose(bodies, index);
  return publicPose(pose.x, pose.y, pose.rotationRadians);
}

function publicPoseFromCenter(
  bodies: BodyStore2D,
  index: number,
  centerX: number,
  centerY: number,
  rotationRadians: number,
): PhysicsPose2D {
  const cosine = Math.cos(rotationRadians);
  const sine = Math.sin(rotationRadians);
  const localCenterX = bodies.localCenterX[index]!;
  const localCenterY = bodies.localCenterY[index]!;
  return publicPose(
    centerX - cosine * localCenterX + sine * localCenterY,
    centerY - sine * localCenterX - cosine * localCenterY,
    rotationRadians,
  );
}

function publicPose(
  x: number,
  y: number,
  rotationRadians: number,
): PhysicsPose2D {
  return Object.freeze({
    position: Object.freeze([x, y] as const),
    rotationDegrees: rotationRadians * RADIANS_TO_DEGREES,
  });
}

function shortestRadians(from: number, to: number): number {
  const full = Math.PI * 2;
  let delta = ((((to - from + Math.PI) % full) + full) % full) - Math.PI;
  if (delta === -Math.PI) delta = Math.PI;
  return delta;
}

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

function sortedEntries<T>(
  map: ReadonlyMap<number, T>,
  descending = false,
): readonly (readonly [number, T])[] {
  return [...map.entries()].sort(([first], [second]) =>
    descending ? second - first : first - second,
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

function growUint8(source: Uint8Array, capacity: number): Uint8Array {
  const result = new Uint8Array(capacity);
  result.set(source);
  return result;
}

function growUint32(source: Uint32Array, capacity: number): Uint32Array {
  const result = new Uint32Array(capacity);
  result.set(source);
  return result;
}
