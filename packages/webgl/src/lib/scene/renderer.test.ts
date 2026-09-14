import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWebGLGeometry } from '../geometry/geometry.js';
import type { SettledWebGLMesh, SettledWebGLScene } from './settle.js';
import { WebGLSceneRenderer } from './renderer.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('WebGLSceneRenderer', () => {
  it('constructs without GL work and renders settled opaque and transparent queues exactly once', () => {
    const recording = createRendererGL();
    const renderer = new WebGLSceneRenderer(recording.gl, 7);
    const opaqueFirst = mesh(0, [1, 0, 0, 1]);
    const opaqueSecond = mesh(1, [0, 1, 0, 1]);
    const transparentFar = mesh(4, [0, 0, 1, 0.25]);
    const transparentNear = mesh(2, [1, 1, 0, 0.5]);
    const invisible = mesh(3, [1, 0, 1, 0]);

    expect(recording.operations).toEqual([]);

    renderer.render(
      scene({
        meshes: [
          opaqueFirst,
          opaqueSecond,
          transparentNear,
          invisible,
          transparentFar,
        ],
        opaque: [opaqueFirst, opaqueSecond],
        transparent: [transparentFar, transparentNear],
      }),
    );

    expect(recording.getParameter).toHaveBeenCalledOnce();
    expect(recording.clear.mock.calls).toEqual([
      [recording.gl.COLOR_BUFFER_BIT | recording.gl.DEPTH_BUFFER_BIT],
    ]);
    expect(recording.draws.map(draw => draw.color)).toEqual([
      opaqueFirst.color,
      opaqueSecond.color,
      transparentFar.color,
      transparentNear.color,
    ]);
    expect(recording.draws.slice(0, 2)).toMatchObject([
      { blend: false, depthTest: true, depthMask: true },
      { blend: false, depthTest: true, depthMask: true },
    ]);
    expect(recording.draws.slice(2)).toMatchObject([
      {
        blend: true,
        blendFunction: [
          recording.gl.SRC_ALPHA,
          recording.gl.ONE_MINUS_SRC_ALPHA,
          recording.gl.ONE,
          recording.gl.ONE_MINUS_SRC_ALPHA,
        ],
        depthTest: true,
        depthMask: false,
      },
      {
        blend: true,
        blendFunction: [
          recording.gl.SRC_ALPHA,
          recording.gl.ONE_MINUS_SRC_ALPHA,
          recording.gl.ONE,
          recording.gl.ONE_MINUS_SRC_ALPHA,
        ],
        depthTest: true,
        depthMask: false,
      },
    ]);
    expect(
      recording.draws.every(draw => draw.depthFunction === recording.gl.LEQUAL),
    ).toBe(true);
    expect(recording.createVertexArray).toHaveBeenCalledTimes(4);
    expect(recording.bindFramebuffer.mock.calls).toEqual([
      [recording.gl.FRAMEBUFFER, null],
      [recording.gl.FRAMEBUFFER, null],
    ]);
    expect(indexOf(recording.operations, 'bindFramebuffer')).toBeLessThan(
      indexOf(recording.operations, 'clear'),
    );
    expect(
      lastIndexOf(recording.operations, 'bindFramebuffer'),
    ).toBeGreaterThan(lastIndexOf(recording.operations, 'drawArrays'));
    expect(recording.readPixels).not.toHaveBeenCalled();
    expect(recording.createFramebuffer).not.toHaveBeenCalled();
  });

  it('binds exact settled matrices and colors for non-indexed and indexed geometry', () => {
    const recording = createRendererGL();
    const renderer = new WebGLSceneRenderer(recording.gl, 7);
    const nonIndexed = mesh(0, [0.1, 0.2, 0.3, 1], false, 11);
    const indexed = mesh(1, [0.4, 0.5, 0.6, 0.7], true, 31);
    const settled = scene({
      meshes: [nonIndexed, indexed],
      opaque: [nonIndexed],
      transparent: [indexed],
    });

    renderer.render(settled);

    expect(recording.drawArrays).toHaveBeenCalledExactlyOnceWith(
      recording.gl.TRIANGLES,
      0,
      nonIndexed.geometry.vertexCount,
    );
    expect(recording.drawElements).toHaveBeenCalledExactlyOnceWith(
      recording.gl.TRIANGLES,
      3,
      recording.gl.UNSIGNED_INT,
      0,
    );
    expect(recording.draws).toMatchObject([
      {
        model: Array.from(nonIndexed.model),
        view: Array.from(settled.camera.viewMatrix),
        projection: Array.from(settled.camera.projectionMatrix),
        color: nonIndexed.color,
      },
      {
        model: Array.from(indexed.model),
        view: Array.from(settled.camera.viewMatrix),
        projection: Array.from(settled.camera.projectionMatrix),
        color: indexed.color,
      },
    ]);
  });

  it('rejects a scene from another context generation before any GL work', () => {
    const recording = createRendererGL();
    const renderer = new WebGLSceneRenderer(recording.gl, 8);

    expect(() => renderer.render(scene({ contextGeneration: 7 }))).toThrowError(
      /scene.*generation 7.*renderer.*generation 8/i,
    );
    expect(recording.operations).toEqual([]);
  });

  it('does not retain a failed baseline capability read', () => {
    const failure = new Error('capability read failed');
    const recording = createRendererGL({
      throws: [{ operation: 'getParameter', at: 1, error: failure }],
    });
    const renderer = new WebGLSceneRenderer(recording.gl, 7);

    expect(() => renderer.render(scene())).toThrow(failure);
    expect(recording.bindFramebuffer).not.toHaveBeenCalled();
    expect(recording.createProgram).not.toHaveBeenCalled();

    renderer.render(scene());
    expect(recording.getParameter).toHaveBeenCalledTimes(2);
  });

  it.each([
    { name: 'clear', operation: 'clear', at: 1, programs: 0, geometries: 0 },
    {
      name: 'program acquisition',
      operation: 'createProgram',
      at: 1,
      programs: 0,
      geometries: 0,
    },
    {
      name: 'geometry upload',
      operation: 'bufferData',
      at: 1,
      programs: 1,
      geometries: 1,
    },
    {
      name: 'first draw',
      operation: 'drawArrays',
      at: 1,
      programs: 1,
      geometries: 1,
    },
    {
      name: 'second draw',
      operation: 'drawArrays',
      at: 2,
      programs: 1,
      geometries: 2,
    },
    {
      name: 'final baseline restoration',
      operation: 'bindFramebuffer',
      at: 2,
      programs: 1,
      geometries: 2,
    },
  ])(
    'rolls back resources and retries the baseline after $name fails',
    ({ operation, at, programs, geometries }) => {
      const failure = new Error(`${operation} failed`);
      const recording = createRendererGL({
        throws: [{ operation, at, error: failure }],
      });
      const renderer = new WebGLSceneRenderer(recording.gl, 7);
      const first = mesh(0, [1, 0, 0, 1]);
      const second = mesh(1, [0, 1, 0, 1]);

      const render = () =>
        renderer.render(
          scene({
            meshes: [first, second],
            opaque: [first, second],
          }),
        );
      let thrown: unknown;
      try {
        render();
      } catch (error) {
        thrown = error;
      }
      if (operation === 'bufferData') {
        expect(thrown).toBeInstanceOf(Error);
        expect((thrown as Error).message).toMatch(
          /Mesh0.*geometry upload failed/i,
        );
        expect((thrown as Error).cause).toBe(failure);
      } else {
        expect(thrown).toBe(failure);
      }

      expect(
        recording.bindFramebuffer.mock.calls.length,
      ).toBeGreaterThanOrEqual(2);
      expect(recording.deleteProgram).toHaveBeenCalledTimes(programs);
      expect(recording.deleteVertexArray).toHaveBeenCalledTimes(geometries);
      expect(indexOf(recording.operations, 'bindFramebuffer')).toBeLessThan(
        lastIndexOf(recording.operations, 'pixelStorei'),
      );
      expect(() => renderer.render(scene())).not.toThrow();
    },
  );

  it('keeps the draw failure authoritative while reporting cleanup failures and attempting later cleanup', () => {
    const drawFailure = new Error('draw failed');
    const programCleanupFailure = new Error('program cleanup failed');
    const bufferCleanupFailure = new Error('buffer cleanup failed');
    const restoreFailure = new Error('restore failed');
    const recording = createRendererGL({
      throws: [
        { operation: 'drawArrays', at: 1, error: drawFailure },
        { operation: 'deleteProgram', at: 1, error: programCleanupFailure },
        { operation: 'deleteBuffer', at: 1, error: bufferCleanupFailure },
        { operation: 'bindFramebuffer', at: 2, error: restoreFailure },
      ],
    });
    const reported: unknown[] = [];
    vi.spyOn(globalThis, 'reportError').mockImplementation(error => {
      reported.push(error);
    });
    const renderer = new WebGLSceneRenderer(recording.gl, 7);
    const drawable = mesh(0, [1, 0, 0, 1]);

    expect(() =>
      renderer.render(
        scene({
          meshes: [drawable],
          opaque: [drawable],
        }),
      ),
    ).toThrow(drawFailure);

    expect(reported).toEqual([
      programCleanupFailure,
      bufferCleanupFailure,
      restoreFailure,
    ]);
    expect(recording.deleteVertexArray).toHaveBeenCalledOnce();
    expect(lastIndexOf(recording.operations, 'pixelStorei')).toBeGreaterThan(
      lastIndexOf(recording.operations, 'bindFramebuffer'),
    );
  });

  it('does not restore or delete lost-generation handles after an operational failure', () => {
    const failure = new Error('context-losing draw failed');
    const recording = createRendererGL({
      loseContextAt: { operation: 'drawArrays', at: 1 },
      throws: [{ operation: 'drawArrays', at: 1, error: failure }],
    });
    const renderer = new WebGLSceneRenderer(recording.gl, 7);
    const drawable = mesh(0, [1, 0, 0, 1]);

    expect(() =>
      renderer.render(
        scene({
          meshes: [drawable],
          opaque: [drawable],
        }),
      ),
    ).toThrow(failure);

    expect(recording.bindFramebuffer).toHaveBeenCalledOnce();
    expect(recording.deleteProgram).not.toHaveBeenCalled();
    expect(recording.deleteBuffer).not.toHaveBeenCalled();
    expect(recording.deleteVertexArray).not.toHaveBeenCalled();
  });

  it('delegates context invalidation and ordinary disposal exactly once', () => {
    const lost = createRendererGL();
    const lostRenderer = new WebGLSceneRenderer(lost.gl, 7);
    const lostMesh = mesh(0, [1, 0, 0, 1]);
    lostRenderer.render(scene({ meshes: [lostMesh], opaque: [lostMesh] }));

    lostRenderer.invalidateContext();
    lostRenderer.invalidateContext();
    expect(lost.deleteProgram).not.toHaveBeenCalled();
    expect(lost.deleteBuffer).not.toHaveBeenCalled();
    expect(lost.deleteVertexArray).not.toHaveBeenCalled();
    expect(() => lostRenderer.render(scene())).toThrowError(/invalid/i);
    lostRenderer.dispose(false);
    expect(() => lostRenderer.render(scene())).toThrowError(/disposed/i);

    const live = createRendererGL();
    const liveRenderer = new WebGLSceneRenderer(live.gl, 7);
    const liveMesh = mesh(0, [1, 0, 0, 1]);
    liveRenderer.render(scene({ meshes: [liveMesh], opaque: [liveMesh] }));
    liveRenderer.dispose(false);
    liveRenderer.dispose(false);

    expect(live.deleteProgram).toHaveBeenCalledOnce();
    expect(live.deleteBuffer).toHaveBeenCalledOnce();
    expect(live.deleteVertexArray).toHaveBeenCalledOnce();
    expect(() => liveRenderer.render(scene())).toThrowError(/disposed/i);
  });
});

