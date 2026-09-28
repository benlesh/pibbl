import { GLOBAL_STATE } from '../global-state.js';
import type { CRCComponentRefs, CRCInstance, CRCRenderTransaction } from '../types.js';
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

interface CRCComputedHookSlot<T> {
  readonly candidates: WeakMap<
    CRCRenderTransaction,
    ComputedFormulaCandidate<T>
  >;
  readonly componentRefs: CRCComponentRefs<any>;
  readonly crcInstance: CRCInstance;
  dependencies: readonly unknown[] | undefined;
  readonly output: Signal<T>;
  readonly signal: Signal<T>;
  renderRevision: number;
}

/** Creates one component-owned lazy computed signal for a mounted hook slot. */
export function useComputed<T>(
  compute: () => T,
  dependencies?: readonly unknown[],
  options?: SignalOptions<T>,
): Signal<T> {
  const { componentRefs, crcInstance } = requireHookContext();
  const formula = guardedFormula(compute);
  const dependencySnapshot = snapshotDependencies(dependencies);
  const slot = useHookSlot<CRCComputedHookSlot<T>>('computed', () => {
    const output = computed(formula, options);
    const candidates = new WeakMap<
      CRCRenderTransaction,
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
      crcInstance,
      dependencies: dependencySnapshot,
      output,
      signal,
      renderRevision: 0,
    };
  }).value;

  const transaction = GLOBAL_STATE.renderTransaction;
  if (!transaction) {
    throw new Error('useComputed requires an active CRC render transaction.');
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
    'CRC hooks cannot be called inside a useComputed formula.',
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

function isCurrentSlot(slot: CRCComputedHookSlot<unknown>): boolean {
  return !slot.componentRefs.teardowns.closed &&
    !slot.crcInstance.mainTeardowns.closed &&
    GLOBAL_STATE.crcInstances.get(slot.crcInstance.canvas) === slot.crcInstance &&
    slot.crcInstance.refs.get(slot.componentRefs.id) === slot.componentRefs;
}
