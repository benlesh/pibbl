import type { CRCBackendFrameInput } from '@crc/core/internal';
import { afterEach, describe, expect, test, vi } from 'vitest';
import type {
  CRCWebGLInstancedRecipe,
  CRCWebGLInstancedSubmission,
} from '../../internal.js';
import { resolveCamera } from '../math/camera.js';
import {
  createWebGLSceneComposer,
  submitWebGLInstancedSubmission,
} from './composer.js';
import { WebGLSceneRenderer } from './renderer.js';
import { settleWebGLScene } from './settle.js';

afterEach(() => vi.restoreAllMocks());

describe('settled instanced WebGL rendering', () => {
  test('creates one resident recipe and draws each settled submission once', () => {
    const recording = createInstancedGL();
    const renderer = new WebGLSceneRenderer(recording.gl, 7);
    const particleRecipe = recipe();

    renderer.render(scene(particleRecipe, [
      { material: { type: 'unlit', blend: 'alpha' }, opacity: 0.5 },
      {
        material: { type: 'emissive', blend: 'additive' },
        opacity: 0.75,
        depthTest: false,
      },
    ]));
    renderer.render(scene(particleRecipe, [
      { material: { type: 'unlit', blend: 'alpha' }, opacity: 0.25 },
    ]));

    expect(recording.createProgram).toHaveBeenCalledOnce();
    expect(recording.createVertexArray).toHaveBeenCalledOnce();
    expect(recording.createBuffer).toHaveBeenCalledOnce();
    expect(recording.bufferData).toHaveBeenCalledOnce();
    expect(recording.createTexture).toHaveBeenCalledTimes(2);
    expect(recording.texImage2D).toHaveBeenCalledTimes(2);
    expect(recording.drawArraysInstanced).toHaveBeenCalledTimes(3);
    expect(recording.drawArraysInstanced.mock.calls).toEqual([
      [recording.gl.TRIANGLES, 0, 6, 20_000],
      [recording.gl.TRIANGLES, 0, 6, 20_000],
      [recording.gl.TRIANGLES, 0, 6, 20_000],
    ]);
    expect(recording.uniform1fv.mock.calls.map(call => Array.from(call[1]))).
      toEqual([[1, 2, 3], [1, 2, 3], [1, 2, 3]]);
    expect(recording.uniform1f.mock.calls.map(call => call[1])).toEqual([
      0.5, 0.75, 0.25,
    ]);
    expect(recording.uniform3f.mock.calls.map(call => call.slice(1))).toEqual([
      [1, 0, 0],
      [0, 1, 0],
      [1, 0, 0],
      [0, 1, 0],
      [1, 0, 0],
      [0, 1, 0],
    ]);
    expect(recording.draws.map(draw => [
      draw.blend,
      draw.depthTest,
      draw.depthMask,
    ])).toEqual([
      [true, true, false],
      [true, false, false],
      [true, true, false],
    ]);
    expect(recording.draws[0]!.blendFunction).toEqual([
      recording.gl.SRC_ALPHA,
      recording.gl.ONE_MINUS_SRC_ALPHA,
      recording.gl.ONE,
      recording.gl.ONE_MINUS_SRC_ALPHA,
    ]);
    expect(recording.draws[1]!.blendFunction).toEqual([
      recording.gl.SRC_ALPHA,
      recording.gl.ONE,
      recording.gl.ONE,
      recording.gl.ONE,
    ]);
    expect(recording.readPixels).not.toHaveBeenCalled();
    renderer.dispose(false);
    expect(recording.deleteProgram).toHaveBeenCalledOnce();
    expect(recording.deleteVertexArray).toHaveBeenCalledOnce();
    expect(recording.deleteBuffer).toHaveBeenCalledOnce();
    expect(recording.deleteTexture).toHaveBeenCalledTimes(2);
  });

  test('rolls candidate recipe handles back after a draw failure', () => {
    const failure = new Error('injected instanced draw failure');
    const recording = createInstancedGL(failure);
    const renderer = new WebGLSceneRenderer(recording.gl, 7);

    expect(() => renderer.render(scene(recipe(), [{}]))).toThrow(failure);

    expect(recording.deleteProgram).toHaveBeenCalledOnce();
    expect(recording.deleteVertexArray).toHaveBeenCalledOnce();
    expect(recording.deleteBuffer).toHaveBeenCalledOnce();
    expect(recording.deleteTexture).toHaveBeenCalledTimes(2);
  });
});

