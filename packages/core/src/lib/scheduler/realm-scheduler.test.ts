import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { crc } from '../crc';
import { Layer } from '../components/layer';
import { createElement } from '../element/create-element';
import { executeRender } from '../execute-render';
import {
  clearSharedState,
  getCRCInstance,
  getCurrentCRCInstance,
} from '../global-state';
import { mountCRC } from '../mount-crc';
import {
  collectSignalReads,
  createSignalRenderConsumer,
  disposeSignalRenderConsumer,
} from '../signals/render-consumer';
import { computed, getSignalNode, signal } from '../signals/graph';
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
