import type { SvgPathOptions } from '../geometry/svg-path.js';
import { useValueMemoSlot } from './use-value-memo-slot.js';
import { createSvgPath } from '../geometry/svg-path.js';

/**
 * Creates a memoized Path2D for an SVG data string.
 * @param svgPathData - SVG path data to parse and memoize.
 * @returns A memoized Path2D
 *
 * @see {@link SvgPathOptions}
 * @see {@link createSvgPath}
 */
export function useSvgPath(svgPathData: string): Path2D {
  return useValueMemoSlot(
    'svgPath',
    () => createSvgPath({ d: svgPathData }),
    [svgPathData],
  );
}
