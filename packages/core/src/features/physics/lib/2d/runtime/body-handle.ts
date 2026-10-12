import { signal, type WritableSignal } from "@pibbl/core";
import {
  pibblInternalCurrentSimulationOwner,
  pibblInternalQueueSimulationBegin,
  useInternalHookSlot,
  type PibblInternalSignalBatch,
  type PibblInternalSimulationOwner,
} from "@pibbl/core/internal";
import type {
  PibblPhysicsPose2D,
  PibblPhysicsVector2,
} from "../../../2d-geometry.js";
import type { PibblPhysicsBodyHandle2D } from "../types.js";
import type { PhysicsBodyCommand2D } from "../world/world.js";
import {
  copyFiniteVector2,
  requireFiniteNumber,
} from "../../shared/validation.js";
import type { PhysicsWorld2DController } from "./controller.js";

export type PhysicsBodyHandleField2D =
  | "position"
  | "rotationDegrees"
  | "linearVelocity"
  | "angularVelocityDegreesPerSecond"
  | "sleeping"
  | "enabled"
  | "generation";

export interface PhysicsBodyHandleBinding2D {
  readonly controller: PhysicsWorld2DController;
  readonly bodyId: number;
  readonly bindingGeneration: number;
}

interface PhysicsBodyHandleState2D {
  readonly owner: PibblInternalSimulationOwner;
  readonly signals: Partial<{
    [Field in PhysicsBodyHandleField2D]: WritableSignal<
      BodyFieldValue2D[Field]
    >;
  }>;
  binding: PhysicsBodyHandleBinding2D | undefined;
  nextBindingGeneration: number;
  active: boolean;
}

interface BodyFieldValue2D {
  readonly position: PibblPhysicsVector2;
  readonly rotationDegrees: number;
  readonly linearVelocity: PibblPhysicsVector2;
  readonly angularVelocityDegreesPerSecond: number;
  readonly sleeping: boolean;
  readonly enabled: boolean;
  readonly generation: number;
}

export interface PhysicsBodyHandleValues2D extends BodyFieldValue2D {}

const states = new WeakMap<object, PhysicsBodyHandleState2D>();
const externalBindings = new WeakMap<
  object,
  {
    binding: PhysicsBodyHandleBinding2D | undefined;
    nextBindingGeneration: number;
  }
>();

/**
 * Returns one stable, component-owned 2D body endpoint for this hook slot.
 *
 * @returns A stable body handle that can be attached to a physics body. See
 * {@link PibblPhysicsBodyHandle2D} .
 *
 * @see {@link PibblPhysicsBodyHandle2D}
 */
export function pibblPhysicsBody2D(): PibblPhysicsBodyHandle2D {
  const owner = pibblInternalCurrentSimulationOwner();
  const slot = useInternalHookSlot("physicsBody2DHandle", (teardowns) => {
    const handle = createPhysicsBodyHandle2D(owner);
    teardowns.add(() => disposePhysicsBodyHandle2D(handle));
    return handle;
  });
  return slot.value;
}

/**
 * Queues a force on a body, optionally at a world point and with wake-up control.
 *
 * @param body - Body receiving the force. See {@link PibblPhysicsBodyHandle2D}.
 * @param force - Force vector in the world's public coordinate system. See
 * {@link PibblPhysicsVector2} .
 * @param options - Optional application point and wake policy. See {@link PibblPhysicsVector2}.
 *
 * @see {@link PibblPhysicsBodyHandle2D}
 * @see {@link PibblPhysicsVector2}
 */
export function applyForce2D(
  body: PibblPhysicsBodyHandle2D,
  force: PibblPhysicsVector2,
  options: Readonly<{ at?: PibblPhysicsVector2; wake?: boolean }> = {},
): void {
  const copied = copyFiniteVector2(force, "force");
  const point =
    options.at === undefined
      ? undefined
      : copyFiniteVector2(options.at, "options.at");
  queueBodyCommand(body, {
    kind: "apply-force",
    bodyId: 0,
    forceX: copied[0],
    forceY: copied[1],
    pointX: point?.[0],
    pointY: point?.[1],
    wake: requireBoolean(options.wake ?? true, "options.wake"),
  });
}

