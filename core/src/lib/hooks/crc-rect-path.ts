import { PixelGridAlignment } from '../types';
import { adjustRectangleToPixelGrid } from '../util/pixel-grid-adjustments';
import { crcMemo } from './crc-memo';

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
  config?: { alignToPixelGrid?: PixelGridAlignment; lineWidth?: number }
): Path2D {
  const alignToPixelGrid = config?.alignToPixelGrid;

  if (alignToPixelGrid) {
    ({ x, y, width, height } = adjustRectangleToPixelGrid(
      config?.lineWidth ?? 0,
      x,
      y,
      width,
      height,
      alignToPixelGrid
    ));
  }

  return crcMemo(() => {
    const path = new Path2D();
    path.rect(x, y, width, height);
    return path;
  }, [x, y, width, height]);
}
