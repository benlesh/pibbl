import { crc, createElement, signal, type CRCController } from '@crc/core';
import {
  WEBGL_LIGHTING_LAB_SOURCE_ID,
  WebGLLightingLabScene,
  type WebGLLightingLabBackgroundMode,
  type WebGLLightingLabCasterAlpha,
  type WebGLLightingLabConfiguration,
  type WebGLLightingLabFocusTarget,
  type WebGLLightingLabMode,
  type WebGLLightingLabState,
  type WebGLLightingLabTarget,
} from './webgl-lighting-lab.example';
import type {
  ScenarioController,
  ScenarioDefinition,
  ScenarioMountContext,
} from './types';

export type {
  WebGLLightingLabBackgroundMode,
  WebGLLightingLabCasterAlpha,
  WebGLLightingLabConfiguration,
  WebGLLightingLabFocusTarget,
  WebGLLightingLabMode,
  WebGLLightingLabState,
  WebGLLightingLabTarget,
} from './webgl-lighting-lab.example';
export { WEBGL_LIGHTING_LAB_PROBES } from './webgl-lighting-lab.example';

export const WEBGL_LIGHTING_LAB_ACTION_IDS = [
  'show-ambient',
  'show-hemisphere',
  'show-directional',
  'show-point',
  'show-spot',
  'show-all',
  'show-background-transparent',
  'show-background-opaque',
  'show-background-alpha',
  'shadows-off',
  'shadows-low',
  'shadows-medium',
  'shadows-high',
  'toggle-transformed-light',
  'caster-opaque',
  'caster-partial',
  'caster-zero',
  'toggle-lit',
  'toggle-emissive',
  'move-caster',
  'reset',
] as const;

export type WebGLLightingLabAction =
  (typeof WEBGL_LIGHTING_LAB_ACTION_IDS)[number];

const LIGHT_ACTIONS: Readonly<
  Partial<Record<WebGLLightingLabAction, WebGLLightingLabMode>>
> = {
  'show-ambient': 'ambient',
  'show-hemisphere': 'hemisphere',
  'show-directional': 'directional',
  'show-point': 'point',
  'show-spot': 'spot',
  'show-all': 'all',
};

const SHADOW_ACTIONS: Readonly<
  Partial<
    Record<
      WebGLLightingLabAction,
      WebGLLightingLabConfiguration['shadowQuality']
    >
  >
> = {
  'shadows-off': false,
  'shadows-low': 'low',
  'shadows-medium': 'medium',
  'shadows-high': 'high',
};

const ALPHA_ACTIONS: Readonly<
  Partial<Record<WebGLLightingLabAction, WebGLLightingLabCasterAlpha>>
> = {
  'caster-opaque': 'opaque',
  'caster-partial': 'partial',
  'caster-zero': 'zero',
};

const BACKGROUND_ACTIONS: Readonly<
  Partial<Record<WebGLLightingLabAction, WebGLLightingLabBackgroundMode>>
> = {
  'show-background-transparent': 'transparent',
  'show-background-opaque': 'opaque',
  'show-background-alpha': 'alpha',
};

function initialConfiguration(): WebGLLightingLabConfiguration {
  return {
    lightMode: 'all',
    backgroundMode: 'alpha',
    shadowQuality: 'medium',
    transformedLight: false,
    casterAlpha: 'opaque',
    lit: true,
    emissive: true,
    casterOffset: 0,
  };
}

function initialState(): WebGLLightingLabState {
  return {
    ...initialConfiguration(),
    revision: 0,
    lastTarget: null,
    focusTarget: 'none',
  };
}

function settledFrames(): Promise<void> {
  return new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
}

function configurationFromState(
  state: WebGLLightingLabState,
): WebGLLightingLabConfiguration {
  return {
    lightMode: state.lightMode,
    backgroundMode: state.backgroundMode,
    shadowQuality: state.shadowQuality,
    transformedLight: state.transformedLight,
    casterAlpha: state.casterAlpha,
    lit: state.lit,
    emissive: state.emissive,
    casterOffset: state.casterOffset,
  };
}

