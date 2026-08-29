import {
  createListener,
  releaseListener,
  updateListener,
  type CRCEventListenerRegistration,
} from '../events/registrations.js';
import type { CRCEventHandlers } from '../events/types.js';
import { GLOBAL_STATE } from '../global-state.js';
import { requireHookContext, useHookSlot } from './hook-slot.js';

export function crcEventListener(handlers: CRCEventHandlers): void {
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
