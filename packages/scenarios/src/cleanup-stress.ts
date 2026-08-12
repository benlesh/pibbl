import type {
  CleanupRuntimeStatus,
  CleanupStressAction,
  CleanupStressMetrics,
  CleanupStressState,
} from './cleanup-stress.example';
import type {
  ScenarioController,
  ScenarioDefinition,
  ScenarioMountContext,
} from './types';
import { crc } from '@crc/core';
import {
  CLEANUP_STRESS_SOURCE_ID,
  createCleanupStressScene,
} from './cleanup-stress.example';

export type {
  CleanupImageMode,
  CleanupLayerMode,
  CleanupRootVariant,
  CleanupRuntimeStatus,
  CleanupStressAction,
  CleanupStressMetrics,
  CleanupStressState,
} from './cleanup-stress.example';

export const CLEANUP_STRESS_ACTION_IDS = [
  'queue-frame',
  'dispose-with-frame',
  'show-image',
  'change-image-source',
  'show-broken-image',
  'remove-image',
  'add-layer',
  'add-nested-layer',
  'remove-layers',
  'change-hook-dependency',
  'replace-component-key',
  'remove-component',
  'restore-component',
  'replace-root',
  'abort-runtime',
  'dispose-runtime',
  'cleanup-again',
  'remount-runtime',
  'cycle-runtime-1000',
] as const;

interface InnerRuntime {
  abortController: AbortController;
  controller: ReturnType<typeof crc>;
  status: CleanupRuntimeStatus;
}

function emptyMetrics(): CleanupStressMetrics {
  return {
    completedRenders: 0,
    hookAcquisitions: 0,
    hookCleanups: 0,
  };
}

function initialState(lastAction: CleanupStressAction = 'mount'): CleanupStressState {
  return {
    cleanupRequests: 0,
    completedRenders: 0,
    componentKey: 1,
    componentVisible: true,
    frameDisposals: 0,
    frameRequests: 0,
    hookAcquisitions: 0,
    hookCleanups: 0,
    hookDependency: 1,
    imageMode: 'hidden',
    lastAction,
    layerMode: 'hidden',
    mountCycles: 0,
    mountGeneration: 0,
    revision: 0,
    rootVariant: 'a',
    runtime: 'mounted',
  };
}

function snapshotState(
  state: CleanupStressState,
  metrics: CleanupStressMetrics,
): CleanupStressState {
  return {
    ...state,
    completedRenders: metrics.completedRenders,
    hookAcquisitions: metrics.hookAcquisitions,
    hookCleanups: metrics.hookCleanups,
  };
}

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

