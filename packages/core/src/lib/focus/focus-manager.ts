import type { CRCEventTargetRegistration } from '../events/registrations.js';
import { GLOBAL_STATE } from '../global-state.js';
import type {
  CRCEvent,
  CRCEventType,
  CRCKeyboardEvent,
} from '../events/types.js';
import { Teardowns } from '../teardowns.js';
import type {
  CRCEventRoot,
  CRCFocusPressDefaultInput,
  CRCFocusTouchDefaultContact,
  CRCFocusTouchDefaultInput,
  CRCFocusPolicyBridge,
  CRCInstance,
  CRCRenderTransaction,
} from '../types.js';
import { resolveTargetRootBounds } from './geometry.js';
import {
  mountDOMFocusHost,
  type CRCMountedDOMFocusHost,
} from './dom-focus-host.js';
import {
  applyDirectionalNavigationDefault,
  applyKeyboardActivationDefault,
  applyTabDefault,
} from './keyboard-defaults.js';
import { transitionLogicalFocus } from './focus-events.js';
import type {
  CRCDirectionalBoundary,
  CRCFocusCandidate,
} from './types.js';

const UNFOCUSED_SNAPSHOT = Object.freeze({
  isFocused: false,
  isFocusVisible: false,
});

const retainedDirectionalBoundaries = new WeakMap<
  CRCEventTargetRegistration,
  DirectionalBoundary
>();
const coordinators = new WeakMap<CRCEventRoot, FocusManagerCoordinator>();
const managerOwners = new WeakMap<CRCFocusManager, CRCInstance>();

interface PendingCandidate {
  readonly target: CRCEventTargetRegistration;
  readonly directionalBoundary: DirectionalBoundary | undefined;
}

interface PendingFrame {
  readonly targets: PendingCandidate[];
  readonly observedTargets: Set<CRCEventTargetRegistration>;
  readonly ineligibleTargets: Set<CRCEventTargetRegistration>;
  readonly boundaries: Set<DirectionalBoundary>;
}

interface RepresentedPress {
  readonly x: number;
  readonly y: number;
  readonly timeStamp: number;
}

interface RepresentedPointerPress extends RepresentedPress {
  suppressMouse: boolean;
  suppressTouch: boolean;
}

const COMPATIBILITY_PRESS_WINDOW_MS = 1_500;

class DirectionalBoundary implements CRCDirectionalBoundary {
  private committedCandidates: readonly CRCFocusCandidate[] = Object.freeze([]);

  constructor(readonly owner: CRCInstance) {}

  get candidates(): readonly CRCFocusCandidate[] {
    return this.committedCandidates;
  }

  commit(candidates: readonly CRCFocusCandidate[]): void {
    this.committedCandidates = candidates;
  }
}

interface FocusTransactionState {
  readonly prior: CRCFocusManager | undefined;
  readonly replayedManagers: Set<CRCFocusManager>;
  prepared: CRCFocusManager | undefined;
  claimed: CRCFocusManager | undefined;
  finished: boolean;
  restored: CRCFocusManager | undefined;
}

class FocusManagerCoordinator {
  private readonly managers = new Set<CRCFocusManager>();
  private readonly transactions = new WeakMap<
    CRCRenderTransaction,
    FocusTransactionState
  >();
  private active: CRCFocusManager | undefined;
  private domFocusHost: CRCMountedDOMFocusHost | undefined;
  private domFocusHostTeardowns: Teardowns | undefined;
  private disposed = false;

  constructor(private readonly eventRoot: CRCEventRoot) {
    eventRoot.rootInstance?.mainTeardowns.add(() => this.dispose());
  }

  add(manager: CRCFocusManager): void {
    if (this.disposed) {
      throw new Error('CRC focus manager root is disposed.');
    }
    this.ensureDOMFocusHost();
    this.managers.add(manager);
    const transaction = this.eventRoot.renderTransaction;
    if (transaction) {
      const state = this.stateFor(transaction);
      state.prepared = manager;
      // Reconciliation mounts every descriptor before declaration-order entry.
      // Expose that transaction-local manager so a same-element directional
      // descriptor can enter first without making the claim permanent.
      this.eventRoot.focusPolicy = manager;
    }
  }

