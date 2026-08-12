import type {
  PerformanceCounters,
  PerformanceLabState,
  PerformanceWorkload,
  PerformanceWorkloadId,
  ScenarioController,
} from '@crc/scenarios';
import {
  PERFORMANCE_WORKLOADS,
  loadScenario,
  performanceLabScenarioEntry,
} from '@crc/scenarios';
import { afterEach, describe, expect, it } from 'vitest';
import performanceLabSource from '../../scenarios/src/performance-lab.example.ts?raw';
import { GLOBAL_STATE, getCRCInstance } from '../src/lib/global-state';
import type { Canvas, CRCInstance } from '../src/lib/types';
import { RuntimeDiagnostics } from './support/runtime-diagnostics';
import { expectVisualMatch } from './visual-compare';

interface PerformanceObservation {
  dispatchesPerSample: number;
  medianMs: number;
  p95Ms: number;
  p99Ms: number;
  regionCount: number;
  selectionMs: number;
  workloadId: PerformanceWorkloadId;
}

interface PerformanceBudget {
  medianMs: number;
  p95Ms: number;
}

interface InstanceSummary {
  componentRefs: number;
  instances: number;
  paintEntries: number;
  regions: number;
}

const EMPTY_COUNTERS: PerformanceCounters = {
  getContext: 0,
  matrixMultiply: 0,
  pathTests: 0,
  restore: 0,
  save: 0,
  setTransform: 0,
  strokeTests: 0,
};

const DISPATCHES_PER_SAMPLE: Record<PerformanceWorkloadId, number> = {
  'clipped-1000': 5,
  'cursor-1000': 10,
  'dense-1000': 100,
  'dense-10000': 50,
  'layered-1000': 5,
  'miss-100': 50,
  'miss-1000': 10,
  'miss-10000': 1,
  'sparse-100': 50,
  'sparse-1000': 10,
  'sparse-10000': 1,
  'transformed-1000': 10,
  zero: 500,
};

const PERFORMANCE_BUDGETS: Record<PerformanceWorkloadId, PerformanceBudget> = {
  'clipped-1000': { medianMs: 1.5, p95Ms: 3 },
  'cursor-1000': { medianMs: 1.5, p95Ms: 3 },
  'dense-1000': { medianMs: 0.75, p95Ms: 1.5 },
  'dense-10000': { medianMs: 1.5, p95Ms: 3 },
  'layered-1000': { medianMs: 1.5, p95Ms: 3 },
  'miss-100': { medianMs: 0.1, p95Ms: 0.25 },
  'miss-1000': { medianMs: 0.75, p95Ms: 1.5 },
  'miss-10000': { medianMs: 6, p95Ms: 12 },
  'sparse-100': { medianMs: 0.1, p95Ms: 0.25 },
  'sparse-1000': { medianMs: 0.75, p95Ms: 1.5 },
  'sparse-10000': { medianMs: 6, p95Ms: 12 },
  'transformed-1000': { medianMs: 2.25, p95Ms: 3 },
  zero: { medianMs: 0.05, p95Ms: 0.1 },
};
const RERENDER_BUDGET = { medianMs: 5, p95Ms: 8 } as const;

const WARMUP_BATCHES = 5;
const MEASURED_BATCHES = 101;
const RUN_TIMING =
  import.meta.env.VITE_CRC_PERF_GUARD === '1' ||
  import.meta.env.VITE_CRC_REPORT_PERF === '1';
const activeControllers = new Set<ScenarioController<PerformanceLabState>>();
const activeDiagnostics = new Set<RuntimeDiagnostics>();
const activeFrameDiagnostics = new Set<FrameCallbackDiagnostics>();

class FrameCallbackDiagnostics {
  readonly samples: number[] = [];
  private readonly originalRequestAnimationFrame = window.requestAnimationFrame;
  private restored = false;

  constructor() {
    window.requestAnimationFrame = (callback) =>
      this.originalRequestAnimationFrame.call(window, (timestamp) => {
        const started = performance.now();
        try {
          callback(timestamp);
        } finally {
          this.samples.push(performance.now() - started);
        }
      });
  }

