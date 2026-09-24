import {
  Layer,
  Rectangle,
  Text,
  computed,
  crc,
  createElement,
  signal,
  useSignal,
  useState,
  type CRCController,
  type CRCNode,
} from '@crc/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSharedState } from '../src/lib/global-state';
import {
  registerAdvanceParticipant,
} from '../src/lib/scheduler/realm-scheduler';
import {
  installSchedulerDriverForTest,
  ManualSchedulerDriver,
} from '../src/lib/scheduler/testing';
import * as signalGraph from '../src/lib/signals/graph';
import type { CRCAdvanceParticipant } from '../src/lib/scheduler/types';

interface SignalGraphPerformanceSnapshot {
  readonly rendererEdges: number;
  readonly createdRendererEdges: number;
  readonly signalCommitNotifications: number;
  readonly planComputedValidations: number;
  readonly lazyRendererConsumers: number;
  readonly reusedRendererEdges: number;
  readonly plainInputResolutions: number;
  readonly signalInputResolutions: number;
  readonly shallowInputCopies: number;
  readonly receiverInputProvisions: number;
  readonly adoptedReceiverInputProvisions: number;
  readonly rolledBackReceiverInputProvisions: number;
  readonly batchedObserverInvalidations: number;
}

interface AuthoringBaselineObservation {
  readonly workload: string;
  readonly medianMs: number;
  readonly p95Ms: number;
  readonly traversalsPerUpdate: number;
}

const REPORT_TIMING = import.meta.env.VITE_CRC_REPORT_PERF === '1';
const activeControllers = new Set<CRCController>();
let driver: ManualSchedulerDriver;
let restoreDriver: () => void;

beforeEach(() => {
  document.body.replaceChildren();
  driver = new ManualSchedulerDriver();
  restoreDriver = installSchedulerDriverForTest(driver);
});

