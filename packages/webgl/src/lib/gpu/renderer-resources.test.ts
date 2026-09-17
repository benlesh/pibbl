import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWebGLGeometry } from '../geometry/geometry.js';
import { createInternalWebGLTexture } from '../texture/texture.js';
import { WebGLRendererResourceCache } from './renderer-resources.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('WebGLRendererResourceCache', () => {
  it('shares geometry across keyed programs and reuses the successful resident set', () => {
    const recording = createResourceGL('reuse');
    const cache = new WebGLRendererResourceCache(recording.gl, 7);
    const geometry = indexedTriangleWithNormals();

    const first = cache.beginRender();
    const unlit = first.useProgram('unlit', 'Mesh');
    const lambert = first.useProgram('lambert', 'Cube');
    const firstGeometry = first.useGeometry(geometry, 'Mesh');

    expect(first.useProgram('unlit', 'Sphere')).toBe(unlit);
    expect(first.useProgram('lambert', 'Sphere')).toBe(lambert);
    expect(unlit.key).toBe('unlit');
    expect(lambert.key).toBe('lambert');
    expect(lambert).not.toBe(unlit);
    expect(first.useGeometry(geometry, 'Cube')).toBe(firstGeometry);
    expect(recording.createProgram).toHaveBeenCalledTimes(2);
    expect(recording.createVertexArray).toHaveBeenCalledOnce();
    expect(recording.createBuffer).toHaveBeenCalledTimes(3);
    expect(recording.enableVertexAttribArray.mock.calls).toEqual([[0], [1]]);
    expect(recording.vertexAttribPointer.mock.calls).toEqual([
      [0, 3, recording.gl.FLOAT, false, 0, 0],
      [1, 3, recording.gl.FLOAT, false, 0, 0],
    ]);
    first.commit();

    const second = cache.beginRender();
    expect(second.useProgram('lambert', 'Sphere')).toBe(lambert);
    expect(second.useProgram('unlit', 'Sphere')).toBe(unlit);
    expect(second.useGeometry(geometry, 'Sphere')).toBe(firstGeometry);
    second.commit();

    expect(recording.createProgram).toHaveBeenCalledTimes(2);
    expect(recording.createVertexArray).toHaveBeenCalledOnce();
    expect(recording.createBuffer).toHaveBeenCalledTimes(3);
    expect(recording.deleteProgram).not.toHaveBeenCalled();
    expect(recording.deleteBuffer).not.toHaveBeenCalled();
    expect(recording.deleteVertexArray).not.toHaveBeenCalled();
  });

  it('uploads supplied UV0 and tangent buffers and releases every resident handle once', () => {
    const recording = createResourceGL('geometry-streams');
    const cache = new WebGLRendererResourceCache(recording.gl, 8);
    const transaction = cache.beginRender();

    const resource = transaction.useGeometry(
      indexedTriangleWithAllStreams(),
      'Mesh',
    );
    transaction.commit();

    expect(recording.uploads.map(({ target, length, usage }) => ({
      target,
      length,
      usage,
    }))).toEqual([
      { target: recording.gl.ARRAY_BUFFER, length: 9, usage: recording.gl.STATIC_DRAW },
      { target: recording.gl.ARRAY_BUFFER, length: 9, usage: recording.gl.STATIC_DRAW },
      { target: recording.gl.ARRAY_BUFFER, length: 6, usage: recording.gl.STATIC_DRAW },
      { target: recording.gl.ARRAY_BUFFER, length: 12, usage: recording.gl.STATIC_DRAW },
      { target: recording.gl.ELEMENT_ARRAY_BUFFER, length: 3, usage: recording.gl.STATIC_DRAW },
    ]);
    expect(recording.uploads.map(upload => upload.values)).toEqual([
      [0, 0, 0, 1, 0, 0, 0, 1, 0],
      [0, 0, 1, 0, 0, 1, 0, 0, 1],
      [0, 0, 1, 0, 0, 1],
      [1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1],
      [0, 1, 2],
    ]);
    expect(recording.enableVertexAttribArray.mock.calls).toEqual([
      [0], [1], [2], [3],
    ]);
    expect(recording.vertexAttribPointer.mock.calls).toEqual([
      [0, 3, recording.gl.FLOAT, false, 0, 0],
      [1, 3, recording.gl.FLOAT, false, 0, 0],
      [2, 2, recording.gl.FLOAT, false, 0, 0],
      [3, 4, recording.gl.FLOAT, false, 0, 0],
    ]);
    expect(resource.textureCoordinates0Buffer).toBe(recording.buffers[2]);
    expect(resource.tangentBuffer).toBe(recording.buffers[3]);

    cache.beginRender().commit();

    expect(recording.deleteBuffer.mock.calls.map(([value]) => value)).toEqual([
      resource.indexBuffer,
      resource.tangentBuffer,
      resource.textureCoordinates0Buffer,
      resource.normalBuffer,
      resource.positionBuffer,
    ]);
    expect(recording.deleteVertexArray).toHaveBeenCalledExactlyOnceWith(
      resource.vertexArray,
    );
  });

  it('installs deterministic constant UV0 and tangent attributes when streams are omitted', () => {
    const recording = createResourceGL('default-geometry-streams');
    const cache = new WebGLRendererResourceCache(recording.gl, 9);
    const transaction = cache.beginRender();

    const resource = transaction.useGeometry(triangle(), 'Mesh');
    transaction.commit();

    expect(resource.textureCoordinates0Buffer).toBeUndefined();
    expect(resource.tangentBuffer).toBeUndefined();
    expect(recording.createBuffer).toHaveBeenCalledOnce();
    expect(recording.disableVertexAttribArray.mock.calls).toEqual([[2], [3]]);
    expect(recording.vertexAttrib2f.mock.calls).toEqual([[2, 0, 0]]);
    expect(recording.vertexAttrib4f.mock.calls).toEqual([[3, 1, 0, 0, 1]]);
  });

  it('uploads each decoded texture once with isolated pixel-store state and required mipmaps', () => {
    const recording = createResourceGL('decoded-texture');
    const cache = new WebGLRendererResourceCache(recording.gl, 11);
    const bitmap = { width: 4, height: 2, close: vi.fn() } as unknown as ImageBitmap;
    const producer = createInternalWebGLTexture(bitmap, {
      wrapS: 'mirrored-repeat',
      wrapT: 'clamp-to-edge',
      minFilter: 'linear-mipmap-linear',
      magFilter: 'nearest',
    });
    const useTexture = (transaction: ReturnType<typeof cache.beginRender>) =>
      transaction.useTexture(producer.texture, 'ImportedSurface');

    const first = cache.beginRender();
    const resource = useTexture(first);
    expect(useTexture(first)).toBe(resource);
    first.commit();
    const second = cache.beginRender();
    expect(useTexture(second)).toBe(resource);
    second.commit();

    expect(recording.createTexture).toHaveBeenCalledOnce();
    expect(recording.texImage2D).toHaveBeenCalledExactlyOnceWith(
      recording.gl.TEXTURE_2D,
      0,
      recording.gl.RGBA,
      recording.gl.RGBA,
      recording.gl.UNSIGNED_BYTE,
      bitmap,
    );
    expect(recording.texParameteri.mock.calls).toEqual([
      [recording.gl.TEXTURE_2D, recording.gl.TEXTURE_WRAP_S, recording.gl.MIRRORED_REPEAT],
      [recording.gl.TEXTURE_2D, recording.gl.TEXTURE_WRAP_T, recording.gl.CLAMP_TO_EDGE],
      [recording.gl.TEXTURE_2D, recording.gl.TEXTURE_MIN_FILTER, recording.gl.LINEAR_MIPMAP_LINEAR],
      [recording.gl.TEXTURE_2D, recording.gl.TEXTURE_MAG_FILTER, recording.gl.NEAREST],
    ]);
    expect(recording.generateMipmap).toHaveBeenCalledExactlyOnceWith(
      recording.gl.TEXTURE_2D,
    );
    expect(recording.pixelStorei.mock.calls).toEqual([
      [recording.gl.UNPACK_FLIP_Y_WEBGL, false],
      [recording.gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false],
      [recording.gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, recording.gl.NONE],
      [recording.gl.UNPACK_ALIGNMENT, 4],
      [recording.gl.UNPACK_ROW_LENGTH, 0],
      [recording.gl.UNPACK_IMAGE_HEIGHT, 0],
      [recording.gl.UNPACK_SKIP_PIXELS, 0],
      [recording.gl.UNPACK_SKIP_ROWS, 0],
      [recording.gl.UNPACK_SKIP_IMAGES, 0],
      [recording.gl.UNPACK_FLIP_Y_WEBGL, true],
      [recording.gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true],
      [recording.gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, recording.gl.BROWSER_DEFAULT_WEBGL],
      [recording.gl.UNPACK_ALIGNMENT, 8],
      [recording.gl.UNPACK_ROW_LENGTH, 9],
      [recording.gl.UNPACK_IMAGE_HEIGHT, 10],
      [recording.gl.UNPACK_SKIP_PIXELS, 11],
      [recording.gl.UNPACK_SKIP_ROWS, 12],
      [recording.gl.UNPACK_SKIP_IMAGES, 13],
    ]);

    cache.dispose(false);
    producer.release();
  });

  it('rolls back a failed texture candidate without disturbing the resident generation', () => {
    const controls: ResourceGLControls = {};
    const recording = createResourceGL('texture-rollback', controls);
    const cache = new WebGLRendererResourceCache(recording.gl, 12);
    const resident = createInternalWebGLTexture({
      width: 1,
      height: 1,
      close: vi.fn(),
    } as unknown as ImageBitmap);
    const failed = createInternalWebGLTexture({
      width: 1,
      height: 1,
      close: vi.fn(),
    } as unknown as ImageBitmap);
    const initial = cache.beginRender();
    const residentResource = initial.useTexture(resident.texture, 'Resident');
    initial.commit();
    expect(recording.generateMipmap).not.toHaveBeenCalled();

    controls.throwTexImage2DAt = 2;
    const candidate = cache.beginRender();
    expect(candidate.useTexture(resident.texture, 'Resident'))
      .toBe(residentResource);
    expect(() => candidate.useTexture(failed.texture, 'Failed'))
      .toThrow('Failed texture upload failed.');
    candidate.rollback();

    expect(recording.deleteTexture.mock.calls.map(([texture]) => texture))
      .toEqual([recording.textures[1]]);
    const retry = cache.beginRender();
    expect(retry.useTexture(resident.texture, 'Resident'))
      .toBe(residentResource);
    retry.commit();
    expect(recording.createTexture).toHaveBeenCalledTimes(2);

    cache.beginRender().commit();
    expect(recording.deleteTexture.mock.calls.map(([texture]) => texture))
      .toEqual([recording.textures[1], recording.textures[0]]);
    cache.dispose(false);
    resident.release();
    failed.release();
  });

  it('abandons lost texture handles and uploads the retained identity in a new generation', () => {
    const recording = createResourceGL('texture-restoration');
    const producer = createInternalWebGLTexture({
      width: 1,
      height: 1,
      close: vi.fn(),
    } as unknown as ImageBitmap);
    const lost = new WebGLRendererResourceCache(recording.gl, 13);
    const initial = lost.beginRender();
    initial.useTexture(producer.texture, 'ImportedSurface');
    initial.commit();

    lost.invalidateContext();
    lost.dispose(true);
    expect(recording.deleteTexture).not.toHaveBeenCalled();

    const restored = new WebGLRendererResourceCache(recording.gl, 14);
    const next = restored.beginRender();
    next.useTexture(producer.texture, 'ImportedSurface');
    next.commit();
    expect(recording.createTexture).toHaveBeenCalledTimes(2);
    restored.dispose(false);
    expect(recording.deleteTexture).toHaveBeenCalledExactlyOnceWith(
      recording.textures[1],
    );
    producer.release();
  });

  it('sweeps omitted program and geometry keys before clearing the remaining residents', () => {
    const recording = createResourceGL('sweep');
    const cache = new WebGLRendererResourceCache(recording.gl, 1);
    const keptGeometry = triangle();
    const omittedGeometry = indexedTriangleWithNormals();
    const initial = cache.beginRender();
    const unlit = initial.useProgram('unlit', 'Mesh');
    const lambert = initial.useProgram('lambert', 'Cube');
    const kept = initial.useGeometry(keptGeometry, 'Mesh');
    const omitted = initial.useGeometry(omittedGeometry, 'Mesh');
    expect(kept.normalBuffer).toBeUndefined();
    expect(omitted.normalBuffer).toBeDefined();
    initial.commit();

    const reduced = cache.beginRender();
    expect(reduced.useProgram('lambert', 'Cube')).toBe(lambert);
    expect(reduced.useGeometry(keptGeometry, 'Cube')).toBe(kept);
    reduced.commit();

    expect(recording.deleteBuffer.mock.calls.map(([value]) => value)).toEqual([
      omitted.indexBuffer,
      omitted.normalBuffer,
      omitted.positionBuffer,
    ]);
    expect(recording.deleteVertexArray).toHaveBeenCalledExactlyOnceWith(
      omitted.vertexArray,
    );
    expect(recording.deleteProgram).toHaveBeenCalledExactlyOnceWith(
      unlit.program,
    );

    cache.beginRender().commit();

    expect(recording.deleteProgram.mock.calls.map(([value]) => value)).toEqual([
      unlit.program,
      lambert.program,
    ]);
    expect(recording.deleteBuffer.mock.calls.map(([value]) => value)).toEqual([
      omitted.indexBuffer,
      omitted.normalBuffer,
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
    expect(() => committed.useProgram('unlit', 'Mesh')).toThrowError(
      /transaction.*closed/i,
    );
    expect(() => committed.useGeometry(triangle(), 'Mesh')).toThrowError(
      /transaction.*closed/i,
    );
    expect(() => committed.commit()).not.toThrow();
    expect(() => committed.rollback()).not.toThrow();

    const rolledBack = cache.beginRender();
    rolledBack.rollback();
    expect(() => rolledBack.useProgram('unlit', 'Mesh')).toThrowError(
      /transaction.*closed/i,
    );
  });

  it('rolls back candidate-only handles after a later upload failure and retains resident reuse', () => {
    const controls: ResourceGLControls = {};
    const recording = createResourceGL('rollback', controls);
    const cache = new WebGLRendererResourceCache(recording.gl, 1);
    const residentGeometry = triangle();
    const candidateGeometry = indexedTriangleWithNormals(2);
    const failedGeometry = triangle(4);
    const initial = cache.beginRender();
    const residentProgram = initial.useProgram('unlit', 'Mesh');
    const resident = initial.useGeometry(residentGeometry, 'Mesh');
    initial.commit();

    controls.throwBufferDataAt = 5;
    const candidate = cache.beginRender();
    expect(candidate.useProgram('unlit', 'Cube')).toBe(residentProgram);
    const candidateProgram = candidate.useProgram('lambert', 'Cube');
    expect(candidate.useGeometry(residentGeometry, 'Cube')).toBe(resident);
    const created = candidate.useGeometry(candidateGeometry, 'Cube');
    expect(() => candidate.useGeometry(failedGeometry, 'Sphere')).toThrowError(
      /Sphere.*geometry upload failed/i,
    );
    candidate.rollback();

    expect(recording.deleteBuffer.mock.calls.map(([value]) => value)).toEqual([
      recording.buffers[4],
      created.indexBuffer,
      created.normalBuffer,
      created.positionBuffer,
    ]);
    expect(
      recording.deleteVertexArray.mock.calls.map(([value]) => value),
    ).toEqual([recording.vertexArrays[2], created.vertexArray]);
    expect(recording.deleteProgram).toHaveBeenCalledExactlyOnceWith(
      candidateProgram.program,
    );
    expect(recording.deleteBuffer).not.toHaveBeenCalledWith(
      resident.positionBuffer,
    );
    expect(recording.deleteVertexArray).not.toHaveBeenCalledWith(
      resident.vertexArray,
    );

    const next = cache.beginRender();
    expect(next.useProgram('unlit', 'Mesh')).toBe(residentProgram);
    expect(next.useGeometry(residentGeometry, 'Mesh')).toBe(resident);
    next.commit();
    expect(recording.createProgram).toHaveBeenCalledTimes(2);
    expect(recording.createVertexArray).toHaveBeenCalledTimes(3);
  });

  it('rolls back an initial candidate program and geometry by exact handle', () => {
    const recording = createResourceGL('initial-rollback');
    const cache = new WebGLRendererResourceCache(recording.gl, 1);
    const geometry = indexedTriangleWithNormals();
    const candidate = cache.beginRender();
    const unlit = candidate.useProgram('unlit', 'Mesh');
    const lambert = candidate.useProgram('lambert', 'Cube');
    const resource = candidate.useGeometry(geometry, 'Mesh');

    candidate.rollback();

    expect(recording.deleteProgram.mock.calls.map(([value]) => value)).toEqual([
      unlit.program,
      lambert.program,
    ]);
    expect(recording.deleteBuffer.mock.calls.map(([value]) => value)).toEqual([
      resource.indexBuffer,
      resource.normalBuffer,
      resource.positionBuffer,
    ]);
    expect(
      recording.deleteVertexArray.mock.calls.map(([value]) => value),
    ).toEqual([resource.vertexArray]);

    const retry = cache.beginRender();
    expect(retry.useProgram('unlit', 'Mesh')).not.toBe(unlit);
    expect(retry.useProgram('lambert', 'Mesh')).not.toBe(lambert);
    expect(retry.useGeometry(geometry, 'Mesh')).not.toBe(resource);
    retry.rollback();
    expect(recording.createProgram).toHaveBeenCalledTimes(4);
    expect(recording.createVertexArray).toHaveBeenCalledTimes(2);
    expect(recording.deleteProgram).toHaveBeenCalledTimes(4);
    expect(recording.deleteBuffer).toHaveBeenCalledTimes(6);
    expect(recording.deleteVertexArray).toHaveBeenCalledTimes(2);
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
      controls: { missingUniform: 'u_projection' },
      deletedShaders: 2,
      deletedPrograms: 1,
    },
  ])(
    'cleans partial $name exactly once without publishing it',
    ({ controls, deletedShaders, deletedPrograms }) => {
      const recording = createResourceGL('partial-program', controls);
      const cache = new WebGLRendererResourceCache(recording.gl, 1);
      const transaction = cache.beginRender();

      expect(() => transaction.useProgram('unlit', 'BrokenMesh')).toThrowError(
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

  it('deletes every candidate buffer when the third stream upload fails', () => {
    const operationalError = new Error('tangent upload failed');
    const recording = createResourceGL('third-stream-upload', {
      throwBufferDataAt: 3,
      bufferDataError: operationalError,
    });
    const cache = new WebGLRendererResourceCache(recording.gl, 10);
    const transaction = cache.beginRender();

    let caught: unknown;
    try {
      transaction.useGeometry(geometryWithUvsAndTangents(), 'BrokenMesh');
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).cause).toBe(operationalError);
    expect(recording.deleteBuffer.mock.calls.map(([value]) => value)).toEqual(
      recording.buffers.slice().reverse(),
    );
    expect(recording.deleteVertexArray.mock.calls.map(([value]) => value)).toEqual(
      recording.vertexArrays,
    );
    transaction.rollback();
    cache.dispose(false);
    expect(recording.deleteBuffer).toHaveBeenCalledTimes(3);
    expect(recording.deleteVertexArray).toHaveBeenCalledOnce();
  });

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
      name: 'normal buffer creation',
      controls: { failBufferAt: 2 },
      createdBuffers: 1,
      deletedBuffers: 1,
      deletedVertexArrays: 1,
    },
    {
      name: 'index buffer creation',
      controls: { failBufferAt: 3 },
      createdBuffers: 2,
      deletedBuffers: 2,
      deletedVertexArrays: 1,
    },
  ])(
    'cleans partial $name exactly once without publishing it',
    ({ controls, createdBuffers, deletedBuffers, deletedVertexArrays }) => {
      const recording = createResourceGL('partial-geometry', controls);
      const cache = new WebGLRendererResourceCache(recording.gl, 1);
      const transaction = cache.beginRender();

      expect(() =>
        transaction.useGeometry(indexedTriangleWithNormals(), 'BrokenCube'),
      ).toThrowError(/BrokenCube.*geometry.*creation failed/i);
      expect(recording.buffers).toHaveLength(createdBuffers);
      expect(recording.deleteBuffer.mock.calls.map(([value]) => value)).toEqual(
        recording.buffers.slice(0, deletedBuffers).reverse(),
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

  it.each([
    { name: 'position', throwBufferDataAt: 1 },
    { name: 'normal', throwBufferDataAt: 2 },
    { name: 'index', throwBufferDataAt: 3 },
  ])(
    'cleans every owned handle after a healthy $name upload failure',
    ({ name, throwBufferDataAt }) => {
      const operationalError = new Error(`${name} upload failed`);
      const recording = createResourceGL('failed-upload', {
        throwBufferDataAt,
        bufferDataError: operationalError,
      });
      const cache = new WebGLRendererResourceCache(recording.gl, 1);
      const transaction = cache.beginRender();

      let caught: unknown;
      try {
        transaction.useGeometry(indexedTriangleWithNormals(), 'BrokenCube');
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(Error);
      expect((caught as Error).cause).toBe(operationalError);
      expect(recording.deleteBuffer.mock.calls.map(([value]) => value)).toEqual(
        recording.buffers.slice().reverse(),
      );
      expect(
        recording.deleteVertexArray.mock.calls.map(([value]) => value),
      ).toEqual(recording.vertexArrays);
      transaction.rollback();
      cache.dispose(false);
      expect(recording.deleteBuffer).toHaveBeenCalledTimes(3);
      expect(recording.deleteVertexArray).toHaveBeenCalledOnce();
    },
  );

  it('abandons partial geometry handles when later buffer creation returns null after loss', () => {
    const recording = createResourceGL('lost-buffer-creation', {
      failBufferAt: 2,
      contextLostOnFailedCreation: true,
    });
    const cache = new WebGLRendererResourceCache(recording.gl, 4);
    const transaction = cache.beginRender();

    let returned: unknown;
    let caught: unknown;
    try {
      returned = transaction.useGeometry(
        indexedTriangleWithNormals(),
        'LostCube',
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toMatch(
      /LostCube.*normal buffer creation failed/i,
    );
    expect(returned).toBeUndefined();
    expect(recording.vertexArrays).toHaveLength(1);
    expect(recording.buffers).toHaveLength(1);
    expect(recording.deleteBuffer).not.toHaveBeenCalled();
    expect(recording.deleteVertexArray).not.toHaveBeenCalled();

    transaction.commit();
    cache.dispose(false);
    expect(recording.deleteBuffer).not.toHaveBeenCalled();
    expect(recording.deleteVertexArray).not.toHaveBeenCalled();
  });

  it('rejects normally uploaded geometry when the context becomes lost before publication', () => {
    const recording = createResourceGL('lost-after-upload', {
      loseContextAfterBufferDataAt: 3,
    });
    const cache = new WebGLRendererResourceCache(recording.gl, 5);
    const transaction = cache.beginRender();

    let returned: unknown;
    let caught: unknown;
    try {
      returned = transaction.useGeometry(
        indexedTriangleWithNormals(),
        'LostSphere',
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toMatch(
      /LostSphere.*geometry.*context.*lost/i,
    );
    expect(returned).toBeUndefined();
    expect(recording.uploads.map(({ target, length, usage }) => ({
      target,
      length,
      usage,
    }))).toEqual([
      {
        target: recording.gl.ARRAY_BUFFER,
        length: 9,
        usage: recording.gl.STATIC_DRAW,
      },
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
    expect(recording.vertexArrays).toHaveLength(1);
    expect(recording.buffers).toHaveLength(3);
    expect(recording.deleteBuffer).not.toHaveBeenCalled();
    expect(recording.deleteVertexArray).not.toHaveBeenCalled();

    transaction.commit();
    cache.dispose(false);
    expect(recording.deleteBuffer).not.toHaveBeenCalled();
    expect(recording.deleteVertexArray).not.toHaveBeenCalled();
  });

  it('abandons normally uploaded geometry when publication context validation fails', () => {
    const detectionError = new Error('isContextLost failed');
    const recording = createResourceGL('failed-publication-check', {
      contextLossCheckError: detectionError,
    });
    const cache = new WebGLRendererResourceCache(recording.gl, 6);
    const transaction = cache.beginRender();

    let returned: unknown;
    let caught: unknown;
    try {
      returned = transaction.useGeometry(triangle(), 'UnknownCube');
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toMatch(
      /UnknownCube.*geometry.*context validation failed/i,
    );
    expect((caught as Error).cause).toBe(detectionError);
    expect(returned).toBeUndefined();
    expect(recording.deleteBuffer).not.toHaveBeenCalled();
    expect(recording.deleteVertexArray).not.toHaveBeenCalled();

    transaction.commit();
    cache.dispose(false);
    expect(recording.deleteBuffer).not.toHaveBeenCalled();
    expect(recording.deleteVertexArray).not.toHaveBeenCalled();
  });

  it('preserves an upload failure when context-loss detection itself fails', () => {
    const operationalError = new Error('position upload failed');
    const detectionError = new Error('isContextLost failed');
    const reported: unknown[] = [];
    vi.spyOn(globalThis, 'reportError').mockImplementation((error) => {
      reported.push(error);
    });
    const recording = createResourceGL('failed-loss-check', {
      throwBufferDataAt: 1,
      bufferDataError: operationalError,
      contextLossCheckError: detectionError,
    });
    const cache = new WebGLRendererResourceCache(recording.gl, 5);
    const transaction = cache.beginRender();

    let caught: unknown;
    try {
      transaction.useGeometry(triangle(), 'BrokenCube');
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).cause).toBe(operationalError);
    expect(reported).toEqual([detectionError]);
    expect(recording.deleteBuffer).not.toHaveBeenCalled();
    expect(recording.deleteVertexArray).not.toHaveBeenCalled();
    transaction.rollback(true);
  });

  it('preserves an upload failure when healthy-context cleanup itself fails', () => {
    const operationalError = new Error('position upload failed');
    const cleanupError = new Error('buffer deletion failed');
    const reported: unknown[] = [];
    vi.spyOn(globalThis, 'reportError').mockImplementation((error) => {
      reported.push(error);
    });
    const recording = createResourceGL('failed-cleanup', {
      throwBufferDataAt: 1,
      bufferDataError: operationalError,
      deleteBufferError: cleanupError,
    });
    const cache = new WebGLRendererResourceCache(recording.gl, 6);
    const transaction = cache.beginRender();

    let caught: unknown;
    try {
      transaction.useGeometry(triangle(), 'BrokenCube');
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).cause).toBe(operationalError);
    expect(recording.deleteBuffer).toHaveBeenCalledOnce();
    expect(recording.deleteVertexArray).toHaveBeenCalledOnce();
    expect(reported).toEqual([cleanupError]);
    transaction.rollback();
  });

  it('invalidates resident and candidate records during a transaction without GL deletion', () => {
    const recording = createResourceGL('lost');
    const cache = new WebGLRendererResourceCache(recording.gl, 9);
    const residentGeometry = triangle();
    const candidateGeometry = indexedTriangleWithNormals();
    const resident = cache.beginRender();
    resident.useProgram('unlit', 'Mesh');
    resident.useGeometry(residentGeometry, 'Mesh');
    resident.commit();
    const candidate = cache.beginRender();
    candidate.useProgram('lambert', 'Mesh');
    candidate.useGeometry(candidateGeometry, 'Cube');

    cache.invalidateContext();
    expect(recording.deleteProgram).not.toHaveBeenCalled();
    expect(recording.deleteBuffer).not.toHaveBeenCalled();
    expect(recording.deleteVertexArray).not.toHaveBeenCalled();
    expect(() => candidate.useProgram('unlit', 'Mesh')).toThrowError(
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
    const candidateGeometry = indexedTriangleWithNormals();
    const resident = cache.beginRender();
    const unlit = resident.useProgram('unlit', 'Mesh');
    const residentResource = resident.useGeometry(residentGeometry, 'Mesh');
    resident.commit();
    const candidate = cache.beginRender();
    const lambert = candidate.useProgram('lambert', 'Cube');
    candidate.useGeometry(residentGeometry, 'Cube');
    const candidateResource = candidate.useGeometry(candidateGeometry, 'Cube');

    cache.dispose(false);
    cache.dispose(false);
    candidate.rollback();
    candidate.commit();

    expect(recording.deleteProgram.mock.calls.map(([value]) => value)).toEqual([
      unlit.program,
      lambert.program,
    ]);
    expect(recording.deleteBuffer.mock.calls.map(([value]) => value)).toEqual([
      residentResource.positionBuffer,
      candidateResource.indexBuffer,
      candidateResource.normalBuffer,
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
    transaction.useProgram('unlit', 'Mesh');
    transaction.useGeometry(indexedTriangleWithNormals(), 'Mesh');
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
    expect(recording.deleteBuffer).toHaveBeenCalledTimes(3);
    expect(recording.deleteVertexArray).toHaveBeenCalledOnce();
    expect(reported).toEqual([programError, indexError, vertexArrayError]);
    expect(() => empty.useProgram('unlit', 'Mesh')).toThrowError(
      /transaction.*closed/i,
    );
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
  bufferDataError?: Error;
  contextLostAfterOperationalFailure?: boolean;
  contextLostOnFailedCreation?: boolean;
  loseContextAfterBufferDataAt?: number;
  contextLossCheckError?: Error;
  deleteBufferError?: Error;
  throwTexImage2DAt?: number;
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
  const textures: OwnedHandle[] = [];
  let nextHandle = 0;
  let shaderAttempt = 0;
  let bufferAttempt = 0;
  let uploadAttempt = 0;
  let textureUploadAttempt = 0;
  let contextLost = false;
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
    if (controls.failVertexArray) {
      if (controls.contextLostOnFailedCreation) contextLost = true;
      return null;
    }
    const vertexArray = handle('vertex-array');
    vertexArrays.push(vertexArray);
    return vertexArray;
  });
  const deleteVertexArray = vi.fn();
  const createBuffer = vi.fn(() => {
    bufferAttempt += 1;
    if (bufferAttempt === controls.failBufferAt) {
      if (controls.contextLostOnFailedCreation) contextLost = true;
      return null;
    }
    const buffer = handle('buffer');
    buffers.push(buffer);
    return buffer;
  });
  const deleteBuffer = vi.fn((_buffer: OwnedHandle) => {
    if (controls.deleteBufferError) throw controls.deleteBufferError;
  });
  const bindBuffer = vi.fn();
  const enableVertexAttribArray = vi.fn();
  const disableVertexAttribArray = vi.fn();
  const vertexAttribPointer = vi.fn();
  const vertexAttrib2f = vi.fn();
  const vertexAttrib4f = vi.fn();
  const createTexture = vi.fn(() => {
    const texture = handle('texture');
    textures.push(texture);
    return texture;
  });
  const deleteTexture = vi.fn();
  const texParameteri = vi.fn();
  const texImage2D = vi.fn(() => {
    textureUploadAttempt += 1;
    if (textureUploadAttempt === controls.throwTexImage2DAt) {
      throw new Error('injected texture upload failure');
    }
  });
  const generateMipmap = vi.fn();
  const pixelStorei = vi.fn();
  const uploads: Array<{
    readonly target: number;
    readonly length: number;
    readonly usage: number;
    readonly values: readonly number[];
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
    bindBuffer,
    enableVertexAttribArray,
    disableVertexAttribArray,
    vertexAttribPointer,
    vertexAttrib2f,
    vertexAttrib4f,
    bufferData: vi.fn(
      (target: number, data: ArrayLike<number>, usage: number) => {
        uploadAttempt += 1;
        if (uploadAttempt === controls.throwBufferDataAt) {
          contextLost =
            controls.contextLostAfterOperationalFailure === true;
          throw (
            controls.bufferDataError ??
            new Error('injected buffer upload failure')
          );
        }
        uploads.push({
          target,
          length: data.length,
          usage,
          values: Array.from(data),
        });
        if (uploadAttempt === controls.loseContextAfterBufferDataAt) {
          contextLost = true;
        }
      },
    ),
    createTexture,
    deleteTexture,
    bindTexture: vi.fn(),
    texParameteri,
    texImage2D,
    generateMipmap,
    pixelStorei,
    getParameter: vi.fn((parameter: number) => {
      const values = new Map<number, number | boolean>([
        [constants.UNPACK_FLIP_Y_WEBGL, true],
        [constants.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true],
        [constants.UNPACK_COLORSPACE_CONVERSION_WEBGL, constants.BROWSER_DEFAULT_WEBGL],
        [constants.UNPACK_ALIGNMENT, 8],
        [constants.UNPACK_ROW_LENGTH, 9],
        [constants.UNPACK_IMAGE_HEIGHT, 10],
        [constants.UNPACK_SKIP_PIXELS, 11],
        [constants.UNPACK_SKIP_ROWS, 12],
        [constants.UNPACK_SKIP_IMAGES, 13],
      ]);
      return values.get(parameter);
    }),
    isContextLost: vi.fn(() => {
      if (controls.contextLossCheckError) {
        throw controls.contextLossCheckError;
      }
      return contextLost;
    }),
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
    bindBuffer,
    enableVertexAttribArray,
    disableVertexAttribArray,
    vertexAttribPointer,
    vertexAttrib2f,
    vertexAttrib4f,
    textures,
    createTexture,
    deleteTexture,
    texParameteri,
    texImage2D,
    generateMipmap,
    pixelStorei,
  };
}

function triangle(offset = 0) {
  return createWebGLGeometry({
    positions: [offset, 0, 0, offset + 1, 0, 0, offset, 1, 0],
  });
}

function indexedTriangleWithNormals(offset = 0) {
  return createWebGLGeometry({
    positions: [offset, 0, 0, offset + 1, 0, 0, offset, 1, 0],
    normals: [0, 0, 1, 0, 0, 1, 0, 0, 1],
    indices: [0, 1, 2],
  });
}

function geometryWithUvsAndTangents(offset = 0) {
  return createWebGLGeometry({
    positions: [offset, 0, 0, offset + 1, 0, 0, offset, 1, 0],
    textureCoordinates0: [0, 0, 1, 0, 0, 1],
    tangents: [1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1],
  });
}

function indexedTriangleWithAllStreams(offset = 0) {
  return createWebGLGeometry({
    positions: [offset, 0, 0, offset + 1, 0, 0, offset, 1, 0],
    normals: [0, 0, 1, 0, 0, 1, 0, 0, 1],
    textureCoordinates0: [0, 0, 1, 0, 0, 1],
    tangents: [1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1],
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
    'TEXTURE_2D',
    'TEXTURE_WRAP_S',
    'TEXTURE_WRAP_T',
    'TEXTURE_MIN_FILTER',
    'TEXTURE_MAG_FILTER',
    'REPEAT',
    'CLAMP_TO_EDGE',
    'MIRRORED_REPEAT',
    'NEAREST',
    'LINEAR',
    'NEAREST_MIPMAP_NEAREST',
    'LINEAR_MIPMAP_NEAREST',
    'NEAREST_MIPMAP_LINEAR',
    'LINEAR_MIPMAP_LINEAR',
    'RGBA',
    'UNSIGNED_BYTE',
    'NONE',
    'BROWSER_DEFAULT_WEBGL',
    'UNPACK_FLIP_Y_WEBGL',
    'UNPACK_PREMULTIPLY_ALPHA_WEBGL',
    'UNPACK_COLORSPACE_CONVERSION_WEBGL',
    'UNPACK_ALIGNMENT',
    'UNPACK_ROW_LENGTH',
    'UNPACK_IMAGE_HEIGHT',
    'UNPACK_SKIP_PIXELS',
    'UNPACK_SKIP_ROWS',
    'UNPACK_SKIP_IMAGES',
    'VERTEX_SHADER',
  ];
  return Object.fromEntries(names.map((name, index) => [name, index + 1]));
}
