import type {
  PerformanceCounters,
  PerformanceLabState,
  PerformanceWorkload,
  PerformanceWorkloadId,
  ScenarioController,
} from '@pibbl/scenarios';
import {
  PERFORMANCE_WORKLOADS,
  loadScenario,
  performanceLabScenarioEntry,
} from '@pibbl/scenarios';
import { commands } from 'vitest/browser';
import { afterEach, describe, expect, it } from 'vitest';
import performanceLabSource from '../../scenarios/src/performance-lab.example.tsx?raw';
import { Absolute, pibbl, useEventListener, Flow, Rectangle, Text, type PibblController } from '../src/index';
import { GLOBAL_STATE } from '../src/lib/global-state';
import { snapshotRealmScheduler } from '../src/lib/scheduler/testing';
import {
  resetLayoutDiagnostics,
  snapshotLayoutDiagnostics,
} from '../src/lib/layout/diagnostics';
import type { Canvas, PibblInstance } from '../src/lib/types';
import { RuntimeDiagnostics } from './support/runtime-diagnostics';
import { expectVisualMatch } from './visual-compare';
import { createElement } from '../src/lib/element/create-element';

declare module 'vitest/browser' {
  interface BrowserCommands {
    startDevToolsProfile(kind: 'allocations' | 'cpu'): Promise<void>;
    stopDevToolsProfile(outputPath: string): Promise<string>;
  }
}

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
  import.meta.env.VITE_PIBBL_PERF_GUARD === '1' ||
  import.meta.env.VITE_PIBBL_REPORT_PERF === '1';
const DEVTOOLS_PROFILE_KIND = import.meta.env.VITE_PIBBL_DEVTOOLS_PROFILE as
  'allocations' | 'cpu' | undefined;
const DEVTOOLS_PROFILE_OUTPUT = import.meta.env.VITE_PIBBL_DEVTOOLS_PROFILE_OUTPUT;
const DEVTOOLS_PROFILE_TARGET = import.meta.env.VITE_PIBBL_DEVTOOLS_PROFILE_TARGET ?? 'lab';
const activeControllers = new Set<ScenarioController<PerformanceLabState>>();
const activeDiagnostics = new Set<RuntimeDiagnostics>();
const activeFrameDiagnostics = new Set<FrameCallbackDiagnostics>();
const activeRuntimeControllers = new Set<PibblController>();

const EmptyPerformanceScene = (_props: {}) => undefined;

const DirectSparseProfileScene = ({ revision }: { revision: number }) => {
  const nodes = new Array(1_000);
  for (let index = 0; index < nodes.length; index++) {
    const target = `region-${index}`;
    nodes[index] = createElement(Rectangle, {
      key: target,
      style: {
        left: 20 + (index % 100) * 4,
        top: 20 + Math.floor(index / 100) * 2,
        width: 3,
        height: 2,
        fill: index === 0 ? '#16a34a' : '#2563eb',
      },
      onMouseMove: () => revision,
    });
  }
  return nodes;
};

