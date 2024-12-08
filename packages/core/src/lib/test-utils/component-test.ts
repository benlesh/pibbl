import { crc } from '@crc/core';
import { cdp, userEvent } from '@vitest/browser/context';
import { CompEl } from '../types';

export class TestCanvas {
  constructor(private canvas: HTMLCanvasElement) {}

  async click(options: { position: { x: number; y: number }; button?: 'left' | 'right' }) {
    await userEvent.click(this.canvas, options);
    await animationFrame();
  }

  async dblClick(options: { position: { x: number; y: number }; button?: 'left' | 'right' }) {
    await userEvent.dblClick(this.canvas, options);
    await animationFrame();
  }

  async contextMenu(options: { position: { x: number; y: number } }) {
    await userEvent.click(this.canvas, { ...options, button: 'right' });
    await animationFrame();
  }

  async mouseDown(options: { x: number; y: number; button?: 'left' | 'right' }) {
    const session = cdp();
    await session.send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      button: options.button === 'right' ? 'right' : 'left',
      x: options.x,
      y: options.y,
      clickCount: 1,
    });
    await animationFrame();
  }

  async mouseUp(options: { x: number; y: number; button?: 'left' | 'right' }) {
    const session = cdp();
    await session.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      button: options.button === 'right' ? 'right' : 'left',
      x: options.x,
      y: options.y,
      clickCount: 1,
    });
    await animationFrame();
  }
}

export async function componentTest<P>(comp: CompEl<P>, options: {
  width?: number;
  height?: number;
} = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = options.width ?? 400;
  canvas.height = options.height ?? 300;
  canvas.style.border = '1px solid black';
  canvas.style.margin = '5px';
  document.body.appendChild(canvas);

  crc(canvas, comp);
  await animationFrame();

  return new TestCanvas(canvas);
}

function animationFrame() {
  return new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
}
