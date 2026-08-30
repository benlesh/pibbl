import type { CRCEventRoot } from '../types.js';
import type { CRCEventNode } from './registrations.js';

interface CRCPointerCaptureState {
  readonly activeCaptures: Map<number, CRCPointerCaptureRecord>;
  readonly pendingTransfers: Map<number, CRCPointerCaptureTransfer>;
  readonly processingTransfers: Set<number>;
  readonly pendingLossOwners: Map<number, CRCEventNode>;
  readonly releaseTransactions: Map<number, CRCPointerReleaseTransaction>;
  nativeReleases: readonly (() => void)[] | undefined;
}

interface CRCPointerCaptureRecord {
  readonly owner: CRCEventNode;
  activated: boolean;
}

interface CRCPointerCaptureTransfer {
  readonly from: CRCEventNode | undefined;
}

interface CRCPointerReleaseTransaction {
  readonly owner: CRCEventNode | undefined;
  readonly requestedBy: CRCEventNode;
  readonly wasActivated: boolean;
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
  const previousTransfer = state.pendingTransfers.get(pointerId);
  const previousPendingOwner = state.pendingLossOwners.get(pointerId);
  const activeOwner = previousTransfer ? previousTransfer.from :
    previousCapture?.activated ? previousCapture.owner : undefined;
  const hadActiveOverride = previousTransfer !== undefined ||
    activeOwner !== undefined;
  const nextTransfer = hadActiveOverride && activeOwner !== target ?
    { from: activeOwner } : undefined;
  const nextCapture: CRCPointerCaptureRecord = nextTransfer ?
    activeOwner ? previousCapture! : { owner: target, activated: false } :
    { owner: target, activated: activeOwner === target };
  state.pendingLossOwners.delete(pointerId);
  eventRoot.pointerCaptures.set(pointerId, target);
  state.activeCaptures.set(pointerId, nextCapture);
  if (nextTransfer) state.pendingTransfers.set(pointerId, nextTransfer);
  else state.pendingTransfers.delete(pointerId);
  try {
    canvas.setPointerCapture(pointerId);
  } catch (error) {
    const operationStillPending =
      eventRoot.pointerCaptures.get(pointerId) === target &&
      state.activeCaptures.get(pointerId) === nextCapture &&
      (nextTransfer ? state.pendingTransfers.get(pointerId) === nextTransfer :
        !state.pendingTransfers.has(pointerId));
    if (operationStillPending) {
      if (previousTarget) {
        eventRoot.pointerCaptures.set(pointerId, previousTarget);
      } else {
        eventRoot.pointerCaptures.delete(pointerId);
      }
      if (previousCapture) {
        state.activeCaptures.set(pointerId, previousCapture);
      } else {
        state.activeCaptures.delete(pointerId);
      }
      if (previousTransfer) {
        state.pendingTransfers.set(pointerId, previousTransfer);
      } else {
        state.pendingTransfers.delete(pointerId);
      }
      if (previousPendingOwner) {
        state.pendingLossOwners.set(pointerId, previousPendingOwner);
      }
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
  const transfer = state.pendingTransfers.get(pointerId);
  const previousPendingOwner = state.pendingLossOwners.get(pointerId);
  const lossOwner = transfer ? transfer.from :
    capture?.activated ? capture.owner : target;
  const transaction: CRCPointerReleaseTransaction = {
    owner: lossOwner,
    requestedBy: target,
    wasActivated: transfer !== undefined || capture?.activated === true,
    gotObserved: false,
    lossObserved: false,
  };
  state.releaseTransactions.set(pointerId, transaction);
  eventRoot.pointerCaptures.delete(pointerId);
  state.activeCaptures.delete(pointerId);
  state.pendingTransfers.delete(pointerId);
  if (lossOwner && isLiveNode(lossOwner)) {
    state.pendingLossOwners.set(pointerId, lossOwner);
  }
  try {
    canvas.releasePointerCapture(pointerId);
  } catch (error) {
    if (state.releaseTransactions.get(pointerId) === transaction) {
      state.releaseTransactions.delete(pointerId);
    }
    if (!transaction.lossObserved && isLiveNode(target)) {
      if (lossOwner && state.pendingLossOwners.get(pointerId) === lossOwner) {
        if (previousPendingOwner) {
          state.pendingLossOwners.set(pointerId, previousPendingOwner);
        } else {
          state.pendingLossOwners.delete(pointerId);
        }
      }
      if (!eventRoot.pointerCaptures.has(pointerId)) {
        eventRoot.pointerCaptures.set(pointerId, target);
        if (capture) state.activeCaptures.set(pointerId, capture);
        if (transfer) state.pendingTransfers.set(pointerId, transfer);
      }
    }
    releaseUnusedNativeOwnership(eventRoot, state);
    throw error;
  }
  if (state.releaseTransactions.get(pointerId) === transaction) {
    state.releaseTransactions.delete(pointerId);
  }
  if (
    !transaction.wasActivated &&
    !transaction.gotObserved &&
    !transaction.lossObserved &&
    lossOwner && state.pendingLossOwners.get(pointerId) === lossOwner &&
    !canvas.hasPointerCapture(pointerId)
  ) {
    state.pendingLossOwners.delete(pointerId);
  }
  releaseUnusedNativeOwnership(eventRoot, state);
}

export function clearPointerCapturesForTarget(target: CRCEventNode): void {
  const eventRoot = target.owner.eventRoot;
  const state = captureStates.get(eventRoot);
  if (!state) return;
  const pointerIds = new Set([
    ...eventRoot.pointerCaptures.keys(),
    ...state.activeCaptures.keys(),
    ...state.pendingTransfers.keys(),
    ...state.pendingLossOwners.keys(),
    ...state.releaseTransactions.keys(),
  ]);
  for (const pointerId of pointerIds) {
    const pending = eventRoot.pointerCaptures.get(pointerId);
    const capture = state.activeCaptures.get(pointerId);
    const transfer = state.pendingTransfers.get(pointerId);
    const transaction = state.releaseTransactions.get(pointerId);
    let releaseNative = false;

    if (pending === target) {
      eventRoot.pointerCaptures.delete(pointerId);
      releaseNative = true;
      if (transfer?.from && transfer.from !== target && isLiveNode(transfer.from)) {
        state.activeCaptures.set(pointerId, {
          owner: transfer.from,
          activated: true,
        });
        state.pendingTransfers.set(pointerId, { from: transfer.from });
        state.pendingLossOwners.set(pointerId, transfer.from);
      } else {
        state.activeCaptures.delete(pointerId);
        state.pendingTransfers.delete(pointerId);
      }
    } else if (capture?.owner === target) {
      if (transfer && pending && isLiveNode(pending)) {
        state.activeCaptures.set(pointerId, {
          owner: pending,
          activated: false,
        });
        state.pendingTransfers.set(pointerId, { from: undefined });
      } else {
        state.activeCaptures.delete(pointerId);
        state.pendingTransfers.delete(pointerId);
      }
    }

    if (state.pendingLossOwners.get(pointerId) === target) {
      state.pendingLossOwners.delete(pointerId);
    }
    if (
      transaction?.owner === target ||
      transaction?.requestedBy === target
    ) {
      state.releaseTransactions.delete(pointerId);
    }
    if (releaseNative) releaseNativeCapture(eventRoot.canvas, pointerId);
  }
  releaseUnusedNativeOwnership(eventRoot, state);
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
  const transfer = state?.pendingTransfers.get(pointerId);
  if (transfer?.from) return undefined;
  const target = getLogicalPointerCapture(eventRoot, pointerId);
  const capture = state?.activeCaptures.get(pointerId);
  if (target && capture?.owner === target) {
    if (capture.activated) return undefined;
    capture.activated = true;
    state?.pendingTransfers.delete(pointerId);
    return target;
  }

  const transaction = state?.releaseTransactions.get(pointerId);
  if (
    transaction &&
    !transaction.wasActivated &&
    transaction.owner &&
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
  const pendingTarget = eventRoot.pointerCaptures.get(pointerId);
  if (!pendingTarget) return;
  eventRoot.pointerCaptures.delete(pointerId);
  const state = getCaptureState(eventRoot);
  const transfer = state.pendingTransfers.get(pointerId);
  const capture = state.activeCaptures.get(pointerId);
  const target = transfer ? transfer.from :
    capture?.activated ? capture.owner : pendingTarget;
  state.activeCaptures.delete(pointerId);
  state.pendingTransfers.delete(pointerId);
  if (target && isLiveNode(target)) {
    state.pendingLossOwners.set(pointerId, target);
  }
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
  const transfer = state?.pendingTransfers.get(pointerId);
  const capture = state?.activeCaptures.get(pointerId);
  const target = transfer ? transfer.from :
    capture?.activated ? capture.owner :
    state?.pendingLossOwners.get(pointerId) ??
    eventRoot.pointerCaptures.get(pointerId);
  eventRoot.pointerCaptures.delete(pointerId);
  state?.activeCaptures.delete(pointerId);
  state?.pendingTransfers.delete(pointerId);
  state?.pendingLossOwners.delete(pointerId);
  if (state) releaseUnusedNativeOwnership(eventRoot, state);
  return target && isLiveNode(target) ? target : undefined;
}

/** Processes one pending logical owner change before a non-capture PointerEvent. */
export function processPendingLogicalPointerCapture(
  eventRoot: CRCEventRoot,
  pointerId: number,
  dispatchLost: (target: CRCEventNode) => void,
  dispatchGot: (target: CRCEventNode) => void,
): void {
  const state = captureStates.get(eventRoot);
  if (
    !state?.pendingTransfers.has(pointerId) ||
    state.processingTransfers.has(pointerId)
  ) {
    return;
  }

  state.processingTransfers.add(pointerId);
  try {
    const transfer = state.pendingTransfers.get(pointerId);
    const previous = transfer?.from;
    const pending = livePendingOwner(eventRoot, pointerId);
    if (previous && previous !== pending && isLiveNode(previous)) {
      dispatchLost(previous);
    }

    const currentTransfer = state.pendingTransfers.get(pointerId);
    if (!currentTransfer) return;
    const next = livePendingOwner(eventRoot, pointerId);
    state.pendingTransfers.delete(pointerId);
    state.pendingLossOwners.delete(pointerId);
    if (!next) {
      state.activeCaptures.delete(pointerId);
      return;
    }

    state.activeCaptures.set(pointerId, { owner: next, activated: true });
    if (next !== currentTransfer.from) dispatchGot(next);
  } finally {
    state.processingTransfers.delete(pointerId);
    releaseUnusedNativeOwnership(eventRoot, state);
  }
}

function getCaptureState(eventRoot: CRCEventRoot): CRCPointerCaptureState {
  let state = captureStates.get(eventRoot);
  if (!state) {
    state = {
      activeCaptures: new Map(),
      pendingTransfers: new Map(),
      processingTransfers: new Set(),
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
    || state.pendingTransfers.size > 0
    || state.processingTransfers.size > 0
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

function livePendingOwner(
  eventRoot: CRCEventRoot,
  pointerId: number,
): CRCEventNode | undefined {
  const target = eventRoot.pointerCaptures.get(pointerId);
  if (!target || isLiveNode(target)) return target;
  eventRoot.pointerCaptures.delete(pointerId);
  return undefined;
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
