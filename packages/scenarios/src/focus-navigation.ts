import { crc, type CRCController, type CRCLogicalMouseEvent } from '@crc/core';
import {
  createFocusNavigationScene,
  FOCUS_NAVIGATION_SOURCE_ID,
  type FocusNavigationActivationSource,
  type FocusNavigationState,
  type FocusNavigationTarget,
} from './focus-navigation.example';
import type { ScenarioController, ScenarioDefinition, ScenarioMountContext } from './types';

export type {
  FocusNavigationAction,
  FocusNavigationActivationSource,
  FocusNavigationModality,
  FocusNavigationState,
  FocusNavigationTarget,
} from './focus-navigation.example';

const INITIAL_SQUARES = Object.freeze(Array.from({ length: 12 }, (_, index) => index + 1));

function initialState(): FocusNavigationState {
  return { currentTarget: 'none', lastActivationSource: 'none', activationCount: 0, focusVisibleModality: 'none' };
}

function settledFrames(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

function activationSource(event: CRCLogicalMouseEvent): FocusNavigationActivationSource {
  if (!(event.sourceEvent instanceof KeyboardEvent)) return 'click';
  return event.sourceEvent.key === 'Enter' ? 'enter' : 'space';
}

function createBoundaryButton(canvas: HTMLCanvasElement, position: 'after' | 'before'): HTMLButtonElement {
  const button = canvas.ownerDocument.createElement('button');
  button.type = 'button';
  button.dataset.crcFocusNavigation = position;
  button.textContent = position === 'before' ? 'Native control before' : 'Native control after';
  return button;
}

async function mountFocusNavigationScenario(
  context: ScenarioMountContext<FocusNavigationState>,
): Promise<ScenarioController<FocusNavigationState>> {
  const before = createBoundaryButton(context.canvas, 'before');
  const after = createBoundaryButton(context.canvas, 'after');
  context.canvas.before(before);
  context.canvas.after(after);
  let disposed = false;
  let runtime: CRCController | undefined;
  let state = initialState();
  let squareLabels = [...INITIAL_SQUARES];
  let pending = Promise.resolve();
  const assertActive = () => {
    if (disposed) throw new Error('Cannot operate on a disposed focus scenario.');
  };
  const notify = () => context.onStateChange?.({ ...state });
  const queueSettledNotification = () => {
    pending = settledFrames().then(notify);
    return pending;
  };
  const onFocusChange = (target: FocusNavigationTarget) => {
    state.currentTarget = target;
    if (target === 'none') state.focusVisibleModality = 'none';
    notify();
    void queueSettledNotification();
  };
  const render = () => {
    assertActive();
    runtime = crc(context.canvas, createFocusNavigationScene({
      squareLabels,
      state,
      onActivation: (target, event) => {
        state.currentTarget = target;
        state.lastActivationSource = activationSource(event);
        state.activationCount++;
        void render();
      },
      onFocusChange,
      onFocusSnapshot: (target, snapshot) => {
        if (!snapshot.isFocused) return;
        state.currentTarget = target;
        state.focusVisibleModality = snapshot.isFocusVisible ? 'keyboard' : 'pointer';
      },
    }));
    notify();
    return queueSettledNotification();
  };
  await render();
  return {
    getState: () => ({ ...state }),
    perform: async actionId => {
      assertActive();
      if (actionId === 'reorder-squares') {
        squareLabels = [...squareLabels].reverse();
      } else if (actionId === 'remove-current-square') {
        const match = /^square-(\d+)$/u.exec(state.currentTarget);
        if (match) squareLabels = squareLabels.filter(value => value !== Number(match[1]));
        state.currentTarget = 'none';
        state.focusVisibleModality = 'none';
      } else if (actionId === 'restore-squares') {
        squareLabels = [...INITIAL_SQUARES];
      } else {
        throw new Error(`Focus scenario does not support action "${actionId}".`);
      }
      await render();
    },
    reset: async () => {
      assertActive();
      context.canvas.blur();
      state = initialState();
      squareLabels = [...INITIAL_SQUARES];
      await render();
    },
    settled: async () => { await pending; notify(); },
    dispose: async () => {
      if (disposed) return;
      await pending;
      disposed = true;
      runtime?.dispose();
      before.remove();
      after.remove();
    },
  };
}

export const focusNavigationScenario: ScenarioDefinition<FocusNavigationState> = {
  id: 'focus-and-keyboard-navigation',
  sourceId: FOCUS_NAVIGATION_SOURCE_ID,
  actionIds: ['reorder-squares', 'remove-current-square', 'restore-squares'],
  mount: mountFocusNavigationScenario,
  formatState: state => [
    { label: 'Current target', value: state.currentTarget },
    { label: 'Last activation source', value: state.lastActivationSource },
    { label: 'Activation count', value: String(state.activationCount) },
    { label: 'Focus-visible modality', value: state.focusVisibleModality },
  ],
};
