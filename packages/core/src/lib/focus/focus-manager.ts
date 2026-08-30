import type { CRCEventTargetRegistration } from '../events/registrations.js';
import type { CRCEvent } from '../events/types.js';
import type { CRCEventRoot, CRCFocusPolicyBridge } from '../types.js';
import { resolveTargetRootBounds } from './geometry.js';
import type {
  CRCDirectionalBoundary,
  CRCFocusCandidate,
} from './types.js';

const UNFOCUSED_SNAPSHOT = Object.freeze({
  isFocused: false,
  isFocusVisible: false,
});

interface PendingCandidate {
  readonly target: CRCEventTargetRegistration;
  readonly directionalBoundary: DirectionalBoundary | undefined;
}

interface PendingFrame {
  readonly targets: PendingCandidate[];
  readonly boundaries: Set<DirectionalBoundary>;
}

class DirectionalBoundary implements CRCDirectionalBoundary {
  private committedCandidates: readonly CRCFocusCandidate[] = Object.freeze([]);

  get candidates(): readonly CRCFocusCandidate[] {
    return this.committedCandidates;
  }

  commit(candidates: readonly CRCFocusCandidate[]): void {
    this.committedCandidates = candidates;
  }
}

export class CRCFocusManager implements CRCFocusPolicyBridge {
  private committedCandidates: readonly CRCFocusCandidate[] = Object.freeze([]);
  private committedBoundaries = new Set<DirectionalBoundary>();
  private pending: PendingFrame | undefined;
  private directionalStack: DirectionalBoundary[] = [];
  private focusedTarget: CRCEventTargetRegistration | undefined;
  private focusVisible = false;
  private disposed = false;

  constructor(private readonly eventRoot: CRCEventRoot) {
    if (eventRoot.focusPolicy) {
      throw new Error(
        'withFocusManagement allows only one focus manager per CRC root.',
      );
    }
    eventRoot.focusPolicy = this;
  }

  get candidates(): readonly CRCFocusCandidate[] {
    return this.committedCandidates;
  }

  beginCollection(): void {
    this.assertLive();
    if (this.pending) {
      throw new Error('withFocusManagement cannot enter twice on one CRC root.');
    }
    this.pending = {
      targets: [],
      boundaries: new Set(this.directionalStack),
    };
  }

  finishCollection(success: boolean): void {
    const pending = this.pending;
    this.pending = undefined;
    if (!pending || !success || this.disposed) return;

    const candidates = Object.freeze(pending.targets.map((observed, sourceIndex) =>
      Object.freeze({
        target: observed.target,
        sourceIndex,
        directionalBoundary: observed.directionalBoundary,
        rootBounds: resolveTargetRootBounds(observed.target),
      }) satisfies CRCFocusCandidate
    ));
    const byBoundary = new Map<DirectionalBoundary, CRCFocusCandidate[]>();
    for (const boundary of pending.boundaries) byBoundary.set(boundary, []);
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

  observeTarget(target: CRCEventTargetRegistration): void {
    const pending = this.pending;
    if (!pending || !isKeyboardFocusable(target)) return;
    pending.targets.push({
      target,
      directionalBoundary: this.directionalStack.at(-1),
    });
  }

  removeTarget(target: CRCEventTargetRegistration): void {
    if (this.pending) {
      for (let index = this.pending.targets.length - 1; index >= 0; index--) {
        if (this.pending.targets[index].target === target) {
          this.pending.targets.splice(index, 1);
        }
      }
      return;
    }
    if (!this.committedCandidates.some(candidate => candidate.target === target)) {
      if (this.focusedTarget === target) this.clearFocusState();
      return;
    }
    this.commitRemovedTarget(target);
  }

  snapshot(target: CRCEventTargetRegistration) {
    if (target !== this.focusedTarget) return UNFOCUSED_SNAPSHOT;
    return Object.freeze({
      isFocused: true,
      isFocusVisible: this.focusVisible,
    });
  }

  resolveKeyboardTarget(): CRCEventTargetRegistration | undefined {
    const target = this.focusedTarget;
    return target && this.committedCandidates.some(
      candidate => candidate.target === target,
    ) ? target : undefined;
  }

  afterDispatch(_event: CRCEvent): void {
    // Task 2 installs the structural hook only. Defaults begin in Task 3.
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
    if (this.disposed) return;
    this.disposed = true;
    if (this.eventRoot.focusPolicy === this) {
      this.eventRoot.focusPolicy = undefined;
    }
    this.pending = undefined;
    this.directionalStack = [];
    for (const boundary of this.committedBoundaries) {
      boundary.commit(Object.freeze([]));
    }
    this.committedBoundaries.clear();
    this.committedCandidates = Object.freeze([]);
    this.clearFocusState();
  }

  private commitRemovedTarget(target: CRCEventTargetRegistration): void {
    const retained = this.committedCandidates.filter(
      candidate => candidate.target !== target,
    );
    const candidates = Object.freeze(retained.map((candidate, sourceIndex) =>
      Object.freeze({ ...candidate, sourceIndex })
    ));
    this.committedCandidates = candidates;
    for (const boundary of this.committedBoundaries) {
      boundary.commit(Object.freeze(candidates.filter(
        candidate => candidate.directionalBoundary === boundary,
      )));
    }
    if (this.focusedTarget === target) this.clearFocusState();
  }

  private clearFocusState(): void {
    this.focusedTarget = undefined;
    this.focusVisible = false;
  }

  private assertLive(): void {
    if (this.disposed) throw new Error('CRC focus manager is disposed.');
  }
}

export function createFocusManager(eventRoot: CRCEventRoot): CRCFocusManager {
  return new CRCFocusManager(eventRoot);
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

export function createDirectionalBoundary(): CRCDirectionalBoundary {
  return new DirectionalBoundary();
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
