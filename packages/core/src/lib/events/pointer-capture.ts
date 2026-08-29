import type { CRCEventRoot } from '../types.js';
import type { CRCEventNode } from './registrations.js';

interface CRCPointerCaptureState {
  readonly pendingLossOwners: Map<number, CRCEventNode>;
  nativeReleases: readonly (() => void)[] | undefined;
}

const captureStates = new WeakMap<CRCEventRoot, CRCPointerCaptureState>();

export function setLogicalPointerCapture(
  target: CRCEventNode,
  pointerId: number,
): void {
  if (!isLiveNode(target)) return;
  const eventRoot = target.owner.eventRoot;
  const canvas = eventRoot.canvas;
  if (!canvas) return;

  const state = getCaptureState(eventRoot);
  ensureNativeOwnership(eventRoot, state);
  const previousTarget = eventRoot.pointerCaptures.get(pointerId);
  const previousPendingOwner = state.pendingLossOwners.get(pointerId);
  state.pendingLossOwners.delete(pointerId);
  eventRoot.pointerCaptures.set(pointerId, target);
  try {
    canvas.setPointerCapture(pointerId);
  } catch (error) {
    if (previousTarget) eventRoot.pointerCaptures.set(pointerId, previousTarget);
    else eventRoot.pointerCaptures.delete(pointerId);
    if (previousPendingOwner) {
      state.pendingLossOwners.set(pointerId, previousPendingOwner);
    }
    releaseUnusedNativeOwnership(eventRoot, state);
    throw error;
  }
}

export function hasLogicalPointerCapture(
  target: CRCEventNode,
  pointerId: number,
): boolean {
  const eventRoot = target.owner.eventRoot;
  return eventRoot.pointerCaptures.get(pointerId) === target &&
    eventRoot.canvas?.hasPointerCapture(pointerId) === true;
}

export function releaseLogicalPointerCapture(
  target: CRCEventNode,
  pointerId: number,
): void {
  const eventRoot = target.owner.eventRoot;
  if (eventRoot.pointerCaptures.get(pointerId) !== target) return;
  const canvas = eventRoot.canvas;
  if (!canvas) return;

  const state = getCaptureState(eventRoot);
  ensureNativeOwnership(eventRoot, state);
  eventRoot.pointerCaptures.delete(pointerId);
  if (isLiveNode(target)) state.pendingLossOwners.set(pointerId, target);
  try {
    canvas.releasePointerCapture(pointerId);
  } catch (error) {
    state.pendingLossOwners.delete(pointerId);
    eventRoot.pointerCaptures.set(pointerId, target);
    throw error;
  }
  releaseUnusedNativeOwnership(eventRoot, state);
}

export function clearPointerCapturesForTarget(target: CRCEventNode): void {
  const eventRoot = target.owner.eventRoot;
  const state = captureStates.get(eventRoot);
  for (const [pointerId, owner] of eventRoot.pointerCaptures) {
    if (owner !== target) continue;
    eventRoot.pointerCaptures.delete(pointerId);
    state?.pendingLossOwners.delete(pointerId);
    releaseNativeCapture(eventRoot.canvas, pointerId);
  }
  if (state) {
    for (const [pointerId, owner] of state.pendingLossOwners) {
      if (owner === target) state.pendingLossOwners.delete(pointerId);
    }
    releaseUnusedNativeOwnership(eventRoot, state);
  }
}

export function getLogicalPointerCapture(
  eventRoot: CRCEventRoot,
  pointerId: number,
): CRCEventNode | undefined {
  const target = eventRoot.pointerCaptures.get(pointerId);
  if (!target || isLiveNode(target)) return target;
  clearPointerCapturesForTarget(target);
  return undefined;
}

/** Clears active routing while retaining the owner for native loss delivery. */
export function cancelLogicalPointerCapture(
  eventRoot: CRCEventRoot,
  pointerId: number,
): void {
  const target = eventRoot.pointerCaptures.get(pointerId);
  if (!target) return;
  eventRoot.pointerCaptures.delete(pointerId);
  const state = getCaptureState(eventRoot);
  if (isLiveNode(target)) state.pendingLossOwners.set(pointerId, target);
  releaseUnusedNativeOwnership(eventRoot, state);
}

/** Removes native-loss state before exposing the logical loss callback. */
export function consumeLogicalPointerCaptureLoss(
  eventRoot: CRCEventRoot,
  pointerId: number,
): CRCEventNode | undefined {
  const state = captureStates.get(eventRoot);
  const target = eventRoot.pointerCaptures.get(pointerId) ??
    state?.pendingLossOwners.get(pointerId);
  eventRoot.pointerCaptures.delete(pointerId);
  state?.pendingLossOwners.delete(pointerId);
  if (state) releaseUnusedNativeOwnership(eventRoot, state);
  return target && isLiveNode(target) ? target : undefined;
}

function getCaptureState(eventRoot: CRCEventRoot): CRCPointerCaptureState {
  let state = captureStates.get(eventRoot);
  if (!state) {
    state = {
      pendingLossOwners: new Map(),
      nativeReleases: undefined,
    };
    captureStates.set(eventRoot, state);
  }
  return state;
}

function ensureNativeOwnership(
  eventRoot: CRCEventRoot,
  state: CRCPointerCaptureState,
): void {
  if (state.nativeReleases) return;
  const hub = eventRoot.nativeListeners;
  if (!hub) return;
  state.nativeReleases = Object.freeze([
    hub.acquire('pointercancel'),
    hub.acquire('lostpointercapture'),
  ]);
}

function releaseUnusedNativeOwnership(
  eventRoot: CRCEventRoot,
  state: CRCPointerCaptureState,
): void {
  if (
    eventRoot.pointerCaptures.size > 0 ||
    state.pendingLossOwners.size > 0
  ) {
    return;
  }
  const releases = state.nativeReleases;
  state.nativeReleases = undefined;
  if (releases) {
    for (const release of releases) release();
  }
  captureStates.delete(eventRoot);
}

function releaseNativeCapture(
  canvas: HTMLCanvasElement | undefined,
  pointerId: number,
): void {
  if (!canvas) return;
  try {
    if (canvas.hasPointerCapture(pointerId)) {
      canvas.releasePointerCapture(pointerId);
    }
  } catch {
    // Native pointer lifetime may already have ended; logical teardown still
    // must synchronously remove the dead owner.
  }
}

function isLiveNode(target: CRCEventNode): boolean {
  return target.live && !target.owner.mainTeardowns.closed;
}
