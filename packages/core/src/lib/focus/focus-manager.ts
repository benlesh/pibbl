import type { CRCEventTargetRegistration } from '../events/registrations.js';
import { GLOBAL_STATE } from '../global-state.js';
import type { CRCEvent } from '../events/types.js';
import type {
  CRCEventRoot,
  CRCFocusPolicyBridge,
  CRCInstance,
  CRCRenderTransaction,
} from '../types.js';
import { resolveTargetRootBounds } from './geometry.js';
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
  private disposed = false;

  constructor(private readonly eventRoot: CRCEventRoot) {
    eventRoot.rootInstance?.mainTeardowns.add(() => this.dispose());
  }

  add(manager: CRCFocusManager): void {
    if (this.disposed) {
      throw new Error('CRC focus manager root is disposed.');
    }
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
      this.active = manager;
      this.eventRoot.focusPolicy = manager;
      return;
    }

    const state = this.stateFor(transaction);
    if (state.claimed && state.claimed !== manager) {
      throw duplicateManagerError();
    }
    state.claimed = manager;
    this.eventRoot.focusPolicy = manager;
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
      if (!state.finished || state.restored === manager) return;
    }
    if (this.active === manager) {
      this.active = undefined;
      if (this.eventRoot.focusPolicy === manager) {
        this.eventRoot.focusPolicy = undefined;
      }
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
  }

  private destroy(manager: CRCFocusManager): void {
    this.managers.delete(manager);
    manager.destroyFromCoordinator();
  }

  private dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.active = undefined;
    this.eventRoot.focusPolicy = undefined;
    for (const manager of Array.from(this.managers)) this.destroy(manager);
  }
}

export class CRCFocusManager implements CRCFocusPolicyBridge {
  private committedCandidates: readonly CRCFocusCandidate[] = Object.freeze([]);
  private committedBoundaries = new Set<DirectionalBoundary>();
  private pending: PendingFrame | undefined;
  private directionalStack: DirectionalBoundary[] = [];
  private focusedTarget: CRCEventTargetRegistration | undefined;
  private focusVisible = false;
  private destroyed = false;
  private ownerReleased = false;
  private readonly coordinator: FocusManagerCoordinator;

  constructor(eventRoot: CRCEventRoot, owner: CRCInstance) {
    managerOwners.set(this, owner);
    this.coordinator = getCoordinator(eventRoot);
    this.coordinator.add(this);
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

    const candidates = Object.freeze(pending.targets.map((observed, sourceIndex) => {
      if (observed.directionalBoundary) {
        retainedDirectionalBoundaries.set(
          observed.target,
          observed.directionalBoundary,
        );
      } else {
        retainedDirectionalBoundaries.delete(observed.target);
      }
      return Object.freeze({
        target: observed.target,
        sourceIndex,
        directionalBoundary: observed.directionalBoundary,
        rootBounds: resolveTargetRootBounds(observed.target),
      }) satisfies CRCFocusCandidate;
    }));
    this.commitCandidates(candidates, pending.boundaries);
  }

  observeTarget(target: CRCEventTargetRegistration): void {
    const pending = this.pending;
    if (!pending) return;
    if (!isKeyboardFocusable(target)) {
      this.markPendingIneligible(target);
      return;
    }
    pending.ineligibleTargets.delete(target);
    this.recordPendingTarget(target, this.directionalStack.at(-1));
  }

  removeTarget(target: CRCEventTargetRegistration): void {
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

  afterDispatch(_event: CRCEvent): void {
    // Task 2 installs the structural hook only. Defaults begin in Task 3.
  }

  replayRetainedSubtree(instance: CRCInstance): void {
    const retainedManagers = this.coordinator.claimRetainedManagers(instance);
    const replayManager = retainedManagers.length === 1 ?
      retainedManagers[0] : this;
    replayManager.replayRetainedTargets(instance);
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
          retainedBoundary : this.directionalStack.at(-1);
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
    this.focusedTarget = target;
    this.focusVisible = Boolean(target && focusVisible);
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
    const byBoundary = new Map<DirectionalBoundary, CRCFocusCandidate[]>();
    for (const boundary of boundaries) byBoundary.set(boundary, []);
    for (const candidate of candidates) {
      if (candidate.directionalBoundary instanceof DirectionalBoundary) {
        byBoundary.get(candidate.directionalBoundary)?.push(candidate);
      }
    }

    for (const boundary of this.committedBoundaries) {
      if (!byBoundary.has(boundary)) boundary.commit(Object.freeze([]));
    }
    for (const [boundary, directCandidates] of byBoundary) {
      boundary.commit(Object.freeze(directCandidates));
    }
    this.committedBoundaries = new Set(byBoundary.keys());
    this.committedCandidates = candidates;
    if (
      this.focusedTarget &&
      !candidates.some(candidate => candidate.target === this.focusedTarget)
    ) {
      this.clearFocusState();
    }
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
    this.focusedTarget = undefined;
    this.focusVisible = false;
  }

  private assertLive(): void {
    if (this.destroyed) throw new Error('CRC focus manager is disposed.');
  }
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
