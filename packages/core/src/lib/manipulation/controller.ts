import {
  batch,
  signal,
  isSignal,
  untracked,
  assertSignalCommandAllowed,
  assertDirectSignalWriteAllowed,
} from "../signals/graph.js";
import { resolveSignalValue } from "../signals/resolve-signal-value.js";
import { requireHookContext, useHookSlot } from "../hooks/hook-slot.js";
import { queueBeginCommand } from "../scheduler/realm-scheduler.js";
import type {
  PibblEventHandlers,
  PibblEventTarget,
  PibblPointerEvent,
  PibblKeyboardEvent,
} from "../events/types.js";
import type { PibblComponentRefs, PibblInstance } from "../types.js";
import type { WritableSignal } from "../signals/types.js";
import {
  observeGestureInputs,
  claimGeometryGeneration,
  restoreReleasedGesture,
} from "./ownership.js";
import { suppressManipulationActivation } from "../events/dispatch.js";
import { solveManipulation } from "./solve.js";
import {
  currentRootCoordinateMapping,
  sameRootCoordinateMapping,
} from "./coordinates.js";
import type { PibblResizePosition } from "./types.js";
import type {
  PibblManipulationActive,
  PibblManipulationCancelReason,
  PibblManipulationController,
  PibblManipulationEvent,
  PibblManipulationGeometry,
  PibblManipulationOperation,
  PibblManipulationOptions,
  PibblManipulationSnapshot,
} from "./controller-types.js";

type PointerSample = Pick<
  PibblPointerEvent,
  | "pointerId"
  | "x"
  | "y"
  | "clientX"
  | "clientY"
  | "shiftKey"
  | "altKey"
  | "ctrlKey"
  | "metaKey"
>;
interface Session {
  operation: PibblManipulationOperation;
  handle?: PibblResizePosition;
  pointerId: number;
  target: PibblEventTarget;
  before: PibblManipulationGeometry;
  last: PibblManipulationGeometry;
  point: DOMPoint;
  clientX: number;
  clientY: number;
  parent: DOMMatrix;
  started: boolean;
  angle: number;
  rotationDelta: number;
  snapshot: PibblManipulationSnapshot;
  coordinateMapping: readonly number[];
  source?: object;
  releaseObservation?: () => void;
  sample?: PointerSample;
}
export interface ManipulationState {
  controller: PibblManipulationController;
  options: PibblManipulationOptions;
  alive: boolean;
  root: PibblInstance;
  frame?: PibblComponentRefs<any>;
  parent: DOMMatrix;
  coordinateMapping?: readonly number[];
  session?: Session;
  active: WritableSignal<PibblManipulationActive | null>;
  snapshot: WritableSignal<PibblManipulationSnapshot | null>;
}
const states = new WeakMap<PibblManipulationController, ManipulationState>();
const owners = new WeakMap<object, ManipulationState>();
const claimedPresses = new WeakSet<Event>();
export function manipulationState(
  controller: PibblManipulationController,
): ManipulationState {
  const state = states.get(controller);
  if (!state || !state.alive)
    throw new Error(
      "Pibbl manipulation requires a live useManipulation controller.",
    );
  return state;
}
function geometry(state: ManipulationState): PibblManipulationGeometry {
  return untracked(() =>
    Object.freeze({
      box: Object.freeze({ ...state.options.box.get() }),
      rotation: state.options.rotation?.get() ?? 0,
    }),
  );
}
function same(a: PibblManipulationGeometry, b: PibblManipulationGeometry): boolean {
  return (
    a.rotation === b.rotation &&
    a.box.left === b.box.left &&
    a.box.top === b.box.top &&
    a.box.width === b.box.width &&
    a.box.height === b.box.height
  );
}
function event(session: Session): PibblManipulationEvent {
  return Object.freeze({
    ...session.snapshot,
    before: session.before,
    after: session.last,
  });
}
function publish(
  state: ManipulationState,
  next: PibblManipulationGeometry,
): void {
  assertDirectSignalWriteAllowed(state.options.box);
  if (state.options.rotation)
    assertDirectSignalWriteAllowed(state.options.rotation);
  batch(() => {
    state.options.box.set(next.box);
    if (state.options.rotation) state.options.rotation.set(next.rotation);
  });
}
function release(state: ManipulationState, session: Session): void {
  if (state.session !== session) return;
  state.session = undefined;
  session.releaseObservation?.();
  session.releaseObservation = undefined;
  if (state.options.rotation && owners.get(state.options.rotation) === state)
    owners.delete(state.options.rotation);
  if (owners.get(state.options.box) === state) owners.delete(state.options.box);
  if (session.target.hasPointerCapture(session.pointerId))
    session.target.releasePointerCapture(session.pointerId);
}
function cancel(
  state: ManipulationState,
  reason: PibblManipulationCancelReason,
): void {
  const session = state.session;
  if (!session) return;
  const restore =
    same(geometry(state), session.last) && reason !== "external-change";
  release(state, session);
  batch(() => {
    if (restore && session.started) publish(state, session.before);
    state.active.set(null);
  });
  if (session.started)
    state.options.onCancel?.(
      Object.freeze({ ...event(session), after: geometry(state), reason }),
    );
}
/** Release capture synchronously; rollback can defer under renderer write guards. */
export function detachManipulationFrame(state: ManipulationState): void {
  const session = state.session;
  if (!session) return;
  const restore = same(geometry(state), session.last);
  release(state, session);
  restoreReleasedGesture({
    box: state.options.box,
    rotation: state.options.rotation,
    before: restore ? session.before : geometry(state),
    active: state.active,
  });
}
function dispose(state: ManipulationState): void {
  if (!state.alive) return;
  state.alive = false;
  detachManipulationFrame(state);
}
/**
 * Creates a mount-owned controller for moving, resizing, and rotating declared geometry.
 *
 * @param options - Target state, enabled operations, constraints, and lifecycle callbacks. See
 * {@link PibblManipulationOptions} .
 * @returns Stable controls and state for the mounted manipulation interaction. See
 * {@link PibblManipulationController} .
 *
 * @see {@link PibblManipulationOptions}
 * @see {@link PibblManipulationController}
 */
