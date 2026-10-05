import type { useInternalHookSlot } from './hook-slot.js';
import { GLOBAL_STATE } from '../global-state.js';
import type { CRCRenderTransaction } from '../types.js';
import { useHookSlot } from './hook-slot.js';

interface ValueMemoCandidate<T> {
  readonly dependencies: readonly unknown[];
  readonly value: T;
}

interface ValueMemoSlot<T> {
  readonly candidates: WeakMap<CRCRenderTransaction, ValueMemoCandidate<T>>;
  dependencies: readonly unknown[];
  renderRevision: number;
  value: T;
}

/**
 * Private direct-value cache for specialized hooks and renderer internals.
 *
 * @param kind - Hook kind used to validate stable hook ordering.
 * @param create - Factory called when the slot is created or dependencies change.
 * @param dependencies - Values compared to decide whether to recreate the memoized value.
 * @returns The value retained for the current dependencies.
 *
 * @see {@link useInternalHookSlot}
 */
export function useValueMemoSlot<T>(
  kind: string,
  create: () => T,
  dependencies: readonly unknown[],
): T {
  const snapshot = [...dependencies];
  const slot = useHookSlot<ValueMemoSlot<T>>(kind, () => ({
    candidates: new WeakMap(),
    dependencies: snapshot,
    renderRevision: 0,
    value: create(),
  })).value;
  const revision = ++slot.renderRevision;
  if (sameDependencies(slot.dependencies, snapshot)) return slot.value;

  const transaction = GLOBAL_STATE.renderTransaction;
  if (!transaction) {
    throw new Error('CRC value memoization requires an active render transaction.');
  }
  let candidate = slot.candidates.get(transaction);
  if (!candidate || !sameDependencies(candidate.dependencies, snapshot)) {
    candidate = {
      dependencies: snapshot,
      value: create(),
    };
    slot.candidates.set(transaction, candidate);
  }
  transaction.onFinish(success => {
    if (slot.candidates.get(transaction) !== candidate) return;
    if (revision !== slot.renderRevision) return;
    slot.candidates.delete(transaction);
    if (!success) return;
    slot.dependencies = candidate.dependencies;
    slot.value = candidate.value;
  });
  return candidate.value;
}

function sameDependencies(
  previous: readonly unknown[],
  next: readonly unknown[],
): boolean {
  if (previous.length !== next.length) return false;
  for (let index = 0; index < previous.length; index += 1) {
    if (!Object.is(previous[index], next[index])) return false;
  }
  return true;
}