interface SceneOverrides {
  readonly contextGeneration?: number;
  readonly meshes?: readonly SettledWebGLMesh[];
  readonly opaque?: readonly SettledWebGLMesh[];
  readonly transparent?: readonly SettledWebGLMesh[];
}

function scene(overrides: SceneOverrides = {}): SettledWebGLScene {
  return Object.freeze({
    contextGeneration: overrides.contextGeneration ?? 7,
    camera: Object.freeze({
      descriptor: Object.freeze({
        type: 'perspective' as const,
        fieldOfViewDegrees: 60,
        near: 0.1,
        far: 100,
        position: [0, 0, 5] as const,
        lookAt: [0, 0, 0] as const,
        up: [0, 1, 0] as const,
      }),
      aspect: 2,
      viewMatrix: matrix(101),
      projectionMatrix: matrix(201),
      projectionViewMatrix: matrix(301),
      inverseProjectionViewMatrix: matrix(401),
      viewport: Object.freeze({ width: 160, height: 90 }),
      generationValues: Object.freeze([]),
    }),
    logicalViewport: Object.freeze({ width: 160, height: 90 }),
    backingViewport: Object.freeze({ width: 320, height: 180 }),
    density: Object.freeze({ x: 2, y: 2 }),
    timestamp: 123,
    meshes: overrides.meshes ?? Object.freeze([]),
    opaque: overrides.opaque ?? Object.freeze([]),
    transparent: overrides.transparent ?? Object.freeze([]),
    pickEntries: Object.freeze([]),
  });
}

