import { createElement, crc, type CRCNode } from '@crc/core';
import { executeBackendCRC, mountBackendCRC } from '@crc/core/internal';
import { describe, expect, it } from 'vitest';
import { createWebGLBackend } from '../backend.js';
import { defineWebGLPrimitive } from '../define-webgl-primitive.js';
import { resolveCamera } from '../math/camera.js';
import type { CRCWebGLTransformStyle } from '../types.js';
import { beginWebGLFrame, installWebGLStateBaseline } from './state.js';

describe('WebGL state baseline', () => {
  it('begins from transparent color and depth clear values and clears both buffers', () => {
    const recording = createRecordingGL();

    beginWebGLFrame(recording.gl, 320, 180);

    expect(recording.operations.at(-1)).toEqual([
      'clear',
      recording.gl.COLOR_BUFFER_BIT | recording.gl.DEPTH_BUFFER_BIT,
    ]);
    expect(recording.snapshot()).toMatchObject({
      clearColor: [0, 0, 0, 0],
      clearDepth: 1,
    });
  });

  it('resets every declared state category to a fixed framework baseline', () => {
    const recording = createRecordingGL();
    mutateEveryState(recording.gl);

    installWebGLStateBaseline(recording.gl, 320, 180);

    expect(recording.snapshot()).toEqual(expectedBaseline(recording.gl, 320, 180));
    expect(recording.getParameterCalls).toBe(0);
  });

  it('gives the next primitive the baseline after a sibling mutates GL state', () => {
    const recording = createRecordingGL();
    let observed: Record<string, unknown> | undefined;
    const Mutator = defineWebGLPrimitive<{}, CRCWebGLTransformStyle>(
      function renderMutator(_props, _style, context) {
        mutateEveryState(context.gl);
      },
      { hit: { kind: 'none' } },
    );
    const Observer = defineWebGLPrimitive<{}, CRCWebGLTransformStyle>(
      function renderObserver() {
        observed = recording.snapshot();
      },
      { hit: { kind: 'none' } },
    );
    const mounted = mountScene(recording.gl, [
      createElement(Mutator, { key: 'mutator', pointerEvents: 'none' }),
      createElement(Observer, { key: 'observer', pointerEvents: 'none' }),
    ]);

    executeBackendCRC(mounted.mount, mounted.root, 10);

    expect(observed).toEqual(expectedBaseline(recording.gl, 80, 40));
    expect(recording.getParameterCalls).toBe(0);
    mounted.dispose();
  });

  it('restores the baseline when a primitive callback throws', () => {
    const recording = createRecordingGL();
    const failure = new Error('custom draw failed');
    const Throwing = defineWebGLPrimitive<{}, CRCWebGLTransformStyle>(
      function renderThrowing(_props, _style, context) {
        mutateEveryState(context.gl);
        throw failure;
      },
      { hit: { kind: 'none' } },
    );
    const mounted = mountScene(
      recording.gl,
      createElement(Throwing, { pointerEvents: 'none' }),
    );

    expect(() => executeBackendCRC(mounted.mount, mounted.root, 11)).toThrow(failure);
    expect(recording.snapshot()).toEqual(expectedBaseline(recording.gl, 80, 40));
    expect(recording.getParameterCalls).toBe(0);
    mounted.dispose();
  });
});

function mountScene(gl: WebGL2RenderingContext, root: CRCNode) {
  const parentCanvas = document.createElement('canvas');
  const parent = crc(parentCanvas, undefined);
  const camera = resolveCamera(undefined, 40, 20);
  const driver = createWebGLBackend({
    gl,
    getCamera: () => camera,
    getContextGeneration: () => 1,
  });
  const mount = mountBackendCRC(new OffscreenCanvas(80, 40), root, {
    parent: parentCanvas,
    logicalWidth: 40,
    logicalHeight: 20,
    driver,
  });
  return {
    root,
    mount,
    dispose() {
      mount.dispose();
      parent.dispose();
    },
  };
}

interface RecordingGL {
  readonly gl: WebGL2RenderingContext;
  readonly getParameterCalls: number;
  readonly operations: readonly (readonly unknown[])[];
  snapshot(): Record<string, unknown>;
}

