import {
  Fragment,
  Rectangle,
  crc,
  createElement,
  type CRCController,
} from '@crc/core';
import type { ScenarioController, WebGLLabState } from '@crc/scenarios';
import {
  loadScenario,
  webglLabScenarioEntry,
} from '@crc/scenarios';
import {
  Mesh,
  WebGLLayer,
  createWebGLGeometry,
} from '@crc/webgl';
import { afterEach, describe, expect, it, vi } from 'vitest';

let activeController: ScenarioController<WebGLLabState> | undefined;
let activeRuntime: CRCController | undefined;

function settledFrames(): Promise<void> {
  return new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
}

afterEach(async () => {
  await activeController?.dispose();
  activeController = undefined;
  activeRuntime?.dispose();
  activeRuntime = undefined;
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('public WebGL laboratory structural cost', () => {
  it('executes a public WebGL child once per invalidated island traversal', async () => {
    let childExecutions = 0;
    const geometry = createWebGLGeometry({
      positions: [-1, -1, 0, 1, -1, 0, 0, 1, 0],
    });
    const onExecute = () => {
      childExecutions += 1;
    };
    function CountedMesh(props: { readonly onExecute: () => void }) {
      props.onExecute();
      return createElement(Mesh, {
        geometry,
        pointerEvents: 'none',
        style: { lit: false },
      });
    }
    const canvas = document.createElement('canvas');
    canvas.width = 480;
    canvas.height = 300;
    canvas.style.cssText = 'display:block;width:480px;height:300px';
    document.body.replaceChildren(canvas);
    const scene = (fill: string, islandWidth: number) => createElement(
      Fragment,
      null,
      createElement(Rectangle, {
        pointerEvents: 'none',
        style: { width: 480, height: 300, fill },
      }),
      createElement(
        WebGLLayer,
        {
          style: { width: islandWidth, height: 300 },
          children: createElement(CountedMesh, {
            onExecute,
          }),
        },
      ),
    );

    activeRuntime = crc(canvas, scene('#dbeafe', 480), { pixelRatio: 1 });
    await settledFrames();
    expect(childExecutions).toBe(1);

    crc(canvas, scene('#bfdbfe', 480));
    await settledFrames();
    expect(childExecutions).toBe(1);

    crc(canvas, scene('#bfdbfe', 479));
    await settledFrames();
    expect(childExecutions).toBe(2);
  });

  it('draws once per mesh, transfers once per changed island, and reuses its cache', async () => {
    const probeCanvas = new OffscreenCanvas(1, 1);
    const probeContext = probeCanvas.getContext('webgl2');
    if (!probeContext) throw new Error('WebGL2 is required for the WebGL laboratory.');
    const glPrototype = Object.getPrototypeOf(probeContext) as WebGL2RenderingContext;
    const drawElements = vi.spyOn(glPrototype, 'drawElements');
    const readPixels = vi.spyOn(glPrototype, 'readPixels');
    const createFramebuffer = vi.spyOn(glPrototype, 'createFramebuffer');
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
      buffers: createBuffer.mock.calls.length,
      programs: createProgram.mock.calls.length,
      vertexArrays: createVertexArray.mock.calls.length,
      listeners: addListener.mock.calls.map(([type]) => type),
    }).toEqual({
      draws: 2,
      transfers: 1,
      composites: 1,
      readbacks: 0,
      framebuffers: 0,
      buffers: 6,
      programs: 1,
      vertexArrays: 2,
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
      buffers: createBuffer.mock.calls.length,
      programs: createProgram.mock.calls.length,
      vertexArrays: createVertexArray.mock.calls.length,
      deletedBuffers: deleteBuffer.mock.calls.length,
      deletedVertexArrays: deleteVertexArray.mock.calls.length,
    }).toEqual({
      draws: 4,
      transfers: 2,
      composites: 3,
      readbacks: 0,
      framebuffers: 0,
      buffers: 6,
      programs: 1,
      vertexArrays: 2,
      deletedBuffers: 0,
      deletedVertexArrays: 0,
    });

    await activeController.perform('show-transparency');
    expect({
      draws: drawElements.mock.calls.length,
      transfers: transfer.mock.calls.length,
      composites: composite.mock.calls.length,
      buffers: createBuffer.mock.calls.length,
      programs: createProgram.mock.calls.length,
      vertexArrays: createVertexArray.mock.calls.length,
      deletedBuffers: deleteBuffer.mock.calls.length,
      deletedVertexArrays: deleteVertexArray.mock.calls.length,
    }).toEqual({
      draws: 6,
      transfers: 3,
      composites: 4,
      buffers: 8,
      programs: 1,
      vertexArrays: 3,
      deletedBuffers: 6,
      deletedVertexArrays: 2,
    });

    await activeController.perform('show-mixed-order');
    expect({
      draws: drawElements.mock.calls.length,
      transfers: transfer.mock.calls.length,
      composites: composite.mock.calls.length,
      buffers: createBuffer.mock.calls.length,
      programs: createProgram.mock.calls.length,
      vertexArrays: createVertexArray.mock.calls.length,
      deletedBuffers: deleteBuffer.mock.calls.length,
      deletedVertexArrays: deleteVertexArray.mock.calls.length,
    }).toEqual({
      draws: 8,
      transfers: 4,
      composites: 5,
      buffers: 14,
      programs: 1,
      vertexArrays: 5,
      deletedBuffers: 8,
      deletedVertexArrays: 3,
    });

    await activeController.dispose();
    activeController = undefined;
    expect(removeListener.mock.calls.map(([type]) => type)).toEqual([
      'webglcontextlost',
      'webglcontextrestored',
    ]);
    expect(deleteProgram).toHaveBeenCalledTimes(1);
    expect(deleteBuffer).toHaveBeenCalledTimes(14);
    expect(deleteVertexArray).toHaveBeenCalledTimes(5);
    expect(bitmapClose).toHaveBeenCalledTimes(4);
  });
});
