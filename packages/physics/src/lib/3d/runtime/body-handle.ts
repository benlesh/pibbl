import { signal, type WritableSignal } from "@crc/core";
import {
  crcInternalCurrentSimulationOwner,
  crcInternalQueueSimulationBegin,
  useInternalHookSlot,
  type CRCInternalSignalBatch,
  type CRCInternalSimulationOwner,
} from "@crc/core/internal";
import type {
  CRCPhysicsPose3D,
  CRCPhysicsQuaternion,
  CRCPhysicsVector3,
} from "../../../3d-geometry.js";
import type { CRCPhysicsBodyHandle3D } from "../types.js";
import type { PhysicsCommand3D } from "../world/world.js";
import { copyCanonicalQuaternion, copyFiniteVector3 } from "../math.js";
import type { PhysicsWorld3DController } from "./controller.js";

type PhysicsBodyCommand3D = Extract<PhysicsCommand3D, { readonly bodyId: number }>;

export type PhysicsBodyHandleField3D =
  | "position"
  | "orientation"
  | "linearVelocity"
  | "angularVelocityDegreesPerSecond"
  | "sleeping"
  | "enabled"
  | "generation";

export interface PhysicsBodyHandleBinding3D {
  readonly controller: PhysicsWorld3DController;
  readonly bodyId: number;
  readonly bindingGeneration: number;
}

interface PhysicsBodyHandleState3D {
  readonly owner: CRCInternalSimulationOwner;
  readonly signals: Partial<{
    [Field in PhysicsBodyHandleField3D]: WritableSignal<
      BodyFieldValue3D[Field]
    >;
  }>;
  binding: PhysicsBodyHandleBinding3D | undefined;
  nextBindingGeneration: number;
  active: boolean;
}

interface BodyFieldValue3D {
  readonly position: CRCPhysicsVector3;
  readonly orientation: CRCPhysicsQuaternion;
  readonly linearVelocity: CRCPhysicsVector3;
  readonly angularVelocityDegreesPerSecond: CRCPhysicsVector3;
  readonly sleeping: boolean;
  readonly enabled: boolean;
  readonly generation: number;
}

export interface PhysicsBodyHandleValues3D extends BodyFieldValue3D {}

const states = new WeakMap<object, PhysicsBodyHandleState3D>();
const externalBindings = new WeakMap<
  object,
  {
    binding: PhysicsBodyHandleBinding3D | undefined;
    nextBindingGeneration: number;
  }
>();

/** Returns one stable, component-owned 3D body endpoint for this hook slot. */
export function crcPhysicsBody3D(): CRCPhysicsBodyHandle3D {
  const owner = crcInternalCurrentSimulationOwner();
  const slot = useInternalHookSlot("physicsBody3DHandle", (teardowns) => {
    const handle = createPhysicsBodyHandle3D(owner);
    teardowns.add(() => disposePhysicsBodyHandle3D(handle));
    return handle;
  });
  return slot.value;
}

export function applyForce3D(
  body: CRCPhysicsBodyHandle3D,
  force: CRCPhysicsVector3,
  options: Readonly<{ at?: CRCPhysicsVector3; wake?: boolean }> = {},
): void {
  const copied = copyFiniteVector3(force, "force");
  const point =
    options.at === undefined
      ? undefined
      : copyFiniteVector3(options.at, "options.at");
  queueBodyCommand(body, {
    kind: "apply-force",
    bodyId: 0,
    forceX: copied[0],
    forceY: copied[1],
    forceZ: copied[2],
    pointX: point?.[0],
    pointY: point?.[1],
    pointZ: point?.[2],
    wake: requireBoolean(options.wake ?? true, "options.wake"),
  });
}

