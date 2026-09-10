import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { crc } from '../crc';
import { Layer } from '../components/layer';
import { Rectangle } from '../components/rect';
import { createElement, isCRCElement } from '../element/create-element';
import { executeRender } from '../execute-render';
import {
  clearSharedState,
  getCRCInstance,
  getCurrentCRCInstance,
  GLOBAL_STATE,
} from '../global-state';
import { mountCRC } from '../mount-crc';
import { crcRef } from '../hooks/crc-ref';
import { crcState, type StateUpdater } from '../hooks/crc-state';
import {
  collectSignalReads,
  createSignalRenderConsumer,
  disposeSignalRenderConsumer,
} from '../signals/render-consumer';
import {
  computed,
  getSignalNode,
  signal,
  signalGraphSnapshot,
} from '../signals/graph';
import { update } from '../update';
import {
  getCurrentFrameSnapshot,
  queueFrameCompletion,
  registerAdvanceParticipant,
} from './realm-scheduler';
import type { CRCAdvanceParticipant } from './types';
import {
  installSchedulerDriverForTest,
  ManualSchedulerDriver,
  snapshotRealmScheduler,
} from './testing';

let driver: ManualSchedulerDriver;
let restoreDriver: () => void;

beforeEach(() => {
  document.body.innerHTML = '';
  driver = new ManualSchedulerDriver();
  restoreDriver = installSchedulerDriverForTest(driver);
});

