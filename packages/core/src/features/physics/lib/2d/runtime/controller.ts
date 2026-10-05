import { CommittedObstacles2D } from "./obstacles.js";
import { boundsOfShape2D } from "../../../2d-geometry.js";
import { createShape2D } from "../shape-records.js";
import type {
  PibblPhysicsBodyInspection2D,
  PibblPhysicsInspection2D,
} from "../inspection-types.js";
import { RapierSimulation2D } from "../world/rapier.js";
import { signal, type WritableSignal } from "@pibbl/core";
import {
  pibblInternalOnSimulationRenderTransactionFinish,
  pibblInternalCreateSignalConsumer,
  pibblInternalCurrentRenderOwner,
  type PibblInternalSignalConsumer,
  pibblInternalQueueSimulationBegin,
  pibblInternalQueueSimulationCommitAcknowledgement,
  pibblInternalQueueSimulationComplete,
  pibblInternalRegisterSimulationAdvance,
  pibblInternalRequestSimulationRender,
  type PibblInternalSignalBatch,
  type PibblInternalSimulationOwner,
} from "@pibbl/core/internal";
import type {
  PibblPhysicsAabb2D,
  PibblPhysicsPose2D,
  PibblPhysicsRay2D,
  PibblPhysicsShape2D,
  PibblPhysicsVector2,
} from "../../../2d-geometry.js";
import type { ShapeRecord2D } from "../shape-records.js";
import type {
  PibblPhysicsBodyHandle2D,
  PibblPhysicsColliderHandle2D,
  PibblPhysicsQueryHit2D,
  PibblPhysicsQueryMatch2D,
  PibblPhysicsQueryMode,
  PibblPhysicsQueryOptions2D,
  PibblPhysicsQueryResult2D,
  PibblPhysicsWorldHandle2D,
} from "../types.js";
import type { PibblResolvedPhysicsWorld2DProps } from "./world-props.js";
import { BODY_CCD_2D } from "../world/ccd.js";
import { COLLIDER_SENSOR_2D } from "../world/contact-cache.js";
import {
  BODY_FIXED_ROTATION_2D,
  BODY_TYPE_DYNAMIC_2D,
  BODY_TYPE_KINEMATIC_2D,
} from "../world/integrator.js";
import { BODY_SLEEP_DISABLED_2D, BODY_SLEEPING_2D } from "../world/solver.js";
import type { BodyDefinition2D } from "../world/storage.js";
import {
  copyFiniteVector2,
  requireFiniteNumber,
} from "../../shared/validation.js";
import {
  normalizePhysicsWorld2DConfiguration,
  PhysicsWorld2DKernel,
  type NormalizedPhysicsWorld2DConfiguration,
  type PhysicsBodyTopologyRecord2D,
  type PhysicsBodyCommand2D,
  type PhysicsColliderTopologyRecord2D,
  type PhysicsCommand2D,
  type PhysicsWorld2DConfiguration,
  type PhysicsTopologyRecord2D,
  type PhysicsWorld2DCandidate,
} from "../world/world.js";
import { CommittedWorldQueries2D } from "../world/queries.js";
import {
  bindPhysicsBodyHandle2D,
  createPhysicsBodyHandle2D,
  physicsBodyHandleBinding2D,
  stagePhysicsBodyHandle2D,
  type PhysicsBodyHandleValues2D,
  unbindPhysicsBodyHandle2D,
} from "./body-handle.js";
import {
  createPhysicsColliderHandle2D,
  isPhysicsBodyEventDelivery2D,
  materializePhysicsBodyEvent2D,
  materializePhysicsContactEvent2D,
  physicsColliderHandleIdentity2D,
  sortPhysicsEventDeliveries2D,
  type PhysicsBodyEventDelivery2D,
  type PhysicsContactEventDelivery2D,
  type PhysicsEventDelivery2D,
} from "./events.js";
import {
  type MountedPhysicsAttachment2D,
  type NormalizedPhysicsColliderConfiguration2D,
  type PhysicsBodyAttachment2DDescriptor,
} from "./descriptors.js";

const worldController2DSymbol = Symbol("PhysicsWorld2DController");

type InternalWorldHandle2D = PibblPhysicsWorldHandle2D &
  Readonly<{
    readonly [worldController2DSymbol]: PhysicsWorld2DController;
  }>;

interface BodyDraft2D {
  readonly id: number;
  readonly attachment: MountedPhysicsAttachment2D;
  readonly descriptor: PhysicsBodyAttachment2DDescriptor;
  readonly initialPose: PibblPhysicsPose2D;
}

interface ColliderDraft2D {
  readonly id: number;
  readonly bodyId: number;
  readonly attachment: MountedPhysicsAttachment2D;
  readonly options: NormalizedPhysicsColliderConfiguration2D;
  readonly shape: ShapeRecord2D;
}

interface RenderDraft2D {
  readonly simulationToRoot: DOMMatrix;
  readonly configuration: NormalizedPhysicsWorld2DConfiguration;
  readonly props: PibblResolvedPhysicsWorld2DProps;
  readonly bodies: Map<number, BodyDraft2D>;
  readonly colliders: Map<number, ColliderDraft2D>;
}

interface AcceptedBody2D {
  readonly id: number;
  readonly attachment: MountedPhysicsAttachment2D;
  readonly descriptor: PhysicsBodyAttachment2DDescriptor;
  readonly initialPose: PibblPhysicsPose2D;
  readonly handleBindingGeneration: number | undefined;
}

interface AcceptedCollider2D {
  readonly id: number;
  readonly bodyId: number;
  readonly attachment: MountedPhysicsAttachment2D;
  readonly options: NormalizedPhysicsColliderConfiguration2D;
}

interface AttachmentIds2D {
  bodyId?: number;
  colliderId?: number;
}

interface BodyVelocity2D {
  readonly linearVelocityX: number;
  readonly linearVelocityY: number;
  readonly angularVelocity: number;
}

export interface PhysicsWorld2DControllerSnapshot {
  readonly revision: number;
  readonly revisionMaterialized: boolean;
  readonly materializedBodyHandles: number;
  readonly materializedColliderHandles: number;
  readonly advanceRegistered: boolean;
  readonly bodyIds: readonly number[];
  readonly colliderIds: readonly number[];
  readonly kernel: ReturnType<PhysicsWorld2DKernel["snapshot"]>;
}

export class PhysicsWorld2DController {
  readonly handle: PibblPhysicsWorldHandle2D;
  private revision: WritableSignal<number> | undefined;
  private committedRevision = 0;
  private obstacles: CommittedObstacles2D | undefined;
  private obstacleSource: Readonly<{ read(): Readonly<{ revision: number; boxes: Float64Array; ellipses: Float64Array; polygons: Float64Array }> }> | undefined;

  getObstacleSource(): Readonly<{ read(): Readonly<{ revision: number; boxes: Float64Array; ellipses: Float64Array; polygons: Float64Array }> }> {
    this.assertActive();
    if (!this.obstacleSource) {
      if (this.liveCandidate) throw new Error("Create physics obstacles before simulation Advance.");
      this.obstacles = new CommittedObstacles2D();
      this.obstacles.publish(this.kernel, this.acceptedColliders, this.committedRevision);
      this.obstacleSource = Object.freeze({ read: () => {
        this.assertActive();
        return this.obstacles!.read();
      } });
    }
    return this.obstacleSource;
  }
  private failedFrames = 0;
  private lastFailure: string | null = null;
  private readonly kernel: PhysicsWorld2DKernel;
  private readonly ids = new WeakMap<object, AttachmentIds2D>();
  private nextId = 0;
  private draft: RenderDraft2D | undefined;
  private acceptedTopology: readonly PhysicsTopologyRecord2D[] = Object.freeze(
    [],
  );
  private acceptedBodies: readonly AcceptedBody2D[] = Object.freeze([]);
  private acceptedColliders: readonly AcceptedCollider2D[] = Object.freeze([]);
  private acceptedConfiguration: NormalizedPhysicsWorld2DConfiguration;
  private acceptedProps: PibblResolvedPhysicsWorld2DProps = Object.freeze({});
  private readonly suspendedVelocities = new Map<number, BodyVelocity2D>();
  private readonly materializedBodyHandles = new Map<
    string,
    PibblPhysicsBodyHandle2D
  >();
  private readonly materializedColliderHandles = new Map<
    string,
    PibblPhysicsColliderHandle2D
  >();
  private materializedHandleTopologyPending = false;
  private readonly queries: CommittedWorldQueries2D;
  private queuedBegin: Readonly<{ cancel(): void }> | undefined;
  private releaseAdvance: (() => void) | undefined;
  private readonly releasePassiveAdvance: () => void;
  private liveCandidate: PhysicsWorld2DCandidate | undefined;
  private active = true;
  private readonly space: "root" | "local";
  private simulationToRoot = new DOMMatrix();
  private readonly targetConsumer: PibblInternalSignalConsumer;

