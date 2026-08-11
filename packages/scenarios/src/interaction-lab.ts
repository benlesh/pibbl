import type {
  InteractionLabAction,
  InteractionLabState,
} from './interaction-lab.example';
import type {
  ScenarioController,
  ScenarioDefinition,
  ScenarioMountContext,
} from './types';
import { crc } from '@crc/core';
import { EventTraceRecorder } from './event-trace';
import {
  createInteractionLabScene,
  INTERACTION_LAB_SOURCE_ID,
} from './interaction-lab.example';

export type { InteractionLabAction, InteractionLabState } from './interaction-lab.example';

function initialState(lastAction: InteractionLabAction = 'mount'): InteractionLabState {
  return {
    revision: 0,
    handlerGeneration: 1,
    subtreeVisible: true,
    layerVisible: false,
    lastAction,
    trace: [],
  };
}

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

async function mountInteractionLab(
  context: ScenarioMountContext<InteractionLabState>,
): Promise<ScenarioController<InteractionLabState>> {
  const abortController = new AbortController();
  let disposed = false;
  let state = initialState();
  let pendingRender = Promise.resolve();
  const recorder = new EventTraceRecorder(() => {
    state = { ...state, trace: recorder.getEntries() };
    context.onStateChange?.({ ...state });
  });

  const assertActive = () => {
    if (disposed) {
      throw new Error('Cannot operate on a disposed interaction lab.');
    }
  };

  const render = () => {
    assertActive();
    crc(context.canvas, createInteractionLabScene({
      state,
      record: input => recorder.record(input),
    }), { signal: abortController.signal });
    context.onStateChange?.({ ...state });
    pendingRender = nextFrame();
    return pendingRender;
  };

  const transition = async (lastAction: InteractionLabAction, changes: Partial<InteractionLabState>) => {
    state = {
      ...state,
      ...changes,
      lastAction,
    };
    await render();
  };

  await render();

  return {
    getState: () => ({ ...state, trace: [...state.trace] }),
    perform: async (actionId) => {
      assertActive();
      switch (actionId as InteractionLabAction) {
        case 'rerender-100':
          for (let index = 0; index < 100; index++) {
            state = {
              ...state,
              revision: state.revision + 1,
              lastAction: 'rerender-100',
            };
            await render();
          }
          break;
        case 'replace-handler':
          await transition('replace-handler', {
            handlerGeneration: state.handlerGeneration + 1,
          });
          break;
        case 'remove-subtree':
          await transition('remove-subtree', { subtreeVisible: false });
          break;
        case 'add-layer':
          await transition('add-layer', { layerVisible: true });
          break;
        case 'remove-layer':
          await transition('remove-layer', { layerVisible: false });
          break;
        default:
          throw new Error(`Interaction lab does not support action "${actionId}".`);
      }
    },
    reset: async () => {
      assertActive();
      recorder.reset();
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

export const interactionLabScenario: ScenarioDefinition<InteractionLabState> = {
  id: 'interaction-trace-lab',
  sourceId: INTERACTION_LAB_SOURCE_ID,
  actionIds: [
    'rerender-100',
    'replace-handler',
    'remove-subtree',
    'add-layer',
    'remove-layer',
  ],
  mount: mountInteractionLab,
  formatState: state => [
    { label: 'Revision', value: String(state.revision) },
    { label: 'Handler', value: String(state.handlerGeneration) },
    { label: 'Subtree', value: state.subtreeVisible ? 'mounted' : 'removed' },
    { label: 'Layer', value: state.layerVisible ? 'mounted' : 'removed' },
    { label: 'Trace entries', value: String(state.trace.length) },
    { label: 'Last event', value: state.trace.at(-1)?.type ?? 'none' },
    { label: 'Last target', value: state.trace.at(-1)?.target ?? 'none' },
    { label: 'Last action', value: state.lastAction },
  ],
};
