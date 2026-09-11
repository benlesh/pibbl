import {
  Clip,
  Group,
  Layer,
  Rectangle,
  Star,
  crc,
  createElement,
  type CRCController,
  type CRCNode,
} from '@crc/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useBackendEventTarget } from '@crc/core/internal';
import { jsxDEV } from '@crc/core/jsx-dev-runtime';
import { defineWebGLPrimitive } from '../define-webgl-primitive.js';
import { Cube } from './cube.js';
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
  it('includes jsxDEV source in a representative capability failure', () => {
    vi.stubGlobal('OffscreenCanvas', undefined);
    let frame: FrameRequestCallback | undefined;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
      frame = callback;
      return 1;
    });
    const source = {
      fileName: '/app/island.tsx',
      lineNumber: 42,
      columnNumber: 9,
    };
    const canvas = createCanvas(100, 50);
    const controller = crc(
      canvas,
      jsxDEV(
        WebGLLayer,
        { children: null },
        undefined,
        false,
        source,
        undefined,
      ),
      { pixelRatio: 1 },
    );
    controllers.add(controller);

    expect(() => frame?.(1)).toThrowError(
      /WebGLLayer requires browser OffscreenCanvas support.*JSX source: \/app\/island\.tsx:42:9/i,
    );
  });

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
    const Interactive = defineWebGLPrimitive<{}, {}>(
      function renderBridgeOwnershipTarget() {},
      { hit: { kind: 'custom', resolve: () => null } },
    );
    const canvas = createCanvas(100, 60);
    const clip = new Path2D();
    clip.rect(0, 0, 15, 20);
    const scene = (
      pointerEvents: 'auto' | 'none',
      translateX = 20,
    ) => [
      <Rectangle
        key="rear"
        style={{ width: 100, height: 60, fill: '#000' }}
        onClick={rearClick}
      />,
      <Group key="island" style={{ translateX, translateY: 10 }}>
        <Clip style={{ d: clip }}>
          <WebGLLayer
            style={{ width: 30, height: 20 }}
            pointerEvents={pointerEvents}
          >
            <Interactive onClick={() => undefined} />
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
    const backendTarget = Array.from(eventRoot.targets).find(
      target => target.owner !== instance,
    )!;
    const childInstance = backendTarget.owner;
    const entries = Array.from(instance.paintEntries);
    expect(entries.map(entry => entry.paintKind)).toEqual([0, 2]);
    expect(entries[1]).toMatchObject({
      transform: { e: 20, f: 10 },
      clippingStack: [{ fillRule: 'nonzero' }],
    });
    expect(focusParentBridge(childInstance)).toBe(entries[1]);
    expect(focusParentBridge(childInstance)).toMatchObject({
      instance: childInstance,
      transform: { e: 20, f: 10 },
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

    const noEvents = scene('none', 30);
    crc(canvas, noEvents);
    await nextFrame();
    expect(Array.from(instance.paintEntries).map(entry => entry.paintKind))
      .toEqual([0]);
    expect(focusParentBridge(childInstance)).toMatchObject({
      instance: childInstance,
      transform: { e: 30, f: 10 },
    });
    expect(resolveCoordinateTarget(eventRoot, { x: 25, y: 15 }))
      .toBeDefined();
    expect(resolve).toHaveBeenCalledOnce();

    crc(canvas, scene('auto', 40));
    await nextFrame();
    const restoredEntries = Array.from(instance.paintEntries);
    expect(restoredEntries.map(entry => entry.paintKind)).toEqual([0, 2]);
    expect(focusParentBridge(childInstance)).toBe(restoredEntries[1]);
    expect(focusParentBridge(childInstance)).toMatchObject({
      transform: { e: 40, f: 10 },
    });

    crc(canvas, <Rectangle
      keyboardFocusable={false}
      style={{ width: 100, height: 60, fill: '#000' }}
      onClick={rearClick}
    />);
    await nextFrame();
    expect(childInstance.mainTeardowns.closed).toBe(true);
    expect(focusParentBridge(childInstance)).toBeUndefined();

    crc(canvas, scene('none', 50));
    await nextFrame();
    const replacementTarget = Array.from(eventRoot.targets).find(
      target => target.owner !== instance,
    )!;
    expect(replacementTarget.owner).not.toBe(childInstance);
    expect(focusParentBridge(replacementTarget.owner)).toMatchObject({
      instance: replacementTarget.owner,
      transform: { e: 50, f: 10 },
    });
    expect(focusParentBridge(childInstance)).toBeUndefined();
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

  it('resolves transparent background and Canvas/WebGL order without a second traversal', async () => {
    const rearClick = vi.fn();
    const cubeClick = vi.fn();
    const starClick = vi.fn();
    const readPixels = vi.spyOn(
      WebGL2RenderingContext.prototype,
      'readPixels',
    );
    const picker = vi.spyOn(WebGLLayerController.prototype, 'resolveLocal');
    const canvas = createCanvas(100, 100);
    const scene = (
      starPointerEvents: 'auto' | 'none',
      cubePointerEvents: 'auto' | 'none' = 'auto',
    ) => (
      <>
        <Rectangle
          style={{ width: 100, height: 100, fill: '#1d4ed8' }}
          onClick={rearClick}
        />
        <WebGLLayer style={{ width: 100, height: 100 }}>
          <Cube
            onClick={cubeClick}
            pointerEvents={cubePointerEvents}
          />
        </WebGLLayer>
        <Star
          pointerEvents={starPointerEvents}
          onClick={starClick}
          style={{
            points: 5,
            cx: 50,
            cy: 50,
            outerRadius: 14,
            innerRadius: 7,
            fill: '#f59e0b',
          }}
        />
      </>
    );
    const controller = crc(canvas, scene('auto'), { pixelRatio: 1 });
    controllers.add(controller);
    await nextFrame();

    dispatchClick(canvas, 50, 50);
    expect(starClick).toHaveBeenCalledOnce();
    expect(cubeClick).not.toHaveBeenCalled();
    expect(rearClick).not.toHaveBeenCalled();
    expect(picker).not.toHaveBeenCalled();

    dispatchClick(canvas, 5, 5);
    expect(rearClick).toHaveBeenCalledOnce();
    expect(picker).toHaveBeenCalledTimes(3);

    crc(canvas, scene('none'));
    await nextFrame();
    dispatchClick(canvas, 50, 50);
    expect(cubeClick).toHaveBeenCalledOnce();
    expect(starClick).toHaveBeenCalledOnce();
    expect(rearClick).toHaveBeenCalledOnce();
    expect(picker).toHaveBeenCalledTimes(6);

    crc(canvas, scene('none', 'none'));
    await nextFrame();
    dispatchClick(canvas, 50, 50);
    expect(rearClick).toHaveBeenCalledTimes(2);
    expect(cubeClick).toHaveBeenCalledOnce();
    expect(picker).toHaveBeenCalledTimes(9);
    expect(readPixels).not.toHaveBeenCalled();
  });

  it('uses two WebGLLayers to interleave a Canvas target between WebGL passes', async () => {
    const backClick = vi.fn();
    const canvasClick = vi.fn();
    const frontClick = vi.fn();
    const canvas = createCanvas(100, 100);
    const scene = (
      frontPointerEvents: 'auto' | 'none',
      canvasPointerEvents: 'auto' | 'none',
    ) => (
      <>
        <WebGLLayer
          key="back"
          style={{ width: 100, height: 100 }}
        >
          <Cube onClick={backClick} />
        </WebGLLayer>
        <Rectangle
          pointerEvents={canvasPointerEvents}
          onClick={canvasClick}
          style={{
            x: 35,
            y: 35,
            width: 30,
            height: 30,
            fill: '#f59e0b',
          }}
        />
        <WebGLLayer
          key="front"
          pointerEvents={frontPointerEvents}
          style={{ width: 100, height: 100 }}
        >
          <Cube onClick={frontClick} />
        </WebGLLayer>
      </>
    );
    const controller = crc(canvas, scene('auto', 'auto'), { pixelRatio: 1 });
    controllers.add(controller);
    await nextFrame();

    dispatchClick(canvas, 50, 50);
    expect(frontClick).toHaveBeenCalledOnce();
    expect(canvasClick).not.toHaveBeenCalled();
    expect(backClick).not.toHaveBeenCalled();

    crc(canvas, scene('none', 'auto'));
    await nextFrame();
    dispatchClick(canvas, 50, 50);
    expect(canvasClick).toHaveBeenCalledOnce();
    expect(backClick).not.toHaveBeenCalled();

    crc(canvas, scene('none', 'none'));
    await nextFrame();
    dispatchClick(canvas, 50, 50);
    expect(backClick).toHaveBeenCalledOnce();
  });

  it('falls through an old committed ledger after its private target is released', async () => {
    installComponentPlatform();
    const { getCRCInstance } = await import(
      '../../../../core/src/lib/global-state.js'
    );
    const { resolveCoordinateTarget } = await import(
      '../../../../core/src/lib/events/hit-test.js'
    );
    const rearClick = vi.fn();
    const staleCustomHit = vi.fn(() => 4.9);
    const Interactive = defineWebGLPrimitive<{}, {}>(
      function renderReleasedTarget() {},
      { hit: { kind: 'custom', resolve: staleCustomHit } },
    );
    const canvas = createCanvas(100, 100);
    let resolveDuringComposite = false;
    const observations: Array<{
      rear: unknown;
      resolved: unknown;
    }> = [];
    vi.spyOn(CanvasRenderingContext2D.prototype, 'drawImage')
      .mockImplementation(() => {
        if (!resolveDuringComposite) return;
        resolveDuringComposite = false;
        const eventRoot = getCRCInstance(canvas).eventRoot;
        observations.push({
          rear: Array.from(eventRoot.targets)[0],
          resolved: resolveCoordinateTarget(eventRoot, { x: 50, y: 50 }),
        });
      });
    const scene = (mode: 'auto' | 'none' | 'removed') => (
      <>
        <Rectangle
          onClick={rearClick}
          style={{ width: 100, height: 100, fill: '#1d4ed8' }}
        />
        <WebGLLayer style={{ width: 100, height: 100 }}>
          {mode === 'removed' ? undefined : (
            <Interactive pointerEvents={mode} />
          )}
        </WebGLLayer>
      </>
    );
    const controller = crc(canvas, scene('auto'), { pixelRatio: 1 });
    controllers.add(controller);
    await nextFrame();

    resolveDuringComposite = true;
    crc(canvas, scene('none'));
    await nextFrame();
    expect(staleCustomHit).not.toHaveBeenCalled();

    crc(canvas, scene('auto'));
    await nextFrame();
    resolveDuringComposite = true;
    crc(canvas, scene('removed'));
    await nextFrame();
    expect(staleCustomHit).not.toHaveBeenCalled();
    expect(observations).toHaveLength(2);
    for (const observation of observations) {
      expect(observation.resolved).toBe(observation.rear);
    }

    dispatchClick(canvas, 50, 50);
    expect(rearClick).toHaveBeenCalledOnce();
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

function dispatchClick(canvas: HTMLCanvasElement, x: number, y: number): void {
  const bounds = canvas.getBoundingClientRect();
  for (const type of ['mousedown', 'mouseup', 'click']) {
    canvas.dispatchEvent(new MouseEvent(type, {
      bubbles: true,
      button: 0,
      buttons: type === 'mousedown' ? 1 : 0,
      cancelable: true,
      clientX: bounds.left + x,
      clientY: bounds.top + y,
    }));
  }
}

function focusParentBridge(owner: {
  readonly eventRoot: unknown;
}): Readonly<{
  readonly instance: unknown;
  readonly transform: DOMMatrix;
}> | undefined {
  return (owner as typeof owner & {
    readonly focusParentBridge?: Readonly<{
      readonly instance: unknown;
      readonly transform: DOMMatrix;
    }>;
  }).focusParentBridge;
}