  constructor(
    private readonly owner: PibblInternalSimulationOwner,
    initialProps: PibblResolvedPhysicsWorld2DProps,
  ) {
    this.space = initialProps.space ?? "root";
    if (this.space !== "root" && this.space !== "local")
      throw new TypeError('PhysicsWorld2D space must be "root" or "local".');
    this.targetConsumer = pibblInternalCreateSignalConsumer({
      owner: pibblInternalCurrentRenderOwner(),
      debugName: "PhysicsWorld2D kinematic targets",
      invalidate: () => {
        if (this.active) this.ensureAdvance();
      },
    });
    const configuration = normalizeWorldConfiguration(initialProps);
    this.kernel = new PhysicsWorld2DKernel(
      denormalizeWorldConfiguration(configuration),
      new RapierSimulation2D(),
    );
    // Idle worlds still observe animation's staged target in the same Advance
    // phase, without keeping the host clock alive themselves.
    this.releasePassiveAdvance = pibblInternalRegisterSimulationAdvance(
      this.owner,
      "physics",
      (frame, batch) => {
        if (this.releaseAdvance !== undefined) return;
        const targets = this.readKinematicTargets(batch);
        for (const [id, target] of targets) {
          if (this.kernel.bodyIdentity(id) === undefined) continue;
          const pose = this.kernel.authoritativePose(id);
          if (
            target.position[0] !== pose.position[0] ||
            target.position[1] !== pose.position[1] ||
            target.rotationDegrees !== pose.rotationDegrees
          ) {
            this.ensureAdvance();
            this.advance(frame.frameId, frame.logicalTime, batch);
            return;
          }
        }
      },
      false,
    );
    this.queries = new CommittedWorldQueries2D({
      generation: 1,
      bodies: this.kernel.bodies,
      colliders: this.kernel.colliders,
      broadPhase: this.kernel.broadPhase,
      materializeBody: (index, generation) =>
        this.materializeBodyHandle(index, generation),
      materializeCollider: (index, generation) =>
        this.materializeColliderHandle(index, generation),
      resolveBody: (handle) => this.resolveBodyHandle(handle),
      resolveCollider: (handle) => this.resolveColliderHandle(handle),
    });
    this.acceptedConfiguration = configuration;
    const target = {
      [worldController2DSymbol]: this,
    } as Record<PropertyKey, unknown>;
    Object.defineProperty(target, "revision", {
      enumerable: true,
      get: () => this.materializeRevision().asReadonly(),
    });
    this.handle = Object.freeze(target) as unknown as InternalWorldHandle2D;
  }

  beginRender(
    props: PibblResolvedPhysicsWorld2DProps,
    rootTransform = new DOMMatrix(),
  ): void {
    if ((props.space ?? "root") !== this.space)
      throw new Error(
        "PhysicsWorld2D space is creation-only; remount the world with a new key to change it.",
      );
    const simulationToRoot =
      this.space === "local" ? rootTransform : new DOMMatrix();
    const { a, b, c, d, e, f } = simulationToRoot;
    if (
      ![a, b, c, d, e, f].every(Number.isFinite) ||
      Math.abs(a * d - b * c) < 1e-10
    )
      throw new Error(
        "PhysicsWorld2D viewport transform must be finite and invertible.",
      );
    this.assertActive();
    if (this.draft !== undefined) {
      throw new Error(
        "PhysicsWorld2D began a second render before finishing the first.",
      );
    }
    this.draft = {
      simulationToRoot,
      configuration: normalizeWorldConfiguration(props),
      props,
      bodies: new Map(),
      colliders: new Map(),
    };
    pibblInternalOnSimulationRenderTransactionFinish(this.owner, (success) =>
      this.finishRender(success),
    );
  }

  simulationTransform(root: DOMMatrix): DOMMatrix {
    return (this.draft?.simulationToRoot ?? this.simulationToRoot)
      .inverse()
      .multiply(root);
  }

  rootTransform(local: DOMMatrix): DOMMatrix {
    return (this.draft?.simulationToRoot ?? this.simulationToRoot).multiply(
      local,
    );
  }

  convertPoint(point: PibblPhysicsVector2, toRoot: boolean): PibblPhysicsVector2 {
    this.assertActive();
    const value = copyFiniteVector2(point, "point");
    const matrix = toRoot
      ? this.simulationToRoot
      : this.simulationToRoot.inverse();
    return Object.freeze([
      matrix.a * value[0] + matrix.c * value[1] + matrix.e,
      matrix.b * value[0] + matrix.d * value[1] + matrix.f,
    ]);
  }

  bodyIdFor(attachment: MountedPhysicsAttachment2D): number {
    let ids = this.ids.get(attachment);
    if (!ids) {
      ids = {};
      this.ids.set(attachment, ids);
    }
    return (ids.bodyId ??= this.allocateId());
  }

  colliderIdFor(attachment: MountedPhysicsAttachment2D): number {
    let ids = this.ids.get(attachment);
    if (!ids) {
      ids = {};
      this.ids.set(attachment, ids);
    }
    return (ids.colliderId ??= this.allocateId());
  }

  collectBody(
    attachment: MountedPhysicsAttachment2D,
    bodyId: number,
    descriptor: PhysicsBodyAttachment2DDescriptor,
    initialPose: PibblPhysicsPose2D = ZERO_POSE_2D,
  ): void {
    const draft = this.requireDraft();
    draft.bodies.set(bodyId, {
      id: bodyId,
      attachment,
      descriptor,
      initialPose: copyPhysicsPose2D(initialPose),
    });
    const collider = descriptor.options.collider;
    if (
      collider !== false &&
      collider.shape !== "self" &&
      descriptor.options.enabled
    ) {
      const colliderId = this.colliderIdFor(attachment);
      draft.colliders.set(colliderId, {
        id: colliderId,
        bodyId,
        attachment,
        options: collider,
        shape: attachment.resolveShape(collider),
      });
    }
  }

  collectCollider(
    attachment: MountedPhysicsAttachment2D,
    bodyId: number,
    options: NormalizedPhysicsColliderConfiguration2D,
  ): void {
    if (options.shape === "self") return;
    const draft = this.requireDraft();
    if (draft.bodies.get(bodyId)?.descriptor.options.enabled === false) return;
    const colliderId = this.colliderIdFor(attachment);
    draft.colliders.set(colliderId, {
      id: colliderId,
      bodyId,
      attachment,
      options,
      shape: attachment.resolveShape(options),
    });
  }

  queueCommands(commands: readonly PhysicsCommand2D[]): void {
    this.assertActive();
    if (commands.length === 0) return;
    pibblInternalQueueSimulationBegin(this.owner, () => {
      this.kernel.applyBegin(commands);
    });
    this.ensureAdvance();
  }

  acceptBodyHandleCommand(
    handle: PibblPhysicsBodyHandle2D,
    bindingGeneration: number,
    command: PhysicsBodyCommand2D,
  ): boolean {
    if (!this.active) return false;
    const binding = physicsBodyHandleBinding2D(handle);
    const accepted = this.acceptedBodies.find(
      (body) =>
        body.id === command.bodyId &&
        body.descriptor.options.handle === handle &&
        body.handleBindingGeneration === bindingGeneration,
    );
    const identity = this.kernel.bodyIdentity(command.bodyId);
    const materialized =
      identity === undefined
        ? undefined
        : this.materializedBodyHandles.get(
            `${String(identity.index)}:${String(identity.generation)}`,
          );
    if (
      binding?.controller !== this ||
      binding.bindingGeneration !== bindingGeneration ||
      (accepted === undefined && materialized !== handle)
    ) {
      return false;
    }
    this.kernel.applyBegin([command]);
    this.ensureAdvance();
    return true;
  }

