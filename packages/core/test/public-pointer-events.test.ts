import {
  pibbl,
  createElement,
  Rectangle,
} from '@pibbl/core';
import { describe, expect, it, vi } from 'vitest';

describe('public pointer events', () => {
  it('makes a passive public primitive occlude until pointer events are disabled', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    canvas.style.cssText = 'display:block;width:100px;height:100px';
    document.body.appendChild(canvas);
    const rearClick = vi.fn();
    const Scene = ({ pointerEvents }: { pointerEvents: 'auto' | 'none' }) => [
      createElement(Rectangle, {
        style: { width: 100, height: 100, fill: '#2563eb' },
        onClick: rearClick,
      }),
      createElement(Rectangle, {
        style: { width: 100, height: 100, fill: '#f97316' },
        pointerEvents,
      }),
    ];
    const controller = pibbl(canvas, createElement(Scene, { pointerEvents: 'auto' }));

    try {
      await nextFrame();
      dispatchClick(canvas, 50, 50);
      expect(rearClick).not.toHaveBeenCalled();

      pibbl(canvas, createElement(Scene, { pointerEvents: 'none' }));
      await nextFrame();
      dispatchClick(canvas, 50, 50);
      expect(rearClick).toHaveBeenCalledOnce();
    } finally {
      controller.dispose();
    }
  });
});

function dispatchClick(canvas: HTMLCanvasElement, x: number, y: number): void {
  const bounds = canvas.getBoundingClientRect();
  for (const type of ['mousedown', 'mouseup', 'click'] as const) {
    canvas.dispatchEvent(new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      button: 0,
      clientX: bounds.left + x,
      clientY: bounds.top + y,
    }));
  }
}

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}
