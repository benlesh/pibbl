import { signal, type Signal, type WritableSignal } from "@crc/core";
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
import type { CRCPhysicsPose2D } from "../../../2d-geometry.js";
import type { ShapeRecord2D } from "../shape-records.js";
import type {
  CRCPhysicsBodyHandle2D,
  CRCPhysicsBodyStateEvent2D,
  CRCPhysicsWorld2DProps,
  CRCPhysicsWorldHandle2D,
} from "../types.js";
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
  type PhysicsColliderTopologyRecord2D,
  type PhysicsCommand2D,
  type PhysicsTopologyRecord2D,
  type PhysicsWorld2DCandidate,
} from "../world/world.js";
import {
  type MountedPhysicsAttachment2D,
  type NormalizedPhysicsColliderConfiguration2D,
  type PhysicsBodyAttachment2DDescriptor,
} from "./descriptors.js";

const worldController2DSymbol = Symbol("PhysicsWorld2DController");

type InternalWorldHandle2D = CRCPhysicsWorldHandle2D &
  Readonly<{
    readonly [worldController2DSymbol]: PhysicsWorld2DController;
  }>;

interface BodyDraft2D {
  readonly id: number;
  readonly attachment: MountedPhysicsAttachment2D;
  readonly descriptor: PhysicsBodyAttachment2DDescriptor;
  readonly initialPose: CRCPhysicsPose2D;
}

interface ColliderDraft2D {
  readonly id: number;
  readonly bodyId: number;
  readonly attachment: MountedPhysicsAttachment2D;
  readonly options: NormalizedPhysicsColliderConfiguration2D;
  readonly shape: ShapeRecord2D;
}

interface RenderDraft2D {
  readonly configuration: NormalizedPhysicsWorld2DConfiguration;
  readonly props: CRCPhysicsWorld2DProps;
  readonly bodies: Map<number, BodyDraft2D>;
  readonly colliders: Map<number, ColliderDraft2D>;
}

interface AcceptedBody2D {
  readonly id: number;
  readonly attachment: MountedPhysicsAttachment2D;
  readonly descriptor: PhysicsBodyAttachment2DDescriptor;
  readonly initialPose: CRCPhysicsPose2D;
}

interface AttachmentIds2D {
  bodyId?: number;
  colliderId?: number;
}

export interface PhysicsWorld2DControllerSnapshot {
  readonly revision: number;
  readonly advanceRegistered: boolean;
  readonly bodyIds: readonly number[];
  readonly colliderIds: readonly number[];
  readonly kernel: ReturnType<PhysicsWorld2DKernel["snapshot"]>;
}

export class PhysicsWorld2DController {
  readonly handle: CRCPhysicsWorldHandle2D;
  private readonly revision: WritableSignal<number>;
  private readonly kernel: PhysicsWorld2DKernel;
  private readonly ids = new WeakMap<object, AttachmentIds2D>();
  private nextId = 0;
  private draft: RenderDraft2D | undefined;
  private acceptedTopology: readonly PhysicsTopologyRecord2D[] = Object.freeze(
    [],
  );
  private acceptedBodies: readonly AcceptedBody2D[] = Object.freeze([]);
  private acceptedConfiguration: NormalizedPhysicsWorld2DConfiguration;
  private acceptedProps: CRCPhysicsWorld2DProps = Object.freeze({});
  private queuedBegin: Readonly<{ cancel(): void }> | undefined;
  private releaseAdvance: (() => void) | undefined;
  private liveCandidate: PhysicsWorld2DCandidate | undefined;
  private active = true;

  constructor(
    private readonly owner: CRCInternalSimulationOwner,
    initialProps: CRCPhysicsWorld2DProps,
  ) {
    const configuration = normalizeWorldConfiguration(initialProps);
    this.kernel = new PhysicsWorld2DKernel(configuration);
    this.acceptedConfiguration = configuration;
    this.revision = signal(0, { debugName: "PhysicsWorld2D.revision" });
    this.handle = Object.freeze({
      revision: this.revision.asReadonly(),
      [worldController2DSymbol]: this,
    }) as unknown as InternalWorldHandle2D;
  }