  presentationPose(bodyId: number): PibblPhysicsPose2D | undefined {
    return this.kernel.bodyIdentity(bodyId) !== undefined
      ? this.kernel.presentationPose(bodyId)
      : undefined;
  }

  raycast<Mode extends PibblPhysicsQueryMode = "closest">(
    ray: PibblPhysicsRay2D,
    options?: PibblPhysicsQueryOptions2D<Mode>,
  ): PibblPhysicsQueryResult2D<Mode, PibblPhysicsQueryHit2D> {
    this.assertActive();
    return this.queries.raycast(1, ray, options);
  }

  shapeCast<Mode extends PibblPhysicsQueryMode = "closest">(
    shape: PibblPhysicsShape2D,
    from: PibblPhysicsPose2D,
    translation: PibblPhysicsVector2,
    options?: PibblPhysicsQueryOptions2D<Mode>,
  ): PibblPhysicsQueryResult2D<Mode, PibblPhysicsQueryHit2D> {
    this.assertActive();
    return this.queries.shapeCast(1, shape, from, translation, options);
  }

  overlapShape<Mode extends PibblPhysicsQueryMode = "closest">(
    shape: PibblPhysicsShape2D,
    pose: PibblPhysicsPose2D,
    options?: PibblPhysicsQueryOptions2D<Mode>,
  ): PibblPhysicsQueryResult2D<Mode, PibblPhysicsQueryMatch2D> {
    this.assertActive();
    return this.queries.overlapShape(1, shape, pose, options);
  }

  queryAabb<Mode extends PibblPhysicsQueryMode = "closest">(
    bounds: PibblPhysicsAabb2D,
    options?: PibblPhysicsQueryOptions2D<Mode>,
  ): PibblPhysicsQueryResult2D<Mode, PibblPhysicsQueryMatch2D> {
    this.assertActive();
    return this.queries.queryAabb(1, bounds, options);
  }

  queryPoint<Mode extends PibblPhysicsQueryMode = "closest">(
    point: PibblPhysicsVector2,
    options?: PibblPhysicsQueryOptions2D<Mode>,
  ): PibblPhysicsQueryResult2D<Mode, PibblPhysicsQueryMatch2D> {
    this.assertActive();
    return this.queries.queryPoint(1, point, options);
  }

  bodyHandleValues(bodyId: number): PhysicsBodyHandleValues2D | undefined {
    if (!this.active) return undefined;
    const identity = this.kernel.bodyIdentity(bodyId);
    if (identity === undefined) return undefined;
    const index = identity.index;
    const bodies = this.kernel.bodies;
    const state = {
      linearVelocityX: bodies.linearVelocityX[index]!,
      linearVelocityY: bodies.linearVelocityY[index]!,
      angularVelocity: bodies.angularVelocity[index]!,
      flags: bodies.flags[index]!,
      generation: identity.generation,
    };
    const pose = this.kernel.authoritativePose(bodyId);
    return Object.freeze({
      position: pose.position,
      rotationDegrees: pose.rotationDegrees,
      linearVelocity: Object.freeze([
        state.linearVelocityX,
        state.linearVelocityY,
      ] as const),
      angularVelocityDegreesPerSecond: (state.angularVelocity * 180) / Math.PI,
      sleeping: (state.flags & BODY_SLEEPING_2D) !== 0,
      enabled: this.kernel.isBodyEnabled(bodyId),
      generation: state.generation,
    });
  }

  inspectBody(bodyId: number): PibblPhysicsBodyInspection2D | undefined {
    if (!this.active) return undefined;
    const identity = this.kernel.bodyIdentity(bodyId);
    const declared = this.acceptedBodies.find((body) => body.id === bodyId);
    if (identity === undefined || declared === undefined) return undefined;
    const index = identity.index;
    const bodies = this.kernel.bodies;
    const flags = bodies.flags[index]!;
    return Object.freeze({
      id: bodyId,
      generation: identity.generation,
      type: declared.descriptor.bodyType,
      enabled: this.kernel.isBodyEnabled(bodyId),
      sleeping: !!(flags & BODY_SLEEPING_2D),
      pose: this.kernel.authoritativePose(bodyId),
      presentationPose: this.kernel.presentationPose(bodyId),
      centerOfMass: Object.freeze([
        bodies.positionX[index]!,
        bodies.positionY[index]!,
      ] as const),
      linearVelocity: Object.freeze([
        bodies.linearVelocityX[index]!,
        bodies.linearVelocityY[index]!,
      ] as const),
      angularVelocityDegreesPerSecond:
        (bodies.angularVelocity[index]! * 180) / Math.PI,
      mass: bodies.inverseMass[index]! > 0 ? 1 / bodies.inverseMass[index]! : null,
    });
  }

  dispose(): void {
    if (!this.active) return;
    this.active = false;
    this.targetConsumer.dispose();
    this.releasePassiveAdvance();
    this.queuedBegin?.cancel();
    this.queuedBegin = undefined;
    this.releaseAdvance?.();
    this.releaseAdvance = undefined;
    if (this.liveCandidate !== undefined) {
      this.kernel.discard(this.liveCandidate);
      this.liveCandidate = undefined;
    }
    for (const body of this.acceptedBodies) this.unbindBodyHandle(body);
    for (const handle of this.materializedBodyHandles.values()) {
      const binding = physicsBodyHandleBinding2D(handle);
      if (binding?.controller === this) {
        unbindPhysicsBodyHandle2D(
          handle,
          this,
          binding.bodyId,
          binding.bindingGeneration,
        );
      }
    }
    this.materializedBodyHandles.clear();
    this.materializedColliderHandles.clear();
    this.materializedHandleTopologyPending = false;
    this.obstacles = undefined;
    this.obstacleSource = undefined;
    this.kernel.dispose();
    this.queries.invalidate();
    this.acceptedBodies = Object.freeze([]);
    this.acceptedColliders = Object.freeze([]);
    this.draft = undefined;
    this.suspendedVelocities.clear();
  }

