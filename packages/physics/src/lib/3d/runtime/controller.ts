import { signal, type WritableSignal } from "@crc/core";
import {
  crcInternalOnSimulationRenderTransactionFinish,
  crcInternalQueueSimulationBegin,
  crcInternalQueueSimulationCommitAcknowledgement,
  crcInternalQueueSimulationComplete,
  crcInternalRegisterSimulationAdvance,
  crcInternalRequestSimulationRender,
  type CRCInternalSignalBatch,
  type CRCInternalSimulationOwner,
} from "@crc/core/internal";
import type {
  CRCPhysicsAabb3D,
  CRCPhysicsPose3D,
  CRCPhysicsRay3D,
  CRCPhysicsShape3D,
  CRCPhysicsVector3,
} from "../../../3d-geometry.js";
import {
  isConcaveShapeRecord3D,
  type ShapeRecord3D,
} from "../shape-records.js";
import type {
  CRCPhysicsBodyHandle3D,
  CRCPhysicsColliderHandle3D,
  CRCPhysicsQueryHit3D,
  CRCPhysicsQueryMatch3D,
  CRCPhysicsQueryMode,
  CRCPhysicsQueryOptions3D,
  CRCPhysicsQueryResult3D,
  CRCPhysicsWorldHandle3D,
} from "../types.js";
import type { CRCResolvedPhysicsWorld3DProps } from "./world-props.js";
import { BODY_CCD_3D } from "../world/ccd.js";
import { BODY_SLEEP_DISABLED_3D, BODY_SLEEPING_3D } from "../world/solver.js";
import {
  BODY_ENABLED_3D,
  BODY_TYPE_DYNAMIC_3D,
  BODY_TYPE_KINEMATIC_3D,
  COLLIDER_CONTRIBUTES_TO_MASS_3D,
  COLLIDER_ENABLED_3D,
  COLLIDER_SENSOR_3D,
  type BodyDefinition3D,
} from "../world/storage.js";
import {
  copyCanonicalQuaternion,
  copyFiniteVector3,
  rotateVectorInto,
} from "../math.js";
import { deriveCompoundMassProperties3D } from "../world/integrator.js";
import {
  normalizePhysicsWorld3DConfiguration,
  PhysicsWorld3DKernel,
  type NormalizedPhysicsWorld3DConfiguration,
  type PhysicsBodyTopologyRecord3D,
  type PhysicsColliderTopologyRecord3D,
  type PhysicsCommand3D,
  type PhysicsWorld3DConfiguration,
  type PhysicsTopologyRecord3D,
  type PhysicsWorld3DCandidate,
} from "../world/world.js";
import { CommittedWorldQueries3D } from "../world/queries.js";
import {
  bindPhysicsBodyHandle3D,
  createPhysicsBodyHandle3D,
  physicsBodyHandleBinding3D,
  stagePhysicsBodyHandle3D,
  type PhysicsBodyHandleValues3D,
  unbindPhysicsBodyHandle3D,
} from "./body-handle.js";
import {
  createPhysicsColliderHandle3D,
  isPhysicsBodyEventDelivery3D,
  materializePhysicsBodyEvent3D,
  materializePhysicsContactEvent3D,
  physicsColliderHandleIdentity3D,
  sortPhysicsEventDeliveries3D,
  type PhysicsBodyEventDelivery3D,
  type PhysicsContactEventDelivery3D,
  type PhysicsEventDelivery3D,
} from "./events.js";
import {
  type MountedPhysicsAttachment3D,
  type NormalizedPhysicsColliderConfiguration3D,
  type PhysicsBodyAttachment3DDescriptor,
  type PhysicsBodyPresentationState3D,
} from "./descriptors.js";

const worldController3DSymbol = Symbol("PhysicsWorld3DController");

type InternalWorldHandle3D = CRCPhysicsWorldHandle3D &
  Readonly<{
    readonly [worldController3DSymbol]: PhysicsWorld3DController;
  }>;

interface BodyDraft3D {
  readonly id: number;
  readonly attachment: MountedPhysicsAttachment3D;
  readonly descriptor: PhysicsBodyAttachment3DDescriptor;
  readonly initialPose: CRCPhysicsPose3D;
  readonly presentationState: PhysicsBodyPresentationState3D | undefined;
}

interface ColliderDraft3D {
  readonly id: number;
  readonly bodyId: number;
  readonly attachment: MountedPhysicsAttachment3D;
  readonly options: NormalizedPhysicsColliderConfiguration3D;
  readonly shape: ShapeRecord3D;
}

interface RenderDraft3D {
  readonly configuration: NormalizedPhysicsWorld3DConfiguration;
  readonly props: CRCResolvedPhysicsWorld3DProps;
  readonly bodies: Map<number, BodyDraft3D>;
  readonly colliders: Map<number, ColliderDraft3D>;
}

interface AcceptedBody3D {
  readonly id: number;
  readonly attachment: MountedPhysicsAttachment3D;
  readonly descriptor: PhysicsBodyAttachment3DDescriptor;
  readonly initialPose: CRCPhysicsPose3D;
  readonly handleBindingGeneration: number | undefined;
}

interface AcceptedCollider3D {
  readonly id: number;
  readonly bodyId: number;
  readonly attachment: MountedPhysicsAttachment3D;
  readonly options: NormalizedPhysicsColliderConfiguration3D;
}

interface AttachmentIds3D {
  bodyId?: number;
  colliderId?: number;
}

interface BodyVelocity3D {
  readonly linearVelocityX: number;
  readonly linearVelocityY: number;
  readonly linearVelocityZ: number;
  readonly angularVelocityX: number;
  readonly angularVelocityY: number;
  readonly angularVelocityZ: number;
}

type PhysicsBodyCommand3D = Extract<
  PhysicsCommand3D,
  { readonly bodyId: number }
>;

export interface PhysicsWorld3DControllerSnapshot {
  readonly revision: number;
  readonly revisionMaterialized: boolean;
  readonly materializedBodyHandles: number;
  readonly materializedColliderHandles: number;
  readonly advanceRegistered: boolean;
  readonly beginCommandQueued: boolean;
  readonly liveCandidate: boolean;
  readonly bodyIds: readonly number[];
  readonly colliderIds: readonly number[];
  readonly shapeBakeCount: number;
  readonly massPropertyDerivations: number;
  readonly contactPairs: readonly Readonly<{
    firstColliderId: number;
    firstColliderGeneration: number;
    secondColliderId: number;
    secondColliderGeneration: number;
  }>[];
  readonly kernel: ReturnType<PhysicsWorld3DKernel["snapshot"]>;
}

interface CompoundMassCache3D {
  readonly mode: "dynamic" | "static";
  readonly colliders: readonly ReturnType<typeof compoundMassInput>[];
  readonly properties: ReturnType<typeof deriveCompoundMassProperties3D>;
}

