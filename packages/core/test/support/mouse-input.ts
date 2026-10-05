import { cdp } from 'vitest/browser';
import { getPibblInstance } from '../../src/lib/global-state';

export interface MousePoint {
  x: number;
  y: number;
}

export type MouseInputType = 'mouseMoved' | 'mousePressed' | 'mouseReleased';

export function cssPointForIntrinsic(
  canvas: HTMLCanvasElement,
  point: MousePoint,
): MousePoint {
  const surface = getPibblInstance(canvas).surface.snapshot;
  if (!surface) {
    throw new Error('The Pibbl surface is not visible.');
  }
  const backing = surface.renderTransform.transformPoint(
    new DOMPoint(point.x, point.y),
  );
  return {
    x: backing.x / surface.backingPixelsPerCssPixelX,
    y: backing.y / surface.backingPixelsPerCssPixelY,
  };
}

export function backingPointForLogical(
  canvas: HTMLCanvasElement,
  point: MousePoint,
): MousePoint {
  const surface = getPibblInstance(canvas).surface.snapshot;
  if (!surface) {
    throw new Error('The Pibbl surface is not visible.');
  }
  return surface.renderTransform.transformPoint(new DOMPoint(point.x, point.y));
}

function screenPoint(element: HTMLElement, point: MousePoint): MousePoint {
  const bounds = element.getBoundingClientRect();
  const frame = window.frameElement;
  if (!frame) {
    return { x: bounds.left + point.x, y: bounds.top + point.y };
  }

  const frameBounds = frame.getBoundingClientRect();
  return {
    x: frameBounds.left + (bounds.left + point.x) * (frameBounds.width / window.innerWidth),
    y: frameBounds.top + (bounds.top + point.y) * (frameBounds.height / window.innerHeight),
  };
}

export async function dispatchMouseInput(
  element: HTMLElement,
  point: MousePoint,
  type: MouseInputType,
  options: {
    button?: 'left' | 'right';
    clickCount?: number;
  } = {},
): Promise<void> {
  const position = screenPoint(element, point);
  const moved = type === 'mouseMoved';
  await cdp().send('Input.dispatchMouseEvent', {
    type,
    x: position.x,
    y: position.y,
    button: moved ? 'none' : options.button ?? 'left',
    clickCount: moved ? 0 : options.clickCount ?? 1,
  });
}

export function moveMouse(element: HTMLElement, point: MousePoint): Promise<void> {
  return dispatchMouseInput(element, point, 'mouseMoved');
}

export function pressMouse(
  element: HTMLElement,
  point: MousePoint,
  options?: { button?: 'left' | 'right'; clickCount?: number },
): Promise<void> {
  return dispatchMouseInput(element, point, 'mousePressed', options);
}

export function releaseMouse(
  element: HTMLElement,
  point: MousePoint,
  options?: { button?: 'left' | 'right'; clickCount?: number },
): Promise<void> {
  return dispatchMouseInput(element, point, 'mouseReleased', options);
}

export async function clickMouse(
  element: HTMLElement,
  point: MousePoint,
  options?: { button?: 'left' | 'right'; clickCount?: number },
): Promise<void> {
  await pressMouse(element, point, options);
  await releaseMouse(element, point, options);
}