  inspect(): PibblPhysicsInspection2D {
    this.assertActive();
    const snapshot = this.kernel.snapshot();
    const vector = (x: number, y: number): PibblPhysicsVector2 =>
      Object.freeze([x, y]);
    const contacts = this.kernel.contacts;
    const declaredTypes = new Map(
      this.acceptedBodies.map((body) => [body.id, body.descriptor.bodyType]),
    );
    return Object.freeze({
      engine: "rapier-2d@0.21.0",
      space: this.space,
      revision: this.committedRevision,
      tick: snapshot.tick,
      advancing: this.releaseAdvance !== undefined,
      failedFrames: this.failedFrames,
      lastFailure: this.lastFailure,
      bodies: Object.freeze(
        snapshot.bodies.map((body) =>
          Object.freeze({
            id: body.id,
            generation: body.generation,
            type: declaredTypes.get(body.id)!,
            enabled: this.kernel.isBodyEnabled(body.id),
            sleeping: !!(body.flags & BODY_SLEEPING_2D),
            pose: this.kernel.authoritativePose(body.id),
            presentationPose: this.kernel.presentationPose(body.id),
            centerOfMass: vector(body.positionX, body.positionY),
            linearVelocity: vector(body.linearVelocityX, body.linearVelocityY),
            angularVelocityDegreesPerSecond:
              (body.angularVelocity * 180) / Math.PI,
            mass: body.inverseMass > 0 ? 1 / body.inverseMass : null,
          }),
        ),
      ),
      colliders: Object.freeze(
        this.acceptedColliders.flatMap((collider) => {
          const identity = this.kernel.colliderIdentity(collider.id);
          if (!identity) return [];
          const shape = this.kernel.colliders.shapes[identity.index]!;
          return [
            Object.freeze({
              id: collider.id,
              generation: identity.generation,
              bodyId: collider.bodyId,
              sensor: !!(
                this.kernel.colliders.flags[identity.index]! &
                COLLIDER_SENSOR_2D
              ),
              label:
                typeof collider.options.tag === "string"
                  ? collider.options.tag
                  : null,
              shapeKinds: Object.freeze(shape.leaves.map((leaf) => leaf.kind)),
              bounds: boundsOfShape2D(
                createShape2D(shape),
                this.kernel.authoritativePose(collider.bodyId),
              ),
            }),
          ];
        }),
      ),
      contacts: Object.freeze(
        Array.from(
          { length: contacts.contactCount },
          (_, index) => index,
        ).flatMap((index) => {
          const firstColliderId = this.kernel.colliderIdForIdentity(
            contacts.firstColliderIndices[index]!,
            contacts.firstColliderGenerations[index]!,
          );
          const secondColliderId = this.kernel.colliderIdForIdentity(
            contacts.secondColliderIndices[index]!,
            contacts.secondColliderGenerations[index]!,
          );
          if (firstColliderId === undefined || secondColliderId === undefined)
            return [];
          return [
            Object.freeze({
              firstColliderId,
              secondColliderId,
              sensor: contacts.sensorFlags[index] !== 0,
              normal: vector(
                contacts.normalX[index]!,
                contacts.normalY[index]!,
              ),
              normalImpulse:
                contacts.pointNormalImpulses[index * 2]! +
                (contacts.pointCounts[index]! > 1
                  ? contacts.pointNormalImpulses[index * 2 + 1]!
                  : 0),
              points: Object.freeze(
                Array.from(
                  { length: contacts.pointCounts[index]! },
                  (_, point) => {
                    const offset = index * 2 + point;
                    return Object.freeze({
                      pointOnFirst: vector(
                        contacts.pointFirstX[offset]!,
                        contacts.pointFirstY[offset]!,
                      ),
                      pointOnSecond: vector(
                        contacts.pointSecondX[offset]!,
                        contacts.pointSecondY[offset]!,
                      ),
                      separation: contacts.pointSeparations[offset]!,
                    });
                  },
                ),
              ),
            }),
          ];
        }),
      ),
    });
  }

  snapshot(): PhysicsWorld2DControllerSnapshot {
    return Object.freeze({
      revision: this.committedRevision,
      revisionMaterialized: this.revision !== undefined,
      materializedBodyHandles: this.materializedBodyHandles.size,
      materializedColliderHandles: this.materializedColliderHandles.size,
      advanceRegistered: this.releaseAdvance !== undefined,
      bodyIds: Object.freeze(
        this.acceptedTopology
          .filter(
            (record): record is PhysicsBodyTopologyRecord2D =>
              record.kind === "body",
          )
          .map((record) => record.id),
      ),
      colliderIds: Object.freeze(
        this.acceptedTopology
          .filter(
            (record): record is PhysicsColliderTopologyRecord2D =>
              record.kind === "collider",
          )
          .map((record) => record.id),
      ),
      kernel: this.kernel.snapshot(),
    });
  }

  private finishRender(success: boolean): void {
    const draft = this.draft;
    this.draft = undefined;
    if (!success || draft === undefined || !this.active) return;
    validateAutomaticMass(draft);
    const reenableVelocities = this.resolveReenableVelocities(draft);
    const previousBodyDefinitions = new Map(
      this.acceptedTopology
        .filter(
          (record): record is PhysicsBodyTopologyRecord2D =>
            record.kind === "body",
        )
        .map((record) => [record.id, record.definition] as const),
    );
    const topology = materializeTopology(
      draft,
      reenableVelocities,
      previousBodyDefinitions,
    );
    const topologyChanged = !sameTopology(this.acceptedTopology, topology);
    const configurationChanged = !sameConfiguration(
      this.acceptedConfiguration,
      draft.configuration,
    );
    const nextBodies = [...draft.bodies.values()].sort(
      (left, right) => left.id - right.id,
    );
    validateUniqueBodyHandles(nextBodies);
    const nextBodiesById = new Map(nextBodies.map((body) => [body.id, body]));
    for (const body of this.acceptedBodies) {
      const next = nextBodiesById.get(body.id);
      const retained =
        next !== undefined &&
        next.descriptor.options.handle === body.descriptor.options.handle;
      if (!retained) this.unbindBodyHandle(body);
    }
    this.simulationToRoot = draft.simulationToRoot;
    this.acceptedProps = draft.props;
    this.acceptedBodies = Object.freeze(
      nextBodies.map(({ id, attachment, descriptor, initialPose }) =>
        Object.freeze({
          id,
          attachment,
          descriptor,
          initialPose,
          handleBindingGeneration:
            descriptor.options.handle === undefined
              ? undefined
              : bindPhysicsBodyHandle2D(descriptor.options.handle, this, id),
        }),
      ),
    );
    this.acceptedColliders = Object.freeze(
      [...draft.colliders.values()]
        .sort((left, right) => left.id - right.id)
        .map(({ id, bodyId, attachment, options }) =>
          Object.freeze({ id, bodyId, attachment, options }),
        ),
    );
    this.targetConsumer.collect(() => {
      for (const body of this.acceptedBodies) {
        if (
          body.descriptor.bodyType !== "kinematic" ||
          !body.descriptor.options.enabled
        )
          continue;
        body.descriptor.options.target.position?.get();
        body.descriptor.options.target.rotationDegrees?.get();
      }
    });
    this.targetConsumer.markClean();
    this.acceptedTopology = topology;
    this.kernel.updateColliderMetadata(topology);
    if (topologyChanged) this.materializedHandleTopologyPending = true;
    if (!topologyChanged && !configurationChanged) return;
    this.acceptedConfiguration = draft.configuration;
    this.queuedBegin?.cancel();
    this.queuedBegin = pibblInternalQueueSimulationBegin(this.owner, () => {
      this.queuedBegin = undefined;
      if (topologyChanged) this.kernel.proposeTopology(this.acceptedTopology);
      if (configurationChanged) {
        this.kernel.applyBegin([
          {
            kind: "configure",
            configuration: denormalizeWorldConfiguration(draft.configuration),
          },
        ]);
      }
    });
    this.ensureAdvance();
  }

  private ensureAdvance(): void {
    if (this.releaseAdvance !== undefined) return;
    this.releaseAdvance = pibblInternalRegisterSimulationAdvance(
      this.owner,
      "physics",
      (frame, batch) => this.advance(frame.frameId, frame.logicalTime, batch),
    );
  }

  private resolveReenableVelocities(
    draft: RenderDraft2D,
  ): ReadonlyMap<number, BodyVelocity2D> {
    const previousById = new Map(
      this.acceptedBodies.map((body) => [body.id, body]),
    );
    const overrides = new Map<number, BodyVelocity2D>();
    for (const body of draft.bodies.values()) {
      const previous = previousById.get(body.id);
      const currentDynamic =
        body.descriptor.bodyType === "dynamic" ? body.descriptor : undefined;
      const previousDynamic =
        previous?.descriptor.bodyType === "dynamic"
          ? previous.descriptor
          : undefined;
      if (
        currentDynamic !== undefined &&
        !currentDynamic.options.enabled &&
        previousDynamic?.options.enabled
      ) {
        const identity = this.kernel.bodyIdentity(body.id);
        if (identity !== undefined) {
          const bodies = this.kernel.bodies;
          this.suspendedVelocities.set(
            body.id,
            Object.freeze({
              linearVelocityX: bodies.linearVelocityX[identity.index]!,
              linearVelocityY: bodies.linearVelocityY[identity.index]!,
              angularVelocity: bodies.angularVelocity[identity.index]!,
            }),
          );
        }
      }
      if (
        currentDynamic?.options.enabled &&
        previousDynamic !== undefined &&
        !previousDynamic.options.enabled
      ) {
        const preserved = this.suspendedVelocities.get(body.id);
        overrides.set(
          body.id,
          currentDynamic.options.reenableVelocity === "preserve" && preserved
            ? preserved
            : ZERO_VELOCITY_2D,
        );
      }
    }
    const retained = new Set(draft.bodies.keys());
    for (const id of this.suspendedVelocities.keys()) {
      if (!retained.has(id)) this.suspendedVelocities.delete(id);
    }
    return overrides;
  }

