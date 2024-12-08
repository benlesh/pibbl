import { crc } from '@crc/core';
import { cdp, userEvent } from '@vitest/browser/context';
import { beforeEach } from 'vitest';
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

  private getCanvasOffset() {
    const { top, left } = this.canvas.getBoundingClientRect();
    const doc = window.top?.document;
    if (!doc) {
      throw new Error('No document found');
    }

    const iframe = doc.querySelector('[data-vitest="true"]');
    if (!iframe) {
      throw new Error('No iframe found');
    }

    const { top: iframeTop, left: iframeLeft } = iframe.getBoundingClientRect();

    return [left + iframeLeft, top + iframeTop] as const;
  }

  async mouseDown(options: { position: { x: number; y: number }; button?: 'left' | 'right' }) {
    const session = cdp();

    const [left, top] = this.getCanvasOffset();

    await session.send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      button: options.button === 'right' ? 'right' : 'left',
      x: options.position.x + left,
      y: options.position.y + top,
      clickCount: 1,
    });
    await animationFrame();
  }

  async mouseUp(options: { position: { x: number; y: number }; button?: 'left' | 'right' }) {
    const session = cdp();
    const [left, top] = this.getCanvasOffset();

    await session.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      button: options.button === 'right' ? 'right' : 'left',
      x: options.position.x + left,
      y: options.position.y + top,
      clickCount: 1,
    });
    await animationFrame();
  }
}

beforeEach(() => {
  document.body.innerHTML = '';
});

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