  claim(manager: CRCFocusManager): void {
    const transaction = this.eventRoot.renderTransaction;
    if (!transaction) {
      if (this.active && this.active !== manager) {
        throw duplicateManagerError();
      }
      this.setActive(manager);
      return;
    }

    const state = this.stateFor(transaction);
    if (state.claimed && state.claimed !== manager) {
      throw duplicateManagerError();
    }
    state.claimed = manager;
    this.eventRoot.focusPolicy = manager;
  }

  beforeNativeDispatch(
    type: CRCEventType,
    event: Event,
  ): CRCFocusManager | undefined {
    const manager = this.active;
    const routeLogicalEvent = this.domFocusHost?.beforeNativeDispatch(
      type,
      event,
    ) ?? true;
    return routeLogicalEvent && manager && !manager.isDestroyed ?
      manager : undefined;
  }

  syncDOMFocusHost(manager: CRCFocusManager): void {
    if (this.active === manager) {
      this.domFocusHost?.syncCandidateAvailability(
        manager.candidates.length > 0,
      );
    }
  }

  focusCanvasFromPress(manager: CRCFocusManager): void {
    if (this.active === manager) this.domFocusHost?.focusFromPress();
  }

  claimRetainedManagers(instance: CRCInstance): readonly CRCFocusManager[] {
    const retained = Array.from(this.managers).filter(manager => {
      const owner = managerOwners.get(manager);
      return !manager.isDestroyed &&
        !manager.ownerWasReleased &&
        owner !== undefined &&
        isInstanceWithin(owner, instance);
    });
    const transaction = this.eventRoot.renderTransaction;
    if (!transaction) {
      for (const manager of retained) this.claim(manager);
      return retained;
    }

    const state = this.stateFor(transaction);
    for (const manager of retained) {
      if (state.replayedManagers.has(manager)) continue;
      state.replayedManagers.add(manager);
      this.claim(manager);
    }
    return retained;
  }

  release(manager: CRCFocusManager): void {
    if (manager.isDestroyed) return;
    manager.markOwnerReleased();
    const transaction = this.eventRoot.renderTransaction;
    if (transaction) {
      const state = this.stateFor(transaction);
      if (!state.finished) return;
    }
    if (this.active === manager) {
      this.setActive(undefined);
    }
    this.destroy(manager);
  }

  private stateFor(transaction: CRCRenderTransaction): FocusTransactionState {
    const existing = this.transactions.get(transaction);
    if (existing) return existing;
    const state: FocusTransactionState = {
      prior: this.active,
      replayedManagers: new Set(),
      prepared: undefined,
      claimed: undefined,
      finished: false,
      restored: undefined,
    };
    this.transactions.set(transaction, state);
    transaction.onFinish(success => this.finishTransaction(state, success));
    return state;
  }

  private finishTransaction(
    state: FocusTransactionState,
    success: boolean,
  ): void {
    if (state.finished) return;
    state.finished = true;
    if (success) {
      if (state.claimed) {
        this.active = state.claimed;
      } else if (this.active?.ownerWasReleased) {
        this.active = undefined;
      }
      this.eventRoot.focusPolicy = this.active;
      for (const manager of Array.from(this.managers)) {
        if (manager !== this.active && manager.ownerWasReleased) {
          this.destroy(manager);
        }
      }
      this.domFocusHost?.setManager(this.active);
      return;
    }

    const attemptedReplacement =
      (state.claimed && state.claimed !== state.prior) ||
      (state.prepared && state.prepared !== state.prior);
    const restored = state.prior && attemptedReplacement &&
        !state.prior.isDestroyed ?
      state.prior : undefined;
    state.restored = restored;
    this.active = restored;
    this.eventRoot.focusPolicy = restored;
    for (const manager of Array.from(this.managers)) {
      if (manager !== restored) this.destroy(manager);
    }
    this.domFocusHost?.setManager(restored);
  }

  private destroy(manager: CRCFocusManager): void {
    this.managers.delete(manager);
    manager.destroyFromCoordinator();
    if (this.managers.size === 0) this.disposeDOMFocusHost();
  }

  private ensureDOMFocusHost(): void {
    if (this.domFocusHost) return;
    const canvas = this.eventRoot.canvas;
    if (!canvas) {
      throw new Error(
        'withFocusManagement requires an HTMLCanvasElement root; an OffscreenCanvas has no DOM focus host.',
      );
    }
    const teardowns = new Teardowns();
    try {
      this.domFocusHost = mountDOMFocusHost(
        canvas,
        this.eventRoot,
        teardowns,
      );
      this.domFocusHostTeardowns = teardowns;
    } catch (error) {
      teardowns.execute();
      throw error;
    }
  }

