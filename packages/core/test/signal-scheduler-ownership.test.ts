import {
  Layer,
  computed,
  crc,
  createElement,
  signal,
  type CRCController,
  type CRCNode,
} from '@crc/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearSharedState } from '../src/lib/global-state';
import * as signalGraph from '../src/lib/signals/graph';
import {
  installSchedulerDriverForTest,
  ManualSchedulerDriver,
  snapshotRealmScheduler,
} from '../src/lib/scheduler/testing';

interface SignalGraphOwnershipSnapshot {
  readonly rendererConsumers: number;
  readonly rendererEdges: number;
  readonly computedSourceEdges: number;
  readonly pendingComputedValidations: number;
  readonly createdRendererConsumers: number;
  readonly releasedRendererConsumers: number;
  readonly lazyRendererConsumers: number;
  readonly createdComputedSourceEdges: number;
  readonly releasedComputedSourceEdges: number;
}

interface SchedulerOwnershipSnapshot {
  readonly pendingHostFrames: number;
  readonly registeredRoots: number;
  readonly advanceParticipants: number;
  readonly completionCallbacks: number;
  readonly createdRootRegistrations: number;
  readonly releasedRootRegistrations: number;
}

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
  document.body.replaceChildren();
});

describe('signal graph and realm scheduler ownership', () => {
  it('keeps a 1,000-component plain tree consumer-free and materializes only readers', () => {
    const baseline = snapshotSignalGraph();
    const value = signal(1);
    const canvas = createCanvas();
    const Leaf = ({ read }: { read: boolean }) => {
      if (read) value.get();
    };
    const Tree = ({ read }: { read: boolean }) =>
      Array.from({ length: 1_000 }, (_, index) =>
        createElement(Leaf, { key: `leaf-${index}`, read: read && index === 0 })
      );
    const controller = drive(crc(canvas, createElement(Tree, { read: false })));

    driver.flush(1);
    expect(snapshotSignalGraph()).toMatchObject({
      rendererConsumers: baseline.rendererConsumers,
      rendererEdges: baseline.rendererEdges,
      lazyRendererConsumers: baseline.lazyRendererConsumers,
    });

    crc(canvas, createElement(Tree, { read: true }));
    driver.flush(2);
    expect(snapshotSignalGraph()).toMatchObject({
      rendererConsumers: baseline.rendererConsumers + 1,
      rendererEdges: baseline.rendererEdges + 1,
      lazyRendererConsumers: baseline.lazyRendererConsumers + 1,
    });

    crc(canvas, createElement(Tree, { read: false }));
    driver.flush(3);
    expect(snapshotSignalGraph()).toMatchObject({
      rendererConsumers: baseline.rendererConsumers,
      rendererEdges: baseline.rendererEdges,
      lazyRendererConsumers: baseline.lazyRendererConsumers + 1,
    });

    const failure = new Error('lazy consumer render failed');
    const Broken = (_props: {}) => {
      value.get();
      throw failure;
    };
    crc(canvas, createElement(Broken, {}));
    expect(() => driver.flush(4)).toThrow(failure);
    expect(snapshotSignalGraph()).toMatchObject({
      rendererConsumers: baseline.rendererConsumers,
      rendererEdges: baseline.rendererEdges,
      lazyRendererConsumers: baseline.lazyRendererConsumers + 2,
    });

    controller.dispose();
    expect(snapshotSignalGraph()).toMatchObject({
      rendererConsumers: baseline.rendererConsumers,
      rendererEdges: baseline.rendererEdges,
    });
  });

  it('releases exact consumers, edges, roots, and pending work through every lifecycle boundary', () => {
    const graphBaseline = snapshotSignalGraph();
    const schedulerBaseline = schedulerOwnershipSnapshot();
    expect(graphBaseline).toMatchObject({
      rendererConsumers: 0,
      rendererEdges: 0,
      computedSourceEdges: 0,
      pendingComputedValidations: 0,
    });
    expect(schedulerBaseline).toMatchObject({
      pendingHostFrames: 0,
      registeredRoots: 0,
      advanceParticipants: 0,
      completionCallbacks: 0,
    });

    const shared = signal(0);
    const showLayer = signal(true);
    const canvas = createCanvas();
    const SharedReader = (_props: {}) => {
      shared.get();
    };
    const Scene = (_props: {}) => [
      createElement(SharedReader, { key: 'root-reader' }),
      showLayer.get() ?
        createElement(Layer, {
          key: 'layer',
          style: { width: 8, height: 8 },
          children: createElement(SharedReader, { key: 'layer-reader' }),
        }) :
        undefined,
    ];
    const scene = createElement(Scene, {});
    const firstController = drive(crc(canvas, scene));

    // Repeating crc() while the Canvas is live updates one mount rather than
    // acquiring another root registration.
    expect(crc(canvas, scene)).toBe(firstController);
    expect(driver.requestCount).toBe(1);
    driver.flush(1);
    expect(snapshotSignalGraph()).toMatchObject({
      rendererConsumers: 3,
      rendererEdges: 3,
      pendingComputedValidations: 0,
    });
    expect(schedulerOwnershipSnapshot()).toMatchObject({
      registeredRoots: 1,
      pendingHostFrames: 0,
    });

    // Two consumers share one signal. Their invalidations still coalesce onto
    // the one realm host request owned by the scheduler.
    shared.set(1);
    expect(driver.pendingHostFrames).toBe(1);
    driver.flush(2);
    expect(snapshotSignalGraph()).toMatchObject({
      rendererConsumers: 3,
      rendererEdges: 3,
    });

    // A branch change removes the nested reader. The plain Layer primitive
    // never owns a consumer.
    showLayer.set(false);
    driver.flush(3);
    expect(snapshotSignalGraph()).toMatchObject({
      rendererConsumers: 2,
      rendererEdges: 2,
    });

    showLayer.set(true);
    driver.flush(4);
    expect(snapshotSignalGraph()).toMatchObject({
      rendererConsumers: 3,
      rendererEdges: 3,
    });

    // Root replacement releases the complete prior tree before settling on
    // one new reader.
    crc(canvas, createElement(SharedReader, {}));
    driver.flush(5);
    expect(snapshotSignalGraph()).toMatchObject({
      rendererConsumers: 1,
      rendererEdges: 1,
    });

    // A failed renderer transaction must discard provisional reads and release
    // both the prior generation and the failing generation.
    const renderFailure = new Error('signal ownership render failure');
    const Broken = (_props: {}): CRCNode => {
      shared.get();
      throw renderFailure;
    };
    crc(canvas, createElement(Broken, {}));
    expect(() => driver.flush(6)).toThrow(renderFailure);
    expect(snapshotSignalGraph()).toMatchObject({
      rendererConsumers: 0,
      rendererEdges: 0,
      pendingComputedValidations: 0,
    });
    expect(schedulerOwnershipSnapshot()).toMatchObject({
      registeredRoots: 1,
      pendingHostFrames: 0,
    });

    // Explicit work recovers a fail-closed mount without resurrecting its old
    // consumer generation.
    crc(canvas, createElement(SharedReader, {}));
    driver.flush(7);
    expect(snapshotSignalGraph()).toMatchObject({
      rendererConsumers: 1,
      rendererEdges: 1,
    });

    // Losing the final observer of an invalid computed removes its queued Plan
    // validation even though the application-owned signals remain readable.
    const computedSource = signal(0);
    const retainedComputed = computed(() => computedSource.get() % 2);
    const ComputedReader = (_props: {}) => {
      retainedComputed.get();
    };
    const abortController = new AbortController();
    const abortControllerHandle = drive(crc(
      createCanvas(),
      createElement(ComputedReader, {}),
      { signal: abortController.signal },
    ));
    driver.flush(8);
    computedSource.set(2);
    expect(snapshotSignalGraph().pendingComputedValidations).toBe(1);
    abortController.abort();
    expect(snapshotSignalGraph()).toMatchObject({
      rendererConsumers: 1,
      rendererEdges: 1,
      pendingComputedValidations: 0,
    });
    expect(schedulerOwnershipSnapshot()).toMatchObject({
      registeredRoots: 1,
      pendingHostFrames: 0,
    });
    abortControllerHandle.dispose();

    firstController.dispose();
    expectReleasedState();

    // A fresh mount on the same Canvas owns a distinct registration and
    // consumer generation.
    const freshController = drive(crc(canvas, createElement(SharedReader, {})));
    driver.flush(9);
    freshController.dispose();

    // Repeated fresh mounts make acquisition/release totals deterministic
    // without relying on heap timing or garbage collection.
    for (let cycle = 0; cycle < 25; cycle += 1) {
      const controller = drive(crc(canvas, createElement(SharedReader, {})));
      driver.flush(10 + cycle);
      controller.dispose();
    }

    expectReleasedState();
    expect(shared.get()).toBe(1);
    expect(retainedComputed.get()).toBe(0);
    expect(snapshotSignalGraph()).toMatchObject({
      createdRendererConsumers: graphBaseline.createdRendererConsumers + 34,
      releasedRendererConsumers: graphBaseline.releasedRendererConsumers + 34,
      createdComputedSourceEdges:
        graphBaseline.createdComputedSourceEdges + 1,
      releasedComputedSourceEdges:
        graphBaseline.releasedComputedSourceEdges + 1,
    });
    expect(schedulerOwnershipSnapshot()).toMatchObject({
      createdRootRegistrations:
        schedulerBaseline.createdRootRegistrations + 28,
      releasedRootRegistrations:
        schedulerBaseline.releasedRootRegistrations + 28,
    });
  });

  it('releases nested computed edges after failed render cleanup and final disposal', () => {
    const baseline = snapshotSignalGraph();
    const source = signal(1);
    const inner = computed(() => source.get() + 1);
    const outer = computed(() => inner.get() + 1);
    const canvas = createCanvas();
    const failure = new Error('computed reader failed');
    const Broken = (_props: {}): CRCNode => {
      outer.get();
      throw failure;
    };
    const Healthy = (_props: {}) => {
      outer.get();
    };
    const controller = drive(crc(canvas, createElement(Broken, {})));

    expect(() => driver.flush(1)).toThrow(failure);
    expect(snapshotSignalGraph()).toMatchObject({
      rendererConsumers: baseline.rendererConsumers,
      rendererEdges: baseline.rendererEdges,
      computedSourceEdges: baseline.computedSourceEdges,
    });
    expect(getSignalNodeForTest(source).observerCount).toBe(0);
    expect(getSignalNodeForTest(inner).observerCount).toBe(0);

    crc(canvas, createElement(Healthy, {}));
    driver.flush(2);
    expect(snapshotSignalGraph().computedSourceEdges).toBe(
      baseline.computedSourceEdges + 2,
    );

    controller.dispose();
    expect(snapshotSignalGraph()).toMatchObject({
      rendererConsumers: baseline.rendererConsumers,
      rendererEdges: baseline.rendererEdges,
      computedSourceEdges: baseline.computedSourceEdges,
      createdComputedSourceEdges:
        baseline.createdComputedSourceEdges + 2,
      releasedComputedSourceEdges:
        baseline.releasedComputedSourceEdges + 2,
    });
    expect(getSignalNodeForTest(source).observerCount).toBe(0);
    expect(getSignalNodeForTest(inner).observerCount).toBe(0);

    source.set(2);
    expect(outer.get()).toBe(4);
    expect(snapshotSignalGraph().computedSourceEdges).toBe(
      baseline.computedSourceEdges,
    );
  });
});

