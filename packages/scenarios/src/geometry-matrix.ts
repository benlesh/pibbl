import type {
  GeometryMatrixAction,
  GeometryMatrixCaseId,
  GeometryMatrixRecord,
  GeometryMatrixState,
} from './geometry-matrix.example';
import type {
  ScenarioController,
  ScenarioDefinition,
  ScenarioMountContext,
} from './types';
import { pibbl } from '@pibbl/core';
import { EventTraceRecorder } from './event-trace';
import {
  createGeometryMatrixScene,
  GEOMETRY_MATRIX_CASES,
  GEOMETRY_MATRIX_SOURCE_ID,
} from './geometry-matrix.example';

export type {
  GeometryMatrixAction,
  GeometryMatrixCaseId,
  GeometryMatrixState,
} from './geometry-matrix.example';

export const GEOMETRY_MATRIX_ACTION_IDS = [
  ...GEOMETRY_MATRIX_CASES.map(matrixCase => `show-${matrixCase.id}` as const),
  'clear-trace',
] as const;

function getMatrixCase(caseId: GeometryMatrixCaseId) {
  const matrixCase = GEOMETRY_MATRIX_CASES.find(candidate => candidate.id === caseId);
  if (!matrixCase) {
    throw new Error(`Unknown geometry matrix case "${caseId}".`);
  }
  return matrixCase;
}

function initialState(lastAction: GeometryMatrixAction = 'mount'): GeometryMatrixState {
  const matrixCase = GEOMETRY_MATRIX_CASES[0];
  return {
    caseId: matrixCase.id,
    cssHeight: matrixCase.cssSize.height,
    cssWidth: matrixCase.cssSize.width,
    lastAction,
    lastCoordinates: null,
    lastTarget: null,
    trace: [],
  };
}

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

async function mountGeometryMatrix(
  context: ScenarioMountContext<GeometryMatrixState>,
): Promise<ScenarioController<GeometryMatrixState>> {
  const abortController = new AbortController();
  const originalWidth = context.canvas.style.width;
  const originalHeight = context.canvas.style.height;
  const recorder = new EventTraceRecorder();
  let disposed = false;
  let state = initialState();
  let pendingRender = Promise.resolve();

  const assertActive = () => {
    if (disposed) {
      throw new Error('Cannot operate on a disposed geometry matrix.');
    }
  };
  const publish = () => context.onStateChange?.({ ...state, trace: [...state.trace] });
  const record: GeometryMatrixRecord = (input) => {
    const entry = recorder.record(input);
    state = {
      ...state,
      lastCoordinates: [entry.x, entry.y],
      lastTarget: entry.target,
      trace: recorder.getEntries(),
    };
    publish();
  };
  const render = () => {
    assertActive();
    const matrixCase = getMatrixCase(state.caseId);
    context.canvas.style.width = `${matrixCase.cssSize.width}px`;
    context.canvas.style.height = `${matrixCase.cssSize.height}px`;
    pibbl(context.canvas, createGeometryMatrixScene({ caseId: state.caseId, record }), {
      signal: abortController.signal,
    });
    publish();
    pendingRender = nextFrame();
    return pendingRender;
  };
  const select = async (caseId: GeometryMatrixCaseId, action: GeometryMatrixAction) => {
    const matrixCase = getMatrixCase(caseId);
    recorder.reset();
    state = {
      caseId,
      cssHeight: matrixCase.cssSize.height,
      cssWidth: matrixCase.cssSize.width,
      lastAction: action,
      lastCoordinates: null,
      lastTarget: null,
      trace: [],
    };
    await render();
  };

  await render();

  return {
    getState: () => ({ ...state, trace: [...state.trace] }),
    perform: async (actionId) => {
      assertActive();
      if (actionId === 'clear-trace') {
        recorder.reset();
        state = {
          ...state,
          lastAction: 'clear-trace',
          lastCoordinates: null,
          lastTarget: null,
          trace: [],
        };
        publish();
        return;
      }

      const caseId = actionId.startsWith('show-') ?
        actionId.slice(5) as GeometryMatrixCaseId :
        undefined;
      if (!caseId || !GEOMETRY_MATRIX_CASES.some(candidate => candidate.id === caseId)) {
        throw new Error(`Geometry matrix does not support action "${actionId}".`);
      }
      await select(caseId, actionId as GeometryMatrixAction);
    },
    reset: async () => {
      assertActive();
      await select(GEOMETRY_MATRIX_CASES[0].id, 'reset');
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
      context.canvas.style.width = originalWidth;
      context.canvas.style.height = originalHeight;
    },
  };
}

function formatTrace(state: Readonly<GeometryMatrixState>): string {
  return state.trace.length ?
    state.trace.map(entry => `${entry.type}(${entry.target})`).join(' → ') :
    'none';
}

export const geometryMatrixScenario: ScenarioDefinition<GeometryMatrixState> = {
  id: 'geometry-composition-matrix',
  sourceId: GEOMETRY_MATRIX_SOURCE_ID,
  actionIds: GEOMETRY_MATRIX_ACTION_IDS,
  mount: mountGeometryMatrix,
  formatState: state => [
    { label: 'Case', value: getMatrixCase(state.caseId).title },
    { label: 'Actual trace', value: formatTrace(state) },
    { label: 'Last target', value: state.lastTarget ?? 'none' },
    {
      label: 'Last coordinates',
      value: state.lastCoordinates ? state.lastCoordinates.join(', ') : 'none',
    },
    {
      label: 'Canvas size',
      value: `480 × 240 intrinsic · ${state.cssWidth} × ${state.cssHeight} CSS`,
    },
    { label: 'Last action', value: state.lastAction },
  ],
};
