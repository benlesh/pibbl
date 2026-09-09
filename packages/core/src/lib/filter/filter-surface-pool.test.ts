import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from '../element/create-element';
import { executeRender } from '../execute-render';
import { clearSharedState, getCRCInstance, GLOBAL_STATE } from '../global-state';
import { mountCRC } from '../mount-crc';
import type { RenderTargetSnapshot } from '../render-target';
import type { CRCComponentRefs } from '../types';
import type { FilterPixelWindow, FilterWindows } from './filter-region';
import { FilterSurfacePool } from './filter-surface-pool';

afterEach(() => {
  clearSharedState();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe('filter surface pool', () => {
  it('lazily assigns strict depth pairs and reuses released sibling identities', () => {
    const NativeOffscreenCanvas = globalThis.OffscreenCanvas;
    const offscreenConstructor = vi.fn(function(
      width: number,
      height: number,
    ) {
      return new NativeOffscreenCanvas(width, height);
    });
    vi.stubGlobal('OffscreenCanvas', offscreenConstructor);
    const pool = new FilterSurfacePool();
    const windows = createWindows(120, 80, 100, 50);

    expect(offscreenConstructor).not.toHaveBeenCalled();
    expect(pool.snapshot()).toEqual({
      surfaceSlots: 0,
      createdSurfaceSlots: 0,
      activePairs: 0,
      peakActivePairs: 0,
      pairCheckouts: 0,
      pairReturns: 0,
      resized: 0,
      releasedSurfaceSlots: 0,
    });

    const first = pool.checkoutPair(windows);
    expect(offscreenConstructor).toHaveBeenCalledTimes(2);
    first.release();

    const sibling = pool.checkoutPair(windows);
    expect(sibling.source).toBe(first.source);
    expect(sibling.result).toBe(first.result);
    expect(offscreenConstructor).toHaveBeenCalledTimes(2);
    const nested = pool.checkoutPair(windows);
    expect(nested.source).not.toBe(sibling.source);
    expect(nested.result).not.toBe(sibling.result);
    expect(offscreenConstructor).toHaveBeenCalledTimes(4);

    nested.release();
    sibling.release();
    expect(pool.snapshot()).toEqual({
      surfaceSlots: 4,
      createdSurfaceSlots: 4,
      activePairs: 0,
      peakActivePairs: 2,
      pairCheckouts: 3,
      pairReturns: 3,
      resized: 0,
      releasedSurfaceSlots: 0,
    });

    pool.dispose();
    expect(pool.snapshot()).toMatchObject({
      surfaceSlots: 0,
      createdSurfaceSlots: 4,
      releasedSurfaceSlots: 4,
      activePairs: 0,
    });
    pool.dispose();
    expect(pool.snapshot().releasedSurfaceSlots).toBe(4);
  });

  it('uses exactly the two depth-indexed array slots without searching', () => {
    const pool = new FilterSurfacePool();
    const windows = createWindows(120, 80, 100, 50);
    let numericGets = 0;
    const slots = (pool as unknown as { slots: unknown[] }).slots;
    const proxiedSlots = new Proxy(slots, {
      get(target, property, receiver) {
        if (typeof property === 'string' && /^\d+$/.test(property)) {
          numericGets += 1;
        }
        return Reflect.get(target, property, receiver);
      },
    });
    (pool as unknown as { slots: unknown[] }).slots = proxiedSlots;

    const pair = pool.checkoutPair(windows);

    expect(numericGets).toBe(2);
    pair.release();
  });

  it('resizes exactly, skips redundant clears after resize, and clears same-size reuse once', () => {
    const clearRect = vi.spyOn(
      OffscreenCanvasRenderingContext2D.prototype,
      'clearRect',
    );
    const pool = new FilterSurfacePool();
    const initial = pool.checkoutPair(createWindows(120, 80, 100, 50));
    initial.source.context.fillStyle = 'red';
    initial.source.context.fillRect(0, 0, 120, 80);
    initial.result.context.fillStyle = 'red';
    initial.result.context.fillRect(0, 0, 100, 50);
    initial.release();
    expect(clearRect).not.toHaveBeenCalled();

    const resized = pool.checkoutPair(createWindows(60, 40, 50, 25));
    expect(resized.source.canvas).toMatchObject({ width: 60, height: 40 });
    expect(resized.result.canvas).toMatchObject({ width: 50, height: 25 });
    expect(Array.from(resized.source.context.getImageData(0, 0, 1, 1).data))
      .toEqual([0, 0, 0, 0]);
    expect(Array.from(resized.result.context.getImageData(0, 0, 1, 1).data))
      .toEqual([0, 0, 0, 0]);
    expect(pool.snapshot().resized).toBe(2);
    expect(clearRect).not.toHaveBeenCalled();
    resized.release();

    const reused = pool.checkoutPair(createWindows(60, 40, 50, 25));
    expect(clearRect.mock.calls).toEqual([
      [0, 0, 60, 40],
      [0, 0, 50, 25],
    ]);
    reused.release();
  });

  it('restores the full clip and every framework-owned default state on checkout', () => {
    const pool = new FilterSurfacePool();
    const windows = createWindows(40, 30, 20, 10);
    const first = pool.checkoutPair(windows);
    for (const surface of [first.source, first.result]) {
      const { context } = surface;
      context.filter = 'blur(2px)';
      context.setTransform(2, 0, 0, 3, 4, 5);
      context.globalAlpha = 0.25;
      context.globalCompositeOperation = 'xor';
      context.shadowBlur = 7;
      context.shadowColor = 'red';
      context.shadowOffsetX = 8;
      context.shadowOffsetY = 9;
      context.setLineDash([2, 3]);
      context.lineDashOffset = 4;
      context.imageSmoothingEnabled = false;
      context.imageSmoothingQuality = 'high';
      context.rect(0, 0, 1, 1);
      context.clip();
    }
    first.release();

    const second = pool.checkoutPair(windows);

    for (const surface of [second.source, second.result]) {
      const { context } = surface;
      expect(matrixValues(context.getTransform())).toEqual([1, 0, 0, 1, 0, 0]);
      expect(context.filter).toBe('none');
      expect(context.globalAlpha).toBe(1);
      expect(context.globalCompositeOperation).toBe('source-over');
      expect(context.shadowBlur).toBe(0);
      expect(context.shadowColor).toBe('rgba(0, 0, 0, 0)');
      expect(context.shadowOffsetX).toBe(0);
      expect(context.shadowOffsetY).toBe(0);
      expect(context.getLineDash()).toEqual([]);
      expect(context.lineDashOffset).toBe(0);
      expect(context.imageSmoothingEnabled).toBe(true);
      expect(context.imageSmoothingQuality).toBe('low');

      context.fillStyle = 'red';
      context.fillRect(0, 0, surface.canvas.width, surface.canvas.height);
      expect(Array.from(context.getImageData(
        surface.canvas.width - 1,
        surface.canvas.height - 1,
        1,
        1,
      ).data)).toEqual([255, 0, 0, 255]);
    }
    second.release();
  });

  it('scrubs image-backed pattern references as soon as a lease becomes idle', async () => {
    const imageSource = new Image();
    imageSource.src =
      'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
    await imageSource.decode();
    const pool = new FilterSurfacePool();
    const pair = pool.checkoutPair(createWindows(40, 30, 20, 10));
    const dimensions = [
      pair.source.canvas.width,
      pair.source.canvas.height,
      pair.result.canvas.width,
      pair.result.canvas.height,
    ];
    const patterns = [pair.source, pair.result].map(surface => {
      const pattern = surface.context.createPattern(imageSource, 'repeat')!;
      surface.context.fillStyle = pattern;
      surface.context.strokeStyle = pattern;
      return pattern;
    });

    try {
      pair.release();

      for (const [index, surface] of [pair.source, pair.result].entries()) {
        expect(surface.context.fillStyle).toBe('#000000');
        expect(surface.context.strokeStyle).toBe('#000000');
        expect(surface.context.fillStyle).not.toBe(patterns[index]);
        expect(surface.context.strokeStyle).not.toBe(patterns[index]);
      }
      expect([
        pair.source.canvas.width,
        pair.source.canvas.height,
        pair.result.canvas.width,
        pair.result.canvas.height,
      ]).toEqual(dimensions);
      expect(pool.snapshot()).toMatchObject({
        activePairs: 0,
        pairCheckouts: 1,
        pairReturns: 1,
        resized: 0,
      });
    } finally {
      pool.dispose();
    }
  });

  it('enforces idempotent strict-LIFO leases', () => {
    const pool = new FilterSurfacePool();
    const windows = createWindows(40, 30, 20, 10);
    const outer = pool.checkoutPair(windows);
    const inner = pool.checkoutPair(windows);

    expect(() => outer.release()).toThrow(/LIFO/i);
    expect(pool.snapshot().activePairs).toBe(2);
    inner.release();
    inner.release();
    expect(pool.snapshot().activePairs).toBe(1);
    outer.release();
    outer.release();
    expect(pool.snapshot()).toMatchObject({ activePairs: 0, pairReturns: 2 });
  });

  it('atomically rolls back the depth reservation when result setup fails', () => {
    const originalGetContext = OffscreenCanvas.prototype.getContext;
    let acquisitions = 0;
    const getContext = vi.spyOn(OffscreenCanvas.prototype, 'getContext')
      .mockImplementation(function(this: OffscreenCanvas, ...args: unknown[]) {
        acquisitions += 1;
        if (acquisitions === 2) return null;
        return (originalGetContext as Function).apply(this, args);
      } as typeof OffscreenCanvas.prototype.getContext);
    const pool = new FilterSurfacePool();
    const windows = createWindows(40, 30, 20, 10);

    expect(() => pool.checkoutPair(windows)).toThrow(/result.*2D context/i);
    expect(pool.snapshot()).toMatchObject({
      surfaceSlots: 1,
      createdSurfaceSlots: 1,
      activePairs: 0,
      peakActivePairs: 0,
      pairCheckouts: 0,
      pairReturns: 0,
    });

    getContext.mockRestore();
    const recovered = pool.checkoutPair(windows);
    expect(pool.snapshot()).toMatchObject({
      surfaceSlots: 2,
      createdSurfaceSlots: 2,
      activePairs: 1,
      peakActivePairs: 1,
      pairCheckouts: 1,
    });
    recovered.release();
  });

  it('rejects invalid dimensions before changing pool state or constructing surfaces', () => {
    function InvalidWindowProbe() {}
    GLOBAL_STATE.componentRefs = {
      element: { type: InvalidWindowProbe },
    } as unknown as CRCComponentRefs<unknown>;
    const offscreenConstructor = vi.spyOn(globalThis, 'OffscreenCanvas');
    const pool = new FilterSurfacePool();
    const windows = createWindows(40, 30, 20, 10);
    const invalid = {
      ...windows,
      source: { ...windows.source, backingWidth: 0x1_0000_0000 },
    };

    expect(() => pool.checkoutPair(invalid)).toThrow(
      /InvalidWindowProbe.*source.*4294967296.*unsigned-long/i,
    );
    expect(offscreenConstructor).not.toHaveBeenCalled();
    expect(pool.snapshot()).toMatchObject({
      surfaceSlots: 0,
      activePairs: 0,
      pairCheckouts: 0,
    });
  });
});

describe('CRC instance filter-surface ownership', () => {
  it('allocates no surface for an unfiltered mount', () => {
    const offscreenConstructor = vi.spyOn(globalThis, 'OffscreenCanvas');
    const canvas = document.createElement('canvas');
    canvas.width = 80;
    canvas.height = 40;
    canvas.style.cssText = 'display:block;width:80px;height:40px';
    document.body.replaceChildren(canvas);
    const controller = mountCRC(canvas, undefined);

    executeRender(canvas, 0);

    expect(offscreenConstructor).not.toHaveBeenCalled();
    expect(getCRCInstance(canvas).filterSurfacePool.snapshot().surfaceSlots).toBe(0);
    controller.dispose();
  });

  it('disposes the pool after component teardowns and releases every slot', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 80;
    canvas.height = 40;
    canvas.style.cssText = 'display:block;width:80px;height:40px';
    document.body.replaceChildren(canvas);
    let snapshotDuringComponentTeardown:
      | ReturnType<FilterSurfacePool['snapshot']>
      | undefined;
    const Root = (_props: {}) => undefined;
    const controller = mountCRC(canvas, createElement(Root, {}));
    executeRender(canvas, 0);
    const instance = getCRCInstance(canvas);
    const pool = instance.filterSurfacePool;
    const componentRefs = [...instance.refs.values()][0]!;
    componentRefs.teardowns.add(() => {
      snapshotDuringComponentTeardown = pool.snapshot();
    });
    const pair = pool.checkoutPair(createWindows(40, 30, 20, 10));
    pair.release();

    controller.dispose();

    expect(snapshotDuringComponentTeardown).toMatchObject({
      surfaceSlots: 2,
      releasedSurfaceSlots: 0,
    });
    expect(pool.snapshot()).toMatchObject({
      surfaceSlots: 0,
      createdSurfaceSlots: 2,
      releasedSurfaceSlots: 2,
      activePairs: 0,
    });
  });
});

function createWindows(
  sourceWidth: number,
  sourceHeight: number,
  outputWidth: number,
  outputHeight: number,
): FilterWindows {
  const source = createWindow(-10, -15, sourceWidth, sourceHeight);
  const output = createWindow(0, 0, outputWidth, outputHeight);
  return {
    source,
    output,
    density: 1,
    sourceToOutputX: source.backingX - output.backingX,
    sourceToOutputY: source.backingY - output.backingY,
  };
}

function createWindow(
  backingX: number,
  backingY: number,
  backingWidth: number,
  backingHeight: number,
): FilterPixelWindow {
  const renderTransform = new DOMMatrix().translate(-backingX, -backingY);
  const target: RenderTargetSnapshot = {
    logicalBounds: {
      x: backingX,
      y: backingY,
      width: backingWidth,
      height: backingHeight,
    },
    backingWidth,
    backingHeight,
    renderTransform,
    inverseRenderTransform: renderTransform.inverse(),
  };
  return {
    ...target,
    backingX,
    backingY,
  };
}

function matrixValues(
  matrix: DOMMatrix,
): readonly [number, number, number, number, number, number] {
  return [matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f];
}