export function applyImpulse3D(
  body: CRCPhysicsBodyHandle3D,
  impulse: CRCPhysicsVector3,
  options: Readonly<{ at?: CRCPhysicsVector3; wake?: boolean }> = {},
): void {
  const copied = copyFiniteVector3(impulse, "impulse");
  const point =
    options.at === undefined
      ? undefined
      : copyFiniteVector3(options.at, "options.at");
  queueBodyCommand(body, {
    kind: "apply-impulse",
    bodyId: 0,
    impulseX: copied[0],
    impulseY: copied[1],
    impulseZ: copied[2],
    pointX: point?.[0],
    pointY: point?.[1],
    pointZ: point?.[2],
    wake: requireBoolean(options.wake ?? true, "options.wake"),
  });
}

export function applyTorque3D(
  body: CRCPhysicsBodyHandle3D,
  torque: CRCPhysicsVector3,
): void {
  const copied = copyFiniteVector3(torque, "torque");
  queueBodyCommand(body, {
    kind: "apply-torque",
    bodyId: 0,
    torqueX: copied[0],
    torqueY: copied[1],
    torqueZ: copied[2],
  });
}

export function setLinearVelocity3D(
  body: CRCPhysicsBodyHandle3D,
  velocity: CRCPhysicsVector3,
): void {
  const copied = copyFiniteVector3(velocity, "velocity");
  queueBodyCommand(body, {
    kind: "set-linear-velocity",
    bodyId: 0,
    linearVelocityX: copied[0],
    linearVelocityY: copied[1],
    linearVelocityZ: copied[2],
  });
}

export function setAngularVelocity3D(
  body: CRCPhysicsBodyHandle3D,
  degreesPerSecond: CRCPhysicsVector3,
): void {
  const copied = copyFiniteVector3(degreesPerSecond, "degreesPerSecond");
  queueBodyCommand(body, {
    kind: "set-angular-velocity",
    bodyId: 0,
    angularVelocityXDegrees: copied[0],
    angularVelocityYDegrees: copied[1],
    angularVelocityZDegrees: copied[2],
  });
}

export function teleportBody3D(
  body: CRCPhysicsBodyHandle3D,
  pose: CRCPhysicsPose3D,
): void {
  queueBodyCommand(body, {
    kind: "set-pose",
    bodyId: 0,
    pose: Object.freeze({
      position: freezeVector(copyFiniteVector3(pose.position, "pose.position")),
      orientation: freezeQuaternion(
        copyCanonicalQuaternion(pose.orientation, "pose.orientation"),
      ),
    }),
  });
}

export function wakeBody3D(body: CRCPhysicsBodyHandle3D): void {
  queueBodyCommand(body, { kind: "wake", bodyId: 0 });
}

export function sleepBody3D(body: CRCPhysicsBodyHandle3D): void {
  queueBodyCommand(body, { kind: "sleep", bodyId: 0 });
}

export function enableBody3D(
  body: CRCPhysicsBodyHandle3D,
  options: Readonly<{ velocity?: "zero" | "preserve" }> = {},
): void {
  const velocity = options.velocity ?? "zero";
  if (velocity !== "zero" && velocity !== "preserve") {
    throw new TypeError('options.velocity must be "zero" or "preserve".');
  }
  queueBodyCommand(body, { kind: "enable", bodyId: 0, velocity });
}

export function disableBody3D(body: CRCPhysicsBodyHandle3D): void {
  queueBodyCommand(body, { kind: "disable", bodyId: 0 });
}

export function createPhysicsBodyHandle3D(
  owner: CRCInternalSimulationOwner,
): CRCPhysicsBodyHandle3D {
  const target = {} as Record<PropertyKey, unknown>;
  const state: PhysicsBodyHandleState3D = {
    owner,
    signals: {},
    binding: undefined,
    nextBindingGeneration: 0,
    active: true,
  };
  for (const field of BODY_FIELDS_3D) {
    Object.defineProperty(target, field, {
      enumerable: true,
      get: () => materializeSignal(state, field).asReadonly(),
    });
  }
  const handle = Object.freeze(target) as unknown as CRCPhysicsBodyHandle3D;
  states.set(handle, state);
  return handle;
}