export class PhysicsWorld3DController {
  readonly handle: CRCPhysicsWorldHandle3D;
  private revision: WritableSignal<number> | undefined;
  private committedRevision = 0;
  private readonly kernel: PhysicsWorld3DKernel;
  private readonly ids = new WeakMap<object, AttachmentIds3D>();
  private nextId = 0;
  private draft: RenderDraft3D | undefined;
  private acceptedTopology: readonly PhysicsTopologyRecord3D[] = Object.freeze(
    [],
  );
  private acceptedBodies: readonly AcceptedBody3D[] = Object.freeze([]);
  private acceptedColliders: readonly AcceptedCollider3D[] = Object.freeze([]);
  private acceptedConfiguration: NormalizedPhysicsWorld3DConfiguration;
  private acceptedProps: CRCResolvedPhysicsWorld3DProps = Object.freeze({});
  private readonly suspendedVelocities = new Map<number, BodyVelocity3D>();
  private readonly compoundMassCache = new Map<number, CompoundMassCache3D>();
  private massPropertyDerivations = 0;
  private readonly materializedBodyHandles = new Map<
    string,
    CRCPhysicsBodyHandle3D
  >();
  private readonly materializedColliderHandles = new Map<
    string,
    CRCPhysicsColliderHandle3D
  >();
  private readonly queries: CommittedWorldQueries3D;
  private queuedBegin: Readonly<{ cancel(): void }> | undefined;
  private releaseAdvance: (() => void) | undefined;
  private liveCandidate: PhysicsWorld3DCandidate | undefined;
  private active = true;

  constructor(
    private readonly owner: CRCInternalSimulationOwner,
    initialProps: CRCResolvedPhysicsWorld3DProps,
  ) {
    const configuration = normalizeWorldConfiguration(initialProps);
    this.kernel = new PhysicsWorld3DKernel(
      denormalizeWorldConfiguration(configuration),
    );
    this.queries = new CommittedWorldQueries3D({
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
      assertReadable: () => this.kernel.assertCommittedReadable(),
    });
    this.acceptedConfiguration = configuration;
    const target = {
      [worldController3DSymbol]: this,
    } as Record<PropertyKey, unknown>;
    Object.defineProperty(target, "revision", {
      enumerable: true,
      get: () => this.materializeRevision().asReadonly(),
    });
    this.handle = Object.freeze(target) as unknown as InternalWorldHandle3D;
  }

  beginRender(props: CRCResolvedPhysicsWorld3DProps): void {
    this.assertActive();
    const hasPendingDraft = this.draft !== undefined;
    this.draft = {
      configuration: normalizeWorldConfiguration(props),
      props,
      bodies: new Map(),
      colliders: new Map(),
    };
    if (!hasPendingDraft) {
      crcInternalOnSimulationRenderTransactionFinish(this.owner, (success) =>
        this.finishRender(success),
      );
    }
  }

  bodyIdFor(attachment: MountedPhysicsAttachment3D): number {
    let ids = this.ids.get(attachment);
    if (!ids) {
      ids = {};
      this.ids.set(attachment, ids);
    }
    return (ids.bodyId ??= this.allocateId());
  }

  colliderIdFor(attachment: MountedPhysicsAttachment3D): number {
    let ids = this.ids.get(attachment);
    if (!ids) {
      ids = {};
      this.ids.set(attachment, ids);
    }
    return (ids.colliderId ??= this.allocateId());
  }

