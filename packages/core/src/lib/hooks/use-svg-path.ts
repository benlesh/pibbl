import { useValueMemoSlot } from './use-value-memo-slot.js';
import { createSvgPath } from '../geometry/svg-path.js';

/**
 * Creates a memoized Path2D for an SVG data string.
 * @returns A memoized Path2D
 */
export function useSvgPath(svgPathData: string): Path2D {
  return useValueMemoSlot(
    'svgPath',
    () => createSvgPath({ d: svgPathData }),
    [svgPathData],
  );
}
