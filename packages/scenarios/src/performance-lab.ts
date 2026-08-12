import type {
  PerformanceCounters,
  PerformanceLabAction,
  PerformanceLabState,
  PerformanceWorkloadId,
} from './performance-lab.example';
import type {
  ScenarioController,
  ScenarioDefinition,
  ScenarioMountContext,
} from './types';
import { crc } from '@crc/core';
import {
  createPerformanceScene,
  getPerformanceWorkload,
  PERFORMANCE_LAB_SOURCE_ID,
  PERFORMANCE_WORKLOADS,
} from './performance-lab.example';

export type {
  PerformanceCounterName,
  PerformanceCounters,
  PerformanceLabAction,
  PerformanceLabState,
  PerformancePoint,
  PerformanceWorkload,
  PerformanceWorkloadId,
  PerformanceWorkloadKind,
} from './performance-lab.example';

export const PERFORMANCE_LAB_ACTION_IDS = [
  ...PERFORMANCE_WORKLOADS.map(workload => `show-${workload.id}` as const),
  'rerender-25',
] as const;

const SAMPLE_WINDOW = 200;

function emptyCounters(): PerformanceCounters {
  return {
    getContext: 0,
    matrixMultiply: 0,
    pathTests: 0,
    restore: 0,
    save: 0,
    setTransform: 0,
    strokeTests: 0,
  };
}

function round(value: number): number {
  return Number(value.toFixed(3));
}

function percentile(samples: readonly number[], fraction: number): number {
  if (samples.length === 0) {
    return 0;
  }
  const sorted = [...samples].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil(sorted.length * fraction) - 1);
  return round(sorted[index]);
}

function initialState(lastAction: PerformanceLabAction = 'mount'): PerformanceLabState {
  const workload = PERFORMANCE_WORKLOADS[0];
  return {
    callbacks: 0,
    completedRenders: 0,
    counters: emptyCounters(),
    dispatches: 0,
    lastAction,
    lastDurationMs: 0,
    lastSettleLatencyMs: 0,
    lastTarget: null,
    medianMs: 0,
    p95Ms: 0,
    p99Ms: 0,
    regionCount: workload.regionCount,
    revision: 0,
    renderedRevision: -1,
    sampleCount: 0,
    workloadId: workload.id,
  };
}

function snapshotState(state: PerformanceLabState): PerformanceLabState {
  return { ...state, counters: { ...state.counters } };
}

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

class PerformanceInstrumentation {
  private counters = emptyCounters();
  private readonly context: CanvasRenderingContext2D;
  private readonly originalGetContext: HTMLCanvasElement['getContext'];
  private readonly originalIsPointInPath: CanvasRenderingContext2D['isPointInPath'];
  private readonly originalIsPointInStroke: CanvasRenderingContext2D['isPointInStroke'];
  private readonly originalMatrixMultiply: DOMMatrix['multiply'];
  private readonly originalRestore: CanvasRenderingContext2D['restore'];
  private readonly originalSave: CanvasRenderingContext2D['save'];
  private readonly originalSetTransform: CanvasRenderingContext2D['setTransform'];
  private readonly wrappedMatrixMultiply: DOMMatrix['multiply'];
  private restored = false;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('The performance laboratory Canvas has no 2D context.');
    }
    this.context = context;
    this.originalGetContext = canvas.getContext;
    this.originalSave = context.save;
    this.originalRestore = context.restore;
    this.originalSetTransform = context.setTransform;
    this.originalIsPointInPath = context.isPointInPath;
    this.originalIsPointInStroke = context.isPointInStroke;
    this.originalMatrixMultiply = DOMMatrix.prototype.multiply;

    canvas.getContext = ((...args: Parameters<HTMLCanvasElement['getContext']>) => {
      if (args[0] === '2d') {
        this.counters.getContext++;
      }
      return this.originalGetContext.apply(canvas, args);
    }) as HTMLCanvasElement['getContext'];
    context.save = (() => {
      this.counters.save++;
      this.originalSave.call(context);
    }) as CanvasRenderingContext2D['save'];
    context.restore = (() => {
      this.counters.restore++;
      this.originalRestore.call(context);
    }) as CanvasRenderingContext2D['restore'];
    context.setTransform = ((
      ...args: Parameters<CanvasRenderingContext2D['setTransform']>
    ) => {
      this.counters.setTransform++;
      this.originalSetTransform.apply(context, args);
    }) as CanvasRenderingContext2D['setTransform'];
    context.isPointInPath = ((
      ...args: Parameters<CanvasRenderingContext2D['isPointInPath']>
    ) => {
      this.counters.pathTests++;
      return this.originalIsPointInPath.apply(context, args);
    }) as CanvasRenderingContext2D['isPointInPath'];
    context.isPointInStroke = ((
      ...args: Parameters<CanvasRenderingContext2D['isPointInStroke']>
    ) => {
      this.counters.strokeTests++;
      return this.originalIsPointInStroke.apply(context, args);
    }) as CanvasRenderingContext2D['isPointInStroke'];

    const instrumentation = this;
    this.wrappedMatrixMultiply = function (
      this: DOMMatrix,
      other?: DOMMatrixInit,
    ): DOMMatrix {
      instrumentation.counters.matrixMultiply++;
      return instrumentation.originalMatrixMultiply.call(this, other);
    };
    DOMMatrix.prototype.multiply = this.wrappedMatrixMultiply;
  }

  reset(): void {
    this.counters = emptyCounters();
  }

  snapshot(): PerformanceCounters {
    return { ...this.counters };
  }

  restore(): void {
    if (this.restored) {
      return;
    }
    this.restored = true;
    this.canvas.getContext = this.originalGetContext;
    this.context.save = this.originalSave;
    this.context.restore = this.originalRestore;
    this.context.setTransform = this.originalSetTransform;
    this.context.isPointInPath = this.originalIsPointInPath;
    this.context.isPointInStroke = this.originalIsPointInStroke;
    if (DOMMatrix.prototype.multiply === this.wrappedMatrixMultiply) {
      DOMMatrix.prototype.multiply = this.originalMatrixMultiply;
    }
  }
}

