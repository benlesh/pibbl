import { crc, type CRCController } from '@crc/core';
import {
  createThreeInstancingLabScene,
  THREE_INSTANCING_LAB_SOURCE_ID,
  type ThreeInstancingLabState,
  type ThreeInstancingMissBehavior,
} from './three-instancing-lab.example';
import type {
  ScenarioController,
  ScenarioDefinition,
  ScenarioMountContext,
} from './types';

export type {
  ThreeInstancingLabPoint,
  ThreeInstancingLabState,
  ThreeInstancingMissBehavior,
  ThreeInstancingResolution,
} from './three-instancing-lab.example';
export { THREE_INSTANCING_LAB_PROBES } from './three-instancing-lab.example';

/**
 * Stable action identifiers accepted by the three instancing lab scenario.
 *
 * @see {@link ThreeInstancingLabAction}
 */
export const THREE_INSTANCING_LAB_ACTION_IDS = [
  'cycle-miss-behavior',
  'resize-layer',
] as const;

/**
 * Actions supported by the three instancing lab scenario's public controller.
 *
 * @see {@link ThreeInstancingLabState}
 * @see {@link THREE_INSTANCING_LAB_ACTION_IDS}
 */
export type ThreeInstancingLabAction =
  (typeof THREE_INSTANCING_LAB_ACTION_IDS)[number];

const MISS_BEHAVIORS: readonly ThreeInstancingMissBehavior[] = [
  'pass-through',
  'block',
  'target-layer',
];

function initialState(): ThreeInstancingLabState {
  return {
    missBehavior: 'pass-through',
    lastResolution: 'none',
    tileClicks: 0,
    threeTargetClicks: 0,
    blockedThreeInputs: 0,
    cameraChanges: 0,
    targetPropagationTrace: [],
    revision: 0,
  };
}

function settledFrames(): Promise<void> {
  return new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
}

function nextMissBehavior(
  current: ThreeInstancingMissBehavior,
): ThreeInstancingMissBehavior {
  const index = MISS_BEHAVIORS.indexOf(current);
  return MISS_BEHAVIORS[(index + 1) % MISS_BEHAVIORS.length]!;
}

async function mountThreeInstancingLab(
  context: ScenarioMountContext<ThreeInstancingLabState>,
): Promise<ScenarioController<ThreeInstancingLabState>> {
  const abortController = new AbortController();
  let disposed = false;
  let runtime: CRCController | undefined;
  let state = initialState();
  let compact = false;
  let pending = Promise.resolve();

  const assertActive = () => {
    if (disposed) {
      throw new Error('Cannot operate on a disposed Three instancing laboratory.');
    }
  };
  const publish = () => context.onStateChange?.({
    ...state,
    targetPropagationTrace: [...state.targetPropagationTrace],
  });
  const render = () => {
    assertActive();
    runtime = crc(
      context.canvas,
      createThreeInstancingLabScene({
        state,
        compact,
        onTile: () => {
          state = {
            ...state,
            lastResolution: 'CRC tile',
            tileClicks: state.tileClicks + 1,
          };
          publish();
          render();
        },
        onThreeBlocked: () => {
          state = {
            ...state,
            lastResolution: 'Three blocked',
            blockedThreeInputs: state.blockedThreeInputs + 1,
          };
          publish();
          render();
        },
        onThreeTargetCapture: () => {
          state = { ...state, targetPropagationTrace: ['capture'] };
          publish();
        },
        onThreeTarget: () => {
          state = {
            ...state,
            lastResolution: 'Three target',
            threeTargetClicks: state.threeTargetClicks + 1,
            targetPropagationTrace: [
              ...state.targetPropagationTrace,
              'target',
            ],
          };
          publish();
        },
        onThreeTargetBubble: () => {
          state = {
            ...state,
            targetPropagationTrace: [
              ...state.targetPropagationTrace,
              'bubble',
            ],
          };
          publish();
          render();
        },
        onCameraChanged: () => {
          state = { ...state, cameraChanges: state.cameraChanges + 1 };
          publish();
          render();
        },
        onToolbar: () => {
          state = {
            ...state,
            missBehavior: nextMissBehavior(state.missBehavior),
            lastResolution: 'Toolbar',
            revision: state.revision + 1,
          };
          publish();
          render();
        },
      }),
      { signal: abortController.signal, pixelRatio: 1 },
    );
    publish();
    pending = settledFrames();
    return pending;
  };

  await render();

  return {
    getState: () => ({
      ...state,
      targetPropagationTrace: [...state.targetPropagationTrace],
    }),
    perform: async (actionId) => {
      assertActive();
      if (!(THREE_INSTANCING_LAB_ACTION_IDS as readonly string[]).includes(actionId)) {
        throw new Error(
          `Three instancing laboratory does not support action "${actionId}".`,
        );
      }
      if (actionId === 'cycle-miss-behavior') {
        state = {
          ...state,
          missBehavior: nextMissBehavior(state.missBehavior),
          lastResolution: 'none',
          targetPropagationTrace: [],
          revision: state.revision + 1,
        };
      } else {
        compact = !compact;
        state = {
          ...state,
          lastResolution: 'none',
          targetPropagationTrace: [],
          revision: state.revision + 1,
        };
      }
      await render();
    },
    reset: async () => {
      assertActive();
      context.canvas.blur();
      state = initialState();
      compact = false;
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

/**
 * Runnable three instancing lab scenario with observable state and deterministic actions.
 *
 * @see {@link ScenarioDefinition}
 * @see {@link ThreeInstancingLabState}
 */
export const threeInstancingLabScenario: ScenarioDefinition<ThreeInstancingLabState> = {
  id: 'three-instancing',
  sourceId: THREE_INSTANCING_LAB_SOURCE_ID,
  actionIds: THREE_INSTANCING_LAB_ACTION_IDS,
  mount: mountThreeInstancingLab,
  formatState: (state) => [
    { label: 'Miss behavior', value: state.missBehavior },
    { label: 'Last resolution', value: state.lastResolution },
    { label: 'CRC tile clicks', value: String(state.tileClicks) },
    { label: 'Three target clicks', value: String(state.threeTargetClicks) },
    { label: 'Blocked Three inputs', value: String(state.blockedThreeInputs) },
    { label: 'Camera changes', value: String(state.cameraChanges) },
    {
      label: 'Target propagation',
      value: state.targetPropagationTrace.length
        ? state.targetPropagationTrace.join(' → ')
        : 'none',
    },
    { label: 'Revision', value: String(state.revision) },
  ],
};