  private disposeDOMFocusHost(): void {
    this.domFocusHost = undefined;
    this.domFocusHostTeardowns?.execute();
    this.domFocusHostTeardowns = undefined;
  }

  private setActive(manager: CRCFocusManager | undefined): void {
    this.active = manager;
    this.eventRoot.focusPolicy = manager;
    this.domFocusHost?.setManager(manager);
  }

  private dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.active = undefined;
    this.eventRoot.focusPolicy = undefined;
    for (const manager of Array.from(this.managers)) this.destroy(manager);
    this.disposeDOMFocusHost();
  }
}

export class CRCFocusManager implements CRCFocusPolicyBridge {
  private committedCandidates: readonly CRCFocusCandidate[] = Object.freeze([]);
  private committedBoundaries = new Set<DirectionalBoundary>();
  private pending: PendingFrame | undefined;
  private directionalStack: DirectionalBoundary[] = [];
  private focusedTarget: CRCEventTargetRegistration | undefined;
  private focusVisible = false;
  private pendingSpaceTarget: CRCEventTargetRegistration | undefined;
  private pendingPressFocus:
    { readonly target: CRCEventTargetRegistration | undefined } | undefined;
  private readonly representedPointerPresses = new Map<
    number,
    RepresentedPointerPress
  >();
  private readonly representedTouchContacts = new Map<number, RepresentedPress>();
  private activeTouchIdentifiers = new Set<number>();
  private primaryTouchIdentifier: number | undefined;
  private touchSequenceActive = false;
  private touchMouseCompatibility: RepresentedPress | undefined;
  private focusRenderRevision = 0;
  private readonly layerFocusRenderRevisions = new WeakMap<CRCInstance, number>();
  private destroyed = false;
  private ownerReleased = false;
  private readonly coordinator: FocusManagerCoordinator;

  constructor(
    private readonly eventRoot: CRCEventRoot,
    owner: CRCInstance,
  ) {
    const canvas = eventRoot.canvas;
    if (!canvas) {
      throw new Error(
        'withFocusManagement requires an HTMLCanvasElement root; an OffscreenCanvas has no DOM focus host.',
      );
    }
    managerOwners.set(this, owner);
    this.coordinator = getCoordinator(eventRoot);
    try {
      this.coordinator.add(this);
    } catch (error) {
      managerOwners.delete(this);
      throw error;
    }
  }

  get candidates(): readonly CRCFocusCandidate[] {
    return this.committedCandidates;
  }

  get isDestroyed(): boolean {
    return this.destroyed;
  }

  get ownerWasReleased(): boolean {
    return this.ownerReleased;
  }

  get canvas(): HTMLCanvasElement {
    const canvas = this.eventRoot.canvas;
    if (!canvas) throw new Error('CRC focus manager has no DOM Canvas host.');
    return canvas;
  }

  get logicalFocusTarget(): CRCEventTargetRegistration | undefined {
    return this.focusedTarget;
  }

  get logicalFocusVisible(): boolean {
    return this.focusVisible;
  }

  beginCollection(): void {
    this.assertLive();
    if (this.pending) {
      throw new Error('withFocusManagement cannot enter twice on one CRC root.');
    }
    this.coordinator.claim(this);
    this.pending = {
      targets: [],
      observedTargets: new Set(),
      ineligibleTargets: new Set(),
      boundaries: new Set(this.directionalStack),
    };
  }

  finishCollection(success: boolean): void {
    const pending = this.pending;
    this.pending = undefined;
    if (!pending || !success || this.destroyed) return;

    const candidates = Object.freeze(pending.targets.map((observed, sourceIndex) =>
      Object.freeze({
        target: observed.target,
        sourceIndex,
        directionalBoundary: observed.directionalBoundary,
        rootBounds: resolveTargetRootBounds(observed.target),
      }) satisfies CRCFocusCandidate
    ));
    this.commitCandidates(candidates, pending.boundaries);
    for (const candidate of candidates) {
      if (candidate.directionalBoundary) {
        retainedDirectionalBoundaries.set(
          candidate.target,
          asDirectionalBoundary(candidate.directionalBoundary),
        );
      } else {
        retainedDirectionalBoundaries.delete(candidate.target);
      }
    }
  }

