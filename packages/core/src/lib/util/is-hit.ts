import { CRCClippingStackEntry, RenderingContext2D } from '../types.js';
import { get2dContext } from './get-2d-context.js';

export function isHit({
  canvas,
  transform,
  path,
  x,
  y,
  fill,
  lineInteractionWidth,
  currentClippingStack,
}: {
  canvas: HTMLCanvasElement;
  transform: DOMMatrix;
  path: Path2D;
  x: number;
  y: number;
  fill: boolean;
  lineInteractionWidth: number;
  currentClippingStack: readonly CRCClippingStackEntry[];
}) {
  const ctx = get2dContext(canvas);
  ctx.save();
  try {
    if (isInEveryClippingPath(currentClippingStack, x, y, ctx)) {
      ctx.setTransform(transform);

      if (fill && ctx.isPointInPath(path, x, y)) {
        return true;
      }
      if (lineInteractionWidth > 0) {
        ctx.lineWidth = lineInteractionWidth;
        if (ctx.isPointInStroke(path, x, y)) {
          return true;
        }
      }
    }
    return false;
  } finally {
    ctx.restore();
  }
}

function isInEveryClippingPath(
  currentClippingStack: readonly CRCClippingStackEntry[],
  x: number,
  y: number,
  ctx: RenderingContext2D,
) {
  if (currentClippingStack.length === 0) {
    return true;
  }

  for (const { path, fillRule, transform } of currentClippingStack) {
    ctx.save();
    ctx.setTransform(transform);
    try {
      if (!ctx.isPointInPath(path, x, y, fillRule)) {
        return false;
      }
    } finally {
      ctx.restore();
    }
  }

  return true;
}
