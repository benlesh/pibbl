import { afterEach, expect, it, vi } from 'vitest';
import { crc } from '../crc';
import { createElement } from '../element/create-element';
import { clearSharedState, getCRCInstance } from '../global-state';
import { useEventTarget } from '../hooks/use-event-target';
import { suppressManipulationActivation } from './dispatch';

afterEach(() => {
  clearSharedState();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

it('uses a native click pointer ID before considering another pending manipulation on the same target', async () => {
  const clicks: number[] = [];
  const Target = () => {
    useEventTarget({
      onPointerDown: () => undefined,
      onPointerUp: () => undefined,
      onClick: () => clicks.push(1),
    }, { path: rectanglePath(), fill: true });
  };
  const canvas = createCanvas();
  crc(canvas, createElement(Target, {}));
  await nextFrame();
  const root = getCRCInstance(canvas);

  dispatchPointer(canvas, 'pointerdown', 1);
  suppressManipulationActivation(root, 1);
  dispatchPointer(canvas, 'pointerdown', 2);
  dispatchMouseActivation(canvas, 2);

  expect(clicks).toHaveLength(1);

  dispatchMouseActivation(canvas, 1);

  expect(clicks).toHaveLength(1);
});

it.each(['pointerup', 'pointercancel'] as const)(
  'releases an ordinary pointer press on %s before it can retain its event path',
  async type => {
    const clicks: number[] = [];
    const Target = () => {
      useEventTarget({
        onPointerDown: () => undefined,
        onPointerUp: () => undefined,
        onPointerCancel: () => undefined,
        onClick: () => clicks.push(1),
      }, { path: rectanglePath(), fill: true });
    };
    const canvas = createCanvas();
    crc(canvas, createElement(Target, {}));
    await nextFrame();
    const root = getCRCInstance(canvas);

    dispatchPointer(canvas, 'pointerdown', 7);
    dispatchPointer(canvas, type, 7);
    suppressManipulationActivation(root, 7);
    dispatchLegacyMouseActivation(canvas);

    expect(clicks).toHaveLength(1);
  },
);

function dispatchMouseActivation(canvas: HTMLCanvasElement, pointerId: number): void {
  dispatchMouse(canvas, 'mousedown');
  dispatchMouse(canvas, 'mouseup');
  const event = new PointerEvent('click', {
    bubbles: true,
    cancelable: true,
    pointerId,
    pointerType: 'touch',
    clientX: 25,
    clientY: 25,
  });
  canvas.dispatchEvent(event);
}

function dispatchLegacyMouseActivation(canvas: HTMLCanvasElement): void {
  dispatchMouse(canvas, 'mousedown');
  dispatchMouse(canvas, 'mouseup');
  dispatchMouse(canvas, 'click');
}

function dispatchPointer(
  canvas: HTMLCanvasElement,
  type: 'pointercancel' | 'pointerdown' | 'pointerup',
  pointerId: number,
): void {
  canvas.dispatchEvent(new PointerEvent(type, {
    bubbles: true,
    cancelable: type === 'pointerdown' || type === 'pointerup',
    pointerId,
    pointerType: 'touch',
    isPrimary: true,
    button: 0,
    buttons: type === 'pointerdown' ? 1 : 0,
    clientX: 25,
    clientY: 25,
  }));
}

function dispatchMouse(
  canvas: HTMLCanvasElement,
  type: 'click' | 'mousedown' | 'mouseup',
): void {
  canvas.dispatchEvent(new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    clientX: 25,
    clientY: 25,
  }));
}

function rectanglePath(): Path2D {
  const path = new Path2D();
  path.rect(0, 0, 50, 50);
  return path;
}

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 100;
  canvas.height = 100;
  canvas.style.cssText = 'display:block; width:100px; height:100px';
  document.body.append(canvas);
  return canvas;
}

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}
