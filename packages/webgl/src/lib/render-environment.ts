import {
  releaseBackendEventTarget,
  useInternalHookSlot,
} from '@crc/core/internal';
import type {
  CRCBackendFrameInput,
  CRCEventTargetRegistration,
} from '@crc/core/internal';
import type {
  CRCWebGLCameraSnapshot,
  CRCWebGLContext,
  CRCWebGLHitCapability,
} from './types.js';
import type { WebGLStateBaseline } from './gpu/state.js';
import type { WebGLGPUResourceCache } from './gpu/resources.js';
import {
  createWebGLPickLedger,
  recordCustomWebGLPick,
  recordGeometryWebGLPick,
  type CRCWebGLPickRecord,
  type MutableCRCWebGLPickLedger,
} from './pick-ledger.js';
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
  readonly gpuResources: WebGLGPUResourceCache;
  readonly resourceRegistry: WebGLResourceGenerationRegistry;
  readonly modelStack: Float32Array[];
  readonly pickLedger: MutableCRCWebGLPickLedger;
  readonly pickEntries: CRCWebGLPickRecord[];
  primitivePickModel: Readonly<Float32Array> | undefined;
  activeContext: CRCWebGLContext | undefined;
}

export interface CreateWebGLRenderEnvironmentInput {
  readonly gl: WebGL2RenderingContext;
  readonly contextGeneration: number;
  readonly camera: CRCWebGLCameraSnapshot;
  readonly frame: CRCBackendFrameInput;
  readonly isContextLost: (generation: number) => boolean;
  readonly stateBaseline: WebGLStateBaseline;
  readonly gpuResources: WebGLGPUResourceCache;
  readonly resourceRegistry: WebGLResourceGenerationRegistry;
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
  const pickLedger = createWebGLPickLedger(
    logicalViewport.width,
    logicalViewport.height,
  );
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
    gpuResources: input.gpuResources,
    resourceRegistry: input.resourceRegistry,
    modelStack: [identity],
    pickLedger,
    pickEntries: pickLedger.entries,
    primitivePickModel: undefined,
    activeContext: undefined,
  };
}

interface WebGLPrimitivePickInput {
  readonly componentName: string;
  readonly target: CRCEventTargetRegistration;
  readonly keyboardNavigationBounds:
    CRCEventTargetRegistration['keyboardNavigationBounds'];
  readonly hit: Exclude<
    CRCWebGLHitCapability<unknown, Readonly<Record<PropertyKey, unknown>>>,
    { readonly kind: 'none' }
  >;
  readonly props: Readonly<Record<PropertyKey, unknown>>;
  readonly style: Readonly<Record<PropertyKey, unknown>>;
}

/** Resets the one-draw model override before a primitive callback executes. */
export function beginWebGLPrimitivePick(
  context: CRCWebGLContext,
): void {
  requireContextEnvironment(context).primitivePickModel = undefined;
}

/** Appends a successful primitive's pick record before child traversal begins. */
export function recordWebGLPrimitivePick(
  context: CRCWebGLContext,
  input: WebGLPrimitivePickInput,
): void {
  const environment = requireContextEnvironment(context);
  const model = environment.primitivePickModel ??
    environment.modelStack.at(-1)!;
  const sourceOrder = environment.pickEntries.length;
  if (input.hit.kind === 'geometry') {
    recordGeometryWebGLPick(environment.pickLedger, {
      componentName: input.componentName,
      target: input.target,
      geometry: input.hit.geometry(input.props, input.style),
      model,
      camera: environment.camera,
      keyboardNavigationBounds: input.keyboardNavigationBounds,
      sourceOrder,
      depthMode: 'less-equal',
    });
    return;
  }
  recordCustomWebGLPick(environment.pickLedger, {
    componentName: input.componentName,
    target: input.target,
    resolve: input.hit.resolve,
    props: input.props,
    style: input.style,
    model,
    keyboardNavigationBounds: input.keyboardNavigationBounds,
    camera: environment.camera,
    sourceOrder,
    depthMode: 'less-equal',
  });
}

/** Clears per-primitive state after success or failure. */
export function finishWebGLPrimitivePick(
  context: CRCWebGLContext,
): void {
  requireContextEnvironment(context).primitivePickModel = undefined;
}