  reset(): void {
    this.samples.length = 0;
  }

  restore(): void {
    if (this.restored) {
      return;
    }
    this.restored = true;
    window.requestAnimationFrame = this.originalRequestAnimationFrame;
  }
}

function round(value: number): number {
  return Number(value.toFixed(3));
}

function percentile(samples: readonly number[], fraction: number): number {
  const sorted = [...samples].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil(sorted.length * fraction) - 1);
  return round(sorted[index]);
}

function expectedCounters(workload: PerformanceWorkload): PerformanceCounters {
  const regions = workload.regionCount;
  switch (workload.kind) {
    case 'zero':
      return EMPTY_COUNTERS;
    case 'dense':
      return {
        ...EMPTY_COUNTERS,
        getContext: 1,
        pathTests: 1,
        restore: 1,
        save: 1,
      };
    case 'clipped':
      return {
        ...EMPTY_COUNTERS,
        getContext: regions,
        pathTests: regions * 2,
        restore: regions,
        save: regions,
      };
    case 'transformed':
      return {
        ...EMPTY_COUNTERS,
        getContext: regions,
        pathTests: regions,
        restore: regions,
        save: regions,
        setTransform: regions,
      };
    case 'layered':
      return {
        ...EMPTY_COUNTERS,
        getContext: regions,
        pathTests: regions * 2,
        restore: regions,
        save: regions,
      };
    case 'cursor':
    case 'miss':
    case 'sparse':
      return {
        ...EMPTY_COUNTERS,
        getContext: regions,
        pathTests: regions,
        restore: regions,
        save: regions,
      };
  }
}

function clientPoint(
  canvas: HTMLCanvasElement,
  workload: PerformanceWorkload,
): { clientX: number; clientY: number } {
  const bounds = canvas.getBoundingClientRect();
  return {
    clientX: bounds.left + workload.probe.x * bounds.width / canvas.width,
    clientY: bounds.top + workload.probe.y * bounds.height / canvas.height,
  };
}

function dispatchProbe(canvas: HTMLCanvasElement, workload: PerformanceWorkload): void {
  canvas.dispatchEvent(new MouseEvent('mousemove', {
    ...clientPoint(canvas, workload),
    bubbles: true,
  }));
}

function pixelAt(
  canvas: HTMLCanvasElement,
  workload: PerformanceWorkload,
): readonly number[] {
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('The performance laboratory Canvas has no 2D context.');
  }
  return Array.from(context.getImageData(
    Math.floor(workload.probe.x),
    Math.floor(workload.probe.y),
    1,
    1,
  ).data);
}

function ownedInstances(canvas: HTMLCanvasElement): CRCInstance[] {
  const ownedCanvases = new Set<Canvas>([canvas]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const [candidateCanvas, instance] of GLOBAL_STATE.crcInstances) {
      if (instance.parent && ownedCanvases.has(instance.parent) && !ownedCanvases.has(candidateCanvas)) {
        ownedCanvases.add(candidateCanvas);
        changed = true;
      }
    }
  }
  return Array.from(ownedCanvases)
    .map(candidate => GLOBAL_STATE.crcInstances.get(candidate))
    .filter((instance): instance is CRCInstance => Boolean(instance));
}

function summarizeInstances(canvas: HTMLCanvasElement): InstanceSummary {
  const instances = ownedInstances(canvas);
  let componentRefs = 0;
  let paintEntries = 0;
  let regions = 0;
  for (const instance of instances) {
    componentRefs += instance.refs.size;
    paintEntries += instance.paintEntries.size;
    regions += instance.regions.size;
  }
  return { componentRefs, instances: instances.length, paintEntries, regions };
}

