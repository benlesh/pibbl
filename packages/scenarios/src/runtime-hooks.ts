import type {
  RuntimeHooksAction,
  RuntimeHooksMetrics,
  RuntimeHooksModel,
  RuntimeHooksState,
} from './runtime-hooks.example';
import type {
  ScenarioController,
  ScenarioDefinition,
  ScenarioMountContext,
} from './types';
import { pibbl } from '@pibbl/core';
import {
  createRuntimeHooksScene,
  getRuntimeHooksSiblingOrder,
  probeRuntimeHookMisuse,
  RUNTIME_HOOKS_SOURCE_ID,
} from './runtime-hooks.example';

export type {
  RuntimeHooksAction,
  RuntimeHooksRootVariant,
  RuntimeHooksSiblingKey,
  RuntimeHooksState,
} from './runtime-hooks.example';

export const RUNTIME_HOOKS_ACTION_IDS = [
  'increment-state',
  'mutate-ref',
  'render-stable',
  'change-dependency',
  'reorder-siblings',
  'insert-sibling',
  'remove-sibling',
  'replace-component-key',
  'remove-component',
  'restore-component',
  'replace-root',
  'probe-hook-misuse',
] as const;

function initialModel(lastAction: RuntimeHooksAction = 'mount'): RuntimeHooksModel {
  return {
    componentKey: 1,
    componentVisible: true,
    dependency: 0,
    insertedSibling: false,
    lastAction,
    removedSibling: false,
    reversedSiblings: false,
    rootVariant: 'a',
  };
}

function initialMetrics(): RuntimeHooksMetrics {
  return {
    falsyChildren: 0,
    hookAcquisitions: 0,
    hookCleanups: 0,
    hookOrder: '',
    memoCreates: 0,
    memoIdentity: '',
    misuseErrors: 0,
    misuseMessage: null,
    misuseName: null,
    nextObjectIdentity: 1,
    objectIdentities: new WeakMap(),
    pathIdentities: [0, 0, 0],
    refIdentity: 0,
    refObject: undefined,
    renders: 0,
    stateSignal: undefined,
    siblingIdentities: { a: null, b: null, c: null },
    stateValue: 0,
  };
}

function snapshotState(
  model: Readonly<RuntimeHooksModel>,
  metrics: RuntimeHooksMetrics,
): RuntimeHooksState {
  return {
    componentKey: model.componentKey,
    componentVisible: model.componentVisible,
    dependency: model.dependency,
    falsyChildren: metrics.falsyChildren,
    hookAcquisitions: metrics.hookAcquisitions,
    hookCleanups: metrics.hookCleanups,
    hookOrder: metrics.hookOrder,
    lastAction: model.lastAction,
    memoCreates: metrics.memoCreates,
    memoIdentity: metrics.memoIdentity,
    misuseErrors: metrics.misuseErrors,
    misuseMessage: metrics.misuseMessage,
    misuseName: metrics.misuseName,
    pathIdentities: [...metrics.pathIdentities],
    refIdentity: metrics.refIdentity,
    refValue: metrics.refObject?.current?.value ?? 0,
    renders: metrics.renders,
    rootVariant: model.rootVariant,
    siblingIdentities: { ...metrics.siblingIdentities },
    siblingOrder: [...getRuntimeHooksSiblingOrder(model)],
    stateValue: metrics.stateValue,
  };
}

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