export function bindPhysicsBodyHandle3D(
  handle: CRCPhysicsBodyHandle3D,
  controller: PhysicsWorld3DController,
  bodyId: number,
): number {
  const state = states.get(handle as object);
  if (state === undefined) {
    if (typeof handle !== "object" || handle === null) {
      throw new TypeError("Expected a live CRC physics 3D body handle.");
    }
    let external = externalBindings.get(handle as object);
    if (external?.binding !== undefined) {
      if (
        external.binding.controller === controller &&
        external.binding.bodyId === bodyId
      ) {
        return external.binding.bindingGeneration;
      }
      throw new Error(
        "A CRC physics 3D body handle may bind to at most one live body.",
      );
    }
    external ??= { binding: undefined, nextBindingGeneration: 0 };
    const bindingGeneration = ++external.nextBindingGeneration;
    external.binding = Object.freeze({ controller, bodyId, bindingGeneration });
    externalBindings.set(handle as object, external);
    return bindingGeneration;
  }
  const current = state.binding;
  if (current !== undefined) {
    if (current.controller === controller && current.bodyId === bodyId) {
      return current.bindingGeneration;
    }
    throw new Error(
      "A CRC physics 3D body handle may bind to at most one live body.",
    );
  }
  const bindingGeneration = ++state.nextBindingGeneration;
  state.binding = Object.freeze({ controller, bodyId, bindingGeneration });
  return bindingGeneration;
}

export function unbindPhysicsBodyHandle3D(
  handle: CRCPhysicsBodyHandle3D,
  controller: PhysicsWorld3DController,
  bodyId: number,
  bindingGeneration: number,
): void {
  const state = states.get(handle as object);
  if (state === undefined) {
    const external = externalBindings.get(handle as object);
    const binding = external?.binding;
    if (
      binding?.controller === controller &&
      binding.bodyId === bodyId &&
      binding.bindingGeneration === bindingGeneration
    ) {
      external!.binding = undefined;
    }
    return;
  }
  const binding = state?.binding;
  if (
    binding?.controller === controller &&
    binding.bodyId === bodyId &&
    binding.bindingGeneration === bindingGeneration
  ) {
    state!.binding = undefined;
  }
}

export function physicsBodyHandleBinding3D(
  handle: CRCPhysicsBodyHandle3D,
): PhysicsBodyHandleBinding3D | undefined {
  return (
    states.get(handle as object)?.binding ??
    externalBindings.get(handle as object)?.binding
  );
}

export function physicsBodyHandleOwner3D(
  handle: CRCPhysicsBodyHandle3D,
): CRCInternalSimulationOwner {
  return requireState(handle).owner;
}

export function stagePhysicsBodyHandle3D(
  batch: CRCInternalSignalBatch,
  handle: CRCPhysicsBodyHandle3D,
  values: PhysicsBodyHandleValues3D,
  writer: object,
): void {
  const state = states.get(handle as object);
  if (state === undefined) {
    stageLegacyHandle(batch, handle, values, writer);
    return;
  }
  for (const field of BODY_FIELDS_3D) {
    const target = state.signals[field] as
      WritableSignal<BodyFieldValue3D[typeof field]> | undefined;
    if (target !== undefined) batch.stage(target, values[field], writer);
  }
}

export function snapshotPhysicsBodyHandle3DForTest(
  handle: CRCPhysicsBodyHandle3D,
): Readonly<{
  readonly bound: boolean;
  readonly bindingGeneration: number;
  readonly materializedFields: readonly PhysicsBodyHandleField3D[];
}> {
  const state = requireState(handle);
  return Object.freeze({
    bound: state.binding !== undefined,
    bindingGeneration: state.binding?.bindingGeneration ?? 0,
    materializedFields: Object.freeze(
      BODY_FIELDS_3D.filter((field) => state.signals[field] !== undefined),
    ),
  });
}

function disposePhysicsBodyHandle3D(handle: CRCPhysicsBodyHandle3D): void {
  const state = states.get(handle as object);
  if (state === undefined || !state.active) return;
  state.active = false;
  state.binding = undefined;
}

