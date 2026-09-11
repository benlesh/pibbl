import { crc, type CRCController } from '@crc/core';
import type {
  CRCWebGLContext,
  CRCWebGLPerspectiveCamera,
} from '@crc/webgl';
import {
  createWebGLLabScene,
  WEBGL_LAB_SOURCE_ID,
  type WebGLLabFocusTarget,
  type WebGLLabMode,
  type WebGLLabState,
  type WebGLLabTarget,
} from './webgl-lab.example';
import type {
  ScenarioController,
  ScenarioDefinition,
  ScenarioMountContext,
} from './types';

export type {
  WebGLLabFocusTarget,
  WebGLLabMode,
  WebGLLabPoint,
  WebGLLabState,
  WebGLLabTarget,
} from './webgl-lab.example';
export { WEBGL_LAB_PROBES } from './webgl-lab.example';

export const WEBGL_LAB_ACTION_IDS = [
  'show-mixed-order',
  'show-depth',
  'show-transforms',
  'show-clipped',
  'show-layered',
  'show-filtered',
  'show-focus',
  'show-animation',
  'restore-context',
  'change-camera',
  'rotate-scene',
  'toggle-pointer-events',
  'swap-source-order',
  'advance-animation',
] as const;

export type WebGLLabAction = (typeof WEBGL_LAB_ACTION_IDS)[number];

const MODE_ACTIONS: Readonly<Partial<Record<WebGLLabAction, WebGLLabMode>>> = {
  'show-mixed-order': 'mixed-order',
  'show-depth': 'depth',
  'show-transforms': 'transforms',
  'show-clipped': 'clipped',
  'show-layered': 'layered',
  'show-filtered': 'filtered',
  'show-focus': 'focus',
  'show-animation': 'animation',
  'restore-context': 'context-restored',
};

function initialState(): WebGLLabState {
  return {
    mode: 'mixed-order',
    revision: 0,
    lastTarget: null,
    cubeSelections: 0,
    sphereSelections: 0,
    animationAngle: 0,
    focusTarget: 'none',
    contextGeneration: 0,
  };
}

function settledFrames(): Promise<void> {
  return new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
}

