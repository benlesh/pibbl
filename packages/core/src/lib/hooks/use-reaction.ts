import { GLOBAL_STATE } from '../global-state.js';
import { queueReactionCompletion } from '../scheduler/realm-scheduler.js';
import {
  recordReactionCleanup,
  recordReactionConsumerCreated,
  recordReactionConsumerReleased,
  recordReactionEdgeCreated,
  recordReactionEdgeReleased,
  recordReactionFailure,
  recordReactionRun,
  untracked,
  withSignalTracking,
  withSignalWriteForbidden,
} from '../signals/graph.js';
import {
  beginReactiveCollection,
  collectReactiveDependency,
  disposeReactiveConsumer,
  finishReactiveCollection,
  linkReactiveEdgeToSource,
  unlinkReactiveEdgeFromSource,
  type ReactiveEdge,
  type SignalDependencyConsumer,
} from '../signals/edge.js';
import type { PibblComponentRefs, PibblInstance } from '../types.js';
import {
  requireHookContext,
  useHookSlot,
  withHooksForbidden,
} from './hook-slot.js';

/**
 * Options controlling when a signal reaction runs and how it is named for diagnostics.
 *
 * @see {@link useReaction}
 */
export interface PibblReactionOptions {
  /** Optional label used in diagnostics. See {@link PibblReactionOptions}. */
  readonly debugName?: string;
}

interface ReactionConsumerState extends SignalDependencyConsumer {
  readonly kind: 'reaction';
  readonly ownerComponent: PibblComponentRefs<any>;
  collecting: boolean;
  disposed: boolean;
}

interface PibblReactionHookSlot {
  active: boolean;
  cancelPending: (() => void) | undefined;
  cleanup: (() => void) | undefined;
  readonly componentRefs: PibblComponentRefs<any>;
  consumer: ReactionConsumerState | undefined;
  readonly pibblInstance: PibblInstance;
  dependencies: readonly unknown[] | undefined;
  readonly debugName: string | undefined;
  mounted: boolean;
  pending: boolean;
  pendingGeneration: number;
  renderRevision: number;
  setup: () => void | (() => void);
}

/**
 * Owns one Complete-phase imperative reaction for a mounted hook slot.
 *
 * @param setup - Setup callback; its optional returned cleanup runs when replaced or disposed.
 * @param dependencies - Values controlling when setup is repeated.
 * @param options - Optional diagnostic name for this reaction. See {@link PibblReactionOptions}.
 *
 * @see {@link PibblReactionOptions}
 */
export function useReaction(
  setup: () => void | (() => void),
  dependencies?: readonly unknown[],
  options: PibblReactionOptions = {},
): void {
  const { componentRefs, pibblInstance } = requireHookContext();
  const dependencySnapshot = snapshotDependencies(dependencies);
  const slot = useHookSlot<PibblReactionHookSlot>('reaction', teardowns => {
    let value!: PibblReactionHookSlot;
    value = {
      active: true,
      cancelPending: undefined,
      cleanup: undefined,
      componentRefs,
      consumer: undefined,
      pibblInstance,
      dependencies: undefined,
      debugName: options.debugName,
      mounted: false,
      pending: false,
      pendingGeneration: 0,
      renderRevision: 0,
      setup,
    };
    teardowns.add(() => disposeReaction(value));
    return value;
  }).value;

  const transaction = GLOBAL_STATE.renderTransaction;
  if (!transaction) {
    throw new Error('useReaction requires an active Pibbl render transaction.');
  }
  const dependenciesChanged = !slot.mounted || !dependencySnapshotsEqual(
    slot.dependencies,
    dependencySnapshot,
  );
  const revision = ++slot.renderRevision;
  transaction.onFinish(success => {
    if (!success || revision !== slot.renderRevision || !isCurrentSlot(slot)) {
      return;
    }
    slot.setup = setup;
    slot.dependencies = dependencySnapshot;
    if (!slot.mounted) {
      slot.mounted = true;
      slot.consumer = createReactionConsumer(() => scheduleReaction(slot), slot.componentRefs);
    }
    if (dependenciesChanged) {
      clearPendingReaction(slot);
      runReaction(slot);
    }
  });
}

function createReactionConsumer(
  invalidate: () => void,
  ownerComponent: PibblComponentRefs<any>,
): ReactionConsumerState {
  const state: ReactionConsumerState = {
    kind: 'reaction',
    ownerComponent,
    dependencyHead: undefined,
    dependencyTail: undefined,
    dependencyFreeHead: undefined,
    dependencyFreeCount: 0,
    dependencyCount: 0,
    dependencyHighWater: 0,
    collectionCursor: undefined,
    collectionGeneration: 0,
    collecting: false,
    disposed: false,
    addDependency(node): void {
      if (state.collecting) collectReactiveDependency(state, node);
    },
    notify(): void {
      if (!state.disposed) invalidate();
    },
  };
  recordReactionConsumerCreated();
  return state;
}

