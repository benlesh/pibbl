import { crc, createElement, type CRCNode } from '@crc/core';
import { jsxDEV } from '@crc/core/jsx-dev-runtime';
import {
  executeBackendCRC,
  mountBackendCRC,
  type CRCBackendFrameInput,
  type CRCEventTargetRegistration,
} from '@crc/core/internal';
import { describe, expect, it, vi } from 'vitest';
import {
  AmbientLight,
  Cube,
  Mesh,
  WebGLBackground,
  createWebGLGeometry,
} from '../index.js';
import { resolveCamera } from './math/camera.js';
import {
  pushWebGLModelMatrix,
  submitWebGLMesh,
} from './scene/composer.js';
import { createWebGLBackend } from './backend.js';

describe('deferred WebGL backend phases', () => {
  it('completes every wrapper and primitive before the first GL operation', () => {
    const trace: string[] = [];
    const recording = createPhaseGL(trace);
    const geometry = triangle();
    function SceneMesh(props: { readonly label: string }) {
      trace.push(`primitive:${props.label}`);
      return createElement(Mesh, { geometry, style: { lit: false } });
    }
    function Wrapper(props: {
      readonly label: string;
      readonly children: CRCNode;
    }) {
      trace.push(`wrapper:${props.label}`);
      return props.children;
    }
    const root = [
      createElement(Wrapper, {
        key: 'first',
        label: 'first',
        children: createElement(SceneMesh, { label: 'first' }),
      }),
      createElement(Wrapper, {
        key: 'second',
        label: 'second',
        children: createElement(SceneMesh, { label: 'second' }),
      }),
    ];
    const mounted = mountScene(recording.gl, root);

    executeBackendCRC(mounted.mount, root, 10);

    const firstGL = trace.findIndex(entry => entry.startsWith('gl:'));
    expect(trace.slice(0, firstGL)).toEqual([
      'wrapper:first',
      'primitive:first',
      'wrapper:second',
      'primitive:second',
    ]);
    expect(trace.filter(entry => entry === 'wrapper:first')).toHaveLength(1);
    expect(trace.filter(entry => entry === 'primitive:first')).toHaveLength(1);
    expect(trace.filter(entry => entry === 'wrapper:second')).toHaveLength(1);
    expect(trace.filter(entry => entry === 'primitive:second')).toHaveLength(1);
    expect(recording.clear).toHaveBeenCalledOnce();
    expect(recording.drawArrays).toHaveBeenCalledTimes(2);

    mounted.dispose();
  });

  it('discards a failed composition without any GL work or completion', () => {
    const trace: string[] = [];
    const recording = createPhaseGL(trace);
    const driver = createWebGLBackend({
      gl: recording.gl,
      getCamera: () => resolveCamera(undefined, 20, 10),
      getContextGeneration: () => 3,
    });
    const frame = driver.beginFrame(frameInput(41));

    expect(frame).toBeDefined();
    expect(trace).toEqual([]);
    driver.finishFrame(frame!, false);

    expect(trace).toEqual([]);
    expect(frame!.environment.state).toBe('closed');
    expect(driver.hasCompletedFrame()).toBe(false);
    expect(driver.takeFailedFrameTimestamp()).toBe(41);
    driver.dispose();
  });

  it('releases failed render resources and pick participation without publishing', () => {
    const failure = new Error('injected deferred draw failure');
    const trace: string[] = [];
    const recording = createPhaseGL(trace, failure);
    const driver = createWebGLBackend({
      gl: recording.gl,
      getCamera: () => resolveCamera(undefined, 20, 10),
      getContextGeneration: () => 7,
    });
    const frame = driver.beginFrame(frameInput(73))!;
    const target = fakeTarget();
    submitWebGLMesh(frame.environment, {
      componentName: 'FailingMesh',
      geometry: triangle(),
      localModel: identity(),
      color: [1, 0, 0, 1],
      lit: false,
      target,
    });

    expect(() => driver.finishFrame(frame, true)).toThrow(failure);

    expect(frame.environment.state).toBe('closed');
    expect(target.live).toBe(false);
    expect(recording.deleteProgram).toHaveBeenCalledOnce();
    expect(recording.deleteBuffer).toHaveBeenCalledOnce();
    expect(recording.deleteVertexArray).toHaveBeenCalledOnce();
    expect(driver.hasCompletedFrame()).toBe(false);
    expect(driver.takeFailedFrameTimestamp()).toBe(73);
    driver.dispose();
  });

  it('discards an unbalanced composer when scene settlement fails', () => {
    const failureTrace: string[] = [];
    const recording = createPhaseGL(failureTrace);
    const driver = createWebGLBackend({
      gl: recording.gl,
      getCamera: () => resolveCamera(undefined, 20, 10),
      getContextGeneration: () => 11,
    });
    const frame = driver.beginFrame(frameInput(89))!;
    const target = fakeTarget();
    submitWebGLMesh(frame.environment, {
      componentName: 'UnbalancedMesh',
      geometry: triangle(),
      localModel: identity(),
      color: [1, 0, 0, 1],
      lit: false,
      target,
    });
    pushWebGLModelMatrix(frame.environment, identity());

    expect(() => driver.finishFrame(frame, true)).toThrowError(
      'Cannot close WebGL scene composer with an unbalanced model stack.',
    );

    expect(failureTrace).toEqual([]);
    expect(frame.environment.state).toBe('closed');
    expect(target.live).toBe(false);
    expect(driver.hasCompletedFrame()).toBe(false);
    expect(driver.takeFailedFrameTimestamp()).toBe(89);
    driver.dispose();
  });

  it('rejects a second finish without clearing a successful completion', () => {
    const trace: string[] = [];
    const recording = createPhaseGL(trace);
    const driver = createWebGLBackend({
      gl: recording.gl,
      getCamera: () => resolveCamera(undefined, 20, 10),
      getContextGeneration: () => 13,
    });
    const frame = driver.beginFrame(frameInput(97))!;

    driver.finishFrame(frame, true);
    const traceAfterSuccess = trace.slice();

    expect(() => driver.finishFrame(frame, false)).toThrowError(
      'WebGL backend frame is already finished.',
    );
    expect(trace).toEqual(traceAfterSuccess);
    expect(driver.hasCompletedFrame()).toBe(true);
    expect(driver.renderedGeneration).toBe(1);
    expect(driver.takeFailedFrameTimestamp()).toBeUndefined();
    expect(driver.takeCompletedFrame()).toMatchObject({
      renderedGeneration: 1,
      contextGeneration: 13,
    });
    driver.dispose();
  });

  it('rejects a second finish without repeating failed-frame release', () => {
    const trace: string[] = [];
    const recording = createPhaseGL(trace);
    const driver = createWebGLBackend({
      gl: recording.gl,
      getCamera: () => resolveCamera(undefined, 20, 10),
      getContextGeneration: () => 17,
    });
    const frame = driver.beginFrame(frameInput(101))!;
    const target = fakeTarget();
    const deleteRegion = vi.spyOn(target.owner.regions, 'delete');
    submitWebGLMesh(frame.environment, {
      componentName: 'DiscardedMesh',
      geometry: triangle(),
      localModel: identity(),
      color: [1, 0, 0, 1],
      lit: false,
      target,
    });

    driver.finishFrame(frame, false);

    expect(() => driver.finishFrame(frame, false)).toThrowError(
      'WebGL backend frame is already finished.',
    );
    expect(trace).toEqual([]);
    expect(deleteRegion).toHaveBeenCalledOnce();
    expect(frame.environment.state).toBe('closed');
    expect(target.live).toBe(false);
    expect(driver.hasCompletedFrame()).toBe(false);
    expect(driver.takeFailedFrameTimestamp()).toBe(101);
    expect(driver.takeFailedFrameTimestamp()).toBeUndefined();
    driver.dispose();
  });

  it.each([
    ['default-lit', undefined],
    ['unlit', false],
  ])('rejects public %s zero scale before any GL operation', (_label, lit) => {
    const trace: string[] = [];
    const recording = createPhaseGL(trace);
    const root = createElement(Cube, {
      style: lit === undefined ? { scaleX: 0 } : { scaleX: 0, lit },
    });
    const mounted = mountScene(recording.gl, root);

    expect(() => executeBackendCRC(mounted.mount, root, 10)).toThrow(
      'WebGL transform.scaleX must be nonzero',
    );
    expect(trace).toEqual([]);

    mounted.dispose();
  });

  it('rejects a default-lit geometry without normals and reports JSX source before GL', () => {
    const trace: string[] = [];
    const recording = createPhaseGL(trace);
    const source = {
      fileName: '/app/custom-lit-mesh.tsx',
      lineNumber: 24,
      columnNumber: 11,
    };
    const root = jsxDEV(
      Mesh,
      { geometry: triangleWithoutNormals() },
      undefined,
      false,
      source,
      undefined,
    );
    const mounted = mountScene(recording.gl, root);

    expect(() => executeBackendCRC(mounted.mount, root, 10)).toThrow(
      'Mesh lit geometry requires normals. ' +
      'JSX source: /app/custom-lit-mesh.tsx:24:11.',
    );
    expect(trace).toEqual([]);

    mounted.dispose();
  });

  it('accepts an explicit-unlit public geometry without normals', () => {
    const trace: string[] = [];
    const recording = createPhaseGL(trace);
    const root = createElement(Mesh, {
      geometry: triangleWithoutNormals(),
      style: { color: '#ff0000', lit: false },
    });
    const mounted = mountScene(recording.gl, root);

    executeBackendCRC(mounted.mount, root, 10);

    expect(recording.drawArrays).toHaveBeenCalledOnce();
    mounted.dispose();
  });

  it('rejects a ninth light before any GL operation and counts zero intensity', () => {
    const trace: string[] = [];
    const recording = createPhaseGL(trace);
    const root = Array.from({ length: 9 }, (_, index) => createElement(
      AmbientLight,
      { style: { intensity: index === 0 ? 0 : 1 } },
    ));
    const mounted = mountScene(recording.gl, root);

    expect(() => executeBackendCRC(mounted.mount, root, 10)).toThrow(
      'WebGLLayer supports at most 8 light declarations',
    );
    expect(trace).toEqual([]);

    mounted.dispose();
  });

  it('rejects a second background before any GL operation', () => {
    const trace: string[] = [];
    const recording = createPhaseGL(trace);
    const root = [
      createElement(WebGLBackground, { style: { color: '#000000' } }),
      createElement(WebGLBackground, { style: { color: '#ffffff' } }),
    ];
    const mounted = mountScene(recording.gl, root);

    expect(() => executeBackendCRC(mounted.mount, root, 10)).toThrow(
      'WebGLLayer supports at most one WebGLBackground declaration',
    );
    expect(trace).toEqual([]);

    mounted.dispose();
  });
});