/**
 * Queues an instantaneous momentum change, optionally at a world point and with wake-up control.
 *
 * @param body - Body receiving the impulse. See {@link PibblPhysicsBodyHandle2D}.
 * @param impulse - Impulse vector in the world's public coordinate system. See
 * {@link PibblPhysicsVector2} .
 * @param options - Optional application point and wake policy. See {@link PibblPhysicsVector2}.
 *
 * @see {@link PibblPhysicsBodyHandle2D}
 * @see {@link PibblPhysicsVector2}
 */
export function applyImpulse2D(
  body: PibblPhysicsBodyHandle2D,
  impulse: PibblPhysicsVector2,
  options: Readonly<{ at?: PibblPhysicsVector2; wake?: boolean }> = {},
): void {
  const copied = copyFiniteVector2(impulse, "impulse");
  const point =
    options.at === undefined
      ? undefined
      : copyFiniteVector2(options.at, "options.at");
  queueBodyCommand(body, {
    kind: "apply-impulse",
    bodyId: 0,
    impulseX: copied[0],
    impulseY: copied[1],
    pointX: point?.[0],
    pointY: point?.[1],
    wake: requireBoolean(options.wake ?? true, "options.wake"),
  });
}

/**
 * Queues torque on a dynamic body through the shared scheduler.
 *
 * @param body - Body receiving the torque. See {@link PibblPhysicsBodyHandle2D}.
 * @param torque - Torque to apply in the world's public units.
 *
 * @see {@link PibblPhysicsBodyHandle2D}
 */
export function applyTorque2D(
  body: PibblPhysicsBodyHandle2D,
  torque: number,
): void {
  queueBodyCommand(body, {
    kind: "apply-torque",
    bodyId: 0,
    torque: requireFiniteNumber(torque, "torque"),
  });
}

/**
 * Queues a body's linear velocity in physics units per second.
 *
 * @param body - Body whose linear velocity changes. See {@link PibblPhysicsBodyHandle2D}.
 * @param velocity - Velocity vector in public distance units per second. See
 * {@link PibblPhysicsVector2} .
 *
 * @see {@link PibblPhysicsBodyHandle2D}
 * @see {@link PibblPhysicsVector2}
 */
export function setLinearVelocity2D(
  body: PibblPhysicsBodyHandle2D,
  velocity: PibblPhysicsVector2,
): void {
  const copied = copyFiniteVector2(velocity, "velocity");
  queueBodyCommand(body, {
    kind: "set-linear-velocity",
    bodyId: 0,
    linearVelocityX: copied[0],
    linearVelocityY: copied[1],
  });
}

/**
 * Queues a body's angular velocity in degrees per second.
 *
 * @param body - Body whose angular velocity changes. See {@link PibblPhysicsBodyHandle2D}.
 * @param degreesPerSecond - Angular speed in degrees per second.
 *
 * @see {@link PibblPhysicsBodyHandle2D}
 */
export function setAngularVelocity2D(
  body: PibblPhysicsBodyHandle2D,
  degreesPerSecond: number,
): void {
  queueBodyCommand(body, {
    kind: "set-angular-velocity",
    bodyId: 0,
    angularVelocityDegrees: requireFiniteNumber(
      degreesPerSecond,
      "degreesPerSecond",
    ),
  });
}

/**
 * Queues an immediate pose change for a body at the next admitted simulation command phase.
 *
 * @param body - Body to reposition. See {@link PibblPhysicsBodyHandle2D}.
 * @param pose - Destination position and rotation in public coordinates. See
 * {@link PibblPhysicsPose2D} .
 *
 * @see {@link PibblPhysicsBodyHandle2D}
 * @see {@link PibblPhysicsPose2D}
 */
export function teleportBody2D(
  body: PibblPhysicsBodyHandle2D,
  pose: PibblPhysicsPose2D,
): void {
  queueBodyCommand(body, {
    kind: "set-pose",
    bodyId: 0,
    pose: Object.freeze({
      position: copyFiniteVector2(pose.position, "pose.position"),
      rotationDegrees: requireFiniteNumber(
        pose.rotationDegrees,
        "pose.rotationDegrees",
      ),
    }),
  });
}

/**
 * Queues a request to wake a sleeping body.
 *
 * @param body - Body to wake. See {@link PibblPhysicsBodyHandle2D}.
 *
 * @see {@link PibblPhysicsBodyHandle2D}
 */
