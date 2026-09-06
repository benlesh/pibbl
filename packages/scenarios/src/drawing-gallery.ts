import type {
  ScenarioController,
  ScenarioDefinition,
  ScenarioMountContext,
  ScenarioStateField,
} from './types';
import { crc } from '@crc/core';
import type {
  DrawingCompositionAction,
  DrawingCompositionState,
} from './drawing-composition.example';
import {
  createDrawingCompositionScene,
  DRAWING_COMPOSITION_SOURCE_ID,
} from './drawing-composition.example';
import type {
  DrawingImagesAction,
  DrawingImagesState,
} from './drawing-images.example';
import {
  createDrawingImagesScene,
  DRAWING_IMAGES_SOURCE_ID,
} from './drawing-images.example';
import type {
  DrawingLinesAction,
  DrawingLinesState,
} from './drawing-lines.example';
import {
  createDrawingLinesScene,
  DRAWING_LINES_SOURCE_ID,
} from './drawing-lines.example';
import type {
  DrawingShapesAction,
  DrawingShapesState,
} from './drawing-shapes.example';
import {
  createDrawingShapesScene,
  DRAWING_SHAPES_SOURCE_ID,
} from './drawing-shapes.example';
import type {
  DrawingTextAction,
  DrawingTextState,
} from './drawing-text.example';
import {
  createDrawingTextScene,
  DRAWING_TEXT_SOURCE_ID,
} from './drawing-text.example';

export type {
  DrawingCompositionAction,
  DrawingCompositionState,
} from './drawing-composition.example';
export type {
  DrawingImageMode,
  DrawingImageSizing,
  DrawingImagesAction,
  DrawingImagesState,
} from './drawing-images.example';
export type {
  DrawingLinesAction,
  DrawingLinesState,
} from './drawing-lines.example';
export type {
  DrawingShapesAction,
  DrawingShapesState,
} from './drawing-shapes.example';
export type {
  DrawingTextAction,
  DrawingTextState,
} from './drawing-text.example';

interface LessonState {
  lastAction: string;
  revision: number;
}

interface LessonConfig<TState extends LessonState> {
  actionIds: readonly string[];
  formatState: (state: Readonly<TState>) => readonly ScenarioStateField[];
  id: string;
  initialState: (lastAction: string) => TState;
  renderScene: (
    canvas: HTMLCanvasElement,
    state: Readonly<TState>,
    signal: AbortSignal,
    updateState: (update: (state: Readonly<TState>) => TState) => void,
  ) => void;
  sourceId: string;
  update: (state: Readonly<TState>, actionId: string) => TState;
}

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

