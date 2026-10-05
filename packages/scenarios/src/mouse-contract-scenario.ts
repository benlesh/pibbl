import type { MouseContractScenarioState } from './mouse-contract.example';
import type {
  ScenarioController,
  ScenarioDefinition,
  ScenarioMountContext,
} from './types';
import { crc } from '@crc/core';
import {
  formatContractTrace,
  formatOrderingPolicy,
  getMouseContractCase,
  MOUSE_CONTRACT_CASES,
} from './mouse-contract';
import {
  createMouseContractScene,
  MOUSE_CONTRACT_SOURCE_ID,
} from './mouse-contract.example';

export type { MouseContractScenarioState } from './mouse-contract.example';

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

async function mountMouseContractScenario(
  context: ScenarioMountContext<MouseContractScenarioState>,
): Promise<ScenarioController<MouseContractScenarioState>> {
  const abortController = new AbortController();
  let disposed = false;
  let state: MouseContractScenarioState = {
    caseId: MOUSE_CONTRACT_CASES[0].id,
    lastAction: 'mount',
    interactionCount: 0,
    lastInteractionTarget: null,
  };
  let pendingRender = Promise.resolve();

  const assertActive = () => {
    if (disposed) {
      throw new Error('Cannot operate on a disposed mouse contract scenario.');
    }
  };

  const render = () => {
    assertActive();
    const contractCase = getMouseContractCase(state.caseId);
    if (!contractCase) {
      throw new Error(`Unknown mouse contract case "${state.caseId}".`);
    }
    crc(context.canvas, createMouseContractScene(contractCase, (target) => {
      state = {
        ...state,
        interactionCount: state.interactionCount + 1,
        lastInteractionTarget: target,
      };
      context.onStateChange?.({ ...state });
    }), { signal: abortController.signal });
    context.onStateChange?.({ ...state });
    pendingRender = nextFrame();
    return pendingRender;
  };

  await render();
  return {
    getState: () => ({ ...state }),
    perform: async (actionId) => {
      assertActive();
      const caseId = actionId.startsWith('show-') ? actionId.slice(5) : '';
      if (!getMouseContractCase(caseId)) {
        throw new Error(`Mouse contract scenario does not support action "${actionId}".`);
      }
      state = {
        caseId,
        lastAction: 'select',
        interactionCount: 0,
        lastInteractionTarget: null,
      };
      await render();
    },
    reset: async () => {
      assertActive();
      state = {
        caseId: MOUSE_CONTRACT_CASES[0].id,
        lastAction: 'reset',
        interactionCount: 0,
        lastInteractionTarget: null,
      };
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
 * Runnable mouse contract scenario with observable state and deterministic actions.
 *
 * @see {@link ScenarioDefinition}
 * @see {@link MouseContractScenarioState}
 */
export const mouseContractScenario: ScenarioDefinition<MouseContractScenarioState> = {
  id: 'mouse-interaction-contract',
  sourceId: MOUSE_CONTRACT_SOURCE_ID,
  actionIds: MOUSE_CONTRACT_CASES.map(contractCase => `show-${contractCase.id}`),
  mount: mountMouseContractScenario,
  formatState: (state) => {
    const contractCase = getMouseContractCase(state.caseId)!;
    return [
      { label: 'Case', value: contractCase.title },
      { label: 'Gesture', value: contractCase.gesture },
      { label: 'Native reference', value: formatContractTrace(contractCase.nativeTrace) },
      { label: 'Approved CRC (logical route)', value: formatContractTrace(contractCase.crcTrace) },
      { label: 'Ordering', value: formatOrderingPolicy(contractCase.ordering) },
      {
        label: 'Target policy',
        value: `${contractCase.targeting.candidatePolicy} · ${contractCase.targeting.identityPolicy}`,
      },
      { label: 'Rule', value: contractCase.rule },
      { label: 'Last probe target', value: state.lastInteractionTarget ?? 'none' },
    ];
  },
};
