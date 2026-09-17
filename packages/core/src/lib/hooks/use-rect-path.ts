import { PixelGridAlignment } from '../types.js';
import { createRectanglePath } from '../geometry/rectangle.js';
import { resolveNumericCornerRadii } from '../geometry/rounded-corners.js';
import { adjustRectangleToPixelGrid } from '../util/pixel-grid-adjustments.js';
import { useMemoSlot } from './use-memo.js';

/**
 * Creates a memoized Path2D for a rectangle. Useful when
 * defining events efficiently.
 * @returns A memoized Path2D
 */
export function useRectPath(
  x: number,
  y: number,
  width: number,
  height: number,
  config?: {
    alignToPixelGrid?: PixelGridAlignment;
    lineWidth?: number;
    cornerRadius?: number;
    cornerRadii?: readonly (number | null | undefined)[];
  },
): Path2D {
  const radii = resolveNumericCornerRadii(4, config ?? {});
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

  return useMemoSlot('rectPath', () => {
    return createRectanglePath({ x, y, width, height, cornerRadii: radii });
  }, [x, y, width, height, ...radii]);
}
