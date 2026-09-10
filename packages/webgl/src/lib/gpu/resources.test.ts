import { Fragment, createElement, crc } from '@crc/core';
import { executeBackendCRC, mountBackendCRC } from '@crc/core/internal';
import { describe, expect, it, vi } from 'vitest';
import { Mesh } from '../components/mesh.js';
import { createWebGLGeometry } from '../geometry/geometry.js';
import { resolveCamera } from '../math/camera.js';
import { createWebGLBackend } from '../backend.js';
import { WebGLGPUResourceCache } from './resources.js';

describe('WebGLGPUResourceCache', () => {
  it('uploads immutable geometry once and shares geometry and program leases', () => {
    const recording = createResourceGL('one');
    const cache = new WebGLGPUResourceCache(recording.gl, 1);
    const geometry = createWebGLGeometry({
      positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
      indices: [0, 1, 2],
    });

    const programA = cache.acquireProgram('Mesh');
    const geometryA = cache.acquireGeometry(geometry, 'Mesh');
    const programB = cache.acquireProgram('Mesh');
    const geometryB = cache.acquireGeometry(geometry, 'Mesh');

    expect(programB.value).toBe(programA.value);
    expect(geometryB.value).toBe(geometryA.value);
    expect(recording.createProgram).toHaveBeenCalledOnce();
    expect(recording.createVertexArray).toHaveBeenCalledOnce();
    expect(recording.createBuffer).toHaveBeenCalledTimes(2);
    expect(recording.uploads).toEqual([
      {
        target: recording.gl.ARRAY_BUFFER,
        length: 9,
        usage: recording.gl.STATIC_DRAW,
      },
      {
        target: recording.gl.ELEMENT_ARRAY_BUFFER,
        length: 3,
        usage: recording.gl.STATIC_DRAW,
      },
    ]);

    programA.release(false);
    geometryA.release(false);
    expect(recording.deleteProgram).not.toHaveBeenCalled();
    expect(recording.deleteBuffer).not.toHaveBeenCalled();
    expect(recording.deleteVertexArray).not.toHaveBeenCalled();

    programB.release(false);
    geometryB.release(false);
    expect(recording.deleteProgram).toHaveBeenCalledOnce();
    expect(recording.deleteBuffer).toHaveBeenCalledTimes(2);
    expect(recording.deleteVertexArray).toHaveBeenCalledOnce();
  });

  it('never shares handles across contexts or context generations', () => {
    const geometry = createWebGLGeometry({
      positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
    });
    const first = createResourceGL('first');
    const second = createResourceGL('second');
    const firstCache = new WebGLGPUResourceCache(first.gl, 1);
    const secondCache = new WebGLGPUResourceCache(second.gl, 2);

    const firstProgram = firstCache.acquireProgram('Mesh');
    const firstGeometry = firstCache.acquireGeometry(geometry, 'Mesh');
    const secondProgram = secondCache.acquireProgram('Mesh');
    const secondGeometry = secondCache.acquireGeometry(geometry, 'Mesh');

    expect(secondProgram.value.program).not.toBe(firstProgram.value.program);
    expect(secondGeometry.value.vertexArray)
      .not.toBe(firstGeometry.value.vertexArray);
    expect(first.ownedHandles.every(handle => handle.context === 'first'))
      .toBe(true);
    expect(second.ownedHandles.every(handle => handle.context === 'second'))
      .toBe(true);

    firstCache.dispose(false);
    secondCache.dispose(false);
  });

  it('rolls back a partial geometry upload without publishing a lease', () => {
    const recording = createResourceGL('rollback', { failBuffer: 2 });
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

    cache.dispose(false);
    expect(recording.deleteBuffer).toHaveBeenCalledOnce();
    expect(recording.deleteVertexArray).toHaveBeenCalledOnce();
  });

  it('rebuilds cached handles when the driver context generation changes', () => {
    const recording = createResourceGL('generation');
    const geometry = createWebGLGeometry({
      positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
    });
    let generation = 1;
    const driver = createWebGLBackend({
      gl: recording.gl,
      getCamera: () => resolveCamera(undefined, 10, 10),
      getContextGeneration: () => generation,
    });
    const firstCache = beginDriverFrame(driver).environment.gpuResources;
    const firstProgram = firstCache.acquireProgram('Mesh');
    const firstGeometry = firstCache.acquireGeometry(geometry, 'Mesh');

    generation = 2;
    const secondCache = beginDriverFrame(driver).environment.gpuResources;
    const secondProgram = secondCache.acquireProgram('Mesh');
    const secondGeometry = secondCache.acquireGeometry(geometry, 'Mesh');

    expect(secondCache).not.toBe(firstCache);
    expect(secondProgram.value.program).not.toBe(firstProgram.value.program);
    expect(secondGeometry.value.vertexArray)
      .not.toBe(firstGeometry.value.vertexArray);
    expect(recording.createProgram).toHaveBeenCalledTimes(2);
    expect(recording.createVertexArray).toHaveBeenCalledTimes(2);
    expect(recording.deleteProgram).toHaveBeenCalledOnce();
    expect(recording.deleteVertexArray).toHaveBeenCalledOnce();

    firstProgram.release(false);
    firstGeometry.release(false);
    secondProgram.release(false);
    secondGeometry.release(false);
    expect(recording.deleteProgram).toHaveBeenCalledTimes(2);
    expect(recording.deleteVertexArray).toHaveBeenCalledTimes(2);
    driver.dispose();
  });

  it('driver disposal empties outstanding cached handles exactly once', () => {
    const recording = createResourceGL('dispose');
    const geometry = createWebGLGeometry({
      positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
    });
    const driver = createWebGLBackend({
      gl: recording.gl,
      getCamera: () => resolveCamera(undefined, 10, 10),
      getContextGeneration: () => 7,
    });
    const frame = beginDriverFrame(driver);
    const cache = frame.environment.gpuResources;
    const program = cache.acquireProgram('Mesh');
    const uploaded = cache.acquireGeometry(geometry, 'Mesh');

    driver.dispose();
    driver.dispose();
    program.release(false);
    uploaded.release(false);

    expect(recording.deleteProgram).toHaveBeenCalledOnce();
    expect(recording.deleteBuffer).toHaveBeenCalledOnce();
    expect(recording.deleteVertexArray).toHaveBeenCalledOnce();
    expect(() => cache.acquireProgram('Mesh')).toThrowError(
      /generation 7.*disposed/i,
    );
  });

  it('component removal releases one shared lease and final removal deletes once', () => {
    const recording = createResourceGL('components');
    const geometry = createWebGLGeometry({
      positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
    });
    const parentCanvas = document.createElement('canvas');
    const parent = crc(parentCanvas, undefined);
    const driver = createWebGLBackend({
      gl: recording.gl,
      getCamera: () => resolveCamera(undefined, 20, 10),
      getContextGeneration: () => 1,
    });
    const both = createElement(Fragment, {
      children: [
        createElement(Mesh, { key: 'a', geometry }),
        createElement(Mesh, { key: 'b', geometry }),
      ],
    });
    const one = createElement(Fragment, {
      children: createElement(Mesh, { key: 'a', geometry }),
    });
    const mount = mountBackendCRC(new OffscreenCanvas(40, 20), both, {
      parent: parentCanvas,
      logicalWidth: 20,
      logicalHeight: 10,
      driver,
    });

    executeBackendCRC(mount, both, 1);
    expect(recording.createProgram).toHaveBeenCalledOnce();
    expect(recording.createVertexArray).toHaveBeenCalledOnce();

    executeBackendCRC(mount, one, 2);
    expect(recording.deleteProgram).not.toHaveBeenCalled();
    expect(recording.deleteVertexArray).not.toHaveBeenCalled();

    executeBackendCRC(mount, undefined, 3);
    expect(recording.deleteProgram).toHaveBeenCalledOnce();
    expect(recording.deleteVertexArray).toHaveBeenCalledOnce();

    mount.dispose();
    parent.dispose();
    expect(recording.deleteProgram).toHaveBeenCalledOnce();
    expect(recording.deleteVertexArray).toHaveBeenCalledOnce();
  });
});

