import { PixelGridAlignment } from '../types.js';
import { adjustRectangleToPixelGrid } from '../util/pixel-grid-adjustments.js';
import { crcMemoSlot } from './crc-memo.js';

/**
 * Creates a memoized Path2D for a rectangle. Useful when
 * defining events efficiently.
 * @returns A memoized Path2D
 */
export function crcRectPath(
  x: number,
  y: number,
  width: number,
  height: number,
  config?: { alignToPixelGrid?: PixelGridAlignment; lineWidth?: number },
): Path2D {
  const alignToPixelGrid = config?.alignToPixelGrid;

  if (alignToPixelGrid) {
    ({ x, y, width, height } = adjustRectangleToPixelGrid(
      config?.lineWidth ?? 0,
      x,
      y,
      width,
      height,
      alignToPixelGrid,
    ));
  }

  return crcMemoSlot('rectPath', () => {
    const path = new Path2D();
    path.rect(x, y, width, height);
    return path;
  }, [x, y, width, height]);
}