function mesh(
  sourceIndex: number,
  color: SettledWebGLMesh['color'],
  indexed = false,
  seed = sourceIndex + 1,
): SettledWebGLMesh {
  const geometry = createWebGLGeometry({
    positions: [0, 0, 0, seed, 0, 0, 0, seed, 0],
    indices: indexed ? [0, 1, 2] : undefined,
  });
  return Object.freeze({
    kind: 'mesh' as const,
    componentName: `Mesh${sourceIndex}`,
    source: undefined,
    geometry,
    model: matrix(seed),
    color: Object.freeze(color),
    sourceIndex,
    target: undefined,
    keyboardNavigationBounds: undefined,
    viewDepth: 10 - sourceIndex,
  });
}

function matrix(seed: number): Float32Array {
  return new Float32Array(
    Array.from({ length: 16 }, (_, index) => seed + index / 10),
  );
}

interface ThrowPoint {
  readonly operation: string;
  readonly at: number;
  readonly error: Error;
}

interface RendererGLOptions {
  readonly throws?: readonly ThrowPoint[];
  readonly loseContextAt?: Omit<ThrowPoint, 'error'>;
}

interface DrawSnapshot {
  readonly method: 'drawArrays' | 'drawElements';
  readonly blend: boolean;
  readonly blendFunction: readonly unknown[];
  readonly depthTest: boolean;
  readonly depthMask: boolean;
  readonly depthFunction: unknown;
  readonly model: readonly number[];
  readonly view: readonly number[];
  readonly projection: readonly number[];
  readonly color: readonly number[];
}