function beginDriverFrame(driver: ReturnType<typeof createWebGLBackend>) {
  const frame = driver.beginFrame({
    canvas: new OffscreenCanvas(10, 10),
    logicalWidth: 10,
    logicalHeight: 10,
    backingWidth: 10,
    backingHeight: 10,
    renderTimestamp: 1,
  });
  if (!frame) throw new Error('Expected an active WebGL frame.');
  return frame;
}

interface ResourceGLOptions {
  readonly failBuffer?: number;
}

interface OwnedHandle {
  readonly context: string;
  readonly kind: string;
  readonly id: number;
  readonly type?: number;
}

function createResourceGL(
  context: string,
  options: ResourceGLOptions = {},
) {
  const constants = createConstants();
  const ownedHandles: OwnedHandle[] = [];
  let nextHandle = 0;
  let bufferCount = 0;
  const handle = (kind: string, type?: number): OwnedHandle => {
    const value = { context, kind, id: ++nextHandle, type };
    ownedHandles.push(value);
    return value;
  };
  const createProgram = vi.fn(() => handle('program'));
  const deleteProgram = vi.fn();
  const createVertexArray = vi.fn(() => handle('vertex-array'));
  const deleteVertexArray = vi.fn();
  const createBuffer = vi.fn(() => {
    bufferCount += 1;
    return bufferCount === options.failBuffer ? null : handle('buffer');
  });
  const deleteBuffer = vi.fn();
  const uploads: Array<{
    readonly target: number;
    readonly length: number;
    readonly usage: number;
  }> = [];
  const methods: Record<string, unknown> = {
    getParameter: () => 8,
    isContextLost: () => false,
    createShader: (type: number) => handle('shader', type),
    shaderSource: () => undefined,
    compileShader: () => undefined,
    getShaderParameter: () => true,
    getShaderInfoLog: () => '',
    deleteShader: vi.fn(),
    createProgram,
    attachShader: () => undefined,
    linkProgram: () => undefined,
    getProgramParameter: () => true,
    getProgramInfoLog: () => '',
    deleteProgram,
    getUniformLocation: (_program: object, name: string) => ({ name }),
    createVertexArray,
    deleteVertexArray,
    createBuffer,
    deleteBuffer,
    bufferData: (
      target: number,
      data: ArrayLike<number>,
      usage: number,
    ) => uploads.push({ target, length: data.length, usage }),
  };
  const gl = new Proxy({ ...constants, ...methods }, {
    get(target, property) {
      if (typeof property !== 'string') return undefined;
      if (property in target) return target[property as keyof typeof target];
      const noop = () => undefined;
      Object.assign(target, { [property]: noop });
      return noop;
    },
  }) as unknown as WebGL2RenderingContext;
  return {
    gl,
    ownedHandles,
    uploads,
    createProgram,
    deleteProgram,
    createVertexArray,
    deleteVertexArray,
    createBuffer,
    deleteBuffer,
  };
}

