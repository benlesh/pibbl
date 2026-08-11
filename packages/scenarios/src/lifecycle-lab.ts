import type {
  LifecycleLabAction,
  LifecycleLabRuntime,
  LifecycleLabState,
  LifecycleLabTarget,
} from './lifecycle-lab.example';
import type { ScenarioController, ScenarioDefinition, ScenarioMountContext } from './types';
import { crc } from '@crc/core';
import { createLifecycleLabScene, LIFECYCLE_LAB_SOURCE_ID } from './lifecycle-lab.example';

export type {
  LifecycleLabAction,
  LifecycleLabLastAction,
  LifecycleLabRuntime,
  LifecycleLabState,
  LifecycleLabTarget,
} from './lifecycle-lab.example';

interface InnerRuntime {
  abortController: AbortController;
  controller: ReturnType<typeof crc>;
  status: LifecycleLabRuntime;
}

function emptyTargetCalls(): Record<LifecycleLabTarget, number> {
  return {
    primary: 0,
    subtree: 0,
    throwing: 0,
    safe: 0,
    layer: 0,
  };
}

function initialState(lastAction: LifecycleLabAction = 'mount'): LifecycleLabState {
  return {
    runtime: 'mounted',
    mountGeneration: 0,
    revision: 0,
    handlerGeneration: 1,
    handlerRemoved: false,
    subtreeVisible: true,
    layerVisible: false,
    calls: 0,
    targetCalls: emptyTargetCalls(),
    lastTarget: null,
    lastHandlerGeneration: null,
    cleanupRequests: 0,
    lastAction,
  };
}

