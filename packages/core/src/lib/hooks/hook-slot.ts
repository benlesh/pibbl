import { GLOBAL_STATE } from '../global-state.js';
import { Teardowns } from '../teardowns.js';
import type { CRCComponentRefs, CRCInstance, CRCHookSlot } from '../types.js';

export const HOOK_CONTEXT_ERROR =
  'CRC hooks can only be called while rendering a component.';

let hookCallsForbiddenReason: string | undefined;

export interface HookContext {
  componentRefs: CRCComponentRefs<any>;
  crcInstance: CRCInstance;
}

export function requireHookContext(): HookContext {
  if (hookCallsForbiddenReason !== undefined) {
    throw new Error(hookCallsForbiddenReason);
  }
  const componentRefs = GLOBAL_STATE.componentRefs;
  const crcInstance = GLOBAL_STATE.currentCRCInstance;
  if (!componentRefs || !crcInstance || !GLOBAL_STATE.canvas) {
    throw new Error(HOOK_CONTEXT_ERROR);
  }
  return { componentRefs, crcInstance };
}

/** @internal Prevents hook calls from nested user callbacks. */
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
): CRCHookSlot<T> {
  const { componentRefs } = requireHookContext();
  const hookIndex = GLOBAL_STATE.componentHookIndex++;
  let slot = componentRefs.hooks[hookIndex] as CRCHookSlot<T> | undefined;

  if (GLOBAL_STATE.componentIsMounting) {
    const teardowns = new Teardowns();
    teardowns.follow(componentRefs.teardowns);
    slot = { kind, value: initialize(teardowns), teardowns };
    componentRefs.hooks[hookIndex] = slot;
  } else if (!slot) {
    throw new Error(
      `Rendered more CRC hooks than the previous render at hook ${hookIndex}.`,
    );
  } else if (slot.kind !== kind) {
    throw new Error(
      `CRC hook order changed at hook ${hookIndex}: expected ${slot.kind}, received ${kind}.`,
    );
  }

  return slot;
}

/** Official-renderer friend hook for component-owned values and teardowns. */
export function useInternalHookSlot<T>(
  kind: string,
  initialize: (teardowns: Teardowns) => T,
): CRCHookSlot<T> {
  return useHookSlot(kind, initialize);
}

export function finalizeHookSlots(componentRefs: CRCComponentRefs<any>): void {
  const usedHooks = GLOBAL_STATE.componentHookIndex;
  if (usedHooks >= componentRefs.hooks.length) return;

  for (const slot of componentRefs.hooks.slice(usedHooks)) {
    slot.teardowns.execute();
  }
  throw new Error(
    `Rendered fewer CRC hooks than the previous render: expected ${componentRefs.hooks.length}, received ${usedHooks}.`,
  );
}
