import { GLOBAL_STATE } from '../global-state.js';
import type { LayoutBox } from './types.js';

/** @internal A pushed allocation remains active through ordinary components. */
export function hasParentLayoutAllocation(): boolean {
  return (GLOBAL_STATE.layoutStack?.length ?? 0) > 1;
}

/** @internal Inherited inline direction; roots default to LTR. */
export function getLayoutDirection(): 'ltr' | 'rtl' {
  return GLOBAL_STATE.layoutStack?.at(-1)?.layoutDirection ?? 'ltr';
}

export function getLayoutBox(): Readonly<LayoutBox> {
  const context = GLOBAL_STATE.layoutStack?.at(-1);
  if (!context) {
    throw new Error('No Pibbl layout context is available');
  }
  return context.allocation;
}

export function getPercentageBasis(): Readonly<LayoutBox> {
  const context = GLOBAL_STATE.layoutStack?.at(-1);
  if (!context) {
    throw new Error('No Pibbl layout context is available');
  }
  return context.percentageBasis;
}

/**
 * Pushes a layout allocation for nested evaluation and returns the callback that restores the
 * previous allocation.
 *
 * @param box - Parent allocation to expose to child layout hooks. See {@link LayoutBox}.
 * @param options - Optional resolved inline direction; omission inherits the parent. See {@link LayoutBox}.
 * @returns A function restoring the previous layout box.
 *
 * @see {@link LayoutBox}
 */
export function pushLayoutBox(box: Readonly<LayoutBox>, options?: { readonly layoutDirection?: 'ltr' | 'rtl' }): () => void {
  const stack = GLOBAL_STATE.layoutStack;
  if (!stack) {
    throw new Error('No Pibbl layout context is available');
  }
  const parent = stack.at(-1);
  if (!parent) {
    throw new Error('No Pibbl parent layout context is available');
  }
  const context = { allocation: box, percentageBasis: parent.allocation, layoutDirection: options?.layoutDirection ?? parent.layoutDirection ?? 'ltr' };
  stack.push(context);
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    if (stack.at(-1) !== context) {
      throw new Error('Pibbl layout context was restored out of order');
    }
    stack.pop();
  };
}