const StructuralEventScene = ({ count, recordAncestor, recordTarget }: {
  count: number;
  recordAncestor: () => void;
  recordTarget: (index: number) => void;
}) => {
  useEventListener({ onPointerDownCapture: recordAncestor });
  return Array.from({ length: count }, (_, index) => createElement(Rectangle, {
    key: `structural-target-${index}`,
    style: {
      left: 0,
      top: 0,
      width: 20,
      height: 20,
      fill: '#2563eb',
    },
    onPointerDown: () => recordTarget(index),
  }));
};

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
        setTransform: 1,
      };
    case 'clipped':
      return {
        ...EMPTY_COUNTERS,
        getContext: regions,
        pathTests: regions * 2,
        restore: regions * 2,
        save: regions * 2,
        setTransform: regions * 2,
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
        // The four Layer paint bridges are candidates in the root ledger;
        // each contributes one resolved nested hit alongside its child paths.
        getContext: regions + 4,
        pathTests: regions + 4,
        restore: regions + 4,
        save: regions + 4,
        setTransform: regions + 4,
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
        setTransform: regions,
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

function ownedInstances(canvas: HTMLCanvasElement): PibblInstance[] {
  const ownedCanvases = new Set<Canvas>([canvas]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const [candidateCanvas, instance] of GLOBAL_STATE.pibblInstances) {
      if (instance.parent && ownedCanvases.has(instance.parent) && !ownedCanvases.has(candidateCanvas)) {
        ownedCanvases.add(candidateCanvas);
        changed = true;
      }
    }
  }
  return Array.from(ownedCanvases)
    .map(candidate => GLOBAL_STATE.pibblInstances.get(candidate))
    .filter((instance): instance is PibblInstance => Boolean(instance));
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

async function mountLab(options: {
  diagnostics?: boolean;
  onStateChange?: (state: Readonly<PerformanceLabState>) => void;
} = {}) {
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
  const controller = await definition.mount({
    canvas,
    onStateChange: options.onStateChange,
  });
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
  if (import.meta.env.VITE_PIBBL_PERF_COUNTER_DRILL !== '1') {
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
  for (const controller of activeRuntimeControllers) {
    controller.dispose();
  }
  activeRuntimeControllers.clear();
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
  it('keeps an empty root free of native UI listeners and logical targets', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    canvas.style.cssText = 'display:block; width:100px; height:100px';
    document.body.replaceChildren(canvas);
    const diagnostics = new RuntimeDiagnostics(canvas);
    activeDiagnostics.add(diagnostics);
    const mounted = pibbl(canvas, createElement(EmptyPerformanceScene, {}));
    activeRuntimeControllers.add(mounted);
    await settleFrames();

    expect(diagnostics.snapshot()).toMatchObject({
      documentListeners: 0,
      enhancers: 0,
      eventTargets: 0,
      focusCandidates: 0,
      focusManagers: 0,
      focusedTargets: 0,
      nativeListeners: 0,
      navigationBoundaries: 0,
      pendingActivations: 0,
      pointerCaptures: 0,
      propagationListeners: 0,
      scheduledFrames: 0,
    });
  });

  it('shares one native listener, stops at the topmost hit, and retains one root activation cleanup across dispatches', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    canvas.style.cssText = 'display:block; width:100px; height:100px';
    document.body.replaceChildren(canvas);
    const diagnostics = new RuntimeDiagnostics(canvas);
    activeDiagnostics.add(diagnostics);
    const targets: number[] = [];
    let ancestorCalls = 0;
    const targetCount = 100;
    const mounted = pibbl(canvas, createElement(StructuralEventScene, {
      count: targetCount,
      recordAncestor: () => { ancestorCalls++; },
      recordTarget: index => targets.push(index),
    }));
    activeRuntimeControllers.add(mounted);
    await settleFrames();

    const baseline = diagnostics.snapshot();
    expect(baseline).toMatchObject({
      documentListeners: 0,
      enhancers: 0,
      eventTargets: targetCount,
      focusCandidates: 0,
      focusManagers: 0,
      focusedTargets: 0,
      handlers: { pointerdown: targetCount + 1 },
      nativeListeners: 1,
      navigationBoundaries: 0,
      pendingActivations: 0,
      pointerCaptures: 0,
      propagationListeners: 1,
      scheduledFrames: 0,
    });

    const topmostPathTests = countPathTests(canvas, () => {
      dispatchPointerDown(canvas, 10, 10);
    });
    expect(topmostPathTests).toBe(1);
    expect(targets).toEqual([targetCount - 1]);
    expect(ancestorCalls).toBe(1);
    const afterFirstPointerPress = diagnostics.snapshot();
    expect(afterFirstPointerPress).toEqual({
      ...baseline,
      mainTeardowns: baseline.mainTeardowns + 1,
    });

    targets.length = 0;
    ancestorCalls = 0;
    const missPathTests = countPathTests(canvas, () => {
      dispatchPointerDown(canvas, 90, 90);
    });
    expect(missPathTests).toBe(targetCount);
    expect(targets).toEqual([]);
    expect(ancestorCalls).toBe(0);
    expect(diagnostics.snapshot()).toEqual(afterFirstPointerPress);
  });

  it('ignores unrelated bubbling moves and finalizes only the matching Canvas dispatch once', async () => {
    const { canvas, controller } = await mountLab();
    const workload = PERFORMANCE_WORKLOADS[1];
    await controller.perform(`show-${workload.id}`);
    const otherElement = document.createElement('button');
    otherElement.textContent = 'Unrelated Studio control';
    document.body.append(otherElement);

    const beforeUnrelatedMove = controller.getState();
    otherElement.dispatchEvent(new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 4,
      clientY: 6,
    }));
    expect.soft(controller.getState()).toEqual(beforeUnrelatedMove);

    await controller.perform(`show-${workload.id}`);
    const nestedUnrelatedMove = new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 8,
      clientY: 10,
    });
    canvas.addEventListener('mousemove', () => {
      otherElement.dispatchEvent(nestedUnrelatedMove);
    }, { once: true });
    const matchingCanvasMove = new MouseEvent('mousemove', {
      ...clientPoint(canvas, workload),
      bubbles: true,
    });
    canvas.dispatchEvent(matchingCanvasMove);

    const completedMove = controller.getState();
    expect.soft(completedMove).toMatchObject({
      callbacks: 1,
      counters: expectedCounters(workload),
      dispatches: 1,
      lastTarget: workload.expectedTarget,
      sampleCount: 1,
    });

    otherElement.dispatchEvent(matchingCanvasMove);
    expect.soft(controller.getState()).toEqual(completedMove);

    await controller.dispose();
    activeControllers.delete(controller);
    const disposedState = controller.getState();
    otherElement.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
    expect(controller.getState()).toEqual(disposedState);
  });

  it('finalizes nested same-Canvas moves with separate targets and counters', async () => {
    const publishedMoves: PerformanceLabState[] = [];
    const { canvas, controller } = await mountLab({
      onStateChange: state => {
        if (state.dispatches > 0) {
          publishedMoves.push({ ...state, counters: { ...state.counters } });
        }
      },
    });
    const workload = PERFORMANCE_WORKLOADS[1];
    await controller.perform(`show-${workload.id}`);
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('The reentrant performance Canvas has no 2D context.');
    }
    const measuredIsPointInPath = context.isPointInPath;
    const outerMove = new MouseEvent('mousemove', {
      ...clientPoint(canvas, workload),
      bubbles: true,
    });
    const nestedMiss = new MouseEvent('mousemove', {
      ...clientPoint(canvas, PERFORMANCE_WORKLOADS[4]),
      bubbles: true,
    });
    let nested = false;
    context.isPointInPath = ((
      ...args: Parameters<CanvasRenderingContext2D['isPointInPath']>
    ) => {
      if (!nested) {
        nested = true;
        canvas.dispatchEvent(nestedMiss);
      }
      return measuredIsPointInPath.apply(context, args);
    }) as CanvasRenderingContext2D['isPointInPath'];
    try {
      canvas.dispatchEvent(outerMove);
    } finally {
      context.isPointInPath = measuredIsPointInPath;
    }

    expect(publishedMoves).toHaveLength(2);
    expect(publishedMoves[0]).toMatchObject({
      callbacks: 0,
      counters: expectedCounters(workload),
      dispatches: 1,
      lastTarget: null,
      sampleCount: 1,
    });
    expect(publishedMoves[1]).toMatchObject({
      callbacks: 1,
      counters: expectedCounters(workload),
      dispatches: 2,
      lastTarget: workload.expectedTarget,
      sampleCount: 2,
    });
    expect(publishedMoves.every(move =>
      Number.isFinite(move.lastDurationMs) && move.lastDurationMs >= 0,
    )).toBe(true);

    const completedState = controller.getState();
    const otherElement = document.createElement('button');
    document.body.append(otherElement);
    otherElement.dispatchEvent(nestedMiss);
    otherElement.dispatchEvent(outerMove);
    expect(controller.getState()).toEqual(completedState);

    const blockedMove = new MouseEvent('mousemove', {
      ...clientPoint(canvas, workload),
      bubbles: true,
    });
    canvas.addEventListener('mousemove', event => {
      event.stopPropagation();
    }, { once: true });
    canvas.dispatchEvent(blockedMove);
    const pendingState = controller.getState();
    expect(pendingState).toMatchObject({
      callbacks: 2,
      dispatches: 2,
      sampleCount: 2,
    });

    const disposal = controller.dispose();
    activeControllers.delete(controller);
    otherElement.dispatchEvent(blockedMove);
    expect(controller.getState()).toEqual(pendingState);
    await disposal;
  });

  it('counts nested measurement boundaries and snapshots independently of reset', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 100;
    document.body.replaceChildren(canvas);
    resetLayoutDiagnostics();
    const mounted = pibbl(canvas, createElement(Flow, {
      style: { width: 200, height: 100 },
      children: [createElement(Flow, {
        children: [createElement(Text, {
          style: {
            font: '12px sans-serif',
            fill: '#000000',
          },
        }, 'nested measurement')],
      })],
    }));
    activeRuntimeControllers.add(mounted);
    await settleFrames();

    const completed = snapshotLayoutDiagnostics();
    expect(completed).toEqual({
      layoutEvaluations: 2,
      measurements: 3,
      placements: 2,
    });
    resetLayoutDiagnostics();
    expect(snapshotLayoutDiagnostics()).toEqual({
      layoutEvaluations: 0,
      measurements: 0,
      placements: 0,
    });
    expect(completed).toEqual({
      layoutEvaluations: 2,
      measurements: 3,
      placements: 2,
    });
    mounted.dispose();
    activeRuntimeControllers.delete(mounted);
  });

  it('keeps a 100,000-record application window bounded to visible rows plus overscan', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 400;
    document.body.replaceChildren(canvas);
    const records = Array.from({ length: 100_000 }, (_, id) => id);
    const firstVisible = 50_000;
    const visibleCount = 20;
    const overscan = 2;
    const windowRecords = records.slice(
      firstVisible - overscan,
      firstVisible + visibleCount + overscan,
    );
    let target: number | undefined;

    resetLayoutDiagnostics();
    const mounted = pibbl(canvas, createElement(Absolute, {
      style: { width: 320, height: 400, overflow: 'clip' },
      children: windowRecords.map(id => createElement(Rectangle, {
        key: `row-${id}`,
        style: {
          left: 0,
          top: (id - firstVisible) * 20,
          width: 160,
          height: 20,
          fill: '#16a34a',
        },
        onMouseMove: () => { target = id; },
      })),
    }));
    activeRuntimeControllers.add(mounted);
    await settleFrames();

    expect(records).toHaveLength(100_000);
    expect(windowRecords).toHaveLength(visibleCount + overscan * 2);
    expect(summarizeInstances(canvas)).toEqual({
      componentRefs: 49,
      instances: 1,
      paintEntries: 24,
      regions: 24,
    });
    expect(snapshotLayoutDiagnostics()).toEqual({
      layoutEvaluations: 1,
      measurements: 0,
      placements: 24,
    });
    expect(pixelAtPoint(canvas, 10, 0)).toEqual([22, 163, 74, 255]);
    expect(pixelAtPoint(canvas, 10, 399)).toEqual([22, 163, 74, 255]);

    dispatchIntrinsicMove(canvas, 10, 10);
    expect(target).toBe(firstVisible);
    dispatchIntrinsicMove(canvas, 10, 390);
    expect(target).toBe(firstVisible + visibleCount - 1);
    target = undefined;
    dispatchIntrinsicMove(canvas, 10, -10);
    dispatchIntrinsicMove(canvas, 10, 410);
    expect(target).toBeUndefined();
    mounted.dispose();
    activeRuntimeControllers.delete(mounted);
  });

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
    expect(snapshotRealmScheduler()).toMatchObject({
      pendingHostFrames: 0,
      registeredRoots: 1,
      dirtyRoots: 0,
    });

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
    expect(snapshotRealmScheduler()).toMatchObject({
      pendingHostFrames: 0,
      registeredRoots: 1,
      dirtyRoots: 0,
    });

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

    if (import.meta.env.VITE_PIBBL_PERF_GUARD === '1') {
      expect(renderMedianMs, 'sparse-1000 rerender median').toBeLessThanOrEqual(
        RERENDER_BUDGET.medianMs,
      );
      expect(renderP95Ms, 'sparse-1000 rerender p95').toBeLessThanOrEqual(
        RERENDER_BUDGET.p95Ms,
      );
    }

    if (import.meta.env.VITE_PIBBL_REPORT_PERF === '1') {
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

  it.skipIf(!DEVTOOLS_PROFILE_KIND || DEVTOOLS_PROFILE_TARGET !== 'lab')('profiles sparse-1000 rerenders through Chrome DevTools', async () => {
    if (!DEVTOOLS_PROFILE_OUTPUT) {
      throw new Error('VITE_PIBBL_DEVTOOLS_PROFILE_OUTPUT is required when profiling.');
    }
    const { canvas, controller } = await mountLab();
    await controller.perform('show-sparse-1000');
    await controller.perform('rerender-25');

    await commands.startDevToolsProfile(DEVTOOLS_PROFILE_KIND!);
    try {
      for (let batch = 0; batch < 8; batch++) {
        await controller.perform('rerender-25');
      }
    } finally {
      await commands.stopDevToolsProfile(DEVTOOLS_PROFILE_OUTPUT);
    }

    expect(controller.getState()).toMatchObject({
      completedRenders: 226,
      renderedRevision: 226,
      revision: 226,
    });
    expect(summarizeInstances(canvas)).toMatchObject({
      paintEntries: 1_000,
      regions: 1_000,
    });
  }, 120_000);

  it.skipIf(!DEVTOOLS_PROFILE_KIND || DEVTOOLS_PROFILE_TARGET !== 'runtime')('profiles uninstrumented sparse-1000 rerenders through Chrome DevTools', async () => {
    if (!DEVTOOLS_PROFILE_OUTPUT) {
      throw new Error('VITE_PIBBL_DEVTOOLS_PROFILE_OUTPUT is required when profiling.');
    }
    const canvas = document.createElement('canvas');
    canvas.width = 480;
    canvas.height = 240;
    document.body.replaceChildren(canvas);
    let revision = 0;
    const controller = pibbl(canvas, createElement(DirectSparseProfileScene, { revision }));
    activeRuntimeControllers.add(controller);
    const rerender = async () => {
      revision++;
      pibbl(canvas, createElement(DirectSparseProfileScene, { revision }));
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    };
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    for (let index = 0; index < 25; index++) await rerender();

    await commands.startDevToolsProfile(DEVTOOLS_PROFILE_KIND!);
    try {
      for (let index = 0; index < 200; index++) await rerender();
    } finally {
      await commands.stopDevToolsProfile(DEVTOOLS_PROFILE_OUTPUT);
    }

    expect(summarizeInstances(canvas)).toMatchObject({
      componentRefs: 1_001,
      paintEntries: 1_000,
      regions: 1_000,
    });
  }, 120_000);

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

    if (import.meta.env.VITE_PIBBL_PERF_GUARD === '1') {
      expect(window.devicePixelRatio).toBe(1);
      expect(navigator.userAgent).toContain('Chrome');
      for (const observation of observations) {
        const budget = PERFORMANCE_BUDGETS[observation.workloadId];
        expect(observation.medianMs, `${observation.workloadId} median`).toBeLessThanOrEqual(budget.medianMs);
        expect(observation.p95Ms, `${observation.workloadId} p95`).toBeLessThanOrEqual(budget.p95Ms);
      }
    }

    if (import.meta.env.VITE_PIBBL_REPORT_PERF === '1') {
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

function settleFrames(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() =>
    requestAnimationFrame(() => resolve()),
  ));
}

