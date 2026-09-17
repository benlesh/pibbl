import { GLOBAL_STATE } from '../global-state.js';
import { update } from '../update.js';
import { requireHookContext, useHookSlot } from './hook-slot.js';

export type StateUpdater<T> = (update: T | ((oldValue: T) => T)) => void;

/**
 * Hook: creates a tuple of state and a state setter. Setting the state with the
 * state setter will cause the entire canvas CRC instance to be scheduled for
 * rerender. If you set the state multiple times before the next animation frame,
 * it will only rerender with whatever the most recent state is as of that animation frame.
 * @param init The initial state
 * @returns A tuple with the state, and a setter function
 */
export function useState<T>(init?: T): readonly [T, StateUpdater<T>] {
  const { componentRefs, crcInstance } = requireHookContext();
  const canvas = GLOBAL_STATE.canvas!;
  const slot = useHookSlot('state', () => {
    const ref = {
      value: init as T,
      setter,
    };

    function setter(newValueOrFactory: T | ((oldValue: T) => T)) {
      if (
        GLOBAL_STATE.crcInstances.get(canvas) !== crcInstance ||
        crcInstance.mainTeardowns.closed ||
        componentRefs.teardowns.closed ||
        crcInstance.refs.get(componentRefs.id) !== componentRefs
      ) {
        return;
      }

      ref.value =
        typeof newValueOrFactory === 'function' ?
            (newValueOrFactory as any)(ref.value) :
          newValueOrFactory;
      update(canvas, undefined, true);
    }

    return ref;
  });

  const ref = slot.value;
  return [ref.value, ref.setter] as const;
}