async function mountCleanupStress(
  context: ScenarioMountContext<CleanupStressState>,
): Promise<ScenarioController<CleanupStressState>> {
  let disposed = false;
  let metrics = emptyMetrics();
  let state = initialState();
  let currentRuntime: InnerRuntime | undefined;
  let staleRuntime: InnerRuntime | undefined;
  let pendingRender = Promise.resolve();

  const assertActive = () => {
    if (disposed) {
      throw new Error('Cannot operate on a disposed cleanup stress laboratory.');
    }
  };
  const publish = () => context.onStateChange?.(snapshotState(state, metrics));
  const scene = () => createCleanupStressScene({
    metrics,
    state: snapshotState(state, metrics),
  });
  const cleanupRuntime = (runtime: InnerRuntime): void => {
    runtime.abortController.abort();
    runtime.controller.dispose();
  };
  const render = async () => {
    assertActive();
    if (!currentRuntime || currentRuntime.status !== 'mounted') {
      throw new Error('The cleanup stress runtime must be remounted before rendering.');
    }
    crc(context.canvas, scene(), { signal: currentRuntime.abortController.signal });
    pendingRender = nextFrame();
    await pendingRender;
    assertActive();
    publish();
  };
  const mountRuntime = async (lastAction: CleanupStressAction) => {
    const abortController = new AbortController();
    state = {
      ...state,
      lastAction,
      mountGeneration: state.mountGeneration + 1,
      runtime: 'mounted',
    };
    const controller = crc(context.canvas, scene(), { signal: abortController.signal });
    currentRuntime = { abortController, controller, status: 'mounted' };
    pendingRender = nextFrame();
    await pendingRender;
    assertActive();
    publish();
  };
  const transition = async (
    action: CleanupStressAction,
    changes: Partial<CleanupStressState>,
  ) => {
    state = {
      ...state,
      ...changes,
      lastAction: action,
      revision: state.revision + 1,
    };
    await render();
  };
  const queueFrame = (action: 'dispose-with-frame' | 'queue-frame') => {
    if (!currentRuntime || currentRuntime.status !== 'mounted') {
      throw new Error('The cleanup stress runtime must be mounted before queuing a frame.');
    }
    state = {
      ...state,
      frameRequests: state.frameRequests + 1,
      lastAction: action,
      revision: state.revision + 1,
    };
    crc(context.canvas, scene(), { signal: currentRuntime.abortController.signal });
    pendingRender = Promise.resolve();
    publish();
  };

  await mountRuntime('mount');

  return {
    getState: () => snapshotState(state, metrics),
    perform: async (actionId) => {
      assertActive();
      const action = actionId as CleanupStressAction;
      switch (action) {
        case 'queue-frame':
          queueFrame(action);
          return;
        case 'dispose-with-frame':
          queueFrame(action);
          currentRuntime!.controller.dispose();
          currentRuntime!.status = 'disposed';
          state = {
            ...state,
            cleanupRequests: state.cleanupRequests + 1,
            frameDisposals: state.frameDisposals + 1,
            runtime: 'disposed',
          };
          publish();
          return;
        case 'show-image':
          await transition(action, { imageMode: 'primary' });
          return;
        case 'change-image-source':
          await transition(action, { imageMode: 'secondary' });
          return;
        case 'show-broken-image':
          await transition(action, { imageMode: 'broken' });
          return;
        case 'remove-image':
          await transition(action, { imageMode: 'hidden' });
          return;
        case 'add-layer':
          await transition(action, { layerMode: 'single' });
          return;
        case 'add-nested-layer':
          await transition(action, { layerMode: 'nested' });
          return;
        case 'remove-layers':
          await transition(action, { layerMode: 'hidden' });
          return;
        case 'change-hook-dependency':
          await transition(action, { hookDependency: state.hookDependency + 1 });
          return;
        case 'replace-component-key':
          await transition(action, { componentKey: state.componentKey + 1 });
          return;
        case 'remove-component':
          await transition(action, { componentVisible: false });
          return;
        case 'restore-component':
          await transition(action, { componentVisible: true });
          return;
        case 'replace-root':
          await transition(action, {
            rootVariant: state.rootVariant === 'a' ? 'b' : 'a',
          });
          return;
        case 'abort-runtime':
          if (!currentRuntime) {
            throw new Error('The cleanup stress laboratory has no runtime to abort.');
          }
          currentRuntime.abortController.abort();
          currentRuntime.status = 'aborted';
          state = {
            ...state,
            cleanupRequests: state.cleanupRequests + 1,
            lastAction: action,
            runtime: 'aborted',
          };
          publish();
          return;
        case 'dispose-runtime':
          if (!currentRuntime) {
            throw new Error('The cleanup stress laboratory has no runtime to dispose.');
          }
          currentRuntime.controller.dispose();
          currentRuntime.status = 'disposed';
          state = {
            ...state,
            cleanupRequests: state.cleanupRequests + 1,
            lastAction: action,
            runtime: 'disposed',
          };
          publish();
          return;
        case 'cleanup-again':
          if (!currentRuntime) {
            throw new Error('The cleanup stress laboratory has no runtime to clean again.');
          }
          cleanupRuntime(currentRuntime);
          state = {
            ...state,
            cleanupRequests: state.cleanupRequests + 1,
            lastAction: action,
          };
          publish();
          return;
        case 'remount-runtime':
          if (currentRuntime) {
            cleanupRuntime(currentRuntime);
            staleRuntime = currentRuntime;
          }
          await mountRuntime(action);
          return;
        case 'cycle-runtime-1000': {
          if (currentRuntime) {
            cleanupRuntime(currentRuntime);
            staleRuntime = currentRuntime;
          }
          for (let index = 0; index < 1_000; index++) {
            const abortController = new AbortController();
            state = {
              ...state,
              mountCycles: state.mountCycles + 1,
              mountGeneration: state.mountGeneration + 1,
            };
            const controller = crc(context.canvas, scene(), {
              signal: abortController.signal,
            });
            pendingRender = nextFrame();
            await pendingRender;
            assertActive();
            controller.dispose();
          }
          await mountRuntime(action);
          return;
        }
        default:
          throw new Error(`Cleanup stress laboratory does not support action "${actionId}".`);
      }
    },
    reset: async () => {
      assertActive();
      await pendingRender;
      if (currentRuntime) {
        cleanupRuntime(currentRuntime);
      }
      if (staleRuntime) {
        cleanupRuntime(staleRuntime);
      }
      currentRuntime = undefined;
      staleRuntime = undefined;
      metrics = emptyMetrics();
      state = initialState('reset');
      await mountRuntime('reset');
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
      if (currentRuntime) {
        cleanupRuntime(currentRuntime);
      }
      if (staleRuntime) {
        cleanupRuntime(staleRuntime);
      }
    },
  };
}

export const cleanupStressScenario: ScenarioDefinition<CleanupStressState> = {
  id: 'runtime-cleanup-stress',
  sourceId: CLEANUP_STRESS_SOURCE_ID,
  actionIds: CLEANUP_STRESS_ACTION_IDS,
  mount: mountCleanupStress,
  formatState: state => [
    { label: 'Runtime', value: `${state.runtime} · mount ${state.mountGeneration}` },
    { label: 'Root', value: `variant ${state.rootVariant} · revision ${state.revision}` },
    {
      label: 'Component',
      value: `${state.componentVisible ? 'mounted' : 'removed'} · key ${state.componentKey} · dependency ${state.hookDependency}`,
    },
    {
      label: 'Hook ownership',
      value: `${state.hookAcquisitions} acquired · ${state.hookCleanups} cleaned`,
    },
    { label: 'Image', value: state.imageMode },
    { label: 'Layers', value: state.layerMode },
    {
      label: 'Frame stress',
      value: `${state.frameRequests} queued · ${state.frameDisposals} disposed pending`,
    },
    {
      label: 'Cycles',
      value: `${state.mountCycles} mount/dispose · ${state.completedRenders} completed renders`,
    },
    { label: 'Cleanup requests', value: String(state.cleanupRequests) },
    { label: 'Last action', value: state.lastAction },
  ],
};