function createRendererGL(options: RendererGLOptions = {}) {
  const constants = createConstants();
  const operations: unknown[][] = [];
  const counts = new Map<string, number>();
  const state = {
    capabilities: new Map<number, boolean>(),
    depthMask: true,
    depthFunction: 0,
    blendFunction: [] as unknown[],
    uniforms: new Map<string, number[]>(),
  };
  const draws: DrawSnapshot[] = [];
  let nextHandle = 0;
  let contextLost = false;
  const handle = (kind: string) => ({ kind, id: ++nextHandle });
  const maybeThrow = (operation: string) => {
    const at = (counts.get(operation) ?? 0) + 1;
    counts.set(operation, at);
    if (
      options.loseContextAt?.operation === operation &&
      options.loseContextAt.at === at
    ) {
      contextLost = true;
    }
    const point = options.throws?.find(
      candidate => candidate.operation === operation && candidate.at === at,
    );
    if (point) throw point.error;
  };
  const record = (operation: string, args: unknown[]) => {
    operations.push([operation, ...args]);
    maybeThrow(operation);
  };
  const method = <T extends unknown[], R>(
    operation: string,
    implementation?: (...args: T) => R,
  ) =>
    vi.fn((...args: T) => {
      record(operation, args);
      return implementation?.(...args) as R;
    });
  const draw = (operation: DrawSnapshot['method'], args: unknown[]) => {
    record(operation, args);
    draws.push({
      method: operation,
      blend: state.capabilities.get(constants.BLEND) ?? false,
      blendFunction: [...state.blendFunction],
      depthTest: state.capabilities.get(constants.DEPTH_TEST) ?? false,
      depthMask: state.depthMask,
      depthFunction: state.depthFunction,
      model: [...(state.uniforms.get('u_model') ?? [])],
      view: [...(state.uniforms.get('u_view') ?? [])],
      projection: [...(state.uniforms.get('u_projection') ?? [])],
      color: [...(state.uniforms.get('u_color') ?? [])],
    });
  };
  const methods = {
    getParameter: method<[number], number>('getParameter', () => 2),
    isContextLost: method<[], boolean>(
      'isContextLost',
      () => contextLost,
    ),
    bindFramebuffer: method('bindFramebuffer'),
    viewport: method('viewport'),
    disable: method<[number], void>('disable', capability => {
      state.capabilities.set(capability, false);
    }),
    scissor: method('scissor'),
    useProgram: method('useProgram'),
    bindVertexArray: method('bindVertexArray'),
    bindBuffer: method('bindBuffer'),
    activeTexture: method('activeTexture'),
    bindTexture: method('bindTexture'),
    bindSampler: method('bindSampler'),
    colorMask: method('colorMask'),
    depthMask: method<[boolean], void>('depthMask', value => {
      state.depthMask = value;
    }),
    stencilMaskSeparate: method('stencilMaskSeparate'),
    enable: method<[number], void>('enable', capability => {
      state.capabilities.set(capability, true);
    }),
    blendColor: method('blendColor'),
    blendEquationSeparate: method('blendEquationSeparate'),
    blendFuncSeparate: method<unknown[], void>(
      'blendFuncSeparate',
      (...values) => {
        state.blendFunction = values;
      },
    ),
    depthFunc: method<[number], void>('depthFunc', value => {
      state.depthFunction = value;
    }),
    depthRange: method('depthRange'),
    cullFace: method('cullFace'),
    frontFace: method('frontFace'),
    stencilFuncSeparate: method('stencilFuncSeparate'),
    stencilOpSeparate: method('stencilOpSeparate'),
    polygonOffset: method('polygonOffset'),
    clearColor: method('clearColor'),
    clearDepth: method('clearDepth'),
    clearStencil: method('clearStencil'),
    pixelStorei: method('pixelStorei'),
    clear: method('clear'),
    createShader: method<[number], object>('createShader', type => ({
      ...handle('shader'),
      type,
    })),
    shaderSource: method('shaderSource'),
    compileShader: method('compileShader'),
    getShaderParameter: method<unknown[], boolean>(
      'getShaderParameter',
      () => true,
    ),
    getShaderInfoLog: method<unknown[], string>('getShaderInfoLog', () => ''),
    deleteShader: method('deleteShader'),
    createProgram: method<[], object>('createProgram', () => handle('program')),
    attachShader: method('attachShader'),
    detachShader: method('detachShader'),
    linkProgram: method('linkProgram'),
    getProgramParameter: method<unknown[], boolean>(
      'getProgramParameter',
      () => true,
    ),
    getProgramInfoLog: method<unknown[], string>('getProgramInfoLog', () => ''),
    deleteProgram: method('deleteProgram'),
    getUniformLocation: method<[object, string], object>(
      'getUniformLocation',
      (_program, name) => ({ name }),
    ),
    createVertexArray: method<[], object>('createVertexArray', () =>
      handle('vertex-array'),
    ),
    deleteVertexArray: method('deleteVertexArray'),
    createBuffer: method<[], object>('createBuffer', () => handle('buffer')),
    deleteBuffer: method('deleteBuffer'),
    bufferData: method('bufferData'),
    enableVertexAttribArray: method('enableVertexAttribArray'),
    vertexAttribPointer: method('vertexAttribPointer'),
    uniformMatrix4fv: method<
      [object & { name?: string }, boolean, Float32Array],
      void
    >('uniformMatrix4fv', (location, _transpose, value) => {
      state.uniforms.set(location.name ?? '', Array.from(value));
    }),
    uniform4f: method<
      [object & { name?: string }, number, number, number, number],
      void
    >('uniform4f', (location, ...value) => {
      state.uniforms.set(location.name ?? '', value);
    }),
    drawArrays: vi.fn((...args: unknown[]) => draw('drawArrays', args)),
    drawElements: vi.fn((...args: unknown[]) => draw('drawElements', args)),
    readPixels: method('readPixels'),
    createFramebuffer: method<[], object>('createFramebuffer', () =>
      handle('framebuffer'),
    ),
  };
  const gl = { ...constants, ...methods } as unknown as WebGL2RenderingContext;
  return {
    gl,
    operations,
    draws,
    ...methods,
  };
}