  private advance(
    frameId: number,
    logicalTime: number,
    batch: PibblInternalSignalBatch,
  ): void {
    let candidate: PhysicsWorld2DCandidate | undefined;
    try {
      candidate = this.kernel.advance({
        frameId,
        logicalTime,
        stagedKinematicTargets: this.readKinematicTargets(batch),
      });
      if (candidate === undefined) return;
      this.liveCandidate = candidate;
      const nextRevision = this.committedRevision + 1;
      this.stagePublicSignals(batch, nextRevision);
      const events = this.copyEventDeliveries(candidate);
      let adopted = false;
      if (events.length > 0) {
        pibblInternalQueueSimulationComplete(this.owner, () => {
          if (adopted) this.deliverEvents(events);
        });
      }
      pibblInternalQueueSimulationCommitAcknowledgement(
        this.owner,
        (_frame, outcome) => {
          if (this.liveCandidate !== candidate) return;
          this.liveCandidate = undefined;
          if (!outcome.applied) {
            this.kernel.discard(candidate!);
            return;
          }
          this.kernel.adopt(candidate!);
          if (this.materializedHandleTopologyPending) {
            this.evictRetiredMaterializedHandles();
            this.materializedHandleTopologyPending = false;
          }
          this.committedRevision = nextRevision;
          this.obstacles?.publish(this.kernel, this.acceptedColliders, nextRevision);
          adopted = true;
          pibblInternalRequestSimulationRender(this.owner);
          if (
            !this.hasAwakeBodies() &&
            (candidate!.stepCount > 0 ||
              !this.acceptedBodies.some(
                (body) => body.descriptor.bodyType === "kinematic",
              ))
          ) {
            this.releaseAdvance?.();
            this.releaseAdvance = undefined;
          }
        },
      );
    } catch (error) {
      this.failedFrames++;
      this.lastFailure = error instanceof Error ? error.message : String(error);
      if (candidate?.lifecycle === "live") this.kernel.discard(candidate);
      if (this.liveCandidate === candidate) this.liveCandidate = undefined;
      const onError = this.acceptedProps.onError;
      if (onError) {
        pibblInternalQueueSimulationComplete(this.owner, () => onError(error));
      }
      throw error;
    }
  }

  private readKinematicTargets(
    batch: PibblInternalSignalBatch,
  ): ReadonlyMap<number, PibblPhysicsPose2D> {
    const targets = new Map<number, PibblPhysicsPose2D>();
    for (const body of this.acceptedBodies) {
      if (
        body.descriptor.bodyType !== "kinematic" ||
        !body.descriptor.options.enabled
      )
        continue;
      const target = body.descriptor.options.target;
      if (
        target.position === undefined &&
        target.rotationDegrees === undefined
      ) {
        continue;
      }
      const position =
        target.position === undefined
          ? body.initialPose.position
          : batch.read(
              target.position as WritableSignal<readonly [number, number]>,
            );
      const rotationDegrees =
        target.rotationDegrees === undefined
          ? body.initialPose.rotationDegrees
          : batch.read(target.rotationDegrees as WritableSignal<number>);
      targets.set(
        body.id,
        Object.freeze({
          position: Object.freeze([position[0], position[1]] as const),
          rotationDegrees,
        }),
      );
    }
    return targets;
  }

  private stagePublicSignals(
    batch: PibblInternalSignalBatch,
    nextRevision: number,
  ): void {
    if (this.revision !== undefined) {
      batch.stage(this.revision, nextRevision, this);
    }
    const bodies = this.kernel.bodies;
    for (const body of this.acceptedBodies) {
      const identity = this.kernel.bodyIdentity(body.id);
      if (identity === undefined) continue;
      const explicit = body.descriptor.options.handle;
      const materialized = this.materializedBodyHandles.get(
        `${String(identity.index)}:${String(identity.generation)}`,
      );
      if (explicit === undefined && materialized === undefined) continue;
      const pose = this.kernel.authoritativePose(body.id);
      const values = {
        position: pose.position,
        rotationDegrees: pose.rotationDegrees,
        linearVelocity: Object.freeze([
          bodies.linearVelocityX[identity.index]!,
          bodies.linearVelocityY[identity.index]!,
        ] as const),
        angularVelocityDegreesPerSecond:
          (bodies.angularVelocity[identity.index]! * 180) / Math.PI,
        sleeping: (bodies.flags[identity.index]! & BODY_SLEEPING_2D) !== 0,
        enabled: this.kernel.isBodyEnabled(body.id),
        generation: identity.generation,
      } as const;
      if (explicit !== undefined) {
        stagePhysicsBodyHandle2D(batch, explicit, values, this);
      }
      if (materialized !== undefined && materialized !== explicit) {
        stagePhysicsBodyHandle2D(batch, materialized, values, this);
      }
    }
  }

  private copyEventDeliveries(
    candidate: PhysicsWorld2DCandidate,
  ): readonly PhysicsEventDelivery2D[] {
    const events: PhysicsEventDelivery2D[] = [];
    for (let offset = 0; offset < candidate.eventCount; offset += 1) {
      const eventIndex = candidate.eventOffset + offset;
      const kind = candidate.eventKinds[eventIndex];
      if (kind === 5 || kind === 6) {
        const handler =
          kind === 6 ? this.acceptedProps.onSleep : this.acceptedProps.onWake;
        if (handler === undefined) continue;
        const bodyIndex = candidate.eventFirstColliderIndices[eventIndex]!;
        const bodyGeneration = this.kernel.bodies.generations[bodyIndex]!;
        const bodyId = this.kernel.bodyIdForIdentity(bodyIndex, bodyGeneration);
        if (bodyId === undefined) continue;
        events.push(
          Object.freeze({
            kind,
            tick: candidate.eventTicks[eventIndex]!,
            bodyIndex,
            bodyGeneration,
            bodyId,
            handler,
          }) satisfies PhysicsBodyEventDelivery2D,
        );
        continue;
      }
      if (kind !== 1 && kind !== 2 && kind !== 3 && kind !== 4 && kind !== 7) {
        continue;
      }
      this.copyContactEventDeliveries(candidate, eventIndex, kind, events);
    }
    return sortPhysicsEventDeliveries2D(events);
  }