async function mountLab(options: { diagnostics?: boolean } = {}) {
  if (activeControllers.size > 0) {
    throw new Error('Performance instrumentation requires one isolated laboratory controller.');
  }
  const canvas = document.createElement('canvas');
  canvas.width = performanceLabScenarioEntry.canvas.width;
  canvas.height = performanceLabScenarioEntry.canvas.height;
  canvas.style.cssText = 'display:block; width:480px; height:240px';
  document.body.replaceChildren(canvas);
  const diagnostics = options.diagnostics ? new RuntimeDiagnostics(canvas) : undefined;
  if (diagnostics) {
    activeDiagnostics.add(diagnostics);
  }
  const definition = await loadScenario(performanceLabScenarioEntry);
  const controller = await definition.mount({ canvas });
  activeControllers.add(controller);
  return { canvas, controller, definition, diagnostics };
}

async function selectWorkload(
  controller: ScenarioController<PerformanceLabState>,
  workload: PerformanceWorkload,
): Promise<number> {
  const started = performance.now();
  await controller.perform(`show-${workload.id}`);
  return round(performance.now() - started);
}

function installCounterRegressionDrill(canvas: HTMLCanvasElement): void {
  if (import.meta.env.VITE_CRC_PERF_COUNTER_DRILL !== '1') {
    return;
  }
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('The performance counter drill Canvas has no 2D context.');
  }
  const measuredIsPointInPath = context.isPointInPath;
  context.isPointInPath = ((
    ...args: Parameters<CanvasRenderingContext2D['isPointInPath']>
  ) => {
    measuredIsPointInPath.apply(context, args);
    return measuredIsPointInPath.apply(context, args);
  }) as CanvasRenderingContext2D['isPointInPath'];
}

afterEach(async () => {
  for (const controller of activeControllers) {
    await controller.dispose();
  }
  activeControllers.clear();
  for (const diagnostics of activeDiagnostics) {
    diagnostics.restore();
  }
  activeDiagnostics.clear();
  for (const diagnostics of activeFrameDiagnostics) {
    diagnostics.restore();
  }
  activeFrameDiagnostics.clear();
  document.body.replaceChildren();
});