  observeTarget(target: CRCEventTargetRegistration): void {
    const pending = this.pending;
    if (!pending) return;
    if (this.pendingSpaceTarget === target && !target.handlers.click) {
      this.cancelSpaceActivation();
    }
    if (!isKeyboardFocusable(target)) {
      this.markPendingIneligible(target);
      return;
    }
    pending.ineligibleTargets.delete(target);
    this.recordPendingTarget(target, this.currentDirectionalBoundary());
  }

  removeTarget(target: CRCEventTargetRegistration): void {
    if (this.pendingSpaceTarget === target) this.cancelSpaceActivation();
    if (this.pending) {
      this.markPendingIneligible(target);
      return;
    }
    if (!this.committedCandidates.some(candidate => candidate.target === target)) {
      if (this.focusedTarget === target) this.clearFocusState();
      return;
    }
    this.commitRemovedTarget(target);
  }

  snapshot(target: CRCEventTargetRegistration) {
    if (
      this.ownerReleased ||
      this.pending?.ineligibleTargets.has(target) ||
      target !== this.focusedTarget
    ) {
      return UNFOCUSED_SNAPSHOT;
    }
    return Object.freeze({
      isFocused: true,
      isFocusVisible: this.focusVisible,
    });
  }

  resolveKeyboardTarget(): CRCEventTargetRegistration | undefined {
    const target = this.focusedTarget;
    if (target && this.pending?.ineligibleTargets.has(target)) return undefined;
    return target && this.committedCandidates.some(
      candidate => candidate.target === target,
    ) ? target : undefined;
  }

  afterDispatch(event: CRCEvent): void {
    if (event.type === 'keydown') {
      applyTabDefault(this, event as CRCKeyboardEvent);
    }
    if (event.type === 'keydown' || event.type === 'keyup') {
      applyKeyboardActivationDefault(this, event as CRCKeyboardEvent);
    }
    if (event.type === 'keydown') {
      applyDirectionalNavigationDefault(this, event as CRCKeyboardEvent);
    }
  }

  afterPressDispatch(input: CRCFocusPressDefaultInput): void {
    if (this.destroyed) return;
    this.purgeExpiredPresses(input.originalEvent.timeStamp);
    switch (input.source) {
      case 'pointer':
        this.recordPointerPress(input);
        if (!pressWasPrevented(input)) this.applyPressFocus(input.target);
        return;
      case 'mouse':
        if (this.consumeRepresentedMousePress(input)) return;
        if (!pressWasPrevented(input)) this.applyPressFocus(input.target);
        return;
      case 'touch':
        if (this.consumeRepresentedTouchPress(input)) return;
        this.recordTouchFallback(input);
        if (!pressWasPrevented(input)) this.applyPressFocus(input.target);
        return;
    }
  }

  afterTouchDispatch(input: CRCFocusTouchDefaultInput): void {
    if (this.destroyed) return;
    this.purgeExpiredPresses(input.originalEvent.timeStamp);
    this.reconcileTouchContacts(input);
    if (input.type === 'touchstart') {
      const primary = this.recordTouchStarts(input);
      if (!primary) return;
      this.afterPressDispatch({
        source: 'touch',
        target: primary.target,
        event: undefined,
        originalEvent: input.originalEvent,
        x: primary.x,
        y: primary.y,
        touchIdentifier: primary.identifier,
      });
      return;
    }
    if (input.type === 'touchend' || input.type === 'touchcancel') {
      this.recordTouchTerminals(input);
    }
  }

  beforeNativeDispatch(
    type: CRCEventType,
    event: Event,
  ): CRCFocusManager | undefined {
    return this.coordinator.beforeNativeDispatch(type, event);
  }

  enterDOMFocus(backwards: boolean): void {
    if (this.destroyed) return;
    const pendingPress = this.pendingPressFocus;
    if (pendingPress) {
      this.pendingPressFocus = undefined;
      transitionLogicalFocus(
        this,
        this.liveFocusCandidate(pendingPress.target),
        'pointer',
      );
      return;
    }
    const candidate = backwards ?
      this.committedCandidates.at(-1) :
      this.committedCandidates[0];
    transitionLogicalFocus(this, candidate?.target, 'keyboard');
  }

