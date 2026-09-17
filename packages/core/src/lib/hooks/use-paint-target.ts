import type {
  CRCEventHandlers,
  CRCEventTargetOptions,
  CRCEventTargetSnapshot,
  CRCPointerEvents,
} from '../events/types.js';
import {
  createTarget,
  releaseTarget,
  updateTarget,
  type CRCEventTargetRegistration,
} from '../events/registrations.js';
import { GLOBAL_STATE } from '../global-state.js';
import { requireHookContext, useHookSlot } from './hook-slot.js';

const UNFOCUSED_SNAPSHOT: CRCEventTargetSnapshot = Object.freeze({
  isFocused: false,
  isFocusVisible: false,
});

/** @internal Keeps a built-in drawing primitive in paint hit testing by default. */
export function usePaintTarget(
  handlers: CRCEventHandlers,
  options: CRCEventTargetOptions,
  pointerEvents: CRCPointerEvents = 'auto',
): CRCEventTargetSnapshot {
  const { componentRefs, crcInstance } = requireHookContext();
  const hookIndex = GLOBAL_STATE.componentHookIndex;
  const slot = useHookSlot<CRCEventTargetRegistration>(
    'paintTarget',
    teardowns => {
      const target = createTarget(crcInstance, componentRefs, hookIndex);
      teardowns.add(() => releaseTarget(target));
      return target;
    },
  );
  const target = slot.value;
  if (pointerEvents === 'none') {
    releaseTarget(target);
  } else {
    updateTarget(target, handlers, options, true);
  }
  return crcInstance.eventRoot.focusPolicy?.snapshot(target) ??
    UNFOCUSED_SNAPSHOT;
}
