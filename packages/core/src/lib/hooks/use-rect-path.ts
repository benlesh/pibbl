import { PixelGridAlignment } from '../types.js';
import { createRectanglePath } from '../geometry/rectangle.js';
import { resolveNumericCornerRadii } from '../geometry/rounded-corners.js';
import { adjustRectangleToPixelGrid } from '../util/pixel-grid-adjustments.js';
import { useValueMemoSlot } from './use-value-memo-slot.js';

/**
 * Creates a memoized Path2D for a rectangle. Useful when
 * defining events efficiently.
 * @param x - Horizontal rectangle origin.
 * @param y - Vertical rectangle origin.
 * @param width - Horizontal extent in logical units.
 * @param height - Vertical extent in logical units.
 * @param config - Pixel alignment, stroke width, and uniform or per-corner rounding. See
 * {@link PixelGridAlignment} .
 * @returns A memoized Path2D
 *
 * @see {@link PixelGridAlignment}
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

  return useValueMemoSlot('rectPath', () => {
    return createRectanglePath({ x, y, width, height, cornerRadii: radii });
  }, [x, y, width, height, ...radii]);
}
