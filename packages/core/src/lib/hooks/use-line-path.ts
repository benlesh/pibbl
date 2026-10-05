import type { LinePathOptions } from '../geometry/line.js';
import { createLinePath } from '../geometry/line.js';
import { useValueMemoSlot } from './use-value-memo-slot.js';

/**
 * Creates a memoized Path2D for a set of line coordinates.
 * @param coords - Ordered horizontal and vertical coordinate pairs.
 * @param config - Whether to close the path by connecting its last vertex to its first.
 * @returns A memoized Path2D
 *
 * @see {@link LinePathOptions}
 * @see {@link createLinePath}
 */
export function useLinePath(
  coords: [number, number][],
  config?: { closePath?: boolean },
): Path2D {
  return useValueMemoSlot(
    'linePath',
    () => createLinePath({ coords, closePath: config?.closePath }),
    [...coords.flat(), config?.closePath],
  );
}
