import { batch, pibbl, createElement, signal } from '@pibbl/core';
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

/**
 * Stable action identifiers accepted by the signals lab scenario.
 *
 * @see {@link SignalsLabAction}
 */
export const SIGNALS_LAB_ACTION_IDS = [
  'direct-write',
  'equal-write',
  'computed-equal-write',
  'dependency-switch',
  'shared-roots',
  'layer-local-write',
  'remove-consumer',
  'batched-write',
  'reaction-only',
  'reset',
] as const satisfies readonly SignalsLabAction[];

function createMetrics(): SignalsLabMetrics {
  return {
    computedEvaluations: 0,
    renderedComputed: 0,
    writes: 0,
    inputResolutions: 0,
    receiverIds: 0,
    provisions: 0,
    adoptions: 0,
    shallowCopies: 0,
    batchFlushes: 0,
    computedValidations: 0,
    reactionRuns: 0,
    reactionCleanups: 0,
    componentTraversals: 0,
    layerRepaints: 0,
    composites: 0,
    rootRenders: { a: 0, b: 0 },
    layerChildRenders: { a: 0, b: 0 },
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
    left: model.left.get(),
    right: model.right.get(),
    shared: model.shared.get(),
    layerA: model.layerA.get(),
    layerB: model.layerB.get(),
    retained: model.retained.get(),
    selectedSource: model.selectLeft.get() ? 'left' : 'right',
    computed: metrics.renderedComputed,
    computedEvaluations: metrics.computedEvaluations,
    writes: metrics.writes,
    inputResolutions: metrics.inputResolutions,
    receiverIds: metrics.receiverIds,
    provisions: metrics.provisions,
    adoptions: metrics.adoptions,
    shallowCopies: metrics.shallowCopies,
    batchFlushes: metrics.batchFlushes,
    computedValidations: metrics.computedValidations,
    reactionRuns: metrics.reactionRuns,
    reactionCleanups: metrics.reactionCleanups,
    componentTraversals: metrics.componentTraversals,
    layerRepaints: metrics.layerRepaints,
    composites: metrics.composites,
    rootRenders: { ...metrics.rootRenders },
    layerChildRenders: { ...metrics.layerChildRenders },
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
  let primaryController: ReturnType<typeof pibbl> | undefined;
  let secondaryController: ReturnType<typeof pibbl> | undefined;
  let secondaryCanvas: HTMLCanvasElement | undefined;

  const assertActive = (): void => {
    if (disposed) throw new Error('Cannot operate on a disposed signals laboratory.');
  };
  const publish = (): void => {
    context.onStateChange?.(snapshot(model, metrics, lastAction));
  };
  const renderPrimary = (): void => {
    primaryController = pibbl(
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
    secondaryController = pibbl(
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
          metrics.writes += 1;
          model.direct.update(value => value + 1);
          break;
        case 'equal-write':
          metrics.writes += 1;
          model.direct.set(model.direct.get());
          break;
        case 'computed-equal-write':
          metrics.writes += 1;
          model.derivedSource.update(value => value + 2);
          break;
        case 'dependency-switch':
          metrics.writes += 1;
          model.selectLeft.set(false);
          await settle();
          metrics.writes += 1;
          model.left.update(value => value + 1);
          break;
        case 'shared-roots':
          metrics.writes += 1;
          model.shared.update(value => value + 1);
          break;
        case 'layer-local-write':
          metrics.writes += 1;
          model.layerA.update(value => value + 1);
          break;
        case 'remove-consumer':
          model.consumerVisible = false;
          renderPrimary();
          await settle();
          metrics.writes += 1;
          model.retained.update(value => value + 1);
          break;
        case 'batched-write':
          metrics.writes += 2;
          metrics.batchFlushes += 1;
          batch(() => {
            model.direct.update(value => value + 1);
            model.shared.update(value => value + 1);
          });
          break;
        case 'reaction-only':
          metrics.writes += 1;
          model.reactionOnly.update(value => value + 1);
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
    {
      label: 'Sources',
      value: `direct ${state.direct} · derived ${state.derivedSource} · left ${state.left} · right ${state.right} · shared ${state.shared}`,
    },
    { label: 'Computed', value: `${state.computed} · ${state.computedEvaluations} evaluations` },
    { label: 'Writes / batches', value: `${state.writes} / ${state.batchFlushes}` },
    { label: 'Input resolutions', value: String(state.inputResolutions) },
    { label: 'Receiver IDs', value: String(state.receiverIds) },
    { label: 'Provisions / adoptions', value: `${state.provisions} / ${state.adoptions}` },
    { label: 'Shallow copies', value: String(state.shallowCopies) },
    { label: 'Computed validations', value: String(state.computedValidations) },
    { label: 'Reaction runs / cleanups', value: `${state.reactionRuns} / ${state.reactionCleanups}` },
    { label: 'Component traversals', value: String(state.componentTraversals) },
    { label: 'Layer repaints / composites', value: `${state.layerRepaints} / ${state.composites}` },
    { label: 'Layer sources', value: `A ${state.layerA} · B ${state.layerB} · retained ${state.retained}` },
    { label: 'Selected source', value: state.selectedSource },
    { label: 'Root renders', value: `A ${state.rootRenders.a} · B ${state.rootRenders.b}` },
    { label: 'Layer children', value: `A ${state.layerChildRenders.a} · B ${state.layerChildRenders.b}` },
    { label: 'Consumers', value: String(state.consumerCount) },
    { label: 'Last action', value: state.lastAction },
  ],
};