  collectBody(
    attachment: MountedPhysicsAttachment3D,
    bodyId: number,
    descriptor: PhysicsBodyAttachment3DDescriptor,
    initialPose: CRCPhysicsPose3D = ZERO_POSE_3D,
    presentationState?: PhysicsBodyPresentationState3D,
  ): void {
    const draft = this.requireDraft();
    draft.bodies.set(bodyId, {
      id: bodyId,
      attachment,
      descriptor,
      initialPose: copyPhysicsPose3D(initialPose),
      presentationState,
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
    attachment: MountedPhysicsAttachment3D,
    bodyId: number,
    options: NormalizedPhysicsColliderConfiguration3D,
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

  queueCommands(commands: readonly PhysicsCommand3D[]): void {
    this.assertActive();
    if (commands.length === 0) return;
    crcInternalQueueSimulationBegin(this.owner, () => {
      this.kernel.applyBegin(commands);
    });
    this.ensureAdvance();
  }

  acceptBodyHandleCommand(
    handle: CRCPhysicsBodyHandle3D,
    bindingGeneration: number,
    command: PhysicsBodyCommand3D,
  ): boolean {
    if (!this.active) return false;
    const binding = physicsBodyHandleBinding3D(handle);
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

  presentationPose(bodyId: number): CRCPhysicsPose3D | undefined {
    return this.kernel.snapshot().bodies.some((body) => body.id === bodyId)
      ? this.kernel.presentationPose(bodyId)
      : undefined;
  }

  raycast<Mode extends CRCPhysicsQueryMode = "closest">(
    ray: CRCPhysicsRay3D,
    options?: CRCPhysicsQueryOptions3D<Mode>,
  ): CRCPhysicsQueryResult3D<Mode, CRCPhysicsQueryHit3D> {
    this.assertActive();
    return this.queries.raycast(1, ray, options);
  }

  shapeCast<Mode extends CRCPhysicsQueryMode = "closest">(
    shape: CRCPhysicsShape3D,
    from: CRCPhysicsPose3D,
    translation: CRCPhysicsVector3,
    options?: CRCPhysicsQueryOptions3D<Mode>,
  ): CRCPhysicsQueryResult3D<Mode, CRCPhysicsQueryHit3D> {
    this.assertActive();
    return this.queries.shapeCast(1, shape, from, translation, options);
  }

  overlapShape<Mode extends CRCPhysicsQueryMode = "closest">(
    shape: CRCPhysicsShape3D,
    pose: CRCPhysicsPose3D,
    options?: CRCPhysicsQueryOptions3D<Mode>,
  ): CRCPhysicsQueryResult3D<Mode, CRCPhysicsQueryMatch3D> {
    this.assertActive();
    return this.queries.overlapShape(1, shape, pose, options);
  }

  queryAabb<Mode extends CRCPhysicsQueryMode = "closest">(
    bounds: CRCPhysicsAabb3D,
    options?: CRCPhysicsQueryOptions3D<Mode>,
  ): CRCPhysicsQueryResult3D<Mode, CRCPhysicsQueryMatch3D> {
    this.assertActive();
    return this.queries.queryAabb(1, bounds, options);
  }

  queryPoint<Mode extends CRCPhysicsQueryMode = "closest">(
    point: CRCPhysicsVector3,
    options?: CRCPhysicsQueryOptions3D<Mode>,
  ): CRCPhysicsQueryResult3D<Mode, CRCPhysicsQueryMatch3D> {
    this.assertActive();
    return this.queries.queryPoint(1, point, options);
  }

  bodyHandleValues(bodyId: number): PhysicsBodyHandleValues3D | undefined {
    if (!this.active) return undefined;
    const state = this.kernel
      .snapshot()
      .bodies.find((candidate) => candidate.id === bodyId);
    if (state === undefined) return undefined;
    const pose = this.kernel.authoritativePose(bodyId);
    return Object.freeze({
      position: pose.position,
      orientation: pose.orientation,
      linearVelocity: Object.freeze([
        state.linearVelocityX,
        state.linearVelocityY,
        state.linearVelocityZ,
      ] as const),
      angularVelocityDegreesPerSecond: Object.freeze([
        (state.angularVelocityX * 180) / Math.PI,
        (state.angularVelocityY * 180) / Math.PI,
        (state.angularVelocityZ * 180) / Math.PI,
      ] as const),
      sleeping: (state.flags & BODY_SLEEPING_3D) !== 0,
      enabled: this.kernel.isBodyEnabled(bodyId),
      generation: state.generation,
    });
  }

  dispose(): void {
    if (!this.active) return;
    this.active = false;
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
      const binding = physicsBodyHandleBinding3D(handle);
      if (binding?.controller === this) {
        unbindPhysicsBodyHandle3D(
          handle,
          this,
          binding.bodyId,
          binding.bindingGeneration,
        );
      }
    }
    this.kernel.dispose();
    this.queries.invalidate();
    this.materializedBodyHandles.clear();
    this.materializedColliderHandles.clear();
    this.acceptedTopology = Object.freeze([]);
    this.acceptedBodies = Object.freeze([]);
    this.acceptedColliders = Object.freeze([]);
    this.acceptedProps = Object.freeze({});
    this.draft = undefined;
    this.suspendedVelocities.clear();
    this.compoundMassCache.clear();
  }

  snapshot(): PhysicsWorld3DControllerSnapshot {
    const attachments = new Set<MountedPhysicsAttachment3D>();
    for (const body of this.acceptedBodies) attachments.add(body.attachment);
    for (const collider of this.acceptedColliders) {
      attachments.add(collider.attachment);
    }
    return Object.freeze({
      revision: this.committedRevision,
      revisionMaterialized: this.revision !== undefined,
      materializedBodyHandles: this.materializedBodyHandles.size,
      materializedColliderHandles: this.materializedColliderHandles.size,
      advanceRegistered: this.releaseAdvance !== undefined,
      beginCommandQueued: this.queuedBegin !== undefined,
      liveCandidate: this.liveCandidate !== undefined,
      bodyIds: Object.freeze(
        this.acceptedTopology
          .filter(
            (record): record is PhysicsBodyTopologyRecord3D =>
              record.kind === "body",
          )
          .map((record) => record.id),
      ),
      colliderIds: Object.freeze(
        this.acceptedTopology
          .filter(
            (record): record is PhysicsColliderTopologyRecord3D =>
              record.kind === "collider",
          )
          .map((record) => record.id),
      ),
      shapeBakeCount: [...attachments].reduce(
        (total, attachment) => total + attachment.shapeBakeCountForTest(),
        0,
      ),
      massPropertyDerivations: this.massPropertyDerivations,
      contactPairs: Object.freeze(
        Array.from(
          { length: this.kernel.contacts.contactCount },
          (_, contact) =>
            Object.freeze({
              firstColliderId: this.kernel.colliderIdForIdentity(
                this.kernel.contacts.firstColliderIndices[contact]!,
                this.kernel.contacts.firstColliderGenerations[contact]!,
              )!,
              firstColliderGeneration:
                this.kernel.contacts.firstColliderGenerations[contact]!,
              secondColliderId: this.kernel.colliderIdForIdentity(
                this.kernel.contacts.secondColliderIndices[contact]!,
                this.kernel.contacts.secondColliderGenerations[contact]!,
              )!,
              secondColliderGeneration:
                this.kernel.contacts.secondColliderGenerations[contact]!,
            }),
        ),
      ),
      kernel: this.kernel.snapshot(),
    });
  }

  private finishRender(success: boolean): void {
    const draft = this.draft;
    this.draft = undefined;
    if (!success || draft === undefined || !this.active) return;
    validateMovingConcave(draft);
    const massProperties = this.resolveCompoundMassProperties(draft);
    const reenableVelocities = this.resolveReenableVelocities(draft);
    const previousBodyDefinitions = new Map(
      this.acceptedTopology
        .filter(
          (record): record is PhysicsBodyTopologyRecord3D =>
            record.kind === "body",
        )
        .map((record) => [record.id, record.definition] as const),
    );
    const committedBodyIds = new Set(
      this.kernel.snapshot().bodies.map((body) => body.id),
    );
    const committedKinematicPoses = new Map<number, CRCPhysicsPose3D>();
    for (const body of draft.bodies.values()) {
      if (
        body.descriptor.bodyType === "kinematic" &&
        committedBodyIds.has(body.id)
      ) {
        const committed = this.kernel.authoritativePose(body.id);
        const target = body.descriptor.options.target;
        const hasPartialTarget =
          target.position !== undefined || target.orientation !== undefined;
        committedKinematicPoses.set(
          body.id,
          hasPartialTarget ? committed : body.initialPose,
        );
      }
    }
    const topology = materializeTopology(
      draft,
      reenableVelocities,
      previousBodyDefinitions,
      committedKinematicPoses,
      massProperties,
    );
    const topologyChanged = !sameTopology(this.acceptedTopology, topology);
    const configurationChanged = !sameConfiguration(
      this.acceptedConfiguration,
      draft.configuration,
    );
    const nextBodies = [...draft.bodies.values()].sort(
      (left, right) => left.id - right.id,
    );
    const removedTargetCommands = commandsForRemovedKinematicTargets(
      this.acceptedBodies,
      nextBodies,
    );
    const changedKinematicTarget = hasChangedKinematicTarget(
      this.acceptedBodies,
      nextBodies,
    );
    validateBodyHandleBindingTransition(this, this.acceptedBodies, nextBodies);
    for (const body of this.acceptedBodies) {
      const retained = nextBodies.some(
        (next) =>
          next.id === body.id &&
          next.descriptor.options.handle === body.descriptor.options.handle,
      );
      if (!retained) this.unbindBodyHandle(body);
    }
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
              : bindPhysicsBodyHandle3D(descriptor.options.handle, this, id),
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
    if (
      !topologyChanged &&
      !configurationChanged &&
      removedTargetCommands.length === 0
    ) {
      if (changedKinematicTarget) this.ensureAdvance();
      this.adoptBodyPresentationStates(nextBodies);
      return;
    }
    this.acceptedTopology = topology;
    this.acceptedConfiguration = draft.configuration;
    this.queuedBegin?.cancel();
    this.queuedBegin = crcInternalQueueSimulationBegin(this.owner, () => {
      this.queuedBegin = undefined;
      if (topologyChanged) this.kernel.proposeTopology(topology);
      if (configurationChanged) {
        this.kernel.applyBegin([
          {
            kind: "configure",
            configuration: denormalizeWorldConfiguration(draft.configuration),
          },
        ]);
      }
      if (removedTargetCommands.length > 0) {
        this.kernel.applyBegin(removedTargetCommands);
      }
    });
    this.ensureAdvance();
    this.adoptBodyPresentationStates(nextBodies);
  }

  private resolveCompoundMassProperties(
    draft: RenderDraft3D,
  ): ReadonlyMap<number, ReturnType<typeof deriveCompoundMassProperties3D>> {
    const resolved = new Map<
      number,
      ReturnType<typeof deriveCompoundMassProperties3D>
    >();
    const retained = new Set<number>();
    for (const body of draft.bodies.values()) {
      if (
        body.descriptor.bodyType !== "dynamic" ||
        !body.descriptor.options.enabled
      ) {
        continue;
      }
      retained.add(body.id);
      const colliders = [...draft.colliders.values()]
        .filter((collider) => collider.bodyId === body.id)
        .sort((left, right) => left.id - right.id)
        .map(compoundMassInput);
      const mode =
        body.descriptor.options.mass === "auto" ||
        colliders.some((collider) => collider.contributesToMass)
          ? "dynamic"
          : "static";
      const cached = this.compoundMassCache.get(body.id);
      const properties =
        cached !== undefined &&
        cached.mode === mode &&
        sameMassInputs(cached.colliders, colliders)
          ? cached.properties
          : deriveCompoundMassProperties3D(colliders, mode);
      if (properties !== cached?.properties) {
        this.massPropertyDerivations += 1;
        this.compoundMassCache.set(
          body.id,
          Object.freeze({
            mode,
            colliders: Object.freeze(colliders),
            properties,
          }),
        );
      }
      resolved.set(body.id, properties);
    }
    for (const bodyId of this.compoundMassCache.keys()) {
      if (!retained.has(bodyId)) this.compoundMassCache.delete(bodyId);
    }
    return resolved;
  }

  private adoptBodyPresentationStates(bodies: readonly BodyDraft3D[]): void {
    for (const body of bodies) {
      if (body.presentationState !== undefined) {
        body.attachment.adoptBodyPresentationState(body.presentationState);
      }
    }
  }

  private ensureAdvance(): void {
    if (this.releaseAdvance !== undefined) return;
    this.releaseAdvance = crcInternalRegisterSimulationAdvance(
      this.owner,
      "physics",
      (frame, batch) => this.advance(frame.frameId, frame.logicalTime, batch),
    );
  }

  private resolveReenableVelocities(
    draft: RenderDraft3D,
  ): ReadonlyMap<number, BodyVelocity3D> {
    const previousById = new Map(
      this.acceptedBodies.map((body) => [body.id, body]),
    );
    const kernelById = new Map(
      this.kernel.snapshot().bodies.map((body) => [body.id, body]),
    );
    const overrides = new Map<number, BodyVelocity3D>();
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
        const state = kernelById.get(body.id);
        if (state !== undefined) {
          this.suspendedVelocities.set(
            body.id,
            Object.freeze({
              linearVelocityX: state.linearVelocityX,
              linearVelocityY: state.linearVelocityY,
              linearVelocityZ: state.linearVelocityZ,
              angularVelocityX: state.angularVelocityX,
              angularVelocityY: state.angularVelocityY,
              angularVelocityZ: state.angularVelocityZ,
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
            : ZERO_VELOCITY_3D,
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
    batch: CRCInternalSignalBatch,
  ): void {
    let candidate: PhysicsWorld3DCandidate | undefined;
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
        crcInternalQueueSimulationComplete(this.owner, () => {
          if (adopted) this.deliverEvents(events);
        });
      }
      crcInternalQueueSimulationCommitAcknowledgement(
        this.owner,
        (_frame, outcome) => {
          if (this.liveCandidate !== candidate) return;
          this.liveCandidate = undefined;
          if (!outcome.applied) {
            this.kernel.discard(candidate!);
            return;
          }
          this.kernel.adopt(candidate!);
          this.committedRevision = nextRevision;
          adopted = true;
          crcInternalRequestSimulationRender(this.owner);
          if (
            !candidate!.advanceEligible &&
            !hasEnabledKinematicBinding(this.acceptedBodies)
          ) {
            this.releaseAdvance?.();
            this.releaseAdvance = undefined;
          }
        },
      );
    } catch (error) {
      if (candidate?.lifecycle === "live") this.kernel.discard(candidate);
      if (this.liveCandidate === candidate) this.liveCandidate = undefined;
      const onError = this.acceptedProps.onError;
      if (onError) {
        crcInternalQueueSimulationComplete(this.owner, () => onError(error));
      }
      throw error;
    }
  }

  private readKinematicTargets(
    batch: CRCInternalSignalBatch,
  ): ReadonlyMap<number, CRCPhysicsPose3D> {
    const targets = new Map<number, CRCPhysicsPose3D>();
    for (const body of this.acceptedBodies) {
      if (
        body.descriptor.bodyType !== "kinematic" ||
        !body.descriptor.options.enabled
      )
        continue;
      const target = body.descriptor.options.target;
      if (target.position === undefined && target.orientation === undefined) {
        continue;
      }
      const committed =
        this.kernel.bodyIdentity(body.id) === undefined
          ? body.initialPose
          : this.kernel.authoritativePose(body.id);
      const position =
        target.position === undefined
          ? committed.position
          : batch.read(target.position as WritableSignal<CRCPhysicsVector3>);
      const orientation =
        target.orientation === undefined
          ? committed.orientation
          : batch.read(
              target.orientation as WritableSignal<
                readonly [number, number, number, number]
              >,
            );
      targets.set(
        body.id,
        Object.freeze({
          position: freezeVector3(position),
          orientation: freezeQuaternion(
            copyCanonicalQuaternion(
              orientation,
              "kinematic target orientation",
            ),
          ),
        }),
      );
    }
    return targets;
  }

  private stagePublicSignals(
    batch: CRCInternalSignalBatch,
    nextRevision: number,
  ): void {
    if (this.revision !== undefined) {
      batch.stage(this.revision, nextRevision, this);
    }
    const snapshot = this.kernel.snapshot();
    const acceptedById = new Map(
      this.acceptedBodies.map((body) => [body.id, body] as const),
    );
    for (const state of snapshot.bodies) {
      const explicit = acceptedById.get(state.id)?.descriptor.options.handle;
      const materialized = this.materializedBodyHandles.get(
        `${String(state.index)}:${String(state.generation)}`,
      );
      const pose = this.kernel.authoritativePose(state.id);
      const values = {
        position: pose.position,
        orientation: pose.orientation,
        linearVelocity: Object.freeze([
          state.linearVelocityX,
          state.linearVelocityY,
          state.linearVelocityZ,
        ] as const),
        angularVelocityDegreesPerSecond: Object.freeze([
          (state.angularVelocityX * 180) / Math.PI,
          (state.angularVelocityY * 180) / Math.PI,
          (state.angularVelocityZ * 180) / Math.PI,
        ] as const),
        sleeping: (state.flags & BODY_SLEEPING_3D) !== 0,
        enabled: this.kernel.isBodyEnabled(state.id),
        generation: state.generation,
      } as const;
      if (explicit !== undefined) {
        stagePhysicsBodyHandle3D(batch, explicit, values, this);
      }
      if (materialized !== undefined && materialized !== explicit) {
        stagePhysicsBodyHandle3D(batch, materialized, values, this);
      }
    }
  }

  private copyEventDeliveries(
    candidate: PhysicsWorld3DCandidate,
  ): readonly PhysicsEventDelivery3D[] {
    const events: PhysicsEventDelivery3D[] = [];
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
          }) satisfies PhysicsBodyEventDelivery3D,
        );
        continue;
      }
      if (kind !== 1 && kind !== 2 && kind !== 3 && kind !== 4 && kind !== 7) {
        continue;
      }
      this.copyContactEventDeliveries(candidate, eventIndex, kind, events);
    }
    return sortPhysicsEventDeliveries3D(events);
  }