export function wakeBody2D(body: PibblPhysicsBodyHandle2D): void {
  queueBodyCommand(body, { kind: "wake", bodyId: 0 });
}

/**
 * Queues a request to put a body to sleep.
 *
 * @param body - Body to put to sleep. See {@link PibblPhysicsBodyHandle2D}.
 *
 * @see {@link PibblPhysicsBodyHandle2D}
 */
export function sleepBody2D(body: PibblPhysicsBodyHandle2D): void {
  queueBodyCommand(body, { kind: "sleep", bodyId: 0 });
}

/**
 * Queues re-enabling a body with the requested velocity-preservation policy.
 *
 * @param body - Body to re-enable. See {@link PibblPhysicsBodyHandle2D}.
 * @param options - Whether to zero or preserve velocity when enabling.
 *
 * @see {@link PibblPhysicsBodyHandle2D}
 */
export function enableBody2D(
  body: PibblPhysicsBodyHandle2D,
  options: Readonly<{ velocity?: "zero" | "preserve" }> = {},
): void {
  const velocity = options.velocity ?? "zero";
  if (velocity !== "zero" && velocity !== "preserve") {
    throw new TypeError('options.velocity must be "zero" or "preserve".');
  }
  queueBodyCommand(body, { kind: "enable", bodyId: 0, velocity });
}

/**
 * Queues removal of a body's active participation in the simulation.
 *
 * @param body - Body to disable. See {@link PibblPhysicsBodyHandle2D}.
 *
 * @see {@link PibblPhysicsBodyHandle2D}
 */
export function disableBody2D(body: PibblPhysicsBodyHandle2D): void {
  queueBodyCommand(body, { kind: "disable", bodyId: 0 });
}

export function createPhysicsBodyHandle2D(
  owner: PibblInternalSimulationOwner,
): PibblPhysicsBodyHandle2D {
  const target = {} as Record<PropertyKey, unknown>;
  const state: PhysicsBodyHandleState2D = {
    owner,
    signals: {},
    binding: undefined,
    nextBindingGeneration: 0,
    active: true,
  };
  for (const field of BODY_FIELDS_2D) {
    Object.defineProperty(target, field, {
      enumerable: true,
      get: () => materializeSignal(state, field).asReadonly(),
    });
  }
  const handle = Object.freeze(target) as unknown as PibblPhysicsBodyHandle2D;
  states.set(handle, state);
  return handle;
}

export function bindPhysicsBodyHandle2D(
  handle: PibblPhysicsBodyHandle2D,
  controller: PhysicsWorld2DController,
  bodyId: number,
): number {
  const state = states.get(handle as object);
  if (state === undefined) {
    if (typeof handle !== "object" || handle === null) {
      throw new TypeError("Expected a live Pibbl physics 2D body handle.");
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
        "A Pibbl physics 2D body handle may bind to at most one live body.",
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
      "A Pibbl physics 2D body handle may bind to at most one live body.",
    );
  }
  const bindingGeneration = ++state.nextBindingGeneration;
  state.binding = Object.freeze({ controller, bodyId, bindingGeneration });
  return bindingGeneration;
}

