import { GLOBAL_STATE } from '../global-state.js';
import type { PibblComponentRefs, PibblInstance, PibblRenderTransaction } from '../types.js';
import {
  adoptComputedFormulaCandidate,
  computed,
  createComputedFormulaCandidate,
  createComputedSignalAlias,
  readComputedFormulaCandidate,
  replaceComputedFormula,
  type ComputedFormulaCandidate,
} from '../signals/graph.js';
import type { Signal, SignalOptions } from '../signals/types.js';
import {
  requireHookContext,
  useHookSlot,
  withHooksForbidden,
} from './hook-slot.js';

interface PibblComputedHookSlot<T> {
  readonly candidates: WeakMap<
    PibblRenderTransaction,
    ComputedFormulaCandidate<T>
  >;
  readonly componentRefs: PibblComponentRefs<any>;
  readonly pibblInstance: PibblInstance;
  dependencies: readonly unknown[] | undefined;
  readonly output: Signal<T>;
  readonly signal: Signal<T>;
  renderRevision: number;
}

/**
 * Creates one component-owned lazy computed signal for a mounted hook slot.
 *
 * @param compute - Synchronous calculation whose signal reads are tracked.
 * @param dependencies - Values controlling replacement of the captured computation.
 * @param options - Equality comparison and optional diagnostic name. See {@link SignalOptions}.
 * @returns A mount-owned readonly computed signal. See {@link Signal}.
 *
 * @see {@link SignalOptions}
 * @see {@link Signal}
 */
export function useComputed<T>(
  compute: () => T,
  dependencies?: readonly unknown[],
  options?: SignalOptions<T>,
): Signal<T> {
  const { componentRefs, pibblInstance } = requireHookContext();
  const formula = guardedFormula(compute);
  const dependencySnapshot = snapshotDependencies(dependencies);
  const slot = useHookSlot<PibblComputedHookSlot<T>>('computed', () => {
    const output = computed(formula, options);
    const candidates = new WeakMap<
      PibblRenderTransaction,
      ComputedFormulaCandidate<T>
    >();
    const signal = createComputedSignalAlias(output, () => {
      const transaction = GLOBAL_STATE.renderTransaction;
      const candidate = transaction === undefined ? undefined :
        candidates.get(transaction);
      return candidate === undefined ? output.get() :
        readComputedFormulaCandidate(output, candidate);
    });
    return {
      candidates,
      componentRefs,
      pibblInstance,
      dependencies: dependencySnapshot,
      output,
      signal,
      renderRevision: 0,
    };
  }).value;

  const transaction = GLOBAL_STATE.renderTransaction;
  if (!transaction) {
    throw new Error('useComputed requires an active Pibbl render transaction.');
  }
  const dependenciesChanged = !dependencySnapshotsEqual(
    slot.dependencies,
    dependencySnapshot,
  );
  const candidate = dependenciesChanged ?
    createComputedFormulaCandidate(slot.output, formula) : undefined;
  if (candidate !== undefined) slot.candidates.set(transaction, candidate);

  const revision = ++slot.renderRevision;
  transaction.onFinish(success => {
    if (
      candidate !== undefined &&
      slot.candidates.get(transaction) === candidate
    ) {
      slot.candidates.delete(transaction);
    }
    if (!success || revision !== slot.renderRevision || !isCurrentSlot(slot)) {
      return;
    }
    if (candidate === undefined) {
      replaceComputedFormula(slot.output, formula, false);
      return;
    }

    slot.dependencies = dependencySnapshot;
    if (candidate.evaluated) {
      adoptComputedFormulaCandidate(slot.output, candidate, formula);
    } else {
      replaceComputedFormula(slot.output, formula, true);
    }
  });
  return slot.signal;
}

function guardedFormula<T>(compute: () => T): () => T {
  return () => withHooksForbidden(
    'Pibbl hooks cannot be called inside a useComputed formula.',
    compute,
  );
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

function isCurrentSlot(slot: PibblComputedHookSlot<unknown>): boolean {
  return !slot.componentRefs.teardowns.closed &&
    !slot.pibblInstance.mainTeardowns.closed &&
    GLOBAL_STATE.pibblInstances.get(slot.pibblInstance.canvas) === slot.pibblInstance &&
    slot.pibblInstance.refs.get(slot.componentRefs.id) === slot.componentRefs;
}
