import {
  Clip,
  Group,
  Layer,
  Rectangle,
  crc,
  createElement,
  type CRCController,
  type CRCNode,
} from '@crc/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useBackendEventTarget } from '@crc/core/internal';
import { defineWebGLPrimitive } from '../define-webgl-primitive.js';
import { WebGLLayerController } from '../layer-controller.js';
import { WebGLLayer, type WebGLLayerProps } from './webgl-layer.js';

const controllers = new Set<CRCController>();

afterEach(() => {
  for (const controller of controllers) controller.dispose();
  controllers.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe('WebGLLayer public surface', () => {
  it('uses the current allocation by default and preserves one materialization/traversal', async () => {
    const platform = installComponentPlatform();
    const draws = vi.spyOn(CanvasRenderingContext2D.prototype, 'drawImage')
      .mockImplementation(() => undefined);
    let iterations = 0;
    let childRenders = 0;
    const Child = defineWebGLPrimitive<{}, {}>(function renderLayerChild() {
      childRenders += 1;
    }, { hit: { kind: 'none' } });
    const children: Iterable<CRCNode> = {
      *[Symbol.iterator]() {
        iterations += 1;
        yield <Child pointerEvents="none" />;
      },
    };
    const canvas = createCanvas(100, 50);
    const root = <WebGLLayer>{children}</WebGLLayer>;
    const controller = crc(canvas, root, {
      viewport: { width: 80, height: 20 },
      fit: 'fill',
      pixelRatio: 2,
    });
    controllers.add(controller);

    await nextFrame();

    expect(iterations).toBe(1);
    expect(childRenders).toBe(1);
    expect(platform.constructed).toEqual([{ width: 200, height: 100 }]);
    expect(platform.contextRequests[0]).toEqual({
      type: 'webgl2',
      attributes: {
        alpha: true,
        depth: true,
        premultipliedAlpha: true,
        preserveDrawingBuffer: false,
      },
    });
    expect(draws).toHaveBeenCalledWith(
      platform.bitmap,
      0,
      0,
      200,
      100,
      0,
      0,
      80,
      20,
    );
  });

  it('registers one bounded resolver in paint order and pointerEvents none omits it while painting', async () => {
    installComponentPlatform();
    vi.spyOn(CanvasRenderingContext2D.prototype, 'drawImage')
      .mockImplementation(() => undefined);
    const resolve = vi.spyOn(WebGLLayerController.prototype, 'resolveLocal');
    const rearClick = vi.fn();
    const canvas = createCanvas(100, 60);
    const clip = new Path2D();
    clip.rect(0, 0, 15, 20);
    const scene = (pointerEvents: 'auto' | 'none') => [
      <Rectangle
        key="rear"
        style={{ width: 100, height: 60, fill: '#000' }}
        onClick={rearClick}
      />,
      <Group key="island" style={{ translateX: 20, translateY: 10 }}>
        <Clip style={{ d: clip }}>
          <WebGLLayer
            style={{ width: 30, height: 20 }}
            pointerEvents={pointerEvents}
          >
            {undefined}
          </WebGLLayer>
        </Clip>
      </Group>,
    ];
    const root = scene('auto');
    const controller = crc(canvas, root, { pixelRatio: 1 });
    controllers.add(controller);
    await nextFrame();

    const { getCRCInstance } = await import(
      '../../../../core/src/lib/global-state.js'
    );
    const { resolveCoordinateTarget } = await import(
      '../../../../core/src/lib/events/hit-test.js'
    );
    const instance = getCRCInstance(canvas);
    const eventRoot = instance.eventRoot;
    const entries = Array.from(instance.paintEntries);
    expect(entries.map(entry => entry.paintKind)).toEqual([0, 2]);
    expect(entries[1]).toMatchObject({
      transform: { e: 20, f: 10 },
      clippingStack: [{ fillRule: 'nonzero' }],
    });

    expect(resolveCoordinateTarget(eventRoot, { x: 25, y: 15 }))
      .toBeDefined();
    expect(resolve).toHaveBeenCalledOnce();
    expect(resolve).toHaveBeenLastCalledWith(5, 5, expect.any(Object));
    expect(resolveCoordinateTarget(eventRoot, { x: 37, y: 15 }))
      .toBeDefined();
    expect(resolve).toHaveBeenCalledOnce();
    expect(resolveCoordinateTarget(eventRoot, { x: 55, y: 15 }))
      .toBeDefined();
    expect(resolve).toHaveBeenCalledOnce();

    const noEvents = scene('none');
    crc(canvas, noEvents);
    await nextFrame();
    expect(Array.from(instance.paintEntries).map(entry => entry.paintKind))
      .toEqual([0]);
    expect(resolveCoordinateTarget(eventRoot, { x: 25, y: 15 }))
      .toBeDefined();
    expect(resolve).toHaveBeenCalledOnce();
  });

  it('binds the Canvas event parent before executing the private child', async () => {
    installComponentPlatform();
    vi.spyOn(CanvasRenderingContext2D.prototype, 'drawImage')
      .mockImplementation(() => undefined);
    const eventParents: unknown[] = [];
    const Interactive = defineWebGLPrimitive<{}, {}>(
      function renderEventParentProbe() {
        const target = useBackendEventTarget({ onClick() {} });
        eventParents.push(target?.owner.eventParent);
      },
      { hit: { kind: 'custom', resolve: () => null } },
    );
    const canvas = createCanvas(40, 20);
    const controller = crc(
      canvas,
      <WebGLLayer><Interactive /></WebGLLayer>,
      { pixelRatio: 1 },
    );
    controllers.add(controller);

    await nextFrame();

    expect(eventParents).toHaveLength(1);
    expect(eventParents[0]).toBeDefined();
  });

  it('composites through outer Group, Clip, Layer, and its receiving filter', async () => {
    const PaintRed = defineWebGLPrimitive<{}, {}>(function renderRed(
      _props,
      _style,
      context,
    ) {
      context.gl.clearColor(1, 0, 0, 1);
      context.gl.clear(context.gl.COLOR_BUFFER_BIT);
    }, { hit: { kind: 'none' } });
    const clip = new Path2D();
    clip.rect(0, 0, 30, 20);
    const canvas = createCanvas(80, 50);
    const root = (
      <Group style={{ translateX: 10, translateY: 8 }}>
        <Clip style={{ d: clip }}>
          <Layer style={{ width: 40, height: 30 }}>
            <WebGLLayer style={{ filter: { type: 'opacity', amount: 0.5 } }}>
              <PaintRed pointerEvents="none" />
            </WebGLLayer>
          </Layer>
        </Clip>
      </Group>
    );
    const controller = crc(canvas, root, { pixelRatio: 1 });
    controllers.add(controller);

    await nextFrame();

    const inside = pixel(canvas, 15, 13);
    expect(inside[0]).toBeGreaterThan(240);
    expect(inside[1]).toBeLessThan(10);
    expect(inside[2]).toBeLessThan(10);
    expect(inside[3]).toBeGreaterThan(115);
    expect(inside[3]).toBeLessThan(140);
    expect(pixel(canvas, 45, 13)[3]).toBe(0);
  });

  it('types children as required and accepts box/layout/filter style', () => {
    const props: WebGLLayerProps = { children: undefined };
    expect(props.children).toBeUndefined();
    createElement(WebGLLayer, {
      children: undefined,
      style: {
        width: '50%',
        height: 'auto',
        left: 4,
        filter: { type: 'blur', radius: 2 },
      },
    });
    // @ts-expect-error WebGLLayer always has an explicit children field.
    createElement(WebGLLayer, {});
  });
});

function installComponentPlatform() {
  const constructed: Array<{ width: number; height: number }> = [];
  const contextRequests: Array<{ type: string; attributes: unknown }> = [];
  const gl = createNoopGL();
  const bitmap = {
    width: 1,
    height: 1,
    close: vi.fn(),
  } as unknown as ImageBitmap;
  class RecordingOffscreenCanvas {
    width: number;
    height: number;

    constructor(width: number, height: number) {
      this.width = width;
      this.height = height;
      constructed.push({ width, height });
    }

    getContext(type: string, attributes?: unknown): WebGL2RenderingContext | null {
      contextRequests.push({ type, attributes });
      return gl;
    }

    transferToImageBitmap(): ImageBitmap {
      return bitmap;
    }
  }
  vi.stubGlobal('OffscreenCanvas', RecordingOffscreenCanvas);
  return { constructed, contextRequests, bitmap };
}

function createNoopGL(): WebGL2RenderingContext {
  let constant = 1;
  return new Proxy({}, {
    get(target, property) {
      if (typeof property !== 'string') return undefined;
      const record = target as Record<string, unknown>;
      if (!(property in record)) {
        record[property] = /^[A-Z0-9_]+$/.test(property) ? constant++ :
          property === 'getParameter' ? () => 8 :
            property === 'getContextAttributes' ? () => ({
              alpha: true,
              antialias: false,
              depth: true,
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

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.style.cssText = `display:block;width:${width}px;height:${height}px`;
  document.body.appendChild(canvas);
  return canvas;
}

function pixel(canvas: HTMLCanvasElement, x: number, y: number): number[] {
  return Array.from(canvas.getContext('2d')!.getImageData(x, y, 1, 1).data);
}

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}
