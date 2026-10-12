import type { SmokeScenarioState } from './smoke.example';
import type {
  ScenarioController,
  ScenarioDefinition,
  ScenarioMountContext,
} from './types';
import { pibbl } from '@pibbl/core';
import { createSmokeScene, SMOKE_SOURCE_ID } from './smoke.example';

export { type SmokeScenarioAction, type SmokeScenarioState } from './smoke.example';

function initialState(lastAction: SmokeScenarioState['lastAction'] = 'mount'): SmokeScenarioState {
  return {
    revision: 0,
    clicks: 0,
    lastAction,
  };
}

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

async function mountSmokeScenario(
  context: ScenarioMountContext<SmokeScenarioState>,
): Promise<ScenarioController<SmokeScenarioState>> {
  const abortController = new AbortController();
  let disposed = false;
  let state = initialState();
  let pendingRender = Promise.resolve();

  const assertActive = () => {
    if (disposed) {
      throw new Error('Cannot operate on a disposed smoke scenario.');
    }
  };

  const render = () => {
    assertActive();
    pibbl(
      context.canvas,
      createSmokeScene({
        state,
        onClick: () => {
          state = {
            ...state,
            clicks: state.clicks + 1,
            lastAction: 'click',
          };
          render();
        },
      }),
      { signal: abortController.signal },
    );
    context.onStateChange?.({ ...state });
    pendingRender = nextFrame();
    return pendingRender;
  };

  await render();

  return {
    getState: () => ({ ...state }),
    perform: async (actionId) => {
      assertActive();
      if (actionId !== 'update') {
        throw new Error(`Smoke scenario does not support action "${actionId}".`);
      }
      state = {
        ...state,
        revision: state.revision + 1,
        lastAction: 'update',
      };
      await render();
    },
    reset: async () => {
      assertActive();
      state = initialState('reset');
      await render();
    },
    settled: async () => {
      await pendingRender;
    },
    dispose: async () => {
      if (disposed) {
        return;
      }
      await pendingRender;
      disposed = true;
      abortController.abort();
    },
  };
}

/**
 * Runnable smoke scenario with observable state and deterministic actions.
 *
 * @see {@link ScenarioDefinition}
 * @see {@link SmokeScenarioState}
 */
export const smokeScenario: ScenarioDefinition<SmokeScenarioState> = {
  id: 'baseline-smoke',
  sourceId: SMOKE_SOURCE_ID,
  actionIds: ['update'],
  mount: mountSmokeScenario,
  formatState: state => [
    { label: 'Revision', value: String(state.revision) },
    { label: 'Clicks', value: String(state.clicks) },
    { label: 'Last action', value: state.lastAction },
  ],
};