function createLessonDefinition<TState extends LessonState>(
  config: LessonConfig<TState>,
): ScenarioDefinition<TState> {
  return {
    id: config.id,
    sourceId: config.sourceId,
    actionIds: config.actionIds,
    mount: async (context: ScenarioMountContext<TState>) => {
      const abortController = new AbortController();
      let disposed = false;
      let pendingRender = Promise.resolve();
      let state = config.initialState('mount');

      const assertActive = () => {
        if (disposed) {
          throw new Error(`Cannot operate on disposed drawing lesson "${config.id}".`);
        }
      };
      const publish = () => context.onStateChange?.({ ...state });
      const render = async () => {
        assertActive();
        config.renderScene(
          context.canvas,
          state,
          abortController.signal,
          (update) => {
            state = update(state);
            void render();
          },
        );
        pendingRender = nextFrame();
        await pendingRender;
        assertActive();
        publish();
      };

      await render();

      return {
        getState: () => ({ ...state }),
        perform: async (actionId: string) => {
          assertActive();
          if (!config.actionIds.includes(actionId)) {
            throw new Error(`Drawing lesson "${config.id}" does not support action "${actionId}".`);
          }
          state = config.update(state, actionId);
          await render();
        },
        reset: async () => {
          assertActive();
          state = config.initialState('reset');
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
      } satisfies ScenarioController<TState>;
    },
    formatState: config.formatState,
  };
}

function nextToggleState<TAction extends string, TState extends {
  lastAction: TAction;
  revision: number;
  updated: boolean;
}>(state: Readonly<TState>, action: TAction): TState {
  return {
    ...state,
    lastAction: action,
    revision: state.revision + 1,
    updated: !state.updated,
  };
}

function formatToggleState(
  state: Readonly<{ lastAction: string; revision: number; updated: boolean }>,
  exports: string,
): readonly ScenarioStateField[] {
  return [
    { label: 'Example', value: state.updated ? 'updated' : 'initial' },
    { label: 'Revision', value: String(state.revision) },
    { label: 'Exports', value: exports },
    { label: 'Last action', value: state.lastAction },
  ];
}

export const DRAWING_SHAPES_ACTION_IDS = ['update-shapes'] as const;

export const drawingShapesScenario = createLessonDefinition<DrawingShapesState>({
  id: 'drawing-shapes',
  sourceId: DRAWING_SHAPES_SOURCE_ID,
  actionIds: DRAWING_SHAPES_ACTION_IDS,
  renderScene: (canvas, state, signal) => {
    crc(canvas, createDrawingShapesScene(state), { signal });
  },
  initialState: lastAction => ({
    lastAction: lastAction as DrawingShapesAction,
    revision: 0,
    updated: false,
  }),
  update: (state, actionId) => nextToggleState(
    state,
    actionId as DrawingShapesAction,
  ),
  formatState: state => formatToggleState(
    state,
    'Rectangle · Path · SvgPath · Circle · Ellipse · Arc · Wedge · Polygon',
  ),
});

export const DRAWING_LINES_ACTION_IDS = ['update-lines'] as const;

export const drawingLinesScenario = createLessonDefinition<DrawingLinesState>({
  id: 'drawing-lines',
  sourceId: DRAWING_LINES_SOURCE_ID,
  actionIds: DRAWING_LINES_ACTION_IDS,
  renderScene: (canvas, state, signal) => {
    crc(canvas, createDrawingLinesScene(state), { signal });
  },
  initialState: lastAction => ({
    lastAction: lastAction as DrawingLinesAction,
    revision: 0,
    updated: false,
  }),
  update: (state, actionId) => nextToggleState(
    state,
    actionId as DrawingLinesAction,
  ),
  formatState: state => formatToggleState(
    state,
    'Line · HorizontalLine · VerticalLine',
  ),
});

export const DRAWING_TEXT_ACTION_IDS = ['update-copy'] as const;

export const drawingTextScenario = createLessonDefinition<DrawingTextState>({
  id: 'drawing-text',
  sourceId: DRAWING_TEXT_SOURCE_ID,
  actionIds: DRAWING_TEXT_ACTION_IDS,
  renderScene: (canvas, state, signal, updateState) => {
    crc(canvas, createDrawingTextScene(state, () => {
      updateState(current => ({
        ...current,
        centeredClicks: current.centeredClicks + 1,
        lastAction: 'click-centered',
        revision: current.revision + 1,
      }));
    }), { signal });
  },
  initialState: lastAction => ({
    centeredClicks: 0,
    lastAction: lastAction as DrawingTextAction,
    revision: 0,
    updated: false,
  }),
  update: (state, actionId) => nextToggleState(
    state,
    actionId as DrawingTextAction,
  ),
  formatState: state => [
    ...formatToggleState(
      state,
      'Text · ellipsis · squish · wrap · clip',
    ),
    { label: 'Centered clicks', value: String(state.centeredClicks) },
  ],
});

export const DRAWING_IMAGES_ACTION_IDS = [
  'change-image',
  'use-natural-size',
  'use-explicit-size',
  'show-broken-image',
  'remove-image',
  'show-image',
] as const;

function initialImagesState(lastAction: DrawingImagesAction): DrawingImagesState {
  return {
    lastAction,
    mode: 'primary',
    revision: 0,
    sizing: 'explicit',
  };
}

export const drawingImagesScenario = createLessonDefinition<DrawingImagesState>({
  id: 'drawing-images',
  sourceId: DRAWING_IMAGES_SOURCE_ID,
  actionIds: DRAWING_IMAGES_ACTION_IDS,
  renderScene: (canvas, state, signal) => {
    crc(canvas, createDrawingImagesScene(state), { signal });
  },
  initialState: lastAction => initialImagesState(lastAction as DrawingImagesAction),
  update: (state, actionId) => {
    const action = actionId as DrawingImagesAction;
    const nextState: DrawingImagesState = {
      ...state,
      lastAction: action,
      revision: state.revision + 1,
    };
    switch (action) {
      case 'change-image':
        nextState.mode = 'secondary';
        break;
      case 'show-broken-image':
        nextState.mode = 'broken';
        break;
      case 'remove-image':
        nextState.mode = 'hidden';
        break;
      case 'show-image':
        nextState.mode = 'primary';
        break;
      case 'use-natural-size':
        nextState.sizing = 'natural';
        break;
      case 'use-explicit-size':
        nextState.sizing = 'explicit';
        break;
      case 'mount':
      case 'reset':
        break;
    }
    return nextState;
  },
  formatState: state => [
    { label: 'Image', value: state.mode },
    { label: 'Sizing', value: state.sizing },
    { label: 'Revision', value: String(state.revision) },
    { label: 'Last action', value: state.lastAction },
  ],
});

export const DRAWING_COMPOSITION_ACTION_IDS = ['update-composition'] as const;

export const drawingCompositionScenario =
  createLessonDefinition<DrawingCompositionState>({
    id: 'drawing-composition',
    sourceId: DRAWING_COMPOSITION_SOURCE_ID,
    actionIds: DRAWING_COMPOSITION_ACTION_IDS,
    renderScene: (canvas, state, signal) => {
      crc(canvas, createDrawingCompositionScene(state), { signal });
    },
    initialState: lastAction => ({
      lastAction: lastAction as DrawingCompositionAction,
      revision: 0,
      updated: false,
    }),
    update: (state, actionId) => nextToggleState(
      state,
      actionId as DrawingCompositionAction,
    ),
    formatState: state => formatToggleState(state, 'Group · Clip · Layer'),
  });