export function useManipulation(
  options: PibblManipulationOptions,
): PibblManipulationController {
  const { pibblInstance } = requireHookContext();
  const slot = useHookSlot<ManipulationState>("manipulation", (teardowns) => {
    const state = {
      options,
      root: pibblInstance.eventRoot.rootInstance ?? pibblInstance,
      alive: true,
      parent: new DOMMatrix(),
      active: signal<PibblManipulationActive | null>(null),
      snapshot: signal<PibblManipulationSnapshot | null>(null),
    } as ManipulationState;
    const controller: PibblManipulationController = Object.freeze({
      active: state.active.asReadonly(),
      snapshot: state.snapshot.asReadonly(),
      get frameProps() {
        return frameProps;
      },
      cancel() {
        if (state.alive) {
          assertSignalCommandAllowed();
          cancel(state, "explicit");
        }
      },
    });
    const frameProps = Object.freeze({ controller, style: options.box });
    state.controller = controller;
    states.set(controller, state);
    teardowns.add(() => dispose(state));
    return state;
  });
  const state = slot.value;
  if (options.rotate && !options.rotation)
    throw new Error(
      "useManipulation rotate requires a writable rotation signal in radians.",
    );
  if (
    options.box !== state.options.box ||
    options.rotation !== state.options.rotation
  )
    throw new Error(
      "useManipulation geometry signal identity must remain stable.",
    );
  state.options = options;
  if (state.session && !enabled(state, state.session.operation)) {
    const session = state.session;
    queueBeginCommand(() => {
      if (state.alive && state.session === session) cancel(state, "disabled");
    });
  }
  return state.controller;
}
function enabled(
  state: ManipulationState,
  operation: PibblManipulationOperation,
): boolean {
  const options =
    operation === "move"
      ? state.options.move
      : operation === "resize"
        ? state.options.resize
        : state.options.rotate;
  return options !== undefined && resolveSignalValue(options.enabled ?? true);
}
function validateSession(state: ManipulationState): Session | undefined {
  const session = state.session;
  if (!session) return;
  if (!same(geometry(state), session.last)) {
    cancel(state, "external-change");
    return;
  }
  if (!enabled(state, session.operation)) {
    cancel(state, "disabled");
    return;
  }
  if (
    !sameRootCoordinateMapping(
      session.coordinateMapping,
      currentRootCoordinateMapping(state.root),
    ) ||
    (state.coordinateMapping !== undefined &&
      !sameRootCoordinateMapping(
        session.coordinateMapping,
        state.coordinateMapping,
      ))
  ) {
    cancel(state, "coordinate-space-changed");
    return;
  }
  if (
    ["a", "b", "c", "d", "e", "f"].some(
      (key) =>
        Math.abs(state.parent[key as "a"] - session.parent[key as "a"]) >
        1e-10 *
          Math.max(
            1,
            Math.abs(state.parent[key as "a"]),
            Math.abs(session.parent[key as "a"]),
          ),
    )
  ) {
    cancel(state, "coordinate-space-changed");
    return;
  }
  return session;
}
function resolvedOptions(state: ManipulationState) {
  const options = state.options;
  const move = options.move && {
    ...options.move,
    snap: options.move.snap && {
      ...options.move.snap,
      enabled: resolveSignalValue(options.move.snap.enabled ?? true),
    },
  };
  const resize = options.resize && {
    ...options.resize,
    snap: options.resize.snap && {
      ...options.resize.snap,
      enabled: resolveSignalValue(options.resize.snap.enabled ?? true),
    },
  };
  const rotate = options.rotate && {
    ...options.rotate,
    snap: options.rotate.snap && {
      ...options.rotate.snap,
      enabled: resolveSignalValue(options.rotate.snap.enabled ?? true),
    },
  };
  return { move, resize, rotate };
}
function apply(state: ManipulationState, pointer: PointerSample): void {
  const session = validateSession(state);
  if (!session || pointer.pointerId !== session.pointerId) return;
  session.sample = {
    pointerId: pointer.pointerId,
    x: pointer.x,
    y: pointer.y,
    clientX: pointer.clientX,
    clientY: pointer.clientY,
    shiftKey: pointer.shiftKey,
    altKey: pointer.altKey,
    ctrlKey: pointer.ctrlKey,
    metaKey: pointer.metaKey,
  };
  if (!session.started) {
    if (
      Math.hypot(
        pointer.clientX - session.clientX,
        pointer.clientY - session.clientY,
      ) < 3
    )
      return;
    session.started = true;
    suppressManipulationActivation(state.root, session.pointerId);
    state.active.set(
      Object.freeze({
        operation: session.operation,
        handle: session.handle ?? null,
        pointerId: session.pointerId,
      }),
    );
    state.options.onStart?.(event(session));
    if (validateSession(state) !== session) return;
  }
  const { move, resize, rotate } = resolvedOptions(state);
  const currentPoint = session.parent
    .inverse()
    .transformPoint(new DOMPoint(pointer.x, pointer.y));
  if (session.operation === "rotate") {
    const centerX = session.before.box.left + session.before.box.width / 2;
    const centerY = session.before.box.top + session.before.box.height / 2;
    if (currentPoint.x !== centerX || currentPoint.y !== centerY) {
      const angle = Math.atan2(
        currentPoint.y - centerY,
        currentPoint.x - centerX,
      );
      const delta = angle - session.angle;
      session.rotationDelta += Math.atan2(Math.sin(delta), Math.cos(delta));
      session.angle = angle;
    }
  }
  let result: ReturnType<typeof solveManipulation>;
  try {
    result = solveManipulation({
      operation: session.operation,
      handle: session.handle,
      initial: session.before.box,
      initialPoint: session.point,
      currentPoint,
      initialRotation: session.before.rotation,
      rotationDelta: session.rotationDelta,
      modifiers: {
        shift: pointer.shiftKey,
        alt: pointer.altKey,
        ctrl: pointer.ctrlKey,
        meta: pointer.metaKey,
      },
      move,
      resize,
      rotate,
    });
  } catch {
    // Options can change after activation; the original preview still belongs
    // to this gesture and must be restored through the normal terminal path.
    cancel(state, "constraints-unsatisfiable");
    return;
  }
  const next = Object.freeze({
    box: result.applied,
    rotation: result.appliedRotation,
  });
  const changed = !same(next, session.last);
  session.last = next;
  session.snapshot = Object.freeze({
    operation: session.operation,
    handle: session.handle ?? null,
    initial: session.before,
    proposed: Object.freeze({
      box: result.proposed,
      rotation: result.proposedRotation,
    }),
    applied: next,
    snapActive: result.snapActive,
    snapSatisfied: result.snapSatisfied,
  });
  batch(() => {
    if (changed) publish(state, next);
    state.snapshot.set(session.snapshot);
  });
  if (validateSession(state) !== session) return;
  if (changed) state.options.onChange?.(event(session));
}
function applySafely(state: ManipulationState, pointer: PointerSample): void {
  try {
    apply(state, pointer);
  } catch (error) {
    try {
      cancel(state, "explicit");
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        "Manipulation callback and cleanup failed.",
        { cause: cleanupError },
      );
    }
    throw error;
  }
}
function updateModifiers(
  state: ManipulationState,
  key: PibblKeyboardEvent,
): void {
  const sample = state.session?.sample;
  if (!sample || !["Shift", "Alt", "Control", "Meta"].includes(key.key)) return;
  applySafely(state, {
    ...sample,
    shiftKey: key.shiftKey,
    altKey: key.altKey,
    ctrlKey: key.ctrlKey,
    metaKey: key.metaKey,
  });
}