  leaveDOMFocus(): void {
    if (this.destroyed) return;
    this.pendingPressFocus = undefined;
    transitionLogicalFocus(this, undefined, 'keyboard');
  }

  activateDOMHost(): void {
    if (!this.destroyed) this.coordinator.syncDOMFocusHost(this);
  }

  replayRetainedSubtree(instance: CRCInstance): void {
    const retainedManagers = this.coordinator.claimRetainedManagers(instance);
    const replayManager = retainedManagers.length === 1 ?
      retainedManagers[0] : this;
    replayManager.replayRetainedTargets(instance);
  }

  layerFocusRenderRevision(instance: CRCInstance): number | undefined {
    return this.layerFocusRenderRevisions.get(instance);
  }

  private replayRetainedTargets(instance: CRCInstance): void {
    const targets: CRCEventTargetRegistration[] = [];
    collectRetainedTargets(instance, targets, new Set());
    if (this.pending) {
      for (const target of targets) {
        if (!isKeyboardFocusable(target)) {
          this.markPendingIneligible(target);
          continue;
        }
        const retainedBoundary = retainedDirectionalBoundaries.get(target);
        const directionalBoundary = retainedBoundary &&
            isInstanceWithin(retainedBoundary.owner, instance) ?
          retainedBoundary : this.currentDirectionalBoundary();
        if (directionalBoundary) {
          this.pending.boundaries.add(directionalBoundary);
        }
        this.recordPendingTarget(target, directionalBoundary);
      }
      return;
    }

    const replayed = new Set(targets);
    if (!this.committedCandidates.some(candidate => replayed.has(candidate.target))) {
      return;
    }
    const candidates = Object.freeze(this.committedCandidates.map(candidate =>
      replayed.has(candidate.target) ? Object.freeze({
        ...candidate,
        rootBounds: resolveTargetRootBounds(candidate.target),
      }) : candidate
    ));
    this.commitCandidates(candidates, this.committedBoundaries);
  }

  setFocusState(
    target: CRCEventTargetRegistration | undefined,
    focusVisible: boolean,
  ): void {
    if (
      target &&
      !this.committedCandidates.some(candidate => candidate.target === target)
    ) {
      throw new Error('CRC logical focus target is not a live focus candidate.');
    }
    this.commitLogicalFocus(target, focusVisible);
  }

  liveFocusCandidate(
    target: CRCEventTargetRegistration | undefined,
  ): CRCEventTargetRegistration | undefined {
    return target?.live && target.owner.eventRoot === this.eventRoot &&
        this.committedCandidates.some(candidate => candidate.target === target) ?
      target : undefined;
  }

  commitLogicalFocus(
    target: CRCEventTargetRegistration | undefined,
    focusVisible: boolean,
  ): void {
    const nextFocusVisible = Boolean(target && focusVisible);
    if (
      target === this.focusedTarget &&
      nextFocusVisible === this.focusVisible
    ) {
      return;
    }
    const previous = this.focusedTarget;
    if (this.focusedTarget !== target) this.cancelSpaceActivation();
    this.focusedTarget = target;
    this.focusVisible = nextFocusVisible;
    const revision = ++this.focusRenderRevision;
    this.markFocusRenderLayers(previous, revision);
    this.markFocusRenderLayers(target, revision);
  }

  enterDirectionalBoundary(boundary: CRCDirectionalBoundary): void {
    const value = asDirectionalBoundary(boundary);
    this.directionalStack.push(value);
    this.pending?.boundaries.add(value);
  }

  exitDirectionalBoundary(boundary: CRCDirectionalBoundary): void {
    const value = asDirectionalBoundary(boundary);
    if (this.directionalStack.at(-1) !== value) {
      throw new Error('CRC directional boundary scope exited out of order.');
    }
    this.directionalStack.pop();
  }

  private currentDirectionalBoundary(): DirectionalBoundary | undefined {
    return this.directionalStack.at(-1);
  }

  private markFocusRenderLayers(
    target: CRCEventTargetRegistration | undefined,
    revision: number,
  ): void {
    let instance = target?.owner;
    while (instance && instance !== this.eventRoot.rootInstance) {
      this.layerFocusRenderRevisions.set(instance, revision);
      instance = instance.parent ?
        GLOBAL_STATE.crcInstances.get(instance.parent) : undefined;
    }
  }

