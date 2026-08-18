import { getLayoutBox } from '../layout/context.js';
import type { LayoutBox } from '../layout/types.js';

/** Returns the current stable child-local allocation without scheduling work. */
export function crcLayoutBox(): Readonly<LayoutBox> {
  return getLayoutBox();
}