/** @internal Identifies one private handle source for readout presentation. */
export function isManipulationSourceActive(
  controller: PibblManipulationController,
  source: object,
): boolean {
  const state = manipulationState(controller);
  return state.session?.started === true && state.session.source === source;
}

export function manipulationHandlers(
  controller: PibblManipulationController,
  operation: PibblManipulationOperation,
  handle?: PibblResizePosition,
  source?: object,
): PibblEventHandlers {
  const state = manipulationState(controller);
  return {
    onPointerDown(pointer) {
      if (
        !state.alive ||
        state.session ||
        pointer.defaultPrevented ||
        claimedPresses.has(pointer.originalEvent) ||
        pointer.button !== 0 ||
        !enabled(state, operation)
      )
        return;
      if (
        owners.has(state.options.box) ||
        (state.options.rotation && owners.has(state.options.rotation))
      )
        throw new Error(
          "Pibbl manipulation geometry already has an active owner.",
        );
      const before = geometry(state);
      const point = state.parent
        .inverse()
        .transformPoint(new DOMPoint(pointer.x, pointer.y));
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y))
        throw new Error(
          "Pibbl manipulation cannot use a singular parent transform.",
        );
      assertDirectSignalWriteAllowed(state.options.box);
      if (state.options.rotation)
        assertDirectSignalWriteAllowed(state.options.rotation);
      const resolved = resolvedOptions(state);
      if (
        operation === "resize" &&
        resolved.resize?.snap?.target === "grid" &&
        (Math.abs(state.parent.b) > 1e-10 || Math.abs(state.parent.c) > 1e-10)
      ) {
        throw new Error(
          "Grid resize snapping requires an aligned parent coordinate mapping.",
        );
      }
      solveManipulation({
        operation,
        handle,
        initial: before.box,
        initialRotation: before.rotation,
        initialPoint: point,
        currentPoint: point,
        modifiers: {},
        ...resolved,
      });
      pointer.currentTarget.setPointerCapture(pointer.pointerId);
      if (!pointer.currentTarget.hasPointerCapture(pointer.pointerId)) return;
      const snapshot = Object.freeze({
        operation,
        handle: handle ?? null,
        initial: before,
        proposed: before,
        applied: before,
        snapActive: false,
        snapSatisfied: false,
      });
      state.session = {
        operation,
        handle,
        pointerId: pointer.pointerId,
        target: pointer.currentTarget,
        before,
        last: before,
        point,
        clientX: pointer.clientX,
        clientY: pointer.clientY,
        parent: DOMMatrix.fromMatrix(state.parent),
        started: false,
        angle: Math.atan2(
          point.y - before.box.top - before.box.height / 2,
          point.x - before.box.left - before.box.width / 2,
        ),
        rotationDelta: 0,
        snapshot,
        coordinateMapping: currentRootCoordinateMapping(state.root),
        source,
      };
      owners.set(state.options.box, state);
      if (state.options.rotation) owners.set(state.options.rotation, state);
      claimGeometryGeneration(state.options.box, state.options.rotation);
      const operationOptions =
        operation === "move"
          ? state.options.move
          : operation === "resize"
            ? state.options.resize
            : state.options.rotate;
      const values: unknown[] = [
        state.options.box,
        state.options.rotation,
        operationOptions?.enabled,
      ];
      const inputs = values.filter(isSignal);
      state.session.releaseObservation = observeGestureInputs(inputs, () => {
        validateSession(state);
      });
      claimedPresses.add(pointer.originalEvent);
    },
    onPointerMove(pointer) {
      applySafely(state, pointer);
    },
    onPointerUp(pointer) {
      if (state.session?.pointerId !== pointer.pointerId) return;
      applySafely(state, pointer);
      const session = state.session;
      if (!session) return;
      release(state, session);
      state.active.set(null);
      if (session.started)
        state.options.onCommit?.(
          Object.freeze({
            ...event(session),
            changed: !same(session.before, session.last),
          }),
        );
    },
    onPointerCancel(pointer) {
      if (state.session?.pointerId === pointer.pointerId)
        cancel(state, "pointer-cancel");
    },
    onLostPointerCapture(pointer) {
      if (state.session?.pointerId === pointer.pointerId)
        cancel(state, "capture-lost");
    },
    onKeyUp(key) {
      updateModifiers(state, key);
    },
    onKeyDown(key) {
      if (key.key === "Escape") cancel(state, "escape");
      else updateModifiers(state, key);
    },
  };
}
