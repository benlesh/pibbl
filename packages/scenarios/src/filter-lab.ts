import { pibbl } from '@pibbl/core';
import type {
  FilterLabMode,
  FilterLabOrder,
  FilterLabState,
  FilterLabTarget,
} from './filter-lab.example';
import {
  createFilterLabScene,
  FILTER_LAB_SOURCE_ID,
} from './filter-lab.example';
import type {
  ScenarioController,
  ScenarioDefinition,
  ScenarioMountContext,
} from './types';

export type {
  FilterLabMode,
  FilterLabOrder,
  FilterLabState,
  FilterLabTarget,
} from './filter-lab.example';

/**
 * Stable action identifiers accepted by the filter lab scenario.
 *
 * @see {@link FilterLabState}
 */
export const FILTER_LAB_ACTION_IDS = [
  'show-all',
  'show-ordered',
  'swap-order',
  'show-nested',
  'show-transformed',
  'show-clipped',
  'show-layered',
] as const;

type FilterLabAction = (typeof FILTER_LAB_ACTION_IDS)[number];

function initialState(): FilterLabState {
  return {
    mode: 'all',
    order: 'none',
    revision: 0,
    lastTarget: null,
  };
}

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

function stateFor(action: FilterLabAction, state: Readonly<FilterLabState>): FilterLabState {
  const mode: FilterLabMode = action === 'show-all' ? 'all' :
    action === 'show-ordered' || action === 'swap-order' ? 'ordered' :
    action.slice(5) as Exclude<FilterLabMode, 'all' | 'ordered'>;
  const order: FilterLabOrder = action === 'show-ordered' ? 'grayscale-then-shadow' :
    action === 'swap-order' ? 'shadow-then-grayscale' :
    action === 'show-nested' ? 'inside-out' : 'none';
  return {
    mode,
    order,
    revision: state.revision + 1,
    lastTarget: null,
  };
}

async function mountFilterLab(
  context: ScenarioMountContext<FilterLabState>,
): Promise<ScenarioController<FilterLabState>> {
  const abortController = new AbortController();
  let disposed = false;
  let state = initialState();
  let pendingRender = Promise.resolve();

  const assertActive = () => {
    if (disposed) {
      throw new Error('Cannot operate on a disposed filter laboratory.');
    }
  };
  const publish = () => context.onStateChange?.({ ...state });
  const render = () => {
    assertActive();
    pibbl(context.canvas, createFilterLabScene({
      state,
      recordTarget: (target: FilterLabTarget) => {
        state = { ...state, lastTarget: target };
        publish();
      },
    }), { signal: abortController.signal });
    publish();
    pendingRender = nextFrame();
    return pendingRender;
  };

  await render();

  return {
    getState: () => ({ ...state }),
    perform: async (actionId) => {
      assertActive();
      if (!(FILTER_LAB_ACTION_IDS as readonly string[]).includes(actionId)) {
        throw new Error(`Filter laboratory does not support action "${actionId}".`);
      }
      state = stateFor(actionId as FilterLabAction, state);
      await render();
    },
    reset: async () => {
      assertActive();
      state = initialState();
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

export const filterLabScenario: ScenarioDefinition<FilterLabState> = {
  id: 'first-class-filters',
  sourceId: FILTER_LAB_SOURCE_ID,
  actionIds: FILTER_LAB_ACTION_IDS,
  mount: mountFilterLab,
  formatState: state => [
    { label: 'Mode', value: state.mode },
    { label: 'Order', value: state.order },
    { label: 'Revision', value: String(state.revision) },
    { label: 'Last target', value: state.lastTarget ?? 'none' },
  ],
};
