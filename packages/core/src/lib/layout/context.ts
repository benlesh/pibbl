import { GLOBAL_STATE } from '../global-state.js';
import type { LayoutBox } from './types.js';

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
 * @returns A function restoring the previous layout box.
 *
 * @see {@link LayoutBox}
 */
export function pushLayoutBox(box: Readonly<LayoutBox>): () => void {
  const stack = GLOBAL_STATE.layoutStack;
  if (!stack) {
    throw new Error('No Pibbl layout context is available');
  }
  const parent = stack.at(-1);
  if (!parent) {
    throw new Error('No Pibbl parent layout context is available');
  }
  const context = { allocation: box, percentageBasis: parent.allocation };
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
