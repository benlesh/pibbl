import {
  FocusManagement,
  KeyboardNavigation,
  createElement,
  crc,
  useSignal,
  type CRCController,
  type CRCNode,
} from '@crc/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Cube } from './components/cube.js';
import { PointLight } from './components/lights.js';
import { WebGLLayer } from './components/webgl-layer.js';
import {
  WebGLLayerController,
  resolveWebGLLayerSurface,
} from './layer-controller.js';
import type { CRCWebGLPerspectiveCamera } from './types.js';

const controllers = new Set<CRCController>();

afterEach(() => {
  for (const controller of controllers) controller.dispose();
  controllers.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe('WebGL retained structural performance', () => {
  it('reuses all six point-shadow faces for camera-only frames and invalidates them for caster movement', () => {
    const counters = installPerformancePlatform();
    const scene = (casterX: number, camera: CRCWebGLPerspectiveCamera) => (
      <WebGLLayer camera={camera} style={{ width: 40, height: 40 }}>
        <PointLight style={{ translateY: 3, translateZ: 2, range: 8 }} />
        <Cube pointerEvents="none" style={{ translateX: casterX }} />
      </WebGLLayer>
    );
    const canvas = createCanvas(40, 40);
    const controller = crc(canvas, scene(0, cameraAt(5)), { pixelRatio: 1 });
    controllers.add(controller);

    counters.frames.runNext(1);
    expect(counters.glDraws).toBe(7);
    expect(counters.shadowAttachments).toBe(6);

    crc(canvas, scene(0, cameraAt(6)));
    counters.frames.runNext(2);
    expect(counters.glDraws).toBe(8);
    expect(counters.shadowAttachments).toBe(6);

    crc(canvas, scene(1, cameraAt(6)));
    counters.frames.runNext(3);
    expect(counters.glDraws).toBe(15);
    expect(counters.shadowAttachments).toBe(12);
  });

  it('recomposites an unchanged island without child, GL, transfer, upload, or ledger work', () => {
    const counters = installPerformancePlatform();
    let childExecutions = 0;
    function Counted(props: Readonly<{
      revision: number;
      style?: Readonly<{ tone?: number }>;
      onClick?: () => void;
    }>): CRCNode {
      childExecutions += 1;
      void props.revision;
      return <Cube
        onClick={props.onClick}
        style={{ color: props.style?.tone === 2 ? '#00ff00' : '#ffffff' }}
      />;
    }
    const handleClick = () => undefined;
    const scene = (
      revision = 1,
      tone = 1,
      camera?: CRCWebGLPerspectiveCamera,
      width = 80,
      children: CRCNode = <Counted
        revision={revision}
        style={{ tone }}
        onClick={handleClick}
      />,
    ) => (
      <WebGLLayer
        camera={camera}
        style={{ width, height: 40 }}
      >
        {children}
      </WebGLLayer>
    );
    const canvas = createCanvas(80, 40);
    const controller = crc(canvas, scene(), { pixelRatio: 1 });
    controllers.add(controller);

    counters.frames.runNext(1);
    expect(snapshot(counters, childExecutions)).toEqual({
      childExecutions: 1,
      glDraws: 1,
      transfers: 1,
      uploads: 3,
      composites: 1,
      ledgerEntries: 1,
    });
    const firstLedger = counters.committedLedger();
    const firstGLWork = counters.glWork;

    crc(canvas, scene());
    counters.frames.runNext(2);
    expect(snapshot(counters, childExecutions)).toEqual({
      childExecutions: 1,
      glDraws: 1,
      transfers: 1,
      uploads: 3,
      composites: 2,
      ledgerEntries: 1,
    });
    expect(counters.committedLedger()).toBe(firstLedger);
    expect(counters.glWork).toBe(firstGLWork);

    crc(canvas, scene(2));
    counters.frames.runNext(3);
    expect(snapshot(counters, childExecutions)).toMatchObject({
      childExecutions: 2,
      glDraws: 2,
      transfers: 2,
      uploads: 3,
      composites: 3,
    });

    crc(canvas, scene(2, 2));
    counters.frames.runNext(4);
    expect(snapshot(counters, childExecutions)).toMatchObject({
      childExecutions: 3,
      glDraws: 3,
      transfers: 3,
      uploads: 3,
      composites: 4,
    });

    crc(canvas, scene(2, 2, cameraAt(6)));
    counters.frames.runNext(5);
    expect(snapshot(counters, childExecutions)).toMatchObject({
      childExecutions: 4,
      glDraws: 4,
      transfers: 4,
      uploads: 3,
      composites: 5,
    });

    crc(canvas, scene(2, 2, cameraAt(6), 70));
    counters.frames.runNext(6);
    expect(snapshot(counters, childExecutions)).toMatchObject({
      childExecutions: 5,
      glDraws: 5,
      transfers: 5,
      uploads: 3,
      composites: 6,
    });

    crc(canvas, scene(
      2,
      2,
      cameraAt(6),
      70,
      <>
        <Counted revision={2} style={{ tone: 2 }} onClick={handleClick} />
        <Counted revision={3} style={{ tone: 2 }} onClick={handleClick} />
      </>,
    ));
    counters.frames.runNext(7);
    expect(snapshot(counters, childExecutions)).toMatchObject({
      childExecutions: 7,
      glDraws: 7,
      transfers: 6,
      uploads: 3,
      composites: 7,
      ledgerEntries: 2,
    });
  });

  it('hands a child state render to the parent without traversing it twice', () => {
    const counters = installPerformancePlatform();
    let childExecutions = 0;
    let setRevision: ((value: number) => void) | undefined;
    function Draw({ revision }: { revision: number }): CRCNode {
      childExecutions += 1;
      void revision;
      return <Cube pointerEvents="none" />;
    }
    function Stateful(): CRCNode {
      const revision = useSignal(0);
      setRevision = value => revision.set(value);
      return <Draw revision={revision.get()} />;
    }
    const scene = (
      <WebGLLayer style={{ width: 30, height: 20 }}>
        <Stateful />
      </WebGLLayer>
    );
    const canvas = createCanvas(30, 20);
    const controller = crc(canvas, scene, { pixelRatio: 1 });
    controllers.add(controller);
    counters.frames.runNext(1);

    setRevision!(1);
    counters.frames.runNext(2);

    expect(snapshot(counters, childExecutions)).toMatchObject({
      childExecutions: 2,
      transfers: 2,
      composites: 2,
    });
    expect(counters.layerController()?.renderedGeneration).toBe(2);
    expect(counters.layerController()?.candidateGeneration).toBeUndefined();
    expect(counters.layerController()?.committedGeneration).toBe(2);
  });

  it('recovers a committed cache after failed child state frames without stranding replacement work', () => {
    const counters = installPerformancePlatform();
    const failure = new Error('child state frame failed');
    let childExecutions = 0;
    let replacementExecutions = 0;
    let shouldFail = false;
    let setRevision: ((value: number) => void) | undefined;
    function Draw({ revision }: { revision: number }): CRCNode {
      childExecutions += 1;
      void revision;
      if (shouldFail) throw failure;
      return <Cube pointerEvents="none" />;
    }
    function Stateful(): CRCNode {
      const revision = useSignal(0);
      setRevision = value => revision.set(value);
      return <Draw revision={revision.get()} />;
    }
    function Replacement(): CRCNode {
      replacementExecutions += 1;
      return <Cube pointerEvents="none" />;
    }
    const scene = (
      <WebGLLayer style={{ width: 30, height: 20 }}>
        <Stateful />
      </WebGLLayer>
    );
    const replacementScene = (
      <WebGLLayer style={{ width: 30, height: 20 }}>
        <Replacement />
      </WebGLLayer>
    );
    const canvas = createCanvas(30, 20);
    const controller = crc(canvas, scene, { pixelRatio: 1 });
    controllers.add(controller);
    counters.frames.runNext(1);

    shouldFail = true;
    setRevision!(1);
    expect(() => counters.frames.runNext(2)).toThrow(failure);
    expect(snapshot(counters, childExecutions)).toMatchObject({
      childExecutions: 2,
      transfers: 1,
      composites: 1,
    });

    shouldFail = false;
    crc(canvas, scene);
    counters.frames.runNext(3);
    expect(snapshot(counters, childExecutions)).toMatchObject({
      childExecutions: 3,
      transfers: 2,
      composites: 2,
    });
    expect(counters.layerController()?.committedGeneration).toBe(2);

    shouldFail = true;
    setRevision!(1);
    crc(canvas, replacementScene);
    expect(() => counters.frames.runNext(4)).toThrow(failure);
    expect(snapshot(counters, childExecutions)).toMatchObject({
      childExecutions: 4,
      transfers: 2,
      composites: 2,
    });
    expect(replacementExecutions).toBe(0);

    shouldFail = false;
    counters.frames.runNext(5);
    expect(snapshot(counters, childExecutions)).toMatchObject({
      childExecutions: 5,
      transfers: 3,
      composites: 3,
    });
    expect(replacementExecutions).toBe(1);
    expect(counters.layerController()?.committedGeneration).toBe(4);
  });

  it('does not consume a retained opaque child iterable during cache comparison', () => {
    const counters = installPerformancePlatform();
    let iterations = 0;
    let childExecutions = 0;
    function Draw(): CRCNode {
      childExecutions += 1;
      return <Cube pointerEvents="none" />;
    }
    const children: Iterable<CRCNode> = {
      *[Symbol.iterator]() {
        iterations += 1;
        yield <Draw />;
      },
    };
    const scene = () => (
      <WebGLLayer style={{ width: 30, height: 20 }}>
        {children}
      </WebGLLayer>
    );
    const canvas = createCanvas(30, 20);
    const controller = crc(canvas, scene(), { pixelRatio: 1 });
    controllers.add(controller);
    counters.frames.runNext(1);

    crc(canvas, scene());
    counters.frames.runNext(2);

    expect(iterations).toBe(1);
    expect(childExecutions).toBe(1);
    expect(counters.transfers).toBe(1);
  });

  it('invalidates once for focus revision and then reuses the new generation', () => {
    const counters = installPerformancePlatform();
    let childExecutions = 0;
    function Draw(): CRCNode {
      childExecutions += 1;
      return <Cube keyboardFocusable onClick={() => undefined} />;
    }
    const scene = (
      <FocusManagement>
        <WebGLLayer style={{ width: 30, height: 20 }}>
          <Draw />
        </WebGLLayer>
      </FocusManagement>
    );
    const canvas = createCanvas(30, 20);
    const controller = crc(canvas, scene, { pixelRatio: 1 });
    controllers.add(controller);
    counters.frames.runNext(1);

    const target = counters.committedLedger()!.entries[0] as {
      target: {
        owner: {
          eventRoot: {
            focusPolicy?: {
              setFocusState(target: unknown, visible: boolean): void;
            };
          };
        };
      };
    };
    target.target.owner.eventRoot.focusPolicy!.setFocusState(
      target.target,
      true,
    );
    crc(canvas, scene);
    counters.frames.runNext(2);
    crc(canvas, scene);
    counters.frames.runNext(3);

    expect(snapshot(counters, childExecutions)).toMatchObject({
      childExecutions: 2,
      transfers: 2,
      composites: 3,
      ledgerEntries: 1,
    });
  });

  it('includes transparent child enhancers in retained identity', () => {
    const counters = installPerformancePlatform();
    let childExecutions = 0;
    function Draw(): CRCNode {
      childExecutions += 1;
      return <Cube pointerEvents="none" />;
    }
    const child = <Draw />;
    const scene = (directional: boolean) => (
      <FocusManagement>
        <WebGLLayer style={{ width: 30, height: 20 }}>
          {directional ? (
            <KeyboardNavigation mode="directional">
              {child}
            </KeyboardNavigation>
          ) : child}
        </WebGLLayer>
      </FocusManagement>
    );
    const canvas = createCanvas(30, 20);
    const controller = crc(canvas, scene(false), { pixelRatio: 1 });
    controllers.add(controller);
    counters.frames.runNext(1);

    crc(canvas, scene(true));
    counters.frames.runNext(2);
    crc(canvas, scene(true));
    counters.frames.runNext(3);

    expect(childExecutions).toBe(2);
    expect(counters.transfers).toBe(2);
    expect(counters.composites).toBe(3);
  });

  it('invalidates independent X/Y density and context-owned resource generations once', () => {
    const counters = installPerformancePlatform();
    let childExecutions = 0;
    function Draw(): CRCNode {
      childExecutions += 1;
      return <Cube pointerEvents="none" />;
    }
    const root = createElement(Draw, {});
    const parentCanvas = createCanvas(40, 20);
    const parent = crc(parentCanvas, undefined, { pixelRatio: 1 });
    controllers.add(parent);
    const initial = resolveWebGLLayerSurface(40, 20, { x: 1, y: 1 });
    const densityX = resolveWebGLLayerSurface(40, 20, { x: 2, y: 1 });
    const densityY = resolveWebGLLayerSurface(40, 20, { x: 2, y: 3 });
    const layer = new WebGLLayerController(
      parentCanvas,
      root,
      undefined,
      initial,
    );
    const context = parentCanvas.getContext('2d')!;
    const render = (surface: typeof initial, timestamp: number) => {
      layer.renderRetainedChild(root, undefined, surface, timestamp);
      layer.composite(context, { x: 0, y: 0, width: 40, height: 20 });
    };

    render(initial, 1);
    render(initial, 2);
    render(densityX, 3);
    render(densityX, 4);
    render(densityY, 5);
    render(densityY, 6);
    expect(childExecutions).toBe(3);
    expect(counters.transfers).toBe(3);

    const state = layer as unknown as {
      contextGenerationValue: number;
      committed?: { contextGeneration: number };
    };
    expect(state.committed).toMatchObject({
      contextGeneration: 1,
    });
    state.contextGenerationValue = 2;
    render(densityY, 7);
    render(densityY, 8);

    expect(childExecutions).toBe(4);
    expect(counters.transfers).toBe(4);
    expect(state.committed).toMatchObject({
      contextGeneration: 2,
    });
    layer.dispose();
  });

  it('rejects a child candidate from a superseded context generation', () => {
    const counters = installPerformancePlatform();
    let childExecutions = 0;
    let supersedeDuringRender = false;
    let layer: WebGLLayerController;
    function Draw(): CRCNode {
      childExecutions += 1;
      if (supersedeDuringRender) {
        (layer as unknown as { contextGenerationValue: number })
          .contextGenerationValue = 2;
      }
      return <Cube pointerEvents="none" />;
    }
    const root = createElement(Draw, {});
    const parentCanvas = createCanvas(30, 20);
    const parent = crc(parentCanvas, undefined, { pixelRatio: 1 });
    controllers.add(parent);
    const surface = resolveWebGLLayerSurface(30, 20, { x: 1, y: 1 });
    layer = new WebGLLayerController(
      parentCanvas,
      root,
      undefined,
      surface,
    );
    const context = parentCanvas.getContext('2d')!;
    layer.renderRetainedChild(root, undefined, surface, 1);
    layer.composite(context, { x: 0, y: 0, width: 30, height: 20 });

    supersedeDuringRender = true;
    (layer as unknown as { mount: { requestFrame(parents: boolean): void } })
      .mount.requestFrame(true);
    counters.frames.runNewest(2);
    supersedeDuringRender = false;
    layer.renderRetainedChild(root, undefined, surface, 2);
    layer.composite(context, { x: 0, y: 0, width: 30, height: 20 });

    expect(childExecutions).toBe(3);
    expect(counters.transfers).toBe(2);
    expect((layer as unknown as {
      committed?: {
        contextGeneration: number;
      };
    }).committed).toMatchObject({
      contextGeneration: 2,
    });
    layer.dispose();
  });
});

function snapshot(
  counters: ReturnType<typeof installPerformancePlatform>,
  childExecutions: number,
) {
  return {
    childExecutions,
    glDraws: counters.glDraws,
    transfers: counters.transfers,
    uploads: counters.uploads,
    composites: counters.composites,
    ledgerEntries: counters.committedLedger()?.entries.length ?? 0,
  };
}

function installPerformancePlatform() {
  let glDraws = 0;
  let transfers = 0;
  let uploads = 0;
  let composites = 0;
  let glWork = 0;
  let shadowAttachments = 0;
  let layerController: {
    committed?: { pickLedger: { entries: readonly unknown[] } };
  } | undefined;
  const gl = createNoopGL({
    drawArrays: () => { glDraws += 1; },
    drawElements: () => { glDraws += 1; },
    bufferData: () => { uploads += 1; },
    framebufferTextureLayer: () => { shadowAttachments += 1; },
  }, () => { glWork += 1; });
  class PerformanceOffscreenCanvas {
    constructor(
      public width: number,
      public height: number,
    ) {}

    getContext(type: string): WebGL2RenderingContext | null {
      return type === 'webgl2' ? gl : null;
    }

    transferToImageBitmap(): ImageBitmap {
      transfers += 1;
      return {
        width: this.width,
        height: this.height,
        close() {},
      } as ImageBitmap;
    }
  }
  vi.stubGlobal('OffscreenCanvas', PerformanceOffscreenCanvas);
  vi.spyOn(CanvasRenderingContext2D.prototype, 'drawImage')
    .mockImplementation(() => { composites += 1; });
  const composite = WebGLLayerController.prototype.composite;
  vi.spyOn(WebGLLayerController.prototype, 'composite')
    .mockImplementation(function captureController(
      this: WebGLLayerController,
      context,
      destination,
    ) {
      layerController = this as unknown as typeof layerController;
      composite.call(this, context, destination);
    });
  const frames = installControlledFrames();
  return {
    frames,
    get glDraws() { return glDraws; },
    get transfers() { return transfers; },
    get uploads() { return uploads; },
    get composites() { return composites; },
    get glWork() { return glWork; },
    get shadowAttachments() { return shadowAttachments; },
    committedLedger() {
      return layerController?.committed?.pickLedger;
    },
    layerController() {
      return layerController as WebGLLayerController | undefined;
    },
  };
}

function installControlledFrames() {
  let nextId = 0;
  const callbacks = new Map<number, FrameRequestCallback>();
  const pending = new Set<number>();
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
    const id = ++nextId;
    callbacks.set(id, callback);
    pending.add(id);
    return id;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => {
    pending.delete(id);
  });
  return {
    runNext(timestamp: number): void {
      const id = pending.values().next().value;
      if (id === undefined) throw new Error('No animation frame is pending.');
      pending.delete(id);
      callbacks.get(id)!(timestamp);
    },
    runNewest(timestamp: number): void {
      const id = [...pending].at(-1);
      if (id === undefined) throw new Error('No animation frame is pending.');
      pending.delete(id);
      callbacks.get(id)!(timestamp);
    },
  };
}

function cameraAt(z: number): CRCWebGLPerspectiveCamera {
  return {
    type: 'perspective',
    position: [0, 0, z],
    lookAt: [0, 0, 0],
    up: [0, 1, 0],
    fieldOfViewDegrees: 50,
    near: 0.1,
    far: 1000,
  };
}

function createNoopGL(
  overrides: Readonly<Record<string, (...args: any[]) => unknown>>,
  onCall: (method: string) => void,
): WebGL2RenderingContext {
  let constant = 1;
  let handle = 0;
  return new Proxy({}, {
    get(target, property) {
      if (typeof property !== 'string') return undefined;
      if (property in overrides) {
        return (...args: unknown[]) => {
          onCall(property);
          return overrides[property]!(...args);
        };
      }
      const record = target as Record<string, unknown>;
      if (!(property in record)) {
        record[property] = /^[A-Z0-9_]+$/.test(property) ? constant++ :
          property === 'getParameter' ? () => {
            onCall(property);
            return 8;
          } : property === 'getContextAttributes' ? () => ({
              alpha: true,
              depth: true,
              premultipliedAlpha: true,
              preserveDrawingBuffer: false,
            }) : property === 'getShaderParameter' ||
              property === 'getProgramParameter' ? () => {
                onCall(property);
                return true;
              } : property === 'getShaderInfoLog' ||
                property === 'getProgramInfoLog' ? () => {
                  onCall(property);
                  return '';
                } : property === 'getUniformLocation' ?
                  (_program: object, name: string) => {
                    onCall(property);
                    return { name };
                  } : property === 'createBuffer' ||
                    property === 'createShader' ||
                    property === 'createProgram' ||
                    property === 'createVertexArray' ||
                    property === 'createFramebuffer' ||
                    property === 'createTexture' ? () => {
                      onCall(property);
                      return { kind: property, id: ++handle };
                    } : property === 'checkFramebufferStatus' ? () => {
                      onCall(property);
                      if (!('FRAMEBUFFER_COMPLETE' in record)) {
                        record.FRAMEBUFFER_COMPLETE = constant++;
                      }
                      return record.FRAMEBUFFER_COMPLETE;
                    } : property === 'isContextLost' ? () => {
                      onCall(property);
                      return false;
                    } : (..._args: unknown[]) => {
                      onCall(property);
                    };
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