function createRecordingGL(): RecordingGL {
  const state: Record<string, unknown> = {};
  let nextConstant = 1;
  let getParameterCalls = 0;
  const constants: Record<string, number> = {};
  const operations: unknown[][] = [];
  const gl = new Proxy({}, {
    get(_target, property) {
      if (property === 'getParameter') {
        return () => {
          getParameterCalls += 1;
          return undefined;
        };
      }
      if (typeof property !== 'string') return undefined;
      if (/^[A-Z0-9_]+$/.test(property)) {
        return constants[property] ??= nextConstant++;
      }
      return (...args: unknown[]) => {
        operations.push([property, ...args]);
        recordState(state, property, args);
      };
    },
  }) as WebGL2RenderingContext;
  return {
    gl,
    get getParameterCalls() {
      return getParameterCalls;
    },
    operations,
    snapshot: () => structuredClone(state),
  };
}

function recordState(
  state: Record<string, unknown>,
  operation: string,
  args: unknown[],
): void {
  if (operation === 'enable' || operation === 'disable') {
    state[`cap:${String(args[0])}`] = operation === 'enable';
    return;
  }
  if (operation === 'bindTexture') {
    state[`texture:${String(args[0])}`] = args[1];
    return;
  }
  if (operation === 'bindBuffer') {
    state[`buffer:${String(args[0])}`] = args[1];
    return;
  }
  if (operation === 'clear') return;
  if (operation === 'pixelStorei') {
    state[`pixel:${String(args[0])}`] = args[1];
    return;
  }
  if (operation === 'stencilFuncSeparate' || operation === 'stencilOpSeparate' || operation === 'stencilMaskSeparate') {
    state[`${operation}:${String(args[0])}`] = args.slice(1);
    return;
  }
  state[operation] = args.length === 1 ? args[0] : args;
}

function mutateEveryState(gl: WebGL2RenderingContext): void {
  gl.bindFramebuffer(gl.FRAMEBUFFER, { dirty: 'framebuffer' } as WebGLFramebuffer);
  gl.viewport(9, 8, 7, 6);
  gl.enable(gl.SCISSOR_TEST);
  gl.scissor(5, 4, 3, 2);
  gl.useProgram({ dirty: 'program' } as WebGLProgram);
  gl.bindVertexArray({ dirty: 'vao' } as WebGLVertexArrayObject);
  gl.bindBuffer(gl.ARRAY_BUFFER, { dirty: 'array' } as WebGLBuffer);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, { dirty: 'element' } as WebGLBuffer);
  gl.activeTexture(gl.TEXTURE7);
  gl.bindTexture(gl.TEXTURE_2D, { dirty: '2d' } as WebGLTexture);
  gl.bindTexture(gl.TEXTURE_CUBE_MAP, { dirty: 'cube' } as WebGLTexture);
  gl.bindTexture(gl.TEXTURE_3D, { dirty: '3d' } as WebGLTexture);
  gl.bindTexture(gl.TEXTURE_2D_ARRAY, { dirty: 'array' } as WebGLTexture);
  gl.colorMask(false, false, false, false);
  gl.depthMask(false);
  gl.stencilMaskSeparate(gl.FRONT, 0);
  gl.stencilMaskSeparate(gl.BACK, 0);
  gl.enable(gl.BLEND);
  gl.blendColor(1, 1, 1, 1);
  gl.blendEquationSeparate(gl.FUNC_SUBTRACT, gl.FUNC_REVERSE_SUBTRACT);
  gl.blendFuncSeparate(gl.ZERO, gl.ZERO, gl.ZERO, gl.ZERO);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.ALWAYS);
  gl.depthRange(0.25, 0.75);
  gl.enable(gl.CULL_FACE);
  gl.cullFace(gl.FRONT);
  gl.frontFace(gl.CW);
  gl.enable(gl.STENCIL_TEST);
  gl.stencilFuncSeparate(gl.FRONT, gl.NEVER, 3, 7);
  gl.stencilFuncSeparate(gl.BACK, gl.NEVER, 4, 8);
  gl.stencilOpSeparate(gl.FRONT, gl.REPLACE, gl.REPLACE, gl.REPLACE);
  gl.stencilOpSeparate(gl.BACK, gl.REPLACE, gl.REPLACE, gl.REPLACE);
  gl.enable(gl.POLYGON_OFFSET_FILL);
  gl.polygonOffset(2, 3);
  gl.clearColor(1, 1, 1, 1);
  gl.clearDepth(0);
  gl.clearStencil(9);
  for (const parameter of pixelStoreParameters(gl)) {
    gl.pixelStorei(parameter, 9);
  }
}