async function mountWebGLLightingLab(
  context: ScenarioMountContext<WebGLLightingLabState>,
): Promise<ScenarioController<WebGLLightingLabState>> {
  let disposed = false;
  let state = initialState();
  const configuration = signal(configurationFromState(state), {
    debugName: 'WebGL lighting laboratory controls',
  });
  const publish = () => context.onStateChange?.({ ...state });
  const recordTarget = (target: WebGLLightingLabTarget) => {
    state = { ...state, lastTarget: target };
    publish();
  };
  const recordFocus = (target: WebGLLightingLabFocusTarget) => {
    state = { ...state, focusTarget: target };
    publish();
  };
  const assertActive = () => {
    if (disposed) {
      throw new Error('Cannot operate on a disposed WebGL lighting laboratory.');
    }
  };
  const runtime: CRCController = crc(
    context.canvas,
    createElement(WebGLLightingLabScene, {
      configuration,
      onBackingTarget: () => recordTarget('backing'),
      onCasterTarget: () => recordTarget('caster'),
      onCasterFocus: () => recordFocus('caster'),
    }),
    { pixelRatio: 1 },
  );
  let pending = settledFrames();
  publish();
  await pending;

  const apply = async (next: WebGLLightingLabState) => {
    state = next;
    configuration.set(configurationFromState(state));
    publish();
    pending = settledFrames();
    await pending;
  };
  const reset = async () => {
    assertActive();
    context.canvas.blur();
    await apply(initialState());
  };

  return {
    getState: () => ({ ...state }),
    perform: async (actionId) => {
      assertActive();
      if (!(WEBGL_LIGHTING_LAB_ACTION_IDS as readonly string[]).includes(actionId)) {
        throw new Error(
          `WebGL lighting laboratory does not support action "${actionId}".`,
        );
      }
      const action = actionId as WebGLLightingLabAction;
      if (action === 'reset') {
        await reset();
        return;
      }
      const lightMode = LIGHT_ACTIONS[action] ?? state.lightMode;
      const backgroundMode =
        BACKGROUND_ACTIONS[action] ?? state.backgroundMode;
      const shadowQuality = Object.prototype.hasOwnProperty.call(
        SHADOW_ACTIONS,
        action,
      )
        ? SHADOW_ACTIONS[action]!
        : state.shadowQuality;
      const casterAlpha = ALPHA_ACTIONS[action] ?? state.casterAlpha;
      await apply({
        ...state,
        lightMode,
        backgroundMode,
        shadowQuality,
        casterAlpha,
        transformedLight:
          action === 'toggle-transformed-light'
            ? !state.transformedLight
            : state.transformedLight,
        lit: action === 'toggle-lit' ? !state.lit : state.lit,
        emissive:
          action === 'toggle-emissive' ? !state.emissive : state.emissive,
        casterOffset:
          action === 'move-caster'
            ? state.casterOffset === 0
              ? 0.55
              : 0
            : state.casterOffset,
        revision: state.revision + 1,
        lastTarget: null,
        focusTarget: 'none',
      });
    },
    reset,
    settled: async () => {
      await pending;
      await settledFrames();
    },
    dispose: async () => {
      if (disposed) return;
      await pending;
      disposed = true;
      runtime.dispose();
    },
  };
}

export const webglLightingLabScenario: ScenarioDefinition<WebGLLightingLabState> = {
  id: 'webgl-lighting',
  sourceId: WEBGL_LIGHTING_LAB_SOURCE_ID,
  actionIds: WEBGL_LIGHTING_LAB_ACTION_IDS,
  mount: mountWebGLLightingLab,
  formatState: (state) => [
    { label: 'Light', value: state.lightMode },
    { label: 'Background', value: state.backgroundMode },
    { label: 'Shadows', value: String(state.shadowQuality) },
    { label: 'Transformed', value: state.transformedLight ? 'yes' : 'no' },
    { label: 'Caster alpha', value: state.casterAlpha },
    { label: 'Lit caster', value: state.lit ? 'yes' : 'no' },
    { label: 'Emission', value: state.emissive ? 'yes' : 'no' },
    { label: 'Revision', value: String(state.revision) },
    { label: 'Last target', value: state.lastTarget ?? 'none' },
    { label: 'Focus target', value: state.focusTarget },
  ],
};
