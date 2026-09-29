import { batch, signal } from '../signals/graph.js';
import { resolveSignalValue } from '../signals/resolve-signal-value.js';
import { requireHookContext, useHookSlot } from '../hooks/hook-slot.js';
import { queueBeginCommand } from '../scheduler/realm-scheduler.js';
import type { CRCEventHandlers, CRCEventTarget, CRCPointerEvent } from '../events/types.js';
import type { CRCComponentRefs, CRCInstance } from '../types.js';
import type { WritableSignal } from '../signals/types.js';
import { solveManipulation } from './solve.js';
import type { CRCResizePosition } from './types.js';
import type { CRCManipulationActive, CRCManipulationCancelReason, CRCManipulationController, CRCManipulationEvent, CRCManipulationGeometry, CRCManipulationOperation, CRCManipulationOptions, CRCManipulationSnapshot } from './controller-types.js';

interface Session {
  operation: CRCManipulationOperation;
  handle?: CRCResizePosition;
  pointerId: number;
  target: CRCEventTarget;
  before: CRCManipulationGeometry;
  last: CRCManipulationGeometry;
  point: DOMPoint;
  clientX: number;
  clientY: number;
  parent: DOMMatrix;
  started: boolean;
  snapshot: CRCManipulationSnapshot;
}
export interface ManipulationState {
  controller: CRCManipulationController;
  options: CRCManipulationOptions;
  alive: boolean;
  root: CRCInstance;
  frame?: CRCComponentRefs<any>;
  parent: DOMMatrix;
  session?: Session;
  active: WritableSignal<CRCManipulationActive | null>;
  snapshot: WritableSignal<CRCManipulationSnapshot | null>;
}
const states = new WeakMap<CRCManipulationController, ManipulationState>();
const owners = new WeakMap<object, ManipulationState>();
export function manipulationState(controller: CRCManipulationController): ManipulationState {
  const state = states.get(controller);
  if (!state || !state.alive) throw new Error('CRC manipulation requires a live useManipulation controller.');
  return state;
}
function geometry(state: ManipulationState): CRCManipulationGeometry {
  return Object.freeze({ box: Object.freeze({ ...state.options.box.get() }), rotation: state.options.rotation?.get() ?? 0 });
}
function same(a: CRCManipulationGeometry, b: CRCManipulationGeometry): boolean {
  return a.rotation === b.rotation && a.box.left === b.box.left && a.box.top === b.box.top && a.box.width === b.box.width && a.box.height === b.box.height;
}
function event(session: Session): CRCManipulationEvent {
  return Object.freeze({ ...session.snapshot, before: session.before, after: session.last });
}
function publish(state: ManipulationState, next: CRCManipulationGeometry): void {
  batch(() => {
    state.options.box.set(next.box);
    if (state.options.rotation) state.options.rotation.set(next.rotation);
  });
}
function release(state: ManipulationState, session: Session): void {
  state.session = undefined;
  if (owners.get(state.options.box) === state) owners.delete(state.options.box);
  if (session.target.hasPointerCapture(session.pointerId)) session.target.releasePointerCapture(session.pointerId);
}
function cancel(state: ManipulationState, reason: CRCManipulationCancelReason): void {
  const session = state.session;
  if (!session) return;
  const restore = same(geometry(state), session.last) && reason !== 'external-change';
  release(state, session);
  batch(() => {
    if (restore && session.started) publish(state, session.before);
    state.active.set(null);
  });
  if (session.started) state.options.onCancel?.(Object.freeze({ ...event(session), after: geometry(state), reason }));
}
function dispose(state: ManipulationState): void {
  if (!state.alive) return;
  state.alive = false;
  const session = state.session;
  if (!session) return;
  release(state, session);
  const options = state.options;
  queueBeginCommand(() => {
    if (!owners.has(options.box) && same(geometry(state), session.last)) publish(state, session.before);
    state.active.set(null);
  });
}
export function useManipulation(options: CRCManipulationOptions): CRCManipulationController {
  const { crcInstance } = requireHookContext();
  const slot = useHookSlot<ManipulationState>('manipulation', teardowns => {
    const state = {
      options, root: crcInstance.eventRoot.rootInstance ?? crcInstance, alive: true, parent: new DOMMatrix(),
      active: signal<CRCManipulationActive | null>(null), snapshot: signal<CRCManipulationSnapshot | null>(null),
    } as ManipulationState;
    const controller: CRCManipulationController = Object.freeze({
      active: state.active.asReadonly(), snapshot: state.snapshot.asReadonly(),
      get frameProps() { return frameProps; },
      cancel() { if (state.alive) cancel(state, 'explicit'); },
    });
    const frameProps = Object.freeze({ controller, style: options.box });
    state.controller = controller;
    states.set(controller, state);
    teardowns.add(() => dispose(state));
    return state;
  });
  const state = slot.value;
  if (options.box !== state.options.box || options.rotation !== state.options.rotation) throw new Error('useManipulation geometry signal identity must remain stable.');
  state.options = options;
  return state.controller;
}
function enabled(state: ManipulationState, operation: CRCManipulationOperation): boolean {
  const options = operation === 'move' ? state.options.move : operation === 'resize' ? state.options.resize : undefined;
  return options !== undefined && resolveSignalValue(options.enabled ?? true);
}
function validateSession(state: ManipulationState): Session | undefined {
  const session = state.session;
  if (!session) return;
  if (!same(geometry(state), session.last)) { cancel(state, 'external-change'); return; }
  if (!enabled(state, session.operation)) { cancel(state, 'disabled'); return; }
  if (['a', 'b', 'c', 'd', 'e', 'f'].some(key => state.parent[key as 'a'] !== session.parent[key as 'a'])) { cancel(state, 'coordinate-space-changed'); return; }
  return session;
}
function apply(state: ManipulationState, pointer: CRCPointerEvent): void {
  const session = validateSession(state);
  if (!session || pointer.pointerId !== session.pointerId) return;
  if (!session.started) {
    if (Math.hypot(pointer.clientX - session.clientX, pointer.clientY - session.clientY) < 3) return;
    session.started = true;
    state.active.set(Object.freeze({ operation: session.operation, handle: session.handle ?? null, pointerId: session.pointerId }));
    state.options.onStart?.(event(session));
    if (validateSession(state) !== session) return;
  }
  const options = state.options;
  const move = options.move && { ...options.move, snap: options.move.snap && { ...options.move.snap, enabled: resolveSignalValue(options.move.snap.enabled ?? true) } };
  const resize = options.resize && { ...options.resize, snap: options.resize.snap && { ...options.resize.snap, enabled: resolveSignalValue(options.resize.snap.enabled ?? true) } };
  const result = solveManipulation({
    operation: session.operation, handle: session.handle, initial: session.before.box,
    initialPoint: session.point, currentPoint: session.parent.inverse().transformPoint(new DOMPoint(pointer.x, pointer.y)),
    modifiers: { shift: pointer.shiftKey, alt: pointer.altKey, ctrl: pointer.ctrlKey, meta: pointer.metaKey }, move, resize,
  });
  const next = Object.freeze({ box: result.applied, rotation: session.before.rotation });
  const changed = !same(next, session.last);
  session.last = next;
  session.snapshot = Object.freeze({ operation: session.operation, handle: session.handle ?? null, initial: session.before, proposed: Object.freeze({ box: result.proposed, rotation: next.rotation }), applied: next, snapActive: result.snapActive, snapSatisfied: result.snapSatisfied });
  batch(() => { if (changed) publish(state, next); state.snapshot.set(session.snapshot); });
  if (validateSession(state) !== session) return;
  if (changed) state.options.onChange?.(event(session));
}
export function manipulationHandlers(controller: CRCManipulationController, operation: CRCManipulationOperation, handle?: CRCResizePosition): CRCEventHandlers {
  const state = manipulationState(controller);
  return {
    onPointerDown(pointer) {
      if (!state.alive || state.session || pointer.defaultPrevented || pointer.button !== 0 || !enabled(state, operation)) return;
      if (owners.has(state.options.box)) throw new Error('CRC manipulation geometry already has an active owner.');
      const before = geometry(state);
      const point = state.parent.inverse().transformPoint(new DOMPoint(pointer.x, pointer.y));
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) throw new Error('CRC manipulation cannot use a singular parent transform.');
      pointer.currentTarget.setPointerCapture(pointer.pointerId);
      if (!pointer.currentTarget.hasPointerCapture(pointer.pointerId)) return;
      const snapshot = Object.freeze({ operation, handle: handle ?? null, initial: before, proposed: before, applied: before, snapActive: false, snapSatisfied: false });
      state.session = { operation, handle, pointerId: pointer.pointerId, target: pointer.currentTarget, before, last: before, point, clientX: pointer.clientX, clientY: pointer.clientY, parent: DOMMatrix.fromMatrix(state.parent), started: false, snapshot };
      owners.set(state.options.box, state);
      pointer.preventDefault();
    },
    onPointerMove(pointer) { apply(state, pointer); },
    onPointerUp(pointer) {
      if (state.session?.pointerId !== pointer.pointerId) return;
      apply(state, pointer);
      const session = state.session;
      if (!session) return;
      release(state, session);
      state.active.set(null);
      if (session.started) state.options.onCommit?.(Object.freeze({ ...event(session), changed: !same(session.before, session.last) }));
    },
    onPointerCancel(pointer) { if (state.session?.pointerId === pointer.pointerId) cancel(state, 'pointer-cancel'); },
    onLostPointerCapture(pointer) { if (state.session?.pointerId === pointer.pointerId) cancel(state, 'capture-lost'); },
    onKeyDown(key) { if (key.key === 'Escape') cancel(state, 'escape'); },
  };
}
