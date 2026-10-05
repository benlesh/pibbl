import {
  createListener,
  releaseListener,
  updateListener,
  type CRCEventListenerRegistration,
} from '../events/registrations.js';
import type { CRCEventHandlers } from '../events/types.js';
import { GLOBAL_STATE } from '../global-state.js';
import { requireHookContext, useHookSlot } from './hook-slot.js';

/**
 * Registers the current component's event handlers with mount-owned cleanup.
 *
 * @param handlers - Handlers to register for the current component's event participation. See
 * {@link CRCEventHandlers} .
 *
 * @see {@link CRCEventHandlers}
 */
export function useEventListener(handlers: CRCEventHandlers): void {
  const { componentRefs, crcInstance } = requireHookContext();
  const hookIndex = GLOBAL_STATE.componentHookIndex;
  const slot = useHookSlot<CRCEventListenerRegistration>(
    'eventListener',
    teardowns => {
      const listener = createListener(crcInstance, componentRefs, hookIndex);
      teardowns.add(() => releaseListener(listener));
      return listener;
    },
  );
  updateListener(slot.value, handlers);
}
