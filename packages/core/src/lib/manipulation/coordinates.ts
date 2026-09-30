import { getSurfaceSnapshot } from "../surface/transform.js";
import type { CRCInstance } from "../types.js";

/**
 * Captures every input that maps a browser pointer into root-logical space.
 *
 * The content box comes from the live canvas because a stylesheet can change it
 * before the next root surface commit updates the cached surface snapshot.
 */
export function currentRootCoordinateMapping(
  root: CRCInstance,
): readonly number[] {
  const surface = getSurfaceSnapshot(root);
  const [contentLeft, contentTop, contentWidth, contentHeight] =
    currentCanvasContentBox(
      root.canvas,
      surface.displayWidth,
      surface.displayHeight,
    );
  const inverse = surface.inverseRenderTransform;
  return Object.freeze([
    contentLeft,
    contentTop,
    contentWidth,
    contentHeight,
    surface.backingPixelsPerCssPixelX,
    surface.backingPixelsPerCssPixelY,
    surface.backingWidth,
    surface.backingHeight,
    surface.logicalWidth,
    surface.logicalHeight,
    inverse.a,
    inverse.b,
    inverse.c,
    inverse.d,
    inverse.e,
    inverse.f,
  ]);
}

export function sameRootCoordinateMapping(
  left: readonly number[] | undefined,
  right: readonly number[] | undefined,
): boolean {
  return (
    left !== undefined &&
    right !== undefined &&
    left.length === right.length &&
    left.every((value, index) => Object.is(value, right[index]))
  );
}

function currentCanvasContentBox(
  canvas: CRCInstance["canvas"],
  fallbackWidth: number,
  fallbackHeight: number,
): readonly [number, number, number, number] {
  if (
    typeof HTMLCanvasElement === "undefined" ||
    !(canvas instanceof HTMLCanvasElement)
  )
    return [0, 0, fallbackWidth, fallbackHeight];
  const bounds = canvas.getBoundingClientRect();
  const style = getComputedStyle(canvas);
  const leftInset = px(style.borderLeftWidth) + px(style.paddingLeft);
  const topInset = px(style.borderTopWidth) + px(style.paddingTop);
  const rightInset = px(style.borderRightWidth) + px(style.paddingRight);
  const bottomInset = px(style.borderBottomWidth) + px(style.paddingBottom);
  return [
    bounds.left + leftInset,
    bounds.top + topInset,
    Math.max(0, bounds.width - leftInset - rightInset),
    Math.max(0, bounds.height - topInset - bottomInset),
  ];
}

function px(value: string): number {
  return Number.parseFloat(value) || 0;
}
