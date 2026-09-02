import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { crc } from '../crc.js';
import { clearSharedState } from '../global-state.js';
import { crcLayoutBox } from '../hooks/crc-layout-box.js';
import { crcRef } from '../hooks/crc-ref.js';
import { createElement } from '../element/create-element';
import { definePrimitive } from '../define-primitive';

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  clearSharedState();
});

describe('root Canvas surface', () => {
  it('uses the initial Canvas dimensions as a fixed viewport rendered at the configured density', async () => {
    const canvas = createCanvas(200, 100, 300, 300);
    const observations: Array<{
      box: ReturnType<typeof crcLayoutBox>;
      transform: DOMMatrix;
    }> = [];
    const Probe = definePrimitive<{}>((_props: {}, _style, ctx) => {
      observations.push({
        box: crcLayoutBox(),
        transform: ctx.getTransform(),
      });
    });

    const controller = crc(canvas, createElement(Probe, {}), { pixelRatio: 2 });
    await settleSurface();

    expect(canvas.width).toBe(600);
    expect(canvas.height).toBe(600);
    expect(observations).toHaveLength(1);
    expect(observations[0].box).toEqual({
      x: 0,
      y: 0,
      width: 200,
      height: 100,
    });
    expect(observations[0].transform).toEqual(
      expect.objectContaining({ a: 3, d: 3, e: 0, f: 150 }),
    );
    controller.dispose();
  });

  it('reflows a responsive viewport without remounting component state', async () => {
    const canvas = createCanvas(200, 100, 300, 150);
    const observations: Array<{
      box: ReturnType<typeof crcLayoutBox>;
      identity: object;
    }> = [];
    const Probe = (_props: {}) => {
      observations.push({
        box: crcLayoutBox(),
        identity: crcRef({}).current!,
      });
    };

    const controller = crc(canvas, createElement(Probe, {}), {
      viewport: 'responsive',
      pixelRatio: 2,
    });
    await settleSurface();
    const firstIdentity = observations.at(-1)!.identity;

    canvas.style.width = '400px';
    canvas.style.height = '200px';
    await settleSurface();

    expect(canvas.width).toBe(800);
    expect(canvas.height).toBe(400);
    expect(observations.at(-1)).toEqual({
      box: { x: 0, y: 0, width: 400, height: 200 },
      identity: firstIdentity,
    });
    controller.dispose();
  });

  it('stabilizes and restores an intrinsic CSS size when backing attributes change', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 100;
    canvas.style.display = 'block';
    document.body.appendChild(canvas);
    const Probe = (_props: {}) => {};

    const controller = crc(canvas, createElement(Probe, {}), { pixelRatio: 2 });
    await settleSurface();

    expect(canvas.width).toBe(400);
    expect(canvas.height).toBe(200);
    expect(canvas.getBoundingClientRect()).toEqual(
      expect.objectContaining({ width: 200, height: 100 }),
    );
    expect(canvas.style.width).toBe('200px');
    expect(canvas.style.height).toBe('100px');

    controller.dispose();
    expect(canvas.style.width).toBe('');
    expect(canvas.style.height).toBe('');
  });

  it('defers a zero-sized responsive surface and renders when it becomes visible', async () => {
    const canvas = createCanvas(200, 100, 0, 100);
    let renders = 0;
    const Probe = (_props: {}) => {
      renders++;
    };
    const controller = crc(canvas, createElement(Probe, {}), {
      viewport: 'responsive',
      pixelRatio: 2,
    });

    await settleSurface();
    expect(renders).toBe(0);

    canvas.style.width = '200px';
    await settleSurface();

    expect(renders).toBe(1);
    expect(canvas.width).toBe(400);
    expect(canvas.height).toBe(200);
    controller.dispose();
  });

  it('uses the current device ratio by default', async () => {
    const canvas = createCanvas(200, 100, 240, 120);
    const Probe = (_props: {}) => {};
    const controller = crc(canvas, createElement(Probe, {}));
    await settleSurface();

    expect(canvas.width).toBe(Math.round(240 * window.devicePixelRatio));
    expect(canvas.height).toBe(Math.round(120 * window.devicePixelRatio));
    controller.dispose();
  });

  it('coalesces resize and density invalidations and releases exact surface observers', () => {
    const originalResizeObserver = globalThis.ResizeObserver;
    const originalMatchMedia = globalThis.matchMedia;
    const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
    const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;
    const originalDevicePixelRatio = Object.getOwnPropertyDescriptor(
      window,
      'devicePixelRatio',
    );
    const observe = vi.fn();
    const disconnect = vi.fn();
    const mediaListeners = new Set<EventListenerOrEventListenerObject>();
    const mediaAdd = vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
      if (type === 'change') mediaListeners.add(listener);
    });
    const mediaRemove = vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
      if (type === 'change') mediaListeners.delete(listener);
    });
    const addWindowListener = vi.spyOn(window, 'addEventListener');
    const removeWindowListener = vi.spyOn(window, 'removeEventListener');
    const frames = new Map<number, FrameRequestCallback>();
    let nextFrameId = 1;
    let resizeCallback: ResizeObserverCallback | undefined;
    let controller: ReturnType<typeof crc> | undefined;

    class ControlledResizeObserver implements ResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback;
      }

      observe = observe;
      unobserve = vi.fn();
      disconnect = disconnect;
    }

    const mediaQuery = {
      matches: false,
      media: '',
      onchange: null,
      addEventListener: mediaAdd,
      removeEventListener: mediaRemove,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(() => false),
    } as unknown as MediaQueryList;

    try {
      globalThis.ResizeObserver = ControlledResizeObserver;
      globalThis.matchMedia = vi.fn(() => mediaQuery);
      globalThis.requestAnimationFrame = callback => {
        const id = nextFrameId++;
        frames.set(id, callback);
        return id;
      };
      globalThis.cancelAnimationFrame = id => {
        frames.delete(id);
      };
      Object.defineProperty(window, 'devicePixelRatio', {
        configurable: true,
        value: 1,
      });

      const canvas = createCanvas(200, 100, 200, 100);
      let renders = 0;
      const Probe = (_props: {}) => {
        renders++;
      };
      controller = crc(canvas, createElement(Probe, {}));

      expect(observe).toHaveBeenCalledOnce();
      expect(observe).toHaveBeenCalledWith(canvas);
      expect(frames.size).toBe(1);
      runControlledFrame(frames);
      expect(renders).toBe(1);

      canvas.style.width = '300px';
      resizeCallback?.([], {} as ResizeObserver);
      expect(frames.size).toBe(1);

      Object.defineProperty(window, 'devicePixelRatio', {
        configurable: true,
        value: 2,
      });
      const densityListener = Array.from(mediaListeners)[0];
      expect(densityListener).toBeDefined();
      if (typeof densityListener === 'function') {
        densityListener(new Event('change'));
      } else {
        densityListener.handleEvent(new Event('change'));
      }
      expect(frames.size).toBe(1);

      runControlledFrame(frames);
      expect(renders).toBe(2);
      expect(canvas.width).toBe(600);
      expect(canvas.height).toBe(200);

      const resizeRegistration = addWindowListener.mock.calls.find(
        ([type]) => type === 'resize',
      );
      expect(resizeRegistration).toBeDefined();
      controller.dispose();
      controller = undefined;

      expect(disconnect).toHaveBeenCalledOnce();
      expect(mediaRemove).toHaveBeenCalledWith(
        'change',
        expect.any(Function),
      );
      expect(removeWindowListener).toHaveBeenCalledWith(
        'resize',
        resizeRegistration![1],
      );
      expect(frames.size).toBe(0);
    } finally {
      controller?.dispose();
      globalThis.ResizeObserver = originalResizeObserver;
      globalThis.matchMedia = originalMatchMedia;
      globalThis.requestAnimationFrame = originalRequestAnimationFrame;
      globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
      if (originalDevicePixelRatio) {
        Object.defineProperty(
          window,
          'devicePixelRatio',
          originalDevicePixelRatio,
        );
      } else {
        delete (window as { devicePixelRatio?: number }).devicePixelRatio;
      }
      addWindowListener.mockRestore();
      removeWindowListener.mockRestore();
    }
  });
});

function createCanvas(
  width: number,
  height: number,
  displayWidth: number,
  displayHeight: number,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.style.display = 'block';
  canvas.style.width = `${displayWidth}px`;
  canvas.style.height = `${displayHeight}px`;
  document.body.appendChild(canvas);
  return canvas;
}

async function settleSurface(): Promise<void> {
  await nextFrame();
  await nextFrame();
  await nextFrame();
}

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

function runControlledFrame(frames: Map<number, FrameRequestCallback>): void {
  const entry = frames.entries().next().value;
  if (!entry) {
    throw new Error('No controlled animation frame is pending.');
  }
  const [id, callback] = entry;
  frames.delete(id);
  callback(0);
}