async function mountPerformanceLab(
  context: ScenarioMountContext<PerformanceLabState>,
): Promise<ScenarioController<PerformanceLabState>> {
  const abortController = new AbortController();
  const instrumentation = new PerformanceInstrumentation(context.canvas);
  const samples: number[] = [];
  let disposed = false;
  let dispatchStarted = 0;
  let pendingTarget: string | null = null;
  let pendingRender = Promise.resolve();
  let state = initialState();

  const assertActive = () => {
    if (disposed) {
      throw new Error('Cannot operate on a disposed performance laboratory.');
    }
  };
  const publish = () => context.onStateChange?.(snapshotState(state));
  const beforeMove = () => {
    instrumentation.reset();
    pendingTarget = null;
    dispatchStarted = performance.now();
  };
  const recordHit = (target: string) => {
    pendingTarget = target;
    state = { ...state, callbacks: state.callbacks + 1 };
  };
  const recordRender = (revision: number) => {
    state = {
      ...state,
      completedRenders: state.completedRenders + 1,
      renderedRevision: revision,
    };
  };
  const afterMove = () => {
    const duration = round(performance.now() - dispatchStarted);
    samples.push(duration);
    if (samples.length > SAMPLE_WINDOW) {
      samples.shift();
    }
    state = {
      ...state,
      counters: instrumentation.snapshot(),
      dispatches: state.dispatches + 1,
      lastDurationMs: duration,
      lastTarget: pendingTarget,
      medianMs: percentile(samples, 0.5),
      p95Ms: percentile(samples, 0.95),
      p99Ms: percentile(samples, 0.99),
      sampleCount: samples.length,
    };
    publish();
  };
  const render = async () => {
    assertActive();
    const started = performance.now();
    crc(context.canvas, createPerformanceScene({
      workloadId: state.workloadId,
      revision: state.revision,
      recordHit,
      recordRender,
    }), { signal: abortController.signal });
    pendingRender = nextFrame();
    await pendingRender;
    assertActive();
    state = {
      ...state,
      lastSettleLatencyMs: round(performance.now() - started),
    };
    publish();
  };
  const select = async (
    workloadId: PerformanceWorkloadId,
    action: PerformanceLabAction,
  ) => {
    const workload = getPerformanceWorkload(workloadId);
    samples.length = 0;
    state = {
      ...initialState(action),
      regionCount: workload.regionCount,
      revision: state.revision + 1,
      workloadId,
    };
    await render();
  };

  context.canvas.addEventListener('mousemove', beforeMove, {
    signal: abortController.signal,
  });
  await render();
  context.canvas.addEventListener('mousemove', afterMove, {
    signal: abortController.signal,
  });

  return {
    getState: () => snapshotState(state),
    perform: async (actionId) => {
      assertActive();
      if (actionId === 'rerender-25') {
        for (let index = 0; index < 25; index++) {
          state = {
            ...state,
            lastAction: 'rerender-25',
            revision: state.revision + 1,
          };
          await render();
        }
        return;
      }
      const workloadId = actionId.startsWith('show-') ?
        actionId.slice(5) as PerformanceWorkloadId :
        undefined;
      if (!workloadId || !PERFORMANCE_WORKLOADS.some(candidate => candidate.id === workloadId)) {
        throw new Error(`Performance laboratory does not support action "${actionId}".`);
      }
      await select(workloadId, actionId as PerformanceLabAction);
    },
    reset: async () => {
      assertActive();
      await select(PERFORMANCE_WORKLOADS[0].id, 'reset');
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
      instrumentation.restore();
    },
  };
}

function counterSummary(counters: PerformanceCounters): string {
  return [
    `path ${counters.pathTests}`,
    `matrix ${counters.matrixMultiply}`,
    `context ${counters.getContext}`,
    `save/restore ${counters.save}/${counters.restore}`,
    `transform ${counters.setTransform}`,
  ].join(' · ');
}

export const performanceLabScenario: ScenarioDefinition<PerformanceLabState> = {
  id: 'event-performance-lab',
  sourceId: PERFORMANCE_LAB_SOURCE_ID,
  actionIds: PERFORMANCE_LAB_ACTION_IDS,
  mount: mountPerformanceLab,
  formatState: state => [
    { label: 'Workload', value: getPerformanceWorkload(state.workloadId).title },
    { label: 'Regions', value: state.regionCount.toLocaleString('en-US') },
    { label: 'Last target', value: state.lastTarget ?? 'none' },
    { label: 'Hit-test work', value: counterSummary(state.counters) },
    {
      label: 'Dispatch latency',
      value: `${state.lastDurationMs} ms latest · ${state.medianMs} median · ${state.p95Ms} p95 · ${state.p99Ms} p99`,
    },
    { label: 'Samples', value: `${state.sampleCount} of ${SAMPLE_WINDOW}` },
    {
      label: 'Render settle',
      value: `${state.lastSettleLatencyMs} ms · rendered revision ${state.renderedRevision} · ${state.completedRenders} completed`,
    },
    { label: 'Callbacks', value: `${state.callbacks} from ${state.dispatches} moves` },
    { label: 'Last action', value: state.lastAction },
  ],
};
