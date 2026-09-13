import {
  Layer,
  computed,
  crc,
  createElement,
  signal,
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
  readonly signalCommitNotifications: number;
  readonly planComputedValidations: number;
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
});

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