  beginRender(props: CRCPhysicsWorld2DProps): void {
    this.assertActive();
    if (this.draft !== undefined) {
      throw new Error(
        "PhysicsWorld2D began a second render before finishing the first.",
      );
    }
    this.draft = {
      configuration: normalizeWorldConfiguration(props),
      props,
      bodies: new Map(),
      colliders: new Map(),
    };
    crcInternalOnSimulationRenderTransactionFinish(this.owner, (success) =>
      this.finishRender(success),
    );
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
    initialPose: CRCPhysicsPose2D = ZERO_POSE_2D,
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
    crcInternalQueueSimulationBegin(this.owner, () => {
      this.kernel.applyBegin(commands);
    });
    this.ensureAdvance();
  }

  presentationPose(bodyId: number): CRCPhysicsPose2D | undefined {
    return this.kernel.snapshot().bodies.some((body) => body.id === bodyId)
      ? this.kernel.presentationPose(bodyId)
      : undefined;
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
    this.kernel.dispose();
    this.draft = undefined;
  }

  snapshot(): PhysicsWorld2DControllerSnapshot {
    return Object.freeze({
      revision: this.revision.get(),
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
    const topology = materializeTopology(draft);
    const topologyChanged = !sameTopology(this.acceptedTopology, topology);
    const configurationChanged = !sameConfiguration(
      this.acceptedConfiguration,
      draft.configuration,
    );
    this.acceptedProps = draft.props;
    this.acceptedBodies = Object.freeze(
      [...draft.bodies.values()]
        .sort((left, right) => left.id - right.id)
        .map(({ id, attachment, descriptor, initialPose }) =>
          Object.freeze({ id, attachment, descriptor, initialPose }),
        ),
    );
    if (!topologyChanged && !configurationChanged) return;
    this.acceptedTopology = topology;
    this.acceptedConfiguration = draft.configuration;
    this.queuedBegin?.cancel();
    this.queuedBegin = crcInternalQueueSimulationBegin(this.owner, () => {
      this.queuedBegin = undefined;
      if (topologyChanged) this.kernel.proposeTopology(topology);
      if (configurationChanged) {
        this.kernel.applyBegin([
          { kind: "configure", configuration: draft.configuration },
        ]);
      }
    });
    this.ensureAdvance();
  }

  private ensureAdvance(): void {
    if (this.releaseAdvance !== undefined) return;
    this.releaseAdvance = crcInternalRegisterSimulationAdvance(
      this.owner,
      "physics",
      (frame, batch) => this.advance(frame.frameId, frame.logicalTime, batch),
    );
  }

  private advance(
    frameId: number,
    logicalTime: number,
    batch: CRCInternalSignalBatch,
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
      this.stagePublicSignals(batch);
      const events = this.copyBodyStateEvents(candidate);
      const onSleep = this.acceptedProps.onSleep;
      const onWake = this.acceptedProps.onWake;
      let adopted = false;
      if (events.length > 0) {
        crcInternalQueueSimulationComplete(this.owner, () => {
          if (adopted) this.deliverBodyStateEvents(events, onSleep, onWake);
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
          adopted = true;
          crcInternalRequestSimulationRender(this.owner);
          if (!this.hasAwakeBodies()) {
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
  ): ReadonlyMap<number, CRCPhysicsPose2D> {
    const targets = new Map<number, CRCPhysicsPose2D>();
    const currentIds = new Set(
      this.kernel.snapshot().bodies.map((body) => body.id),
    );
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
      const current = currentIds.has(body.id)
        ? this.kernel.authoritativePose(body.id)
        : body.initialPose;
      const position =
        target.position === undefined
          ? current.position
          : batch.read(
              target.position as WritableSignal<readonly [number, number]>,
            );
      const rotationDegrees =
        target.rotationDegrees === undefined
          ? current.rotationDegrees
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

  private stagePublicSignals(batch: CRCInternalSignalBatch): void {
    batch.stage(this.revision, batch.read(this.revision) + 1, this);
    const snapshot = this.kernel.snapshot();
    const byId = new Map(snapshot.bodies.map((body) => [body.id, body]));
    for (const body of this.acceptedBodies) {
      const handle = body.descriptor.options.handle;
      const state = byId.get(body.id);
      if (!handle || !state) continue;
      const pose = this.kernel.authoritativePose(body.id);
      stageHandleSignal(batch, handle.position, pose.position, this);
      stageHandleSignal(
        batch,
        handle.rotationDegrees,
        pose.rotationDegrees,
        this,
      );
      stageHandleSignal(
        batch,
        handle.linearVelocity,
        Object.freeze([state.linearVelocityX, state.linearVelocityY] as const),
        this,
      );
      stageHandleSignal(
        batch,
        handle.angularVelocityDegreesPerSecond,
        (state.angularVelocity * 180) / Math.PI,
        this,
      );
      stageHandleSignal(
        batch,
        handle.sleeping,
        (state.flags & BODY_SLEEPING_2D) !== 0,
        this,
      );
      stageHandleSignal(
        batch,
        handle.enabled,
        body.descriptor.options.enabled,
        this,
      );
      stageHandleSignal(batch, handle.generation, state.generation, this);
    }
  }

  private copyBodyStateEvents(
    candidate: PhysicsWorld2DCandidate,
  ): readonly Readonly<{
    body: CRCPhysicsBodyHandle2D;
    sleeping: boolean;
    tick: number;
  }>[] {
    const snapshot = this.kernel.snapshot();
    const byIndex = new Map(
      snapshot.bodies.map((body) => [body.index, body.id]),
    );
    const acceptedById = new Map(
      this.acceptedBodies.map((body) => [body.id, body]),
    );
    const events: Readonly<{
      body: CRCPhysicsBodyHandle2D;
      sleeping: boolean;
      tick: number;
    }>[] = [];
    for (let offset = 0; offset < candidate.eventCount; offset += 1) {
      const eventIndex = candidate.eventOffset + offset;
      const kind = candidate.eventKinds[eventIndex];
      if (kind !== 5 && kind !== 6) continue;
      const id = byIndex.get(candidate.eventFirstColliderIndices[eventIndex]!);
      const handle =
        id === undefined
          ? undefined
          : acceptedById.get(id)?.descriptor.options.handle;
      if (!handle) continue;
      events.push(
        Object.freeze({
          body: handle,
          sleeping: kind === 6,
          tick: candidate.eventTicks[eventIndex]!,
        }),
      );
    }
    return Object.freeze(events);
  }

  private deliverBodyStateEvents(
    events: readonly Readonly<{
      body: CRCPhysicsBodyHandle2D;
      sleeping: boolean;
      tick: number;
    }>[],
    onSleep: CRCPhysicsWorld2DProps["onSleep"],
    onWake: CRCPhysicsWorld2DProps["onWake"],
  ): void {
    for (const fact of events) {
      const callback = fact.sleeping ? onSleep : onWake;
      if (!callback) continue;
      const event: CRCPhysicsBodyStateEvent2D = Object.freeze({ ...fact });
      callback(event);
    }
  }

  private hasAwakeBodies(): boolean {
    for (const body of this.kernel.snapshot().bodies) {
      if ((body.flags & BODY_TYPE_KINEMATIC_2D) !== 0) return true;
      if (
        (body.flags & BODY_TYPE_DYNAMIC_2D) !== 0 &&
        (body.flags & BODY_SLEEPING_2D) === 0
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
    if (!this.active) throw new Error("PhysicsWorld2D controller is disposed.");
  }
}

export function requirePhysicsWorld2DController(
  handle: CRCPhysicsWorldHandle2D,
): PhysicsWorld2DController {
  const controller = (handle as Partial<InternalWorldHandle2D>)[
    worldController2DSymbol
  ];
  if (!(controller instanceof PhysicsWorld2DController)) {
    throw new TypeError("Expected a live CRC physics 2D world handle.");
  }
  return controller;
}

export function snapshotPhysicsWorld2DControllerForTest(
  controller: PhysicsWorld2DController,
): PhysicsWorld2DControllerSnapshot {
  return controller.snapshot();
}

function normalizeWorldConfiguration(
  props: CRCPhysicsWorld2DProps,
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

function materializeTopology(
  draft: RenderDraft2D,
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
        definition: bodyDefinition(body, collidersByBody.get(body.id) ?? []),
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

function bodyDefinition(
  body: BodyDraft2D,
  colliders: readonly ColliderDraft2D[],
): BodyDefinition2D {
  const descriptor = body.descriptor;
  const enabled = descriptor.options.enabled;
  let flags = 0;
  let linearVelocityX = 0;
  let linearVelocityY = 0;
  let angularVelocity = 0;
  let linearDamping = 0;
  let angularDamping = 0;
  let gravityScale = 0;
  let inverseMass = 0;
  let inverseInertia = 0;
  if (enabled && descriptor.bodyType === "dynamic") {
    flags |= BODY_TYPE_DYNAMIC_2D;
    if (descriptor.options.fixedRotation) flags |= BODY_FIXED_ROTATION_2D;
    if (!descriptor.options.allowSleep) flags |= BODY_SLEEP_DISABLED_2D;
    if (descriptor.options.ccd) flags |= BODY_CCD_2D;
    linearVelocityX = descriptor.options.linearVelocity[0];
    linearVelocityY = descriptor.options.linearVelocity[1];
    angularVelocity =
      (descriptor.options.angularVelocityDegreesPerSecond * Math.PI) / 180;
    linearDamping = descriptor.options.linearDamping;
    angularDamping = descriptor.options.angularDamping;
    gravityScale = descriptor.options.gravityScale;
    const mass =
      descriptor.options.mass === "auto"
        ? autoMass(colliders)
        : descriptor.options.mass;
    inverseMass = mass > 0 ? 1 / mass : 1;
    inverseInertia = descriptor.options.fixedRotation ? 0 : inverseMass;
  } else if (enabled && descriptor.bodyType === "kinematic") {
    flags |= BODY_TYPE_KINEMATIC_2D;
    if (!descriptor.options.allowSleep) flags |= BODY_SLEEP_DISABLED_2D;
  }
  return Object.freeze({
    positionX: body.initialPose.position[0],
    positionY: body.initialPose.position[1],
    rotationRadians: (body.initialPose.rotationDegrees * Math.PI) / 180,
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

function autoMass(colliders: readonly ColliderDraft2D[]): number {
  let mass = 0;
  for (const collider of colliders) {
    if (!collider.options.contributesToMass) continue;
    mass += collider.shape.area * collider.options.density;
  }
  return mass > 0 ? mass : 1;
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

function copyPhysicsPose2D(pose: CRCPhysicsPose2D): CRCPhysicsPose2D {
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
        first.definition.tag === second.definition.tag &&
        first.definition.owner === second.definition.owner &&
        first.definition.flags === second.definition.flags &&
        sameRecord(first.definition.material, second.definition.material) &&
        sameRecord(first.definition.filter, second.definition.filter) &&
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

function stageHandleSignal<T>(
  batch: CRCInternalSignalBatch,
  target: Signal<T>,
  value: T,
  writer: object,
): void {
  batch.stage(target as WritableSignal<T>, value, writer);
}

const ZERO_POSE_2D: CRCPhysicsPose2D = Object.freeze({
  position: Object.freeze([0, 0] as const),
  rotationDegrees: 0,
});