function mountScene(gl: WebGL2RenderingContext, root: CRCNode) {
  const parentCanvas = document.createElement('canvas');
  const parent = crc(parentCanvas, undefined);
  const driver = createWebGLBackend({
    gl,
    getCamera: () => resolveCamera(undefined, 20, 10),
    getContextGeneration: () => 1,
  });
  const mount = mountBackendCRC(new OffscreenCanvas(40, 20), root, {
    parent: parentCanvas,
    logicalWidth: 20,
    logicalHeight: 10,
    driver,
  });
  return {
    mount,
    dispose() {
      mount.dispose();
      parent.dispose();
    },
  };
}

function frameInput(renderTimestamp: number): CRCBackendFrameInput {
  return {
    canvas: document.createElement('canvas'),
    logicalWidth: 20,
    logicalHeight: 10,
    backingWidth: 40,
    backingHeight: 20,
    renderTimestamp,
  };
}

function triangle() {
  return createWebGLGeometry({
    positions: [-1, -1, 0, 1, -1, 0, 0, 1, 0],
    normals: [0, 0, 1, 0, 0, 1, 0, 0, 1],
  });
}

function triangleWithoutNormals() {
  return createWebGLGeometry({
    positions: [-1, -1, 0, 1, -1, 0, 0, 1, 0],
  });
}