async function mountRuntimeHooks(
  context: ScenarioMountContext<RuntimeHooksState>,
): Promise<ScenarioController<RuntimeHooksState>> {
  let abortController = new AbortController();
  let disposed = false;
  let metrics = initialMetrics();
  let model = initialModel();
  let pendingRender = Promise.resolve();

  const assertActive = () => {
    if (disposed) {
      throw new Error('Cannot operate on a disposed runtime hooks laboratory.');
    }
  };
  const publish = () => context.onStateChange?.(snapshotState(model, metrics));
  const render = async () => {
    assertActive();
    pibbl(context.canvas, createRuntimeHooksScene({ metrics, model }), {
      signal: abortController.signal,
    });
    pendingRender = nextFrame();
    await pendingRender;
    assertActive();
    publish();
  };
  const transition = async (
    action: RuntimeHooksAction,
    update: () => void,
  ) => {
    update();
    model.lastAction = action;
    await render();
  };

  await render();

  return {
    getState: () => snapshotState(model, metrics),
    perform: async (actionId) => {
      assertActive();
      const action = actionId as RuntimeHooksAction;
      switch (action) {
        case 'increment-state':
          if (!metrics.stateSignal) {
            throw new Error('The state probe is not mounted.');
          }
          model.lastAction = action;
          metrics.stateSignal.update(value => value + 1);
          pendingRender = nextFrame();
          await pendingRender;
          publish();
          return;
        case 'mutate-ref':
          if (!metrics.refObject?.current) {
            throw new Error('The ref probe is not mounted.');
          }
          metrics.refObject.current.value++;
          model.lastAction = action;
          publish();
          return;
        case 'render-stable':
          await transition(action, () => undefined);
          return;
        case 'change-dependency':
          await transition(action, () => model.dependency++);
          return;
        case 'reorder-siblings':
          await transition(action, () => {
            model.reversedSiblings = !model.reversedSiblings;
          });
          return;
        case 'insert-sibling':
          await transition(action, () => {
            model.insertedSibling = true;
          });
          return;
        case 'remove-sibling':
          await transition(action, () => {
            model.removedSibling = true;
          });
          return;
        case 'replace-component-key':
          await transition(action, () => model.componentKey++);
          return;
        case 'remove-component':
          await transition(action, () => {
            model.componentVisible = false;
          });
          return;
        case 'restore-component':
          await transition(action, () => {
            model.componentVisible = true;
          });
          return;
        case 'replace-root':
          await transition(action, () => {
            model.rootVariant = model.rootVariant === 'a' ? 'b' : 'a';
          });
          return;
        case 'probe-hook-misuse': {
          const errors = probeRuntimeHookMisuse();
          metrics.misuseErrors += errors.length;
          const names = errors.map(error => error.name);
          const messages = errors.map(error => error.message);
          metrics.misuseName = names.every(name => name === names[0]) ?
            `${names[0]} × ${names.length}` :
            names.join(', ');
          metrics.misuseMessage = messages.every(message => message === messages[0]) ?
            messages[0] ?? null :
            messages.join(' | ');
          await transition(action, () => undefined);
          return;
        }
        default:
          throw new Error(`Runtime hooks laboratory does not support action "${actionId}".`);
      }
    },
    reset: async () => {
      assertActive();
      await pendingRender;
      abortController.abort();
      abortController = new AbortController();
      metrics = initialMetrics();
      model = initialModel('reset');
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

function identities(values: readonly number[]): string {
  return values.map(value => `#${value}`).join(' · ');
}

export const runtimeHooksScenario: ScenarioDefinition<RuntimeHooksState> = {
  id: 'runtime-hooks-laboratory',
  sourceId: RUNTIME_HOOKS_SOURCE_ID,
  actionIds: RUNTIME_HOOKS_ACTION_IDS,
  mount: mountRuntimeHooks,
  formatState: state => [
    { label: 'State', value: `${state.stateValue} · ${state.renders} renders` },
    {
      label: 'Memo',
      value: `${state.memoIdentity} · ${state.memoCreates} creates`,
    },
    { label: 'Ref', value: `#${state.refIdentity} · value ${state.refValue}` },
    {
      label: 'Change cleanup',
      value: `${state.hookAcquisitions} acquired · ${state.hookCleanups} cleaned`,
    },
    { label: 'Path identities', value: identities(state.pathIdentities) },
    { label: 'Hook order', value: state.hookOrder },
    {
      label: 'Component',
      value: `${state.componentVisible ? 'mounted' : 'removed'} · key ${state.componentKey} · dependency ${state.dependency}`,
    },
    {
      label: 'Siblings',
      value: `${state.siblingOrder.join(' → ')} · a ${state.siblingIdentities.a ?? 'removed'} · b ${state.siblingIdentities.b ?? 'removed'} · c ${state.siblingIdentities.c ?? 'removed'}`,
    },
    { label: 'Root', value: `variant ${state.rootVariant}` },
    { label: 'Falsy children', value: String(state.falsyChildren) },
    {
      label: 'Misuse errors',
      value: `${state.misuseErrors} · ${state.misuseName ?? 'none'} · ${state.misuseMessage ?? 'no message'}`,
    },
    { label: 'Last action', value: state.lastAction },
  ],
};
