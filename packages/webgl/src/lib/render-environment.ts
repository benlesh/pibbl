import { useInternalHookSlot } from '@crc/core/internal';
import type { CRCBackendFrameInput } from '@crc/core/internal';
import type {
  CRCWebGLCameraSnapshot,
  CRCWebGLContext,
} from './types.js';
import type { WebGLStateBaseline } from './gpu/state.js';
import {
  multiplyMatrix4,
  setIdentityMatrix4,
} from './math/matrix4.js';

export interface WebGLRenderEnvironment {
  readonly gl: WebGL2RenderingContext;
  readonly contextGeneration: number;
  readonly camera: CRCWebGLCameraSnapshot;
  readonly logicalViewport: Readonly<{ width: number; height: number }>;
  readonly backingViewport: Readonly<{ width: number; height: number }>;
  readonly density: Readonly<{ x: number; y: number }>;
  readonly timestamp: number;
  readonly isContextLost: (generation: number) => boolean;
  readonly stateBaseline: WebGLStateBaseline;
  readonly modelStack: Float32Array[];
  activeContext: CRCWebGLContext | undefined;
}

export interface CreateWebGLRenderEnvironmentInput {
  readonly gl: WebGL2RenderingContext;
  readonly contextGeneration: number;
  readonly camera: CRCWebGLCameraSnapshot;
  readonly frame: CRCBackendFrameInput;
  readonly isContextLost: (generation: number) => boolean;
  readonly stateBaseline: WebGLStateBaseline;
}

export function createWebGLRenderEnvironment(
  input: CreateWebGLRenderEnvironmentInput,
): WebGLRenderEnvironment {
  const logicalViewport = Object.freeze({
    width: input.frame.logicalWidth,
    height: input.frame.logicalHeight,
  });
  const backingViewport = Object.freeze({
    width: input.frame.backingWidth,
    height: input.frame.backingHeight,
  });
  const identity = new Float32Array(16);
  setIdentityMatrix4(identity);
  return {
    gl: input.gl,
    contextGeneration: input.contextGeneration,
    camera: input.camera,
    logicalViewport,
    backingViewport,
    density: Object.freeze({
      x: backingViewport.width / logicalViewport.width,
      y: backingViewport.height / logicalViewport.height,
    }),
    timestamp: input.frame.renderTimestamp,
    isContextLost: input.isContextLost,
    stateBaseline: input.stateBaseline,
    modelStack: [identity],
    activeContext: undefined,
  };
}

export function withWebGLPrimitiveContext<T>(
  environment: WebGLRenderEnvironment,
  callback: () => T,
): T {
  const previous = environment.activeContext;
  const context = createPublicContext(environment);
  environment.activeContext = context;
  try {
    return callback();
  } finally {
    environment.activeContext = previous;
  }
}

export function pushWebGLModelMatrix(
  environment: WebGLRenderEnvironment,
  local: Readonly<Float32Array>,
): () => void {
  const composed = new Float32Array(16);
  multiplyMatrix4(
    composed,
    environment.modelStack[environment.modelStack.length - 1]!,
    local,
  );
  environment.modelStack.push(composed);
  let active = true;
  return () => {
    if (!active) return;
    if (environment.modelStack.at(-1) !== composed) {
      throw new Error('Group3D model scopes must be released in traversal order.');
    }
    active = false;
    environment.modelStack.pop();
  };
}

function createPublicContext(
  environment: WebGLRenderEnvironment,
): CRCWebGLContext {
  const resources = createResourceOperations({
    gl: environment.gl,
    contextGeneration: environment.contextGeneration,
    isContextLost: environment.isContextLost,
  });
  return Object.freeze({
    gl: environment.gl,
    contextGeneration: environment.contextGeneration,
    camera: snapshotCamera(environment.camera),
    modelMatrix: new Float32Array(environment.modelStack.at(-1)!),
    logicalViewport: environment.logicalViewport,
    backingViewport: environment.backingViewport,
    density: environment.density,
    timestamp: environment.timestamp,
    resources,
  });
}