function createConstants(): Record<string, number> {
  const names = [
    'ACTIVE_TEXTURE',
    'ALWAYS',
    'ARRAY_BUFFER',
    'BACK',
    'BLEND',
    'BROWSER_DEFAULT_WEBGL',
    'CCW',
    'COLOR_BUFFER_BIT',
    'COMPILE_STATUS',
    'CULL_FACE',
    'DEPTH_BUFFER_BIT',
    'DEPTH_TEST',
    'ELEMENT_ARRAY_BUFFER',
    'FLOAT',
    'FRAGMENT_SHADER',
    'FRAMEBUFFER',
    'FRONT',
    'FUNC_ADD',
    'KEEP',
    'LEQUAL',
    'LESS',
    'LINK_STATUS',
    'MAX_COMBINED_TEXTURE_IMAGE_UNITS',
    'ONE',
    'ONE_MINUS_SRC_ALPHA',
    'PACK_ALIGNMENT',
    'PACK_ROW_LENGTH',
    'PACK_SKIP_PIXELS',
    'PACK_SKIP_ROWS',
    'POLYGON_OFFSET_FILL',
    'SCISSOR_TEST',
    'SRC_ALPHA',
    'STATIC_DRAW',
    'STENCIL_TEST',
    'TEXTURE0',
    'TEXTURE_2D',
    'TEXTURE_2D_ARRAY',
    'TEXTURE_3D',
    'TEXTURE_CUBE_MAP',
    'TRIANGLES',
    'UNPACK_ALIGNMENT',
    'UNPACK_COLORSPACE_CONVERSION_WEBGL',
    'UNPACK_FLIP_Y_WEBGL',
    'UNPACK_IMAGE_HEIGHT',
    'UNPACK_PREMULTIPLY_ALPHA_WEBGL',
    'UNPACK_ROW_LENGTH',
    'UNPACK_SKIP_IMAGES',
    'UNPACK_SKIP_PIXELS',
    'UNPACK_SKIP_ROWS',
    'UNSIGNED_INT',
    'VERTEX_SHADER',
    'ZERO',
  ];
  return Object.fromEntries(names.map((name, index) => [name, index + 1]));
}

function indexOf(operations: readonly unknown[][], operation: string): number {
  return operations.findIndex(([name]) => name === operation);
}

function lastIndexOf(
  operations: readonly unknown[][],
  operation: string,
): number {
  return operations.findLastIndex(([name]) => name === operation);
}
