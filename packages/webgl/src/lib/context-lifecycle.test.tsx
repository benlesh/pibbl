import {
  crc,
  crcState,
  createElement,
  type CRCController,
} from '@crc/core';
import type {
  CRCHitTestOutput,
  CRCEventTargetRegistration,
} from '@crc/core/internal';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineWebGLPrimitive } from './define-webgl-primitive.js';
import { createWebGLGeometry } from './geometry/geometry.js';
import { createBuiltInProgram } from './gpu/program.js';
import { WebGLGPUResourceCache } from './gpu/resources.js';
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
  it('invalidates one lost generation and publishes one restored generation only after composition', () => {
    const firstBitmap = bitmap('first');
    const restoredBitmap = bitmap('restored');
    const platform = installContextPlatform([firstBitmap, restoredBitmap]);
    const parentCanvas = mountParent();
    const callbacks: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
      callbacks.push(callback);
      return callbacks.length;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
    const resourceCreates: number[] = [];
    const resourceReleases: Array<{
      readonly generation: number;
      readonly contextLost: boolean;
    }> = [];
    let renders = 0;
    const Target = defineWebGLPrimitive<{}, {}>(function renderLifecycleTarget(
      _props,
      _style,
      context,
    ) {
      renders += 1;
      context.resources.use(
        () => {
          resourceCreates.push(context.contextGeneration);
          return { generation: context.contextGeneration };
        },
        (resource, releaseContext) => {
          resourceReleases.push({
            generation: resource.generation,
            contextLost: releaseContext.contextLost,
          });
        },
        [],
      );
    }, {
      hit: { kind: 'custom', resolve: () => 1 },
    });
    const root = createElement(Target, {
      keyboardFocusable: true,
      keyboardNavigationBounds: { x: 1, y: 2, width: 3, height: 4 },
      onClick: () => undefined,
    });
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

    expect(platform.listenerAdds).toEqual([
      'webglcontextlost',
      'webglcontextrestored',
    ]);
    controller.renderUpdatedChild(root, undefined, surface, 1);
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
    expect(resourceCreates).toEqual([1]);
    expect(controller.contextGeneration).toBe(1);

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
    expect(resourceReleases).toEqual([{
      generation: 1,
      contextLost: true,
    }]);
    expect(callbacks).toEqual([]);

    platform.canvas.dispatchEvent(
      new Event('webglcontextlost', { cancelable: true }),
    );
    expect(controller.contextGeneration).toBe(2);
    expect(firstBitmap.close).toHaveBeenCalledOnce();
    expect(resourceReleases).toHaveLength(1);

    platform.contextLost = false;
    platform.canvas.dispatchEvent(new Event('webglcontextrestored'));
    platform.canvas.dispatchEvent(new Event('webglcontextrestored'));
    expect(callbacks).toHaveLength(1);

    callbacks[0]!(2);

    expect(renders).toBe(2);
    expect(resourceCreates).toEqual([1, 2]);
    expect(controller.committedGeneration).toBeUndefined();
    expect(controller.candidateGeneration).toBeUndefined();
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
    expect(restoredBitmap.close).not.toHaveBeenCalled();
    expect(resolve(controller)).toMatchObject({
      disposition: 2,
      target: firstTarget,
    });

    controller.dispose();
    expect(platform.listenerRemoves).toEqual([
      'webglcontextlost',
      'webglcontextrestored',
    ]);
    expect(restoredBitmap.close).toHaveBeenCalledOnce();
    expect(resourceReleases).toEqual([
      { generation: 1, contextLost: true },
      { generation: 2, contextLost: false },
    ]);
    platform.canvas.dispatchEvent(new Event('webglcontextrestored'));
    expect(callbacks).toHaveLength(1);
  });

  it('fences context loss during child draw before transfer or target publication', async () => {
    const unused = bitmap('unused');
    const platform = installContextPlatform([unused]);
    const parentCanvas = mountParent();
    let loss: Event | undefined;
    const LosingTarget = defineWebGLPrimitive<{}, {}>(function renderLosingTarget() {
      platform.contextLost = true;
      loss = new Event('webglcontextlost', { cancelable: true });
      platform.canvas.dispatchEvent(loss);
    }, { hit: { kind: 'custom', resolve: () => 1 } });
    const root = createElement(LosingTarget, { onClick: () => undefined });
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
    expect(controller.contextGeneration).toBe(2);
    expect(platform.transferCount).toBe(0);
    expect(controller.committedGeneration).toBeUndefined();
    expect(controller.candidateGeneration).toBeUndefined();
    expect(getCRCInstance(parentCanvas).eventRoot.targets.size).toBe(0);
    expect(unused.close).not.toHaveBeenCalled();
    controller.dispose();
  });

  it('closes and rejects a bitmap transferred across context loss', async () => {
    const stale = bitmap('stale-transfer');
    let loss: Event | undefined;
    let platform: ReturnType<typeof installContextPlatform>;
    platform = installContextPlatform([stale], {
      onTransfer(canvas) {
        platform.contextLost = true;
        loss = new Event('webglcontextlost', { cancelable: true });
        canvas.dispatchEvent(loss);
      },
    });
    const parentCanvas = mountParent();
    const Target = defineWebGLPrimitive<{}, {}>(function renderTransferTarget() {}, {
      hit: { kind: 'custom', resolve: () => 1 },
    });
    const root = createElement(Target, { onClick: () => undefined });
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
    expect(stale.close).toHaveBeenCalledOnce();
    expect(controller.committedGeneration).toBeUndefined();
    expect(controller.candidateGeneration).toBeUndefined();
    expect(getCRCInstance(parentCanvas).eventRoot.targets.size).toBe(0);
    controller.dispose();
    expect(stale.close).toHaveBeenCalledOnce();
  });

  it('cannot commit a candidate when context loss occurs during parent draw', async () => {
    const candidate = bitmap('stale-composite');
    const platform = installContextPlatform([candidate]);
    const parentCanvas = mountParent();
    const Target = defineWebGLPrimitive<{}, {}>(function renderCompositeTarget() {}, {
      hit: { kind: 'custom', resolve: () => 1 },
    });
    const root = createElement(Target, { onClick: () => undefined });
    const controller = new WebGLLayerController(
      parentCanvas,
      root,
      undefined,
      resolveWebGLLayerSurface(20, 10, { x: 1, y: 1 }),
    );
    controller.renderUpdatedChild(root, undefined, controller.surface, 1);
    const loss = new Event('webglcontextlost', { cancelable: true });

    expect(() => controller.composite({
      drawImage() {
        platform.contextLost = true;
        platform.canvas.dispatchEvent(loss);
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
    expect(loss.defaultPrevented).toBe(true);
    expect(candidate.close).toHaveBeenCalledOnce();
    expect(controller.committedGeneration).toBeUndefined();
    expect(controller.candidateGeneration).toBeUndefined();
    expect(getCRCInstance(parentCanvas).eventRoot.targets.size).toBe(0);
    controller.dispose();
    expect(candidate.close).toHaveBeenCalledOnce();
  });

  it('attempts every layer release after application and bitmap cleanup throw', () => {
    const applicationError = new Error('application release failed');
    const bitmapError = new Error('candidate close failed');
    const stable = bitmap('stable');
    const candidate = bitmap('candidate');
    candidate.close.mockImplementation(() => {
      throw bitmapError;
    });
    const platform = installContextPlatform([stable, candidate]);
    const reported: unknown[] = [];
    vi.spyOn(globalThis, 'reportError').mockImplementation(error => {
      reported.push(error);
    });
    const Owned = defineWebGLPrimitive<{}, {}>(function renderOwned(
      _props,
      _style,
      context,
    ) {
      context.resources.use(
        () => ({}),
        () => {
          throw applicationError;
        },
        [],
      );
    }, { hit: { kind: 'none' } });
    const root = createElement(Owned, { pointerEvents: 'none' });
    const controller = new WebGLLayerController(
      mountParent(),
      root,
      undefined,
      resolveWebGLLayerSurface(20, 10, { x: 1, y: 1 }),
    );
    const context = {
      drawImage() {},
    } as unknown as CanvasRenderingContext2D;
    controller.renderUpdatedChild(root, undefined, controller.surface, 1);
    controller.composite(context, { x: 0, y: 0, width: 20, height: 10 });
    controller.renderUpdatedChild(root, undefined, controller.surface, 2);

    expect(() => controller.dispose()).not.toThrow();

    expect(reported).toEqual([applicationError, bitmapError]);
    expect(candidate.close).toHaveBeenCalledOnce();
    expect(stable.close).toHaveBeenCalledOnce();
    expect(platform.listenerRemoves).toEqual([
      'webglcontextlost',
      'webglcontextrestored',
    ]);
    controller.dispose();
    expect(candidate.close).toHaveBeenCalledOnce();
    expect(stable.close).toHaveBeenCalledOnce();
  });

  it('cancels pre-existing child animation work when the context is lost', () => {
    const first = bitmap('animated');
    const platform = installContextPlatform([first]);
    const parentCanvas = mountParent();
    const callbacks: FrameRequestCallback[] = [];
    const request = vi.spyOn(window, 'requestAnimationFrame')
      .mockImplementation(callback => {
        callbacks.push(callback);
        return callbacks.length;
      });
    const cancel = vi.spyOn(window, 'cancelAnimationFrame')
      .mockImplementation(() => undefined);
    let renders = 0;
    const Animated = defineWebGLPrimitive<{}, {}>(function renderAnimated() {
      renders += 1;
      crcAnimationFrame();
    }, { hit: { kind: 'none' } });
    const root = createElement(Animated, { pointerEvents: 'none' });
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
    expect(renders).toBe(1);

    platform.contextLost = true;
    platform.canvas.dispatchEvent(
      new Event('webglcontextlost', { cancelable: true }),
    );

    expect(cancel).toHaveBeenCalledOnce();
    callbacks[0]!(2);
    expect(renders).toBe(1);
    expect(platform.transferCount).toBe(1);
    controller.dispose();
  });

  it('does not complete the old generation when loss occurs during final state restoration', async () => {
    const restored = bitmap('restored-after-state-loss');
    let armed = false;
    let armedBaselinePasses = 0;
    let platform: ReturnType<typeof installContextPlatform>;
    platform = installContextPlatform([restored], {
      onGLCall(method) {
        if (!armed || method !== 'bindFramebuffer') return;
        armedBaselinePasses += 1;
        if (armedBaselinePasses !== 2) return;
        platform.contextLost = true;
        platform.canvas.dispatchEvent(
          new Event('webglcontextlost', { cancelable: true }),
        );
      },
    });
    const parentCanvas = mountParent();
    const callbacks: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
      callbacks.push(callback);
      return callbacks.length;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
    const Target = defineWebGLPrimitive<{}, {}>(function renderStateLossTarget() {
      armed = true;
    }, { hit: { kind: 'custom', resolve: () => 1 } });
    const root = createElement(Target, { onClick: () => undefined });
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

    const driver = (controller as unknown as {
      readonly driver: { hasCompletedFrame(): boolean };
    }).driver;
    const { getCRCInstance } = await import(
      '../../../core/src/lib/global-state.js'
    );
    expect(armedBaselinePasses).toBe(2);
    expect(controller.renderedGeneration).toBe(0);
    expect(driver.hasCompletedFrame()).toBe(false);
    expect(getCRCInstance(parentCanvas).eventRoot.targets.size).toBe(0);
    expect(platform.transferCount).toBe(0);

    armed = false;
    platform.contextLost = false;
    platform.canvas.dispatchEvent(new Event('webglcontextrestored'));
    expect(callbacks).toHaveLength(1);
    callbacks[0]!(2);
    controller.renderRetainedChild(root, undefined, controller.surface, 2);
    expect(controller.candidateGeneration).toBe(1);
    controller.composite(
      { drawImage() {} } as unknown as CanvasRenderingContext2D,
      { x: 0, y: 0, width: 20, height: 10 },
    );
    expect(controller.committedGeneration).toBe(1);
    controller.dispose();
  });

  it('does not traverse or acquire resources from private state updates while unavailable', async () => {
    const initial = bitmap('state-initial');
    const restored = bitmap('state-restored');
    let glCalls = 0;
    const platform = installContextPlatform([initial, restored], {
      onGLCall() {
        glCalls += 1;
      },
    });
    const parentCanvas = mountParent();
    const callbacks: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
      callbacks.push(callback);
      return callbacks.length;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
    let setValue: ((value: number | ((old: number) => number)) => void) |
      undefined;
    let traversals = 0;
    const resourceCreates: number[] = [];
    const resourceReleases: Array<{
      readonly generation: number;
      readonly contextLost: boolean;
    }> = [];
    const Stateful = defineWebGLPrimitive<{}, {}>(function renderLostState(
      _props,
      _style,
      context,
    ) {
      traversals += 1;
      const [value, setter] = crcState(0);
      setValue = setter;
      context.resources.use(
        () => {
          context.gl.createBuffer();
          resourceCreates.push(context.contextGeneration);
          return { generation: context.contextGeneration };
        },
        (resource, releaseContext) => {
          resourceReleases.push({
            generation: resource.generation,
            contextLost: releaseContext.contextLost,
          });
          setter(old => old + 1);
        },
        [value],
      );
    }, { hit: { kind: 'custom', resolve: () => 1 } });
    const root = createElement(Stateful, { onClick: () => undefined });
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
    const initialGLCalls = glCalls;

    platform.contextLost = true;
    platform.canvas.dispatchEvent(
      new Event('webglcontextlost', { cancelable: true }),
    );
    setValue?.(old => old + 1);
    expect(callbacks).toHaveLength(1);
    callbacks[0]!(2);

    const { getCRCInstance } = await import(
      '../../../core/src/lib/global-state.js'
    );
    expect(traversals).toBe(1);
    expect(glCalls).toBe(initialGLCalls);
    expect(resourceCreates).toEqual([1]);
    expect(resourceReleases).toEqual([{
      generation: 1,
      contextLost: true,
    }]);
    expect(getCRCInstance(parentCanvas).eventRoot.targets.size).toBe(0);
    expect(controller.renderedGeneration).toBe(1);
    expect(controller.candidateGeneration).toBeUndefined();
    expect(controller.committedGeneration).toBeUndefined();

    platform.contextLost = false;
    platform.canvas.dispatchEvent(new Event('webglcontextrestored'));
    expect(callbacks).toHaveLength(2);
    callbacks[1]!(3);
    expect(traversals).toBe(2);
    expect(resourceCreates).toEqual([1, 2]);
    controller.renderRetainedChild(root, undefined, surface, 3);
    controller.composite(
      { drawImage() {} } as unknown as CanvasRenderingContext2D,
      { x: 0, y: 0, width: 20, height: 10 },
    );
    expect(controller.committedGeneration).toBe(2);
    controller.dispose();
  });

  it('restores exactly the latest parent root, camera, and surface once', () => {
    const initial = bitmap('parent-initial');
    const restored = bitmap('parent-restored');
    const platform = installContextPlatform([initial, restored]);
    const parentCanvas = mountParent();
    const callbacks: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
      callbacks.push(callback);
      return callbacks.length;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
    let oldTraversals = 0;
    let currentTraversals = 0;
    const oldResourceCreates: number[] = [];
    const currentSnapshots: unknown[] = [];
    const Old = defineWebGLPrimitive<{}, {}>(function renderRemovedChild(
      _props,
      _style,
      context,
    ) {
      oldTraversals += 1;
      context.resources.use(
        () => {
          oldResourceCreates.push(context.contextGeneration);
          return {};
        },
        () => undefined,
        [],
      );
    }, { hit: { kind: 'none' } });
    const Current = defineWebGLPrimitive<{}, {}>(function renderCurrentChild(
      _props,
      _style,
      context,
    ) {
      currentTraversals += 1;
      currentSnapshots.push({
        generation: context.contextGeneration,
        camera: context.camera.descriptor,
        logicalViewport: context.logicalViewport,
        backingViewport: context.backingViewport,
      });
    }, { hit: { kind: 'none' } });
    const oldRoot = createElement(Old, { key: 'old', pointerEvents: 'none' });
    const currentRoot = createElement(Current, {
      key: 'current',
      pointerEvents: 'none',
    });
    const oldSurface = resolveWebGLLayerSurface(20, 10, { x: 1, y: 1 });
    const currentSurface = resolveWebGLLayerSurface(30, 12, { x: 2, y: 3 });
    const currentCamera = {
      type: 'perspective' as const,
      position: [3, 4, 9] as const,
      lookAt: [1, 2, 0] as const,
      up: [0, 1, 0] as const,
      fieldOfViewDegrees: 55,
      near: 0.25,
      far: 500,
    };
    const controller = new WebGLLayerController(
      parentCanvas,
      oldRoot,
      undefined,
      oldSurface,
    );
    controller.renderUpdatedChild(oldRoot, undefined, oldSurface, 1);
    controller.composite(
      { drawImage() {} } as unknown as CanvasRenderingContext2D,
      { x: 0, y: 0, width: 20, height: 10 },
    );

    platform.contextLost = true;
    platform.canvas.dispatchEvent(
      new Event('webglcontextlost', { cancelable: true }),
    );
    controller.renderRetainedChild(
      currentRoot,
      currentCamera,
      currentSurface,
      2,
    );
    expect(callbacks).toHaveLength(0);

    platform.contextLost = false;
    platform.canvas.dispatchEvent(new Event('webglcontextrestored'));
    expect(callbacks).toHaveLength(1);
    callbacks[0]!(3);

    expect(oldTraversals).toBe(1);
    expect(oldResourceCreates).toEqual([1]);
    expect(currentTraversals).toBe(1);
    expect(currentSnapshots).toEqual([{
      generation: 2,
      camera: currentCamera,
      logicalViewport: { width: 30, height: 12 },
      backingViewport: { width: 60, height: 36 },
    }]);
    expect(platform.canvas.width).toBe(60);
    expect(platform.canvas.height).toBe(36);

    controller.renderRetainedChild(
      currentRoot,
      currentCamera,
      currentSurface,
      3,
    );
    expect(currentTraversals).toBe(1);
    expect(platform.transferCount).toBe(2);
    controller.composite(
      { drawImage() {} } as unknown as CanvasRenderingContext2D,
      { x: 0, y: 0, width: 30, height: 12 },
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

    expect(() => createBuiltInProgram(recording.gl, 'Mesh')).toThrowError(
      /Mesh.*fragment.*compil/i,
    );
    expect(recording.deletedShaders).toEqual(['fragment', 'vertex']);
    expect(reported).toEqual([cleanupError]);
  });

  it('attempts every partial upload release when one delete throws', () => {
    const cleanupError = new Error('buffer delete failed');
    const reported: unknown[] = [];
    vi.spyOn(globalThis, 'reportError').mockImplementation(error => {
      reported.push(error);
    });
    const recording = createOwnershipGL({
      failBuffer: 2,
      throwDeleteBuffer: cleanupError,
    });
    const cache = new WebGLGPUResourceCache(recording.gl, 1);
    const geometry = createWebGLGeometry({
      positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
      indices: [0, 1, 2],
    });

    expect(() => cache.acquireGeometry(geometry, 'Cube')).toThrowError(
      /Cube.*index buffer/i,
    );
    expect(recording.deleteBuffer).toHaveBeenCalledOnce();
    expect(recording.deleteVertexArray).toHaveBeenCalledOnce();
    expect(reported).toEqual([cleanupError]);
  });

  it('continues cache disposal after one owned handle release throws', () => {
    const cleanupError = new Error('program delete failed');
    const reported: unknown[] = [];
    vi.spyOn(globalThis, 'reportError').mockImplementation(error => {
      reported.push(error);
    });
    const recording = createOwnershipGL({
      throwDeleteProgram: cleanupError,
    });
    const cache = new WebGLGPUResourceCache(recording.gl, 1);
    const geometry = createWebGLGeometry({
      positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
    });
    cache.acquireProgram('Mesh');
    cache.acquireGeometry(geometry, 'Mesh');

    expect(() => cache.dispose(false)).not.toThrow();
    expect(recording.deleteProgram).toHaveBeenCalledOnce();
    expect(recording.deleteBuffer).toHaveBeenCalledOnce();
    expect(recording.deleteVertexArray).toHaveBeenCalledOnce();
    expect(reported).toEqual([cleanupError]);
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

function committedTarget(
  controller: WebGLLayerController,
): CRCEventTargetRegistration {
  const state = controller as unknown as {
    readonly committed: {
      readonly pickLedger: {
        readonly entries: ReadonlyArray<{
          readonly target: CRCEventTargetRegistration;
        }>;
      };
    };
  };
  return state.committed.pickLedger.entries[0]!.target;
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
    onGLCall?: (method: string) => void;
  }> = {},
) {
  const listenerAdds: string[] = [];
  const listenerRemoves: string[] = [];
  let contextLost = false;
  let transferCount = 0;
  const gl = createNoopGL(() => contextLost, options.onGLCall);
  class ContextLifecycleOffscreenCanvas extends EventTarget {
    width: number;
    height: number;

    constructor(width: number, height: number) {
      super();
      this.width = width;
      this.height = height;
    }

    override addEventListener(
      type: string,
      callback: EventListenerOrEventListenerObject | null,
      options?: boolean | AddEventListenerOptions,
    ): void {
      listenerAdds.push(type);
      super.addEventListener(type, callback, options);
    }

    override removeEventListener(
      type: string,
      callback: EventListenerOrEventListenerObject | null,
      options?: boolean | EventListenerOptions,
    ): void {
      listenerRemoves.push(type);
      super.removeEventListener(type, callback, options);
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
    get transferCount(): number {
      return transferCount;
    },
    get canvas(): ContextLifecycleOffscreenCanvas {
      return result.createdCanvas!;
    },
    createdCanvas: undefined as ContextLifecycleOffscreenCanvas | undefined,
    get contextLost(): boolean {
      return contextLost;
    },
    set contextLost(value: boolean) {
      contextLost = value;
    },
  };
  const Original = ContextLifecycleOffscreenCanvas;
  class CapturingOffscreenCanvas extends Original {
    constructor(width: number, height: number) {
      super(width, height);
      result.createdCanvas = this;
    }
  }
  vi.stubGlobal('OffscreenCanvas', CapturingOffscreenCanvas);
  return result;
}

function createNoopGL(
  isContextLost: () => boolean,
  onCall?: (method: string) => void,
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
              alpha: true,
              depth: true,
            }) : property === 'isContextLost' ? isContextLost :
              () => onCall?.(property);
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
