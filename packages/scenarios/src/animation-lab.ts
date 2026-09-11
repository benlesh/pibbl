import { crc, createElement } from '@crc/core';
import {
  AnimationLabRootA,
  AnimationLabRootB,
  createAnimationLabModel,
  ANIMATION_LAB_SOURCE_ID,
  type AnimationLabAction,
  type AnimationLabModel,
  type AnimationLabState,
} from './animation-lab.example';
import type {
  ScenarioController,
  ScenarioDefinition,
  ScenarioMountContext,
} from './types';

export const ANIMATION_LAB_ACTION_IDS = [
  'play',
  'pause',
  'step',
  'seek-start',
  'seek-middle',
  'seek-end',
  'reverse',
  'retarget',
  'repeat',
  'simulate',
  'show-layer',
  'show-shared-roots',
  'cancel',
  'remove-owner',
  'reset',
] as const satisfies readonly AnimationLabAction[];

const STEP_MILLISECONDS = 16.6666666667;
const SEEK_MIDDLE = 150;
const SEEK_END = 300;

function nextPaint(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

function snapshot(
  model: AnimationLabModel,
  secondaryVisible: boolean,
  lastAction: 'mount' | AnimationLabAction,
): AnimationLabState {
  return {
    status: model.playback?.status.get() ?? 'idle',
    currentTime: model.playback?.currentTime.get() ?? 0,
    x: model.x.get(),
    opacity: model.opacity.get(),
    targetScale: model.transitionTarget.get(),
    presentedScale: model.presentedScale?.get() ?? 1,
    pulseScale: model.pulseScale.get(),
    iteration: model.metrics.iteration,
    milestones: [...model.metrics.milestones],
    stepper: { ...model.stepper.get() },
    rootRenders: { ...model.metrics.rootRenders },
    layer: {
      visible: model.showLayer.get(),
      childRenders: model.metrics.layerChildRenders,
      presentations: model.metrics.layerPresentations,
    },
    sharedRoots: {
      visible: secondaryVisible,
      value: model.shared.get(),
      primaryRenders: model.metrics.sharedRootRenders.primary,
      secondaryRenders: model.metrics.sharedRootRenders.secondary,
    },
    owner: model.ownerVisible ? 'mounted' : 'removed',
    staleStatus: model.stalePlayback?.status.get() ?? 'none',
    staleActionInert: model.staleActionInert,
    lastAction,
  };
}

async function mountAnimationLab(
  context: ScenarioMountContext<AnimationLabState>,
): Promise<ScenarioController<AnimationLabState>> {
  let disposed = false;
  let model = createAnimationLabModel();
  let lastAction: 'mount' | AnimationLabAction = 'mount';
  let primaryController: ReturnType<typeof crc> | undefined;
  let secondaryController: ReturnType<typeof crc> | undefined;
  let secondaryCanvas: HTMLCanvasElement | undefined;
  let actionQueue = Promise.resolve();

  const assertActive = (): void => {
    if (disposed) throw new Error('Cannot operate on a disposed animation laboratory.');
  };
  const publish = (): void => {
    context.onStateChange?.(snapshot(model, secondaryController !== undefined, lastAction));
  };
  const renderPrimary = (): void => {
    primaryController = crc(
      context.canvas,
      createElement(AnimationLabRootA, { model }),
      { pixelRatio: 1 },
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
  const mountRoots = (): void => {
    model = createAnimationLabModel();
    model.publish = publish;
    renderPrimary();
  };
  const resetRoots = (): void => {
    disposeRoots();
    mountRoots();
  };
  const prepareProgram = async (
    mode: 'repeat' | 'simulate',
  ): Promise<void> => {
    model.metrics.milestones.length = 0;
    model.metrics.eventOrigin = undefined;
    model.metrics.iteration = 0;
    model.programMode = mode;
    if (mode === 'repeat') model.x.set(0);
    if (mode === 'simulate') {
      model.stepper.set(Object.freeze({ value: 0, steps: 0 }));
    }
    renderPrimary();
    await nextPaint();
    model.playback?.play({ conflict: 'replace' });
  };

  const execute = async (action: AnimationLabAction): Promise<void> => {
    const playback = model.playback;
    if (action !== 'reset' && !playback) {
      throw new Error('Animation laboratory playback owner has not rendered yet.');
    }
    switch (action) {
      case 'play':
        playback?.play({ conflict: 'replace' });
        break;
      case 'pause':
        playback?.play({ conflict: 'replace' });
        playback?.pause();
        break;
      case 'step':
        playback?.pause();
        playback?.seek((playback?.currentTime.get() ?? 0) + STEP_MILLISECONDS);
        break;
      case 'seek-start':
        playback?.seek(0);
        break;
      case 'seek-middle':
        playback?.seek(SEEK_MIDDLE);
        break;
      case 'seek-end':
        playback?.seek(SEEK_END);
        break;
      case 'reverse':
        playback?.reverse();
        break;
      case 'retarget':
        model.transitionTarget.set(1.6);
        await nextPaint();
        break;
      case 'repeat':
        await prepareProgram('repeat');
        break;
      case 'simulate':
        await prepareProgram('simulate');
        break;
      case 'show-layer':
        model.showLayer.set(true);
        await nextPaint();
        model.layerOffset.set(20);
        break;
      case 'show-shared-roots':
        if (!secondaryController) {
          secondaryCanvas = document.createElement('canvas');
          secondaryCanvas.width = context.canvas.width;
          secondaryCanvas.height = 96;
          secondaryCanvas.style.cssText = 'display:block;width:480px;height:96px';
          (context.referenceHost ?? context.canvas.parentElement ?? document.body)
            .appendChild(secondaryCanvas);
          secondaryController = crc(
            secondaryCanvas,
            createElement(AnimationLabRootB, { model }),
            { pixelRatio: 1 },
          );
          await nextPaint();
        }
        model.shared.set(1);
        break;
      case 'remove-owner': {
        const stalePlayback = playback;
        model.stalePlayback = stalePlayback;
        model.ownerVisible = false;
        renderPrimary();
        await nextPaint();
        const retainedX = model.x.get();
        stalePlayback?.play();
        stalePlayback?.pause();
        stalePlayback?.resume();
        stalePlayback?.cancel();
        stalePlayback?.finish();
        stalePlayback?.seek(0);
        stalePlayback?.reverse();
        stalePlayback?.setPlaybackRate(1);
        model.staleActionInert = stalePlayback?.status.get() === 'disposed' &&
          Object.is(model.x.get(), retainedX);
        break;
      }
      case 'cancel':
        playback?.seek(120);
        await nextPaint();
        playback?.cancel();
        break;
      case 'reset':
        resetRoots();
        break;
    }
    publish();
  };

  mountRoots();

  return {
    getState: () => snapshot(model, secondaryController !== undefined, lastAction),
    perform: actionId => {
      assertActive();
      if (!(ANIMATION_LAB_ACTION_IDS as readonly string[]).includes(actionId)) {
        return Promise.reject(
          new Error(`Animation laboratory does not support action "${actionId}".`),
        );
      }
      const action = actionId as AnimationLabAction;
      actionQueue = actionQueue.then(async () => {
        assertActive();
        lastAction = action;
        await execute(action);
      });
      return actionQueue;
    },
    reset: () => {
      assertActive();
      actionQueue = actionQueue.then(() => {
        assertActive();
        lastAction = 'reset';
        resetRoots();
        publish();
      });
      return actionQueue;
    },
    settled: async () => {
      await actionQueue;
      await nextPaint();
      await nextPaint();
      publish();
    },
    dispose: async () => {
      if (disposed) return;
      await actionQueue.catch(() => {});
      disposeRoots();
      disposed = true;
    },
  };
}

export const animationLabScenario: ScenarioDefinition<AnimationLabState> = {
  id: 'first-class-animation',
  sourceId: ANIMATION_LAB_SOURCE_ID,
  actionIds: ANIMATION_LAB_ACTION_IDS,
  mount: mountAnimationLab,
  formatState: state => [
    { label: 'Playback', value: `${state.status} · ${state.currentTime} ms` },
    { label: 'Outputs', value: `x ${state.x} · opacity ${state.opacity}` },
    { label: 'Transition', value: `target ${state.targetScale} · presented ${state.presentedScale}` },
    { label: 'Iteration', value: String(state.iteration) },
    { label: 'Milestones', value: state.milestones.join(' → ') || 'none' },
    { label: 'Stepper', value: `value ${state.stepper.value} · steps ${state.stepper.steps}` },
    { label: 'Root renders', value: `primary ${state.rootRenders.primary} · secondary ${state.rootRenders.secondary}` },
    { label: 'Layer', value: `child ${state.layer.childRenders} · presentation ${state.layer.presentations}` },
    { label: 'Shared roots', value: `primary ${state.sharedRoots.primaryRenders} · secondary ${state.sharedRoots.secondaryRenders}` },
    { label: 'Owner', value: `${state.owner} · stale ${state.staleStatus}` },
    { label: 'Last action', value: state.lastAction },
  ],
};
