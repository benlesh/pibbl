import { crc } from '@crc/core';
import { cdp, userEvent } from '@vitest/browser/context';
import { beforeEach } from 'vitest';
import { CompEl } from '../types';

export class TestDOM {
  constructor(public readonly element: HTMLElement) {}

  async click(options: { position: { x: number; y: number }; button?: 'left' | 'right' }) {
    await userEvent.click(this.element, options);
    await animationFrame();
  }

  async dblClick(options: { position: { x: number; y: number }; button?: 'left' | 'right' }) {
    await userEvent.dblClick(this.element, options);
    await animationFrame();
  }

  async contextMenu(options: { position: { x: number; y: number } }) {
    await userEvent.click(this.element, { ...options, button: 'right' });
    await animationFrame();
  }

  private getContainerOffset() {
    const { top, left } = this.element.getBoundingClientRect();
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

    const [left, top] = this.getContainerOffset();

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
    const [left, top] = this.getContainerOffset();

    await session.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      button: options.button === 'right' ? 'right' : 'left',
      x: options.position.x + left,
      y: options.position.y + top,
      clickCount: 1,
    });
    await animationFrame();
  }

  async mouseMove(options: { position: { x: number; y: number } }) {
    const session = cdp();
    const [left, top] = this.getContainerOffset();
    await session.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: options.position.x + left,
      y: options.position.y + top,
    });
    await animationFrame();
  }

  enableClickCoordinates() {
    if (this.element.tagName !== 'CANVAS') {
      return;
    }

    const ctx = (this.element as HTMLCanvasElement).getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get 2d context');
    }

    this.element.addEventListener('click', (e) => {
      const rect = this.element.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      this.plotCoordinates(x, y);
    });
  }

  plotCoordinates(x: number, y: number) {
    if (this.element.tagName !== 'CANVAS') {
      return;
    }

    const ctx = (this.element as HTMLCanvasElement).getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get 2d context');
    }
    ctx.save();
    const invertedPattern = createInvertedPattern(ctx);
    ctx.fillStyle = invertedPattern;
    ctx.fillRect(x, y, 2, 2);
    ctx.font = '12px Arial';
    ctx.fillText(`${x}, ${y}`, x + 2, y + 12);
    ctx.restore();
  }
}

function createInvertedPattern(ctx: CanvasRenderingContext2D): CanvasPattern {
  // Create a temporary canvas
  const tempCanvas = document.createElement('canvas');
  const tempCtx = tempCanvas.getContext('2d')!;
  tempCanvas.width = ctx.canvas.width;
  tempCanvas.height = ctx.canvas.height;

  // Copy the original canvas content
  tempCtx.drawImage(ctx.canvas, 0, 0);

  // Get and invert the image data
  const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) {
      // If transparent, make it red
      data[i] = 255; // Red
      data[i + 1] = 0; // Green
      data[i + 2] = 0; // Blue
      data[i + 3] = 255; // Alpha
    } else {
      // Otherwise invert the colors
      data[i] = 255 - data[i]; // Red
      data[i + 1] = 255 - data[i + 1]; // Green
      data[i + 2] = 255 - data[i + 2]; // Blue
    }
  }

  // Put the inverted image data on the temporary canvas
  tempCtx.putImageData(imageData, 0, 0);

  // Create and return the pattern from the temporary canvas
  return ctx.createPattern(tempCanvas, 'repeat')!;
}

beforeEach(() => {
  document.body.innerHTML = '';
});

export function renderDiv(options: {
  width?: number;
  height?: number;
  backgroundColor?: string;
} = {}) {
  const div = document.createElement('div');
  div.style.width = `${options.width ?? 400}px`;
  div.style.height = `${options.height ?? 300}px`;
  div.style.backgroundColor = options.backgroundColor ?? 'lightgreen';
  div.style.margin = '0px';
  document.body.appendChild(div);
  return div;
}

export function renderCanvas(options: {
  width?: number;
  height?: number;
  backgroundColor?: string;
} = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = options.width ?? 400;
  canvas.height = options.height ?? 300;
  canvas.style.backgroundColor = options.backgroundColor ?? 'transparent';
  canvas.style.border = '1px solid black';
  canvas.style.margin = '5px';
  document.body.appendChild(canvas);
  return canvas;
}

export async function componentTest<P>(comp: CompEl<P>, options: {
  width?: number;
  height?: number;
} = {}) {
  const canvas = renderCanvas(options);
  crc(canvas, comp);
  await animationFrame();

  return new TestDOM(canvas);
}

function animationFrame() {
  return new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
}
