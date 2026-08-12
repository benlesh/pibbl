import { runTeardown } from '../teardowns.js';
import { shallowArrayEquals } from '../util/shallow-array-equals.js';
import { useHookSlot } from './hook-slot.js';

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
  const slot = useHookSlot('whenChanged', teardowns => {
    const ref: {
      lastDeps: any[] | undefined;
      teardown: (() => void) | undefined;
    } = {
      lastDeps: undefined,
      teardown: undefined,
    };
    teardowns.add(() => {
      ref.teardown?.();
      ref.teardown = undefined;
    });
    return ref;
  });
  const ref = slot.value;
  if (!ref.lastDeps || !deps || !shallowArrayEquals(deps, ref.lastDeps)) {
    const lastTeardown = ref.teardown;
    ref.teardown = undefined;
    if (lastTeardown) {
      runTeardown(lastTeardown);
    }
    ref.lastDeps = deps;
    const newTeardown = callback();
    ref.teardown = newTeardown || undefined;
  }
}
