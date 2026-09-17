import type {
  CRCEventHandlers,
  CRCEventTargetOptions,
  CRCEventTargetSnapshot,
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

export function useEventTarget(
  handlers: CRCEventHandlers,
  options: CRCEventTargetOptions,
): CRCEventTargetSnapshot {
  const { componentRefs, crcInstance } = requireHookContext();
  const hookIndex = GLOBAL_STATE.componentHookIndex;
  const slot = useHookSlot<CRCEventTargetRegistration>(
    'eventTarget',
    teardowns => {
      const target = createTarget(crcInstance, componentRefs, hookIndex);
      teardowns.add(() => releaseTarget(target));
      return target;
    },
  );
  const target = slot.value;
  updateTarget(target, handlers, options);
  return crcInstance.eventRoot.focusPolicy?.snapshot(target) ??
    UNFOCUSED_SNAPSHOT;
}
