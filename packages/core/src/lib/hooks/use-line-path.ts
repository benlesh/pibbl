import { createLinePath } from '../geometry/line.js';
import { useValueMemoSlot } from './use-value-memo-slot.js';

/**
 * Creates a memoized Path2D for a set of line coordinates.
 * @returns A memoized Path2D
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
