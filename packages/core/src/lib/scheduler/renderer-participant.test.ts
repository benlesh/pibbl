import { signalObserversForTest } from "../../../test/support/signal-observer";
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  computed,
  pibbl,
  createElement,
  Layer,
  signal,
} from '@pibbl/core';
import {
  pibblInternalCreateSignalConsumer,
  pibblInternalCurrentFrame,
  pibblInternalCurrentRenderOwner,
  pibblInternalQueueComplete,
  pibblInternalRequestRendererWork,
  type PibblInternalFrame,
  type PibblInternalRenderOwner,
  type PibblInternalSignalConsumer,
} from '@pibbl/core/internal';
import { clearSharedState, getPibblInstance } from '../global-state';
import { getSignalNode, signalGraphSnapshot } from '../signals/graph';
import {
  registerAdvanceParticipant,
} from './realm-scheduler';
import type { PibblAdvanceParticipant } from './types';
import {
  installSchedulerDriverForTest,
  ManualSchedulerDriver,
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

describe('@pibbl/core/internal renderer participants', () => {
  const failureCases = [
    {
      kind: 'resource',
      failedCalls: ['resource', 'independent root'],
    },
    {
      kind: 'draw',
      failedCalls: ['resource', 'draw', 'independent root'],
    },
    {
      kind: 'compose',
      failedCalls: [
        'resource',
        'draw',
        'root render',
        'compose',
        'independent root',
      ],
    },
  ] as const;

  for (const failureCase of failureCases) {
    it(`keeps the renderer revision incomplete and retries after ${failureCase.kind} fails`, () => {
      const calls: string[] = [];
      const transactionOutcomes: boolean[] = [];
      const failure = new Error(`${failureCase.kind} failed`);
      const keys = {
        resource: {},
        draw: {},
        compose: {},
      };
      let owner: PibblInternalRenderOwner | undefined;
      let recordRootRender = false;
      let failedOnce = false;
      const canvas = createCanvas();
      const Root = (_props: {}) => {
        owner ??= pibblInternalCurrentRenderOwner();
        if (recordRootRender) calls.push('root render');
      };
      const controller = pibbl(canvas, createElement(Root, {}));
      driver.flush(1);
      const instance = getPibblInstance(canvas);
      const completedBeforeWork = instance.completedRenderRevision;

      for (const kind of ['resource', 'draw', 'compose'] as const) {
        pibblInternalRequestRendererWork(owner!, {
          key: keys[kind],
          kind,
          run: () => {
            calls.push(kind);
            if (kind === 'resource') {
              instance.eventRoot.renderTransaction!.onFinish(success => {
                transactionOutcomes.push(success);
              });
            }
            if (kind === failureCase.kind && !failedOnce) {
              failedOnce = true;
              throw failure;
            }
          },
        });
      }
      const independent = pibbl(createCanvas(), createElement(() => {
        calls.push('independent root');
      }, {}));
      recordRootRender = true;

      expect(() => driver.flush(2)).toThrow(failure);
      expect(calls).toEqual(failureCase.failedCalls);
      expect(transactionOutcomes).toEqual([false]);
      expect(instance.completedRenderRevision).toBe(completedBeforeWork);
      expect(driver.pendingHostFrames).toBe(1);

      calls.length = 0;
      driver.flush(3);
      expect(calls).toEqual([
        'resource',
        'draw',
        'root render',
        'compose',
      ]);
      expect(transactionOutcomes).toEqual([false, true]);
      expect(instance.completedRenderRevision).toBeGreaterThan(
        completedBeforeWork,
      );
      expect(driver.pendingHostFrames).toBe(0);
      independent.dispose();
      controller.dispose();
    });
  }

  it('runs independent same-stage work and aggregates failures in registration order', () => {
    const calls: string[] = [];
    const firstFailure = new Error('first draw failed');
    const secondFailure = new Error('third draw failed');
    let owner: PibblInternalRenderOwner | undefined;
    let recordRootRender = false;
    const canvas = createCanvas();
    const Root = (_props: {}) => {
      owner ??= pibblInternalCurrentRenderOwner();
      if (recordRootRender) calls.push('root render');
    };
    const controller = pibbl(canvas, createElement(Root, {}));
    driver.flush(1);
    const completedBeforeWork = getPibblInstance(canvas).completedRenderRevision;

    pibblInternalRequestRendererWork(owner!, {
      key: {},
      kind: 'resource',
      run: () => calls.push('resource'),
    });
    pibblInternalRequestRendererWork(owner!, {
      key: {},
      kind: 'draw',
      run: () => {
        calls.push('draw:first');
        throw firstFailure;
      },
    });
    pibblInternalRequestRendererWork(owner!, {
      key: {},
      kind: 'draw',
      run: () => calls.push('draw:second'),
    });
    pibblInternalRequestRendererWork(owner!, {
      key: {},
      kind: 'draw',
      run: () => {
        calls.push('draw:third');
        throw secondFailure;
      },
    });
    pibblInternalRequestRendererWork(owner!, {
      key: {},
      kind: 'compose',
      run: () => calls.push('compose'),
    });
    recordRootRender = true;

    let thrown: unknown;
    try {
      driver.flush(2);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(AggregateError);
    expect((thrown as AggregateError).errors).toEqual([
      firstFailure,
      secondFailure,
    ]);
    expect(calls).toEqual([
      'resource',
      'draw:first',
      'draw:second',
      'draw:third',
    ]);
    expect(getPibblInstance(canvas).completedRenderRevision)
      .toBe(completedBeforeWork);
    expect(driver.pendingHostFrames).toBe(1);
    controller.dispose();
  });

  it('restores unexecuted later-owner work in the same root without overwriting newer keyed work', () => {
    const calls: string[] = [];
    const failure = new Error('nested renderer failed');
    const parentKey = {};
    const retainedParentKey = {};
    let parentOwner: PibblInternalRenderOwner | undefined;
    let childOwner: PibblInternalRenderOwner | undefined;
    let failOnce = true;
    let recordRenders = false;

    const Child = (_props: {}) => {
      childOwner ??= pibblInternalCurrentRenderOwner();
      if (recordRenders) calls.push('child render');
    };
    const Root = (_props: {}) => {
      parentOwner ??= pibblInternalCurrentRenderOwner();
      if (recordRenders) calls.push('parent render');
      return createElement(Layer, {
        style: { width: 20, height: 20 },
        children: createElement(Child, {}),
      });
    };

    const controller = pibbl(createCanvas(), createElement(Root, {}));
    driver.flush(1);
    recordRenders = true;

    pibblInternalRequestRendererWork(parentOwner!, {
      key: parentKey,
      kind: 'draw',
      run: () => calls.push('stale parent work'),
    });
    pibblInternalRequestRendererWork(parentOwner!, {
      key: retainedParentKey,
      kind: 'draw',
      run: () => calls.push('retained parent work'),
    });
    pibblInternalRequestRendererWork(childOwner!, {
      key: {},
      kind: 'resource',
      run: () => {
        calls.push('child work');
        if (failOnce) {
          failOnce = false;
          pibblInternalRequestRendererWork(parentOwner!, {
            key: parentKey,
            kind: 'draw',
            run: () => calls.push('latest parent work'),
          });
          throw failure;
        }
      },
    });

    expect(() => driver.flush(2)).toThrow(failure);
    expect(calls).toEqual(['child work']);
    expect(driver.pendingHostFrames).toBe(1);

    calls.length = 0;
    driver.flush(3);
    expect(calls).toEqual([
      'child work',
      'child render',
      'retained parent work',
      'latest parent work',
      'parent render',
    ]);
    expect(driver.pendingHostFrames).toBe(0);
    controller.dispose();
  });

  it('defers a failed owner completion while successful owners complete exactly once', () => {
    const calls: string[] = [];
    const failure = new Error('renderer failed before completion');
    let failedOwner: PibblInternalRenderOwner | undefined;
    let successfulOwner: PibblInternalRenderOwner | undefined;
    let failOnce = true;
    let recordRenders = false;

    const FailingRoot = (_props: {}) => {
      failedOwner ??= pibblInternalCurrentRenderOwner();
      if (recordRenders) calls.push('failed root render');
    };
    const SuccessfulRoot = (_props: {}) => {
      successfulOwner ??= pibblInternalCurrentRenderOwner();
      if (recordRenders) calls.push('successful root render');
    };
    const failedController = pibbl(
      createCanvas(),
      createElement(FailingRoot, {}),
    );
    const successfulController = pibbl(
      createCanvas(),
      createElement(SuccessfulRoot, {}),
    );
    driver.flush(1);
    recordRenders = true;

    pibblInternalRequestRendererWork(failedOwner!, {
      key: {},
      kind: 'resource',
      run: () => {
        calls.push('failed owner work');
        if (failOnce) {
          failOnce = false;
          throw failure;
        }
      },
    });
    pibblInternalQueueComplete(failedOwner!, () => {
      calls.push('failed owner complete');
    });
    pibblInternalRequestRendererWork(successfulOwner!, {
      key: {},
      kind: 'draw',
      run: () => calls.push('successful owner work'),
    });
    pibblInternalQueueComplete(successfulOwner!, () => {
      calls.push('successful owner complete');
    });

    expect(() => driver.flush(2)).toThrow(failure);
    expect(calls).toEqual([
      'failed owner work',
      'successful owner work',
      'successful root render',
      'successful owner complete',
    ]);
    expect(driver.pendingHostFrames).toBe(1);

    calls.length = 0;
    driver.flush(3);
    expect(calls).toEqual([
      'failed owner work',
      'failed root render',
      'failed owner complete',
    ]);
    expect(driver.pendingHostFrames).toBe(0);
    failedController.dispose();
    successfulController.dispose();
  });

  it('coalesces several consumer invalidations into one renderer frame', () => {
    const calls: string[] = [];
    const sources = [signal(0), signal(0), signal(0)];
    const consumers: PibblInternalSignalConsumer[] = [];
    const sharedKey = {};
    let owner: PibblInternalRenderOwner | undefined;
    let recordRootRender = false;
    const Root = (_props: {}) => {
      owner ??= pibblInternalCurrentRenderOwner();
      if (consumers.length === 0) {
        for (const [index] of sources.entries()) {
          consumers.push(pibblInternalCreateSignalConsumer({
            owner,
            invalidate: () => {
              calls.push(`invalidate:${index + 1}`);
              pibblInternalRequestRendererWork(owner!, {
                key: sharedKey,
                kind: 'draw',
                run: () => calls.push(`work:${index + 1}`),
              });
            },
          }));
        }
      }
      for (const [index, consumer] of consumers.entries()) {
        consumer.collect(() => sources[index].get());
        consumer.markClean();
      }
      if (recordRootRender) calls.push('root render');
    };
    const controller = pibbl(createCanvas(), createElement(Root, {}));
    driver.flush(1);
    const requestsBeforeInvalidation = driver.requestCount;
    recordRootRender = true;

    sources[0].set(1);
    sources[1].set(1);
    sources[2].set(1);

    expect(calls).toEqual(['invalidate:1', 'invalidate:2', 'invalidate:3']);
    expect(driver.requestCount).toBe(requestsBeforeInvalidation + 1);
    expect(driver.pendingHostFrames).toBe(1);
    driver.flush(2);
    expect(calls).toEqual([
      'invalidate:1',
      'invalidate:2',
      'invalidate:3',
      'work:3',
      'root render',
    ]);
    expect(driver.pendingHostFrames).toBe(0);
    controller.dispose();
  });

  it('preserves same-kind registration order when replacing a work key', () => {
    const calls: string[] = [];
    const firstKey = {};
    let owner: PibblInternalRenderOwner | undefined;
    let recordRootRender = false;
    const Root = (_props: {}) => {
      owner ??= pibblInternalCurrentRenderOwner();
      if (recordRootRender) calls.push('root render');
    };
    const controller = pibbl(createCanvas(), createElement(Root, {}));
    driver.flush(1);

    pibblInternalRequestRendererWork(owner!, {
      key: firstKey,
      kind: 'resource',
      run: () => calls.push('stale first'),
    });
    pibblInternalRequestRendererWork(owner!, {
      key: {},
      kind: 'resource',
      run: () => calls.push('second'),
    });
    pibblInternalRequestRendererWork(owner!, {
      key: firstKey,
      kind: 'resource',
      run: () => calls.push('latest first'),
    });
    pibblInternalRequestRendererWork(owner!, {
      key: {},
      kind: 'resource',
      run: () => calls.push('third'),
    });
    recordRootRender = true;

    driver.flush(2);

    expect(calls).toEqual([
      'latest first',
      'second',
      'third',
      'root render',
    ]);
    expect(driver.pendingHostFrames).toBe(0);
    controller.dispose();
  });

  it('orders coalesced renderer work around its Canvas render in one realm frame', () => {
    const calls: string[] = [];
    const frames: PibblInternalFrame[] = [];
    const rendererValue = signal(0);
    const canvasValue = signal(0);
    const plannedValue = computed(() => {
      const value = canvasValue.get();
      if (value > 0) calls.push('plan');
      return value;
    });
    const resourceKey = {};
    const drawKey = {};
    const composeKey = {};
    let owner: PibblInternalRenderOwner | undefined;
    let consumer: PibblInternalSignalConsumer | undefined;

    const scheduleRenderer = () => {
      pibblInternalRequestRendererWork(owner!, {
        key: resourceKey,
        kind: 'resource',
        run: () => calls.push('stale resource'),
      });
      pibblInternalRequestRendererWork(owner!, {
        key: resourceKey,
        kind: 'resource',
        run: frame => {
          calls.push('fake resource');
          frames.push(frame);
          expect(consumer!.collect(() => rendererValue.get())).toBe(1);
          consumer!.markClean();
        },
      });
      pibblInternalRequestRendererWork(owner!, {
        key: drawKey,
        kind: 'draw',
        run: frame => {
          calls.push('fake draw');
          frames.push(frame);
        },
      });
      pibblInternalRequestRendererWork(owner!, {
        key: composeKey,
        kind: 'compose',
        run: frame => {
          calls.push('fake compose');
          frames.push(frame);
        },
      });
      pibblInternalQueueComplete(owner!, frame => {
        calls.push('complete');
        frames.push(frame);
      });
    };

    const Root = (_props: {}) => {
      owner ??= pibblInternalCurrentRenderOwner();
      consumer ??= pibblInternalCreateSignalConsumer({
        owner,
        debugName: 'fake retained renderer resource',
        invalidate: scheduleRenderer,
      });
      if (plannedValue.get() > 0) {
        calls.push('root render');
        frames.push(pibblInternalCurrentFrame());
      }
      if (rendererValue.get() === 0) {
        consumer.collect(() => rendererValue.get());
        consumer.markClean();
      }
    };

    const controller = pibbl(createCanvas(), createElement(Root, {}));
    expect(() => pibblInternalCurrentFrame()).toThrow(/current Pibbl frame/i);
    expect(() => pibblInternalCurrentRenderOwner()).toThrow(/component evaluation/i);
    driver.flush(5);
    calls.length = 0;

    signalObserversForTest(getSignalNode(rendererValue)).add(() => calls.push('commit'));
    let releaseAdvance = () => {};
    const advance: PibblAdvanceParticipant = (snapshot, batch) => {
      calls.push('advance');
      expect(pibblInternalCurrentFrame()).toBe(snapshot);
      batch.stage(rendererValue, 1, advance);
      batch.stage(canvasValue, 1, advance);
      releaseAdvance();
    };
    releaseAdvance = registerAdvanceParticipant(advance);

    expect(driver.pendingHostFrames).toBe(1);
    driver.flush(25);

    expect(calls).toEqual([
      'advance',
      'commit',
      'plan',
      'fake resource',
      'fake draw',
      'root render',
      'fake compose',
      'complete',
    ]);
    expect(frames).toHaveLength(5);
    expect(frames.every(frame => frame === frames[0])).toBe(true);
    expect(frames[0]).toMatchObject({ logicalTime: 25 });
    expect(frames[0].frameId).toBeGreaterThan(0);
    expect(Object.isFrozen(frames[0])).toBe(true);
    expect(driver.pendingHostFrames).toBe(0);
    expect(() => pibblInternalCurrentFrame()).toThrow(/current Pibbl frame/i);
    controller.dispose();
  });

  it('defers friend work and completion requested during Advance without losing either', () => {
    const calls: string[] = [];
    const workKey = {};
    let owner: PibblInternalRenderOwner | undefined;
    let recordRootRender = false;
    const controller = pibbl(createCanvas(), createElement(() => {
      owner ??= pibblInternalCurrentRenderOwner();
      if (recordRootRender) calls.push('root render');
    }, {}));
    driver.flush(1);
    recordRootRender = true;

    let release = () => {};
    release = registerAdvanceParticipant(() => {
      release();
      pibblInternalRequestRendererWork(owner!, {
        key: workKey,
        kind: 'draw',
        run: () => calls.push('friend draw'),
      });
      pibblInternalQueueComplete(owner!, () => calls.push('friend complete'));
    });
    driver.flush(2);

    expect(calls).toEqual([]);
    expect(driver.pendingHostFrames).toBe(1);

    driver.flush(3);
    expect(calls).toEqual(['friend draw', 'root render', 'friend complete']);
    expect(driver.pendingHostFrames).toBe(0);
    controller.dispose();
  });

  it('keeps pre-Begin friend work eligible when Advance defers separate work for the same owner', () => {
    const calls: string[] = [];
    const currentKey = {};
    const deferredKey = {};
    let owner: PibblInternalRenderOwner | undefined;
    let recordRootRender = false;
    const controller = pibbl(createCanvas(), createElement(() => {
      owner ??= pibblInternalCurrentRenderOwner();
      if (recordRootRender) calls.push('root render');
    }, {}));
    driver.flush(1);
    recordRootRender = true;

    pibblInternalRequestRendererWork(owner!, {
      key: currentKey,
      kind: 'draw',
      run: () => calls.push('current draw'),
    });
    pibblInternalQueueComplete(owner!, () => calls.push('current complete'));
    let release = () => {};
    release = registerAdvanceParticipant(() => {
      release();
      pibblInternalRequestRendererWork(owner!, {
        key: deferredKey,
        kind: 'draw',
        run: () => calls.push('deferred draw'),
      });
      pibblInternalQueueComplete(owner!, () => calls.push('deferred complete'));
    });

    driver.flush(2);
    expect(calls).toEqual([
      'current draw',
      'root render',
      'current complete',
    ]);
    expect(driver.pendingHostFrames).toBe(1);

    calls.length = 0;
    driver.flush(3);
    expect(calls).toEqual([
      'deferred draw',
      'root render',
      'deferred complete',
    ]);
    expect(driver.pendingHostFrames).toBe(0);
    controller.dispose();
  });

  it('keeps same-key pre-Begin work current while Advance coalesces the next frame separately', () => {
    const calls: string[] = [];
    const workKey = {};
    let owner: PibblInternalRenderOwner | undefined;
    let recordRootRender = false;
    const canvas = createCanvas();
    const controller = pibbl(canvas, createElement(() => {
      owner ??= pibblInternalCurrentRenderOwner();
      if (recordRootRender) calls.push('root render');
    }, {}));
    driver.flush(1);
    recordRootRender = true;
    const instance = getPibblInstance(canvas);
    const completedBeforeWork = instance.completedRenderRevision;

    pibblInternalRequestRendererWork(owner!, {
      key: workKey,
      kind: 'draw',
      run: () => calls.push('current draw'),
    });
    pibblInternalQueueComplete(owner!, () => calls.push('current complete'));
    let release = () => {};
    release = registerAdvanceParticipant(() => {
      release();
      pibblInternalRequestRendererWork(owner!, {
        key: workKey,
        kind: 'draw',
        run: () => calls.push('next draw'),
      });
      pibblInternalQueueComplete(owner!, () => calls.push('next complete'));
    });

    driver.flush(2);
    expect(calls).toEqual([
      'current draw',
      'root render',
      'current complete',
    ]);
    expect(instance.requestedRenderRevision).toBeGreaterThan(
      instance.completedRenderRevision,
    );
    expect(instance.completedRenderRevision).toBeGreaterThan(
      completedBeforeWork,
    );
    expect(driver.pendingHostFrames).toBe(1);

    calls.length = 0;
    driver.flush(3);
    expect(calls).toEqual(['next draw', 'root render', 'next complete']);
    expect(instance.completedRenderRevision).toBe(
      instance.requestedRenderRevision,
    );
    expect(driver.pendingHostFrames).toBe(0);
    controller.dispose();
  });

  it('retains Commit and Plan friend work after an earlier Advance request for the same owner', () => {
    const calls: string[] = [];
    const commitSource = signal(0);
    const planSource = signal(0);
    const plannedValue = computed(() => planSource.get() + 1);
    const keys = {
      advance: {},
      commit: {},
      plan: {},
    };
    let owner: PibblInternalRenderOwner | undefined;
    let consumer: PibblInternalSignalConsumer | undefined;
    let recordRootRender = false;
    const canvas = createCanvas();
    const controller = pibbl(canvas, createElement(() => {
      owner ??= pibblInternalCurrentRenderOwner();
      consumer ??= pibblInternalCreateSignalConsumer({
        owner,
        invalidate: () => {
          pibblInternalRequestRendererWork(owner!, {
            key: keys.plan,
            kind: 'draw',
            run: () => calls.push('plan draw'),
          });
          pibblInternalQueueComplete(owner!, () => calls.push('plan complete'));
        },
      });
      consumer.collect(() => plannedValue.get());
      consumer.markClean();
      if (recordRootRender) calls.push('root render');
    }, {}));
    driver.flush(1);
    recordRootRender = true;
    const instance = getPibblInstance(canvas);
    const completedBeforeWork = instance.completedRenderRevision;
    const commitObserver = () => {
      pibblInternalRequestRendererWork(owner!, {
        key: keys.commit,
        kind: 'draw',
        run: () => calls.push('commit draw'),
      });
      pibblInternalQueueComplete(owner!, () => calls.push('commit complete'));
    };
    signalObserversForTest(getSignalNode(commitSource)).add(commitObserver);
    expect(driver.pendingHostFrames).toBe(0);

    let release = () => {};
    const participant: PibblAdvanceParticipant = (_snapshot, batch) => {
      release();
      pibblInternalRequestRendererWork(owner!, {
        key: keys.advance,
        kind: 'draw',
        run: () => calls.push('advance draw'),
      });
      pibblInternalQueueComplete(owner!, () => calls.push('advance complete'));
      batch.stage(commitSource, 1, participant);
      batch.stage(planSource, 1, participant);
    };
    release = registerAdvanceParticipant(participant);

    driver.flush(2);
    expect(calls).toEqual([
      'commit draw',
      'plan draw',
      'root render',
      'commit complete',
      'plan complete',
    ]);
    expect(instance.completedRenderRevision).toBe(completedBeforeWork);
    expect(instance.requestedRenderRevision).toBeGreaterThan(
      instance.completedRenderRevision,
    );
    expect(driver.pendingHostFrames).toBe(1);

    calls.length = 0;
    driver.flush(3);
    expect(calls).toEqual([
      'advance draw',
      'root render',
      'advance complete',
    ]);
    expect(instance.completedRenderRevision).toBe(
      instance.requestedRenderRevision,
    );
    expect(driver.pendingHostFrames).toBe(0);

    signalObserversForTest(getSignalNode(commitSource)).delete(commitObserver);
    controller.dispose();
  });

  it('keeps deferred nested friend revisions incomplete during an admitted parent render', () => {
    const calls: string[] = [];
    const parentSource = signal(0);
    const drawImage = vi.spyOn(CanvasRenderingContext2D.prototype, 'drawImage');
    let owner: PibblInternalRenderOwner | undefined;
    let recordChildRender = false;
    const Child = ({ value: _value }: { value: number }) => {
      owner ??= pibblInternalCurrentRenderOwner();
      if (recordChildRender) calls.push('child render');
    };
    const Root = (_props: {}) => createElement(Layer, {
      style: { width: 20, height: 20 },
      children: createElement(Child, { value: parentSource.get() }),
    });
    const controller = pibbl(createCanvas(), createElement(Root, {}));
    driver.flush(1);
    const layerCanvas = drawImage.mock.calls
      .map(([source]) => source)
      .find(source => source instanceof OffscreenCanvas) as OffscreenCanvas;
    const child = getPibblInstance(layerCanvas);
    const completedBeforeWork = child.completedRenderRevision;
    recordChildRender = true;

    let release = () => {};
    const participant: PibblAdvanceParticipant = (_snapshot, batch) => {
      release();
      pibblInternalRequestRendererWork(owner!, {
        key: {},
        kind: 'draw',
        run: () => calls.push('friend draw'),
      });
      pibblInternalQueueComplete(owner!, () => calls.push('friend complete'));
      batch.stage(parentSource, 1, participant);
    };
    release = registerAdvanceParticipant(participant);

    driver.flush(2);
    expect(calls).toEqual(['child render']);
    expect(child.completedRenderRevision).toBe(completedBeforeWork);
    expect(child.requestedRenderRevision).toBeGreaterThan(
      child.completedRenderRevision,
    );
    expect(driver.pendingHostFrames).toBe(1);

    calls.length = 0;
    driver.flush(3);
    expect(calls).toEqual([
      'friend draw',
      'child render',
      'friend complete',
    ]);
    expect(child.completedRenderRevision).toBe(
      child.requestedRenderRevision,
    );
    expect(driver.pendingHostFrames).toBe(0);
    controller.dispose();
  });

  it('replaces signal dependencies only after successful collection', () => {
    const first = signal(0);
    const second = signal(0);
    let invalidations = 0;
    let consumer: PibblInternalSignalConsumer | undefined;

    const Root = (_props: {}) => {
      consumer ??= pibblInternalCreateSignalConsumer({
        owner: pibblInternalCurrentRenderOwner(),
        invalidate: () => invalidations++,
      });
      consumer.collect(() => first.get());
      consumer.markClean();
    };

    const controller = pibbl(createCanvas(), createElement(Root, {}));
    driver.flush(1);

    expect(() => consumer!.collect(() => {
      second.get();
      throw new Error('collection failed');
    })).toThrow('collection failed');
    consumer!.markClean();
    second.set(1);
    expect(invalidations).toBe(0);
    first.set(1);
    expect(invalidations).toBe(1);
    controller.dispose();
  });

  it('runs nested renderer work before the parent Canvas composite', () => {
    const calls: string[] = [];
    const rendererValue = signal(0);
    const resourceKey = {};
    const drawKey = {};
    let owner: PibblInternalRenderOwner | undefined;
    let consumer: PibblInternalSignalConsumer | undefined;
    const originalDrawImage = CanvasRenderingContext2D.prototype.drawImage;
    vi.spyOn(CanvasRenderingContext2D.prototype, 'drawImage')
      .mockImplementation(function (this: CanvasRenderingContext2D, ...args) {
        if (args[0] instanceof OffscreenCanvas) {
          calls.push('parent composite');
        }
        return Reflect.apply(originalDrawImage, this, args);
      });

    const FakeRenderer = (_props: {}) => {
      owner ??= pibblInternalCurrentRenderOwner();
      consumer ??= pibblInternalCreateSignalConsumer({
        owner,
        invalidate: () => {
          pibblInternalRequestRendererWork(owner!, {
            key: resourceKey,
            kind: 'resource',
            run: () => calls.push('fake resource'),
          });
          pibblInternalRequestRendererWork(owner!, {
            key: drawKey,
            kind: 'draw',
            run: () => calls.push('fake draw'),
          });
        },
      });
      consumer.collect(() => rendererValue.get());
      consumer.markClean();
    };
    const Root = (_props: {}) => createElement(Layer, {
      style: { width: 20, height: 20 },
      children: createElement(FakeRenderer, {}),
    });

    const controller = pibbl(createCanvas(), createElement(Root, {}));
    driver.flush(1);
    calls.length = 0;

    rendererValue.set(1);
    driver.flush(2);

    expect(calls).toEqual([
      'fake resource',
      'fake draw',
      'parent composite',
    ]);
    controller.dispose();
  });

  it('disposal removes consumer edges, pending work, and completions before Begin', () => {
    const calls: string[] = [];
    const rendererValue = signal(0);
    const workKey = {};
    let owner: PibblInternalRenderOwner | undefined;
    let consumer: PibblInternalSignalConsumer | undefined;

    const Root = (_props: {}) => {
      owner ??= pibblInternalCurrentRenderOwner();
      consumer ??= pibblInternalCreateSignalConsumer({
        owner,
        invalidate: () => {
          calls.push('invalidate');
          pibblInternalRequestRendererWork(owner!, {
            key: workKey,
            kind: 'draw',
            run: () => calls.push('draw'),
          });
          pibblInternalQueueComplete(owner!, () => calls.push('complete'));
        },
      });
      consumer.collect(() => rendererValue.get());
      consumer.markClean();
    };

    const controller = pibbl(createCanvas(), createElement(Root, {}));
    driver.flush(1);
    rendererValue.set(1);
    expect(calls).toEqual(['invalidate']);
    expect(driver.pendingHostFrames).toBe(1);

    controller.dispose();
    expect(driver.pendingHostFrames).toBe(0);
    rendererValue.set(2);
    expect(calls).toEqual(['invalidate']);

    const fallback = pibbl(createCanvas(), createElement(() => undefined, {}));
    driver.flush(2);
    expect(calls).toEqual(['invalidate']);
    fallback.dispose();
  });

  it('releases recursive computed leases when a friend consumer owner is disposed', () => {
    const baseline = signalGraphSnapshot();
    const source = signal(1);
    const inner = computed(() => source.get() + 1);
    const outer = computed(() => inner.get() + 1);
    let consumer: PibblInternalSignalConsumer | undefined;
    const controller = pibbl(createCanvas(), createElement(() => {
      consumer ??= pibblInternalCreateSignalConsumer({
        owner: pibblInternalCurrentRenderOwner(),
        invalidate: () => {},
      });
      consumer.collect(() => outer.get());
      consumer.markClean();
    }, {}));
    driver.flush(1);

    expect(signalGraphSnapshot().computedSourceEdges).toBe(
      baseline.computedSourceEdges + 2,
    );
    expect(getSignalNode(source).observerCount).toBe(1);
    expect(getSignalNode(inner).observerCount).toBe(1);

    controller.dispose();

    expect(signalGraphSnapshot()).toMatchObject({
      computedSourceEdges: baseline.computedSourceEdges,
      createdComputedSourceEdges: baseline.createdComputedSourceEdges + 2,
      releasedComputedSourceEdges: baseline.releasedComputedSourceEdges + 2,
    });
    expect(getSignalNode(source).observerCount).toBe(0);
    expect(getSignalNode(inner).observerCount).toBe(0);
  });
});

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);
  return canvas;
}
