import { GLOBAL_STATE } from '../global-state.js';
import { Teardowns } from '../teardowns.js';
import type { PibblComponentRefs, PibblInstance, PibblHookSlot } from '../types.js';

export const HOOK_CONTEXT_ERROR =
  'Pibbl hooks can only be called while rendering a component.';

let hookCallsForbiddenReason: string | undefined;

export interface HookContext {
  componentRefs: PibblComponentRefs<any>;
  pibblInstance: PibblInstance;
}

export function requireHookContext(): HookContext {
  if (hookCallsForbiddenReason !== undefined) {
    throw new Error(hookCallsForbiddenReason);
  }
  const componentRefs = GLOBAL_STATE.componentRefs;
  const pibblInstance = GLOBAL_STATE.currentPibblInstance;
  if (!componentRefs || !pibblInstance || !GLOBAL_STATE.canvas) {
    throw new Error(HOOK_CONTEXT_ERROR);
  }
  return { componentRefs, pibblInstance };
}

/**
 * @internal Prevents hook calls from nested user callbacks.
 *
 * @param reason - Diagnostic explanation reported if the callback tries to use a hook.
 * @param callback - Synchronous work to run with hooks forbidden.
 * @returns The callback's return value.
 *
 * @see {@link useInternalHookSlot}
 */
export function withHooksForbidden<T>(
  reason: string,
  callback: () => T,
): T {
  const previous = hookCallsForbiddenReason;
  hookCallsForbiddenReason = reason;
  try {
    return callback();
  } finally {
    hookCallsForbiddenReason = previous;
  }
}

export function useHookSlot<T>(
  kind: string,
  initialize: (teardowns: Teardowns) => T,
): PibblHookSlot<T> {
  const { componentRefs } = requireHookContext();
  const hookIndex = GLOBAL_STATE.componentHookIndex++;
  let slot = componentRefs.hooks[hookIndex] as PibblHookSlot<T> | undefined;

  if (GLOBAL_STATE.componentIsMounting) {
    const teardowns = new Teardowns();
    teardowns.follow(componentRefs.teardowns);
    slot = { kind, value: initialize(teardowns), teardowns };
    componentRefs.hooks[hookIndex] = slot;
  } else if (!slot) {
    throw new Error(
      `Rendered more Pibbl hooks than the previous render at hook ${hookIndex}.`,
    );
  } else if (slot.kind !== kind) {
    throw new Error(
      `Pibbl hook order changed at hook ${hookIndex}: expected ${slot.kind}, received ${kind}.`,
    );
  }

  return slot;
}

/**
 * Official-renderer friend hook for component-owned values and teardowns.
 *
 * @param kind - Hook kind used to validate stable hook ordering.
 * @param initialize - Initializer receiving the slot's teardown collection. See {@link Teardowns}.
 * @returns The current mounted hook slot. See {@link PibblHookSlot}.
 *
 * @see {@link withHooksForbidden}
 */
export function useInternalHookSlot<T>(
  kind: string,
  initialize: (teardowns: Teardowns) => T,
): PibblHookSlot<T> {
  return useHookSlot(kind, initialize);
}

export function finalizeHookSlots(componentRefs: PibblComponentRefs<any>): void {
  const usedHooks = GLOBAL_STATE.componentHookIndex;
  if (usedHooks >= componentRefs.hooks.length) return;

  for (const slot of componentRefs.hooks.slice(usedHooks)) {
    slot.teardowns.execute();
  }
  throw new Error(
    `Rendered fewer Pibbl hooks than the previous render: expected ${componentRefs.hooks.length}, received ${usedHooks}.`,
  );
}
