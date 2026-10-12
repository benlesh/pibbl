import type {
  PibblEventHandlers,
  PibblEventTargetOptions,
  PibblEventTargetSnapshot,
  PibblPointerEvents,
} from '../events/types.js';
import {
  createTarget,
  releaseTarget,
  updateTarget,
  type PibblEventTargetRegistration,
} from '../events/registrations.js';
import { GLOBAL_STATE } from '../global-state.js';
import { requireHookContext, useHookSlot } from './hook-slot.js';

const UNFOCUSED_SNAPSHOT: PibblEventTargetSnapshot = Object.freeze({
  isFocused: false,
  isFocusVisible: false,
});

/** @internal Keeps a built-in drawing primitive in paint hit testing by default. */
export function usePaintTarget(
  handlers: PibblEventHandlers,
  options: PibblEventTargetOptions,
  pointerEvents: PibblPointerEvents = 'auto',
): PibblEventTargetSnapshot {
  const { componentRefs, pibblInstance } = requireHookContext();
  const hookIndex = GLOBAL_STATE.componentHookIndex;
  const slot = useHookSlot<PibblEventTargetRegistration>(
    'paintTarget',
    teardowns => {
      const target = createTarget(pibblInstance, componentRefs, hookIndex);
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
  return pibblInstance.eventRoot.focusPolicy?.snapshot(target) ??
    UNFOCUSED_SNAPSHOT;
}