export function unbindPhysicsBodyHandle2D(
  handle: PibblPhysicsBodyHandle2D,
  controller: PhysicsWorld2DController,
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

export function physicsBodyHandleBinding2D(
  handle: PibblPhysicsBodyHandle2D,
): PhysicsBodyHandleBinding2D | undefined {
  return (
    states.get(handle as object)?.binding ??
    externalBindings.get(handle as object)?.binding
  );
}

export function isPhysicsBodyHandle2D(
  value: unknown,
): value is PibblPhysicsBodyHandle2D {
  return (
    typeof value === "object" &&
    value !== null &&
    (states.has(value) || externalBindings.has(value))
  );
}

export function physicsBodyHandleOwner2D(
  handle: PibblPhysicsBodyHandle2D,
): PibblInternalSimulationOwner {
  return requireState(handle).owner;
}

export function stagePhysicsBodyHandle2D(
  batch: PibblInternalSignalBatch,
  handle: PibblPhysicsBodyHandle2D,
  values: PhysicsBodyHandleValues2D,
  writer: object,
): void {
  const state = states.get(handle as object);
  if (state === undefined) {
    stageLegacyHandle(batch, handle, values, writer);
    return;
  }
  for (const field of BODY_FIELDS_2D) {
    const target = state.signals[field] as
      WritableSignal<BodyFieldValue2D[typeof field]> | undefined;
    if (target !== undefined) batch.stage(target, values[field], writer);
  }
}

export function snapshotPhysicsBodyHandle2DForTest(
  handle: PibblPhysicsBodyHandle2D,
): Readonly<{
  readonly bound: boolean;
  readonly bindingGeneration: number;
  readonly materializedFields: readonly PhysicsBodyHandleField2D[];
}> {
  const state = requireState(handle);
  return Object.freeze({
    bound: state.binding !== undefined,
    bindingGeneration: state.binding?.bindingGeneration ?? 0,
    materializedFields: Object.freeze(
      BODY_FIELDS_2D.filter((field) => state.signals[field] !== undefined),
    ),
  });
}

function disposePhysicsBodyHandle2D(handle: PibblPhysicsBodyHandle2D): void {
  const state = states.get(handle as object);
  if (state === undefined || !state.active) return;
  state.active = false;
  state.binding = undefined;
}

function queueBodyCommand(
  handle: PibblPhysicsBodyHandle2D,
  command: PhysicsBodyCommand2D,
): void {
  const state = requireState(handle);
  const captured = state.binding;
  pibblInternalQueueSimulationBegin(state.owner, () => {
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
        }) as PhysicsBodyCommand2D,
      )
    ) {
      traceStaleCommand(command.kind, current.bindingGeneration);
    }
  });
}

function traceStaleCommand(
  kind: PhysicsBodyCommand2D["kind"],
  generation: number,
): void {
  const runtime = globalThis as typeof globalThis & {
    readonly process?: Readonly<{
      readonly env?: Readonly<{ readonly NODE_ENV?: string }>;
    }>;
  };
  if (runtime.process?.env?.NODE_ENV === "production") return;
  console.warn(
    `[Pibbl physics] Ignored stale ${kind} command for body handle generation ${String(generation)}.`,
  );
}

function requireBoolean(value: boolean, path: string): boolean {
  if (typeof value !== "boolean")
    throw new TypeError(`${path} must be boolean.`);
  return value;
}

function requireState(
  handle: PibblPhysicsBodyHandle2D,
): PhysicsBodyHandleState2D {
  const state =
    typeof handle === "object" && handle !== null
      ? states.get(handle as object)
      : undefined;
  if (state === undefined || !state.active) {
    throw new TypeError("Expected a live Pibbl physics 2D body handle.");
  }
  return state;
}

function materializeSignal<Field extends PhysicsBodyHandleField2D>(
  state: PhysicsBodyHandleState2D,
  field: Field,
): WritableSignal<BodyFieldValue2D[Field]> {
  let target = state.signals[field] as
    WritableSignal<BodyFieldValue2D[Field]> | undefined;
  if (target === undefined) {
    const binding = state.binding;
    const current =
      binding === undefined
        ? undefined
        : binding.controller.bodyHandleValues(binding.bodyId);
    target = signal(current?.[field] ?? INITIAL_VALUES_2D[field], {
      debugName: `PhysicsBody2D.${field}`,
    });
    state.signals[field] = target as never;
  }
  return target;
}

function stageLegacyHandle(
  batch: PibblInternalSignalBatch,
  handle: PibblPhysicsBodyHandle2D,
  values: PhysicsBodyHandleValues2D,
  writer: object,
): void {
  for (const field of BODY_FIELDS_2D) {
    const target = handle[field] as WritableSignal<
      BodyFieldValue2D[typeof field]
    >;
    batch.stage(target, values[field], writer);
  }
}

const ZERO_VECTOR_2D = Object.freeze([0, 0] as const);

const INITIAL_VALUES_2D: BodyFieldValue2D = Object.freeze({
  position: ZERO_VECTOR_2D,
  rotationDegrees: 0,
  linearVelocity: ZERO_VECTOR_2D,
  angularVelocityDegreesPerSecond: 0,
  sleeping: false,
  enabled: false,
  generation: 0,
});

const BODY_FIELDS_2D = Object.freeze([
  "position",
  "rotationDegrees",
  "linearVelocity",
  "angularVelocityDegreesPerSecond",
  "sleeping",
  "enabled",
  "generation",
] as const);