  private copyContactEventDeliveries(
    candidate: PhysicsWorld3DCandidate,
    eventIndex: number,
    kind: PhysicsContactEventDelivery3D["kind"],
    events: PhysicsEventDelivery3D[],
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
    const points: Array<PhysicsContactEventDelivery3D["points"][number]> = [];
    const pointBase = eventIndex * 4;
    for (
      let point = 0;
      point < candidate.eventPointCounts[eventIndex]!;
      point += 1
    ) {
      points.push(
        Object.freeze({
          firstX: candidate.eventPointFirstX[pointBase + point]!,
          firstY: candidate.eventPointFirstY[pointBase + point]!,
          firstZ: candidate.eventPointFirstZ[pointBase + point]!,
          secondX: candidate.eventPointSecondX[pointBase + point]!,
          secondY: candidate.eventPointSecondY[pointBase + point]!,
          secondZ: candidate.eventPointSecondZ[pointBase + point]!,
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
      normalZ: candidate.eventNormalZ[eventIndex]!,
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
        }) as PhysicsContactEventDelivery3D,
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
        }) as PhysicsContactEventDelivery3D,
      );
    }
  }

  private deliverEvents(events: readonly PhysicsEventDelivery3D[]): void {
    if (!this.active) return;
    const errors: unknown[] = [];
    for (const fact of events) {
      try {
        if (isPhysicsBodyEventDelivery3D(fact)) {
          if (!this.isBodyEventLive(fact)) continue;
          fact.handler(
            materializePhysicsBodyEvent3D(
              fact,
              this.materializeBodyHandle(fact.bodyIndex, fact.bodyGeneration),
            ),
          );
          continue;
        }
        if (!this.isContactEventLive(fact)) continue;
        fact.handler(
          materializePhysicsContactEvent3D(fact, {
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
        "Multiple physics 3D event callbacks failed.",
      );
    }
  }

  private isBodyEventLive(fact: PhysicsBodyEventDelivery3D): boolean {
    const handler =
      fact.kind === 6 ? this.acceptedProps.onSleep : this.acceptedProps.onWake;
    const identity = this.kernel.bodyIdentity(fact.bodyId);
    return (
      handler === fact.handler &&
      identity?.index === fact.bodyIndex &&
      identity.generation === fact.bodyGeneration
    );
  }

  private isContactEventLive(fact: PhysicsContactEventDelivery3D): boolean {
    const receiver = this.acceptedColliders.find(
      (collider) => collider.id === fact.receiverColliderId,
    );
    if (receiver === undefined || receiver.bodyId !== fact.receiverBodyId)
      return false;
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
    return (
      handler === fact.handler &&
      colliderIdentity?.index === expectedIndex &&
      colliderIdentity.generation === expectedGeneration
    );
  }

  private acceptedColliderForIdentity(
    index: number,
    generation: number,
  ): AcceptedCollider3D | undefined {
    return this.acceptedColliders.find((collider) => {
      const identity = this.kernel.colliderIdentity(collider.id);
      return identity?.index === index && identity.generation === generation;
    });
  }

  private requireDraft(): RenderDraft3D {
    const draft = this.draft;
    if (draft === undefined) {
      throw new Error(
        "A physics attachment requires an active PhysicsWorld3D render draft.",
      );
    }
    return draft;
  }

  private allocateId(): number {
    if (this.nextId === Number.MAX_SAFE_INTEGER) {
      throw new Error("PhysicsWorld3D exhausted stable attachment identities.");
    }
    return this.nextId++;
  }

  private assertActive(): void {
    if (!this.active) {
      throw new TypeError("Expected a live CRC physics 3D world handle.");
    }
  }

  private materializeRevision(): WritableSignal<number> {
    return (this.revision ??= signal(this.committedRevision, {
      debugName: "PhysicsWorld3D.revision",
    }));
  }

  private materializeBodyHandle(
    index: number,
    generation: number,
  ): CRCPhysicsBodyHandle3D {
    const bodyId = this.kernel.bodyIdForIdentity(index, generation);
    if (bodyId === undefined) {
      throw new Error(
        "Cannot materialize a stale physics 3D body query result.",
      );
    }
    const accepted = this.acceptedBodies.find((body) => body.id === bodyId);
    const explicit = accepted?.descriptor.options.handle;
    if (explicit !== undefined) return explicit;
    const key = `${String(index)}:${String(generation)}`;
    let handle = this.materializedBodyHandles.get(key);
    if (handle === undefined) {
      handle = createPhysicsBodyHandle3D(this.owner);
      bindPhysicsBodyHandle3D(handle, this, bodyId);
      this.materializedBodyHandles.set(key, handle);
    }
    return handle;
  }

  private materializeColliderHandle(
    index: number,
    generation: number,
  ): CRCPhysicsColliderHandle3D {
    if (this.kernel.colliderIdForIdentity(index, generation) === undefined) {
      throw new Error(
        "Cannot materialize a stale physics 3D collider query result.",
      );
    }
    const key = `${String(index)}:${String(generation)}`;
    let handle = this.materializedColliderHandles.get(key);
    if (handle === undefined) {
      handle = createPhysicsColliderHandle3D(this, index, generation);
      this.materializedColliderHandles.set(key, handle);
    }
    return handle;
  }

  private resolveBodyHandle(
    handle: CRCPhysicsBodyHandle3D,
  ): Readonly<{ index: number; generation: number }> | null {
    const binding = physicsBodyHandleBinding3D(handle);
    if (binding?.controller !== this) return null;
    return this.kernel.bodyIdentity(binding.bodyId) ?? null;
  }

  private resolveColliderHandle(
    handle: CRCPhysicsColliderHandle3D,
  ): Readonly<{ index: number; generation: number }> | null {
    const identity = physicsColliderHandleIdentity3D(handle);
    if (identity?.controller !== this) return null;
    return this.kernel.colliderIdForIdentity(
      identity.index,
      identity.generation,
    ) === undefined
      ? null
      : identity;
  }

  private unbindBodyHandle(body: AcceptedBody3D): void {
    const handle = body.descriptor.options.handle;
    const generation = body.handleBindingGeneration;
    if (handle !== undefined && generation !== undefined) {
      unbindPhysicsBodyHandle3D(handle, this, body.id, generation);
    }
  }
}

function validateMovingConcave(draft: RenderDraft3D): void {
  for (const body of draft.bodies.values()) {
    if (body.descriptor.bodyType === "static") continue;
    const concave = [...draft.colliders.values()].find(
      (collider) =>
        collider.bodyId === body.id && isConcaveShapeRecord3D(collider.shape),
    );
    if (concave !== undefined) {
      throw new Error(
        "triangle mesh and heightfield colliders require a static body.",
      );
    }
  }
}

export function requirePhysicsWorld3DController(
  handle: CRCPhysicsWorldHandle3D,
): PhysicsWorld3DController {
  const controller = (handle as Partial<InternalWorldHandle3D>)[
    worldController3DSymbol
  ];
  if (!(controller instanceof PhysicsWorld3DController)) {
    throw new TypeError("Expected a live CRC physics 3D world handle.");
  }
  return controller;
}

export function snapshotPhysicsWorld3DControllerForTest(
  controller: PhysicsWorld3DController,
): PhysicsWorld3DControllerSnapshot {
  return controller.snapshot();
}

/** Package-private ownership evidence retained across controller disposal. */
export function ownershipCountersPhysicsWorld3DControllerForTest(
  controller: PhysicsWorld3DController,
): PhysicsWorld3DKernel["counters"] {
  return (
    controller as unknown as {
      readonly kernel: PhysicsWorld3DKernel;
    }
  ).kernel.counters;
}

/** Package-private lifecycle evidence that remains readable after disposal. */
export function snapshotPhysicsWorld3DControllerOwnershipForTest(
  controller: PhysicsWorld3DController,
): Readonly<{
  readonly active: boolean;
  readonly advanceRegistered: boolean;
  readonly beginCommandQueued: boolean;
  readonly liveCandidate: boolean;
  readonly materializedBodyHandles: number;
  readonly materializedColliderHandles: number;
}> {
  const state = controller as unknown as {
    readonly active: boolean;
    readonly releaseAdvance: (() => void) | undefined;
    readonly queuedBegin: Readonly<{ cancel(): void }> | undefined;
    readonly liveCandidate: PhysicsWorld3DCandidate | undefined;
    readonly materializedBodyHandles: ReadonlyMap<string, unknown>;
    readonly materializedColliderHandles: ReadonlyMap<string, unknown>;
  };
  return Object.freeze({
    active: state.active,
    advanceRegistered: state.releaseAdvance !== undefined,
    beginCommandQueued: state.queuedBegin !== undefined,
    liveCandidate: state.liveCandidate !== undefined,
    materializedBodyHandles: state.materializedBodyHandles.size,
    materializedColliderHandles: state.materializedColliderHandles.size,
  });
}

function normalizeWorldConfiguration(
  props: CRCResolvedPhysicsWorld3DProps,
): NormalizedPhysicsWorld3DConfiguration {
  return normalizePhysicsWorld3DConfiguration({
    gravity: props.gravity,
    fixedStepMilliseconds: props.fixedStepMilliseconds,
    maxCatchUpSteps: props.maxCatchUpSteps,
    interpolation: props.interpolation,
    sleeping: props.sleeping,
    solver: props.solver,
  });
}

function denormalizeWorldConfiguration(
  configuration: NormalizedPhysicsWorld3DConfiguration,
): PhysicsWorld3DConfiguration {
  return Object.freeze({
    gravity: Object.freeze([
      configuration.gravityX,
      configuration.gravityY,
      configuration.gravityZ,
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
  draft: RenderDraft3D,
  reenableVelocities: ReadonlyMap<number, BodyVelocity3D>,
  previousBodyDefinitions: ReadonlyMap<number, BodyDefinition3D>,
  committedKinematicPoses: ReadonlyMap<number, CRCPhysicsPose3D>,
  massProperties: ReadonlyMap<
    number,
    ReturnType<typeof deriveCompoundMassProperties3D>
  >,
): readonly PhysicsTopologyRecord3D[] {
  const collidersByBody = new Map<number, ColliderDraft3D[]>();
  for (const collider of draft.colliders.values()) {
    const entries = collidersByBody.get(collider.bodyId) ?? [];
    entries.push(collider);
    collidersByBody.set(collider.bodyId, entries);
  }
  const bodies = [...draft.bodies.values()]
    .sort((left, right) => left.id - right.id)
    .map((body): PhysicsBodyTopologyRecord3D =>
      Object.freeze({
        kind: "body",
        id: body.id,
        definition: bodyDefinition(
          body,
          collidersByBody.get(body.id) ?? [],
          reenableVelocities.get(body.id),
          previousBodyDefinitions.get(body.id),
          committedKinematicPoses.get(body.id),
          massProperties.get(body.id),
        ),
      }),
    );
  const colliders = [...draft.colliders.values()]
    .sort((left, right) => left.id - right.id)
    .map((collider): PhysicsColliderTopologyRecord3D =>
      Object.freeze({
        kind: "collider",
        id: collider.id,
        bodyId: collider.bodyId,
        definition: Object.freeze({
          shape: collider.shape,
          localPositionX: 0,
          localPositionY: 0,
          localPositionZ: 0,
          localOrientationX: 0,
          localOrientationY: 0,
          localOrientationZ: 0,
          localOrientationW: 1,
          density: collider.options.density,
          friction: collider.options.friction,
          restitution: collider.options.restitution,
          collisionCategory: collider.options.collisionFilter.category,
          collisionMask: collider.options.collisionFilter.mask,
          collisionGroup: collider.options.collisionFilter.group,
          tag: collider.options.tag,
          handlers: collider.options.handlers,
          owner: collider.attachment,
          flags:
            COLLIDER_ENABLED_3D |
            (collider.options.sensor ? COLLIDER_SENSOR_3D : 0) |
            (collider.options.contributesToMass
              ? COLLIDER_CONTRIBUTES_TO_MASS_3D
              : 0),
        }),
      }),
    );
  return Object.freeze([...bodies, ...colliders]);
}

function bodyDefinition(
  body: BodyDraft3D,
  colliders: readonly ColliderDraft3D[],
  reenableVelocity?: BodyVelocity3D,
  previous?: BodyDefinition3D,
  committedKinematicPose?: CRCPhysicsPose3D,
  resolvedMassProperties?: ReturnType<typeof deriveCompoundMassProperties3D>,
): BodyDefinition3D {
  const descriptor = body.descriptor;
  const enabled = descriptor.options.enabled;
  let flags = enabled ? BODY_ENABLED_3D : 0;
  let linearVelocityX = 0;
  let linearVelocityY = 0;
  let linearVelocityZ = 0;
  let angularVelocityX = 0;
  let angularVelocityY = 0;
  let angularVelocityZ = 0;
  let linearDamping = 0;
  let angularDamping = 0;
  let gravityScale = 0;
  let inverseMass = 0;
  let inverseInertiaXX = 0;
  let inverseInertiaYY = 0;
  let inverseInertiaZZ = 0;
  let inverseInertiaXY = 0;
  let inverseInertiaXZ = 0;
  let inverseInertiaYZ = 0;
  let localCenter = ZERO_VECTOR_3D;
  let translationLocks = 0;
  let rotationLocks = 0;
  if (enabled && descriptor.bodyType === "dynamic") {
    flags |= BODY_TYPE_DYNAMIC_3D;
    if (!descriptor.options.allowSleep) flags |= BODY_SLEEP_DISABLED_3D;
    if (descriptor.options.ccd) flags |= BODY_CCD_3D;
    linearVelocityX =
      reenableVelocity?.linearVelocityX ?? descriptor.options.linearVelocity[0];
    linearVelocityY =
      reenableVelocity?.linearVelocityY ?? descriptor.options.linearVelocity[1];
    linearVelocityZ =
      reenableVelocity?.linearVelocityZ ?? descriptor.options.linearVelocity[2];
    angularVelocityX =
      reenableVelocity?.angularVelocityX ??
      degreesToRadians(descriptor.options.angularVelocityDegreesPerSecond[0]);
    angularVelocityY =
      reenableVelocity?.angularVelocityY ??
      degreesToRadians(descriptor.options.angularVelocityDegreesPerSecond[1]);
    angularVelocityZ =
      reenableVelocity?.angularVelocityZ ??
      degreesToRadians(descriptor.options.angularVelocityDegreesPerSecond[2]);
    linearDamping = descriptor.options.linearDamping;
    angularDamping = descriptor.options.angularDamping;
    gravityScale = descriptor.options.gravityScale;
    const contributingColliders = colliders.filter(
      (collider) => collider.options.contributesToMass,
    );
    const derived =
      resolvedMassProperties ??
      deriveCompoundMassProperties3D(
        colliders.map(compoundMassInput),
        contributingColliders.length > 0 ? "dynamic" : "static",
      );
    const mass =
      descriptor.options.mass === "auto"
        ? derived.mass
        : descriptor.options.mass;
    inverseMass = 1 / mass;
    localCenter = freezeVector3([
      derived.centerX,
      derived.centerY,
      derived.centerZ,
    ]);
    const inverseInertiaScale = derived.mass > 0 ? derived.mass / mass : 1;
    inverseInertiaXX =
      derived.mass > 0
        ? derived.inverseInertiaXX * inverseInertiaScale
        : inverseMass;
    inverseInertiaYY =
      derived.mass > 0
        ? derived.inverseInertiaYY * inverseInertiaScale
        : inverseMass;
    inverseInertiaZZ =
      derived.mass > 0
        ? derived.inverseInertiaZZ * inverseInertiaScale
        : inverseMass;
    inverseInertiaXY = derived.inverseInertiaXY * inverseInertiaScale;
    inverseInertiaXZ = derived.inverseInertiaXZ * inverseInertiaScale;
    inverseInertiaYZ = derived.inverseInertiaYZ * inverseInertiaScale;
    translationLocks = axisLockBits(descriptor.options.lockTranslation);
    rotationLocks = axisLockBits(descriptor.options.lockRotation);
  } else if (enabled && descriptor.bodyType === "kinematic") {
    flags |= BODY_TYPE_KINEMATIC_3D;
    if (!descriptor.options.allowSleep) flags |= BODY_SLEEP_DISABLED_3D;
  }
  const previousKinematic =
    previous !== undefined && (previous.flags & BODY_TYPE_KINEMATIC_3D) !== 0
      ? previous
      : undefined;
  const orientation =
    committedKinematicPose?.orientation ??
    (previousKinematic === undefined
      ? body.initialPose.orientation
      : freezeQuaternion([
          previousKinematic.orientationX,
          previousKinematic.orientationY,
          previousKinematic.orientationZ,
          previousKinematic.orientationW,
        ]));
  const previousCenterOffset = new Float64Array(3);
  if (previousKinematic !== undefined) {
    rotateVectorInto(
      previousCenterOffset,
      [
        previousKinematic.localCenterX ?? 0,
        previousKinematic.localCenterY ?? 0,
        previousKinematic.localCenterZ ?? 0,
      ],
      orientation,
    );
  }
  const origin =
    committedKinematicPose?.position ??
    (previousKinematic === undefined
      ? body.initialPose.position
      : freezeVector3([
          previousKinematic.positionX - previousCenterOffset[0]!,
          previousKinematic.positionY - previousCenterOffset[1]!,
          previousKinematic.positionZ - previousCenterOffset[2]!,
        ]));
  const centerOffset = new Float64Array(3);
  rotateVectorInto(centerOffset, localCenter, orientation);
  return Object.freeze({
    positionX: origin[0] + centerOffset[0]!,
    positionY: origin[1] + centerOffset[1]!,
    positionZ: origin[2] + centerOffset[2]!,
    orientationX: orientation[0],
    orientationY: orientation[1],
    orientationZ: orientation[2],
    orientationW: orientation[3],
    localCenterX: localCenter[0],
    localCenterY: localCenter[1],
    localCenterZ: localCenter[2],
    linearVelocityX,
    linearVelocityY,
    linearVelocityZ,
    angularVelocityX,
    angularVelocityY,
    angularVelocityZ,
    forceX: 0,
    forceY: 0,
    forceZ: 0,
    torqueX: 0,
    torqueY: 0,
    torqueZ: 0,
    inverseMass,
    localInverseInertiaXX: inverseInertiaXX,
    localInverseInertiaYY: inverseInertiaYY,
    localInverseInertiaZZ: inverseInertiaZZ,
    localInverseInertiaXY: inverseInertiaXY,
    localInverseInertiaXZ: inverseInertiaXZ,
    localInverseInertiaYZ: inverseInertiaYZ,
    linearDamping,
    angularDamping,
    gravityScale,
    sleepTime: 0,
    translationLocks,
    rotationLocks,
    flags,
    owner: body.attachment,
  });
}

const ZERO_VELOCITY_3D: BodyVelocity3D = Object.freeze({
  linearVelocityX: 0,
  linearVelocityY: 0,
  linearVelocityZ: 0,
  angularVelocityX: 0,
  angularVelocityY: 0,
  angularVelocityZ: 0,
});

function compoundMassInput(collider: ColliderDraft3D) {
  return Object.freeze({
    shape: collider.shape,
    position: ZERO_VECTOR_3D,
    orientation: IDENTITY_ORIENTATION_3D,
    density: collider.options.density,
    contributesToMass: collider.options.contributesToMass,
  });
}

function sameMassInputs(
  left: readonly ReturnType<typeof compoundMassInput>[],
  right: readonly ReturnType<typeof compoundMassInput>[],
): boolean {
  return (
    left.length === right.length &&
    left.every((entry, index) => {
      const candidate = right[index];
      return (
        candidate !== undefined &&
        entry.shape === candidate.shape &&
        entry.density === candidate.density &&
        entry.contributesToMass === candidate.contributesToMass
      );
    })
  );
}

function sameConfiguration(
  left: NormalizedPhysicsWorld3DConfiguration,
  right: NormalizedPhysicsWorld3DConfiguration,
): boolean {
  return (
    left.gravityX === right.gravityX &&
    left.gravityY === right.gravityY &&
    left.gravityZ === right.gravityZ &&
    left.fixedStepMilliseconds === right.fixedStepMilliseconds &&
    left.maxCatchUpSteps === right.maxCatchUpSteps &&
    left.interpolation === right.interpolation &&
    left.sleeping === right.sleeping &&
    left.velocityIterations === right.velocityIterations &&
    left.positionIterations === right.positionIterations
  );
}

function copyPhysicsPose3D(pose: CRCPhysicsPose3D): CRCPhysicsPose3D {
  return Object.freeze({
    position: freezeVector3(
      copyFiniteVector3(pose.position, "initial physics pose.position"),
    ),
    orientation: freezeQuaternion(
      copyCanonicalQuaternion(
        pose.orientation,
        "initial physics pose.orientation",
      ),
    ),
  });
}

function sameTopology(
  left: readonly PhysicsTopologyRecord3D[],
  right: readonly PhysicsTopologyRecord3D[],
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
        first.definition.tag === second.definition.tag &&
        first.definition.owner === second.definition.owner &&
        first.definition.flags === second.definition.flags &&
        first.definition.localPositionX === second.definition.localPositionX &&
        first.definition.localPositionY === second.definition.localPositionY &&
        first.definition.localPositionZ === second.definition.localPositionZ &&
        first.definition.localOrientationX ===
          second.definition.localOrientationX &&
        first.definition.localOrientationY ===
          second.definition.localOrientationY &&
        first.definition.localOrientationZ ===
          second.definition.localOrientationZ &&
        first.definition.localOrientationW ===
          second.definition.localOrientationW &&
        first.definition.density === second.definition.density &&
        first.definition.friction === second.definition.friction &&
        first.definition.restitution === second.definition.restitution &&
        first.definition.collisionCategory ===
          second.definition.collisionCategory &&
        first.definition.collisionMask === second.definition.collisionMask &&
        first.definition.collisionGroup === second.definition.collisionGroup &&
        sameRecord(first.definition.handlers, second.definition.handlers)
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

function validateBodyHandleBindingTransition(
  controller: PhysicsWorld3DController,
  previousBodies: readonly AcceptedBody3D[],
  bodies: readonly BodyDraft3D[],
): void {
  const ids = new Map<CRCPhysicsBodyHandle3D, number>();
  for (const body of bodies) {
    const handle = body.descriptor.options.handle;
    if (handle === undefined) continue;
    const previous = ids.get(handle);
    if (previous !== undefined && previous !== body.id) {
      throw new Error(
        "A CRC physics 3D body handle may bind to at most one live body.",
      );
    }
    ids.set(handle, body.id);
  }
  for (const [handle, bodyId] of ids) {
    if (typeof handle !== "object" || handle === null) {
      throw new TypeError("Expected a live CRC physics 3D body handle.");
    }
    const binding = physicsBodyHandleBinding3D(handle);
    if (
      binding === undefined ||
      (binding.controller === controller && binding.bodyId === bodyId)
    ) {
      continue;
    }
    const releasable = previousBodies.some(
      (previous) =>
        previous.descriptor.options.handle === handle &&
        previous.id === binding.bodyId &&
        previous.handleBindingGeneration === binding.bindingGeneration &&
        binding.controller === controller &&
        !bodies.some(
          (next) =>
            next.id === previous.id &&
            next.descriptor.options.handle === handle,
        ),
    );
    if (!releasable) {
      throw new Error(
        "A CRC physics 3D body handle may bind to at most one live body.",
      );
    }
  }
}

function hasChangedKinematicTarget(
  previous: readonly AcceptedBody3D[],
  next: readonly BodyDraft3D[],
): boolean {
  const previousById = new Map(
    previous.map((body) => [body.id, body] as const),
  );
  return next.some((body) => {
    if (body.descriptor.bodyType !== "kinematic") return false;
    const target = body.descriptor.options.target;
    if (target.position === undefined && target.orientation === undefined) {
      return false;
    }
    const old = previousById.get(body.id)?.descriptor;
    return (
      old?.bodyType !== "kinematic" ||
      old.options.target.position !== target.position ||
      old.options.target.orientation !== target.orientation
    );
  });
}

function hasEnabledKinematicBinding(
  bodies: readonly AcceptedBody3D[],
): boolean {
  return bodies.some((body) => {
    if (
      body.descriptor.bodyType !== "kinematic" ||
      !body.descriptor.options.enabled
    ) {
      return false;
    }
    const target = body.descriptor.options.target;
    return target.position !== undefined || target.orientation !== undefined;
  });
}

function commandsForRemovedKinematicTargets(
  previousBodies: readonly AcceptedBody3D[],
  nextBodies: readonly BodyDraft3D[],
): readonly PhysicsBodyCommand3D[] {
  const nextById = new Map(nextBodies.map((body) => [body.id, body] as const));
  const commands: PhysicsBodyCommand3D[] = [];
  for (const previous of previousBodies) {
    if (previous.descriptor.bodyType !== "kinematic") continue;
    const next = nextById.get(previous.id);
    if (next?.descriptor.bodyType !== "kinematic") continue;
    const before = previous.descriptor.options.target;
    const after = next.descriptor.options.target;
    if (before.position !== undefined && after.position === undefined) {
      commands.push(
        Object.freeze({
          kind: "set-linear-velocity",
          bodyId: previous.id,
          linearVelocityX: 0,
          linearVelocityY: 0,
          linearVelocityZ: 0,
        }),
      );
    }
    if (before.orientation !== undefined && after.orientation === undefined) {
      commands.push(
        Object.freeze({
          kind: "set-angular-velocity",
          bodyId: previous.id,
          angularVelocityXDegrees: 0,
          angularVelocityYDegrees: 0,
          angularVelocityZDegrees: 0,
        }),
      );
    }
  }
  return Object.freeze(commands);
}

function eventHandlerName(
  kind: PhysicsContactEventDelivery3D["kind"],
): keyof NormalizedPhysicsColliderConfiguration3D["handlers"] {
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

const ZERO_POSE_3D: CRCPhysicsPose3D = Object.freeze({
  position: Object.freeze([0, 0, 0] as const),
  orientation: Object.freeze([0, 0, 0, 1] as const),
});

const ZERO_VECTOR_3D: CRCPhysicsVector3 = Object.freeze([0, 0, 0] as const);
const IDENTITY_ORIENTATION_3D = Object.freeze([0, 0, 0, 1] as const);

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function axisLockBits(
  locks: Readonly<{ x: boolean; y: boolean; z: boolean }>,
): number {
  return (locks.x ? 1 : 0) | (locks.y ? 2 : 0) | (locks.z ? 4 : 0);
}

function freezeVector3(value: ArrayLike<number>): CRCPhysicsVector3 {
  return Object.freeze([value[0]!, value[1]!, value[2]!] as const);
}

function freezeQuaternion(
  value: ArrayLike<number>,
): readonly [number, number, number, number] {
  return Object.freeze([value[0]!, value[1]!, value[2]!, value[3]!] as const);
}
