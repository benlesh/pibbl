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
  createWebGLStateBaseline,
  installWebGLStateBaseline,
  type WebGLStateBaseline,
} from './gpu/state.js';
import { getWebGLPrimitiveHitMetadata } from './primitive-metadata.js';
import { WebGLGPUResourceCache } from './gpu/resources.js';

export const WEBGL_BACKEND_TOKEN = createBackendToken('webgl2');

export interface CreateWebGLBackendOptions {
  readonly gl: WebGL2RenderingContext;
  readonly getCamera: () => CRCWebGLCameraSnapshot;
  readonly getContextGeneration: () => number;
  readonly isContextLost?: (generation: number) => boolean;
}

export interface WebGLCompletedFrame {
  readonly renderedGeneration: number;
  readonly contextGeneration: number;
  readonly ownedResourceGeneration: number;
  readonly pickEntries: readonly unknown[];
}

export interface WebGLBackendDriver
  extends CRCBackendDriver<WebGLRenderEnvironment> {
  readonly renderedGeneration: number;
  readonly ownedResourceGeneration: number;
  hasCompletedFrame(): boolean;
  takeFailedFrameTimestamp(): number | undefined;
  takeCompletedFrame(): WebGLCompletedFrame;
}

/** Creates the package-private backend driver owned by one WebGLLayer. */
export function createWebGLBackend(
  options: CreateWebGLBackendOptions,
): WebGLBackendDriver {
  const { gl } = options;
  const isContextLost = options.isContextLost ?? (() => gl.isContextLost());
  let baselineGeneration: number | undefined;
  let stateBaseline: WebGLStateBaseline | undefined;
  let gpuResourceGeneration: number | undefined;
  let gpuResources: WebGLGPUResourceCache | undefined;
  let completedFrame: WebGLCompletedFrame | undefined;
  let failedFrameTimestamp: number | undefined;
  let renderedGeneration = 0;
  let ownedResourceGeneration = 0;
  return {
    token: WEBGL_BACKEND_TOKEN,
    name: 'webgl2',
    get renderedGeneration() {
      return renderedGeneration;
    },
    get ownedResourceGeneration() {
      return ownedResourceGeneration;
    },
    beginFrame(frameInput) {
      const contextGeneration = options.getContextGeneration();
      if (
        gpuResources === undefined ||
        gpuResourceGeneration !== contextGeneration
      ) {
        if (gpuResources !== undefined && gpuResourceGeneration !== undefined) {
          gpuResources.dispose(isContextLost(gpuResourceGeneration));
        }
        gpuResources = new WebGLGPUResourceCache(gl, contextGeneration);
        gpuResourceGeneration = contextGeneration;
        ownedResourceGeneration += 1;
      }
      if (
        stateBaseline === undefined ||
        baselineGeneration !== contextGeneration
      ) {
        stateBaseline = createWebGLStateBaseline(gl);
        baselineGeneration = contextGeneration;
      }
      const environment = createWebGLRenderEnvironment({
        gl,
        contextGeneration,
        camera: options.getCamera(),
        frame: frameInput,
        isContextLost,
        stateBaseline,
        gpuResources,
      });
      beginWebGLFrame(
        gl,
        frameInput.backingWidth,
        frameInput.backingHeight,
        stateBaseline,
      );
      return { environment };
    },
    enterComponent(frame) {
      const { width, height } = frame.environment.backingViewport;
      const { stateBaseline: frameBaseline } = frame.environment;
      installWebGLStateBaseline(gl, width, height, frameBaseline);
      return () => installWebGLStateBaseline(
        gl,
        width,
        height,
        frameBaseline,
      );
    },
    runPrimitive(frame, input, runProgram) {
      const hit = getWebGLPrimitiveHitMetadata(input.definition.program);
      if (hit?.kind === 'none') {
        assertDecorativeNonParticipation(
          input.componentName,
          input.props,
          input.style,
        );
      }
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
    finishFrame(frame, success) {
      const { width, height } = frame.environment.backingViewport;
      installWebGLStateBaseline(
        gl,
        width,
        height,
        frame.environment.stateBaseline,
      );
      if (success) {
        renderedGeneration += 1;
        failedFrameTimestamp = undefined;
        completedFrame = Object.freeze({
          renderedGeneration,
          contextGeneration: frame.environment.contextGeneration,
          ownedResourceGeneration,
          pickEntries: Object.freeze(frame.environment.pickEntries.slice()),
        });
      } else {
        completedFrame = undefined;
        failedFrameTimestamp = frame.environment.timestamp;
      }
    },
    hasCompletedFrame() {
      return completedFrame !== undefined;
    },
    takeFailedFrameTimestamp() {
      const timestamp = failedFrameTimestamp;
      failedFrameTimestamp = undefined;
      return timestamp;
    },
    takeCompletedFrame() {
      const completed = completedFrame;
      completedFrame = undefined;
      if (!completed) {
        throw new Error('WebGLLayer child traversal did not complete a frame.');
      }
      return completed;
    },
    dispose() {
      completedFrame = undefined;
      failedFrameTimestamp = undefined;
      if (gpuResources !== undefined && gpuResourceGeneration !== undefined) {
        gpuResources.dispose(isContextLost(gpuResourceGeneration));
      }
      gpuResources = undefined;
      gpuResourceGeneration = undefined;
      stateBaseline = undefined;
      baselineGeneration = undefined;
    },
  };
}

function assertDecorativeNonParticipation(
  componentName: string,
  props: Readonly<Record<PropertyKey, unknown>>,
  style: Readonly<SystemStyle>,
): void {
  const hasEventHandler = Object.entries(props).some(
    ([name, value]) => /^on[A-Z]/.test(name) && typeof value === 'function',
  );
  const styleRecord = style as Readonly<Record<PropertyKey, unknown>>;
  if (
    (props.pointerEvents !== undefined && props.pointerEvents !== 'none') ||
    props.keyboardFocusable !== undefined ||
    props.keyboardNavigationBounds !== undefined ||
    props.cursor !== undefined ||
    styleRecord.cursor !== undefined ||
    hasEventHandler
  ) {
    throw new Error(
      `${componentName} is decorative (hit kind "none"); event, focus, and ` +
      'cursor participation is unsupported.',
    );
  }
}