  dispose(): void {
    if (this.ownerReleased || this.destroyed) return;
    this.coordinator.release(this);
  }

  markOwnerReleased(): void {
    this.ownerReleased = true;
  }

  destroyFromCoordinator(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    managerOwners.delete(this);
    this.pending = undefined;
    this.directionalStack = [];
    this.pendingPressFocus = undefined;
    this.cancelSpaceActivation();
    this.representedPointerPresses.clear();
    this.representedTouchContacts.clear();
    this.activeTouchIdentifiers.clear();
    this.primaryTouchIdentifier = undefined;
    this.touchSequenceActive = false;
    this.touchMouseCompatibility = undefined;
    for (const boundary of this.committedBoundaries) {
      boundary.commit(Object.freeze([]));
    }
    this.committedBoundaries.clear();
    this.committedCandidates = Object.freeze([]);
    this.clearFocusState();
  }

  private recordPendingTarget(
    target: CRCEventTargetRegistration,
    directionalBoundary: DirectionalBoundary | undefined,
  ): void {
    const pending = this.pending;
    if (!pending || pending.observedTargets.has(target)) return;
    pending.observedTargets.add(target);
    pending.targets.push({ target, directionalBoundary });
  }

  private markPendingIneligible(target: CRCEventTargetRegistration): void {
    const pending = this.pending;
    if (!pending) return;
    pending.ineligibleTargets.add(target);
    if (!pending.observedTargets.delete(target)) return;
    for (let index = pending.targets.length - 1; index >= 0; index--) {
      if (pending.targets[index].target === target) {
        pending.targets.splice(index, 1);
      }
    }
  }

  private commitCandidates(
    candidates: readonly CRCFocusCandidate[],
    boundaries: ReadonlySet<DirectionalBoundary>,
  ): void {
    const pendingByBoundary = new Map<
      DirectionalBoundary,
      CRCFocusCandidate[]
    >();
    for (const boundary of boundaries) pendingByBoundary.set(boundary, []);
    for (const candidate of candidates) {
      if (candidate.directionalBoundary instanceof DirectionalBoundary) {
        pendingByBoundary.get(candidate.directionalBoundary)?.push(candidate);
      }
    }

    // Freeze every replacement before exposing any one of them. Candidate
    // collection failures therefore leave every committed direct list intact.
    const committedByBoundary = new Map<
      DirectionalBoundary,
      readonly CRCFocusCandidate[]
    >();
    for (const [boundary, directCandidates] of pendingByBoundary) {
      committedByBoundary.set(boundary, Object.freeze(directCandidates));
    }

    for (const boundary of this.committedBoundaries) {
      if (!committedByBoundary.has(boundary)) {
        boundary.commit(Object.freeze([]));
      }
    }
    for (const [boundary, directCandidates] of committedByBoundary) {
      boundary.commit(directCandidates);
    }
    this.committedBoundaries = new Set(committedByBoundary.keys());
    this.committedCandidates = candidates;
    if (
      this.focusedTarget &&
      !candidates.some(candidate => candidate.target === this.focusedTarget)
    ) {
      this.clearFocusState();
    }
    this.activateDOMHost();
  }

  private commitRemovedTarget(target: CRCEventTargetRegistration): void {
    const retained = this.committedCandidates.filter(
      candidate => candidate.target !== target,
    );
    const candidates = Object.freeze(retained.map((candidate, sourceIndex) =>
      Object.freeze({ ...candidate, sourceIndex })
    ));
    this.commitCandidates(candidates, this.committedBoundaries);
  }

  private clearFocusState(): void {
    this.cancelSpaceActivation();
    this.focusedTarget = undefined;
    this.focusVisible = false;
  }

  private applyPressFocus(
    requestedTarget: CRCEventTargetRegistration | undefined,
  ): void {
    const target = this.liveFocusCandidate(requestedTarget);
    const pending = { target };
    this.pendingPressFocus = pending;
    try {
      this.coordinator.focusCanvasFromPress(this);
      if (
        this.pendingPressFocus !== pending ||
        this.destroyed ||
        this.canvas.ownerDocument.activeElement !== this.canvas
      ) {
        return;
      }
      this.pendingPressFocus = undefined;
      transitionLogicalFocus(this, this.liveFocusCandidate(target), 'pointer');
    } finally {
      if (this.pendingPressFocus === pending) this.pendingPressFocus = undefined;
    }
  }