async function mountWebGLLab(
  context: ScenarioMountContext<WebGLLabState>,
): Promise<ScenarioController<WebGLLabState>> {
  const abortController = new AbortController();
  let disposed = false;
  let runtime: CRCController | undefined;
  let state = initialState();
  let camera: CRCWebGLPerspectiveCamera | undefined;
  let rotationDegrees = 0;
  let pointerEvents: 'auto' | 'none' = 'auto';
  let starFirst = false;
  let latestContext: CRCWebGLContext | undefined;
  let pending = Promise.resolve();

  const assertActive = () => {
    if (disposed) {
      throw new Error('Cannot operate on a disposed WebGL laboratory.');
    }
  };
  const publish = () => context.onStateChange?.({ ...state });
  const recordTarget = (target: WebGLLabTarget) => {
    state = { ...state, lastTarget: target };
    publish();
  };
  const recordSelection = (target: 'cube' | 'sphere') => {
    state = {
      ...state,
      lastTarget: target,
      cubeSelections:
        state.cubeSelections + (target === 'cube' ? 1 : 0),
      sphereSelections:
        state.sphereSelections + (target === 'sphere' ? 1 : 0),
    };
    publish();
  };
  const recordFocus = (target: WebGLLabFocusTarget) => {
    state = { ...state, focusTarget: target };
    publish();
  };
  const recordCubeTarget = () => recordTarget('cube');
  const recordSphereTarget = () => recordTarget('sphere');
  const recordCubeSelection = () => recordSelection('cube');
  const recordSphereSelection = () => recordSelection('sphere');
  const recordCubeFocus = () => recordFocus('cube');
  const recordSphereFocus = () => recordFocus('sphere');
  const recordContext = (webglContext: CRCWebGLContext) => {
    latestContext = webglContext;
    if (state.contextGeneration === webglContext.contextGeneration) return;
    state = {
      ...state,
      contextGeneration: webglContext.contextGeneration,
    };
    publish();
  };
  const render = () => {
    assertActive();
    runtime = crc(
      context.canvas,
      createWebGLLabScene({
        state,
        camera,
        rotationDegrees,
        pointerEvents,
        starFirst,
        onTarget: recordTarget,
        onCubeSelection: recordCubeSelection,
        onSphereSelection: recordSphereSelection,
        onCubeFocus: recordCubeFocus,
        onSphereFocus: recordSphereFocus,
        onCubeTarget: recordCubeTarget,
        onSphereTarget: recordSphereTarget,
        onContext: recordContext,
      }),
      { signal: abortController.signal, pixelRatio: 1 },
    );
    publish();
    pending = settledFrames();
    return pending;
  };
  const restoreContext = async () => {
    const webglContext = latestContext;
    if (!webglContext) {
      throw new Error('The WebGL laboratory has no committed context.');
    }
    const surface = webglContext.gl.canvas;
    const lossAccepted = surface.dispatchEvent(
      new Event('webglcontextlost', { cancelable: true }),
    );
    if (lossAccepted) {
      throw new Error(
        'The WebGL laboratory context-loss event was not canceled by its owner.',
      );
    }
    surface.dispatchEvent(new Event('webglcontextrestored'));
    pending = settledFrames();
    await pending;
  };

  await render();

  return {
    getState: () => ({ ...state }),
    perform: async (actionId) => {
      assertActive();
      if (!(WEBGL_LAB_ACTION_IDS as readonly string[]).includes(actionId)) {
        throw new Error(
          `WebGL laboratory does not support action "${actionId}".`,
        );
      }
      const action = actionId as WebGLLabAction;
      const nextMode = MODE_ACTIONS[action];
      state = {
        ...state,
        mode: nextMode ?? state.mode,
        revision: state.revision + 1,
        lastTarget: null,
        focusTarget: 'none',
        animationAngle:
          action === 'advance-animation'
            ? (state.animationAngle + 30) % 360
            : state.animationAngle,
      };
      if (action === 'change-camera') {
        camera = camera
          ? undefined
          : {
              type: 'perspective',
              position: [0, 0, 8],
              lookAt: [0, 0, 0],
              up: [0, 1, 0],
              fieldOfViewDegrees: 50,
              near: 0.1,
              far: 1000,
            };
      } else if (action === 'rotate-scene') {
        state = { ...state, mode: 'transforms' };
        rotationDegrees = (rotationDegrees + 30) % 360;
      } else if (action === 'toggle-pointer-events') {
        pointerEvents = pointerEvents === 'auto' ? 'none' : 'auto';
      } else if (action === 'swap-source-order') {
        starFirst = !starFirst;
      }
      await render();
      if (action === 'restore-context') await restoreContext();
    },
    reset: async () => {
      assertActive();
      context.canvas.blur();
      state = initialState();
      camera = undefined;
      rotationDegrees = 0;
      pointerEvents = 'auto';
      starFirst = false;
      await render();
    },
    settled: async () => {
      await pending;
      publish();
    },
    dispose: async () => {
      if (disposed) return;
      await pending;
      disposed = true;
      abortController.abort();
      runtime?.dispose();
    },
  };
}

export const webglLabScenario: ScenarioDefinition<WebGLLabState> = {
  id: 'webgl-islands',
  sourceId: WEBGL_LAB_SOURCE_ID,
  actionIds: WEBGL_LAB_ACTION_IDS,
  mount: mountWebGLLab,
  formatState: (state) => [
    { label: 'Mode', value: state.mode },
    { label: 'Revision', value: String(state.revision) },
    { label: 'Last target', value: state.lastTarget ?? 'none' },
    { label: 'Cube selections', value: String(state.cubeSelections) },
    { label: 'Sphere selections', value: String(state.sphereSelections) },
    { label: 'Animation angle', value: `${state.animationAngle}°` },
    { label: 'Focus target', value: state.focusTarget },
    { label: 'Context generation', value: String(state.contextGeneration) },
  ],
};
