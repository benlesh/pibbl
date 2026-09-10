import {
  createBackendToken,
  type CRCBackendDriver,
  type CRCBackendPrimitiveProgram,
} from '@crc/core/internal';
import type { SystemStyle } from '@crc/core';
import type { CRCWebGLCameraSnapshot } from './types.js';
import {
  createWebGLRenderEnvironment,
  withWebGLPrimitiveContext,
  type WebGLRenderEnvironment,
} from './render-environment.js';
import {
  beginWebGLFrame,
  installWebGLStateBaseline,
} from './gpu/state.js';

export const WEBGL_BACKEND_TOKEN = createBackendToken('webgl2');

export interface CreateWebGLBackendOptions {
  readonly gl: WebGL2RenderingContext;
  readonly getCamera: () => CRCWebGLCameraSnapshot;
  readonly getContextGeneration: () => number;
  readonly isContextLost?: (generation: number) => boolean;
}

/** Creates the package-private backend driver owned by one WebGLLayer. */
export function createWebGLBackend(
  options: CreateWebGLBackendOptions,
): CRCBackendDriver<WebGLRenderEnvironment> {
  const { gl } = options;
  const isContextLost = options.isContextLost ?? (() => gl.isContextLost());
  return {
    token: WEBGL_BACKEND_TOKEN,
    name: 'webgl2',
    beginFrame(frameInput) {
      const environment = createWebGLRenderEnvironment({
        gl,
        contextGeneration: options.getContextGeneration(),
        camera: options.getCamera(),
        frame: frameInput,
        isContextLost,
      });
      beginWebGLFrame(gl, frameInput.backingWidth, frameInput.backingHeight);
      return { environment };
    },
    enterComponent(frame) {
      const { width, height } = frame.environment.backingViewport;
      installWebGLStateBaseline(gl, width, height);
      return () => installWebGLStateBaseline(gl, width, height);
    },
    runPrimitive(frame, input, runProgram) {
      if (input.style.filter !== undefined) {
        throw new Error(
          `${input.componentName} style.filter is not supported inside ` +
          '<WebGLLayer>; apply the filter to <WebGLLayer> instead.',
        );
      }
      const program = input.definition.program as CRCBackendPrimitiveProgram<
        Record<PropertyKey, unknown>,
        SystemStyle,
        WebGLRenderEnvironment
      >;
      runProgram(() => withWebGLPrimitiveContext(
        frame.environment,
        () => program(input.props, input.style, frame.environment),
      ));
    },
    finishFrame(frame) {
      const { width, height } = frame.environment.backingViewport;
      installWebGLStateBaseline(gl, width, height);
    },
    dispose() {},
  };
}