  beginSpaceActivation(target: CRCEventTargetRegistration): void {
    this.pendingSpaceTarget = target;
  }

  hasPendingSpaceActivation(
    target: CRCEventTargetRegistration | undefined,
  ): boolean {
    return Boolean(target && this.pendingSpaceTarget === target);
  }

  consumeSpaceActivation(): CRCEventTargetRegistration | undefined {
    const target = this.pendingSpaceTarget;
    this.pendingSpaceTarget = undefined;
    return target;
  }

  cancelSpaceActivation(): void {
    this.pendingSpaceTarget = undefined;
  }

  private recordPointerPress(input: CRCFocusPressDefaultInput): void {
    if (input.pointerId === undefined) return;
    this.representedPointerPresses.set(input.pointerId, {
      x: input.x,
      y: input.y,
      timeStamp: input.originalEvent.timeStamp,
      suppressMouse: true,
      suppressTouch: input.pointerType === 'touch',
    });
  }

  private consumeRepresentedMousePress(
    input: CRCFocusPressDefaultInput,
  ): boolean {
    for (const [pointerId, press] of this.representedPointerPresses) {
      if (!press.suppressMouse || !samePress(press, input)) continue;
      press.suppressMouse = false;
      if (!press.suppressTouch) this.representedPointerPresses.delete(pointerId);
      return true;
    }
    if (
      this.touchMouseCompatibility &&
      samePress(this.touchMouseCompatibility, input)
    ) {
      this.touchMouseCompatibility = undefined;
      return true;
    }
    return false;
  }

  private consumeRepresentedTouchPress(
    input: CRCFocusPressDefaultInput,
  ): boolean {
    const identifier = input.touchIdentifier;
    if (identifier === undefined) return false;
    const existing = this.representedTouchContacts.get(identifier);
    if (existing && samePress(existing, input)) return true;
    this.representedTouchContacts.set(identifier, pressRecord(input));

    for (const [pointerId, press] of this.representedPointerPresses) {
      if (!press.suppressTouch || !samePress(press, input)) continue;
      press.suppressTouch = false;
      if (!press.suppressMouse) this.representedPointerPresses.delete(pointerId);
      return true;
    }
    return false;
  }

  private recordTouchFallback(input: CRCFocusPressDefaultInput): void {
    this.touchMouseCompatibility = pressRecord(input);
  }

  private recordTouchStarts(
    input: CRCFocusTouchDefaultInput,
  ): CRCFocusTouchDefaultContact | undefined {
    let primary: CRCFocusTouchDefaultContact | undefined;
    for (const contact of input.changedContacts) {
      if (this.activeTouchIdentifiers.has(contact.identifier)) continue;
      if (!this.touchSequenceActive) {
        this.touchSequenceActive = true;
        this.primaryTouchIdentifier = contact.identifier;
      }
      if (contact.identifier === this.primaryTouchIdentifier) primary = contact;
      this.activeTouchIdentifiers.add(contact.identifier);
    }
    return primary;
  }

  private reconcileTouchContacts(input: CRCFocusTouchDefaultInput): void {
    const activeIdentifiers = new Set(input.activeIdentifiers);
    for (const identifier of this.activeTouchIdentifiers) {
      if (activeIdentifiers.has(identifier)) continue;
      this.activeTouchIdentifiers.delete(identifier);
      this.representedTouchContacts.delete(identifier);
    }

    const startingIdentifiers = input.type === 'touchstart' ? new Set(
      input.changedContacts.map(contact => contact.identifier),
    ) : undefined;
    for (const identifier of activeIdentifiers) {
      if (!startingIdentifiers?.has(identifier)) {
        this.activeTouchIdentifiers.add(identifier);
      }
    }

    if (this.activeTouchIdentifiers.size > 0) {
      this.touchSequenceActive = true;
      return;
    }
    this.touchSequenceActive = false;
    this.primaryTouchIdentifier = undefined;
    this.representedTouchContacts.clear();
  }