function snapshotState(state: LifecycleLabState): LifecycleLabState {
  return {
    ...state,
    targetCalls: { ...state.targetCalls },
  };
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

async function mountLifecycleLab(
  context: ScenarioMountContext<LifecycleLabState>,
): Promise<ScenarioController<LifecycleLabState>> {
  let outerDisposed = false;
  let state = initialState();
  let currentRuntime: InnerRuntime | undefined;
  let staleRuntime: InnerRuntime | undefined;
  let pendingRender = Promise.resolve();
  const runtimes = new Set<InnerRuntime>();

  const assertOuterActive = () => {
    if (outerDisposed) {
      throw new Error('Cannot operate on a disposed lifecycle laboratory.');
    }
  };

  const publish = () => {
    context.onStateChange?.(snapshotState(state));
  };

  const recordCall = (target: LifecycleLabTarget, handlerGeneration: number): void => {
    state = {
      ...state,
      calls: state.calls + 1,
      targetCalls: {
        ...state.targetCalls,
        [target]: state.targetCalls[target] + 1,
      },
      lastTarget: target,
      lastHandlerGeneration: handlerGeneration,
      lastAction: `click-${target}`,
    };
    publish();
    if (currentRuntime?.status === 'mounted') {
      void render();
    }
  };

  const render = () => {
    assertOuterActive();
    if (!currentRuntime || currentRuntime.status !== 'mounted') {
      throw new Error('The lifecycle laboratory runtime must be remounted before rendering.');
    }
    crc(
      context.canvas,
      createLifecycleLabScene({
        state,
        recordCall,
      }),
      { signal: currentRuntime.abortController.signal },
    );
    publish();
    pendingRender = nextFrame();
    return pendingRender;
  };

  const mountRuntime = async (lastAction: LifecycleLabAction) => {
    const abortController = new AbortController();
    state = {
      ...state,
      runtime: 'mounted',
      mountGeneration: state.mountGeneration + 1,
      lastAction,
    };
    const controller = crc(
      context.canvas,
      createLifecycleLabScene({
        state,
        recordCall,
      }),
      { signal: abortController.signal },
    );
    currentRuntime = { abortController, controller, status: 'mounted' };
    runtimes.add(currentRuntime);
    publish();
    pendingRender = nextFrame();
    await pendingRender;
  };

  const transition = async (lastAction: LifecycleLabAction, changes: Partial<LifecycleLabState>) => {
    state = { ...state, ...changes, lastAction };
    await render();
  };

  const cleanupRuntime = (runtime: InnerRuntime): void => {
    runtime.abortController.abort();
    runtime.controller.dispose();
  };

  await mountRuntime('mount');

  return {
    getState: () => snapshotState(state),
    perform: async (actionId) => {
      assertOuterActive();
      const action = actionId as LifecycleLabAction;
      switch (action) {
        case 'rerender-1000':
          for (let index = 0; index < 1_000; index++) {
            state = {
              ...state,
              revision: state.revision + 1,
              lastAction: action,
            };
            await render();
          }
          break;
        case 'replace-handler':
          await transition(action, {
            handlerGeneration: state.handlerGeneration + 1,
            handlerRemoved: false,
          });
          break;
        case 'remove-handler':
          await transition(action, { handlerRemoved: true });
          break;
        case 'remove-subtree':
          await transition(action, { subtreeVisible: false });
          break;
        case 'add-layer':
          await transition(action, { layerVisible: true });
          break;
        case 'remove-layer':
          await transition(action, { layerVisible: false });
          break;
        case 'abort-runtime':
          if (!currentRuntime) {
            throw new Error('The lifecycle laboratory has no runtime to abort.');
          }
          await pendingRender;
          currentRuntime.abortController.abort();
          currentRuntime.status = 'aborted';
          state = {
            ...state,
            runtime: 'aborted',
            cleanupRequests: state.cleanupRequests + 1,
            lastAction: action,
          };
          publish();
          break;
        case 'dispose-runtime':
          if (!currentRuntime) {
            throw new Error('The lifecycle laboratory has no runtime to dispose.');
          }
          await pendingRender;
          currentRuntime.controller.dispose();
          currentRuntime.status = 'disposed';
          state = {
            ...state,
            runtime: 'disposed',
            cleanupRequests: state.cleanupRequests + 1,
            lastAction: action,
          };
          publish();
          break;
        case 'cleanup-again':
          if (!currentRuntime) {
            throw new Error('The lifecycle laboratory has no runtime to clean again.');
          }
          await pendingRender;
          if (currentRuntime.status === 'aborted') {
            currentRuntime.abortController.abort();
          } else if (currentRuntime.status === 'disposed') {
            currentRuntime.controller.dispose();
          }
          state = {
            ...state,
            cleanupRequests: state.cleanupRequests + 1,
            lastAction: action,
          };
          if (currentRuntime.status === 'mounted') {
            await render();
          } else {
            publish();
          }
          break;
        case 'remount-runtime':
          await pendingRender;
          if (currentRuntime) {
            if (currentRuntime.status === 'mounted') {
              currentRuntime.controller.dispose();
              currentRuntime.status = 'disposed';
            }
            staleRuntime = currentRuntime;
          }
          await mountRuntime(action);
          break;
        case 'cleanup-stale':
          await pendingRender;
          if (staleRuntime) {
            cleanupRuntime(staleRuntime);
          }
          state = {
            ...state,
            cleanupRequests: state.cleanupRequests + 1,
            lastAction: action,
          };
          if (currentRuntime?.status === 'mounted') {
            await render();
          } else {
            publish();
          }
          break;
        default:
          throw new Error(`Lifecycle laboratory does not support action "${actionId}".`);
      }
    },
    reset: async () => {
      assertOuterActive();
      await pendingRender;
      for (const runtime of runtimes) {
        cleanupRuntime(runtime);
      }
      runtimes.clear();
      currentRuntime = undefined;
      staleRuntime = undefined;
      state = initialState('reset');
      await mountRuntime('reset');
    },
    settled: async () => {
      await pendingRender;
    },
    dispose: async () => {
      if (outerDisposed) {
        return;
      }
      await pendingRender;
      for (const runtime of runtimes) {
        cleanupRuntime(runtime);
      }
      runtimes.clear();
      outerDisposed = true;
    },
  };
}

export const lifecycleLabScenario: ScenarioDefinition<LifecycleLabState> = {
  id: 'event-lifecycle-lab',
  sourceId: LIFECYCLE_LAB_SOURCE_ID,
  actionIds: [
    'rerender-1000',
    'replace-handler',
    'remove-handler',
    'remove-subtree',
    'add-layer',
    'remove-layer',
    'abort-runtime',
    'dispose-runtime',
    'cleanup-again',
    'remount-runtime',
    'cleanup-stale',
  ],
  mount: mountLifecycleLab,
  formatState: (state) => [
    { label: 'Runtime', value: state.runtime },
    { label: 'Mount generation', value: String(state.mountGeneration) },
    { label: 'Revision', value: String(state.revision) },
    {
      label: 'Primary handler',
      value: state.handlerRemoved ? 'removed' : `generation ${state.handlerGeneration}`,
    },
    { label: 'Subtree', value: state.subtreeVisible ? 'mounted' : 'removed' },
    { label: 'Layer', value: state.layerVisible ? 'mounted' : 'removed' },
    { label: 'Calls', value: String(state.calls) },
    {
      label: 'Target calls',
      value: [
        `primary ${state.targetCalls.primary}`,
        `subtree ${state.targetCalls.subtree}`,
        `throwing ${state.targetCalls.throwing}`,
        `safe ${state.targetCalls.safe}`,
        `layer ${state.targetCalls.layer}`,
      ].join(' · '),
    },
    { label: 'Last target', value: state.lastTarget ?? 'none' },
    {
      label: 'Last handler',
      value: state.lastHandlerGeneration === null ? 'none' : String(state.lastHandlerGeneration),
    },
    { label: 'Cleanup requests', value: String(state.cleanupRequests) },
    { label: 'Last action', value: state.lastAction },
  ],
};