function createConstants(): Record<string, number> {
  const names = [
    'ACTIVE_TEXTURE', 'ALWAYS', 'ARRAY_BUFFER', 'BACK', 'BLEND',
    'BROWSER_DEFAULT_WEBGL', 'CCW', 'COLOR_BUFFER_BIT', 'COMPILE_STATUS',
    'CULL_FACE', 'DEPTH_BUFFER_BIT', 'DEPTH_TEST', 'ELEMENT_ARRAY_BUFFER',
    'FLOAT', 'FRAGMENT_SHADER', 'FRAMEBUFFER', 'FRONT', 'FUNC_ADD', 'KEEP',
    'LEQUAL', 'LESS', 'LINK_STATUS', 'MAX_COMBINED_TEXTURE_IMAGE_UNITS',
    'ONE', 'PACK_ALIGNMENT', 'PACK_ROW_LENGTH', 'PACK_SKIP_PIXELS',
    'PACK_SKIP_ROWS', 'POLYGON_OFFSET_FILL', 'SCISSOR_TEST', 'STATIC_DRAW',
    'STENCIL_TEST', 'TEXTURE0', 'TEXTURE_2D', 'TEXTURE_2D_ARRAY',
    'TEXTURE_3D', 'TEXTURE_CUBE_MAP', 'TRIANGLES', 'UNPACK_ALIGNMENT',
    'UNPACK_COLORSPACE_CONVERSION_WEBGL', 'UNPACK_FLIP_Y_WEBGL',
    'UNPACK_IMAGE_HEIGHT', 'UNPACK_PREMULTIPLY_ALPHA_WEBGL',
    'UNPACK_ROW_LENGTH', 'UNPACK_SKIP_IMAGES', 'UNPACK_SKIP_PIXELS',
    'UNPACK_SKIP_ROWS', 'UNSIGNED_INT', 'VERTEX_SHADER', 'ZERO',
  ];
  return Object.fromEntries(names.map((name, index) => [name, index + 1]));
}
