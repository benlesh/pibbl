import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWebGLGeometry } from '../geometry/geometry.js';
import { WebGLRendererResourceCache } from './renderer-resources.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('WebGLRendererResourceCache', () => {
  it('shares candidate resources and reuses them across identical successful scenes', () => {
    const recording = createResourceGL('reuse');
    const cache = new WebGLRendererResourceCache(recording.gl, 7);
    const geometry = triangle();

    const first = cache.beginRender();
    const firstProgram = first.useProgram('Mesh');
    const firstGeometry = first.useGeometry(geometry, 'Mesh');

    expect(first.useProgram('Cube')).toBe(firstProgram);
    expect(first.useGeometry(geometry, 'Cube')).toBe(firstGeometry);
    expect(recording.createProgram).toHaveBeenCalledOnce();
    expect(recording.createVertexArray).toHaveBeenCalledOnce();
    expect(recording.createBuffer).toHaveBeenCalledOnce();
    first.commit();

    const second = cache.beginRender();
    expect(second.useProgram('Sphere')).toBe(firstProgram);
    expect(second.useGeometry(geometry, 'Sphere')).toBe(firstGeometry);
    second.commit();

    expect(recording.createProgram).toHaveBeenCalledOnce();
    expect(recording.createVertexArray).toHaveBeenCalledOnce();
    expect(recording.createBuffer).toHaveBeenCalledOnce();
    expect(recording.deleteProgram).not.toHaveBeenCalled();
    expect(recording.deleteBuffer).not.toHaveBeenCalled();
    expect(recording.deleteVertexArray).not.toHaveBeenCalled();
  });

  it('sweeps geometry omitted by the next scene and all resources after an empty scene', () => {
    const recording = createResourceGL('sweep');
    const cache = new WebGLRendererResourceCache(recording.gl, 1);
    const keptGeometry = triangle();
    const omittedGeometry = indexedTriangle();
    const initial = cache.beginRender();
    const program = initial.useProgram('Mesh');
    const kept = initial.useGeometry(keptGeometry, 'Mesh');
    const omitted = initial.useGeometry(omittedGeometry, 'Mesh');
    initial.commit();

    const reduced = cache.beginRender();
    expect(reduced.useProgram('Cube')).toBe(program);
    expect(reduced.useGeometry(keptGeometry, 'Cube')).toBe(kept);
    reduced.commit();

    expect(recording.deleteBuffer.mock.calls.map(([value]) => value)).toEqual([
      omitted.indexBuffer,
      omitted.positionBuffer,
    ]);
    expect(recording.deleteVertexArray).toHaveBeenCalledExactlyOnceWith(
      omitted.vertexArray,
    );
    expect(recording.deleteProgram).not.toHaveBeenCalled();

    cache.beginRender().commit();

    expect(recording.deleteProgram).toHaveBeenCalledExactlyOnceWith(
      program.program,
    );
    expect(recording.deleteBuffer.mock.calls.map(([value]) => value)).toEqual([
      omitted.indexBuffer,
      omitted.positionBuffer,
      kept.positionBuffer,
    ]);
    expect(
      recording.deleteVertexArray.mock.calls.map(([value]) => value),
    ).toEqual([omitted.vertexArray, kept.vertexArray]);
  });

  it('rejects nested acquisition and acquisition through a closed transaction', () => {
    const recording = createResourceGL('fencing');
    const cache = new WebGLRendererResourceCache(recording.gl, 3);
    const committed = cache.beginRender();

    expect(() => cache.beginRender()).toThrowError(
      /active render transaction/i,
    );
    committed.commit();
    expect(() => committed.useProgram('Mesh')).toThrowError(
      /transaction.*closed/i,
    );
    expect(() => committed.useGeometry(triangle(), 'Mesh')).toThrowError(
      /transaction.*closed/i,
    );
    expect(() => committed.commit()).not.toThrow();
    expect(() => committed.rollback()).not.toThrow();

    const rolledBack = cache.beginRender();
    rolledBack.rollback();
    expect(() => rolledBack.useProgram('Mesh')).toThrowError(
      /transaction.*closed/i,
    );
  });

  it('rolls back candidate-only handles after a later upload failure and retains resident reuse', () => {
    const controls: ResourceGLControls = {};
    const recording = createResourceGL('rollback', controls);
    const cache = new WebGLRendererResourceCache(recording.gl, 1);
    const residentGeometry = triangle();
    const candidateGeometry = triangle(2);
    const failedGeometry = triangle(4);
    const initial = cache.beginRender();
    const residentProgram = initial.useProgram('Mesh');
    const resident = initial.useGeometry(residentGeometry, 'Mesh');
    initial.commit();

    controls.throwBufferDataAt = 3;
    const candidate = cache.beginRender();
    expect(candidate.useProgram('Cube')).toBe(residentProgram);
    expect(candidate.useGeometry(residentGeometry, 'Cube')).toBe(resident);
    const created = candidate.useGeometry(candidateGeometry, 'Cube');
    expect(() => candidate.useGeometry(failedGeometry, 'Sphere')).toThrowError(
      /Sphere.*geometry upload failed/i,
    );
    candidate.rollback();

    expect(recording.deleteBuffer.mock.calls.map(([value]) => value)).toEqual([
      recording.buffers[2],
      created.positionBuffer,
    ]);
    expect(
      recording.deleteVertexArray.mock.calls.map(([value]) => value),
    ).toEqual([recording.vertexArrays[2], created.vertexArray]);
    expect(recording.deleteProgram).not.toHaveBeenCalled();
    expect(recording.deleteBuffer).not.toHaveBeenCalledWith(
      resident.positionBuffer,
    );
    expect(recording.deleteVertexArray).not.toHaveBeenCalledWith(
      resident.vertexArray,
    );

    const next = cache.beginRender();
    expect(next.useProgram('Mesh')).toBe(residentProgram);
    expect(next.useGeometry(residentGeometry, 'Mesh')).toBe(resident);
    next.commit();
    expect(recording.createProgram).toHaveBeenCalledOnce();
    expect(recording.createVertexArray).toHaveBeenCalledTimes(3);
  });

  it('rolls back an initial candidate program and geometry by exact handle', () => {
    const recording = createResourceGL('initial-rollback');
    const cache = new WebGLRendererResourceCache(recording.gl, 1);
    const geometry = indexedTriangle();
    const candidate = cache.beginRender();
    const program = candidate.useProgram('Mesh');
    const resource = candidate.useGeometry(geometry, 'Mesh');

    candidate.rollback();

    expect(recording.deleteProgram.mock.calls.map(([value]) => value)).toEqual([
      program.program,
    ]);
    expect(recording.deleteBuffer.mock.calls.map(([value]) => value)).toEqual([
      resource.indexBuffer,
      resource.positionBuffer,
    ]);
    expect(
      recording.deleteVertexArray.mock.calls.map(([value]) => value),
    ).toEqual([resource.vertexArray]);

    const retry = cache.beginRender();
    expect(retry.useProgram('Mesh')).not.toBe(program);
    expect(retry.useGeometry(geometry, 'Mesh')).not.toBe(resource);
    retry.rollback();
    expect(recording.createProgram).toHaveBeenCalledTimes(2);
    expect(recording.createVertexArray).toHaveBeenCalledTimes(2);
  });

  it.each([
    {
      name: 'fragment shader creation',
      controls: { failShaderAt: 2 },
      deletedShaders: 1,
      deletedPrograms: 0,
    },
    {
      name: 'program creation',
      controls: { failProgramCreation: true },
      deletedShaders: 2,
      deletedPrograms: 0,
    },
    {
      name: 'program publication',
      controls: { missingUniform: 'u_color' },
      deletedShaders: 2,
      deletedPrograms: 1,
    },
  ])(
    'cleans partial $name exactly once without publishing it',
    ({ controls, deletedShaders, deletedPrograms }) => {
      const recording = createResourceGL('partial-program', controls);
      const cache = new WebGLRendererResourceCache(recording.gl, 1);
      const transaction = cache.beginRender();

      expect(() => transaction.useProgram('BrokenMesh')).toThrowError(
        /BrokenMesh.*(?:shader|program)/i,
      );
      expect(recording.deleteShader.mock.calls.map(([value]) => value)).toEqual(
        recording.shaders.slice(0, deletedShaders),
      );
      expect(
        recording.deleteProgram.mock.calls.map(([value]) => value),
      ).toEqual(recording.programs.slice(0, deletedPrograms));
      transaction.rollback();
      cache.dispose(false);
      expect(recording.deleteShader).toHaveBeenCalledTimes(deletedShaders);
      expect(recording.deleteProgram).toHaveBeenCalledTimes(deletedPrograms);
    },
  );

  it.each([
    {
      name: 'vertex array creation',
      controls: { failVertexArray: true },
      createdBuffers: 0,
      deletedBuffers: 0,
      deletedVertexArrays: 0,
    },
    {
      name: 'position buffer creation',
      controls: { failBufferAt: 1 },
      createdBuffers: 0,
      deletedBuffers: 0,
      deletedVertexArrays: 1,
    },
    {
      name: 'index buffer creation',
      controls: { failBufferAt: 2 },
      createdBuffers: 1,
      deletedBuffers: 1,
      deletedVertexArrays: 1,
    },
  ])(
    'cleans partial $name exactly once without publishing it',
    ({ controls, createdBuffers, deletedBuffers, deletedVertexArrays }) => {
      const recording = createResourceGL('partial-geometry', controls);
      const cache = new WebGLRendererResourceCache(recording.gl, 1);
      const transaction = cache.beginRender();

      expect(() =>
        transaction.useGeometry(indexedTriangle(), 'BrokenCube'),
      ).toThrowError(/BrokenCube.*geometry.*creation failed/i);
      expect(recording.buffers).toHaveLength(createdBuffers);
      expect(recording.deleteBuffer.mock.calls.map(([value]) => value)).toEqual(
        recording.buffers.slice(0, deletedBuffers),
      );
      expect(
        recording.deleteVertexArray.mock.calls.map(([value]) => value),
      ).toEqual(recording.vertexArrays.slice(0, deletedVertexArrays));
      transaction.rollback();
      cache.dispose(false);
      expect(recording.deleteBuffer).toHaveBeenCalledTimes(deletedBuffers);
      expect(recording.deleteVertexArray).toHaveBeenCalledTimes(
        deletedVertexArrays,
      );
    },
  );

  it('invalidates resident and candidate records during a transaction without GL deletion', () => {
    const recording = createResourceGL('lost');
    const cache = new WebGLRendererResourceCache(recording.gl, 9);
    const residentGeometry = triangle();
    const candidateGeometry = indexedTriangle();
    const resident = cache.beginRender();
    resident.useProgram('Mesh');
    resident.useGeometry(residentGeometry, 'Mesh');
    resident.commit();
    const candidate = cache.beginRender();
    candidate.useProgram('Mesh');
    candidate.useGeometry(candidateGeometry, 'Cube');

    cache.invalidateContext();
    expect(recording.deleteProgram).not.toHaveBeenCalled();
    expect(recording.deleteBuffer).not.toHaveBeenCalled();
    expect(recording.deleteVertexArray).not.toHaveBeenCalled();
    expect(() => candidate.useProgram('Mesh')).toThrowError(
      /transaction.*closed/i,
    );
    expect(() => candidate.rollback()).not.toThrow();
    expect(() => candidate.commit()).not.toThrow();
    expect(() => cache.beginRender()).toThrowError(/generation 9.*invalid/i);

    cache.dispose(false);
    expect(recording.deleteProgram).not.toHaveBeenCalled();
    expect(recording.deleteBuffer).not.toHaveBeenCalled();
    expect(recording.deleteVertexArray).not.toHaveBeenCalled();
  });

  it('ordinary disposal deletes the resident-candidate union exactly once', () => {
    const recording = createResourceGL('dispose');
    const cache = new WebGLRendererResourceCache(recording.gl, 2);
    const residentGeometry = triangle();
    const candidateGeometry = indexedTriangle();
    const resident = cache.beginRender();
    const program = resident.useProgram('Mesh');
    const residentResource = resident.useGeometry(residentGeometry, 'Mesh');
    resident.commit();
    const candidate = cache.beginRender();
    candidate.useProgram('Cube');
    candidate.useGeometry(residentGeometry, 'Cube');
    const candidateResource = candidate.useGeometry(candidateGeometry, 'Cube');

    cache.dispose(false);
    cache.dispose(false);
    candidate.rollback();
    candidate.commit();

    expect(recording.deleteProgram.mock.calls.map(([value]) => value)).toEqual([
      program.program,
    ]);
    expect(recording.deleteBuffer.mock.calls.map(([value]) => value)).toEqual([
      residentResource.positionBuffer,
      candidateResource.indexBuffer,
      candidateResource.positionBuffer,
    ]);
    expect(
      recording.deleteVertexArray.mock.calls.map(([value]) => value),
    ).toEqual([residentResource.vertexArray, candidateResource.vertexArray]);
    expect(() => candidate.useGeometry(triangle(8), 'Mesh')).toThrowError(
      /transaction.*closed/i,
    );
    expect(() => cache.beginRender()).toThrowError(/generation 2.*disposed/i);
  });

  it('reports cleanup errors, attempts every later release, and still commits closed', () => {
    const recording = createResourceGL('cleanup-errors');
    const cache = new WebGLRendererResourceCache(recording.gl, 1);
    const transaction = cache.beginRender();
    transaction.useProgram('Mesh');
    transaction.useGeometry(indexedTriangle(), 'Mesh');
    transaction.commit();
    const programError = new Error('program delete failed');
    const indexError = new Error('index delete failed');
    const vertexArrayError = new Error('vertex array delete failed');
    const reported: unknown[] = [];
    vi.spyOn(globalThis, 'reportError').mockImplementation((error) => {
      reported.push(error);
    });
    recording.deleteProgram.mockImplementationOnce(() => {
      throw programError;
    });
    recording.deleteBuffer.mockImplementationOnce(() => {
      throw indexError;
    });
    recording.deleteVertexArray.mockImplementationOnce(() => {
      throw vertexArrayError;
    });

    const empty = cache.beginRender();
    expect(() => empty.commit()).not.toThrow();

    expect(recording.deleteProgram).toHaveBeenCalledOnce();
    expect(recording.deleteBuffer).toHaveBeenCalledTimes(2);
    expect(recording.deleteVertexArray).toHaveBeenCalledOnce();
    expect(reported).toEqual([programError, indexError, vertexArrayError]);
    expect(() => empty.useProgram('Mesh')).toThrowError(/transaction.*closed/i);
    expect(() => cache.beginRender().commit()).not.toThrow();
  });
});