  private copyContactEventDeliveries(
    candidate: PhysicsWorld2DCandidate,
    eventIndex: number,
    kind: PhysicsContactEventDelivery2D["kind"],
    events: PhysicsEventDelivery2D[],
  ): void {
    const firstColliderIndex = candidate.eventFirstColliderIndices[eventIndex]!;
    const firstColliderGeneration =
      candidate.eventFirstColliderGenerations[eventIndex]!;
    const secondColliderIndex =
      candidate.eventSecondColliderIndices[eventIndex]!;
    const secondColliderGeneration =
      candidate.eventSecondColliderGenerations[eventIndex]!;
    const first = this.acceptedColliderForIdentity(
      firstColliderIndex,
      firstColliderGeneration,
    );
    const second = this.acceptedColliderForIdentity(
      secondColliderIndex,
      secondColliderGeneration,
    );
    if (first === undefined || second === undefined) return;
    const handlerName = eventHandlerName(kind);
    const firstHandler = first.options.handlers[handlerName];
    const secondHandler = second.options.handlers[handlerName];
    if (firstHandler === undefined && secondHandler === undefined) return;
    const firstBodyIdentity = this.kernel.bodyIdentity(first.bodyId);
    const secondBodyIdentity = this.kernel.bodyIdentity(second.bodyId);
    if (firstBodyIdentity === undefined || secondBodyIdentity === undefined)
      return;
    const points: Array<PhysicsContactEventDelivery2D["points"][number]> = [];
    const pointBase = eventIndex * 2;
    for (
      let point = 0;
      point < candidate.eventPointCounts[eventIndex]!;
      point += 1
    ) {
      points.push(
        Object.freeze({
          firstX: candidate.eventPointFirstX[pointBase + point]!,
          firstY: candidate.eventPointFirstY[pointBase + point]!,
          secondX: candidate.eventPointSecondX[pointBase + point]!,
          secondY: candidate.eventPointSecondY[pointBase + point]!,
          separation: candidate.eventPointSeparations[pointBase + point]!,
        }),
      );
    }
    const common = {
      kind,
      tick: candidate.eventTicks[eventIndex]!,
      firstColliderIndex,
      firstColliderGeneration,
      secondColliderIndex,
      secondColliderGeneration,
      firstBodyIndex: firstBodyIdentity.index,
      firstBodyGeneration: firstBodyIdentity.generation,
      secondBodyIndex: secondBodyIdentity.index,
      secondBodyGeneration: secondBodyIdentity.generation,
      normalX: candidate.eventNormalX[eventIndex]!,
      normalY: candidate.eventNormalY[eventIndex]!,
      points: Object.freeze(points),
      totalNormalImpulse: candidate.eventTotalNormalImpulses[eventIndex]!,
    } as const;
    if (firstHandler !== undefined) {
      events.push(
        Object.freeze({
          ...common,
          receiver: "first",
          receiverColliderId: first.id,
          receiverBodyId: first.bodyId,
          handler: firstHandler,
          selfTag: first.options.tag,
          otherTag: second.options.tag,
        }) as PhysicsContactEventDelivery2D,
      );
    }
    if (secondHandler !== undefined) {
      events.push(
        Object.freeze({
          ...common,
          receiver: "second",
          receiverColliderId: second.id,
          receiverBodyId: second.bodyId,
          handler: secondHandler,
          selfTag: second.options.tag,
          otherTag: first.options.tag,
        }) as PhysicsContactEventDelivery2D,
      );
    }
  }