function queueBodyCommand(
  handle: CRCPhysicsBodyHandle3D,
  command: PhysicsBodyCommand3D,
): void {
  const state = requireState(handle);
  const captured = state.binding;
  crcInternalQueueSimulationBegin(state.owner, () => {
    const current = state.binding;
    if (
      captured === undefined ||
      current === undefined ||
      current.bindingGeneration !== captured.bindingGeneration ||
      current.controller !== captured.controller ||
      current.bodyId !== captured.bodyId
    ) {
      traceStaleCommand(command.kind, captured?.bindingGeneration ?? 0);
      return;
    }
    if (
      !current.controller.acceptBodyHandleCommand(
        handle,
        current.bindingGeneration,
        Object.freeze({
          ...command,
          bodyId: current.bodyId,
        }) as PhysicsBodyCommand3D,
      )
    ) {
      traceStaleCommand(command.kind, current.bindingGeneration);
    }
  });
}

function traceStaleCommand(
  kind: PhysicsBodyCommand3D["kind"],
  generation: number,
): void {
  const runtime = globalThis as typeof globalThis & {
    readonly process?: Readonly<{
      readonly env?: Readonly<{ readonly NODE_ENV?: string }>;
    }>;
  };
  if (runtime.process?.env?.NODE_ENV === "production") return;
  console.warn(
    `[CRC physics] Ignored stale ${kind} command for body handle generation ${String(generation)}.`,
  );
}

function requireBoolean(value: boolean, path: string): boolean {
  if (typeof value !== "boolean")
    throw new TypeError(`${path} must be boolean.`);
  return value;
}

function requireState(
  handle: CRCPhysicsBodyHandle3D,
): PhysicsBodyHandleState3D {
  const state =
    typeof handle === "object" && handle !== null
      ? states.get(handle as object)
      : undefined;
  if (state === undefined || !state.active) {
    throw new TypeError("Expected a live CRC physics 3D body handle.");
  }
  return state;
}

function materializeSignal<Field extends PhysicsBodyHandleField3D>(
  state: PhysicsBodyHandleState3D,
  field: Field,
): WritableSignal<BodyFieldValue3D[Field]> {
  let target = state.signals[field] as
    WritableSignal<BodyFieldValue3D[Field]> | undefined;
  if (target === undefined) {
    const binding = state.binding;
    const current =
      binding === undefined
        ? undefined
        : binding.controller.bodyHandleValues(binding.bodyId);
    target = signal(current?.[field] ?? INITIAL_VALUES_3D[field], {
      debugName: `PhysicsBody3D.${field}`,
    });
    state.signals[field] = target as never;
  }
  return target;
}

function stageLegacyHandle(
  batch: CRCInternalSignalBatch,
  handle: CRCPhysicsBodyHandle3D,
  values: PhysicsBodyHandleValues3D,
  writer: object,
): void {
  for (const field of BODY_FIELDS_3D) {
    const target = handle[field] as WritableSignal<
      BodyFieldValue3D[typeof field]
    >;
    batch.stage(target, values[field], writer);
  }
}

const ZERO_VECTOR_3D = Object.freeze([0, 0, 0] as const);
const IDENTITY_ORIENTATION_3D = Object.freeze([0, 0, 0, 1] as const);

const INITIAL_VALUES_3D: BodyFieldValue3D = Object.freeze({
  position: ZERO_VECTOR_3D,
  orientation: IDENTITY_ORIENTATION_3D,
  linearVelocity: ZERO_VECTOR_3D,
  angularVelocityDegreesPerSecond: ZERO_VECTOR_3D,
  sleeping: false,
  enabled: false,
  generation: 0,
});

const BODY_FIELDS_3D = Object.freeze([
  "position",
  "orientation",
  "linearVelocity",
  "angularVelocityDegreesPerSecond",
  "sleeping",
  "enabled",
  "generation",
] as const);

function freezeVector(value: ArrayLike<number>): CRCPhysicsVector3 {
  return Object.freeze([value[0]!, value[1]!, value[2]!] as const);
}

function freezeQuaternion(value: ArrayLike<number>): CRCPhysicsQuaternion {
  return Object.freeze([value[0]!, value[1]!, value[2]!, value[3]!] as const);
}