interface ResourceGLControls {
  failShaderAt?: number;
  failProgramCreation?: boolean;
  missingUniform?: string;
  failVertexArray?: boolean;
  failBufferAt?: number;
  throwBufferDataAt?: number;
}

interface OwnedHandle {
  readonly context: string;
  readonly kind: string;
  readonly id: number;
  readonly type?: number;
}

function createResourceGL(context: string, controls: ResourceGLControls = {}) {
  const constants = createConstants();
  const shaders: OwnedHandle[] = [];
  const programs: OwnedHandle[] = [];
  const vertexArrays: OwnedHandle[] = [];
  const buffers: OwnedHandle[] = [];
  let nextHandle = 0;
  let shaderAttempt = 0;
  let bufferAttempt = 0;
  let uploadAttempt = 0;
  const handle = (kind: string, type?: number): OwnedHandle => ({
    context,
    kind,
    id: ++nextHandle,
    type,
  });
  const createShader = vi.fn((type: number) => {
    shaderAttempt += 1;
    if (shaderAttempt === controls.failShaderAt) return null;
    const shader = handle('shader', type);
    shaders.push(shader);
    return shader;
  });
  const deleteShader = vi.fn();
  const createProgram = vi.fn(() => {
    if (controls.failProgramCreation) return null;
    const program = handle('program');
    programs.push(program);
    return program;
  });
  const deleteProgram = vi.fn();
  const createVertexArray = vi.fn(() => {
    if (controls.failVertexArray) return null;
    const vertexArray = handle('vertex-array');
    vertexArrays.push(vertexArray);
    return vertexArray;
  });
  const deleteVertexArray = vi.fn();
  const createBuffer = vi.fn(() => {
    bufferAttempt += 1;
    if (bufferAttempt === controls.failBufferAt) return null;
    const buffer = handle('buffer');
    buffers.push(buffer);
    return buffer;
  });
  const deleteBuffer = vi.fn();
  const uploads: Array<{
    readonly target: number;
    readonly length: number;
    readonly usage: number;
  }> = [];
  const methods: Record<string, unknown> = {
    createShader,
    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    getShaderParameter: vi.fn(() => true),
    getShaderInfoLog: vi.fn(() => ''),
    deleteShader,
    createProgram,
    attachShader: vi.fn(),
    detachShader: vi.fn(),
    linkProgram: vi.fn(),
    getProgramParameter: vi.fn(() => true),
    getProgramInfoLog: vi.fn(() => ''),
    deleteProgram,
    getUniformLocation: vi.fn((_program: object, name: string) =>
      name === controls.missingUniform ? null : { name },
    ),
    createVertexArray,
    deleteVertexArray,
    createBuffer,
    deleteBuffer,
    bufferData: vi.fn(
      (target: number, data: ArrayLike<number>, usage: number) => {
        uploadAttempt += 1;
        if (uploadAttempt === controls.throwBufferDataAt) {
          throw new Error('injected buffer upload failure');
        }
        uploads.push({ target, length: data.length, usage });
      },
    ),
  };
  const gl = new Proxy(
    { ...constants, ...methods },
    {
      get(target, property) {
        if (typeof property !== 'string') return undefined;
        if (property in target) return target[property as keyof typeof target];
        const noop = () => undefined;
        Object.assign(target, { [property]: noop });
        return noop;
      },
    },
  ) as unknown as WebGL2RenderingContext;
  return {
    gl,
    shaders,
    programs,
    vertexArrays,
    buffers,
    uploads,
    createShader,
    deleteShader,
    createProgram,
    deleteProgram,
    createVertexArray,
    deleteVertexArray,
    createBuffer,
    deleteBuffer,
  };
}

function triangle(offset = 0) {
  return createWebGLGeometry({
    positions: [offset, 0, 0, offset + 1, 0, 0, offset, 1, 0],
  });
}

function indexedTriangle() {
  return createWebGLGeometry({
    positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
    indices: [0, 1, 2],
  });
}

function createConstants(): Record<string, number> {
  const names = [
    'ARRAY_BUFFER',
    'COMPILE_STATUS',
    'ELEMENT_ARRAY_BUFFER',
    'FLOAT',
    'FRAGMENT_SHADER',
    'LINK_STATUS',
    'STATIC_DRAW',
    'VERTEX_SHADER',
  ];
  return Object.fromEntries(names.map((name, index) => [name, index + 1]));
}