  private recordTouchTerminals(input: CRCFocusTouchDefaultInput): void {
    for (const contact of input.changedContacts) {
      this.activeTouchIdentifiers.delete(contact.identifier);
      this.representedTouchContacts.delete(contact.identifier);
    }
    if (this.activeTouchIdentifiers.size > 0) return;
    this.touchSequenceActive = false;
    this.primaryTouchIdentifier = undefined;
    this.representedTouchContacts.clear();
  }

  private purgeExpiredPresses(timeStamp: number): void {
    for (const [pointerId, press] of this.representedPointerPresses) {
      if (!recentPress(press, timeStamp)) {
        this.representedPointerPresses.delete(pointerId);
      }
    }
    for (const [identifier, press] of this.representedTouchContacts) {
      if (!recentPress(press, timeStamp)) {
        this.representedTouchContacts.delete(identifier);
      }
    }
    if (
      this.touchMouseCompatibility &&
      !recentPress(this.touchMouseCompatibility, timeStamp)
    ) {
      this.touchMouseCompatibility = undefined;
    }
  }

  private assertLive(): void {
    if (this.destroyed) throw new Error('CRC focus manager is disposed.');
  }

}

function pressWasPrevented(input: CRCFocusPressDefaultInput): boolean {
  return input.event?.defaultPrevented ?? input.originalEvent.defaultPrevented;
}

function pressRecord(input: CRCFocusPressDefaultInput): RepresentedPress {
  return {
    x: input.x,
    y: input.y,
    timeStamp: input.originalEvent.timeStamp,
  };
}

function samePress(
  press: RepresentedPress,
  input: CRCFocusPressDefaultInput,
): boolean {
  return recentPress(press, input.originalEvent.timeStamp) &&
    Math.abs(press.x - input.x) <= 1 &&
    Math.abs(press.y - input.y) <= 1;
}

function recentPress(press: RepresentedPress, timeStamp: number): boolean {
  const elapsed = timeStamp - press.timeStamp;
  return elapsed >= 0 && elapsed <= COMPATIBILITY_PRESS_WINDOW_MS;
}

export function createFocusManager(
  eventRoot: CRCEventRoot,
  owner: CRCInstance,
): CRCFocusManager {
  return new CRCFocusManager(eventRoot, owner);
}

export function requireFocusManager(eventRoot: CRCEventRoot): CRCFocusManager {
  const manager = eventRoot.focusPolicy;
  if (!(manager instanceof CRCFocusManager)) {
    throw new Error(
      'withKeyboardNavigation requires an active withFocusManagement focus manager.',
    );
  }
  return manager;
}

export function createDirectionalBoundary(
  owner: CRCInstance,
): CRCDirectionalBoundary {
  return new DirectionalBoundary(owner);
}

function getCoordinator(eventRoot: CRCEventRoot): FocusManagerCoordinator {
  let coordinator = coordinators.get(eventRoot);
  if (!coordinator) {
    coordinator = new FocusManagerCoordinator(eventRoot);
    coordinators.set(eventRoot, coordinator);
  }
  return coordinator;
}

function duplicateManagerError(): Error {
  return new Error(
    'withFocusManagement allows only one focus manager per CRC root.',
  );
}

function asDirectionalBoundary(
  boundary: CRCDirectionalBoundary,
): DirectionalBoundary {
  if (!(boundary instanceof DirectionalBoundary)) {
    throw new Error('Unknown CRC directional boundary.');
  }
  return boundary;
}

function isKeyboardFocusable(target: CRCEventTargetRegistration): boolean {
  return target.keyboardFocusable ?? Boolean(
    target.handlers.click || target.handlers.keydown || target.handlers.keyup,
  );
}

function collectRetainedTargets(
  instance: CRCInstance,
  targets: CRCEventTargetRegistration[],
  visited: Set<CRCInstance>,
): void {
  if (visited.has(instance)) return;
  visited.add(instance);
  for (const entry of instance.paintEntries) {
    if (entry.kind === 'target') {
      if (entry.live) targets.push(entry);
    } else {
      collectRetainedTargets(entry.instance, targets, visited);
    }
  }
}

function isInstanceWithin(
  instance: CRCInstance,
  ancestor: CRCInstance,
): boolean {
  let current: CRCInstance | undefined = instance;
  while (current) {
    if (current === ancestor) return true;
    current = current.parent ? GLOBAL_STATE.crcInstances.get(current.parent) : undefined;
  }
  return false;
}
