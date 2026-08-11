import type {
  ScenarioController,
  ScenarioDefinition,
  ScenarioMountContext,
} from './types';
import { crc, defineComp, rect, text } from '@crc/core';

const SMOKE_CANVAS_WIDTH = 480;
const SMOKE_CANVAS_HEIGHT = 240;

export type SmokeScenarioAction = 'mount' | 'update' | 'click' | 'reset';

export interface SmokeScenarioState {
  revision: number;
  clicks: number;
  lastAction: SmokeScenarioAction;
}

interface SmokeSceneProps {
  state: SmokeScenarioState;
  onClick: () => void;
}

const SmokeScene = defineComp<SmokeSceneProps>(({ state, onClick }) => {
  const fillStyle = state.lastAction === 'click' ?
    '#ea580c' :
    state.revision > 0 ?
      '#7c3aed' :
      '#2563eb';

  return [
    rect({
      x: 0,
      y: 0,
      width: SMOKE_CANVAS_WIDTH,
      height: SMOKE_CANVAS_HEIGHT,
      fillStyle: '#f8fafc',
    }),
    rect({
      x: 28,
      y: 48,
      width: 188,
      height: 120,
      fillStyle,
      strokeStyle: '#0f172a',
      lineWidth: 2,
      onClick,
    }),
    text({
      x: 48,
      y: 78,
      text: 'CRC smoke scenario',
      font: '700 18px Arial',
      fillStyle: '#ffffff',
    }),
    text({
      x: 48,
      y: 116,
      text: `revision ${state.revision} · clicks ${state.clicks}`,
      font: '14px Arial',
      fillStyle: '#ffffff',
    }),
    text({
      x: 248,
      y: 62,
      text: 'Public API smoke',
      font: '700 16px Arial',
      fillStyle: '#0f172a',
    }),
    text({
      x: 248,
      y: 94,
      text: `last action: ${state.lastAction}`,
      font: '14px Arial',
      fillStyle: '#334155',
    }),
    text({
      x: 248,
      y: 122,
      text: 'update · click · reset',
      font: '14px Arial',
      fillStyle: '#475569',
    }),
  ];
});

function initialState(lastAction: SmokeScenarioAction = 'mount'): SmokeScenarioState {
  return {
    revision: 0,
    clicks: 0,
    lastAction,
  };
}

function mountSmokeScenario(
  context: ScenarioMountContext<SmokeScenarioState>,
): ScenarioController<SmokeScenarioState> {
  const abortController = new AbortController();
  let disposed = false;
  let state = initialState();

  const render = () => {
    if (disposed) {
      throw new Error('Cannot render a disposed smoke scenario.');
    }

    crc(
      context.canvas,
      SmokeScene({
        state,
        onClick: () => {
          state = {
            ...state,
            clicks: state.clicks + 1,
            lastAction: 'click',
          };
          render();
        },
      }),
      { signal: abortController.signal },
    );
    context.onStateChange?.({ ...state });
  };

  context.canvas.width = SMOKE_CANVAS_WIDTH;
  context.canvas.height = SMOKE_CANVAS_HEIGHT;
  render();

  return {
    getState: () => ({ ...state }),
    update: () => {
      state = {
        ...state,
        revision: state.revision + 1,
        lastAction: 'update',
      };
      render();
    },
    reset: () => {
      state = initialState('reset');
      render();
    },
    dispose: () => {
      if (disposed) {
        return;
      }
      disposed = true;
      abortController.abort();
    },
  };
}

export const smokeScenario: ScenarioDefinition<SmokeScenarioState> = {
  metadata: {
    id: 'baseline-smoke',
    slug: 'baseline-smoke',
    title: 'Baseline smoke',
    summary: 'Mount, render, update, click, and reset one public-API CRC scene.',
    category: 'Getting started',
    apiTags: ['crc', 'defineComp', 'rect', 'text'],
    conceptTags: ['mount', 'render', 'state update', 'mouse click'],
    manualSteps: [
      {
        action: 'Open the scenario or choose Reset.',
        expected: 'A blue rectangle reports revision 0, clicks 0, and reset/mount as the last action.',
      },
      {
        action: 'Choose Update scene.',
        expected: 'The rectangle turns purple and the revision increases by one.',
      },
      {
        action: 'Click inside the colored rectangle.',
        expected: 'The rectangle turns orange and the click count increases by one.',
      },
      {
        action: 'Choose Reset.',
        expected: 'The blue initial scene returns with revision 0 and clicks 0.',
      },
    ],
    knownLimitations: [
      'This baseline covers Chromium mouse input only; broader browser and input coverage belongs to later plan steps.',
      'The Canvas click target has no keyboard equivalent in the current public API.',
    ],
    sourcePath: 'packages/scenarios/src/smoke.ts',
    visibility: 'documentation-candidate',
    maturity: 'baseline',
  },
  canvas: {
    width: SMOKE_CANVAS_WIDTH,
    height: SMOKE_CANVAS_HEIGHT,
  },
  mount: mountSmokeScenario,
  formatState: state => [
    { label: 'Revision', value: String(state.revision) },
    { label: 'Clicks', value: String(state.clicks) },
    { label: 'Last action', value: state.lastAction },
  ],
};
