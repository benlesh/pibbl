import type { PibblEventTargetRegistration } from "../events/registrations.js";
import { GLOBAL_STATE } from "../global-state.js";
import type {
  PibblEvent,
  PibblEventType,
  PibblKeyboardEvent,
} from "../events/types.js";
import { Teardowns } from "../teardowns.js";
import type {
  PibblEventRoot,
  PibblFocusPressDefaultInput,
  PibblFocusTouchDefaultContact,
  PibblFocusTouchDefaultInput,
  PibblFocusPolicyBridge,
  PibblInstance,
  PibblRenderTransaction,
} from "../types.js";
import { resolveTargetRootBounds } from "./geometry.js";
import {
  mountDOMFocusHost,
  type PibblMountedDOMFocusHost,
} from "./dom-focus-host.js";
import {
  applyDirectionalNavigationDefault,
  applyKeyboardActivationDefault,
  applyTabDefault,
} from "./keyboard-defaults.js";
import { transitionLogicalFocus } from "./focus-events.js";
import type { HtmlFocusRegion } from "./html-focus-region.js";
import {
  isHtmlFocusCandidate,
  type PibblDirectionalBoundary,
  type PibblFocusCandidate,
  type PibblHtmlFocusCandidate,
  type PibblNavigationCandidate,
} from "./types.js";
import { getManagedTabStops } from "./dom-tab-stops.js";

const UNFOCUSED_SNAPSHOT = Object.freeze({
  isFocused: false,
  isFocusVisible: false,
});

const retainedDirectionalBoundaries = new WeakMap<
  PibblEventTargetRegistration,
  DirectionalBoundary
>();
const coordinators = new WeakMap<PibblEventRoot, FocusManagerCoordinator>();
const managerOwners = new WeakMap<PibblFocusManager, PibblInstance>();

interface PendingCandidate {
  readonly target: PibblEventTargetRegistration;
  readonly directionalBoundary: DirectionalBoundary | undefined;
}

interface PendingHtmlRegion {
  readonly region: HtmlFocusRegion;
  readonly directionalBoundary: DirectionalBoundary | undefined;
}

interface PendingFrame {
  readonly entries: (PendingCandidate | PendingHtmlRegion)[];
  readonly targets: PendingCandidate[];
  readonly htmlRegions: PendingHtmlRegion[];
  readonly observedTargets: Set<PibblEventTargetRegistration>;
  readonly observedHtmlRegions: Set<HtmlFocusRegion>;
  readonly ineligibleTargets: Set<PibblEventTargetRegistration>;
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

class DirectionalBoundary implements PibblDirectionalBoundary {
  private committedCandidates: readonly PibblNavigationCandidate[] =
    Object.freeze([]);

  constructor(readonly owner: PibblInstance) {}

  get candidates(): readonly PibblNavigationCandidate[] {
    return this.committedCandidates;
  }

  commit(candidates: readonly PibblNavigationCandidate[]): void {
    this.committedCandidates = candidates;
  }
}

interface FocusTransactionState {
  readonly prior: PibblFocusManager | undefined;
  readonly replayedManagers: Set<PibblFocusManager>;
  prepared: PibblFocusManager | undefined;
  claimed: PibblFocusManager | undefined;
  finished: boolean;
  restored: PibblFocusManager | undefined;
}

class FocusManagerCoordinator {
  private readonly managers = new Set<PibblFocusManager>();
  private readonly transactions = new WeakMap<
    PibblRenderTransaction,
    FocusTransactionState
  >();
  private active: PibblFocusManager | undefined;
  private domFocusHost: PibblMountedDOMFocusHost | undefined;
  private domFocusHostTeardowns: Teardowns | undefined;
  private disposed = false;

  constructor(private readonly eventRoot: PibblEventRoot) {
    eventRoot.rootInstance?.mainTeardowns.add(() => this.dispose());
  }