function collectReactionReads<T>(
  consumer: ReactionConsumerState,
  callback: () => T,
): T {
  beginReactiveCollection(consumer);
  consumer.collecting = true;
  let result!: T;
  let failure: unknown;
  let failed = false;
  try {
    result = withSignalTracking(consumer, callback);
  } catch (error) {
    failed = true;
    failure = error;
  } finally {
    consumer.collecting = false;
    finishReactiveCollection(
      consumer,
      edge => {
        if (!edge.sourceLinked) {
          const source = edge.source!;
          linkReactiveEdgeToSource(edge, source.observe?.());
          recordReactionEdgeCreated();
        }
        edge.observedVersion = edge.source!.version;
        edge.collectionKind = undefined;
      },
      releaseReactionEdge,
    );
  }
  if (failed) throw failure;
  return result;
}

function scheduleReaction(slot: PibblReactionHookSlot): void {
  if (!slot.active || slot.pending) return;
  slot.pending = true;
  const generation = ++slot.pendingGeneration;
  slot.cancelPending = queueReactionCompletion(() => {
    if (
      !slot.active ||
      !slot.pending ||
      generation !== slot.pendingGeneration
    ) {
      return;
    }
    slot.pending = false;
    slot.cancelPending = undefined;
    runReaction(slot);
  });
}

function runReaction(slot: PibblReactionHookSlot): void {
  if (!slot.active || slot.consumer === undefined) return;
  const failures: unknown[] = [];
  const cleanup = slot.cleanup;
  slot.cleanup = undefined;
  if (cleanup !== undefined) {
    try {
      runCleanup(cleanup);
    } catch (error) {
      recordReactionFailure();
      failures.push(error);
    }
  }

  recordReactionRun();
  try {
    const nextCleanup = collectReactionReads(
      slot.consumer,
      () => withSignalWriteForbidden(
        'Cannot write to a signal during useReaction setup.',
        () => withHooksForbidden(
          'Pibbl hooks cannot be called inside useReaction setup.',
          slot.setup,
        ),
      ),
    );
    if (typeof nextCleanup === 'function') slot.cleanup = nextCleanup;
  } catch (error) {
    recordReactionFailure();
    failures.push(error);
  }
  throwReactionFailures(failures, slot.debugName);
}

function runCleanup(cleanup: () => void): void {
  recordReactionCleanup();
  untracked(() => withSignalWriteForbidden(
    'Cannot write to a signal during useReaction cleanup.',
    () => withHooksForbidden(
      'Pibbl hooks cannot be called inside useReaction cleanup.',
      cleanup,
    ),
  ));
}

function disposeReaction(slot: PibblReactionHookSlot): void {
  if (!slot.active) return;
  slot.active = false;
  clearPendingReaction(slot);
  if (slot.consumer !== undefined) {
    slot.consumer.disposed = true;
    disposeReactiveConsumer(slot.consumer, releaseReactionEdge);
    slot.consumer = undefined;
    recordReactionConsumerReleased();
  }
  const cleanup = slot.cleanup;
  slot.cleanup = undefined;
  if (cleanup !== undefined) {
    try {
      runCleanup(cleanup);
    } catch (error) {
      recordReactionFailure();
      throw error;
    }
  }
}

function clearPendingReaction(slot: PibblReactionHookSlot): void {
  slot.pending = false;
  slot.pendingGeneration++;
  const cancel = slot.cancelPending;
  slot.cancelPending = undefined;
  cancel?.();
}

function releaseReactionEdge(edge: ReactiveEdge): void {
  if (!edge.sourceLinked) return;
  unlinkReactiveEdgeFromSource(edge);
  recordReactionEdgeReleased();
}

function snapshotDependencies(
  dependencies: readonly unknown[] | undefined,
): readonly unknown[] | undefined {
  return dependencies === undefined ? undefined : [...dependencies];
}

function dependencySnapshotsEqual(
  previous: readonly unknown[] | undefined,
  next: readonly unknown[] | undefined,
): boolean {
  if (previous === undefined || next === undefined) return previous === next;
  if (previous.length !== next.length) return false;
  for (let index = 0; index < previous.length; index++) {
    if (!Object.is(previous[index], next[index])) return false;
  }
  return true;
}

function isCurrentSlot(slot: PibblReactionHookSlot): boolean {
  return slot.active &&
    !slot.componentRefs.teardowns.closed &&
    !slot.pibblInstance.mainTeardowns.closed &&
    GLOBAL_STATE.pibblInstances.get(slot.pibblInstance.canvas) === slot.pibblInstance &&
    slot.pibblInstance.refs.get(slot.componentRefs.id) === slot.componentRefs;
}

function throwReactionFailures(
  failures: readonly unknown[],
  debugName: string | undefined,
): void {
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1) {
    const label = debugName === undefined ? '' : ` "${debugName}"`;
    throw new AggregateError(
      failures,
      `Pibbl reaction${label} setup and cleanup failed.`,
    );
  }
}
