import { getLayoutBox } from '../layout/context.js';
import type { LayoutBox } from '../layout/types.js';

/**
 * Returns the current stable child-local allocation without scheduling work.
 *
 * @returns The current parent-assigned layout box in logical coordinates. See {@link LayoutBox}.
 *
 * @see {@link LayoutBox}
 */
export function useLayoutBox(): Readonly<LayoutBox> {
  return getLayoutBox();
}
