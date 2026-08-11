import { createLinePath } from '../util/create-line-path.js';
import { crcMemo } from './crc-memo.js';

/**
 * Creates a memoized Path2D for a set of line coordinates.
 * @returns A memoized Path2D
 */
export function crcLinePath(
  coords: [number, number][],
  config?: { closePath?: boolean },
): Path2D {
  return crcMemo(() => createLinePath(coords, config), coords.flat());
}