/** Releases logical participation belonging only to discarded frame data. */
export function releaseWebGLPickParticipation(
  entries: readonly CRCWebGLPickRecord[],
): void {
  const targets = new Set<CRCEventTargetRegistration>();
  for (const entry of entries) targets.add(entry.target);
  for (const target of targets) {
    runRelease(() => releaseBackendEventTarget(target));
  }
}

/** Publishes the exact model used by the active built-in draw for picking. */
export function setWebGLPrimitivePickModel(
  context: CRCWebGLContext,
  model: Readonly<Float32Array>,
): void {
  const environment = requireContextEnvironment(context);
  environment.primitivePickModel = model;
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
    resourceRegistry: environment.resourceRegistry,
  });
  const context = Object.freeze({
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
  contextGPUResources.set(context, environment.gpuResources);
  contextEnvironments.set(context, environment);
  return context;
}

const contextGPUResources = new WeakMap<
  CRCWebGLContext,
  WebGLGPUResourceCache
>();
const contextEnvironments = new WeakMap<
  CRCWebGLContext,
  WebGLRenderEnvironment
>();

function requireContextEnvironment(
  context: CRCWebGLContext,
): WebGLRenderEnvironment {
  const environment = contextEnvironments.get(context);
  if (!environment || environment.activeContext !== context) {
    throw new Error(
      'WebGL pick registration requires the active primitive context.',
    );
  }
  return environment;
}

/** Package-private access to the current layer's generation-owned cache. */
export function getWebGLGPUResources(
  context: CRCWebGLContext,
): WebGLGPUResourceCache {
  const resources = contextGPUResources.get(context);
  if (!resources) {
    throw new Error('WebGL built-in rendering requires an active GPU cache.');
  }
  return resources;
}

interface WebGLResourceScope {
  readonly gl: WebGL2RenderingContext;
  readonly contextGeneration: number;
  readonly isContextLost: (generation: number) => boolean;
  readonly resourceRegistry: WebGLResourceGenerationRegistry;
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
  registry: WebGLResourceGenerationRegistry | undefined;
}

/** Tracks live component-owned resources so a lost context invalidates now. */
export class WebGLResourceGenerationRegistry {
  private readonly slots = new Set<WebGLResourceSlot<unknown>>();

  add(slot: WebGLResourceSlot<unknown>): void {
    this.slots.add(slot);
  }

  remove(slot: WebGLResourceSlot<unknown>): void {
    this.slots.delete(slot);
  }

  invalidateGeneration(generation: number): void {
    for (const slot of Array.from(this.slots)) {
      if (slot.generation !== generation) continue;
      runRelease(() => releaseWebGLResource(slot));
    }
  }

  dispose(isContextLost: (generation: number) => boolean): void {
    for (const slot of Array.from(this.slots)) {
      const generation = slot.generation;
      runRelease(() => releaseWebGLResource(
        slot,
        generation === undefined ? undefined : isContextLost(generation),
      ));
    }
  }
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
        registry: undefined,
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
  slot.registry = scope.resourceRegistry;
  scope.resourceRegistry.add(slot as WebGLResourceSlot<unknown>);
  return value;
}

function releaseWebGLResource<T>(
  slot: WebGLResourceSlot<T>,
  contextLostOverride?: boolean,
): void {
  if (!slot.hasValue) return;
  const value = slot.value as T;
  const release = slot.release!;
  const gl = slot.gl!;
  const generation = slot.generation!;
  const isContextLost = slot.isContextLost!;
  const registry = slot.registry;
  slot.hasValue = false;
  slot.value = undefined;
  slot.release = undefined;
  slot.deps = undefined;
  slot.gl = undefined;
  slot.generation = undefined;
  slot.isContextLost = undefined;
  slot.registry = undefined;
  registry?.remove(slot as WebGLResourceSlot<unknown>);
  release(value, Object.freeze({
    gl,
    contextLost: contextLostOverride ?? isContextLost(generation),
  }));
}

function runRelease(release: () => void): void {
  try {
    release();
  } catch (error) {
    try {
      globalThis.reportError(error);
    } catch {
      // Reporting cannot suppress release of later generation-owned resources.
    }
  }
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
