import {
  crc,
  crcState,
  type CRCController,
  type CRCNode,
} from '@crc/core';
import type {
  CRCHitTestOutput,
  CRCEventTargetRegistration,
} from '@crc/core/internal';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Cube } from './components/cube.js';
import { createWebGLGeometry } from './geometry/geometry.js';
import { createBuiltInProgram } from './gpu/program.js';
import { WebGLRendererResourceCache } from './gpu/renderer-resources.js';
import { installWebGLStateBaseline } from './gpu/state.js';
import { crcAnimationFrame } from './hooks/crc-animation-frame.js';
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

describe('WebGLLayer context lifecycle', () => {
  it('invalidates lost renderer handles without deletes, restores a new generation, and disposes live handles once', () => {
    const firstBitmap = bitmap('first');
    const restoredBitmap = bitmap('restored');
    const platform = installContextPlatform([firstBitmap, restoredBitmap]);
    const callbacks: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
      callbacks.push(callback);
      return callbacks.length;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
    const parentCanvas = mountParent();
    callbacks.shift()!(0);
    let executions = 0;
    function Target(): CRCNode {
      executions += 1;
      return <Cube
        keyboardFocusable
        keyboardNavigationBounds={{ x: 1, y: 2, width: 3, height: 4 }}
        onClick={() => undefined}
      />;
    }
    const root = <Target />;
    const surface = resolveWebGLLayerSurface(20, 10, { x: 1, y: 1 });
    const controller = new WebGLLayerController(
      parentCanvas,
      root,
      undefined,
      surface,
    );
    const parentContext = {
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D;

    controller.renderUpdatedChild(root, undefined, surface, 1);
    expect(glCount(platform, 'createProgram')).toBe(1);
    expect(glCount(platform, 'createVertexArray')).toBe(1);
    expect(glCount(platform, 'createBuffer')).toBe(3);
    controller.composite(parentContext, {
      x: 0,
      y: 0,
      width: 20,
      height: 10,
    });
    const firstTarget = committedTarget(controller);
    expect(firstTarget.keyboardNavigationBounds).toEqual({
      x: 1,
      y: 2,
      width: 3,
      height: 4,
    });
    expect(resolve(controller)).toMatchObject({
      disposition: 2,
      target: firstTarget,
    });

    platform.contextLost = true;
    const loss = new Event('webglcontextlost', { cancelable: true });
    platform.canvas.dispatchEvent(loss);

    expect(loss.defaultPrevented).toBe(true);
    expect(controller.contextGeneration).toBe(2);
    expect(controller.committedGeneration).toBeUndefined();
    expect(controller.candidateGeneration).toBeUndefined();
    expect(firstBitmap.close).toHaveBeenCalledOnce();
    expect(resolve(controller)).toEqual({ disposition: 0, target: null });
    expect(firstTarget.keyboardNavigationBounds).toBeUndefined();
    expect(firstTarget.keyboardNavigationPoints).toBeUndefined();
    expect(glCount(platform, 'deleteProgram')).toBe(0);
    expect(glCount(platform, 'deleteBuffer')).toBe(0);
    expect(glCount(platform, 'deleteVertexArray')).toBe(0);
    expect(callbacks).toEqual([]);

    platform.contextLost = false;
    platform.canvas.dispatchEvent(new Event('webglcontextrestored'));
    platform.canvas.dispatchEvent(new Event('webglcontextrestored'));
    expect(callbacks).toHaveLength(1);
    callbacks[0]!(2);

    expect(executions).toBe(2);
    expect(glCount(platform, 'createProgram')).toBe(2);
    expect(glCount(platform, 'createVertexArray')).toBe(2);
    expect(glCount(platform, 'createBuffer')).toBe(6);
    expect(controller.committedGeneration).toBeUndefined();
    controller.renderRetainedChild(root, undefined, surface, 2);
    expect(controller.candidateGeneration).toBe(2);
    expect(resolve(controller)).toEqual({ disposition: 0, target: null });

    controller.composite(parentContext, {
      x: 0,
      y: 0,
      width: 20,
      height: 10,
    });
    expect(controller.committedGeneration).toBe(2);
    expect(resolve(controller)).toMatchObject({
      disposition: 2,
      target: firstTarget,
    });

    controller.dispose();
    controller.dispose();
    expect(platform.listenerRemoves).toEqual([
      'webglcontextlost',
      'webglcontextrestored',
    ]);
    expect(restoredBitmap.close).toHaveBeenCalledOnce();
    expect(glCount(platform, 'deleteProgram')).toBe(1);
    expect(glCount(platform, 'deleteBuffer')).toBe(3);
    expect(glCount(platform, 'deleteVertexArray')).toBe(1);
  });

  it('creates no renderer resources when context loss occurs during composition', async () => {
    const unused = bitmap('unused');
    const platform = installContextPlatform([unused]);
    const parentCanvas = mountParent();
    let loss: Event | undefined;
    function LosingTarget(): CRCNode {
      platform.contextLost = true;
      loss = new Event('webglcontextlost', { cancelable: true });
      platform.canvas.dispatchEvent(loss);
      return <Cube onClick={() => undefined} />;
    }
    const root = <LosingTarget />;
    const controller = new WebGLLayerController(
      parentCanvas,
      root,
      undefined,
      resolveWebGLLayerSurface(20, 10, { x: 1, y: 1 }),
    );

    expect(() => controller.renderUpdatedChild(
      root,
      undefined,
      controller.surface,
      1,
    )).toThrowError(/WebGLLayer.*render operation lost ownership/i);

    const { getCRCInstance } = await import(
      '../../../core/src/lib/global-state.js'
    );
    expect(loss?.defaultPrevented).toBe(true);
    expect(platform.transferCount).toBe(0);
    expect(glCount(platform, 'createProgram')).toBe(0);
    expect(glCount(platform, 'createBuffer')).toBe(0);
    expect(glCount(platform, 'createVertexArray')).toBe(0);
    expect(getCRCInstance(parentCanvas).eventRoot.targets.size).toBe(0);
    expectNoGeneration(controller);
    controller.dispose();
  });

  it('invalidates without deletes when context loss occurs during WebGL rendering', async () => {
    const unused = bitmap('unused-render');
    let platform: ReturnType<typeof installContextPlatform>;
    platform = installContextPlatform([unused], {
      onGLCall(method, canvas) {
        if (method !== 'drawElements' || platform.contextLost) return;
        platform.contextLost = true;
        canvas.dispatchEvent(
          new Event('webglcontextlost', { cancelable: true }),
        );
      },
    });
    const parentCanvas = mountParent();
    const root = <Cube onClick={() => undefined} />;
    const controller = new WebGLLayerController(
      parentCanvas,
      root,
      undefined,
      resolveWebGLLayerSurface(20, 10, { x: 1, y: 1 }),
    );

    expect(() => controller.renderUpdatedChild(
      root,
      undefined,
      controller.surface,
      1,
    )).toThrowError(/WebGLLayer.*render operation lost ownership/i);

    const { getCRCInstance } = await import(
      '../../../core/src/lib/global-state.js'
    );
    expect(glCount(platform, 'createProgram')).toBe(1);
    expect(glCount(platform, 'drawElements')).toBe(1);
    expect(glCount(platform, 'deleteProgram')).toBe(0);
    expect(glCount(platform, 'deleteBuffer')).toBe(0);
    expect(glCount(platform, 'deleteVertexArray')).toBe(0);
    expect(platform.transferCount).toBe(0);
    expect(getCRCInstance(parentCanvas).eventRoot.targets.size).toBe(0);
    expectNoGeneration(controller);
    controller.dispose();
  });

  it('closes a bitmap transferred across context loss without publishing its picker', async () => {
    const stale = bitmap('stale-transfer');
    let platform: ReturnType<typeof installContextPlatform>;
    platform = installContextPlatform([stale], {
      onTransfer(canvas) {
        platform.contextLost = true;
        canvas.dispatchEvent(
          new Event('webglcontextlost', { cancelable: true }),
        );
      },
    });
    const parentCanvas = mountParent();
    const root = <Cube onClick={() => undefined} />;
    const controller = new WebGLLayerController(
      parentCanvas,
      root,
      undefined,
      resolveWebGLLayerSurface(20, 10, { x: 1, y: 1 }),
    );

    expect(() => controller.renderUpdatedChild(
      root,
      undefined,
      controller.surface,
      1,
    )).toThrowError(/WebGLLayer.*render operation lost ownership/i);

    const { getCRCInstance } = await import(
      '../../../core/src/lib/global-state.js'
    );
    expect(stale.close).toHaveBeenCalledOnce();
    expectNoGeneration(controller);
    expect(getCRCInstance(parentCanvas).eventRoot.targets.size).toBe(0);
    controller.dispose();
  });

  it('cannot commit bitmap, picker, or focus metadata after loss during parent draw', async () => {
    const candidate = bitmap('stale-composite');
    const platform = installContextPlatform([candidate]);
    const parentCanvas = mountParent();
    const root = <Cube
      keyboardNavigationBounds={{ x: 1, y: 2, width: 3, height: 4 }}
      onClick={() => undefined}
    />;
    const controller = new WebGLLayerController(
      parentCanvas,
      root,
      undefined,
      resolveWebGLLayerSurface(20, 10, { x: 1, y: 1 }),
    );
    controller.renderUpdatedChild(root, undefined, controller.surface, 1);
    const target = pendingTarget(controller);

    expect(() => controller.composite({
      drawImage() {
        platform.contextLost = true;
        platform.canvas.dispatchEvent(
          new Event('webglcontextlost', { cancelable: true }),
        );
      },
    } as unknown as CanvasRenderingContext2D, {
      x: 0,
      y: 0,
      width: 20,
      height: 10,
    })).toThrowError(/WebGLLayer.*composite operation lost ownership/i);

    const { getCRCInstance } = await import(
      '../../../core/src/lib/global-state.js'
    );
    expect(candidate.close).toHaveBeenCalledOnce();
    expect(target.keyboardNavigationBounds).toBeUndefined();
    expect(target.keyboardNavigationPoints).toBeUndefined();
    expect(getCRCInstance(parentCanvas).eventRoot.targets.size).toBe(0);
    expectNoGeneration(controller);
    controller.dispose();
  });

  it('cancels child animation work when the context is lost', () => {
    const first = bitmap('animated');
    const platform = installContextPlatform([first]);
    const callbacks: FrameRequestCallback[] = [];
    const request = vi.spyOn(window, 'requestAnimationFrame')
      .mockImplementation(callback => {
        callbacks.push(callback);
        return callbacks.length;
      });
    const cancel = vi.spyOn(window, 'cancelAnimationFrame')
      .mockImplementation(() => undefined);
    const parentCanvas = mountParent();
    callbacks.shift()?.(0);
    request.mockClear();
    let executions = 0;
    function Animated(): CRCNode {
      executions += 1;
      crcAnimationFrame();
      return <Cube pointerEvents="none" />;
    }
    const root = <Animated />;
    const controller = new WebGLLayerController(
      parentCanvas,
      root,
      undefined,
      resolveWebGLLayerSurface(20, 10, { x: 1, y: 1 }),
    );
    controller.renderUpdatedChild(root, undefined, controller.surface, 1);
    controller.composite(
      { drawImage() {} } as unknown as CanvasRenderingContext2D,
      { x: 0, y: 0, width: 20, height: 10 },
    );
    expect(request).toHaveBeenCalledOnce();

    platform.contextLost = true;
    platform.canvas.dispatchEvent(
      new Event('webglcontextlost', { cancelable: true }),
    );

    expect(cancel).toHaveBeenCalledOnce();
    callbacks[0]!(2);
    expect(executions).toBe(1);
    expect(platform.transferCount).toBe(1);
    controller.dispose();
  });

  it('does not compose or touch GL for private state updates while unavailable', () => {
    const initial = bitmap('state-initial');
    const restored = bitmap('state-restored');
    const platform = installContextPlatform([initial, restored]);
    const callbacks: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
      callbacks.push(callback);
      return callbacks.length;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
    const parentCanvas = mountParent();
    callbacks.shift()?.(0);
    let setValue: ((value: number | ((old: number) => number)) => void) |
      undefined;
    let executions = 0;
    function Stateful(): CRCNode {
      executions += 1;
      const [value, setter] = crcState(0);
      setValue = setter;
      return <Cube pointerEvents="none" style={{ translateX: value }} />;
    }
    const root = <Stateful />;
    const surface = resolveWebGLLayerSurface(20, 10, { x: 1, y: 1 });
    const controller = new WebGLLayerController(
      parentCanvas,
      root,
      undefined,
      surface,
    );
    controller.renderUpdatedChild(root, undefined, surface, 1);
    controller.composite(
      { drawImage() {} } as unknown as CanvasRenderingContext2D,
      { x: 0, y: 0, width: 20, height: 10 },
    );
    const callsBeforeLoss = platform.glCalls.length;

    platform.contextLost = true;
    platform.canvas.dispatchEvent(
      new Event('webglcontextlost', { cancelable: true }),
    );
    setValue?.(old => old + 1);
    expect(callbacks).toHaveLength(1);
    callbacks[0]!(2);

    expect(executions).toBe(1);
    expect(platform.glCalls).toHaveLength(callsBeforeLoss);
    expect(controller.renderedGeneration).toBe(1);
    expectNoGeneration(controller);

    platform.contextLost = false;
    platform.canvas.dispatchEvent(new Event('webglcontextrestored'));
    expect(callbacks).toHaveLength(2);
    callbacks[1]!(3);
    expect(executions).toBe(2);
    expect(glCount(platform, 'createProgram')).toBe(2);
    controller.renderRetainedChild(root, undefined, surface, 3);
    controller.composite(
      { drawImage() {} } as unknown as CanvasRenderingContext2D,
      { x: 0, y: 0, width: 20, height: 10 },
    );
    expect(controller.committedGeneration).toBe(2);
    controller.dispose();
  });
});

describe('WebGL failure cleanup', () => {
  it('preserves a shader compile failure while later intermediates still release', () => {
    const cleanupError = new Error('shader delete failed');
    const reported: unknown[] = [];
    vi.spyOn(globalThis, 'reportError').mockImplementation(error => {
      reported.push(error);
    });
    const recording = createOwnershipGL({
      failedShader: 'fragment',
      throwDeletingShader: { stage: 'fragment', error: cleanupError },
    });

    expect(() =>
      createBuiltInProgram(recording.gl, 'unlit', 'Mesh'),
    ).toThrowError(/Mesh.*fragment.*compil/i);
    expect(recording.deletedShaders).toEqual(['fragment', 'vertex']);
    expect(reported).toEqual([cleanupError]);
  });

  it('attempts every partial renderer upload release when one delete throws', () => {
    const cleanupError = new Error('buffer delete failed');
    const reported: unknown[] = [];
    vi.spyOn(globalThis, 'reportError').mockImplementation(error => {
      reported.push(error);
    });
    const recording = createOwnershipGL({
      failBuffer: 3,
      throwDeleteBuffer: cleanupError,
    });
    const cache = new WebGLRendererResourceCache(recording.gl, 1);
    const geometry = createWebGLGeometry({
      positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
      normals: [0, 0, 1, 0, 0, 1, 0, 0, 1],
      indices: [0, 1, 2],
    });
    const transaction = cache.beginRender();

    expect(() => transaction.useGeometry(geometry, 'Cube')).toThrowError(
      /Cube.*index buffer/i,
    );
    expect(recording.deleteBuffer).toHaveBeenCalledTimes(2);
    expect(recording.deleteVertexArray).toHaveBeenCalledOnce();
    expect(reported).toEqual([cleanupError, cleanupError]);
    transaction.rollback();
    cache.dispose(false);
  });

  it('disposes two keyed programs and one shared normal geometry after one release throws', () => {
    const cleanupError = new Error('program delete failed');
    const reported: unknown[] = [];
    vi.spyOn(globalThis, 'reportError').mockImplementation(error => {
      reported.push(error);
    });
    const recording = createOwnershipGL({
      throwDeleteProgram: cleanupError,
    });
    const cache = new WebGLRendererResourceCache(recording.gl, 1);
    const geometry = createWebGLGeometry({
      positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
      normals: [0, 0, 1, 0, 0, 1, 0, 0, 1],
      indices: [0, 1, 2],
    });
    const transaction = cache.beginRender();
    transaction.useProgram('unlit', 'Mesh');
    transaction.useProgram('lambert', 'Mesh');
    transaction.useGeometry(geometry, 'Mesh');
    transaction.useGeometry(geometry, 'Cube');
    transaction.commit();

    expect(() => cache.dispose(false)).not.toThrow();
    expect(recording.deleteProgram).toHaveBeenCalledTimes(2);
    expect(recording.deleteBuffer).toHaveBeenCalledTimes(3);
    expect(recording.deleteVertexArray).toHaveBeenCalledOnce();
    expect(reported).toEqual([cleanupError, cleanupError]);
  });

  it('attempts later baseline categories after an early restoration failure', () => {
    const restorationError = new Error('framebuffer restoration failed');
    const recording = createOwnershipGL({
      throwBindFramebuffer: restorationError,
    });

    expect(() => installWebGLStateBaseline(
      recording.gl,
      20,
      10,
      { textureUnitCount: 1 },
    )).toThrow(restorationError);
    expect(recording.viewport).toHaveBeenCalledWith(0, 0, 20, 10);
    expect(recording.useProgram).toHaveBeenCalledWith(null);
    expect(recording.activeTexture).toHaveBeenCalled();
    expect(recording.pixelStorei).toHaveBeenCalled();
  });
});

function resolve(controller: WebGLLayerController): CRCHitTestOutput {
  const output: CRCHitTestOutput = { disposition: 1, target: null };
  controller.resolveLocal(10, 5, output);
  return output;
}

function pendingTarget(
  controller: WebGLLayerController,
): CRCEventTargetRegistration {
  return generationTarget(controller, 'pending');
}

function committedTarget(
  controller: WebGLLayerController,
): CRCEventTargetRegistration {
  return generationTarget(controller, 'committed');
}

function generationTarget(
  controller: WebGLLayerController,
  generation: 'committed' | 'pending',
): CRCEventTargetRegistration {
  const state = controller as unknown as Record<
    'committed' | 'pending',
    {
      readonly pickLedger: {
        readonly entries: ReadonlyArray<{
          readonly target: CRCEventTargetRegistration;
        }>;
      };
    } | undefined
  >;
  return state[generation]!.pickLedger.entries[0]!.target;
}

function expectNoGeneration(controller: WebGLLayerController): void {
  expect(controller.committedGeneration).toBeUndefined();
  expect(controller.candidateGeneration).toBeUndefined();
}

interface FakeBitmap extends ImageBitmap {
  readonly label: string;
  readonly close: ReturnType<typeof vi.fn<() => void>>;
}

function bitmap(label: string): FakeBitmap {
  return {
    label,
    width: 1,
    height: 1,
    close: vi.fn(),
  } as unknown as FakeBitmap;
}

function installContextPlatform(
  transfers: FakeBitmap[],
  options: Readonly<{
    onTransfer?: (canvas: EventTarget) => void;
    onGLCall?: (method: string, canvas: EventTarget) => void;
  }> = {},
) {
  const listenerAdds: string[] = [];
  const listenerRemoves: string[] = [];
  const glCalls: string[] = [];
  let contextLost = false;
  let transferCount = 0;
  let createdCanvas: ContextLifecycleOffscreenCanvas | undefined;
  const gl = createLifecycleGL(
    () => contextLost,
    method => {
      glCalls.push(method);
      if (createdCanvas) options.onGLCall?.(method, createdCanvas);
    },
  );
  class ContextLifecycleOffscreenCanvas extends EventTarget {
    width: number;
    height: number;

    constructor(width: number, height: number) {
      super();
      this.width = width;
      this.height = height;
      createdCanvas = this;
    }

    override addEventListener(
      type: string,
      callback: EventListenerOrEventListenerObject | null,
      eventOptions?: boolean | AddEventListenerOptions,
    ): void {
      listenerAdds.push(type);
      super.addEventListener(type, callback, eventOptions);
    }

    override removeEventListener(
      type: string,
      callback: EventListenerOrEventListenerObject | null,
      eventOptions?: boolean | EventListenerOptions,
    ): void {
      listenerRemoves.push(type);
      super.removeEventListener(type, callback, eventOptions);
    }

    getContext(type: string): WebGL2RenderingContext | null {
      return type === 'webgl2' ? gl : null;
    }

    transferToImageBitmap(): ImageBitmap {
      transferCount += 1;
      options.onTransfer?.(this);
      const next = transfers.shift();
      if (!next) throw new Error('No test bitmap remains.');
      return next;
    }
  }
  vi.stubGlobal('OffscreenCanvas', ContextLifecycleOffscreenCanvas);
  const result = {
    listenerAdds,
    listenerRemoves,
    glCalls,
    get transferCount(): number {
      return transferCount;
    },
    get canvas(): ContextLifecycleOffscreenCanvas {
      return createdCanvas!;
    },
    get contextLost(): boolean {
      return contextLost;
    },
    set contextLost(value: boolean) {
      contextLost = value;
    },
  };
  return result;
}

function glCount(
  platform: ReturnType<typeof installContextPlatform>,
  method: string,
): number {
  return platform.glCalls.filter(entry => entry === method).length;
}

function createLifecycleGL(
  isContextLost: () => boolean,
  onCall: (method: string) => void,
): WebGL2RenderingContext {
  let constant = 1;
  let handle = 0;
  return new Proxy({}, {
    get(target, property) {
      if (typeof property !== 'string') return undefined;
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
            }) : property === 'isContextLost' ? () => {
              onCall(property);
              return isContextLost();
            } : property === 'getShaderParameter' ||
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
                  } : property === 'createShader' ||
                    property === 'createProgram' ||
                    property === 'createVertexArray' ||
                    property === 'createBuffer' ? () => {
                      onCall(property);
                      return { kind: property, id: ++handle };
                    } : (..._args: unknown[]) => {
                      onCall(property);
                    };
      }
      return record[property];
    },
  }) as WebGL2RenderingContext;
}

