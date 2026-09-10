import { crc, createElement, type CRCController } from '@crc/core';
import { useInternalHookSlot } from '@crc/core/internal';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineWebGLPrimitive } from './define-webgl-primitive.js';
import {
  WebGLLayerController,
  resolveWebGLLayerSurface,
} from './layer-controller.js';

const parents = new Set<CRCController>();

afterEach(() => {
  for (const parent of parents) parent.dispose();
  parents.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe('WebGLLayerController surface and capabilities', () => {
  it('rounds independent backing dimensions once and requests exact WebGL2 attributes', () => {
    const platform = installRecordingPlatform();
    const parentCanvas = mountParent();
    const surface = resolveWebGLLayerSurface(7, 5, { x: 1.5, y: 2.5 });
    const controller = new WebGLLayerController(
      parentCanvas,
      undefined,
      undefined,
      surface,
    );

    expect(surface).toEqual({
      logicalWidth: 7,
      logicalHeight: 5,
      backingWidth: 11,
      backingHeight: 13,
      densityX: 11 / 7,
      densityY: 13 / 5,
    });
    expect(platform.constructed).toEqual([{ width: 11, height: 13 }]);
    expect(platform.contextRequests).toEqual([{
      type: 'webgl2',
      attributes: {
        alpha: true,
        depth: true,
        premultipliedAlpha: true,
        preserveDrawingBuffer: false,
      },
    }]);
    controller.dispose();
  });

  it.each([
    ['missing OffscreenCanvas', () => vi.stubGlobal('OffscreenCanvas', undefined), /WebGLLayer.*OffscreenCanvas/i],
    ['missing WebGL2', () => installRecordingPlatform({ context: null }), /WebGLLayer.*WebGL2/i],
    ['missing bitmap transfer', () => installRecordingPlatform({ transfer: undefined }), /WebGLLayer.*transferToImageBitmap/i],
    ['missing alpha', () => installRecordingPlatform({ attributes: { alpha: false, depth: true } }), /WebGLLayer.*alpha/i],
    ['missing depth', () => installRecordingPlatform({ attributes: { alpha: true, depth: false } }), /WebGLLayer.*depth/i],
  ] as const)('rejects %s before child execution', (_label, install, message) => {
    install();
    const childRender = vi.fn();
    const Child = defineWebGLPrimitive<{}, {}>(function renderCapabilityChild() {
      childRender();
    }, { hit: { kind: 'none' } });
    const root = createElement(Child, { pointerEvents: 'none' });
    const parentCanvas = mountParent();

    expect(() => new WebGLLayerController(
      parentCanvas,
      root,
      undefined,
      resolveWebGLLayerSurface(10, 10, { x: 1, y: 1 }),
    )).toThrowError(message);
    expect(childRender).not.toHaveBeenCalled();
  });

  it.each([
    [0, 10, 1, 1],
    [-1, 10, 1, 1],
    [Number.NaN, 10, 1, 1],
    [10, Number.POSITIVE_INFINITY, 1, 1],
    [10, 10, 0, 1],
    [10, 10, 1, Number.NaN],
  ])('rejects invalid logical or density dimensions before allocation %#', (
    width,
    height,
    densityX,
    densityY,
  ) => {
    const platform = installRecordingPlatform();

    expect(() => resolveWebGLLayerSurface(
      width,
      height,
      { x: densityX, y: densityY },
    )).toThrowError(/WebGLLayer/i);
    expect(platform.constructed).toEqual([]);
  });

  it('rejects backing dimensions outside the OffscreenCanvas integer range before allocation', () => {
    const platform = installRecordingPlatform();

    expect(() => resolveWebGLLayerSurface(
      0x1_0000_0000,
      1,
      { x: 1, y: 1 },
    )).toThrowError(/WebGLLayer.*backing width.*representable integer/i);
    expect(platform.constructed).toEqual([]);
  });

  it('rejects a constructor dimension clamp before context acquisition or child execution', () => {
    const platform = installRecordingPlatform({
      constructDimensions: (width, height) => ({
        width: width - 1,
        height,
      }),
    });
    const childRender = vi.fn();
    const Child = defineWebGLPrimitive<{}, {}>(function renderClampedChild() {
      childRender();
    }, { hit: { kind: 'none' } });
    const root = createElement(Child, { pointerEvents: 'none' });

    expect(() => new WebGLLayerController(
      mountParent(),
      root,
      undefined,
      resolveWebGLLayerSurface(11, 7, { x: 1, y: 1 }),
    )).toThrowError(/WebGLLayer.*OffscreenCanvas.*dimensions/i);
    expect(platform.contextRequests).toEqual([]);
    expect(childRender).not.toHaveBeenCalled();
  });

  it('resizes one private mount without replacing its hook identity or WebGL context', () => {
    const platform = installRecordingPlatform();
    const parentCanvas = mountParent();
    const identities: object[] = [];
    const viewports: Array<{
      logical: Readonly<{ width: number; height: number }>;
      backing: Readonly<{ width: number; height: number }>;
      density: Readonly<{ x: number; y: number }>;
    }> = [];
    const cleanup = vi.fn();
    const Probe = defineWebGLPrimitive<{}, {}>(function renderResizeProbe(
      _props,
      _style,
      context,
    ) {
      viewports.push({
        logical: context.logicalViewport,
        backing: context.backingViewport,
        density: context.density,
      });
    }, { hit: { kind: 'none' } });
    function Stateful(_props: {}) {
      const identity = useInternalHookSlot('resize-identity', teardowns => {
        teardowns.add(cleanup);
        return {};
      });
      identities.push(identity.value);
      return createElement(Probe, { pointerEvents: 'none' });
    }
    const root = createElement(Stateful, { key: 'stable' });
    const initial = resolveWebGLLayerSurface(10, 8, { x: 1, y: 1 });
    const resized = resolveWebGLLayerSurface(12, 6, { x: 2, y: 3 });
    const controller = new WebGLLayerController(
      parentCanvas,
      root,
      undefined,
      initial,
    );
    const originalCanvas = controller.canvas;
    const originalContext = controller.gl;
    const context = { drawImage() {} } as unknown as CanvasRenderingContext2D;

    controller.renderUpdatedChild(root, undefined, initial, 1);
    controller.composite(context, { x: 0, y: 0, width: 10, height: 8 });
    controller.renderUpdatedChild(root, undefined, resized, 2);
    controller.composite(context, { x: 0, y: 0, width: 12, height: 6 });

    expect(platform.constructed).toEqual([{ width: 10, height: 8 }]);
    expect(controller.canvas).toBe(originalCanvas);
    expect(controller.gl).toBe(originalContext);
    expect(controller.contextGeneration).toBe(1);
    expect(controller.canvas.width).toBe(24);
    expect(controller.canvas.height).toBe(18);
    expect(identities).toHaveLength(2);
    expect(identities[1]).toBe(identities[0]);
    expect(cleanup).not.toHaveBeenCalled();
    expect(viewports).toEqual([
      {
        logical: { width: 10, height: 8 },
        backing: { width: 10, height: 8 },
        density: { x: 1, y: 1 },
      },
      {
        logical: { width: 12, height: 6 },
        backing: { width: 24, height: 18 },
        density: { x: 2, y: 3 },
      },
    ]);

    controller.dispose();
    controller.dispose();
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it('rolls back a clamped resize before child execution or surface publication', () => {
    const stable = bitmap('stable');
    const platform = installRecordingPlatform({
      transfers: [stable],
      resizeDimension: (axis, value) =>
        axis === 'height' && value === 18 ? 17 : value,
    });
    const parentCanvas = mountParent();
    const childRender = vi.fn();
    const Child = defineWebGLPrimitive<{}, {}>(function renderResizeClampChild() {
      childRender();
    }, { hit: { kind: 'none' } });
    const root = createElement(Child, { pointerEvents: 'none' });
    const initial = resolveWebGLLayerSurface(10, 8, { x: 1, y: 1 });
    const resized = resolveWebGLLayerSurface(12, 6, { x: 2, y: 3 });
    const controller = new WebGLLayerController(
      parentCanvas,
      root,
      undefined,
      initial,
    );
    const context = { drawImage() {} } as unknown as CanvasRenderingContext2D;
    controller.renderUpdatedChild(root, undefined, initial, 1);
    controller.composite(context, { x: 0, y: 0, width: 10, height: 8 });
    childRender.mockClear();

    expect(() => controller.renderUpdatedChild(
      root,
      undefined,
      resized,
      2,
    )).toThrowError(/WebGLLayer.*resize.*dimensions/i);

    expect(childRender).not.toHaveBeenCalled();
    expect(platform.transferCount).toBe(1);
    expect(controller.canvas.width).toBe(initial.backingWidth);
    expect(controller.canvas.height).toBe(initial.backingHeight);
    expect(controller.surface).toBe(initial);
    expect(controller.committedGeneration).toBe(1);
    expect(stable.close).not.toHaveBeenCalled();

    controller.dispose();
    expect(stable.close).toHaveBeenCalledOnce();
  });
});

describe('WebGLLayerController bitmap transaction', () => {
  it('renders, transfers, draws, commits, then closes the previous bitmap', () => {
    const calls: string[] = [];
    let controller: WebGLLayerController;
    const second = bitmap('second', () => {
      // This bitmap is the new committed owner and is closed only on disposal.
    });
    const previous = bitmap('previous', () => {
      calls.push('commit-generation');
      calls.push('close-previous-bitmap');
      expect(controller.committedGeneration).toBe(2);
    });
    const platform = installRecordingPlatform({
      transfers: [previous, second],
      onTransfer: () => calls.push('transfer-to-image-bitmap'),
    });
    const parentCanvas = mountParent();
    const Child = defineWebGLPrimitive<{}, {}>(function renderTransactionChild() {
      calls.push('child-render');
    }, { hit: { kind: 'none' } });
    const root = createElement(Child, { pointerEvents: 'none' });
    controller = new WebGLLayerController(
      parentCanvas,
      root,
      undefined,
      resolveWebGLLayerSurface(10, 8, { x: 1, y: 1 }),
    );
    const context = {
      drawImage() {
        calls.push('parent-draw-image');
      },
    } as unknown as CanvasRenderingContext2D;

    controller.renderUpdatedChild(root, undefined, controller.surface, 1);
    controller.composite(context, { x: 0, y: 0, width: 10, height: 8 });
    calls.length = 0;
    controller.renderUpdatedChild(root, undefined, controller.surface, 2);
    controller.composite(context, { x: 0, y: 0, width: 10, height: 8 });

    expect(calls).toEqual([
      'child-render',
      'transfer-to-image-bitmap',
      'parent-draw-image',
      'commit-generation',
      'close-previous-bitmap',
    ]);
    expect(controller.committedGeneration).toBe(2);
    expect(platform.transferCount).toBe(2);
    controller.dispose();
  });

  it('keeps the prior committed pair through child and transfer failures', () => {
    const stable = bitmap('stable');
    const platform = installRecordingPlatform({ transfers: [stable] });
    const parentCanvas = mountParent();
    const Good = defineWebGLPrimitive<{}, {}>(function renderGood() {}, {
      hit: { kind: 'none' },
    });
    const failure = new Error('child render failed');
    const Bad = defineWebGLPrimitive<{}, {}>(function renderBad() {
      throw failure;
    }, { hit: { kind: 'none' } });
    const surface = resolveWebGLLayerSurface(10, 8, { x: 1, y: 1 });
    const goodRoot = createElement(Good, { pointerEvents: 'none' });
    const controller = new WebGLLayerController(
      parentCanvas,
      goodRoot,
      undefined,
      surface,
    );
    const context = { drawImage() {} } as unknown as CanvasRenderingContext2D;
    controller.renderUpdatedChild(goodRoot, undefined, surface, 1);
    controller.composite(context, { x: 0, y: 0, width: 10, height: 8 });

    expect(() => controller.renderUpdatedChild(
      createElement(Bad, { pointerEvents: 'none' }),
      undefined,
      surface,
      2,
    )).toThrow(failure);
    expect(controller.committedGeneration).toBe(1);
    expect(stable.close).not.toHaveBeenCalled();

    const transferFailure = new Error('transfer failed');
    platform.throwTransfer = transferFailure;
    let observedTransferFailure: unknown;
    try {
      controller.renderUpdatedChild(goodRoot, undefined, surface, 3);
    } catch (error) {
      observedTransferFailure = error;
    }
    expect(observedTransferFailure).toMatchObject({
      message: expect.stringMatching(/WebGLLayer.*transfer/i),
      cause: transferFailure,
    });
    expect(controller.committedGeneration).toBe(1);
    expect(stable.close).not.toHaveBeenCalled();

    controller.dispose();
    controller.dispose();
    expect(stable.close).toHaveBeenCalledOnce();
  });

  it('closes a failed draw candidate without publishing its ledger and disposes the prior bitmap once', () => {
    const stable = bitmap('stable');
    const candidate = bitmap('candidate');
    installRecordingPlatform({ transfers: [stable, candidate] });
    const parentCanvas = mountParent();
    const Child = defineWebGLPrimitive<{}, {}>(function renderDrawFailureChild() {}, {
      hit: { kind: 'none' },
    });
    const root = createElement(Child, { pointerEvents: 'none' });
    const surface = resolveWebGLLayerSurface(10, 8, { x: 1, y: 1 });
    const controller = new WebGLLayerController(
      parentCanvas,
      root,
      undefined,
      surface,
    );
    controller.renderUpdatedChild(root, undefined, surface, 1);
    controller.composite(
      { drawImage() {} } as unknown as CanvasRenderingContext2D,
      { x: 0, y: 0, width: 10, height: 8 },
    );
    controller.renderUpdatedChild(root, undefined, surface, 2);

    expect(() => controller.composite({
      drawImage() {
        throw new Error('parent draw failed');
      },
    } as unknown as CanvasRenderingContext2D, {
      x: 0,
      y: 0,
      width: 10,
      height: 8,
    })).toThrowError('parent draw failed');
    expect(controller.committedGeneration).toBe(1);
    expect(candidate.close).toHaveBeenCalledOnce();
    expect(stable.close).not.toHaveBeenCalled();

    controller.dispose();
    controller.dispose();
    expect(candidate.close).toHaveBeenCalledOnce();
    expect(stable.close).toHaveBeenCalledOnce();
  });

  it('does not transfer or retain ownership after disposal during child traversal', () => {
    const candidate = bitmap('never-transferred');
    const platform = installRecordingPlatform({ transfers: [candidate] });
    const parentCanvas = mountParent();
    let controller: WebGLLayerController;
    const Child = defineWebGLPrimitive<{}, {}>(function renderDisposingChild() {
      controller.dispose();
    }, { hit: { kind: 'none' } });
    const root = createElement(Child, { pointerEvents: 'none' });
    const surface = resolveWebGLLayerSurface(10, 8, { x: 1, y: 1 });
    controller = new WebGLLayerController(
      parentCanvas,
      root,
      undefined,
      surface,
    );

    expect(() => controller.renderUpdatedChild(
      root,
      undefined,
      surface,
      1,
    )).toThrowError(/WebGLLayer.*disposed/i);
    expect(platform.transferCount).toBe(0);
    expect(candidate.close).not.toHaveBeenCalled();
    expectNoOwnedGenerations(controller);

    controller.dispose();
    expect(candidate.close).not.toHaveBeenCalled();
  });

  it('closes a locally acquired bitmap when disposal occurs during transfer', () => {
    const candidate = bitmap('disposed-during-transfer');
    let controller: WebGLLayerController;
    const platform = installRecordingPlatform({
      transfers: [candidate],
      onTransfer: () => controller.dispose(),
    });
    const parentCanvas = mountParent();
    const Child = defineWebGLPrimitive<{}, {}>(function renderTransferChild() {}, {
      hit: { kind: 'none' },
    });
    const root = createElement(Child, { pointerEvents: 'none' });
    const surface = resolveWebGLLayerSurface(10, 8, { x: 1, y: 1 });
    controller = new WebGLLayerController(
      parentCanvas,
      root,
      undefined,
      surface,
    );

    expect(() => controller.renderUpdatedChild(
      root,
      undefined,
      surface,
      1,
    )).toThrowError(/WebGLLayer.*disposed/i);
    expect(platform.transferCount).toBe(1);
    expect(candidate.close).toHaveBeenCalledOnce();
    expectNoOwnedGenerations(controller);

    controller.dispose();
    expect(candidate.close).toHaveBeenCalledOnce();
  });

  it('does not republish a candidate disposed during parent drawImage', () => {
    const candidate = bitmap('disposed-during-draw');
    installRecordingPlatform({ transfers: [candidate] });
    const parentCanvas = mountParent();
    const Child = defineWebGLPrimitive<{}, {}>(function renderDrawDisposeChild() {}, {
      hit: { kind: 'none' },
    });
    const root = createElement(Child, { pointerEvents: 'none' });
    const surface = resolveWebGLLayerSurface(10, 8, { x: 1, y: 1 });
    const controller = new WebGLLayerController(
      parentCanvas,
      root,
      undefined,
      surface,
    );
    controller.renderUpdatedChild(root, undefined, surface, 1);

    expect(() => controller.composite({
      drawImage() {
        controller.dispose();
      },
    } as unknown as CanvasRenderingContext2D, {
      x: 0,
      y: 0,
      width: 10,
      height: 8,
    })).toThrowError(/WebGLLayer.*disposed/i);
    expect(candidate.close).toHaveBeenCalledOnce();
    expectNoOwnedGenerations(controller);

    controller.dispose();
    expect(candidate.close).toHaveBeenCalledOnce();
  });

  it('rejects a reentrant render during draw without replacing or leaking its candidate', () => {
    const candidate = bitmap('reentrant-draw');
    const platform = installRecordingPlatform({ transfers: [candidate] });
    const parentCanvas = mountParent();
    const Child = defineWebGLPrimitive<{}, {}>(function renderReentrantChild() {}, {
      hit: { kind: 'none' },
    });
    const root = createElement(Child, { pointerEvents: 'none' });
    const surface = resolveWebGLLayerSurface(10, 8, { x: 1, y: 1 });
    const controller = new WebGLLayerController(
      parentCanvas,
      root,
      undefined,
      surface,
    );
    controller.renderUpdatedChild(root, undefined, surface, 1);

    expect(() => controller.composite({
      drawImage() {
        controller.renderUpdatedChild(root, undefined, surface, 2);
      },
    } as unknown as CanvasRenderingContext2D, {
      x: 0,
      y: 0,
      width: 10,
      height: 8,
    })).toThrowError(/WebGLLayer.*reentrant render/i);
    expect(platform.transferCount).toBe(1);
    expect(candidate.close).toHaveBeenCalledOnce();
    expectNoOwnedGenerations(controller);

    controller.dispose();
    expect(candidate.close).toHaveBeenCalledOnce();
  });
});

function expectNoOwnedGenerations(controller: WebGLLayerController): void {
  const ownership = controller as unknown as {
    pending: unknown;
    committed: unknown;
  };
  expect(ownership.pending).toBeUndefined();
  expect(ownership.committed).toBeUndefined();
  expect(controller.committedGeneration).toBeUndefined();
}

interface FakeBitmap extends ImageBitmap {
  readonly label: string;
}

function bitmap(label: string, onClose?: () => void): FakeBitmap {
  return {
    label,
    width: 1,
    height: 1,
    close: vi.fn<() => void>(onClose),
  } as unknown as FakeBitmap;
}

interface RecordingPlatformOptions {
  readonly context?: WebGL2RenderingContext | null;
  readonly transfer?: (() => ImageBitmap) | undefined;
  readonly transfers?: FakeBitmap[];
  readonly attributes?: { alpha: boolean; depth: boolean };
  readonly onTransfer?: () => void;
  readonly constructDimensions?: (
    width: number,
    height: number,
  ) => { width: number; height: number };
  readonly resizeDimension?: (
    axis: 'width' | 'height',
    value: number,
  ) => number;
}

function installRecordingPlatform(options: RecordingPlatformOptions = {}) {
  const constructed: Array<{ width: number; height: number }> = [];
  const contextRequests: Array<{ type: string; attributes: unknown }> = [];
  const gl = options.context === undefined ? createNoopGL(options.attributes) : options.context;
  let transferCount = 0;
  let throwTransfer: Error | undefined;
  class RecordingOffscreenCanvas {
    private currentWidth: number;
    private currentHeight: number;

    constructor(width: number, height: number) {
      const actual = options.constructDimensions?.(width, height) ?? {
        width,
        height,
      };
      this.currentWidth = actual.width;
      this.currentHeight = actual.height;
      constructed.push({ width, height });
      (this as unknown as { transferToImageBitmap?: () => ImageBitmap })
        .transferToImageBitmap = 'transfer' in options ? options.transfer : () => {
          transferCount += 1;
          options.onTransfer?.();
          if (throwTransfer) throw throwTransfer;
          const next = options.transfers?.shift() ?? bitmap(`bitmap-${transferCount}`);
          return next;
        };
    }

    get width(): number {
      return this.currentWidth;
    }

    set width(value: number) {
      this.currentWidth = options.resizeDimension?.('width', value) ?? value;
    }

    get height(): number {
      return this.currentHeight;
    }

    set height(value: number) {
      this.currentHeight = options.resizeDimension?.('height', value) ?? value;
    }

    getContext(type: string, attributes?: unknown): WebGL2RenderingContext | null {
      contextRequests.push({ type, attributes });
      return gl;
    }

  }
  vi.stubGlobal('OffscreenCanvas', RecordingOffscreenCanvas);
  return {
    constructed,
    contextRequests,
    get transferCount() {
      return transferCount;
    },
    set throwTransfer(value: Error | undefined) {
      throwTransfer = value;
    },
  };
}

function createNoopGL(
  attributes: { alpha: boolean; depth: boolean } = { alpha: true, depth: true },
): WebGL2RenderingContext {
  let constant = 1;
  return new Proxy({}, {
    get(target, property) {
      if (typeof property !== 'string') return undefined;
      const record = target as Record<string, unknown>;
      if (!(property in record)) {
        record[property] = /^[A-Z0-9_]+$/.test(property) ? constant++ :
          property === 'getParameter' ? () => 8 :
            property === 'getContextAttributes' ? () => ({
              alpha: attributes.alpha,
              antialias: false,
              depth: attributes.depth,
              desynchronized: false,
              failIfMajorPerformanceCaveat: false,
              powerPreference: 'default',
              premultipliedAlpha: true,
              preserveDrawingBuffer: false,
              stencil: false,
              xrCompatible: false,
            }) : () => undefined;
      }
      return record[property];
    },
  }) as WebGL2RenderingContext;
}

function mountParent(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 40;
  canvas.height = 20;
  document.body.appendChild(canvas);
  const parent = crc(canvas, undefined, { pixelRatio: 1 });
  parents.add(parent);
  return canvas;
}
