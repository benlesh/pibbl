import type { ScenarioController, WebGLLabState } from '@crc/scenarios';
import {
  loadScenario,
  webglLabScenarioEntry,
} from '@crc/scenarios';
import { afterEach, describe, expect, it, vi } from 'vitest';

let activeController: ScenarioController<WebGLLabState> | undefined;

afterEach(async () => {
  await activeController?.dispose();
  activeController = undefined;
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('public WebGL laboratory structural cost', () => {
  it('draws once per mesh, transfers once per changed island, and reuses its cache', async () => {
    const probeCanvas = new OffscreenCanvas(1, 1);
    const probeContext = probeCanvas.getContext('webgl2');
    if (!probeContext) throw new Error('WebGL2 is required for the WebGL laboratory.');
    const glPrototype = Object.getPrototypeOf(probeContext) as WebGL2RenderingContext;
    const drawElements = vi.spyOn(glPrototype, 'drawElements');
    const readPixels = vi.spyOn(glPrototype, 'readPixels');
    const createFramebuffer = vi.spyOn(glPrototype, 'createFramebuffer');
    const deleteBuffer = vi.spyOn(glPrototype, 'deleteBuffer');
    const deleteProgram = vi.spyOn(glPrototype, 'deleteProgram');
    const deleteVertexArray = vi.spyOn(glPrototype, 'deleteVertexArray');
    const transfer = vi.spyOn(
      OffscreenCanvas.prototype,
      'transferToImageBitmap',
    );
    const bitmapClose = vi.spyOn(ImageBitmap.prototype, 'close');
    const composite = vi.spyOn(CanvasRenderingContext2D.prototype, 'drawImage');
    const addListener = vi.spyOn(OffscreenCanvas.prototype, 'addEventListener');
    const removeListener = vi.spyOn(
      OffscreenCanvas.prototype,
      'removeEventListener',
    );

    const canvas = document.createElement('canvas');
    canvas.width = webglLabScenarioEntry.canvas.width;
    canvas.height = webglLabScenarioEntry.canvas.height;
    canvas.style.cssText = `display:block;width:${canvas.width}px;height:${canvas.height}px`;
    document.body.replaceChildren(canvas);
    const definition = await loadScenario(webglLabScenarioEntry);
    activeController = await definition.mount({ canvas });
    await activeController.settled();

    expect({
      draws: drawElements.mock.calls.length,
      transfers: transfer.mock.calls.length,
      composites: composite.mock.calls.length,
      readbacks: readPixels.mock.calls.length,
      framebuffers: createFramebuffer.mock.calls.length,
      listeners: addListener.mock.calls.map(([type]) => type),
    }).toEqual({
      draws: 2,
      transfers: 1,
      composites: 1,
      readbacks: 0,
      framebuffers: 0,
      listeners: ['webglcontextlost', 'webglcontextrestored'],
    });

    await activeController.perform('swap-source-order');
    expect({
      draws: drawElements.mock.calls.length,
      transfers: transfer.mock.calls.length,
      composites: composite.mock.calls.length,
    }).toEqual({ draws: 2, transfers: 1, composites: 2 });

    await activeController.perform('show-depth');
    expect({
      draws: drawElements.mock.calls.length,
      transfers: transfer.mock.calls.length,
      composites: composite.mock.calls.length,
      readbacks: readPixels.mock.calls.length,
      framebuffers: createFramebuffer.mock.calls.length,
    }).toEqual({
      draws: 4,
      transfers: 2,
      composites: 3,
      readbacks: 0,
      framebuffers: 0,
    });

    await activeController.dispose();
    activeController = undefined;
    expect(removeListener.mock.calls.map(([type]) => type)).toEqual([
      'webglcontextlost',
      'webglcontextrestored',
    ]);
    expect(deleteProgram).toHaveBeenCalledTimes(1);
    expect(deleteBuffer).toHaveBeenCalledTimes(4);
    expect(deleteVertexArray).toHaveBeenCalledTimes(2);
    expect(bitmapClose).toHaveBeenCalledTimes(2);
  });
});
