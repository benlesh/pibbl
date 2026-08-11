import { crcMemo } from './crc-memo.js';

/**
 * Creates a memoized Path2D for an SVG data string.
 * @returns A memoized Path2D
 */
export function crcSvgPath(svgPathData: string): Path2D {
  return crcMemo(() => new Path2D(svgPathData), [svgPathData]);
}