afterEach(() => {
  clearSharedState();
  restoreDriver();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('realm scheduler', () => {
  it('coalesces dirty roots into one host frame and renders in mount order', () => {
    const renders: string[] = [];
    const frames = new Map<string, ReturnType<typeof getCurrentFrameSnapshot>>();
    const Root = ({ label }: { label: string }) => {
      renders.push(label);
      frames.set(label, getCurrentFrameSnapshot());
    };
    const firstCanvas = createCanvas();
    const secondCanvas = createCanvas();

    const first = crc(firstCanvas, createElement(Root, { label: 'first:1' }));
    const second = crc(secondCanvas, createElement(Root, { label: 'second:1' }));
    crc(secondCanvas, createElement(Root, { label: 'second:2' }));
    crc(firstCanvas, createElement(Root, { label: 'first:2' }));

    expect(driver.requestCount).toBe(1);
    expect(driver.pendingHostFrames).toBe(1);
    driver.flush(125);

    expect(renders).toEqual(['first:2', 'second:2']);
    expect(frames.get('first:2')).toBe(frames.get('second:2'));
    expect(frames.get('first:2')).toMatchObject({
      hostTime: 125,
      logicalTime: 125,
    });
    expect(Object.isFrozen(frames.get('first:2'))).toBe(true);
    expect(driver.pendingHostFrames).toBe(0);
    expect(snapshotRealmScheduler()).toMatchObject({
      pendingHostFrames: 0,
      registeredRoots: 2,
      dirtyRoots: 0,
    });
    first.dispose();
    second.dispose();
  });

  it('drops a dirty root disposed before Begin while preserving later root work', () => {
    const renders: string[] = [];
    const Root = ({ label }: { label: string }) => {
      renders.push(label);
    };
    const first = crc(createCanvas(), createElement(Root, { label: 'first' }));
    const second = crc(createCanvas(), createElement(Root, { label: 'second' }));

    first.dispose();
    expect(driver.cancelCount).toBe(0);
    driver.flush(10);

    expect(renders).toEqual(['second']);
    expect(snapshotRealmScheduler()).toMatchObject({
      registeredRoots: 1,
      dirtyRoots: 0,
      pendingHostFrames: 0,
    });
    second.dispose();
  });

  it('continues rendering later roots and reports a root failure after Complete', () => {
    const boom = new Error('first root failed');
    const renders: string[] = [];
    const Failing = (_props: {}) => {
      renders.push('first');
      throw boom;
    };
    const Healthy = (_props: {}) => {
      renders.push('second');
    };
    const firstCanvas = createCanvas();
    const first = crc(firstCanvas, createElement(Failing, {}));
    const second = crc(createCanvas(), createElement(Healthy, {}));

    expect(() => driver.flush(10)).toThrow(boom);

    expect(renders).toEqual(['first', 'second']);
    expect(driver.pendingHostFrames).toBe(0);

    crc(firstCanvas, createElement(Healthy, {}));
    driver.flush(20);
    expect(renders).toEqual(['first', 'second', 'second']);
    first.dispose();
    second.dispose();
  });

  it('requeues a failed nested job and an unattempted latest root for deterministic retry', () => {
    const nestedFailure = new Error('nested render failed');
    const calls: string[] = [];
    const canvas = createCanvas();
    const drawImage = vi.spyOn(CanvasRenderingContext2D.prototype, 'drawImage');
    const Initial = (_props: {}) => {
      calls.push('parent:initial');
      return createElement(Layer, {
        style: { width: 20, height: 20 },
        children: createElement(Rectangle, {
          style: { width: 20, height: 20, fill: 'red' },
        }),
      });
    };
    const FailingChild = (_props: {}) => {
      calls.push('child:failing');
      throw nestedFailure;
    };
    const HealthyChild = (_props: {}) => {
      calls.push('child:healthy');
      return createElement(Rectangle, {
        style: { width: 20, height: 20, fill: 'blue' },
      });
    };
    const Replacement = (_props: {}) => {
      calls.push('parent:replacement');
      return createElement(Rectangle, {
        style: { width: 20, height: 20, fill: 'green' },
      });
    };
    const controller = crc(canvas, createElement(Initial, {}));
    driver.flush(10);
    const layerCanvas = drawImage.mock.calls
      .map(([source]) => source)
      .find(source => source instanceof OffscreenCanvas) as OffscreenCanvas;

    update(layerCanvas, createElement(FailingChild, {}));
    crc(canvas, createElement(Replacement, {}));
    expect(() => driver.flush(20)).toThrow(nestedFailure);

    expect(calls).toEqual(['parent:initial', 'child:failing']);
    expect(snapshotRealmScheduler()).toMatchObject({
      dirtyInstances: 2,
      dirtyRoots: 1,
      pendingHostFrames: 1,
    });
    const failedChild = getCRCInstance(layerCanvas);
    const deferredParent = getCRCInstance(canvas);
    expect(isCRCElement(failedChild.pendingRoot) && failedChild.pendingRoot.type)
      .toBe(FailingChild);
    expect(
      isCRCElement(deferredParent.pendingRoot) && deferredParent.pendingRoot.type,
    ).toBe(Replacement);
    expect(failedChild.requestedRenderRevision).toBeGreaterThan(
      failedChild.completedRenderRevision,
    );
    expect(deferredParent.requestedRenderRevision).toBeGreaterThan(
      deferredParent.completedRenderRevision,
    );

    update(layerCanvas, createElement(HealthyChild, {}));
    driver.flush(30);

    expect(calls).toEqual([
      'parent:initial',
      'child:failing',
      'child:healthy',
      'parent:replacement',
    ]);
    expect(pixel(canvas, 5, 5)).toEqual([0, 128, 0, 255]);
    expect(snapshotRealmScheduler()).toMatchObject({
      dirtyInstances: 0,
      dirtyRoots: 0,
      pendingHostFrames: 0,
    });
    controller.dispose();
  });

  it('preserves a newer root queued while restoring a failed nested transaction', () => {
    const nestedFailure = new Error('nested render failed after newer root');
    const calls: string[] = [];
    const canvas = createCanvas();
    const drawImage = vi.spyOn(CanvasRenderingContext2D.prototype, 'drawImage');
    const Initial = (_props: {}) => createElement(Layer, {
      style: { width: 20, height: 20 },
      children: createElement(Rectangle, {
        style: { width: 20, height: 20, fill: 'red' },
      }),
    });
    const OlderReplacement = (_props: {}) => {
      calls.push('parent:older');
    };
    const NewerReplacement = (_props: {}) => {
      calls.push('parent:newer');
    };
    const FailingChild = (_props: {}) => {
      calls.push('child:failing');
      crc(canvas, createElement(NewerReplacement, {}));
      throw nestedFailure;
    };
    const HealthyChild = (_props: {}) => {
      calls.push('child:healthy');
    };
    const controller = crc(canvas, createElement(Initial, {}));
    driver.flush(10);
    const layerCanvas = drawImage.mock.calls
      .map(([source]) => source)
      .find(source => source instanceof OffscreenCanvas) as OffscreenCanvas;

    update(layerCanvas, createElement(FailingChild, {}));
    crc(canvas, createElement(OlderReplacement, {}));
    expect(() => driver.flush(20)).toThrow(nestedFailure);

    expect(snapshotRealmScheduler()).toMatchObject({
      dirtyInstances: 2,
      dirtyRoots: 1,
      pendingHostFrames: 1,
    });
    const pendingParent = getCRCInstance(canvas).pendingRoot;
    expect(isCRCElement(pendingParent) && pendingParent.type)
      .toBe(NewerReplacement);

    update(layerCanvas, createElement(HealthyChild, {}));
    driver.flush(30);

    expect(calls).toEqual([
      'child:failing',
      'child:healthy',
      'parent:newer',
    ]);
    expect(snapshotRealmScheduler()).toMatchObject({
      dirtyInstances: 0,
      dirtyRoots: 0,
      pendingHostFrames: 0,
    });
    controller.dispose();
  });

  it('defers a request made during Render until the next frame', () => {
    const canvas = createCanvas();
    const renders: string[] = [];
    const Replacement = (_props: {}) => {
      renders.push('replacement');
    };
    const Initial = (_props: {}) => {
      renders.push('initial');
      crc(canvas, createElement(Replacement, {}));
    };
    const controller = crc(canvas, createElement(Initial, {}));

    driver.flush(10);
    expect(renders).toEqual(['initial']);
    expect(driver.pendingHostFrames).toBe(1);
    expect(snapshotRealmScheduler().dirtyRoots).toBe(1);
    expect(getCRCInstance(canvas).requestedRenderRevision).toBeGreaterThan(
      getCRCInstance(canvas).completedRenderRevision,
    );

    driver.flush(20);
    expect(renders).toEqual(['initial', 'replacement']);
    expect(driver.pendingHostFrames).toBe(0);
    expect(getCRCInstance(canvas).completedRenderRevision).toBe(
      getCRCInstance(canvas).requestedRenderRevision,
    );
    controller.dispose();
  });

  it('never registers a Layer child as a top-level scheduler participant', () => {
    const observedRootCounts: number[] = [];
    const Child = (_props: {}) => {
      observedRootCounts.push(snapshotRealmScheduler().registeredRoots);
    };
    const controller = crc(createCanvas(), createElement(Layer, {
      style: { width: 20, height: 20 },
      children: createElement(Child, {}),
    }));

    driver.flush(10);

    expect(observedRootCounts).toEqual([1]);
    expect(snapshotRealmScheduler()).toMatchObject({
      registeredRoots: 1,
      pendingHostFrames: 0,
    });
    controller.dispose();
  });

  it('defers a late explicit Layer request with every ancestor composite job', () => {
    const drawImage = vi.spyOn(CanvasRenderingContext2D.prototype, 'drawImage');
    const canvas = createCanvas();
    let rootRenders = 0;
    const Root = (_props: {}) => {
      rootRenders++;
      return createElement(Layer, {
        style: { width: 20, height: 20 },
        children: createElement(Rectangle, {
          style: { width: 20, height: 20, fill: 'red' },
        }),
      });
    };
    const controller = crc(canvas, createElement(Root, {}));
    driver.flush(10);
    const layerCanvas = drawImage.mock.calls
      .map(([source]) => source)
      .find(source => source instanceof OffscreenCanvas) as OffscreenCanvas;
    expect(pixel(canvas, 5, 5)).toEqual([255, 0, 0, 255]);

    let releaseAdvance = () => {};
    releaseAdvance = registerAdvanceParticipant(() => {
      update(layerCanvas, createElement(Rectangle, {
        style: { width: 20, height: 20, fill: 'blue' },
      }));
      releaseAdvance();
    });
    driver.flush(20);

    expect(rootRenders).toBe(1);
    expect(pixel(canvas, 5, 5)).toEqual([255, 0, 0, 255]);
    expect(snapshotRealmScheduler()).toMatchObject({
      dirtyInstances: 2,
      dirtyRoots: 1,
      pendingHostFrames: 1,
    });
    expect(getCRCInstance(layerCanvas).requestedRenderRevision).toBeGreaterThan(
      getCRCInstance(layerCanvas).completedRenderRevision,
    );
    expect(getCRCInstance(canvas).requestedRenderRevision).toBeGreaterThan(
      getCRCInstance(canvas).completedRenderRevision,
    );

    driver.flush(30);
    expect(rootRenders).toBe(2);
    expect(pixel(canvas, 5, 5)).toEqual([0, 0, 255, 255]);
    expect(snapshotRealmScheduler()).toMatchObject({
      dirtyInstances: 0,
      dirtyRoots: 0,
      pendingHostFrames: 0,
    });
    controller.dispose();
  });

  it('defers a nested request made during child rendering to the next realm frame', () => {
    const childPulse = signal(0);
    const calls: string[] = [];
    const canvas = createCanvas();
    const drawImage = vi.spyOn(CanvasRenderingContext2D.prototype, 'drawImage');
    let layerCanvas: OffscreenCanvas | undefined;
    let requestReplacement = false;
    const Replacement = (_props: {}) => {
      calls.push('replacement');
      return createElement(Rectangle, {
        style: { width: 20, height: 20, fill: 'blue' },
      });
    };
    const NestedChild = (_props: {}) => {
      calls.push('child');
      childPulse.get();
      if (requestReplacement) {
        requestReplacement = false;
        update(layerCanvas!, createElement(Replacement, {}));
      }
      return createElement(Rectangle, {
        style: { width: 20, height: 20, fill: 'red' },
      });
    };
    const controller = crc(canvas, createElement(Layer, {
      style: { width: 20, height: 20 },
      children: createElement(NestedChild, {}),
    }));

    driver.flush(10);
    layerCanvas = drawImage.mock.calls
      .map(([source]) => source)
      .find(source => source instanceof OffscreenCanvas) as OffscreenCanvas;
    calls.length = 0;
    requestReplacement = true;

    childPulse.set(1);
    driver.flush(20);

    const child = getCRCInstance(layerCanvas);
    expect(calls).toEqual(['child']);
    expect(child.requestedRenderRevision).toBeGreaterThan(
      child.completedRenderRevision,
    );
    expect(pixel(canvas, 5, 5)).toEqual([255, 0, 0, 255]);
    expect(driver.pendingHostFrames).toBe(1);

    driver.flush(30);

    expect(calls).toEqual(['child', 'replacement']);
    expect(pixel(canvas, 5, 5)).toEqual([0, 0, 255, 255]);
    expect(child.completedRenderRevision).toBe(child.requestedRenderRevision);
    expect(driver.pendingHostFrames).toBe(0);
    controller.dispose();
  });

  it('commits a shared signal before rendering a Layer root and another top-level root', () => {
    const shared = signal('red');
    const reads: string[] = [];
    const LayerChild = (_props: {}) => {
      reads.push(`layer:${shared.get()}`);
      return createElement(Rectangle, {
        style: { width: 20, height: 20, fill: shared.get() },
      });
    };
    const OtherRoot = (_props: {}) => {
      reads.push(`other:${shared.get()}`);
      return createElement(Rectangle, {
        style: { width: 20, height: 20, fill: shared.get() },
      });
    };
    const first = crc(createCanvas(), createElement(Layer, {
      style: { width: 20, height: 20 },
      children: createElement(LayerChild, {}),
    }));
    const second = crc(createCanvas(), createElement(OtherRoot, {}));

    driver.flush(10);
    reads.length = 0;
    shared.set('blue');
    driver.flush(20);

    expect(reads).toEqual(['layer:blue', 'other:blue']);
    expect(driver.pendingHostFrames).toBe(0);
    first.dispose();
    second.dispose();
  });

  it('cleans a failed signal-driven Layer child while another root progresses and the child recovers', () => {
    const shouldFail = signal(false);
    const failure = new Error('nested signal failure');
    const firstCanvas = createCanvas();
    const drawImage = vi.spyOn(CanvasRenderingContext2D.prototype, 'drawImage');
    let independentRenders = 0;
    const Child = (_props: {}) => {
      const ref = crcRef<string>();
      ref.current ??= 'acquired';
      if (shouldFail.get()) throw failure;
      return createElement(Rectangle, {
        style: { width: 20, height: 20, fill: 'red' },
      });
    };
    const Recovered = (_props: {}) => createElement(Rectangle, {
      style: { width: 20, height: 20, fill: 'blue' },
    });
    const first = crc(firstCanvas, createElement(Layer, {
      style: { width: 20, height: 20 },
      children: createElement(Layer, {
        style: { width: 20, height: 20 },
        children: createElement(Child, {}),
      }),
    }));
    const secondCanvas = createCanvas();
    const second = crc(secondCanvas, createElement(() => {
      independentRenders++;
    }, {}));
    driver.flush(10);
    const layerCanvas = drawImage.mock.calls
      .map(([source]) => source)
      .find(source => source instanceof OffscreenCanvas) as OffscreenCanvas;
    const nested = Array.from(GLOBAL_STATE.crcInstances.values())
      .find(instance => instance.parent === layerCanvas)!;
    expect(nested.refs.size).toBeGreaterThan(0);

    shouldFail.set(true);
    crc(secondCanvas, createElement(() => {
      independentRenders++;
    }, {}));
    expect(() => driver.flush(20)).toThrow(failure);

    expect(nested.refs.size).toBe(0);
    expect(getSignalNode(shouldFail).observers.size).toBe(0);
    expect(independentRenders).toBe(2);
    expect(GLOBAL_STATE.crcInstances.has(layerCanvas)).toBe(true);

    update(nested.canvas, createElement(Recovered, {}));
    driver.flush(30);

    expect(pixel(firstCanvas, 5, 5)).toEqual([0, 0, 255, 255]);
    first.dispose();
    expect(GLOBAL_STATE.crcInstances.has(layerCanvas)).toBe(false);
    expect(GLOBAL_STATE.crcInstances.has(nested.canvas)).toBe(false);
    second.dispose();
  });

  it('cancels pending nested Layer work and releases nested ownership on disposal', () => {
    const canvas = createCanvas();
    const drawImage = vi.spyOn(CanvasRenderingContext2D.prototype, 'drawImage');
    const controller = crc(canvas, createElement(Layer, {
      style: { width: 20, height: 20 },
      children: createElement(Layer, {
        style: { width: 20, height: 20 },
        children: createElement(Rectangle, {
          style: { width: 20, height: 20, fill: 'red' },
        }),
      }),
    }));
    driver.flush(10);
    const outer = drawImage.mock.calls
      .map(([source]) => source)
      .find(source => source instanceof OffscreenCanvas) as OffscreenCanvas;
    const nested = Array.from(GLOBAL_STATE.crcInstances.values())
      .find(instance => instance.parent === outer)!;

    update(nested.canvas, createElement(Rectangle, {
      style: { width: 20, height: 20, fill: 'blue' },
    }));
    expect(driver.pendingHostFrames).toBe(1);
    controller.dispose();

    expect(driver.cancelCount).toBe(1);
    expect(driver.pendingHostFrames).toBe(0);
    expect(GLOBAL_STATE.crcInstances.has(outer)).toBe(false);
    expect(GLOBAL_STATE.crcInstances.has(nested.canvas)).toBe(false);
  });

  it('cancels exactly one pending host callback when the final dirty root is removed', () => {
    const controller = crc(createCanvas(), createElement(() => undefined, {}));
    expect(driver.pendingHostFrames).toBe(1);

    controller.dispose();
    controller.dispose();

    expect(driver.cancelCount).toBe(1);
    expect(driver.pendingHostFrames).toBe(0);
    expect(snapshotRealmScheduler()).toMatchObject({
      registeredRoots: 0,
      dirtyRoots: 0,
      pendingHostFrames: 0,
    });
  });

  it('releases provisional dirty work when an already-aborted mount disposes', () => {
    const canvas = createCanvas();
    installSynchronousResizeChange(canvas);
    const abortController = new AbortController();
    abortController.abort();

    const controller = crc(
      canvas,
      createElement(() => undefined, {}),
      { signal: abortController.signal },
    );

    expect(snapshotRealmScheduler()).toMatchObject({
      registeredRoots: 0,
      dirtyInstances: 0,
      dirtyRoots: 0,
      pendingHostFrames: 0,
    });
    expect(driver.cancelCount).toBe(1);
    controller.dispose();
  });

  it('releases provisional dirty work when requesting the setup frame throws', () => {
    const canvas = createCanvas();
    installSynchronousResizeChange(canvas);
    const setupFailure = new Error('host frame request failed');
    vi.spyOn(driver, 'requestFrame').mockImplementationOnce(() => {
      throw setupFailure;
    });

    expect(() => crc(canvas, createElement(() => undefined, {})))
      .toThrow(setupFailure);

    expect(snapshotRealmScheduler()).toMatchObject({
      registeredRoots: 0,
      dirtyInstances: 0,
      dirtyRoots: 0,
      pendingHostFrames: 0,
    });
  });

  it('runs Advance, Commit, Plan, Render, and Complete in order and lets Plan dirtiness render now', () => {
    const phases: string[] = [];
    const source = signal(0);
    const selected = computed(() => {
      const value = source.get();
      if (value > 0) phases.push(snapshotRealmScheduler().phase);
      return value * 2;
    });
    const canvas = createCanvas();
    const controller = mountCRC(canvas, createElement(() => {
      phases.push(snapshotRealmScheduler().phase);
    }, {}));
    const consumer = createSignalRenderConsumer({
      debugName: 'scheduler plan probe',
      invalidate: () => update(canvas, undefined, true),
    });
    collectSignalReads(consumer, () => selected.get());
    consumer.markClean();
    getSignalNode(source).observers.add(() => {
      phases.push(snapshotRealmScheduler().phase);
    });
    let releaseAdvance = () => {};
    const advance: CRCAdvanceParticipant = (_snapshot, batch) => {
      phases.push(snapshotRealmScheduler().phase);
      batch.stage(source, 1, advance);
      releaseAdvance();
    };
    releaseAdvance = registerAdvanceParticipant(advance);
    queueFrameCompletion(() => {
      phases.push(snapshotRealmScheduler().phase);
    });

    driver.flush(50);

    expect(phases).toEqual(['advance', 'commit', 'plan', 'render', 'complete']);
    expect(selected.get()).toBe(2);
    expect(driver.pendingHostFrames).toBe(0);
    disposeSignalRenderConsumer(consumer);
    controller.dispose();
  });

  it('rejects direct set and update during Advance before either can mutate', () => {
    const value = signal(0);
    let releaseSet = () => {};
    releaseSet = registerAdvanceParticipant(() => {
      releaseSet();
      value.set(1);
    });

    const setFailure = captureFailure(() => driver.flush(60));
    expect(setFailure).toMatchObject({
      message: 'Cannot write to a signal directly during CRC scheduler Advance; stage it through the provided batch.',
    });
    expect(value.get()).toBe(0);

    let updateCalls = 0;
    let releaseUpdate = () => {};
    releaseUpdate = registerAdvanceParticipant(() => {
      releaseUpdate();
      value.update(current => {
        updateCalls++;
        return current + 1;
      });
    });

    const updateFailure = captureFailure(() => driver.flush(70));
    expect(updateFailure).toMatchObject({
      message: 'Cannot write to a signal directly during CRC scheduler Advance; stage it through the provided batch.',
    });
    expect(updateCalls).toBe(0);
    expect(value.get()).toBe(0);
    expect(driver.pendingHostFrames).toBe(0);
  });

  it('discards sanctioned stages when the same Advance participant attempts a direct write', () => {
    const staged = signal(0);
    const direct = signal(0);
    let release = () => {};
    const participant: CRCAdvanceParticipant = (_snapshot, batch) => {
      release();
      batch.stage(staged, 1, participant);
      direct.set(1);
    };
    release = registerAdvanceParticipant(participant);

    expect(() => driver.flush(80)).toThrow(
      'Cannot write to a signal directly during CRC scheduler Advance; stage it through the provided batch.',
    );
    expect(staged.get()).toBe(0);
    expect(direct.get()).toBe(0);
    expect(driver.pendingHostFrames).toBe(0);
  });

  it('defers state-only and root replacement requests made during Advance', () => {
    const stateValues: number[] = [];
    const replacementRenders: string[] = [];
    let setState: StateUpdater<number> = () => {};
    const Stateful = (_props: {}) => {
      const [value, updateState] = crcState(0);
      setState = updateState;
      stateValues.push(value);
    };
    const Replacement = (_props: {}) => {
      replacementRenders.push('replacement');
    };
    const stateController = crc(createCanvas(), createElement(Stateful, {}));
    const replacementCanvas = createCanvas();
    const replacementController = crc(
      replacementCanvas,
      createElement(() => undefined, {}),
    );
    driver.flush(10);
    stateValues.length = 0;

    let release = () => {};
    release = registerAdvanceParticipant(() => {
      release();
      setState(1);
      crc(replacementCanvas, createElement(Replacement, {}));
    });
    driver.flush(20);

    expect(stateValues).toEqual([]);
    expect(replacementRenders).toEqual([]);
    expect(driver.pendingHostFrames).toBe(1);

    driver.flush(30);
    expect(stateValues).toEqual([1]);
    expect(replacementRenders).toEqual(['replacement']);
    expect(driver.pendingHostFrames).toBe(0);
    stateController.dispose();
    replacementController.dispose();
  });

  it('keeps a later Commit-admitted root latest over an earlier Advance-deferred root', () => {
    const source = signal(0);
    const renders: string[] = [];
    const canvas = createCanvas();
    const Deferred = (_props: {}) => {
      renders.push('deferred');
    };
    const Latest = (_props: {}) => {
      renders.push('latest');
    };
    const controller = crc(canvas, createElement(() => undefined, {}));
    driver.flush(10);
    const commitLatestRoot = () => {
      crc(canvas, createElement(Latest, {}));
    };
    getSignalNode(source).observers.add(commitLatestRoot);

    let release = () => {};
    const participant: CRCAdvanceParticipant = (_snapshot, batch) => {
      release();
      crc(canvas, createElement(Deferred, {}));
      batch.stage(source, 1, participant);
    };
    release = registerAdvanceParticipant(participant);

    driver.flush(20);
    expect(renders).toEqual(['latest']);
    expect(driver.pendingHostFrames).toBe(1);

    driver.flush(30);
    expect(renders).toEqual(['latest', 'latest']);
    expect(driver.pendingHostFrames).toBe(0);
    getSignalNode(source).observers.delete(commitLatestRoot);
    controller.dispose();
  });

  it('drains nested computed failures, renders independent roots, and reports the value error once', () => {
    const failingSource = signal(0);
    const healthySource = signal(0);
    const computationFailure = new Error('nested computed failed');
    const inner = computed(() => {
      if (failingSource.get() > 0) throw computationFailure;
      return 1;
    }, { debugName: 'failing inner' });
    const outer = computed(
      () => inner.get() + 1,
      { debugName: 'failing outer' },
    );
    const healthy = computed(() => healthySource.get() + 1);
    let failingRenderAttempts = 0;
    const healthyValues: number[] = [];
    const first = crc(createCanvas(), createElement(() => {
      failingRenderAttempts++;
      outer.get();
    }, {}));
    const second = crc(createCanvas(), createElement(() => {
      healthyValues.push(healthy.get());
    }, {}));
    driver.flush(10);

    let release = () => {};
    const participant: CRCAdvanceParticipant = (_snapshot, batch) => {
      release();
      batch.stage(failingSource, 1, participant);
      batch.stage(healthySource, 1, participant);
    };
    release = registerAdvanceParticipant(participant);

    const reported = captureFailure(() => driver.flush(20));

    expect(reported).toBe(computationFailure);
    expect(failingRenderAttempts).toBe(2);
    expect(healthyValues).toEqual([1, 2]);
    expect(signalGraphSnapshot().pendingComputedValidations).toBe(0);
    expect(driver.pendingHostFrames).toBe(0);
    first.dispose();
    second.dispose();
  });

  it('admits Commit and Plan dirtiness into the current frame', () => {
    const directSource = signal(0);
    const computedSource = signal(0);
    const derived = computed(() => computedSource.get() * 2);
    const calls: string[] = [];
    const directController = crc(createCanvas(), createElement(() => {
      calls.push(`direct:${directSource.get()}:${snapshotRealmScheduler().phase}`);
    }, {}));
    const computedController = crc(createCanvas(), createElement(() => {
      calls.push(`computed:${derived.get()}:${snapshotRealmScheduler().phase}`);
    }, {}));
    driver.flush(10);
    calls.length = 0;

    let release = () => {};
    const participant: CRCAdvanceParticipant = (_snapshot, batch) => {
      release();
      batch.stage(directSource, 1, participant);
      batch.stage(computedSource, 1, participant);
    };
    release = registerAdvanceParticipant(participant);
    driver.flush(20);

    expect(calls).toEqual(['direct:1:render', 'computed:2:render']);
    expect(driver.pendingHostFrames).toBe(0);
    directController.dispose();
    computedController.dispose();
  });

  it('defers a state request made during Complete until the next Begin', () => {
    const values: number[] = [];
    let setState: StateUpdater<number> = () => {};
    const controller = crc(createCanvas(), createElement(() => {
      const [value, updateState] = crcState(0);
      setState = updateState;
      values.push(value);
    }, {}));
    driver.flush(10);
    values.length = 0;

    queueFrameCompletion(() => setState(1));
    driver.flush(20);

    expect(values).toEqual([]);
    expect(driver.pendingHostFrames).toBe(1);
    driver.flush(30);
    expect(values).toEqual([1]);
    expect(driver.pendingHostFrames).toBe(0);
    controller.dispose();
  });

  it('defers participants and completions registered after Begin', () => {
    const calls: string[] = [];
    let releaseFirst = () => {};
    let releaseSecond = () => {};
    const second: CRCAdvanceParticipant = () => {
      calls.push(`second:${snapshotRealmScheduler().currentFrame?.hostTime}`);
      releaseSecond();
    };
    const first = () => {
      calls.push(`first:${snapshotRealmScheduler().currentFrame?.hostTime}`);
      releaseFirst();
      releaseSecond = registerAdvanceParticipant(second);
      queueFrameCompletion(() => calls.push('late-complete'));
    };
    releaseFirst = registerAdvanceParticipant(first);
    queueFrameCompletion(() => calls.push('current-complete'));

    driver.flush(10);
    expect(calls).toEqual(['first:10', 'current-complete']);
    expect(driver.pendingHostFrames).toBe(1);

    driver.flush(20);
    expect(calls).toEqual([
      'first:10',
      'current-complete',
      'second:20',
      'late-complete',
    ]);
    expect(driver.pendingHostFrames).toBe(0);
  });

  it('defers a same-callback Advance re-registration until the next Begin', () => {
    const calls: string[] = [];
    let releaseGate = () => {};
    let releaseOriginal = () => {};
    let releaseReplacement = () => {};
    const shared: CRCAdvanceParticipant = snapshot => {
      calls.push(`shared:${snapshot.hostTime}`);
      releaseReplacement();
    };
    releaseGate = registerAdvanceParticipant(snapshot => {
      calls.push(`gate:${snapshot.hostTime}`);
      releaseGate();
      releaseOriginal();
      releaseReplacement = registerAdvanceParticipant(shared);
    });
    releaseOriginal = registerAdvanceParticipant(shared);

    driver.flush(10);
    expect(calls).toEqual(['gate:10']);
    expect(driver.pendingHostFrames).toBe(1);

    driver.flush(20);
    expect(calls).toEqual(['gate:10', 'shared:20']);
    expect(driver.pendingHostFrames).toBe(0);
  });

  it('owns concurrent registrations of one Advance callback independently', () => {
    const calls: number[] = [];
    const shared: CRCAdvanceParticipant = snapshot => {
      calls.push(snapshot.hostTime);
    };
    const releaseFirst = registerAdvanceParticipant(shared);
    const releaseSecond = registerAdvanceParticipant(shared);
    expect(snapshotRealmScheduler().registeredAdvanceParticipants).toBe(2);

    releaseFirst();
    expect(snapshotRealmScheduler().registeredAdvanceParticipants).toBe(1);
    expect(driver.pendingHostFrames).toBe(1);

    driver.flush(30);
    expect(calls).toEqual([30]);
    releaseSecond();
    expect(snapshotRealmScheduler().registeredAdvanceParticipants).toBe(0);
    expect(driver.pendingHostFrames).toBe(0);
  });

  it('isolates producer and completion failures while preserving later work', () => {
    const producerFailure = new Error('producer failed');
    const completionFailure = new Error('completion failed');
    const calls: string[] = [];
    const value = signal(0);
    let releaseFirst = () => {};
    let releaseSecond = () => {};
    releaseFirst = registerAdvanceParticipant(() => {
      calls.push('first-producer');
      releaseFirst();
      throw producerFailure;
    });
    const secondProducer: CRCAdvanceParticipant = (_snapshot, batch) => {
      calls.push('second-producer');
      batch.stage(value, 1, secondProducer);
      releaseSecond();
    };
    releaseSecond = registerAdvanceParticipant(secondProducer);
    queueFrameCompletion(() => {
      calls.push('first-completion');
      throw completionFailure;
    });
    queueFrameCompletion(() => calls.push('second-completion'));

    let failure: unknown;
    try {
      driver.flush(30);
    } catch (error) {
      failure = error;
    }

    expect(failure).toBeInstanceOf(AggregateError);
    expect((failure as AggregateError).errors).toEqual([
      producerFailure,
      completionFailure,
    ]);
    expect(calls).toEqual([
      'first-producer',
      'second-producer',
      'first-completion',
      'second-completion',
    ]);
    expect(value.get()).toBe(1);
    expect(driver.pendingHostFrames).toBe(0);
  });

  it('continues root transaction callbacks after one callback fails', () => {
    const failure = new Error('transaction callback failed');
    const calls: string[] = [];
    const Root = (_props: {}) => {
      const transaction = getCurrentCRCInstance().eventRoot.renderTransaction!;
      transaction.onFinish(() => {
        calls.push('first');
        throw failure;
      });
      transaction.onFinish(() => calls.push('second'));
    };
    const controller = crc(createCanvas(), createElement(Root, {}));

    expect(() => driver.flush(40)).toThrow(failure);

    expect(calls).toEqual(['first', 'second']);
    expect(driver.pendingHostFrames).toBe(0);
    controller.dispose();
  });

  it('uses an isolated immutable snapshot for a direct render without advancing producers', () => {
    const snapshots: Array<ReturnType<typeof getCurrentFrameSnapshot>> = [];
    let advances = 0;
    const canvas = createCanvas();
    const controller = mountCRC(canvas, createElement(() => {
      snapshots.push(getCurrentFrameSnapshot());
    }, {}));
    const release = registerAdvanceParticipant(() => advances++);

    executeRender(canvas, 75);

    expect(advances).toBe(0);
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]).toMatchObject({ hostTime: 75, logicalTime: 75 });
    expect(Object.isFrozen(snapshots[0])).toBe(true);
    release();
    controller.dispose();
  });

  it('does not recursively render a parent from a direct child render', () => {
    const calls: string[] = [];
    const parentCanvas = createCanvas();
    const parentRoot = createElement(() => {
      calls.push('parent');
    }, {});
    const parent = mountCRC(parentCanvas, parentRoot);
    const childCanvas = new OffscreenCanvas(20, 20);
    const childRoot = createElement(() => {
      calls.push('child');
    }, {});
    const child = mountCRC(childCanvas, childRoot, { parent: parentCanvas });

    executeRender(childCanvas, 90, childRoot, true);

    expect(calls).toEqual(['child']);
    child.dispose();
    parent.dispose();
  });

  it('does not cancel pending realm work when executeRender is called directly', () => {
    let renders = 0;
    const canvas = createCanvas();
    const root = createElement(() => {
      renders++;
    }, {});
    const controller = crc(canvas, root);

    executeRender(canvas, 5, root);
    expect(renders).toBe(1);
    expect(driver.pendingHostFrames).toBe(1);
    expect(driver.cancelCount).toBe(0);

    driver.flush(10);
    expect(renders).toBe(2);
    expect(driver.pendingHostFrames).toBe(0);
    controller.dispose();
  });
});

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);
  return canvas;
}

function installSynchronousResizeChange(canvas: HTMLCanvasElement): void {
  let boundsReadCount = 0;
  vi.spyOn(canvas, 'getBoundingClientRect').mockImplementation(() => {
    const width = boundsReadCount++ === 0 ? 100 : 200;
    return DOMRect.fromRect({ width, height: 100 });
  });
  vi.stubGlobal('ResizeObserver', class implements ResizeObserver {
    constructor(private readonly callback: ResizeObserverCallback) {}

    observe(): void {
      this.callback([], this);
    }

    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): ResizeObserverEntry[] {
      return [];
    }
  });
}

function pixel(canvas: HTMLCanvasElement, x: number, y: number): number[] {
  return Array.from(canvas.getContext('2d')!.getImageData(x, y, 1, 1).data);
}

function captureFailure(callback: () => unknown): unknown {
  try {
    callback();
  } catch (error) {
    return error;
  }
  throw new Error('Expected callback to throw.');
}
