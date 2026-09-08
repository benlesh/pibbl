import { createLinePath } from '../geometry/line.js';
import { crcMemoSlot } from './crc-memo.js';

/**
 * Creates a memoized Path2D for a set of line coordinates.
 * @returns A memoized Path2D
 */
export function crcLinePath(
  coords: [number, number][],
  config?: { closePath?: boolean },
): Path2D {
  return crcMemoSlot(
    'linePath',
    () => createLinePath({ coords, closePath: config?.closePath }),
    [...coords.flat(), config?.closePath],
  );
}