function expectedBaseline(
  gl: WebGL2RenderingContext,
  width: number,
  height: number,
): Record<string, unknown> {
  const state: Record<string, unknown> = {};
  recordState(state, 'bindFramebuffer', [gl.FRAMEBUFFER, null]);
  recordState(state, 'viewport', [0, 0, width, height]);
  recordState(state, 'disable', [gl.SCISSOR_TEST]);
  recordState(state, 'scissor', [0, 0, width, height]);
  recordState(state, 'useProgram', [null]);
  recordState(state, 'bindVertexArray', [null]);
  recordState(state, 'bindBuffer', [gl.ARRAY_BUFFER, null]);
  recordState(state, 'bindBuffer', [gl.ELEMENT_ARRAY_BUFFER, null]);
  recordState(state, 'activeTexture', [gl.TEXTURE0]);
  for (const target of [
    gl.TEXTURE_2D,
    gl.TEXTURE_CUBE_MAP,
    gl.TEXTURE_3D,
    gl.TEXTURE_2D_ARRAY,
  ]) recordState(state, 'bindTexture', [target, null]);
  recordState(state, 'colorMask', [true, true, true, true]);
  recordState(state, 'depthMask', [true]);
  recordState(state, 'stencilMaskSeparate', [gl.FRONT, 0xffffffff]);
  recordState(state, 'stencilMaskSeparate', [gl.BACK, 0xffffffff]);
  for (const capability of [
    gl.BLEND,
    gl.DEPTH_TEST,
    gl.CULL_FACE,
    gl.STENCIL_TEST,
    gl.POLYGON_OFFSET_FILL,
  ]) recordState(state, 'disable', [capability]);
  recordState(state, 'blendColor', [0, 0, 0, 0]);
  recordState(state, 'blendEquationSeparate', [gl.FUNC_ADD, gl.FUNC_ADD]);
  recordState(state, 'blendFuncSeparate', [gl.ONE, gl.ZERO, gl.ONE, gl.ZERO]);
  recordState(state, 'depthFunc', [gl.LESS]);
  recordState(state, 'depthRange', [0, 1]);
  recordState(state, 'cullFace', [gl.BACK]);
  recordState(state, 'frontFace', [gl.CCW]);
  recordState(state, 'stencilFuncSeparate', [gl.FRONT, gl.ALWAYS, 0, 0xffffffff]);
  recordState(state, 'stencilFuncSeparate', [gl.BACK, gl.ALWAYS, 0, 0xffffffff]);
  recordState(state, 'stencilOpSeparate', [gl.FRONT, gl.KEEP, gl.KEEP, gl.KEEP]);
  recordState(state, 'stencilOpSeparate', [gl.BACK, gl.KEEP, gl.KEEP, gl.KEEP]);
  recordState(state, 'polygonOffset', [0, 0]);
  recordState(state, 'clearColor', [0, 0, 0, 0]);
  recordState(state, 'clearDepth', [1]);
  recordState(state, 'clearStencil', [0]);
  for (const parameter of pixelStoreParameters(gl)) {
    const value = parameter === gl.PACK_ALIGNMENT || parameter === gl.UNPACK_ALIGNMENT ? 4 :
      parameter === gl.UNPACK_COLORSPACE_CONVERSION_WEBGL ? gl.BROWSER_DEFAULT_WEBGL : 0;
    recordState(state, 'pixelStorei', [parameter, value]);
  }
  return state;
}

function pixelStoreParameters(gl: WebGL2RenderingContext): readonly number[] {
  return [
    gl.PACK_ALIGNMENT,
    gl.PACK_ROW_LENGTH,
    gl.PACK_SKIP_PIXELS,
    gl.PACK_SKIP_ROWS,
    gl.UNPACK_ALIGNMENT,
    gl.UNPACK_ROW_LENGTH,
    gl.UNPACK_IMAGE_HEIGHT,
    gl.UNPACK_SKIP_PIXELS,
    gl.UNPACK_SKIP_ROWS,
    gl.UNPACK_SKIP_IMAGES,
    gl.UNPACK_FLIP_Y_WEBGL,
    gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,
    gl.UNPACK_COLORSPACE_CONVERSION_WEBGL,
  ];
}