  add(manager: PibblFocusManager): void {
    if (this.disposed) {
      throw new Error("Pibbl focus manager root is disposed.");
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

  claim(manager: PibblFocusManager): void {
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
    type: PibblEventType,
    event: Event,
  ): PibblFocusManager | undefined {
    const manager = this.active;
    const routeLogicalEvent =
      this.domFocusHost?.beforeNativeDispatch(type, event) ?? true;
    return routeLogicalEvent && manager && !manager.isDestroyed
      ? manager
      : undefined;
  }

  syncDOMFocusHost(manager: PibblFocusManager): void {
    if (this.active === manager) {
      this.domFocusHost?.syncCandidateAvailability(manager.hasFocusCandidates);
      this.domFocusHost?.syncHtmlRegions(manager.htmlFocusRegions);
    }
  }

  focusCanvasFromPress(manager: PibblFocusManager): void {
    if (this.active === manager) this.domFocusHost?.focusFromPress();
  }

  claimRetainedManagers(instance: PibblInstance): readonly PibblFocusManager[] {
    const retained = Array.from(this.managers).filter((manager) => {
      const owner = managerOwners.get(manager);
      return (
        !manager.isDestroyed &&
        !manager.ownerWasReleased &&
        owner !== undefined &&
        isInstanceWithin(owner, instance)
      );
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

  release(manager: PibblFocusManager): void {
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

  private stateFor(transaction: PibblRenderTransaction): FocusTransactionState {
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
    transaction.onFinish((success) => this.finishTransaction(state, success));
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
    const restored =
      state.prior && attemptedReplacement && !state.prior.isDestroyed
        ? state.prior
        : undefined;
    state.restored = restored;
    this.active = restored;
    this.eventRoot.focusPolicy = restored;
    for (const manager of Array.from(this.managers)) {
      if (manager !== restored) this.destroy(manager);
    }
    this.domFocusHost?.setManager(restored);
  }

  private destroy(manager: PibblFocusManager): void {
    this.managers.delete(manager);
    manager.destroyFromCoordinator();
    if (this.managers.size === 0) this.disposeDOMFocusHost();
  }

  private ensureDOMFocusHost(): void {
    if (this.domFocusHost) return;
    const canvas = this.eventRoot.canvas;
    if (!canvas) {
      throw new Error(
        "FocusManagement requires an HTMLCanvasElement root; an OffscreenCanvas has no DOM focus host.",
      );
    }
    const teardowns = new Teardowns();
    try {
      this.domFocusHost = mountDOMFocusHost(canvas, this.eventRoot, teardowns);
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

  private setActive(manager: PibblFocusManager | undefined): void {
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

export class PibblFocusManager implements PibblFocusPolicyBridge {
  private committedCandidates: readonly PibblFocusCandidate[] = Object.freeze([]);
  private committedHtmlCandidates: readonly PibblHtmlFocusCandidate[] =
    Object.freeze([]);
  private committedNavigationCandidates: readonly PibblNavigationCandidate[] =
    Object.freeze([]);
  private committedBoundaries = new Set<DirectionalBoundary>();
  private pending: PendingFrame | undefined;
  private transactionalPending:
    | {
        readonly transaction: PibblRenderTransaction;
        readonly frame: PendingFrame;
      }
    | undefined;
  private directionalStack: DirectionalBoundary[] = [];
  private focusedTarget: PibblEventTargetRegistration | undefined;
  private focusedHtmlRegion: HtmlFocusRegion | undefined;
  private pendingHtmlFocusModality: "keyboard" | "pointer" | undefined;
  private focusVisible = false;
  private pendingSpaceTarget: PibblEventTargetRegistration | undefined;
  private pendingPressFocus:
    { readonly target: PibblEventTargetRegistration | undefined } | undefined;
  private readonly representedPointerPresses = new Map<
    number,
    RepresentedPointerPress
  >();
  private readonly representedTouchContacts = new Map<
    number,
    RepresentedPress
  >();
  private activeTouchIdentifiers = new Set<number>();
  private primaryTouchIdentifier: number | undefined;
  private touchSequenceActive = false;
  private touchMouseCompatibility: RepresentedPress | undefined;
  private focusRenderRevision = 0;
  private readonly layerFocusRenderRevisions = new WeakMap<
    PibblInstance,
    number
  >();
  private destroyed = false;
  private ownerReleased = false;
  private readonly coordinator: FocusManagerCoordinator;

  constructor(
    private readonly eventRoot: PibblEventRoot,
    owner: PibblInstance,
  ) {
    const canvas = eventRoot.canvas;
    if (!canvas) {
      throw new Error(
        "FocusManagement requires an HTMLCanvasElement root; an OffscreenCanvas has no DOM focus host.",
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

  get candidates(): readonly PibblFocusCandidate[] {
    return this.committedCandidates;
  }

  /** @internal Full source-order list including native HtmlBox regions. */
  get navigationCandidates(): readonly PibblNavigationCandidate[] {
    return this.committedNavigationCandidates;
  }

  get htmlFocusRegions(): readonly HtmlFocusRegion[] {
    return this.committedHtmlCandidates.map((candidate) => candidate.region);
  }

  get focusedNavigationCandidate(): PibblNavigationCandidate | undefined {
    if (this.focusedHtmlRegion) {
      return this.committedHtmlCandidates.find(
        (candidate) => candidate.region === this.focusedHtmlRegion,
      );
    }
    return this.focusedTarget
      ? this.committedCandidates.find(
          (candidate) => candidate.target === this.focusedTarget,
        )
      : undefined;
  }

  /** @internal Resolves dynamic native eligibility at each navigation boundary. */
  isNavigationCandidateFocusable(candidate: PibblNavigationCandidate): boolean {
    return isHtmlFocusCandidate(candidate)
      ? Boolean(
          candidate.region.active &&
          candidate.region.content &&
          getManagedTabStops(candidate.region.content).length,
        )
      : Boolean(this.liveFocusCandidate(candidate.target));
  }

  /** Includes a successful render's collected candidates before commit callbacks settle. */
  get hasFocusCandidates(): boolean {
    return (
      this.committedNavigationCandidates.length > 0 ||
      (this.transactionalPending?.frame.targets.length ?? 0) +
        (this.transactionalPending?.frame.htmlRegions.length ?? 0) >
        0
    );
  }

  get isDestroyed(): boolean {
    return this.destroyed;
  }

  get ownerWasReleased(): boolean {
    return this.ownerReleased;
  }

  get canvas(): HTMLCanvasElement {
    const canvas = this.eventRoot.canvas;
    if (!canvas) throw new Error("Pibbl focus manager has no DOM Canvas host.");
    return canvas;
  }

  get logicalFocusTarget(): PibblEventTargetRegistration | undefined {
    return this.focusedTarget;
  }

  get logicalFocusVisible(): boolean {
    return this.focusVisible;
  }

  beginCollection(): void {
    this.assertLive();
    if (this.pending) {
      throw new Error("FocusManagement cannot enter twice on one Pibbl root.");
    }
    this.coordinator.claim(this);
    this.pending = {
      entries: [],
      targets: [],
      htmlRegions: [],
      observedTargets: new Set(),
      observedHtmlRegions: new Set(),
      ineligibleTargets: new Set(),
      boundaries: new Set(this.directionalStack),
    };
  }

  finishCollection(success: boolean): void {
    const pending = this.pending;
    this.pending = undefined;
    if (!pending || !success || this.destroyed) return;

    const transaction = this.eventRoot.renderTransaction;
    if (transaction) {
      this.transactionalPending = { transaction, frame: pending };
      transaction.onFinish((transactionSucceeded) => {
        if (this.transactionalPending?.transaction === transaction) {
          this.transactionalPending = undefined;
        }
        if (transactionSucceeded && !this.destroyed) {
          this.commitCollection(pending);
        }
      });
      return;
    }

    this.commitCollection(pending);
  }

  private commitCollection(pending: PendingFrame): void {
    const collected: PibblNavigationCandidate[] = [];
    for (const [sourceIndex, observed] of pending.entries.entries()) {
      if ("target" in observed) {
        const target = observed.target;
        collected.push(
          Object.freeze({
            target,
            sourceIndex,
            directionalBoundary: observed.directionalBoundary,
            rootBounds: resolveTargetRootBounds(target),
          }) satisfies PibblFocusCandidate,
        );
        continue;
      }
      const region = observed.region;
      if (region.active && region.content)
        collected.push(
          Object.freeze({
            region,
            sourceIndex,
            directionalBoundary: observed.directionalBoundary,
            rootBounds: region.rootBounds,
          }) satisfies PibblHtmlFocusCandidate,
        );
    }
    const navigation = Object.freeze(collected);
    this.commitNavigationCandidates(navigation, pending.boundaries);
    const candidates = navigation.filter(
      (candidate): candidate is PibblFocusCandidate =>
        !isHtmlFocusCandidate(candidate),
    );
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

  observeTarget(target: PibblEventTargetRegistration): void {
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

  /** @internal Collects one published HtmlBox in source order. */
  observeHtmlRegion(region: HtmlFocusRegion): void {
    const pending = this.pending;
    if (!pending || pending.observedHtmlRegions.has(region)) return;
    pending.observedHtmlRegions.add(region);
    const observed = {
      region,
      directionalBoundary: this.currentDirectionalBoundary(),
    };
    pending.htmlRegions.push(observed);
    pending.entries.push(observed);
  }

  /** @internal Removes an unmounted HtmlBox without manufacturing a Canvas target. */
  removeHtmlFocusRegion(region: HtmlFocusRegion): void {
    if (this.pending?.observedHtmlRegions.delete(region)) {
      this.pending.htmlRegions.splice(
        this.pending.htmlRegions.findIndex((entry) => entry.region === region),
        1,
      );
      const index = this.pending.entries.findIndex(
        (entry) => "region" in entry && entry.region === region,
      );
      if (index >= 0) this.pending.entries.splice(index, 1);
      return;
    }
    if (
      !this.committedHtmlCandidates.some(
        (candidate) => candidate.region === region,
      )
    )
      return;
    const wasFocused = this.focusedHtmlRegion === region;
    const canvas = this.eventRoot.canvas;
    const shouldReturnNativeFocus = Boolean(
      wasFocused &&
      canvas &&
      !this.eventRoot.rootInstance?.mainTeardowns.closed &&
      region.content?.contains(canvas.ownerDocument.activeElement),
    );
    this.commitNavigationCandidates(
      this.committedNavigationCandidates.filter(
        (candidate) =>
          !isHtmlFocusCandidate(candidate) || candidate.region !== region,
      ),
      this.committedBoundaries,
    );
    if (shouldReturnNativeFocus && canvas) {
      this.coordinator.focusCanvasFromPress(this);
      // Canvas focus synchronously enters the ordinary DOM host. A retired
      // region must leave no logical selection behind that would turn this
      // removal into an unintended navigation action.
      this.clearFocusState();
    }
    if (wasFocused) this.clearHtmlFocus(region);
  }

  /** @internal Deactivates retained DOM hosts while the root has no display area. */
  suspendHtmlRegions(): void {
    if (this.committedHtmlCandidates.length === 0) return;
    const focused = this.focusedHtmlRegion;
    const canvas = this.eventRoot.canvas;
    const shouldReturnNativeFocus = Boolean(
      focused &&
      canvas &&
      !this.eventRoot.rootInstance?.mainTeardowns.closed &&
      focused.content?.contains(canvas.ownerDocument.activeElement),
    );
    this.commitNavigationCandidates(
      this.committedNavigationCandidates.filter(
        (candidate) => !isHtmlFocusCandidate(candidate),
      ),
      this.committedBoundaries,
    );
    if (shouldReturnNativeFocus && canvas) {
      this.coordinator.focusCanvasFromPress(this);
      this.clearFocusState();
    }
    if (focused) this.clearHtmlFocus(focused);
  }

  observeTransactionalTarget(target: PibblEventTargetRegistration): void {
    const transactional = this.transactionalPending;
    if (
      !transactional ||
      transactional.transaction !== this.eventRoot.renderTransaction
    )
      return;
    const pending = transactional.frame;
    if (this.pendingSpaceTarget === target && !target.handlers.click) {
      this.cancelSpaceActivation();
    }
    if (!isKeyboardFocusable(target)) {
      pending.ineligibleTargets.add(target);
      const index = pending.targets.findIndex(
        (candidate) => candidate.target === target,
      );
      if (index !== -1) pending.targets.splice(index, 1);
      const entryIndex = pending.entries.findIndex(
        (entry) => "target" in entry && entry.target === target,
      );
      if (entryIndex !== -1) pending.entries.splice(entryIndex, 1);
      pending.observedTargets.delete(target);
      return;
    }
    pending.ineligibleTargets.delete(target);
    if (pending.observedTargets.has(target)) return;
    pending.observedTargets.add(target);
    const observed = {
      target,
      directionalBoundary: this.currentDirectionalBoundary(),
    };
    pending.targets.push(observed);
    pending.entries.push(observed);
  }

  removeTarget(target: PibblEventTargetRegistration): void {
    if (this.pendingSpaceTarget === target) this.cancelSpaceActivation();
    if (this.pending) {
      this.markPendingIneligible(target);
      return;
    }
    if (
      !this.committedCandidates.some((candidate) => candidate.target === target)
    ) {
      if (this.focusedTarget === target) this.clearFocusState();
      return;
    }
    this.commitRemovedTarget(target);
  }

  snapshot(target: PibblEventTargetRegistration) {
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

  resolveKeyboardTarget(): PibblEventTargetRegistration | undefined {
    const target = this.focusedTarget;
    if (target && this.pending?.ineligibleTargets.has(target)) return undefined;
    return target &&
      this.committedCandidates.some((candidate) => candidate.target === target)
      ? target
      : undefined;
  }

  afterDispatch(event: PibblEvent): void {
    if (event.type === "keydown") {
      applyTabDefault(this, event as PibblKeyboardEvent);
    }
    if (event.type === "keydown" || event.type === "keyup") {
      applyKeyboardActivationDefault(this, event as PibblKeyboardEvent);
    }
    if (event.type === "keydown") {
      applyDirectionalNavigationDefault(this, event as PibblKeyboardEvent);
    }
  }

  afterPressDispatch(input: PibblFocusPressDefaultInput): void {
    if (this.destroyed) return;
    this.purgeExpiredPresses(input.originalEvent.timeStamp);
    switch (input.source) {
      case "pointer":
        this.recordPointerPress(input);
        if (!pressWasPrevented(input)) this.applyPressFocus(input.target);
        return;
      case "mouse":
        if (this.consumeRepresentedMousePress(input)) return;
        if (!pressWasPrevented(input)) this.applyPressFocus(input.target);
        return;
      case "touch":
        if (this.consumeRepresentedTouchPress(input)) return;
        this.recordTouchFallback(input);
        if (!pressWasPrevented(input)) this.applyPressFocus(input.target);
        return;
    }
  }

  afterTouchDispatch(input: PibblFocusTouchDefaultInput): void {
    if (this.destroyed) return;
    this.purgeExpiredPresses(input.originalEvent.timeStamp);
    this.reconcileTouchContacts(input);
    if (input.type === "touchstart") {
      const primary = this.recordTouchStarts(input);
      if (!primary) return;
      this.afterPressDispatch({
        source: "touch",
        target: primary.target,
        event: undefined,
        originalEvent: input.originalEvent,
        x: primary.x,
        y: primary.y,
        touchIdentifier: primary.identifier,
      });
      return;
    }
    if (input.type === "touchend" || input.type === "touchcancel") {
      this.recordTouchTerminals(input);
    }
  }

  beforeNativeDispatch(
    type: PibblEventType,
    event: Event,
  ): PibblFocusManager | undefined {
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
        "pointer",
      );
      return;
    }
    const candidates = backwards
      ? [...this.committedNavigationCandidates].reverse()
      : this.committedNavigationCandidates;
    for (const candidate of candidates) {
      if (this.focusNavigationCandidate(candidate, "keyboard", backwards))
        return;
    }
  }

  leaveDOMFocus(): void {
    if (this.destroyed) return;
    this.pendingPressFocus = undefined;
    transitionLogicalFocus(this, undefined, "keyboard");
  }

  activateDOMHost(): void {
    if (!this.destroyed) this.coordinator.syncDOMFocusHost(this);
  }

  focusNavigationCandidate(
    candidate: PibblNavigationCandidate | undefined,
    modality: "keyboard" | "pointer",
    backwards = false,
  ): boolean {
    if (!candidate) return false;
    if (!isHtmlFocusCandidate(candidate)) {
      this.focusedHtmlRegion && this.clearHtmlFocus(this.focusedHtmlRegion);
      transitionLogicalFocus(
        this,
        this.liveFocusCandidate(candidate.target),
        modality,
      );
      return true;
    }
    const region = candidate.region;
    const content = region.active ? region.content : undefined;
    const stops = content ? getManagedTabStops(content) : [];
    const destination = backwards ? stops.at(-1) : stops[0];
    if (!destination) return false;
    if (this.focusedTarget) transitionLogicalFocus(this, undefined, modality);
    this.adoptHtmlFocus(region, modality);
    this.pendingHtmlFocusModality = modality;
    destination.focus({ preventScroll: true });
    this.pendingHtmlFocusModality = undefined;
    return true;
  }

  /** @internal Called by the native region listeners after the browser focuses a descendant. */
  adoptNativeHtmlFocus(
    region: HtmlFocusRegion,
    modality: "keyboard" | "pointer" | undefined,
  ): void {
    if (
      !this.committedHtmlCandidates.some(
        (candidate) => candidate.region === region,
      )
    )
      return;
    const carriedModality =
      modality ?? (this.focusVisible ? "keyboard" : "pointer");
    if (this.focusedTarget)
      transitionLogicalFocus(this, undefined, carriedModality);
    this.adoptHtmlFocus(
      region,
      this.pendingHtmlFocusModality ?? carriedModality,
    );
  }

  /** @internal Native blur settled outside a registered host. */
  clearNativeHtmlFocus(region: HtmlFocusRegion): void {
    if (this.focusedHtmlRegion === region) this.clearHtmlFocus(region);
  }

  /** @internal Reconciles a committed host list with the browser focus owner. */
  reconcileNativeHtmlFocus(region: HtmlFocusRegion | undefined): void {
    if (region) {
      this.adoptNativeHtmlFocus(region, undefined);
    } else if (this.focusedHtmlRegion) {
      this.clearHtmlFocus(this.focusedHtmlRegion);
    }
  }

  replayRetainedSubtree(instance: PibblInstance): void {
    const retainedManagers = this.coordinator.claimRetainedManagers(instance);
    const replayManager =
      retainedManagers.length === 1 ? retainedManagers[0] : this;
    replayManager.replayRetainedTargets(instance);
  }

  layerFocusRenderRevision(instance: PibblInstance): number | undefined {
    return this.ownerReleased
      ? undefined
      : this.layerFocusRenderRevisions.get(instance);
  }

  private replayRetainedTargets(instance: PibblInstance): void {
    // A cached Layer must replay the exact mixed source sequence from its last
    // successful render.  Enumerating eventRoot.targets would lose HtmlBox
    // positions because native regions intentionally have no event target.
    const retained = this.committedNavigationCandidates.filter((candidate) =>
      isHtmlFocusCandidate(candidate)
        ? isInstanceWithin(candidate.region.owner, instance)
        : isInstanceWithin(candidate.target.owner, instance),
    );
    // Preserve the established Canvas-only replay behavior.  A Canvas target
    // registration can be refreshed independently of its original collection
    // position; the mixed sequence is required only once native regions exist.
    if (!retained.some(isHtmlFocusCandidate)) {
      this.replayCanvasOnlyTargets(instance);
      return;
    }
    if (this.pending) {
      for (const candidate of retained) {
        const retainedBoundary = isHtmlFocusCandidate(candidate)
          ? candidate.directionalBoundary instanceof DirectionalBoundary &&
            isInstanceWithin(candidate.directionalBoundary.owner, instance)
            ? candidate.directionalBoundary
            : undefined
          : retainedDirectionalBoundaries.get(candidate.target);
        const directionalBoundary =
          retainedBoundary && isInstanceWithin(retainedBoundary.owner, instance)
            ? retainedBoundary
            : this.currentDirectionalBoundary();
        if (directionalBoundary) {
          this.pending.boundaries.add(directionalBoundary);
        }
        if (isHtmlFocusCandidate(candidate)) {
          const region = candidate.region;
          if (!region.active || !region.content) continue;
          if (!this.pending.observedHtmlRegions.has(region)) {
            this.pending.observedHtmlRegions.add(region);
            const observed = { region, directionalBoundary };
            this.pending.htmlRegions.push(observed);
            this.pending.entries.push(observed);
          }
        } else if (isKeyboardFocusable(candidate.target)) {
          this.recordPendingTarget(candidate.target, directionalBoundary);
        } else {
          this.markPendingIneligible(candidate.target);
        }
      }
      return;
    }

    if (retained.length === 0) return;
    const replayed = new Set(retained);
    const candidates = Object.freeze(
      this.committedNavigationCandidates.map((candidate) => {
        if (!replayed.has(candidate)) return candidate;
        return isHtmlFocusCandidate(candidate)
          ? Object.freeze({
              ...candidate,
              rootBounds: candidate.region.rootBounds,
            })
          : Object.freeze({
              ...candidate,
              rootBounds: resolveTargetRootBounds(candidate.target),
            });
      }),
    );
    this.commitNavigationCandidates(candidates, this.committedBoundaries);
  }

  private replayCanvasOnlyTargets(instance: PibblInstance): void {
    const targets: PibblEventTargetRegistration[] = [];
    collectRetainedTargets(instance, targets);
    if (this.pending) {
      for (const target of targets) {
        if (!isKeyboardFocusable(target)) {
          this.markPendingIneligible(target);
          continue;
        }
        const retainedBoundary = retainedDirectionalBoundaries.get(target);
        const directionalBoundary =
          retainedBoundary && isInstanceWithin(retainedBoundary.owner, instance)
            ? retainedBoundary
            : this.currentDirectionalBoundary();
        if (directionalBoundary)
          this.pending.boundaries.add(directionalBoundary);
        this.recordPendingTarget(target, directionalBoundary);
      }
      return;
    }
    const replayed = new Set(targets);
    if (
      !this.committedCandidates.some((candidate) =>
        replayed.has(candidate.target),
      )
    )
      return;
    const candidates = Object.freeze(
      this.committedCandidates.map((candidate) =>
        replayed.has(candidate.target)
          ? Object.freeze({
              ...candidate,
              rootBounds: resolveTargetRootBounds(candidate.target),
            })
          : candidate,
      ),
    );
    this.commitCandidates(candidates, this.committedBoundaries);
  }

  setFocusState(
    target: PibblEventTargetRegistration | undefined,
    focusVisible: boolean,
  ): void {
    if (
      target &&
      !this.committedCandidates.some((candidate) => candidate.target === target)
    ) {
      throw new Error(
        "Pibbl logical focus target is not a live focus candidate.",
      );
    }
    this.commitLogicalFocus(target, focusVisible);
  }

  liveFocusCandidate(
    target: PibblEventTargetRegistration | undefined,
  ): PibblEventTargetRegistration | undefined {
    return target?.live &&
      target.owner.eventRoot === this.eventRoot &&
      this.committedCandidates.some((candidate) => candidate.target === target)
      ? target
      : undefined;
  }

  commitLogicalFocus(
    target: PibblEventTargetRegistration | undefined,
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

  enterDirectionalBoundary(boundary: PibblDirectionalBoundary): void {
    const value = asDirectionalBoundary(boundary);
    this.directionalStack.push(value);
    this.pending?.boundaries.add(value);
  }

  exitDirectionalBoundary(boundary: PibblDirectionalBoundary): void {
    const value = asDirectionalBoundary(boundary);
    if (this.directionalStack.at(-1) !== value) {
      throw new Error("Pibbl directional boundary scope exited out of order.");
    }
    this.directionalStack.pop();
  }

  private currentDirectionalBoundary(): DirectionalBoundary | undefined {
    return this.directionalStack.at(-1);
  }

  private markFocusRenderLayers(
    target: PibblEventTargetRegistration | undefined,
    revision: number,
  ): void {
    let instance = target?.owner;
    while (instance && instance !== this.eventRoot.rootInstance) {
      this.layerFocusRenderRevisions.set(instance, revision);
      instance = instance.parent
        ? GLOBAL_STATE.pibblInstances.get(instance.parent)
        : undefined;
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
    target: PibblEventTargetRegistration,
    directionalBoundary: DirectionalBoundary | undefined,
  ): void {
    const pending = this.pending;
    if (!pending || pending.observedTargets.has(target)) return;
    pending.observedTargets.add(target);
    const observed = { target, directionalBoundary };
    pending.targets.push(observed);
    pending.entries.push(observed);
  }

  private markPendingIneligible(target: PibblEventTargetRegistration): void {
    const pending = this.pending;
    if (!pending) return;
    pending.ineligibleTargets.add(target);
    if (!pending.observedTargets.delete(target)) return;
    for (let index = pending.targets.length - 1; index >= 0; index--) {
      if (pending.targets[index].target === target) {
        pending.targets.splice(index, 1);
      }
    }
    for (let index = pending.entries.length - 1; index >= 0; index--) {
      const entry = pending.entries[index];
      if ("target" in entry && entry.target === target)
        pending.entries.splice(index, 1);
    }
  }

  private commitCandidates(
    candidates: readonly PibblFocusCandidate[],
    boundaries: ReadonlySet<DirectionalBoundary>,
  ): void {
    const canvasByTarget = new Map(
      candidates.map((candidate) => [candidate.target, candidate]),
    );
    const navigation = this.committedNavigationCandidates
      .map((candidate) =>
        isHtmlFocusCandidate(candidate)
          ? candidate
          : (canvasByTarget.get(candidate.target) ?? candidate),
      )
      .filter(
        (candidate) =>
          isHtmlFocusCandidate(candidate) ||
          candidates.some((canvas) => canvas.target === candidate.target),
      );
    if (navigation.length === 0 && candidates.length > 0)
      navigation.push(...candidates);
    this.commitNavigationCandidates(Object.freeze(navigation), boundaries);
  }

  private commitNavigationCandidates(
    candidates: readonly PibblNavigationCandidate[],
    boundaries: ReadonlySet<DirectionalBoundary>,
  ): void {
    const pendingByBoundary = new Map<
      DirectionalBoundary,
      PibblNavigationCandidate[]
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
      readonly PibblNavigationCandidate[]
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
    this.committedNavigationCandidates = candidates;
    this.committedCandidates = Object.freeze(
      candidates.filter(
        (candidate): candidate is PibblFocusCandidate =>
          !isHtmlFocusCandidate(candidate),
      ),
    );
    this.committedHtmlCandidates = Object.freeze(
      candidates.filter((candidate): candidate is PibblHtmlFocusCandidate =>
        isHtmlFocusCandidate(candidate),
      ),
    );
    if (
      this.focusedTarget &&
      !candidates.some(
        (candidate) =>
          !isHtmlFocusCandidate(candidate) &&
          candidate.target === this.focusedTarget,
      )
    ) {
      this.clearFocusState();
    }
    if (
      this.focusedHtmlRegion &&
      !this.committedHtmlCandidates.some(
        (candidate) => candidate.region === this.focusedHtmlRegion,
      )
    )
      this.clearHtmlFocus(this.focusedHtmlRegion);
    this.activateDOMHost();
  }

  private commitRemovedTarget(target: PibblEventTargetRegistration): void {
    const retained = this.committedCandidates.filter(
      (candidate) => candidate.target !== target,
    );
    const candidates = Object.freeze(
      retained.map((candidate, sourceIndex) =>
        Object.freeze({ ...candidate, sourceIndex }),
      ),
    );
    this.commitCandidates(candidates, this.committedBoundaries);
  }

  private clearFocusState(): void {
    this.cancelSpaceActivation();
    this.focusedTarget = undefined;
    this.focusVisible = false;
  }

  private adoptHtmlFocus(
    region: HtmlFocusRegion,
    modality: "keyboard" | "pointer",
  ): void {
    const visible = modality === "keyboard";
    if (this.focusedHtmlRegion === region && this.focusVisible === visible)
      return;
    const previous = this.focusedHtmlRegion;
    this.focusedHtmlRegion = region;
    this.focusVisible = visible;
    if (previous && previous !== region)
      this.notifyHtmlFocus(previous, false, false);
    this.notifyHtmlFocus(region, true, visible);
  }

  private clearHtmlFocus(region: HtmlFocusRegion): void {
    if (this.focusedHtmlRegion !== region) return;
    this.focusedHtmlRegion = undefined;
    this.focusVisible = false;
    this.notifyHtmlFocus(region, false, false);
  }

  private notifyHtmlFocus(
    region: HtmlFocusRegion,
    isFocusWithin: boolean,
    isFocusVisible: boolean,
  ): void {
    region.onFocusSnapshot?.(Object.freeze({ isFocusWithin, isFocusVisible }));
  }

  private applyPressFocus(
    requestedTarget: PibblEventTargetRegistration | undefined,
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
      transitionLogicalFocus(this, this.liveFocusCandidate(target), "pointer");
    } finally {
      if (this.pendingPressFocus === pending)
        this.pendingPressFocus = undefined;
    }
  }

  beginSpaceActivation(target: PibblEventTargetRegistration): void {
    this.pendingSpaceTarget = target;
  }

  hasPendingSpaceActivation(
    target: PibblEventTargetRegistration | undefined,
  ): boolean {
    return Boolean(target && this.pendingSpaceTarget === target);
  }

  consumeSpaceActivation(): PibblEventTargetRegistration | undefined {
    const target = this.pendingSpaceTarget;
    this.pendingSpaceTarget = undefined;
    return target;
  }

  cancelSpaceActivation(): void {
    this.pendingSpaceTarget = undefined;
  }

  private recordPointerPress(input: PibblFocusPressDefaultInput): void {
    if (input.pointerId === undefined) return;
    this.representedPointerPresses.set(input.pointerId, {
      x: input.x,
      y: input.y,
      timeStamp: input.originalEvent.timeStamp,
      suppressMouse: true,
      suppressTouch: input.pointerType === "touch",
    });
  }

  private consumeRepresentedMousePress(
    input: PibblFocusPressDefaultInput,
  ): boolean {
    for (const [pointerId, press] of this.representedPointerPresses) {
      if (!press.suppressMouse || !samePress(press, input)) continue;
      press.suppressMouse = false;
      if (!press.suppressTouch)
        this.representedPointerPresses.delete(pointerId);
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
    input: PibblFocusPressDefaultInput,
  ): boolean {
    const identifier = input.touchIdentifier;
    if (identifier === undefined) return false;
    const existing = this.representedTouchContacts.get(identifier);
    if (existing && samePress(existing, input)) return true;
    this.representedTouchContacts.set(identifier, pressRecord(input));

    for (const [pointerId, press] of this.representedPointerPresses) {
      if (!press.suppressTouch || !samePress(press, input)) continue;
      press.suppressTouch = false;
      if (!press.suppressMouse)
        this.representedPointerPresses.delete(pointerId);
      return true;
    }
    return false;
  }

  private recordTouchFallback(input: PibblFocusPressDefaultInput): void {
    this.touchMouseCompatibility = pressRecord(input);
  }

  private recordTouchStarts(
    input: PibblFocusTouchDefaultInput,
  ): PibblFocusTouchDefaultContact | undefined {
    let primary: PibblFocusTouchDefaultContact | undefined;
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

  private reconcileTouchContacts(input: PibblFocusTouchDefaultInput): void {
    const activeIdentifiers = new Set(input.activeIdentifiers);
    for (const identifier of this.activeTouchIdentifiers) {
      if (activeIdentifiers.has(identifier)) continue;
      this.activeTouchIdentifiers.delete(identifier);
      this.representedTouchContacts.delete(identifier);
    }

    const startingIdentifiers =
      input.type === "touchstart"
        ? new Set(input.changedContacts.map((contact) => contact.identifier))
        : undefined;
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

  private recordTouchTerminals(input: PibblFocusTouchDefaultInput): void {
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
    if (this.destroyed) throw new Error("Pibbl focus manager is disposed.");
  }
}

function pressWasPrevented(input: PibblFocusPressDefaultInput): boolean {
  return input.event?.defaultPrevented ?? input.originalEvent.defaultPrevented;
}

function pressRecord(input: PibblFocusPressDefaultInput): RepresentedPress {
  return {
    x: input.x,
    y: input.y,
    timeStamp: input.originalEvent.timeStamp,
  };
}

function samePress(
  press: RepresentedPress,
  input: PibblFocusPressDefaultInput,
): boolean {
  return (
    recentPress(press, input.originalEvent.timeStamp) &&
    Math.abs(press.x - input.x) <= 1 &&
    Math.abs(press.y - input.y) <= 1
  );
}

function recentPress(press: RepresentedPress, timeStamp: number): boolean {
  const elapsed = timeStamp - press.timeStamp;
  return elapsed >= 0 && elapsed <= COMPATIBILITY_PRESS_WINDOW_MS;
}

export function createFocusManager(
  eventRoot: PibblEventRoot,
  owner: PibblInstance,
): PibblFocusManager {
  return new PibblFocusManager(eventRoot, owner);
}

export function requireFocusManager(eventRoot: PibblEventRoot): PibblFocusManager {
  const manager = eventRoot.focusPolicy;
  if (!(manager instanceof PibblFocusManager)) {
    throw new Error(
      "KeyboardNavigation requires an active FocusManagement focus manager.",
    );
  }
  return manager;
}

export function createDirectionalBoundary(
  owner: PibblInstance,
): PibblDirectionalBoundary {
  return new DirectionalBoundary(owner);
}

function getCoordinator(eventRoot: PibblEventRoot): FocusManagerCoordinator {
  let coordinator = coordinators.get(eventRoot);
  if (!coordinator) {
    coordinator = new FocusManagerCoordinator(eventRoot);
    coordinators.set(eventRoot, coordinator);
  }
  return coordinator;
}

function duplicateManagerError(): Error {
  return new Error(
    "FocusManagement allows only one focus manager per Pibbl root.",
  );
}

function asDirectionalBoundary(
  boundary: PibblDirectionalBoundary,
): DirectionalBoundary {
  if (!(boundary instanceof DirectionalBoundary)) {
    throw new Error("Unknown Pibbl directional boundary.");
  }
  return boundary;
}

function isKeyboardFocusable(target: PibblEventTargetRegistration): boolean {
  return (
    target.keyboardFocusable ??
    Boolean(
      target.handlers.click || target.handlers.keydown || target.handlers.keyup,
    )
  );
}

function collectRetainedTargets(
  instance: PibblInstance,
  targets: PibblEventTargetRegistration[],
): void {
  if (instance.mainTeardowns.closed) return;
  for (const target of instance.eventRoot.targets) {
    if (
      target.live &&
      target.owner.eventRoot === instance.eventRoot &&
      !target.owner.mainTeardowns.closed &&
      isInstanceWithin(target.owner, instance)
    )
      targets.push(target);
  }
}

function isInstanceWithin(
  instance: PibblInstance,
  ancestor: PibblInstance,
): boolean {
  let current: PibblInstance | undefined = instance;
  while (current) {
    if (current === ancestor) return true;
    current = current.parent
      ? GLOBAL_STATE.pibblInstances.get(current.parent)
      : undefined;
  }
  return false;
}