function dispatchIntrinsicMove(
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
): void {
  const bounds = canvas.getBoundingClientRect();
  canvas.dispatchEvent(new MouseEvent('mousemove', {
    bubbles: true,
    clientX: bounds.left + x * bounds.width / canvas.width,
    clientY: bounds.top + y * bounds.height / canvas.height,
  }));
}

function pixelAtPoint(
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
): readonly number[] {
  return Array.from(canvas.getContext('2d')!.getImageData(x, y, 1, 1).data);
}

function dispatchPointerDown(
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
): void {
  const bounds = canvas.getBoundingClientRect();
  canvas.dispatchEvent(new PointerEvent('pointerdown', {
    bubbles: true,
    cancelable: true,
    clientX: bounds.left + x,
    clientY: bounds.top + y,
    pointerId: 1,
    pointerType: 'mouse',
  }));
}

function countPathTests(
  canvas: HTMLCanvasElement,
  dispatch: () => void,
): number {
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('The structural event Canvas has no 2D context.');
  }
  const original = context.isPointInPath;
  let pathTests = 0;
  context.isPointInPath = ((
    ...args: Parameters<CanvasRenderingContext2D['isPointInPath']>
  ) => {
    pathTests++;
    return original.apply(context, args);
  }) as CanvasRenderingContext2D['isPointInPath'];
  try {
    dispatch();
  } finally {
    context.isPointInPath = original;
  }
  return pathTests;
}