const frame = {
  canvas: {} as HTMLCanvasElement,
  logicalWidth: 100,
  logicalHeight: 100,
  backingWidth: 200,
  backingHeight: 200,
  renderTimestamp: 123.5,
} as CRCBackendFrameInput;

function scene(
  particleRecipe: CRCWebGLInstancedRecipe,
  variants: ReadonlyArray<Partial<CRCWebGLInstancedSubmission>>,
) {
  const composer = createWebGLSceneComposer({
    frame,
    camera: resolveCamera(undefined, 100, 100),
    contextGeneration: 7,
  });
  for (const variant of variants) {
    submitWebGLInstancedSubmission(composer, {
      kind: 'instanced',
      componentName: 'Particles3D',
      source: undefined,
      localModel: identity(),
      localBounds: { min: [-2, -2, -2], max: [2, 2, 2] },
      opacity: 1,
      material: { type: 'unlit', blend: 'alpha' },
      depthTest: true,
      depthWrite: false,
      sorting: 'none',
      target: undefined,
      recipe: particleRecipe,
      frameUniforms: new Float32Array([1, 2, 3]),
      ...variant,
    });
  }
  return settleWebGLScene(composer);
}

function recipe(): CRCWebGLInstancedRecipe {
  return Object.freeze({
    key: Object.freeze({}),
    topology: 'triangles',
    vertexSource: '#version 300 es\nuniform mat4 u_projection_view; uniform mat4 u_model; uniform vec3 u_camera_right; uniform vec3 u_camera_up; uniform float u_effective_opacity; uniform float u_frame_uniforms[3]; void main(){gl_Position=vec4(u_camera_right + u_camera_up, 1.0);}',
    fragmentSource: '#version 300 es\nprecision highp float; uniform sampler2D u_lookup_0; uniform sampler2D u_sprite; out vec4 c; void main(){c=vec4(1.0);}',
    verticesPerInstance: 6,
    capacity: 20_000,
    staticVertexData: new Float32Array([
      -1, -1, 1, -1, 1, 1,
      -1, -1, 1, 1, -1, 1,
    ]),
    lookupTables: Object.freeze([Object.freeze({
      width: 2,
      height: 1,
      channels: 4 as const,
      data: new Float32Array([1, 0, 0, 1, 0, 1, 0, 1]),
    })]),
    sprite: Object.freeze({ source: new OffscreenCanvas(2, 2) }),
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

function createInstancedGL(drawFailure?: Error) {
  const constants = Object.fromEntries([
    'ARRAY_BUFFER', 'BACK', 'BLEND', 'BROWSER_DEFAULT_WEBGL',
    'CCW', 'CLAMP_TO_EDGE', 'COLOR_BUFFER_BIT', 'COMPILE_STATUS',
    'CULL_FACE', 'DEPTH_BUFFER_BIT', 'DEPTH_TEST', 'ELEMENT_ARRAY_BUFFER',
    'FLOAT', 'FRAGMENT_SHADER', 'FRAMEBUFFER', 'FUNC_ADD', 'KEEP',
    'LEQUAL', 'LESS', 'LINEAR', 'LINK_STATUS',
    'MAX_COMBINED_TEXTURE_IMAGE_UNITS', 'NEAREST', 'ONE',
    'ONE_MINUS_SRC_ALPHA', 'PACK_ALIGNMENT',
    'PACK_ROW_LENGTH', 'PACK_SKIP_PIXELS', 'PACK_SKIP_ROWS', 'POINTS',
    'POLYGON_OFFSET_FILL', 'RED', 'RG', 'RGB', 'RGBA', 'R32F', 'RG32F',
    'RGB32F', 'RGBA32F', 'SCISSOR_TEST', 'SRC_ALPHA', 'STATIC_DRAW',
    'STENCIL_TEST', 'TEXTURE0', 'TEXTURE_2D', 'TEXTURE_3D',
    'TEXTURE_2D_ARRAY', 'TEXTURE_CUBE_MAP', 'TEXTURE_MAG_FILTER',
    'TEXTURE_MIN_FILTER', 'TEXTURE_WRAP_S', 'TEXTURE_WRAP_T', 'TRIANGLES',
    'UNPACK_ALIGNMENT', 'UNPACK_COLORSPACE_CONVERSION_WEBGL',
    'UNPACK_FLIP_Y_WEBGL', 'UNPACK_IMAGE_HEIGHT', 'UNPACK_PREMULTIPLY_ALPHA_WEBGL',
    'UNPACK_ROW_LENGTH', 'UNPACK_SKIP_IMAGES', 'UNPACK_SKIP_PIXELS',
    'UNPACK_SKIP_ROWS', 'UNSIGNED_BYTE', 'VERTEX_SHADER', 'ZERO',
  ].map((name, index) => [name, index + 1]));
  const state = {
    blend: false,
    depthTest: false,
    depthMask: true,
    blendFunction: [] as number[],
  };
  const draws: Array<{
    blend: boolean;
    depthTest: boolean;
    depthMask: boolean;
    blendFunction: number[];
  }> = [];
  let handleId = 0;
  const handle = (kind: string) => ({ kind, id: ++handleId });
  const methods: Record<string, ReturnType<typeof vi.fn>> = {};
  const method = (name: string, implementation?: (...args: any[]) => any) =>
    methods[name] = vi.fn((...args: any[]) => implementation?.(...args));
  method('getParameter', () => 4);
  method('isContextLost', () => false);
  method('createShader', () => handle('shader'));
  method('getShaderParameter', () => true);
  method('getShaderInfoLog', () => '');
  method('createProgram', () => handle('program'));
  method('getProgramParameter', () => true);
  method('getProgramInfoLog', () => '');
  method('getUniformLocation', (_program, name) => ({ name }));
  method('createVertexArray', () => handle('vao'));
  method('createBuffer', () => handle('buffer'));
  method('createTexture', () => handle('texture'));
  method('enable', capability => {
    if (capability === constants.BLEND) state.blend = true;
    if (capability === constants.DEPTH_TEST) state.depthTest = true;
  });
  method('disable', capability => {
    if (capability === constants.BLEND) state.blend = false;
    if (capability === constants.DEPTH_TEST) state.depthTest = false;
  });
  method('depthMask', value => { state.depthMask = value; });
  method('blendFuncSeparate', (...args) => {
    state.blendFunction = args as number[];
  });
  method('drawArraysInstanced', () => {
    if (drawFailure) throw drawFailure;
    draws.push({
      blend: state.blend,
      depthTest: state.depthTest,
      depthMask: state.depthMask,
      blendFunction: [...state.blendFunction],
    });
  });
  for (const name of [
    'activeTexture', 'attachShader', 'bindBuffer', 'bindFramebuffer',
    'bindSampler', 'bindTexture', 'bindVertexArray', 'blendColor',
    'blendEquationSeparate', 'bufferData', 'clear', 'clearColor', 'clearDepth',
    'clearStencil', 'colorMask', 'compileShader', 'cullFace', 'deleteBuffer',
    'deleteProgram', 'deleteShader', 'deleteTexture', 'deleteVertexArray',
    'depthFunc', 'depthRange', 'detachShader', 'enableVertexAttribArray',
    'frontFace', 'linkProgram', 'pixelStorei', 'polygonOffset', 'readPixels',
    'scissor', 'shaderSource', 'stencilFuncSeparate', 'stencilMaskSeparate',
    'stencilOpSeparate', 'texImage2D', 'texParameteri', 'uniform1f', 'uniform3f',
    'uniform1fv', 'uniform1i', 'uniformMatrix4fv', 'useProgram',
    'vertexAttribPointer', 'viewport',
  ]) if (!methods[name]) method(name);
  const gl = new Proxy({ ...constants, ...methods }, {
    get(target, property) {
      if (property in target) return target[property as keyof typeof target];
      return method(String(property));
    },
  }) as unknown as WebGL2RenderingContext;
  return {
    gl,
    draws,
    createProgram: methods.createProgram!,
    createVertexArray: methods.createVertexArray!,
    createBuffer: methods.createBuffer!,
    bufferData: methods.bufferData!,
    createTexture: methods.createTexture!,
    texImage2D: methods.texImage2D!,
    drawArraysInstanced: methods.drawArraysInstanced!,
    uniform1f: methods.uniform1f!,
    uniform3f: methods.uniform3f!,
    uniform1fv: methods.uniform1fv!,
    readPixels: methods.readPixels!,
    deleteProgram: methods.deleteProgram!,
    deleteVertexArray: methods.deleteVertexArray!,
    deleteBuffer: methods.deleteBuffer!,
    deleteTexture: methods.deleteTexture!,
  };
}
