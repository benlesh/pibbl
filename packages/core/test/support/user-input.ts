import { cdp, userEvent } from 'vitest/browser';
import { cssPointForIntrinsic, type MousePoint } from './mouse-input';

export type KeyboardInput =
  | 'ArrowDown'
  | 'ArrowLeft'
  | 'ArrowRight'
  | 'ArrowUp'
  | 'Enter'
  | 'Space';

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

function logicalScreenPoint(
  canvas: HTMLCanvasElement,
  point: MousePoint,
): MousePoint {
  return screenPoint(canvas, cssPointForIntrinsic(canvas, point));
}

export function tab(backwards = false): Promise<void> {
  return userEvent.tab(backwards ? { shift: true } : undefined);
}

export function pressKey(key: KeyboardInput): Promise<void> {
  const token = key === 'Space' ? ' ' : `{${key}}`;
  return userEvent.keyboard(token);
}

export async function clickLogicalPoint(
  canvas: HTMLCanvasElement,
  point: MousePoint,
): Promise<void> {
  const position = logicalScreenPoint(canvas, point);
  await cdp().send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: position.x,
    y: position.y,
    button: 'left',
    clickCount: 1,
    pointerType: 'mouse',
  });
  await cdp().send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: position.x,
    y: position.y,
    button: 'left',
    clickCount: 1,
    pointerType: 'mouse',
  });
}

export async function dragPointerLogicalPoint(
  canvas: HTMLCanvasElement,
  from: MousePoint,
  to: MousePoint,
  intermediate: readonly MousePoint[] = [],
): Promise<void> {
  await pointerDownLogicalPoint(canvas, from);
  for (const point of [...intermediate, to]) {
    await pointerMoveLogicalPoint(canvas, point);
  }
  await pointerUpLogicalPoint(canvas, to);
}

async function dispatchPointerLogicalPoint(
  canvas: HTMLCanvasElement,
  type: "mousePressed" | "mouseMoved" | "mouseReleased",
  point: MousePoint,
): Promise<void> {
  const position = logicalScreenPoint(canvas, point);
  await cdp().send("Input.dispatchMouseEvent", {
    type,
    x: position.x,
    y: position.y,
    button: "left",
    buttons: type === "mouseReleased" ? 0 : 1,
    pointerType: "mouse",
  });
}

export function pointerDownLogicalPoint(
  canvas: HTMLCanvasElement,
  point: MousePoint,
): Promise<void> {
  return dispatchPointerLogicalPoint(canvas, "mousePressed", point);
}

export function pointerMoveLogicalPoint(
  canvas: HTMLCanvasElement,
  point: MousePoint,
): Promise<void> {
  return dispatchPointerLogicalPoint(canvas, "mouseMoved", point);
}

export function pointerUpLogicalPoint(
  canvas: HTMLCanvasElement,
  point: MousePoint,
): Promise<void> {
  return dispatchPointerLogicalPoint(canvas, "mouseReleased", point);
}

export async function wheelLogicalPoint(
  canvas: HTMLCanvasElement,
  point: MousePoint,
  deltaY: number,
  deltaX = 0,
): Promise<void> {
  const position = logicalScreenPoint(canvas, point);
  await cdp().send("Input.dispatchMouseEvent", {
    type: "mouseWheel",
    x: position.x,
    y: position.y,
    deltaX,
    deltaY,
    pointerType: "mouse",
  });
}

export async function pressPenLogicalPoint(
  canvas: HTMLCanvasElement,
  point: MousePoint,
): Promise<void> {
  await penDownLogicalPoint(canvas, point);
  await penUpLogicalPoint(canvas, point);
}

export async function penDownLogicalPoint(
  canvas: HTMLCanvasElement,
  point: MousePoint,
): Promise<void> {
  const position = logicalScreenPoint(canvas, point);
  await cdp().send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: position.x,
    y: position.y,
    button: 'left',
    clickCount: 1,
    pointerType: 'pen',
  });
}

export async function penUpLogicalPoint(
  canvas: HTMLCanvasElement,
  point: MousePoint,
): Promise<void> {
  const position = logicalScreenPoint(canvas, point);
  await cdp().send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: position.x,
    y: position.y,
    button: 'left',
    clickCount: 1,
    pointerType: 'pen',
  });
}

export async function tapTouchLogicalPoint(
  canvas: HTMLCanvasElement,
  point: MousePoint,
): Promise<void> {
  await touchStartLogicalPoint(canvas, point);
  await touchEndLogicalPoint(canvas);
}

export async function touchStartLogicalPoint(
  canvas: HTMLCanvasElement,
  point: MousePoint,
): Promise<void> {
  const position = logicalScreenPoint(canvas, point);
  await cdp().send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: position.x, y: position.y, id: 1 }],
  });
}

export async function touchEndLogicalPoint(
  _canvas: HTMLCanvasElement,
): Promise<void> {
  await cdp().send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
}