function snapshotSignalGraph(): SignalGraphOwnershipSnapshot {
  const snapshot = (
    signalGraph as typeof signalGraph & {
      signalGraphSnapshot?: () => SignalGraphOwnershipSnapshot;
    }
  ).signalGraphSnapshot;
  expect(
    snapshot,
    'The signal graph must expose an explicit test-only ownership snapshot.',
  ).toBeTypeOf('function');
  return snapshot!();
}

function schedulerOwnershipSnapshot(): SchedulerOwnershipSnapshot {
  return snapshotRealmScheduler() as unknown as SchedulerOwnershipSnapshot;
}

function expectReleasedState(): void {
  expect(snapshotSignalGraph()).toMatchObject({
    rendererConsumers: 0,
    rendererEdges: 0,
    computedSourceEdges: 0,
    pendingComputedValidations: 0,
  });
  expect(schedulerOwnershipSnapshot()).toMatchObject({
    pendingHostFrames: 0,
    registeredRoots: 0,
    advanceParticipants: 0,
    completionCallbacks: 0,
  });
}

function getSignalNodeForTest<T>(value: import('@crc/core').Signal<T>) {
  const getNode = (
    signalGraph as typeof signalGraph & {
      getSignalNode?: (signal: import('@crc/core').Signal<T>) => {
        observers: Set<unknown>;
      };
    }
  ).getSignalNode;
  expect(getNode).toBeTypeOf('function');
  return getNode!(value);
}

function drive(controller: CRCController): CRCController {
  activeControllers.add(controller);
  return controller;
}

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 8;
  canvas.height = 8;
  canvas.style.cssText = 'display:block;width:8px;height:8px';
  document.body.appendChild(canvas);
  return canvas;
}