function identity(): Float32Array {
  return new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ]);
}

function fakeTarget(): CRCEventTargetRegistration {
  const eventRoot = {
    targets: new Set<CRCEventTargetRegistration>(),
    pointerCaptures: new Map<number, CRCEventTargetRegistration>(),
  };
  const owner = {
    eventRoot,
    mainTeardowns: { closed: false },
    paintEntries: new Set(),
    regions: new Set<CRCEventTargetRegistration>(),
  };
  const target = {
    kind: 'target',
    live: true,
    owner,
    paintEntry: undefined,
  } as unknown as CRCEventTargetRegistration;
  eventRoot.targets.add(target);
  owner.regions.add(target);
  return target;
}

function createPhaseGL(trace: string[], drawFailure?: Error) {
  const constants = createConstants();
  let nextHandle = 0;
  const handle = (kind: string) => ({ kind, id: ++nextHandle });
  const counts = new Map<string, number>();
  const record = (name: string) => {
    trace.push(`gl:${name}`);
    counts.set(name, (counts.get(name) ?? 0) + 1);
    if (name === 'drawArrays' && drawFailure) throw drawFailure;
  };
  const method = <T extends unknown[], R>(
    name: string,
    implementation?: (...args: T) => R,
  ) => vi.fn((...args: T) => {
    record(name);
    return implementation?.(...args) as R;
  });
  const methods: Record<string, unknown> = {
    getParameter: method('getParameter', () => 2),
    isContextLost: method('isContextLost', () => false),
    createShader: method('createShader', () => handle('shader')),
    getShaderParameter: method('getShaderParameter', () => true),
    getShaderInfoLog: method('getShaderInfoLog', () => ''),
    createProgram: method('createProgram', () => handle('program')),
    getProgramParameter: method('getProgramParameter', () => true),
    getProgramInfoLog: method('getProgramInfoLog', () => ''),
    getUniformLocation: method(
      'getUniformLocation',
      (_program: object, name: string) => ({ name }),
    ),
    createVertexArray: method('createVertexArray', () =>
      handle('vertex-array')),
    createBuffer: method('createBuffer', () => handle('buffer')),
  };
  for (const name of [
    'activeTexture', 'attachShader', 'bindBuffer', 'bindFramebuffer',
    'bindSampler', 'bindTexture', 'bindVertexArray', 'blendColor',
    'blendEquationSeparate', 'blendFuncSeparate', 'bufferData', 'clearColor',
    'clearDepth', 'clearStencil', 'colorMask', 'compileShader', 'cullFace',
    'deleteShader', 'depthFunc', 'depthMask', 'depthRange', 'detachShader',
    'disable', 'enable', 'enableVertexAttribArray', 'frontFace', 'linkProgram',
    'pixelStorei', 'polygonOffset', 'scissor', 'shaderSource',
    'stencilFuncSeparate', 'stencilMaskSeparate', 'stencilOpSeparate',
    'uniform4f', 'uniformMatrix4fv', 'useProgram', 'vertexAttribPointer',
    'viewport',
  ]) methods[name] = method(name);
  const clear = method('clear');
  const drawArrays = method('drawArrays');
  const drawElements = method('drawElements');
  const deleteProgram = method('deleteProgram');
  const deleteBuffer = method('deleteBuffer');
  const deleteVertexArray = method('deleteVertexArray');
  Object.assign(methods, {
    clear,
    drawArrays,
    drawElements,
    deleteProgram,
    deleteBuffer,
    deleteVertexArray,
  });
  const gl = new Proxy({ ...constants, ...methods }, {
    get(target, property) {
      if (typeof property !== 'string') return undefined;
      if (property in target) return target[property as keyof typeof target];
      const fallback = method(property);
      Object.assign(target, { [property]: fallback });
      return fallback;
    },
  }) as unknown as WebGL2RenderingContext;
  return {
    gl,
    clear,
    drawArrays,
    drawElements,
    deleteProgram,
    deleteBuffer,
    deleteVertexArray,
  };
}