  private deliverEvents(events: readonly PhysicsEventDelivery2D[]): void {
    if (!this.active) return;
    const errors: unknown[] = [];
    for (const fact of events) {
      try {
        if (isPhysicsBodyEventDelivery2D(fact)) {
          const handler = this.bodyEventHandler(fact);
          if (!handler) continue;
          handler(
            materializePhysicsBodyEvent2D(
              fact,
              this.materializeBodyHandle(fact.bodyIndex, fact.bodyGeneration),
            ),
          );
          continue;
        }
        const handler = this.contactEventHandler(fact);
        if (!handler) continue;
        handler(
          materializePhysicsContactEvent2D(fact, {
            body: (index, generation) =>
              this.materializeBodyHandle(index, generation),
            collider: (index, generation) =>
              this.materializeColliderHandle(index, generation),
          }) as never,
        );
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length === 1) throw errors[0];
    if (errors.length > 1) {
      throw new AggregateError(
        errors,
        "Multiple physics 2D event callbacks failed.",
      );
    }
  }

  private bodyEventHandler(
    fact: PhysicsBodyEventDelivery2D,
  ): PhysicsBodyEventDelivery2D["handler"] | undefined {
    const handler =
      fact.kind === 6 ? this.acceptedProps.onSleep : this.acceptedProps.onWake;
    const identity = this.kernel.bodyIdentity(fact.bodyId);
    return identity?.index === fact.bodyIndex &&
      identity.generation === fact.bodyGeneration
      ? handler
      : undefined;
  }

  private contactEventHandler(
    fact: PhysicsContactEventDelivery2D,
  ): PhysicsContactEventDelivery2D["handler"] | undefined {
    const receiver = this.acceptedColliders.find(
      (collider) => collider.id === fact.receiverColliderId,
    );
    if (receiver === undefined || receiver.bodyId !== fact.receiverBodyId)
      return undefined;
    const handler = receiver.options.handlers[eventHandlerName(fact.kind)];
    const colliderIdentity = this.kernel.colliderIdentity(receiver.id);
    const expectedIndex =
      fact.receiver === "first"
        ? fact.firstColliderIndex
        : fact.secondColliderIndex;
    const expectedGeneration =
      fact.receiver === "first"
        ? fact.firstColliderGeneration
        : fact.secondColliderGeneration;
    return colliderIdentity?.index === expectedIndex &&
      colliderIdentity.generation === expectedGeneration
      ? handler
      : undefined;
  }

  private acceptedColliderForIdentity(
    index: number,
    generation: number,
  ): AcceptedCollider2D | undefined {
    return this.acceptedColliders.find((collider) => {
      const identity = this.kernel.colliderIdentity(collider.id);
      return identity?.index === index && identity.generation === generation;
    });
  }

  private hasAwakeBodies(): boolean {
    for (const body of this.acceptedBodies) {
      if (
        body.descriptor.bodyType !== "kinematic" ||
        !body.descriptor.options.enabled ||
        this.kernel.bodyIdentity(body.id) === undefined
      )
        continue;
      const pose = this.kernel.authoritativePose(body.id);
      const target = body.descriptor.options.target;
      const position = target.position?.get() ?? body.initialPose.position;
      const rotation =
        target.rotationDegrees?.get() ?? body.initialPose.rotationDegrees;
      if (
        (position &&
          (position[0] !== pose.position[0] ||
            position[1] !== pose.position[1])) ||
        (rotation !== undefined && rotation !== pose.rotationDegrees)
      )
        return true;
    }
    const bodies = this.kernel.bodies;
    for (const body of this.acceptedBodies) {
      const identity = this.kernel.bodyIdentity(body.id);
      if (identity === undefined) continue;
      const index = identity.index;
      const flags = bodies.flags[index]!;
      if (
        (flags & BODY_TYPE_KINEMATIC_2D) !== 0 &&
        (bodies.linearVelocityX[index]! !== 0 ||
          bodies.linearVelocityY[index]! !== 0 ||
          bodies.angularVelocity[index]! !== 0)
      )
        return true;
      if (
        (flags & BODY_TYPE_DYNAMIC_2D) !== 0 &&
        (flags & BODY_SLEEPING_2D) === 0
      )
        return true;
    }
    return false;
  }

  private requireDraft(): RenderDraft2D {
    const draft = this.draft;
    if (draft === undefined) {
      throw new Error(
        "A physics attachment requires an active PhysicsWorld2D render draft.",
      );
    }
    return draft;
  }

  private allocateId(): number {
    if (this.nextId === Number.MAX_SAFE_INTEGER) {
      throw new Error("PhysicsWorld2D exhausted stable attachment identities.");
    }
    return this.nextId++;
  }

  private assertActive(): void {
    if (!this.active) {
      throw new TypeError("Expected a live Pibbl physics 2D world handle.");
    }
  }

  private materializeRevision(): WritableSignal<number> {
    return (this.revision ??= signal(this.committedRevision, {
      debugName: "PhysicsWorld2D.revision",
    }));
  }

  /** Query handles are cached only while their kernel identity remains live. */
  private evictRetiredMaterializedHandles(): void {
    for (const [key, handle] of this.materializedBodyHandles) {
      const separator = key.indexOf(":");
      const index = Number(key.slice(0, separator));
      const generation = Number(key.slice(separator + 1));
      if (this.kernel.bodyIdForIdentity(index, generation) !== undefined)
        continue;
      const binding = physicsBodyHandleBinding2D(handle);
      if (binding?.controller === this) {
        unbindPhysicsBodyHandle2D(
          handle,
          this,
          binding.bodyId,
          binding.bindingGeneration,
        );
      }
      this.materializedBodyHandles.delete(key);
    }
    for (const [key, handle] of this.materializedColliderHandles) {
      const identity = physicsColliderHandleIdentity2D(handle);
      if (
        identity?.controller === this &&
        this.kernel.colliderIdForIdentity(
          identity.index,
          identity.generation,
        ) !== undefined
      )
        continue;
      this.materializedColliderHandles.delete(key);
    }
  }

  private materializeBodyHandle(
    index: number,
    generation: number,
  ): PibblPhysicsBodyHandle2D {
    const bodyId = this.kernel.bodyIdForIdentity(index, generation);
    if (bodyId === undefined) {
      throw new Error(
        "Cannot materialize a stale physics 2D body query result.",
      );
    }
    const accepted = this.acceptedBodies.find((body) => body.id === bodyId);
    const explicit = accepted?.descriptor.options.handle;
    if (explicit !== undefined) return explicit;
    const key = `${String(index)}:${String(generation)}`;
    let handle = this.materializedBodyHandles.get(key);
    if (handle === undefined) {
      handle = createPhysicsBodyHandle2D(this.owner);
      bindPhysicsBodyHandle2D(handle, this, bodyId);
      this.materializedBodyHandles.set(key, handle);
    }
    return handle;
  }

  private materializeColliderHandle(
    index: number,
    generation: number,
  ): PibblPhysicsColliderHandle2D {
    if (this.kernel.colliderIdForIdentity(index, generation) === undefined) {
      throw new Error(
        "Cannot materialize a stale physics 2D collider query result.",
      );
    }
    const key = `${String(index)}:${String(generation)}`;
    let handle = this.materializedColliderHandles.get(key);
    if (handle === undefined) {
      handle = createPhysicsColliderHandle2D(this, index, generation);
      this.materializedColliderHandles.set(key, handle);
    }
    return handle;
  }

  private resolveBodyHandle(
    handle: PibblPhysicsBodyHandle2D,
  ): Readonly<{ index: number; generation: number }> | null {
    const binding = physicsBodyHandleBinding2D(handle);
    if (binding?.controller !== this) return null;
    return this.kernel.bodyIdentity(binding.bodyId) ?? null;
  }

  private resolveColliderHandle(
    handle: PibblPhysicsColliderHandle2D,
  ): Readonly<{ index: number; generation: number }> | null {
    const identity = physicsColliderHandleIdentity2D(handle);
    if (identity?.controller !== this) return null;
    return this.kernel.colliderIdForIdentity(
      identity.index,
      identity.generation,
    ) === undefined
      ? null
      : identity;
  }

  private unbindBodyHandle(body: AcceptedBody2D): void {
    const handle = body.descriptor.options.handle;
    const generation = body.handleBindingGeneration;
    if (handle !== undefined && generation !== undefined) {
      unbindPhysicsBodyHandle2D(handle, this, body.id, generation);
    }
  }
}

export function requirePhysicsWorld2DController(
  handle: PibblPhysicsWorldHandle2D,
): PhysicsWorld2DController {
  const controller = (handle as Partial<InternalWorldHandle2D>)[
    worldController2DSymbol
  ];
  if (!(controller instanceof PhysicsWorld2DController)) {
    throw new TypeError("Expected a live Pibbl physics 2D world handle.");
  }
  return controller;
}

export function snapshotPhysicsWorld2DControllerForTest(
  controller: PhysicsWorld2DController,
): PhysicsWorld2DControllerSnapshot {
  return controller.snapshot();
}

function normalizeWorldConfiguration(
  props: PibblResolvedPhysicsWorld2DProps,
): NormalizedPhysicsWorld2DConfiguration {
  return normalizePhysicsWorld2DConfiguration({
    gravity: props.gravity,
    fixedStepMilliseconds: props.fixedStepMilliseconds,
    maxCatchUpSteps: props.maxCatchUpSteps,
    interpolation: props.interpolation,
    sleeping: props.sleeping,
    solver: props.solver,
  });
}

function denormalizeWorldConfiguration(
  configuration: NormalizedPhysicsWorld2DConfiguration,
): PhysicsWorld2DConfiguration {
  return Object.freeze({
    gravity: Object.freeze([
      configuration.gravityX,
      configuration.gravityY,
    ] as const),
    fixedStepMilliseconds: configuration.fixedStepMilliseconds,
    maxCatchUpSteps: configuration.maxCatchUpSteps,
    interpolation: configuration.interpolation,
    sleeping: configuration.sleeping,
    solver: Object.freeze({
      velocityIterations: configuration.velocityIterations,
      positionIterations: configuration.positionIterations,
    }),
  });
}

function materializeTopology(
  draft: RenderDraft2D,
  reenableVelocities: ReadonlyMap<number, BodyVelocity2D>,
  previousBodyDefinitions: ReadonlyMap<number, BodyDefinition2D>,
): readonly PhysicsTopologyRecord2D[] {
  const collidersByBody = new Map<number, ColliderDraft2D[]>();
  for (const collider of draft.colliders.values()) {
    const entries = collidersByBody.get(collider.bodyId) ?? [];
    entries.push(collider);
    collidersByBody.set(collider.bodyId, entries);
  }
  const bodies = [...draft.bodies.values()]
    .sort((left, right) => left.id - right.id)
    .map((body): PhysicsBodyTopologyRecord2D =>
      Object.freeze({
        kind: "body",
        id: body.id,
        definition: bodyDefinition(
          body,
          collidersByBody.get(body.id) ?? [],
          reenableVelocities.get(body.id),
          previousBodyDefinitions.get(body.id),
        ),
      }),
    );
  const colliders = [...draft.colliders.values()]
    .sort((left, right) => left.id - right.id)
    .map((collider): PhysicsColliderTopologyRecord2D =>
      Object.freeze({
        kind: "collider",
        id: collider.id,
        bodyId: collider.bodyId,
        definition: Object.freeze({
          shape: collider.shape,
          material: Object.freeze({
            friction: collider.options.friction,
            restitution: collider.options.restitution,
          }),
          filter: collider.options.collisionFilter,
          tag: collider.options.tag,
          handlers: collider.options.handlers,
          owner: collider.attachment,
          flags: collider.options.sensor ? COLLIDER_SENSOR_2D : 0,
        }),
      }),
    );
  return Object.freeze([...bodies, ...colliders]);
}

function validateAutomaticMass(draft: RenderDraft2D): void {
  const massByBody = new Map<number, number>();
  for (const collider of draft.colliders.values()) {
    if (!collider.options.contributesToMass) continue;
    massByBody.set(
      collider.bodyId,
      (massByBody.get(collider.bodyId) ?? 0) +
        collider.shape.area * collider.options.density,
    );
  }
  for (const body of draft.bodies.values()) {
    if (
      body.descriptor.bodyType !== "dynamic" ||
      !body.descriptor.options.enabled ||
      body.descriptor.options.mass !== "auto"
    ) {
      continue;
    }
    if ((massByBody.get(body.id) ?? 0) <= 0) {
      throw new RangeError(
        "A dynamic body with automatic mass requires positive derived area from at least one active mass-contributing collider.",
      );
    }
  }
}

function bodyDefinition(
  body: BodyDraft2D,
  colliders: readonly ColliderDraft2D[],
  reenableVelocity?: BodyVelocity2D,
  previous?: BodyDefinition2D,
): BodyDefinition2D {
  const descriptor = body.descriptor;
  const enabled = descriptor.options.enabled;
  const massData = compoundMassData(colliders);
  let flags = 0;
  let linearVelocityX = 0;
  let linearVelocityY = 0;
  let angularVelocity = 0;
  let linearDamping = 0;
  let angularDamping = 0;
  let gravityScale = 0;
  let inverseMass = 0;
  let inverseInertia = 0;
  let localCenterX = 0;
  let localCenterY = 0;
  if (enabled && descriptor.bodyType === "dynamic") {
    flags |= BODY_TYPE_DYNAMIC_2D;
    if (descriptor.options.fixedRotation) flags |= BODY_FIXED_ROTATION_2D;
    if (!descriptor.options.allowSleep) flags |= BODY_SLEEP_DISABLED_2D;
    if (descriptor.options.ccd) flags |= BODY_CCD_2D;
    linearVelocityX =
      reenableVelocity?.linearVelocityX ?? descriptor.options.linearVelocity[0];
    linearVelocityY =
      reenableVelocity?.linearVelocityY ?? descriptor.options.linearVelocity[1];
    angularVelocity =
      reenableVelocity?.angularVelocity ??
      (descriptor.options.angularVelocityDegreesPerSecond * Math.PI) / 180;
    linearDamping = descriptor.options.linearDamping;
    angularDamping = descriptor.options.angularDamping;
    gravityScale = descriptor.options.gravityScale;
    const mass =
      descriptor.options.mass === "auto"
        ? massData.mass
        : descriptor.options.mass;
    inverseMass = mass > 0 ? 1 / mass : 1;
    localCenterX = massData.centerX;
    localCenterY = massData.centerY;
    const inertia =
      massData.mass > 0 ? massData.inertia * (mass / massData.mass) : 0;
    inverseInertia = descriptor.options.fixedRotation
      ? 0
      : inertia > 0
        ? 1 / inertia
        : inverseMass;
  } else if (enabled && descriptor.bodyType === "kinematic") {
    flags |= BODY_TYPE_KINEMATIC_2D;
    if (!descriptor.options.allowSleep) flags |= BODY_SLEEP_DISABLED_2D;
  }
  const authoredRotationRadians =
    (body.initialPose.rotationDegrees * Math.PI) / 180;
  const previousKinematic =
    previous !== undefined && (previous.flags & BODY_TYPE_KINEMATIC_2D) !== 0
      ? previous
      : undefined;
  const preserveTargetBoundKinematicPose =
    descriptor.bodyType === "kinematic" &&
    (descriptor.options.target.position !== undefined ||
      descriptor.options.target.rotationDegrees !== undefined) &&
    previousKinematic !== undefined;
  const previousRotationRadians = previousKinematic?.rotationRadians ?? 0;
  const previousCosine = Math.cos(previousRotationRadians);
  const previousSine = Math.sin(previousRotationRadians);
  const previousOriginX =
    previousKinematic === undefined
      ? 0
      : previousKinematic.positionX -
        previousCosine * (previousKinematic.localCenterX ?? 0) +
        previousSine * (previousKinematic.localCenterY ?? 0);
  const previousOriginY =
    previousKinematic === undefined
      ? 0
      : previousKinematic.positionY -
        previousSine * (previousKinematic.localCenterX ?? 0) -
        previousCosine * (previousKinematic.localCenterY ?? 0);
  const positionX = preserveTargetBoundKinematicPose
    ? previousOriginX
    : body.initialPose.position[0];
  const positionY = preserveTargetBoundKinematicPose
    ? previousOriginY
    : body.initialPose.position[1];
  const effectiveRotationRadians = preserveTargetBoundKinematicPose
    ? previousKinematic!.rotationRadians
    : authoredRotationRadians;
  const cosine = Math.cos(effectiveRotationRadians);
  const sine = Math.sin(effectiveRotationRadians);
  return Object.freeze({
    positionX: positionX + cosine * localCenterX - sine * localCenterY,
    positionY: positionY + sine * localCenterX + cosine * localCenterY,
    rotationRadians: effectiveRotationRadians,
    localCenterX,
    localCenterY,
    linearVelocityX,
    linearVelocityY,
    angularVelocity,
    forceX: 0,
    forceY: 0,
    torque: 0,
    inverseMass,
    inverseInertia,
    linearDamping,
    angularDamping,
    gravityScale,
    sleepTime: 0,
    flags,
    owner: body.attachment,
  });
}

const ZERO_VELOCITY_2D: BodyVelocity2D = Object.freeze({
  linearVelocityX: 0,
  linearVelocityY: 0,
  angularVelocity: 0,
});

function compoundMassData(colliders: readonly ColliderDraft2D[]): Readonly<{
  mass: number;
  centerX: number;
  centerY: number;
  inertia: number;
}> {
  const entries = colliders
    .filter((collider) => collider.options.contributesToMass)
    .map((collider) => {
      const shape = collider.shape;
      const cosine = Math.cos(shape.localPose.rotationRadians);
      const sine = Math.sin(shape.localPose.rotationRadians);
      const centerX =
        shape.localPose.x + cosine * shape.centroidX - sine * shape.centroidY;
      const centerY =
        shape.localPose.y + sine * shape.centroidX + cosine * shape.centroidY;
      return {
        mass: shape.area * collider.options.density,
        centerX,
        centerY,
        centroidInertia: shape.unitInertia * collider.options.density,
      };
    });
  const mass = entries.reduce((sum, entry) => sum + entry.mass, 0);
  if (mass <= 0) {
    return { mass: 0, centerX: 0, centerY: 0, inertia: 0 };
  }
  const centerX =
    entries.reduce((sum, entry) => sum + entry.mass * entry.centerX, 0) / mass;
  const centerY =
    entries.reduce((sum, entry) => sum + entry.mass * entry.centerY, 0) / mass;
  const inertia = entries.reduce((sum, entry) => {
    const offsetX = entry.centerX - centerX;
    const offsetY = entry.centerY - centerY;
    return (
      sum +
      entry.centroidInertia +
      entry.mass * (offsetX * offsetX + offsetY * offsetY)
    );
  }, 0);
  return { mass, centerX, centerY, inertia };
}

function sameConfiguration(
  left: NormalizedPhysicsWorld2DConfiguration,
  right: NormalizedPhysicsWorld2DConfiguration,
): boolean {
  return (
    left.gravityX === right.gravityX &&
    left.gravityY === right.gravityY &&
    left.fixedStepMilliseconds === right.fixedStepMilliseconds &&
    left.maxCatchUpSteps === right.maxCatchUpSteps &&
    left.interpolation === right.interpolation &&
    left.sleeping === right.sleeping &&
    left.velocityIterations === right.velocityIterations &&
    left.positionIterations === right.positionIterations
  );
}

function copyPhysicsPose2D(pose: PibblPhysicsPose2D): PibblPhysicsPose2D {
  return Object.freeze({
    position: copyFiniteVector2(pose.position, "initial physics pose.position"),
    rotationDegrees: requireFiniteNumber(
      pose.rotationDegrees,
      "initial physics pose.rotationDegrees",
    ),
  });
}

function sameTopology(
  left: readonly PhysicsTopologyRecord2D[],
  right: readonly PhysicsTopologyRecord2D[],
): boolean {
  if (left.length !== right.length) return false;
  return left.every((first, index) => {
    const second = right[index];
    if (!second || first.kind !== second.kind || first.id !== second.id)
      return false;
    if (first.kind === "body" && second.kind === "body") {
      return sameRecord(first.definition, second.definition);
    }
    if (first.kind === "collider" && second.kind === "collider") {
      return (
        first.bodyId === second.bodyId &&
        first.definition.shape === second.definition.shape &&
        first.definition.flags === second.definition.flags &&
        sameRecord(first.definition.material, second.definition.material) &&
        sameRecord(first.definition.filter, second.definition.filter)
      );
    }
    return false;
  });
}

function sameRecord(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (
    typeof left !== "object" ||
    left === null ||
    typeof right !== "object" ||
    right === null
  )
    return false;
  const leftEntries = Object.entries(left);
  const rightRecord = right as Record<string, unknown>;
  return (
    leftEntries.length === Object.keys(rightRecord).length &&
    leftEntries.every(([key, value]) => rightRecord[key] === value)
  );
}

function validateUniqueBodyHandles(bodies: readonly BodyDraft2D[]): void {
  const ids = new Map<PibblPhysicsBodyHandle2D, number>();
  for (const body of bodies) {
    const handle = body.descriptor.options.handle;
    if (handle === undefined) continue;
    const previous = ids.get(handle);
    if (previous !== undefined && previous !== body.id) {
      throw new Error(
        "A Pibbl physics 2D body handle may bind to at most one live body.",
      );
    }
    ids.set(handle, body.id);
  }
}

function eventHandlerName(
  kind: PhysicsContactEventDelivery2D["kind"],
): keyof NormalizedPhysicsColliderConfiguration2D["handlers"] {
  switch (kind) {
    case 1:
      return "onCollisionStart";
    case 2:
      return "onCollisionEnd";
    case 3:
      return "onOverlapStart";
    case 4:
      return "onOverlapEnd";
    case 7:
      return "onHit";
  }
}

const ZERO_POSE_2D: PibblPhysicsPose2D = Object.freeze({
  position: Object.freeze([0, 0] as const),
  rotationDegrees: 0,
});
