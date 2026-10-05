import { pibbl, type PibblController, type LayoutBox } from '@pibbl/core';
import {
  CANVAS_SURFACE_SOURCE_ID,
  createCanvasSurfaceScene,
  type CanvasSurfaceMode,
  type CanvasSurfaceState,
} from './canvas-surface.example';
import type {
  ScenarioController,
  ScenarioDefinition,
  ScenarioMountContext,
} from './types';

export type {
  CanvasSurfaceAction,
  CanvasSurfaceMode,
  CanvasSurfaceState,
} from './canvas-surface.example';

function initialState(): CanvasSurfaceState {
  return {
    mode: 'fixed',
    cssWidth: 480,
    cssHeight: 240,
    logicalWidth: 480,
    logicalHeight: 240,
    backingWidth: 480,
    backingHeight: 240,
    pixelRatio: 2,
    identity: 0,
    renders: 0,
    lastCoordinates: null,
    lastAction: 'mount',
  };
}

async function mountCanvasSurface(
  context: ScenarioMountContext<CanvasSurfaceState>,
): Promise<ScenarioController<CanvasSurfaceState>> {
  let disposed = false;
  let state = initialState();
  let mountAbort: AbortController | undefined;
  let runtime: PibblController | undefined;
  let pending = Promise.resolve();

  const assertActive = () => {
    if (disposed) {
      throw new Error('Cannot operate on a disposed Canvas surface scenario.');
    }
  };
  const publish = () => context.onStateChange?.({ ...state });
  const updateSurfaceState = (box: Readonly<LayoutBox>, identity: number) => {
    const bounds = context.canvas.getBoundingClientRect();
    state = {
      ...state,
      cssWidth: bounds.width,
      cssHeight: bounds.height,
      logicalWidth: box.width,
      logicalHeight: box.height,
      backingWidth: context.canvas.width,
      backingHeight: context.canvas.height,
      identity,
      renders: state.renders + 1,
    };
    publish();
  };
  const mountMode = async (mode: CanvasSurfaceMode) => {
    mountAbort?.abort();
    mountAbort = new AbortController();
    state = { ...state, mode };
    runtime = pibbl(
      context.canvas,
      createCanvasSurfaceScene({
        mode,
        onMouseMove: (x, y) => {
          state = {
            ...state,
            lastCoordinates: [x, y],
            lastAction: 'mousemove',
          };
          publish();
        },
        onRender: updateSurfaceState,
      }),
      mode === 'fixed' ?
        {
          signal: mountAbort.signal,
          viewport: { width: 480, height: 240 },
          fit: 'contain',
          pixelRatio: 2,
        } :
        {
          signal: mountAbort.signal,
          viewport: 'responsive',
          pixelRatio: 2,
        },
    );
    pending = settleSurface();
    await pending;
  };
  const setCssSize = async (width: number, height: number) => {
    context.canvas.style.width = `${width}px`;
    context.canvas.style.height = `${height}px`;
    pending = settleSurface();
    await pending;
  };
  const reset = async () => {
    assertActive();
    context.canvas.style.width = '480px';
    context.canvas.style.height = '240px';
    state = { ...initialState(), lastAction: 'reset' };
    await mountMode('fixed');
  };

  context.canvas.style.width = '480px';
  context.canvas.style.height = '240px';
  await mountMode('fixed');

  return {
    getState: () => ({ ...state }),
    perform: async actionId => {
      assertActive();
      switch (actionId) {
        case 'resize-fixed':
          if (state.mode !== 'fixed') await mountMode('fixed');
          state = { ...state, lastAction: 'resize-fixed' };
          await setCssSize(720, 360);
          return;
        case 'show-responsive':
          state = { ...state, lastAction: 'show-responsive' };
          await mountMode('responsive');
          return;
        case 'resize-responsive':
          if (state.mode !== 'responsive') await mountMode('responsive');
          state = { ...state, lastAction: 'resize-responsive' };
          await setCssSize(600, 300);
          return;
        default:
          throw new Error(`Canvas surface scenario does not support action "${actionId}".`);
      }
    },
    reset,
    settled: async () => pending,
    dispose: async () => {
      if (disposed) return;
      await pending;
      disposed = true;
      mountAbort?.abort();
      runtime?.dispose();
    },
  };
}

export const canvasSurfaceScenario: ScenarioDefinition<CanvasSurfaceState> = {
  id: 'canvas-surface',
  sourceId: CANVAS_SURFACE_SOURCE_ID,
  actionIds: ['resize-fixed', 'show-responsive', 'resize-responsive'],
  mount: mountCanvasSurface,
  formatState: state => [
    { label: 'Mode', value: state.mode },
    { label: 'CSS size', value: `${state.cssWidth} × ${state.cssHeight}` },
    { label: 'Logical size', value: `${state.logicalWidth} × ${state.logicalHeight}` },
    { label: 'Backing size', value: `${state.backingWidth} × ${state.backingHeight}` },
    { label: 'Pixel ratio', value: String(state.pixelRatio) },
    { label: 'Identity', value: String(state.identity) },
    { label: 'Last coordinates', value: state.lastCoordinates?.join(', ') ?? 'none' },
  ],
};

async function settleSurface(): Promise<void> {
  await nextFrame();
  await nextFrame();
  await nextFrame();
}

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}
