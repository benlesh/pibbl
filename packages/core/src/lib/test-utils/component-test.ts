import { pibbl } from '@pibbl/core';
import { cdp, userEvent } from 'vitest/browser';
import { afterEach, beforeEach } from 'vitest';
import { getPibblInstance } from '../global-state';
import type { PibblElement, PibblController } from '../types';

const activeControllers = new Set<PibblController>();

export class TestCanvas {
  constructor(
    public readonly element: HTMLCanvasElement,
    private readonly controller: PibblController,
  ) {}

  dispose(): void {
    activeControllers.delete(this.controller);
    this.controller.dispose();
  }

  async click(options: { position: { x: number; y: number }; button?: 'left' | 'right' }) {
    await userEvent.click(this.element, {
      ...options,
      position: this.getElementPosition(options.position),
    });
    await animationFrame();
  }

  async dblClick(options: { position: { x: number; y: number }; button?: 'left' | 'right' }) {
    await userEvent.dblClick(this.element, {
      ...options,
      position: this.getElementPosition(options.position),
    });
    await animationFrame();
  }

  async contextMenu(options: { position: { x: number; y: number } }) {
    await userEvent.click(this.element, {
      position: this.getElementPosition(options.position),
      button: 'right',
    });
    await animationFrame();
  }

  private getScreenPosition(position: { x: number; y: number }) {
    position = this.getElementPosition(position);
    const { top, left } = this.element.getBoundingClientRect();
    const frame = window.frameElement;
    if (!frame) {
      return [left + position.x, top + position.y] as const;
    }

    const frameBounds = frame.getBoundingClientRect();
    const xScale = frameBounds.width / window.innerWidth;
    const yScale = frameBounds.height / window.innerHeight;
    return [
      frameBounds.left + (left + position.x) * xScale,
      frameBounds.top + (top + position.y) * yScale,
    ] as const;
  }

  private getElementPosition(position: { x: number; y: number }) {
    const surface = getPibblInstance(this.element).surface.snapshot;
    if (!surface) {
      throw new Error('The Pibbl test surface is not visible.');
    }
    const backing = surface.renderTransform.transformPoint(
      new DOMPoint(position.x, position.y),
    );
    const style = getComputedStyle(this.element);
    return {
      x: px(style.borderLeftWidth) + px(style.paddingLeft) +
        backing.x / surface.backingPixelsPerCssPixelX,
      y: px(style.borderTopWidth) + px(style.paddingTop) +
        backing.y / surface.backingPixelsPerCssPixelY,
    };
  }

  async mouseDown(options: { position: { x: number; y: number }; button?: 'left' | 'right' }) {
    const session = cdp();
    const [x, y] = this.getScreenPosition(options.position);
    await session.send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      button: options.button === 'right' ? 'right' : 'left',
      x,
      y,
      clickCount: 1,
    });
    await animationFrame();
  }

  async mouseUp(options: { position: { x: number; y: number }; button?: 'left' | 'right' }) {
    const session = cdp();
    const [x, y] = this.getScreenPosition(options.position);
    await session.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      button: options.button === 'right' ? 'right' : 'left',
      x,
      y,
      clickCount: 1,
    });
    await animationFrame();
  }

  async mouseMove(options: { position: { x: number; y: number } }) {
    const session = cdp();
    const [x, y] = this.getScreenPosition(options.position);
    await session.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x,
      y,
    });
    await animationFrame();
  }

  enableClickCoordinates() {
    const ctx = this.element.getContext('2d');
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
    const ctx = this.element.getContext('2d');
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

afterEach(() => {
  for (const controller of activeControllers) {
    controller.dispose();
  }
  activeControllers.clear();
});

export async function componentTest(comp: PibblElement<any>, options: {
  width?: number;
  height?: number;
} = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = options.width ?? 400;
  canvas.height = options.height ?? 300;
  canvas.style.border = '1px solid black';
  canvas.style.margin = '5px';
  document.body.appendChild(canvas);

  const controller = pibbl(canvas, comp);
  activeControllers.add(controller);
  await animationFrame();

  return new TestCanvas(canvas, controller);
}

function animationFrame() {
  return new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
}

function px(value: string): number {
  return Number.parseFloat(value) || 0;
}
