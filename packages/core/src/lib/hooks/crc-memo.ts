import { GLOBAL_STATE } from '../global-state.js';
import { shallowArrayEquals } from '../util/shallow-array-equals.js';
import { useHookSlot } from './hook-slot.js';

/**
 * Hook: creates a memoized value, similar to React's `useMemo`.
 * @param create The factory to create the memoized value.
 * @param deps The deps to check to see if the memoized value needs to be updated.
 * @returns The memoized value
 */
export function crcMemo<T>(create: () => T, deps: any[]): T {
  return crcMemoSlot('memo', create, deps);
}

export function crcMemoSlot<T>(
  kind: string,
  create: () => T,
  deps: any[],
): T {
  const mounting = GLOBAL_STATE.componentIsMounting;
  const slot = useHookSlot(kind, () => ({ value: create(), deps }));
  if (!mounting && !shallowArrayEquals(deps, slot.value.deps)) {
    const value = create();
    slot.value.value = value;
    slot.value.deps = deps;
  }
  return slot.value.value;
}
