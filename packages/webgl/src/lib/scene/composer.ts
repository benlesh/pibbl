import { multiplyMatrix4, setIdentityMatrix4 } from '../math/matrix4.js';
import type {
  ClosedWebGLSceneDraft,
  CreateWebGLSceneComposerInput,
  SubmitWebGLMeshInput,
  WebGLMeshSubmission,
  WebGLSceneComposer,
} from './types.js';
import type { ResolvedWebGLCamera } from '../math/camera.js';

interface MutableComposer extends WebGLSceneComposer {
  readonly modelStack: Float32Array[];
  readonly meshes: WebGLMeshSubmission[];
  state: 'open' | 'closed';
  nextSourceIndex: number;
}

const requireOpen = (composer: WebGLSceneComposer): MutableComposer => {
  const value = composer as MutableComposer;
  if (value.state !== 'open') throw new Error('WebGL scene composer is already closed.');
  return value;
};

const snapshotCamera = (camera: ResolvedWebGLCamera): ResolvedWebGLCamera => Object.freeze({
  descriptor: Object.freeze({
    ...camera.descriptor,
    position: Object.freeze([...camera.descriptor.position]) as ResolvedWebGLCamera['descriptor']['position'],
    lookAt: Object.freeze([...camera.descriptor.lookAt]) as ResolvedWebGLCamera['descriptor']['lookAt'],
    up: Object.freeze([...camera.descriptor.up]) as ResolvedWebGLCamera['descriptor']['up'],
  }),
  aspect: camera.aspect,
  viewMatrix: new Float32Array(camera.viewMatrix),
  projectionMatrix: new Float32Array(camera.projectionMatrix),
  projectionViewMatrix: new Float32Array(camera.projectionViewMatrix),
  inverseProjectionViewMatrix: new Float32Array(camera.inverseProjectionViewMatrix),
  viewport: Object.freeze({ ...camera.viewport }),
  generationValues: Object.freeze([...camera.generationValues]),
});

export function createWebGLSceneComposer(
  input: CreateWebGLSceneComposerInput,
): WebGLSceneComposer {
  const logicalViewport = Object.freeze({
    width: input.frame.logicalWidth,
    height: input.frame.logicalHeight,
  });
  const backingViewport = Object.freeze({
    width: input.frame.backingWidth,
    height: input.frame.backingHeight,
  });
  const density = Object.freeze({
    x: backingViewport.width / logicalViewport.width,
    y: backingViewport.height / logicalViewport.height,
  });
  const identity = new Float32Array(16);
  setIdentityMatrix4(identity);
  return {
    contextGeneration: input.contextGeneration,
    camera: snapshotCamera(input.camera),
    logicalViewport,
    backingViewport,
    density,
    timestamp: input.frame.renderTimestamp,
    meshes: [],
    modelStack: [identity],
    state: 'open',
    nextSourceIndex: 0,
  } as MutableComposer;
}

export function pushWebGLModelMatrix(
  composer: WebGLSceneComposer,
  local: Readonly<Float32Array>,
): () => void {
  const value = requireOpen(composer);
  const composed = new Float32Array(16);
  multiplyMatrix4(composed, value.modelStack.at(-1)!, local);
  value.modelStack.push(composed);
  let active = true;
  return () => {
    if (!active) return;
    if (value.modelStack.at(-1) !== composed) {
      throw new Error('Group3D model scopes must be released in traversal order.');
    }
    active = false;
    value.modelStack.pop();
  };
}

export function submitWebGLMesh(
  composer: WebGLSceneComposer,
  input: SubmitWebGLMeshInput,
): void {
  const value = requireOpen(composer);
  const model = new Float32Array(16);
  multiplyMatrix4(model, value.modelStack.at(-1)!, input.localModel);
  value.meshes.push(Object.freeze({
    kind: 'mesh' as const,
    componentName: input.componentName,
    source: input.source,
    geometry: input.geometry,
    model,
    color: Object.freeze([...input.color]) as unknown as WebGLMeshSubmission['color'],
    sourceIndex: value.nextSourceIndex++,
    target: input.target,
    keyboardNavigationBounds: input.keyboardNavigationBounds,
  }));
}

export function closeWebGLSceneComposer(
  composer: WebGLSceneComposer,
): ClosedWebGLSceneDraft {
  const value = requireOpen(composer);
  if (value.modelStack.length !== 1) {
    throw new Error('Cannot close WebGL scene composer with an unbalanced model stack.');
  }
  value.state = 'closed';
  const draft = Object.freeze({
    contextGeneration: value.contextGeneration,
    camera: value.camera,
    logicalViewport: value.logicalViewport,
    backingViewport: value.backingViewport,
    density: value.density,
    timestamp: value.timestamp,
    meshes: Object.freeze(value.meshes.slice()),
  });
  return draft;
}

export function discardWebGLSceneComposer(composer: WebGLSceneComposer): void {
  requireOpen(composer).state = 'closed';
}
