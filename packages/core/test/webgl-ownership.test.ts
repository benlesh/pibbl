import { createElement, useWhenChanged, type CRCController } from '../src/index';
import type { ScenarioController, WebGLLabState } from '@crc/scenarios';
import { loadScenario, webglLabScenarioEntry } from '@crc/scenarios';
import { executeRender } from '../src/lib/execute-render';
import { GLOBAL_STATE, getCRCInstance } from '../src/lib/global-state';
import { mountCRC } from '../src/lib/mount-crc';
import { snapshotRealmScheduler } from '../src/lib/scheduler/testing';
import { update } from '../src/lib/update';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RuntimeDiagnostics } from './support/runtime-diagnostics';

const controllers = new Set<CRCController>();
const scenarioControllers = new Set<ScenarioController<WebGLLabState>>();
const diagnostics = new Set<RuntimeDiagnostics>();

afterEach(async () => {
  for (const controller of scenarioControllers) await controller.dispose();
  scenarioControllers.clear();
  for (const controller of controllers) controller.dispose();
  controllers.clear();
  for (const observer of diagnostics) observer.restore();
  diagnostics.clear();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('backend ownership cleanup', () => {
  it('releases public WebGL scene targets, bitmaps, listeners, and renderer resources exactly once', async () => {
    const probeContext = new OffscreenCanvas(1, 1).getContext('webgl2');
    if (!probeContext) throw new Error('WebGL2 is required for ownership evidence.');
    const glPrototype = Object.getPrototypeOf(
      probeContext,
    ) as WebGL2RenderingContext;
    const createBuffer = vi.spyOn(glPrototype, 'createBuffer');
    const createProgram = vi.spyOn(glPrototype, 'createProgram');
    const createVertexArray = vi.spyOn(glPrototype, 'createVertexArray');
    const deleteBuffer = vi.spyOn(glPrototype, 'deleteBuffer');
    const deleteProgram = vi.spyOn(glPrototype, 'deleteProgram');
    const deleteVertexArray = vi.spyOn(glPrototype, 'deleteVertexArray');
    const transfer = vi.spyOn(
      OffscreenCanvas.prototype,
      'transferToImageBitmap',
    );
    const bitmapClose = vi.spyOn(ImageBitmap.prototype, 'close');
    const addContextListener = vi.spyOn(
      OffscreenCanvas.prototype,
      'addEventListener',
    );
    const removeContextListener = vi.spyOn(
      OffscreenCanvas.prototype,
      'removeEventListener',
    );

    const canvas = document.createElement('canvas');
    canvas.width = webglLabScenarioEntry.canvas.width;
    canvas.height = webglLabScenarioEntry.canvas.height;
    canvas.style.cssText = `display:block;width:${canvas.width}px;height:${canvas.height}px`;
    document.body.replaceChildren(canvas);
    const observer = new RuntimeDiagnostics(canvas);
    diagnostics.add(observer);
    const definition = await loadScenario(webglLabScenarioEntry);
    const controller = await definition.mount({ canvas });
    scenarioControllers.add(controller);
    await controller.settled();

    expect(observer.snapshot()).toMatchObject({
      eventTargets: 4,
      focusCandidates: 2,
      instances: 2,
      scheduledFrames: 0,
    });
    expect({
      buffers: createBuffer.mock.calls.length,
      programs: createProgram.mock.calls.length,
      vertexArrays: createVertexArray.mock.calls.length,
      bitmaps: transfer.mock.calls.length,
      contextListeners: addContextListener.mock.calls.map(([type]) => type),
    }).toEqual({
      buffers: 6,
      programs: 1,
      vertexArrays: 2,
      bitmaps: 1,
      contextListeners: ['webglcontextlost', 'webglcontextrestored'],
    });

    await controller.dispose();
    scenarioControllers.delete(controller);

    expect(observer.snapshot()).toMatchObject({
      componentTeardowns: 0,
      eventTargets: 0,
      focusCandidates: 0,
      focusManagers: 0,
      instances: 0,
      mainTeardowns: 0,
      nativeListeners: 0,
      propagationListeners: 0,
      scheduledFrames: 0,
    });
    const ledger = observer.ledgerSnapshot();
    expect(ledger.nativeListeners).toMatchObject({
      released: ledger.nativeListeners.acquired,
      duplicateReleases: 0,
      live: 0,
    });
    for (const handler of Object.values(ledger.handlers)) {
      expect(handler).toMatchObject({
        released: handler.acquired,
        duplicateReleases: 0,
        live: 0,
      });
    }
    expect(removeContextListener.mock.calls.map(([type]) => type)).toEqual([
      'webglcontextlost',
      'webglcontextrestored',
    ]);
    expect(deleteProgram).toHaveBeenCalledTimes(1);
    expect(deleteBuffer).toHaveBeenCalledTimes(6);
    expect(deleteVertexArray).toHaveBeenCalledTimes(2);
    expect(bitmapClose).toHaveBeenCalledOnce();
  });

  it('clears frame ownership before a failing cancellation and continues teardown', () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 41);
    const cancellationError = new Error('cancellation failed');
    const cancel = vi.spyOn(window, 'cancelAnimationFrame')
      .mockImplementationOnce(() => {
        throw cancellationError;
      })
      .mockImplementation(() => undefined);
    const reported: unknown[] = [];
    vi.spyOn(globalThis, 'reportError').mockImplementation(error => {
      reported.push(error);
    });
    const cleanup = vi.fn();
    function OwnedComponent(): void {
      useWhenChanged(() => cleanup, []);
    }
    const canvas = document.createElement('canvas');
    document.body.appendChild(canvas);
    const controller = mountCRC(
      canvas,
      createElement(OwnedComponent, {}),
    );
    controllers.add(controller);
    executeRender(canvas, 1);
    update(canvas);
    const instance = getCRCInstance(canvas);
    expect(snapshotRealmScheduler().pendingHostFrames).toBe(1);

    expect(() => controller.dispose()).not.toThrow();

    expect(cancel).toHaveBeenCalledOnce();
    expect(reported).toEqual([cancellationError]);
    expect(snapshotRealmScheduler().pendingHostFrames).toBe(0);
    expect(instance.mainTeardowns.closed).toBe(true);
    expect(instance.refs.size).toBe(0);
    expect(GLOBAL_STATE.crcInstances.has(canvas)).toBe(false);
    expect(cleanup).toHaveBeenCalledOnce();
    controller.dispose();
    expect(cancel).toHaveBeenCalledOnce();
  });
});
