import { GLOBAL_STATE } from '../global-state.js';
import { shallowArrayEquals } from '../util/shallow-array-equals.js';

/**
 * Hook: creates a memoized value, similar to React's `useMemo`.
 * @param create The factory to create the memoized value.
 * @param deps The deps to check to see if the memoized value needs to be updated.
 * @returns The memoized value
 */
export function crcMemo<T>(create: () => T, deps: any[]): T {
  const componentRefs = GLOBAL_STATE.componentRefs!;
  const hookIndex = GLOBAL_STATE.componentHookIndex++;
  const refs = componentRefs.refs;

  if (GLOBAL_STATE.componentIsMounting) {
    refs[hookIndex] = { value: create(), deps };
  } else {
    const { deps: lastDeps } = refs[hookIndex];
    if (!deps || !shallowArrayEquals(deps, lastDeps)) {
      refs[hookIndex].value = create();
      refs[hookIndex].deps = deps;
    }
  }

  return refs[hookIndex].value;
}