interface OwnershipGLOptions {
  readonly failedShader?: 'vertex' | 'fragment';
  readonly throwDeletingShader?: Readonly<{
    stage: 'vertex' | 'fragment';
    error: Error;
  }>;
  readonly failBuffer?: number;
  readonly throwDeleteBuffer?: Error;
  readonly throwDeleteProgram?: Error;
  readonly throwBindFramebuffer?: Error;
}

function createOwnershipGL(options: OwnershipGLOptions = {}) {
  const constants = Object.fromEntries([
    'ALWAYS', 'ARRAY_BUFFER', 'BACK', 'BLEND', 'BROWSER_DEFAULT_WEBGL',
    'CCW', 'COMPILE_STATUS', 'CULL_FACE', 'DEPTH_TEST',
    'ELEMENT_ARRAY_BUFFER', 'FLOAT', 'FRAGMENT_SHADER', 'FRAMEBUFFER',
    'FRONT', 'FUNC_ADD', 'KEEP', 'LESS', 'LINK_STATUS', 'ONE',
    'PACK_ALIGNMENT', 'PACK_ROW_LENGTH', 'PACK_SKIP_PIXELS',
    'PACK_SKIP_ROWS', 'POLYGON_OFFSET_FILL', 'SCISSOR_TEST', 'STATIC_DRAW',
    'STENCIL_TEST', 'TEXTURE0', 'TEXTURE_2D', 'TEXTURE_2D_ARRAY',
    'TEXTURE_3D', 'TEXTURE_CUBE_MAP', 'UNPACK_ALIGNMENT',
    'UNPACK_COLORSPACE_CONVERSION_WEBGL', 'UNPACK_FLIP_Y_WEBGL',
    'UNPACK_IMAGE_HEIGHT', 'UNPACK_PREMULTIPLY_ALPHA_WEBGL',
    'UNPACK_ROW_LENGTH', 'UNPACK_SKIP_IMAGES', 'UNPACK_SKIP_PIXELS',
    'UNPACK_SKIP_ROWS', 'VERTEX_SHADER', 'ZERO',
  ].map((name, index) => [name, index + 1]));
  let handleId = 0;
  let bufferCount = 0;
  const shaderStage = new Map<object, 'vertex' | 'fragment'>();
  const deletedShaders: string[] = [];
  const createShader = vi.fn((type: number) => {
    const shader = { id: ++handleId };
    shaderStage.set(
      shader,
      type === constants.VERTEX_SHADER ? 'vertex' : 'fragment',
    );
    return shader;
  });
  const deleteShader = vi.fn((shader: object) => {
    const stage = shaderStage.get(shader)!;
    deletedShaders.push(stage);
    if (stage === options.throwDeletingShader?.stage) {
      throw options.throwDeletingShader.error;
    }
  });
  const deleteProgram = vi.fn(() => {
    if (options.throwDeleteProgram) throw options.throwDeleteProgram;
  });
  const deleteBuffer = vi.fn(() => {
    if (options.throwDeleteBuffer) throw options.throwDeleteBuffer;
  });
  const deleteVertexArray = vi.fn();
  const viewport = vi.fn();
  const useProgram = vi.fn();
  const activeTexture = vi.fn();
  const pixelStorei = vi.fn();
  const methods: Record<string, unknown> = {
    ...constants,
    createShader,
    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    getShaderParameter(shader: object) {
      return shaderStage.get(shader) !== options.failedShader;
    },
    getShaderInfoLog: vi.fn(() => 'compile failure'),
    deleteShader,
    createProgram: vi.fn(() => ({ id: ++handleId })),
    attachShader: vi.fn(),
    detachShader: vi.fn(),
    linkProgram: vi.fn(),
    getProgramParameter: vi.fn(() => true),
    getProgramInfoLog: vi.fn(() => ''),
    deleteProgram,
    getUniformLocation: vi.fn((_program: object, name: string) => ({ name })),
    createVertexArray: vi.fn(() => ({ id: ++handleId })),
    deleteVertexArray,
    createBuffer: vi.fn(() => {
      bufferCount += 1;
      return bufferCount === options.failBuffer ? null : { id: ++handleId };
    }),
    deleteBuffer,
    bufferData: vi.fn(),
    bindFramebuffer: vi.fn(() => {
      if (options.throwBindFramebuffer) throw options.throwBindFramebuffer;
    }),
    viewport,
    useProgram,
    activeTexture,
    pixelStorei,
  };
  const gl = new Proxy(methods, {
    get(target, property) {
      if (typeof property !== 'string') return undefined;
      if (!(property in target)) target[property] = vi.fn();
      return target[property];
    },
  }) as unknown as WebGL2RenderingContext;
  return {
    gl,
    deletedShaders,
    deleteProgram,
    deleteBuffer,
    deleteVertexArray,
    viewport,
    useProgram,
    activeTexture,
    pixelStorei,
  };
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
