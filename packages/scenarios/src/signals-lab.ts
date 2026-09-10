import { crc, createElement, signal } from '@crc/core';
import {
  createSignalsLabModel,
  SIGNALS_LAB_SOURCE_ID,
  SignalsLabRootA,
  SignalsLabRootB,
  type SignalsLabAction,
  type SignalsLabMetrics,
  type SignalsLabModel,
  type SignalsLabState,
} from './signals-lab.example';
import type {
  ScenarioController,
  ScenarioDefinition,
  ScenarioMountContext,
} from './types';

export const SIGNALS_LAB_ACTION_IDS = [
  'direct-write',
  'equal-write',
  'computed-equal-write',
  'dependency-switch',
  'shared-roots',
  'layer-local-write',
  'remove-consumer',
  'reset',
] as const satisfies readonly SignalsLabAction[];

function createMetrics(): SignalsLabMetrics {
  return {
    computedEvaluations: 0,
    rootRenders: { a: 0, b: 0 },
    layerChildRenders: { a: 0, b: 0 },
    layerComposites: { a: 0, b: 0 },
  };
}

function nextPaint(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

function snapshot(
  model: SignalsLabModel,
  metrics: SignalsLabMetrics,
  lastAction: 'mount' | SignalsLabAction,
): SignalsLabState {
  return {
    direct: model.direct.get(),
    derivedSource: model.derivedSource.get(),
    selectedSource: model.selectLeft.get() ? 'left' : 'right',
    computed: model.derived.get(),
    computedEvaluations: metrics.computedEvaluations,
    rootRenders: { ...metrics.rootRenders },
    layerChildRenders: { ...metrics.layerChildRenders },
    layerComposites: { ...metrics.layerComposites },
    consumerCount: 4 + (model.consumerVisible ? 1 : 0),
    lastAction,
  };
}

async function mountSignalsLab(
  context: ScenarioMountContext<SignalsLabState>,
): Promise<ScenarioController<SignalsLabState>> {
  let disposed = false;
  let model: SignalsLabModel;
  let metrics: SignalsLabMetrics;
  let lastAction: 'mount' | SignalsLabAction = 'mount';
  let primaryController: ReturnType<typeof crc> | undefined;
  let secondaryController: ReturnType<typeof crc> | undefined;
  let secondaryCanvas: HTMLCanvasElement | undefined;

  const assertActive = (): void => {
    if (disposed) throw new Error('Cannot operate on a disposed signals laboratory.');
  };
  const publish = (): void => {
    context.onStateChange?.(snapshot(model, metrics, lastAction));
  };
  const renderPrimary = (): void => {
    primaryController = crc(
      context.canvas,
      createElement(SignalsLabRootA, { model, metrics }),
    );
  };
  const mountRoots = (): void => {
    metrics = createMetrics();
    model = createSignalsLabModel(
      (initial, debugName) => signal(initial, { debugName }),
      metrics,
    );
    secondaryCanvas = document.createElement('canvas');
    secondaryCanvas.width = context.canvas.width;
    secondaryCanvas.height = 120;
    (context.referenceHost ?? context.canvas.parentElement ?? document.body)
      .appendChild(secondaryCanvas);
    renderPrimary();
    secondaryController = crc(
      secondaryCanvas,
      createElement(SignalsLabRootB, { model, metrics }),
    );
  };
  const disposeRoots = (): void => {
    primaryController?.dispose();
    secondaryController?.dispose();
    primaryController = undefined;
    secondaryController = undefined;
    secondaryCanvas?.remove();
    secondaryCanvas = undefined;
  };
  const settle = async (): Promise<void> => {
    await nextPaint();
    await nextPaint();
    publish();
  };

  mountRoots();
  await settle();

  return {
    getState: () => snapshot(model, metrics, lastAction),
    perform: async (actionId) => {
      assertActive();
      if (!(SIGNALS_LAB_ACTION_IDS as readonly string[]).includes(actionId)) {
        throw new Error(`Signals laboratory does not support action "${actionId}".`);
      }
      const action = actionId as SignalsLabAction;
      lastAction = action;
      switch (action) {
        case 'direct-write':
          model.direct.update(value => value + 1);
          break;
        case 'equal-write':
          model.direct.set(model.direct.get());
          break;
        case 'computed-equal-write':
          model.derivedSource.update(value => value + 2);
          break;
        case 'dependency-switch':
          model.selectLeft.set(false);
          break;
        case 'shared-roots':
          model.shared.update(value => value + 1);
          break;
        case 'layer-local-write':
          model.layerA.update(value => value + 1);
          break;
        case 'remove-consumer':
          model.consumerVisible = false;
          renderPrimary();
          await settle();
          model.retained.update(value => value + 1);
          break;
        case 'reset':
          disposeRoots();
          lastAction = 'reset';
          mountRoots();
          break;
      }
      await settle();
    },
    reset: async () => {
      assertActive();
      disposeRoots();
      lastAction = 'reset';
      mountRoots();
      await settle();
    },
    settled: settle,
    dispose: async () => {
      if (disposed) return;
      await settle();
      disposeRoots();
      disposed = true;
    },
  };
}

export const signalsLabScenario: ScenarioDefinition<SignalsLabState> = {
  id: 'first-class-signals',
  sourceId: SIGNALS_LAB_SOURCE_ID,
  actionIds: SIGNALS_LAB_ACTION_IDS,
  mount: mountSignalsLab,
  formatState: state => [
    { label: 'Direct', value: String(state.direct) },
    { label: 'Computed', value: `${state.computed} · ${state.computedEvaluations} evaluations` },
    { label: 'Selected source', value: state.selectedSource },
    { label: 'Root renders', value: `A ${state.rootRenders.a} · B ${state.rootRenders.b}` },
    { label: 'Layer children', value: `A ${state.layerChildRenders.a} · B ${state.layerChildRenders.b}` },
    { label: 'Layer composites', value: `A ${state.layerComposites.a} · B ${state.layerComposites.b}` },
    { label: 'Consumers', value: String(state.consumerCount) },
    { label: 'Last action', value: state.lastAction },
  ],
};
