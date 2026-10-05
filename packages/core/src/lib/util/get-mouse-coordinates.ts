import type { PibblInstance } from '../types.js';
import { getSurfaceSnapshot } from '../surface/transform.js';

const recentCoords = new WeakMap<
  MouseEvent,
  WeakMap<PibblInstance, readonly [number, number]>
>();

export function getMouseCoordinates(
  event: MouseEvent,
  instance: PibblInstance,
): readonly [number, number] {
  const eventCoords = recentCoords.get(event);
  const cached = eventCoords?.get(instance);
  if (cached) {
    return cached;
  }
  const target = event.target as HTMLCanvasElement;
  const bounds = target.getBoundingClientRect();
  const style = getComputedStyle(target);
  const contentLeft = bounds.left + px(style.borderLeftWidth) + px(style.paddingLeft);
  const contentTop = bounds.top + px(style.borderTopWidth) + px(style.paddingTop);
  const surface = getSurfaceSnapshot(instance);
  const backingPoint = new DOMPoint(
    (event.clientX - contentLeft) * surface.backingPixelsPerCssPixelX,
    (event.clientY - contentTop) * surface.backingPixelsPerCssPixelY,
  );
  const logicalPoint = surface.inverseRenderTransform.transformPoint(backingPoint);
  const result = [logicalPoint.x, logicalPoint.y] as const;
  const cache = eventCoords ?? new WeakMap();
  cache.set(instance, result);
  recentCoords.set(event, cache);
  return result;
}

function px(value: string): number {
  return Number.parseFloat(value) || 0;
}
