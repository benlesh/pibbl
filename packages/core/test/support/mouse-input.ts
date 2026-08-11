import { cdp } from 'vitest/browser';

export interface MousePoint {
  x: number;
  y: number;
}

export type MouseInputType = 'mouseMoved' | 'mousePressed' | 'mouseReleased';

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
