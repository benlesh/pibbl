import type {
  PibblEventHandlers,
  PibblEventTargetOptions,
  PibblEventTargetSnapshot,
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

/**
 * Registers a logical event target and returns its current focus and interaction snapshot.
 *
 * @param handlers - Handlers for this logical event target. See {@link PibblEventHandlers}.
 * @param options - Hit geometry, focus, and target participation options. See
 * {@link PibblEventTargetOptions} .
 * @returns The registered target's snapshot. See {@link PibblEventTargetSnapshot}.
 *
 * @see {@link PibblEventHandlers}
 * @see {@link PibblEventTargetOptions}
 * @see {@link PibblEventTargetSnapshot}
 */
export function useEventTarget(
  handlers: PibblEventHandlers,
  options: PibblEventTargetOptions,
): PibblEventTargetSnapshot {
  const { componentRefs, pibblInstance } = requireHookContext();
  const hookIndex = GLOBAL_STATE.componentHookIndex;
  const slot = useHookSlot<PibblEventTargetRegistration>(
    'eventTarget',
    teardowns => {
      const target = createTarget(pibblInstance, componentRefs, hookIndex);
      teardowns.add(() => releaseTarget(target));
      return target;
    },
  );
  const target = slot.value;
  updateTarget(target, handlers, options);
  return pibblInstance.eventRoot.focusPolicy?.snapshot(target) ??
    UNFOCUSED_SNAPSHOT;
}
