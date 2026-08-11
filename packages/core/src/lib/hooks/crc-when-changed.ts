import { GLOBAL_STATE } from '../global-state.js';
import { shallowArrayEquals } from '../util/shallow-array-equals.js';

/**
 * Does a shallow diff check on the deps. If they've changed, it will synchronously
 * call the provided call back. This is not like useEffect, but it's useful when
 * a developer wants to diff a value. Also allows for a teardown to be returned that
 * is called when deps change (very, very similar to useEffect, just ALWAYS synchronous).
 * If you have work in here that only sets state, you should be using {@link crcMemo}
 * instead.
 * @param callback The SYNCHRONOUS callback when the deps have changed
 * @param deps The deps to check for changes.
 */
export function crcWhenChanged(
  callback: () => (() => void) | void,
  deps?: any[],
) {
  if (GLOBAL_STATE.componentIsMounting) {
    const ref = {
      lastDeps: undefined,
      teardown: undefined,
    };

    GLOBAL_STATE.componentRefs!.refs.push(ref);
  }

  const hookIndex = GLOBAL_STATE.componentHookIndex++;
  const ref = GLOBAL_STATE.componentRefs!.refs[hookIndex];
  if (!ref.lastDeps || !deps || !shallowArrayEquals(deps, ref.lastDeps)) {
    const lastTeardown = ref.teardown;
    const mainTeardowns = GLOBAL_STATE.currentCRCInstance!.mainTeardowns;
    if (lastTeardown) {
      mainTeardowns.add(lastTeardown);
      GLOBAL_STATE.componentRefs!.teardowns.remove(lastTeardown);
      lastTeardown();
    }
    ref.lastDeps = deps;
    const newTeardown = callback();
    if (newTeardown) {
      ref.teardown = newTeardown;
      mainTeardowns.add(newTeardown);
      GLOBAL_STATE.componentRefs!.teardowns.add(newTeardown);
    }
  }
}
