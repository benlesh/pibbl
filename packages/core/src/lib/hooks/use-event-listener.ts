import {
  createListener,
  releaseListener,
  updateListener,
  type PibblEventListenerRegistration,
} from '../events/registrations.js';
import type { PibblEventHandlers } from '../events/types.js';
import { GLOBAL_STATE } from '../global-state.js';
import { requireHookContext, useHookSlot } from './hook-slot.js';

/**
 * Registers the current component's event handlers with mount-owned cleanup.
 *
 * @param handlers - Handlers to register for the current component's event participation. See
 * {@link PibblEventHandlers} .
 *
 * @see {@link PibblEventHandlers}
 */
export function useEventListener(handlers: PibblEventHandlers): void {
  const { componentRefs, pibblInstance } = requireHookContext();
  const hookIndex = GLOBAL_STATE.componentHookIndex;
  const slot = useHookSlot<PibblEventListenerRegistration>(
    'eventListener',
    teardowns => {
      const listener = createListener(pibblInstance, componentRefs, hookIndex);
      teardowns.add(() => releaseListener(listener));
      return listener;
    },
  );
  updateListener(slot.value, handlers);
}