describe('shared event performance laboratory', () => {
  it('loads through the catalog/source adapter and matches one exact text-free correctness image', async () => {
    expect(performanceLabSource).toContain(performanceLabScenarioEntry.source.marker);
    expect(performanceLabScenarioEntry.actions.map(action => action.id)).toEqual([
      ...PERFORMANCE_WORKLOADS.map(workload => `show-${workload.id}`),
      'rerender-25',
    ]);
    const { canvas, controller, definition } = await mountLab();
    await controller.perform('show-sparse-1000');
    expect(definition.formatState(controller.getState())).toContainEqual({
      label: 'Regions',
      value: '1,000',
    });
    await expectVisualMatch({
      element: canvas,
      expectedPath: 'packages/core/test/visual-baselines/tfc-06-sparse-1000.expected.png',
      expectedArtifactPath: 'test-screenshots/tfc-06/sparse-1000.expected.png',
      actualPath: '../../../test-screenshots/tfc-06/sparse-1000.actual.png',
      diffPath: 'test-screenshots/tfc-06/sparse-1000.diff.png',
    });
  });

  it('reports exact hit-test structure and visible correctness for every workload', async () => {
    const { canvas, controller } = await mountLab();
    installCounterRegressionDrill(canvas);

    for (const workload of PERFORMANCE_WORKLOADS) {
      await controller.perform(`show-${workload.id}`);
      const expectedInstances = workload.kind === 'layered' ? 5 : 1;
      const expectedPaintEntries = workload.kind === 'layered' ?
        workload.regionCount + 4 :
        workload.regionCount;
      expect(summarizeInstances(canvas), workload.id).toMatchObject({
        instances: expectedInstances,
        paintEntries: expectedPaintEntries,
        regions: workload.regionCount,
      });
      expect(pixelAt(canvas, workload), workload.id).toEqual(
        workload.expectedTarget ? [22, 163, 74, 255] : [248, 250, 252, 255],
      );

      dispatchProbe(canvas, workload);
      expect(controller.getState(), workload.id).toMatchObject({
        callbacks: workload.expectedTarget ? 1 : 0,
        counters: expectedCounters(workload),
        dispatches: 1,
        lastTarget: workload.expectedTarget,
        regionCount: workload.regionCount,
        sampleCount: 1,
        workloadId: workload.id,
      });
      expect(canvas.style.cursor, workload.id).toBe(workload.kind === 'cursor' ? 'pointer' : '');
    }

    await controller.reset();
    expect(controller.getState()).toMatchObject({
      counters: EMPTY_COUNTERS,
      dispatches: 0,
      lastAction: 'reset',
      lastTarget: null,
      regionCount: 0,
      sampleCount: 0,
      workloadId: 'zero',
    });
  }, 40_000);

  it('keeps registration, paint entries, teardowns, and handler ownership bounded across unchanged rerenders', async () => {
    const { canvas, controller, diagnostics } = await mountLab({ diagnostics: true });
    await controller.perform('show-sparse-1000');
    const instanceBefore = summarizeInstances(canvas);
    const resourcesBefore = diagnostics!.snapshot();
    expect(instanceBefore).toMatchObject({ instances: 1, paintEntries: 1_000, regions: 1_000 });
    expect(resourcesBefore.handlers.mousemove).toBe(1_000);
    expect(getCRCInstance(canvas).animationFrameId).toBeUndefined();

    await controller.perform('rerender-25');
    expect(controller.getState()).toMatchObject({
      completedRenders: 26,
      lastAction: 'rerender-25',
      renderedRevision: 26,
      revision: 26,
    });
    expect(summarizeInstances(canvas)).toEqual(instanceBefore);
    expect(diagnostics!.snapshot()).toEqual(resourcesBefore);
    const handlerLedger = diagnostics!.ledgerSnapshot().handlers.mousemove;
    expect(handlerLedger).toMatchObject({ duplicateReleases: 0, live: 1_000 });
    expect(handlerLedger.acquired - handlerLedger.released).toBe(handlerLedger.live);
    expect(getCRCInstance(canvas).animationFrameId).toBeUndefined();

    dispatchProbe(canvas, PERFORMANCE_WORKLOADS[2]);
    expect(controller.getState()).toMatchObject({
      counters: expectedCounters(PERFORMANCE_WORKLOADS[2]),
      lastTarget: 'region-0',
    });
  }, 40_000);

  it.skipIf(!RUN_TIMING)('measures actual scheduled render callbacks separately from frame-settle latency', async () => {
    const frameDiagnostics = new FrameCallbackDiagnostics();
    activeFrameDiagnostics.add(frameDiagnostics);
    const { canvas, controller } = await mountLab();

    frameDiagnostics.reset();
    await controller.perform('show-sparse-1000');
    expect(frameDiagnostics.samples).toHaveLength(2);
    const selectionRenderMs = round(frameDiagnostics.samples[0]);
    frameDiagnostics.reset();
    await controller.perform('rerender-25');
    expect(frameDiagnostics.samples).toHaveLength(50);
    const renderSamples = frameDiagnostics.samples.filter((_, index) => index % 2 === 0);
    expect(renderSamples).toHaveLength(25);
    expect(controller.getState()).toMatchObject({
      completedRenders: 26,
      renderedRevision: 26,
      revision: 26,
    });
    expect(summarizeInstances(canvas)).toMatchObject({ regions: 1_000, paintEntries: 1_000 });
    const renderMedianMs = percentile(renderSamples, 0.5);
    const renderP95Ms = percentile(renderSamples, 0.95);

    if (import.meta.env.VITE_CRC_PERF_GUARD === '1') {
      expect(renderMedianMs, 'sparse-1000 rerender median').toBeLessThanOrEqual(
        RERENDER_BUDGET.medianMs,
      );
      expect(renderP95Ms, 'sparse-1000 rerender p95').toBeLessThanOrEqual(
        RERENDER_BUDGET.p95Ms,
      );
    }

    if (import.meta.env.VITE_CRC_REPORT_PERF === '1') {
      console.warn('TFC-06 render observations', JSON.stringify({
        renderCallbacks: {
          medianMs: renderMedianMs,
          p95Ms: renderP95Ms,
          p99Ms: percentile(renderSamples, 0.99),
        },
        selectionRenderMs,
        settleLatencyMs: controller.getState().lastSettleLatencyMs,
        workloadId: 'sparse-1000',
      }));
    }
  }, 60_000);

  it.skipIf(!RUN_TIMING)('records controlled dispatch curves and enforces opt-in reference budgets', async () => {
    const { canvas, controller } = await mountLab();

    await controller.perform('show-sparse-1000');
    await expectVisualMatch({
      element: canvas,
      expectedPath: 'packages/core/test/visual-baselines/tfc-06-sparse-1000.expected.png',
      expectedArtifactPath: 'test-screenshots/tfc-06/sparse-1000.expected.png',
      actualPath: '../../../test-screenshots/tfc-06/sparse-1000.actual.png',
      diffPath: 'test-screenshots/tfc-06/sparse-1000.diff.png',
    });

    const observations: PerformanceObservation[] = [];
    for (const workload of PERFORMANCE_WORKLOADS) {
      const selectionMs = await selectWorkload(controller, workload);
      const event = new MouseEvent('mousemove', {
        ...clientPoint(canvas, workload),
        bubbles: true,
      });
      const dispatchesPerSample = DISPATCHES_PER_SAMPLE[workload.id];
      const dispatchBatch = () => {
        for (let index = 0; index < dispatchesPerSample; index++) {
          canvas.dispatchEvent(event);
        }
      };
      for (let index = 0; index < WARMUP_BATCHES; index++) {
        dispatchBatch();
      }
      const samples: number[] = [];
      for (let index = 0; index < MEASURED_BATCHES; index++) {
        const started = performance.now();
        dispatchBatch();
        samples.push((performance.now() - started) / dispatchesPerSample);
      }
      const observation = {
        dispatchesPerSample,
        medianMs: percentile(samples, 0.5),
        p95Ms: percentile(samples, 0.95),
        p99Ms: percentile(samples, 0.99),
        regionCount: workload.regionCount,
        selectionMs,
        workloadId: workload.id,
      } satisfies PerformanceObservation;
      observations.push(observation);
      expect(controller.getState().counters, workload.id).toEqual(expectedCounters(workload));
      expect(controller.getState().lastTarget, workload.id).toBe(workload.expectedTarget);
    }

    expect(observations).toHaveLength(PERFORMANCE_WORKLOADS.length);
    expect(observations.every(observation =>
      Number.isFinite(observation.medianMs) &&
      observation.medianMs <= observation.p95Ms &&
      observation.p95Ms <= observation.p99Ms,
    )).toBe(true);

    if (import.meta.env.VITE_CRC_PERF_GUARD === '1') {
      expect(window.devicePixelRatio).toBe(1);
      expect(navigator.userAgent).toContain('Chrome');
      for (const observation of observations) {
        const budget = PERFORMANCE_BUDGETS[observation.workloadId];
        expect(observation.medianMs, `${observation.workloadId} median`).toBeLessThanOrEqual(budget.medianMs);
        expect(observation.p95Ms, `${observation.workloadId} p95`).toBeLessThanOrEqual(budget.p95Ms);
      }
    }

    if (import.meta.env.VITE_CRC_REPORT_PERF === '1') {
      console.warn('TFC-06 dispatch observations', JSON.stringify({
        environment: {
          devicePixelRatio: window.devicePixelRatio,
          hardwareConcurrency: navigator.hardwareConcurrency,
          userAgent: navigator.userAgent,
          viewport: { height: window.innerHeight, width: window.innerWidth },
        },
        measuredBatches: MEASURED_BATCHES,
        observations,
        warmupBatches: WARMUP_BATCHES,
      }));
    }
  }, 60_000);
});
