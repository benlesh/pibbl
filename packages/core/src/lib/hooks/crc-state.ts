import { GLOBAL_STATE } from '../global-state.js';
import { update } from '../update.js';

export type StateUpdater<T> = (update: T | ((oldValue: T) => T)) => void;

/**
 * Hook: creates a tuple of state and a state setter. Setting the state with the
 * state setter will cause the entire canvas CRC instance to be scheduled for
 * rerender. If you set the state multiple times before the next animation frame,
 * it will only rerender with whatever the most recent state is as of that animation frame.
 * @param init The initial state
 * @returns A tuple with the state, and a setter function
 */
export function crcState<T>(init?: T): readonly [T, StateUpdater<T>] {
  if (GLOBAL_STATE.componentIsMounting) {
    const ref = {
      type: 'state',
      value: init,
      setter,
    };

    const canvas = GLOBAL_STATE.canvas;

    function setter(newValueOrFactory: T | ((oldValue: T) => T)) {
      ref.value =
        typeof newValueOrFactory === 'function' ?
            (newValueOrFactory as any)(ref.value) :
          newValueOrFactory;
      update(canvas!, undefined, true);
    }

    GLOBAL_STATE.componentRefs!.refs.push(ref);
  }

  const ref =
    GLOBAL_STATE.componentRefs!.refs[GLOBAL_STATE.componentHookIndex++];
  return [ref.value, ref.setter] as const;
}