function createConstants(): Record<string, number> {
  const names = [
    'ACTIVE_TEXTURE', 'ALWAYS', 'ARRAY_BUFFER', 'BACK', 'BLEND',
    'BROWSER_DEFAULT_WEBGL', 'CCW', 'COLOR_BUFFER_BIT', 'COMPILE_STATUS',
    'CULL_FACE', 'DEPTH_BUFFER_BIT', 'DEPTH_TEST', 'ELEMENT_ARRAY_BUFFER',
    'FLOAT', 'FRAGMENT_SHADER', 'FRAMEBUFFER', 'FRONT', 'FUNC_ADD', 'KEEP',
    'LEQUAL', 'LESS', 'LINK_STATUS', 'MAX_COMBINED_TEXTURE_IMAGE_UNITS',
    'ONE', 'ONE_MINUS_SRC_ALPHA', 'PACK_ALIGNMENT', 'PACK_ROW_LENGTH',
    'PACK_SKIP_PIXELS', 'PACK_SKIP_ROWS', 'POLYGON_OFFSET_FILL',
    'SCISSOR_TEST', 'SRC_ALPHA', 'STATIC_DRAW', 'STENCIL_TEST', 'TEXTURE0',
    'TEXTURE_2D', 'TEXTURE_2D_ARRAY', 'TEXTURE_3D', 'TEXTURE_CUBE_MAP',
    'TRIANGLES', 'UNPACK_ALIGNMENT', 'UNPACK_COLORSPACE_CONVERSION_WEBGL',
    'UNPACK_FLIP_Y_WEBGL', 'UNPACK_IMAGE_HEIGHT',
    'UNPACK_PREMULTIPLY_ALPHA_WEBGL', 'UNPACK_ROW_LENGTH',
    'UNPACK_SKIP_IMAGES', 'UNPACK_SKIP_PIXELS', 'UNPACK_SKIP_ROWS',
    'UNSIGNED_INT', 'VERTEX_SHADER', 'ZERO',
  ];
  return Object.fromEntries(names.map((name, index) => [name, index + 1]));
}
