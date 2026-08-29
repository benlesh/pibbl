import type { CRCEventRoot } from '../types.js';
import type { CRCEventNode } from './registrations.js';

interface CRCPointerCaptureState {
  readonly activeCaptures: Map<number, CRCPointerCaptureRecord>;
  readonly pendingLossOwners: Map<number, CRCEventNode>;
  readonly releaseTransactions: Map<number, CRCPointerReleaseTransaction>;
  nativeReleases: readonly (() => void)[] | undefined;
}

interface CRCPointerCaptureRecord {
  readonly owner: CRCEventNode;
  activated: boolean;
}

interface CRCPointerReleaseTransaction {
  readonly owner: CRCEventNode;
  gotObserved: boolean;
  lossObserved: boolean;
}

const captureStates = new WeakMap<CRCEventRoot, CRCPointerCaptureState>();

/** @internal Structural ownership evidence for lifecycle tests. */
export function getPointerCaptureStateCounts(eventRoot: CRCEventRoot): {
  readonly activated: number;
  readonly nativeListenerRequests: number;
  readonly pendingLoss: number;
  readonly provisional: number;
  readonly releaseTransactions: number;
} {
  const state = captureStates.get(eventRoot);
  let activated = 0;
  let provisional = 0;
  for (const capture of state?.activeCaptures.values() ?? []) {
    if (capture.activated) activated++;
    else provisional++;
  }
  return {
    activated,
    nativeListenerRequests: state?.nativeReleases?.length ?? 0,
    pendingLoss: state?.pendingLossOwners.size ?? 0,
    provisional,
    releaseTransactions: state?.releaseTransactions.size ?? 0,
  };
}

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
  const previousCapture = state.activeCaptures.get(pointerId);
  const previousPendingOwner = state.pendingLossOwners.get(pointerId);
  const nextCapture: CRCPointerCaptureRecord = {
    owner: target,
    activated: previousCapture?.activated === true &&
      previousCapture.owner === previousTarget,
  };
  state.pendingLossOwners.delete(pointerId);
  eventRoot.pointerCaptures.set(pointerId, target);
  state.activeCaptures.set(pointerId, nextCapture);
  try {
    canvas.setPointerCapture(pointerId);
  } catch (error) {
    if (eventRoot.pointerCaptures.get(pointerId) === target) {
      if (previousTarget) {
        eventRoot.pointerCaptures.set(pointerId, previousTarget);
      } else {
        eventRoot.pointerCaptures.delete(pointerId);
      }
    }
    if (state.activeCaptures.get(pointerId) === nextCapture) {
      if (previousCapture) {
        state.activeCaptures.set(pointerId, previousCapture);
      } else {
        state.activeCaptures.delete(pointerId);
      }
    }
    if (!state.pendingLossOwners.has(pointerId) && previousPendingOwner) {
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
  const capture = state.activeCaptures.get(pointerId);
  const previousPendingOwner = state.pendingLossOwners.get(pointerId);
  const transaction: CRCPointerReleaseTransaction = {
    owner: target,
    gotObserved: false,
    lossObserved: false,
  };
  state.releaseTransactions.set(pointerId, transaction);
  eventRoot.pointerCaptures.delete(pointerId);
  if (capture?.owner === target) state.activeCaptures.delete(pointerId);
  if (isLiveNode(target)) state.pendingLossOwners.set(pointerId, target);
  try {
    canvas.releasePointerCapture(pointerId);
  } catch (error) {
    if (state.releaseTransactions.get(pointerId) === transaction) {
      state.releaseTransactions.delete(pointerId);
    }
    if (!transaction.lossObserved && isLiveNode(target)) {
      if (state.pendingLossOwners.get(pointerId) === target) {
        if (previousPendingOwner) {
          state.pendingLossOwners.set(pointerId, previousPendingOwner);
        } else {
          state.pendingLossOwners.delete(pointerId);
        }
      }
      if (!eventRoot.pointerCaptures.has(pointerId)) {
        eventRoot.pointerCaptures.set(pointerId, target);
        state.activeCaptures.set(pointerId, {
          owner: target,
          activated: capture?.activated === true || transaction.gotObserved,
        });
      }
    }
    releaseUnusedNativeOwnership(eventRoot, state);
    throw error;
  }
  if (state.releaseTransactions.get(pointerId) === transaction) {
    state.releaseTransactions.delete(pointerId);
  }
  if (
    capture?.activated !== true &&
    !transaction.gotObserved &&
    !transaction.lossObserved &&
    state.pendingLossOwners.get(pointerId) === target &&
    !canvas.hasPointerCapture(pointerId)
  ) {
    state.pendingLossOwners.delete(pointerId);
  }
  releaseUnusedNativeOwnership(eventRoot, state);
}

export function clearPointerCapturesForTarget(target: CRCEventNode): void {
  const eventRoot = target.owner.eventRoot;
  const state = captureStates.get(eventRoot);
  for (const [pointerId, owner] of eventRoot.pointerCaptures) {
    if (owner !== target) continue;
    eventRoot.pointerCaptures.delete(pointerId);
    state?.activeCaptures.delete(pointerId);
    state?.pendingLossOwners.delete(pointerId);
    const transaction = state?.releaseTransactions.get(pointerId);
    if (transaction?.owner === target) {
      state?.releaseTransactions.delete(pointerId);
    }
    releaseNativeCapture(eventRoot.canvas, pointerId);
  }
  if (state) {
    for (const [pointerId, owner] of state.pendingLossOwners) {
      if (owner === target) state.pendingLossOwners.delete(pointerId);
    }
    for (const [pointerId, capture] of state.activeCaptures) {
      if (capture.owner === target) state.activeCaptures.delete(pointerId);
    }
    for (const [pointerId, transaction] of state.releaseTransactions) {
      if (transaction.owner === target) {
        state.releaseTransactions.delete(pointerId);
      }
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

/** Records native activation before exposing the logical got callback. */
export function activateLogicalPointerCapture(
  eventRoot: CRCEventRoot,
  pointerId: number,
): CRCEventNode | undefined {
  const state = captureStates.get(eventRoot);
  const target = getLogicalPointerCapture(eventRoot, pointerId);
  const capture = state?.activeCaptures.get(pointerId);
  if (target && capture?.owner === target) {
    capture.activated = true;
    return target;
  }

  const transaction = state?.releaseTransactions.get(pointerId);
  if (
    transaction &&
    state?.pendingLossOwners.get(pointerId) === transaction.owner &&
    isLiveNode(transaction.owner)
  ) {
    transaction.gotObserved = true;
    return transaction.owner;
  }
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
  state.activeCaptures.delete(pointerId);
  if (isLiveNode(target)) state.pendingLossOwners.set(pointerId, target);
  releaseUnusedNativeOwnership(eventRoot, state);
}

/** Removes native-loss state before exposing the logical loss callback. */
export function consumeLogicalPointerCaptureLoss(
  eventRoot: CRCEventRoot,
  pointerId: number,
): CRCEventNode | undefined {
  const state = captureStates.get(eventRoot);
  const transaction = state?.releaseTransactions.get(pointerId);
  if (transaction) transaction.lossObserved = true;
  const target = eventRoot.pointerCaptures.get(pointerId) ??
    state?.pendingLossOwners.get(pointerId);
  eventRoot.pointerCaptures.delete(pointerId);
  state?.activeCaptures.delete(pointerId);
  state?.pendingLossOwners.delete(pointerId);
  if (state) releaseUnusedNativeOwnership(eventRoot, state);
  return target && isLiveNode(target) ? target : undefined;
}

function getCaptureState(eventRoot: CRCEventRoot): CRCPointerCaptureState {
  let state = captureStates.get(eventRoot);
  if (!state) {
    state = {
      activeCaptures: new Map(),
      pendingLossOwners: new Map(),
      releaseTransactions: new Map(),
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
    hub.acquire('gotpointercapture'),
    hub.acquire('lostpointercapture'),
  ]);
}

function releaseUnusedNativeOwnership(
  eventRoot: CRCEventRoot,
  state: CRCPointerCaptureState,
): void {
  if (
    eventRoot.pointerCaptures.size > 0 ||
    state.pendingLossOwners.size > 0 ||
    state.releaseTransactions.size > 0
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