afterEach(() => {
  for (const controller of activeControllers) controller.dispose();
  activeControllers.clear();
  clearSharedState();
  restoreDriver();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe('signal and scheduler structural performance', () => {
  it('exposes zero-value counters for Signals-centric hot-path work', () => {
    expect(snapshotSignalGraph()).toMatchObject({
      lazyRendererConsumers: 0,
      reusedRendererEdges: 0,
      plainInputResolutions: 0,
      signalInputResolutions: 0,
      shallowInputCopies: 0,
      receiverInputProvisions: 0,
      adoptedReceiverInputProvisions: 0,
      rolledBackReceiverInputProvisions: 0,
      batchedObserverInvalidations: 0,
    });
  });

  it('coalesces 1,000 writes into one host request and one root traversal', () => {
    const value = signal(0);
    let traversals = 0;
    const Root = (_props: {}) => {
      traversals += 1;
      value.get();
    };
    const controller = track(crc(createCanvas(), createElement(Root, {})));
    driver.flush(1);
    traversals = 0;
    const requestsBefore = driver.requestCount;

    const started = performance.now();
    for (let next = 1; next <= 1_000; next += 1) value.set(next);
    const writesMs = performance.now() - started;

    expect(driver.requestCount - requestsBefore).toBe(1);
    expect(driver.pendingHostFrames).toBe(1);
    driver.flush(2);
    expect(traversals).toBe(1);
    expect(driver.pendingHostFrames).toBe(0);
    reportTiming('1,000 coalesced writes', writesMs);
    controller.dispose();
  });

  it('notifies one signal commit and traverses 100 roots in stable mount order', () => {
    const value = signal(0);
    const expectedOrder = Array.from({ length: 100 }, (_, index) => index);
    const traversalOrder: number[] = [];
    const Root = ({ index }: { index: number }) => {
      value.get();
      traversalOrder.push(index);
    };

    for (const index of expectedOrder) {
      track(crc(createCanvas(), createElement(Root, { index })));
    }
    expect(driver.requestCount).toBe(1);
    driver.flush(1);
    expect(traversalOrder).toEqual(expectedOrder);

    traversalOrder.length = 0;
    const graphBefore = snapshotSignalGraph();
    const requestsBefore = driver.requestCount;
    value.set(1);

    expect(driver.requestCount - requestsBefore).toBe(1);
    expect(driver.pendingHostFrames).toBe(1);
    expect(
      snapshotSignalGraph().signalCommitNotifications -
        graphBefore.signalCommitNotifications,
    ).toBe(1);
    driver.flush(2);
    expect(traversalOrder).toEqual(expectedOrder);
    expect(driver.pendingHostFrames).toBe(0);
  });

  it('validates one unchanged computed during Plan without traversing a root', () => {
    const source = signal(1);
    const parity = computed(() => source.get() % 2);
    let traversals = 0;
    const Root = (_props: {}) => {
      traversals += 1;
      parity.get();
    };
    const controller = track(crc(createCanvas(), createElement(Root, {})));
    driver.flush(1);
    traversals = 0;

    const graphBefore = snapshotSignalGraph();
    const requestsBefore = driver.requestCount;
    let releaseAdvance = () => {};
    const advance: CRCAdvanceParticipant = (_frame, batch) => {
      batch.stage(source, 3, advance);
      releaseAdvance();
    };
    releaseAdvance = registerAdvanceParticipant(advance);

    expect(driver.requestCount - requestsBefore).toBe(1);
    driver.flush(2);
    const graphAfter = snapshotSignalGraph();
    expect(
      graphAfter.signalCommitNotifications -
        graphBefore.signalCommitNotifications,
    ).toBe(1);
    expect(
      graphAfter.planComputedValidations -
        graphBefore.planComputedValidations,
    ).toBe(1);
    expect(traversals).toBe(0);
    expect(driver.pendingHostFrames).toBe(0);
    controller.dispose();
  });

  it('repaints only the signal-owning child across 100 stable Layer bitmaps', () => {
    const NativeOffscreenCanvas = globalThis.OffscreenCanvas;
    const offscreenConstructions = vi.fn(function (
      width: number,
      height: number,
    ) {
      return new NativeOffscreenCanvas(width, height);
    });
    vi.stubGlobal('OffscreenCanvas', offscreenConstructions);
    const drawImage = vi.spyOn(CanvasRenderingContext2D.prototype, 'drawImage');
    const pulse = signal(0);
    const childTraversals = Array.from({ length: 100 }, () => 0);
    let rootTraversals = 0;
    const LayerChild = ({ index }: { index: number }) => {
      childTraversals[index] += 1;
      if (index === 0) pulse.get();
    };
    const layers: readonly CRCNode[] = childTraversals.map((_count, index) =>
      createElement(Layer, {
        key: `stable-layer-${index}`,
        style: { width: 4, height: 4 },
        children: createElement(LayerChild, { index }),
      })
    );
    const Root = (_props: {}) => {
      rootTraversals += 1;
      return layers;
    };
    const controller = track(crc(createCanvas(40, 40), createElement(Root, {})));
    driver.flush(1);

    expect(rootTraversals).toBe(1);
    expect(childTraversals).toEqual(Array.from({ length: 100 }, () => 1));
    expect(offscreenConstructions).toHaveBeenCalledTimes(100);
    const initialBitmaps = layerBitmapSources(
      drawImage.mock.calls,
      NativeOffscreenCanvas,
    );
    expect(initialBitmaps).toHaveLength(100);

    rootTraversals = 0;
    childTraversals.fill(0);
    offscreenConstructions.mockClear();
    drawImage.mockClear();
    const requestsBefore = driver.requestCount;
    const started = performance.now();
    pulse.set(1);
    driver.flush(2);
    const repaintMs = performance.now() - started;

    expect(driver.requestCount - requestsBefore).toBe(1);
    expect(rootTraversals).toBe(1);
    expect(childTraversals).toEqual([
      1,
      ...Array.from({ length: 99 }, () => 0),
    ]);
    expect(offscreenConstructions).not.toHaveBeenCalled();
    expect(
      layerBitmapSources(drawImage.mock.calls, NativeOffscreenCanvas),
    ).toEqual(initialBitmaps);
    expect(driver.pendingHostFrames).toBe(0);
    reportTiming('one dirty child across 100 Layer bitmaps', repaintMs);
    controller.dispose();
  });

  it('records matched state, explicit signal read, and plain-input baselines', () => {
    const observations = [
      observeStateSlotWorkload('state', 1_000),
      observeStateSlotWorkload('signal-get', 1_000),
      observePrimitiveInputWorkload('plain', 1_000),
      observePrimitiveInputWorkload('explicit-get', 1_000),
    ];

    expect(observations.map(observation => observation.workload)).toEqual([
      'state-1000-slots',
      'signal-get-1000-slots',
      'plain-inputs-1000-rectangles',
      'explicit-get-inputs-1000-rectangles',
    ]);
    expect(
      observations.every(
        observation =>
          Number.isFinite(observation.medianMs) &&
          Number.isFinite(observation.p95Ms) &&
          observation.medianMs <= observation.p95Ms,
      ),
    ).toBe(true);
    expect(
      observations.map(observation => observation.traversalsPerUpdate),
    ).toEqual([1_001, 1_001, 2, 2]);
    reportObservation('Signals-centric pre-change baselines', observations);
  });

  it.each([1, 10, 100, 1_000])(
    'records one current render edge per explicit-get fan-out receiver (%i)',
    fanout => {
      const shared = signal(0);
      const Reader = (_props: { index: number }) => {
        shared.get();
      };
      const before = snapshotSignalGraph();
      const controller = track(
        crc(
          createCanvas(),
          Array.from({ length: fanout }, (_, index) =>
            createElement(Reader, { key: `reader-${index}`, index }),
          ),
        ),
      );
      driver.flush(1);
      const mounted = snapshotSignalGraph();

      expect(mounted.rendererEdges - before.rendererEdges).toBe(fanout);
      const requestsBefore = driver.requestCount;
      shared.set(1);
      expect(driver.requestCount - requestsBefore).toBe(1);
      driver.flush(2);
      const updated = snapshotSignalGraph();
      expect(updated.createdRendererEdges).toBe(
        mounted.createdRendererEdges,
      );
      expect(updated.reusedRendererEdges - mounted.reusedRendererEdges).toBe(
        fanout,
      );
      controller.dispose();
      expect(snapshotSignalGraph().rendererEdges).toBe(before.rendererEdges);
    },
  );
});

function observeStateSlotWorkload(
  kind: 'state' | 'signal-get',
  count: number,
): AuthoringBaselineObservation {
  let traversals = 0;
  let updateValue: (value: number) => void = () => {};
  const Cell = ({ index }: { index: number }) => {
    traversals++;
    if (kind === 'state') {
      const [value, setValue] = useState(0);
      if (index === 0) updateValue = setValue;
      void value;
    } else {
      const value = useSignal(0);
      if (index === 0) updateValue = next => value.set(next);
      value.get();
    }
  };
  const Root = (_props: {}) => {
    traversals++;
    return Array.from({ length: count }, (_, index) =>
      createElement(Cell, { key: `slot-${index}`, index }),
    );
  };
  const controller = track(crc(createCanvas(), createElement(Root, {})));
  driver.flush(1);
  const samples = sampleManualUpdates(updateValue, () => {
    traversals = 0;
  });
  const traversalsPerUpdate = traversals / samples.length;
  controller.dispose();
  return summarize(`${kind}-${count}-slots`, samples, traversalsPerUpdate);
}

function observePrimitiveInputWorkload(
  kind: 'plain' | 'explicit-get',
  count: number,
): AuthoringBaselineObservation {
  const position = signal(0);
  const label = signal('Current');
  const data = signal<readonly number[]>([1, 2, 3]);
  let traversals = 0;
  let updateValue: (value: number) => void = () => {};
  const DataSink = (_props: { data: readonly number[] }) => {
    traversals++;
  };
  const Root = (_props: {}) => {
    traversals++;
    const rerender = useSignal(0);
    const tick = rerender.get();
    updateValue = next => rerender.set(next);
    const x = kind === 'explicit-get' ? position.get() : 0;
    const text = kind === 'explicit-get' ? label.get() : 'Current';
    const rows = kind === 'explicit-get' ? data.get() : [1, 2, 3];
    return [
      ...Array.from({ length: count }, (_, index) =>
        createElement(Rectangle, {
          key: `rectangle-${index}`,
          style: { x: x + index, y: tick, width: 1, height: 1 },
        }),
      ),
      createElement(Text, { key: 'label', children: text }),
      createElement(DataSink, { key: 'data', data: rows }),
    ];
  };
  const controller = track(crc(createCanvas(), createElement(Root, {})));
  driver.flush(1);
  const samples = sampleManualUpdates(updateValue, () => {
    traversals = 0;
  });
  const traversalsPerUpdate = traversals / samples.length;
  controller.dispose();
  return summarize(
    `${kind}-inputs-${count}-rectangles`,
    samples,
    traversalsPerUpdate,
  );
}

function sampleManualUpdates(
  updateValue: (value: number) => void,
  beforeMeasure: () => void,
): number[] {
  let next = 1;
  for (; next <= 5; next++) {
    updateValue(next);
    driver.flush(next + 10);
  }
  beforeMeasure();
  const samples: number[] = [];
  for (; next <= 46; next++) {
    const started = performance.now();
    updateValue(next);
    driver.flush(next + 10);
    samples.push(performance.now() - started);
  }
  return samples;
}

function summarize(
  workload: string,
  samples: readonly number[],
  traversalsPerUpdate: number,
): AuthoringBaselineObservation {
  const sorted = [...samples].sort((left, right) => left - right);
  return {
    workload,
    medianMs: sorted[Math.ceil(sorted.length * 0.5) - 1],
    p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1],
    traversalsPerUpdate,
  };
}

function snapshotSignalGraph(): SignalGraphPerformanceSnapshot {
  const snapshot = (
    signalGraph as typeof signalGraph & {
      signalGraphSnapshot?: () => SignalGraphPerformanceSnapshot;
    }
  ).signalGraphSnapshot;
  expect(
    snapshot,
    'The signal graph must expose explicit structural counters for tests.',
  ).toBeTypeOf('function');
  return snapshot!();
}

function layerBitmapSources(
  calls: ReadonlyArray<readonly unknown[]>,
  NativeOffscreenCanvas: typeof OffscreenCanvas,
): OffscreenCanvas[] {
  return calls.flatMap(([source]) =>
    source instanceof NativeOffscreenCanvas ? [source] : []
  );
}

function reportTiming(label: string, elapsedMs: number): void {
  if (REPORT_TIMING) {
    console.warn(`[crc structural diagnostic] ${label}: ${elapsedMs.toFixed(3)}ms`);
  }
}

function reportObservation(label: string, observation: unknown): void {
  if (REPORT_TIMING) {
    console.warn(
      `[crc structural diagnostic] ${label}: ${JSON.stringify(observation)}`,
    );
  }
}

function track(controller: CRCController): CRCController {
  activeControllers.add(controller);
  return controller;
}

function createCanvas(width = 8, height = 8): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.style.cssText = `display:block;width:${width}px;height:${height}px`;
  document.body.appendChild(canvas);
  return canvas;
}