interface WebGLResourceScope {
  readonly gl: WebGL2RenderingContext;
  readonly contextGeneration: number;
  readonly isContextLost: (generation: number) => boolean;
}

function createResourceOperations(
  scope: WebGLResourceScope,
): CRCWebGLContext['resources'] {
  return Object.freeze({
    use<T>(
      create: (gl: WebGL2RenderingContext) => T,
      release: (
        value: T,
        context: Readonly<{
          gl: WebGL2RenderingContext;
          contextLost: boolean;
        }>,
      ) => void,
      deps: readonly unknown[],
    ): T {
      return useWebGLResource(scope, create, release, deps);
    },
  });
}

interface WebGLResourceSlot<T> {
  hasValue: boolean;
  value: T | undefined;
  release: ((
    value: T,
    context: Readonly<{
      gl: WebGL2RenderingContext;
      contextLost: boolean;
    }>,
  ) => void) | undefined;
  deps: readonly unknown[] | undefined;
  gl: WebGL2RenderingContext | undefined;
  generation: number | undefined;
  isContextLost: ((generation: number) => boolean) | undefined;
}

function useWebGLResource<T>(
  scope: WebGLResourceScope,
  create: (gl: WebGL2RenderingContext) => T,
  release: (
    value: T,
    context: Readonly<{
      gl: WebGL2RenderingContext;
      contextLost: boolean;
    }>,
  ) => void,
  deps: readonly unknown[],
): T {
  const slot = useInternalHookSlot<WebGLResourceSlot<T>>(
    'webglResource',
    teardowns => {
      const owned: WebGLResourceSlot<T> = {
        hasValue: false,
        value: undefined,
        release: undefined,
        deps: undefined,
        gl: undefined,
        generation: undefined,
        isContextLost: undefined,
      };
      teardowns.add(() => releaseWebGLResource(owned));
      return owned;
    },
  ).value;
  const effectiveDeps = [scope.contextGeneration, ...deps];
  if (slot.hasValue && haveSameDependencies(slot.deps!, effectiveDeps)) {
    return slot.value as T;
  }

  releaseWebGLResource(slot);
  const value = create(scope.gl);
  slot.hasValue = true;
  slot.value = value;
  slot.release = release;
  slot.deps = Object.freeze(effectiveDeps.slice());
  slot.gl = scope.gl;
  slot.generation = scope.contextGeneration;
  slot.isContextLost = scope.isContextLost;
  return value;
}

function releaseWebGLResource<T>(slot: WebGLResourceSlot<T>): void {
  if (!slot.hasValue) return;
  const value = slot.value as T;
  const release = slot.release!;
  const gl = slot.gl!;
  const generation = slot.generation!;
  const isContextLost = slot.isContextLost!;
  slot.hasValue = false;
  slot.value = undefined;
  slot.release = undefined;
  slot.deps = undefined;
  slot.gl = undefined;
  slot.generation = undefined;
  slot.isContextLost = undefined;
  release(value, Object.freeze({
    gl,
    contextLost: isContextLost(generation),
  }));
}

function haveSameDependencies(
  previous: readonly unknown[],
  next: readonly unknown[],
): boolean {
  return previous.length === next.length &&
    previous.every((value, index) => Object.is(value, next[index]));
}

function snapshotCamera(
  camera: CRCWebGLCameraSnapshot,
): CRCWebGLCameraSnapshot {
  return Object.freeze({
    descriptor: camera.descriptor,
    aspect: camera.aspect,
    viewMatrix: new Float32Array(camera.viewMatrix),
    projectionMatrix: new Float32Array(camera.projectionMatrix),
    projectionViewMatrix: new Float32Array(camera.projectionViewMatrix),
    inverseProjectionViewMatrix: new Float32Array(
      camera.inverseProjectionViewMatrix,
    ),
  });
}
