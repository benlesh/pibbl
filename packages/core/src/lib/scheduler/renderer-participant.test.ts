import { signalObserversForTest } from "../../../test/support/signal-observer";
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  computed,
  crc,
  createElement,
  Layer,
  signal,
} from '@crc/core';
import {
  crcInternalCreateSignalConsumer,
  crcInternalCurrentFrame,
  crcInternalCurrentRenderOwner,
  crcInternalQueueComplete,
  crcInternalRequestRendererWork,
  type CRCInternalFrame,
  type CRCInternalRenderOwner,
  type CRCInternalSignalConsumer,
} from '@crc/core/internal';
import { clearSharedState, getCRCInstance } from '../global-state';
import { getSignalNode, signalGraphSnapshot } from '../signals/graph';
import {
  registerAdvanceParticipant,
} from './realm-scheduler';
import type { CRCAdvanceParticipant } from './types';
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

describe('@crc/core/internal renderer participants', () => {
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
      let owner: CRCInternalRenderOwner | undefined;
      let recordRootRender = false;
      let failedOnce = false;
      const canvas = createCanvas();
      const Root = (_props: {}) => {
        owner ??= crcInternalCurrentRenderOwner();
        if (recordRootRender) calls.push('root render');
      };
      const controller = crc(canvas, createElement(Root, {}));
      driver.flush(1);
      const instance = getCRCInstance(canvas);
      const completedBeforeWork = instance.completedRenderRevision;

      for (const kind of ['resource', 'draw', 'compose'] as const) {
        crcInternalRequestRendererWork(owner!, {
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
      const independent = crc(createCanvas(), createElement(() => {
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
    let owner: CRCInternalRenderOwner | undefined;
    let recordRootRender = false;
    const canvas = createCanvas();
    const Root = (_props: {}) => {
      owner ??= crcInternalCurrentRenderOwner();
      if (recordRootRender) calls.push('root render');
    };
    const controller = crc(canvas, createElement(Root, {}));
    driver.flush(1);
    const completedBeforeWork = getCRCInstance(canvas).completedRenderRevision;

    crcInternalRequestRendererWork(owner!, {
      key: {},
      kind: 'resource',
      run: () => calls.push('resource'),
    });
    crcInternalRequestRendererWork(owner!, {
      key: {},
      kind: 'draw',
      run: () => {
        calls.push('draw:first');
        throw firstFailure;
      },
    });
    crcInternalRequestRendererWork(owner!, {
      key: {},
      kind: 'draw',
      run: () => calls.push('draw:second'),
    });
    crcInternalRequestRendererWork(owner!, {
      key: {},
      kind: 'draw',
      run: () => {
        calls.push('draw:third');
        throw secondFailure;
      },
    });
    crcInternalRequestRendererWork(owner!, {
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
    expect(getCRCInstance(canvas).completedRenderRevision)
      .toBe(completedBeforeWork);
    expect(driver.pendingHostFrames).toBe(1);
    controller.dispose();
  });

  it('restores unexecuted later-owner work in the same root without overwriting newer keyed work', () => {
    const calls: string[] = [];
    const failure = new Error('nested renderer failed');
    const parentKey = {};
    const retainedParentKey = {};
    let parentOwner: CRCInternalRenderOwner | undefined;
    let childOwner: CRCInternalRenderOwner | undefined;
    let failOnce = true;
    let recordRenders = false;

    const Child = (_props: {}) => {
      childOwner ??= crcInternalCurrentRenderOwner();
      if (recordRenders) calls.push('child render');
    };
    const Root = (_props: {}) => {
      parentOwner ??= crcInternalCurrentRenderOwner();
      if (recordRenders) calls.push('parent render');
      return createElement(Layer, {
        style: { width: 20, height: 20 },
        children: createElement(Child, {}),
      });
    };

    const controller = crc(createCanvas(), createElement(Root, {}));
    driver.flush(1);
    recordRenders = true;

    crcInternalRequestRendererWork(parentOwner!, {
      key: parentKey,
      kind: 'draw',
      run: () => calls.push('stale parent work'),
    });
    crcInternalRequestRendererWork(parentOwner!, {
      key: retainedParentKey,
      kind: 'draw',
      run: () => calls.push('retained parent work'),
    });
    crcInternalRequestRendererWork(childOwner!, {
      key: {},
      kind: 'resource',
      run: () => {
        calls.push('child work');
        if (failOnce) {
          failOnce = false;
          crcInternalRequestRendererWork(parentOwner!, {
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
    let failedOwner: CRCInternalRenderOwner | undefined;
    let successfulOwner: CRCInternalRenderOwner | undefined;
    let failOnce = true;
    let recordRenders = false;

    const FailingRoot = (_props: {}) => {
      failedOwner ??= crcInternalCurrentRenderOwner();
      if (recordRenders) calls.push('failed root render');
    };
    const SuccessfulRoot = (_props: {}) => {
      successfulOwner ??= crcInternalCurrentRenderOwner();
      if (recordRenders) calls.push('successful root render');
    };
    const failedController = crc(
      createCanvas(),
      createElement(FailingRoot, {}),
    );
    const successfulController = crc(
      createCanvas(),
      createElement(SuccessfulRoot, {}),
    );
    driver.flush(1);
    recordRenders = true;

    crcInternalRequestRendererWork(failedOwner!, {
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
    crcInternalQueueComplete(failedOwner!, () => {
      calls.push('failed owner complete');
    });
    crcInternalRequestRendererWork(successfulOwner!, {
      key: {},
      kind: 'draw',
      run: () => calls.push('successful owner work'),
    });
    crcInternalQueueComplete(successfulOwner!, () => {
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
    const consumers: CRCInternalSignalConsumer[] = [];
    const sharedKey = {};
    let owner: CRCInternalRenderOwner | undefined;
    let recordRootRender = false;
    const Root = (_props: {}) => {
      owner ??= crcInternalCurrentRenderOwner();
      if (consumers.length === 0) {
        for (const [index] of sources.entries()) {
          consumers.push(crcInternalCreateSignalConsumer({
            owner,
            invalidate: () => {
              calls.push(`invalidate:${index + 1}`);
              crcInternalRequestRendererWork(owner!, {
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
    const controller = crc(createCanvas(), createElement(Root, {}));
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
    let owner: CRCInternalRenderOwner | undefined;
    let recordRootRender = false;
    const Root = (_props: {}) => {
      owner ??= crcInternalCurrentRenderOwner();
      if (recordRootRender) calls.push('root render');
    };
    const controller = crc(createCanvas(), createElement(Root, {}));
    driver.flush(1);

    crcInternalRequestRendererWork(owner!, {
      key: firstKey,
      kind: 'resource',
      run: () => calls.push('stale first'),
    });
    crcInternalRequestRendererWork(owner!, {
      key: {},
      kind: 'resource',
      run: () => calls.push('second'),
    });
    crcInternalRequestRendererWork(owner!, {
      key: firstKey,
      kind: 'resource',
      run: () => calls.push('latest first'),
    });
    crcInternalRequestRendererWork(owner!, {
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
    const frames: CRCInternalFrame[] = [];
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
    let owner: CRCInternalRenderOwner | undefined;
    let consumer: CRCInternalSignalConsumer | undefined;

    const scheduleRenderer = () => {
      crcInternalRequestRendererWork(owner!, {
        key: resourceKey,
        kind: 'resource',
        run: () => calls.push('stale resource'),
      });
      crcInternalRequestRendererWork(owner!, {
        key: resourceKey,
        kind: 'resource',
        run: frame => {
          calls.push('fake resource');
          frames.push(frame);
          expect(consumer!.collect(() => rendererValue.get())).toBe(1);
          consumer!.markClean();
        },
      });
      crcInternalRequestRendererWork(owner!, {
        key: drawKey,
        kind: 'draw',
        run: frame => {
          calls.push('fake draw');
          frames.push(frame);
        },
      });
      crcInternalRequestRendererWork(owner!, {
        key: composeKey,
        kind: 'compose',
        run: frame => {
          calls.push('fake compose');
          frames.push(frame);
        },
      });
      crcInternalQueueComplete(owner!, frame => {
        calls.push('complete');
        frames.push(frame);
      });
    };

    const Root = (_props: {}) => {
      owner ??= crcInternalCurrentRenderOwner();
      consumer ??= crcInternalCreateSignalConsumer({
        owner,
        debugName: 'fake retained renderer resource',
        invalidate: scheduleRenderer,
      });
      if (plannedValue.get() > 0) {
        calls.push('root render');
        frames.push(crcInternalCurrentFrame());
      }
      if (rendererValue.get() === 0) {
        consumer.collect(() => rendererValue.get());
        consumer.markClean();
      }
    };

    const controller = crc(createCanvas(), createElement(Root, {}));
    expect(() => crcInternalCurrentFrame()).toThrow(/current CRC frame/i);
    expect(() => crcInternalCurrentRenderOwner()).toThrow(/component evaluation/i);
    driver.flush(5);
    calls.length = 0;

    signalObserversForTest(getSignalNode(rendererValue)).add(() => calls.push('commit'));
    let releaseAdvance = () => {};
    const advance: CRCAdvanceParticipant = (snapshot, batch) => {
      calls.push('advance');
      expect(crcInternalCurrentFrame()).toBe(snapshot);
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
    expect(() => crcInternalCurrentFrame()).toThrow(/current CRC frame/i);
    controller.dispose();
  });

  it('defers friend work and completion requested during Advance without losing either', () => {
    const calls: string[] = [];
    const workKey = {};
    let owner: CRCInternalRenderOwner | undefined;
    let recordRootRender = false;
    const controller = crc(createCanvas(), createElement(() => {
      owner ??= crcInternalCurrentRenderOwner();
      if (recordRootRender) calls.push('root render');
    }, {}));
    driver.flush(1);
    recordRootRender = true;

    let release = () => {};
    release = registerAdvanceParticipant(() => {
      release();
      crcInternalRequestRendererWork(owner!, {
        key: workKey,
        kind: 'draw',
        run: () => calls.push('friend draw'),
      });
      crcInternalQueueComplete(owner!, () => calls.push('friend complete'));
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
    let owner: CRCInternalRenderOwner | undefined;
    let recordRootRender = false;
    const controller = crc(createCanvas(), createElement(() => {
      owner ??= crcInternalCurrentRenderOwner();
      if (recordRootRender) calls.push('root render');
    }, {}));
    driver.flush(1);
    recordRootRender = true;

    crcInternalRequestRendererWork(owner!, {
      key: currentKey,
      kind: 'draw',
      run: () => calls.push('current draw'),
    });
    crcInternalQueueComplete(owner!, () => calls.push('current complete'));
    let release = () => {};
    release = registerAdvanceParticipant(() => {
      release();
      crcInternalRequestRendererWork(owner!, {
        key: deferredKey,
        kind: 'draw',
        run: () => calls.push('deferred draw'),
      });
      crcInternalQueueComplete(owner!, () => calls.push('deferred complete'));
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
    let owner: CRCInternalRenderOwner | undefined;
    let recordRootRender = false;
    const canvas = createCanvas();
    const controller = crc(canvas, createElement(() => {
      owner ??= crcInternalCurrentRenderOwner();
      if (recordRootRender) calls.push('root render');
    }, {}));
    driver.flush(1);
    recordRootRender = true;
    const instance = getCRCInstance(canvas);
    const completedBeforeWork = instance.completedRenderRevision;

    crcInternalRequestRendererWork(owner!, {
      key: workKey,
      kind: 'draw',
      run: () => calls.push('current draw'),
    });
    crcInternalQueueComplete(owner!, () => calls.push('current complete'));
    let release = () => {};
    release = registerAdvanceParticipant(() => {
      release();
      crcInternalRequestRendererWork(owner!, {
        key: workKey,
        kind: 'draw',
        run: () => calls.push('next draw'),
      });
      crcInternalQueueComplete(owner!, () => calls.push('next complete'));
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
    let owner: CRCInternalRenderOwner | undefined;
    let consumer: CRCInternalSignalConsumer | undefined;
    let recordRootRender = false;
    const canvas = createCanvas();
    const controller = crc(canvas, createElement(() => {
      owner ??= crcInternalCurrentRenderOwner();
      consumer ??= crcInternalCreateSignalConsumer({
        owner,
        invalidate: () => {
          crcInternalRequestRendererWork(owner!, {
            key: keys.plan,
            kind: 'draw',
            run: () => calls.push('plan draw'),
          });
          crcInternalQueueComplete(owner!, () => calls.push('plan complete'));
        },
      });
      consumer.collect(() => plannedValue.get());
      consumer.markClean();
      if (recordRootRender) calls.push('root render');
    }, {}));
    driver.flush(1);
    recordRootRender = true;
    const instance = getCRCInstance(canvas);
    const completedBeforeWork = instance.completedRenderRevision;
    const commitObserver = () => {
      crcInternalRequestRendererWork(owner!, {
        key: keys.commit,
        kind: 'draw',
        run: () => calls.push('commit draw'),
      });
      crcInternalQueueComplete(owner!, () => calls.push('commit complete'));
    };
    signalObserversForTest(getSignalNode(commitSource)).add(commitObserver);
    expect(driver.pendingHostFrames).toBe(0);

    let release = () => {};
    const participant: CRCAdvanceParticipant = (_snapshot, batch) => {
      release();
      crcInternalRequestRendererWork(owner!, {
        key: keys.advance,
        kind: 'draw',
        run: () => calls.push('advance draw'),
      });
      crcInternalQueueComplete(owner!, () => calls.push('advance complete'));
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
    let owner: CRCInternalRenderOwner | undefined;
    let recordChildRender = false;
    const Child = ({ value: _value }: { value: number }) => {
      owner ??= crcInternalCurrentRenderOwner();
      if (recordChildRender) calls.push('child render');
    };
    const Root = (_props: {}) => createElement(Layer, {
      style: { width: 20, height: 20 },
      children: createElement(Child, { value: parentSource.get() }),
    });
    const controller = crc(createCanvas(), createElement(Root, {}));
    driver.flush(1);
    const layerCanvas = drawImage.mock.calls
      .map(([source]) => source)
      .find(source => source instanceof OffscreenCanvas) as OffscreenCanvas;
    const child = getCRCInstance(layerCanvas);
    const completedBeforeWork = child.completedRenderRevision;
    recordChildRender = true;

    let release = () => {};
    const participant: CRCAdvanceParticipant = (_snapshot, batch) => {
      release();
      crcInternalRequestRendererWork(owner!, {
        key: {},
        kind: 'draw',
        run: () => calls.push('friend draw'),
      });
      crcInternalQueueComplete(owner!, () => calls.push('friend complete'));
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
    let consumer: CRCInternalSignalConsumer | undefined;

    const Root = (_props: {}) => {
      consumer ??= crcInternalCreateSignalConsumer({
        owner: crcInternalCurrentRenderOwner(),
        invalidate: () => invalidations++,
      });
      consumer.collect(() => first.get());
      consumer.markClean();
    };

    const controller = crc(createCanvas(), createElement(Root, {}));
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
    let owner: CRCInternalRenderOwner | undefined;
    let consumer: CRCInternalSignalConsumer | undefined;
    const originalDrawImage = CanvasRenderingContext2D.prototype.drawImage;
    vi.spyOn(CanvasRenderingContext2D.prototype, 'drawImage')
      .mockImplementation(function (this: CanvasRenderingContext2D, ...args) {
        if (args[0] instanceof OffscreenCanvas) {
          calls.push('parent composite');
        }
        return Reflect.apply(originalDrawImage, this, args);
      });

    const FakeRenderer = (_props: {}) => {
      owner ??= crcInternalCurrentRenderOwner();
      consumer ??= crcInternalCreateSignalConsumer({
        owner,
        invalidate: () => {
          crcInternalRequestRendererWork(owner!, {
            key: resourceKey,
            kind: 'resource',
            run: () => calls.push('fake resource'),
          });
          crcInternalRequestRendererWork(owner!, {
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

    const controller = crc(createCanvas(), createElement(Root, {}));
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
    let owner: CRCInternalRenderOwner | undefined;
    let consumer: CRCInternalSignalConsumer | undefined;

    const Root = (_props: {}) => {
      owner ??= crcInternalCurrentRenderOwner();
      consumer ??= crcInternalCreateSignalConsumer({
        owner,
        invalidate: () => {
          calls.push('invalidate');
          crcInternalRequestRendererWork(owner!, {
            key: workKey,
            kind: 'draw',
            run: () => calls.push('draw'),
          });
          crcInternalQueueComplete(owner!, () => calls.push('complete'));
        },
      });
      consumer.collect(() => rendererValue.get());
      consumer.markClean();
    };

    const controller = crc(createCanvas(), createElement(Root, {}));
    driver.flush(1);
    rendererValue.set(1);
    expect(calls).toEqual(['invalidate']);
    expect(driver.pendingHostFrames).toBe(1);

    controller.dispose();
    expect(driver.pendingHostFrames).toBe(0);
    rendererValue.set(2);
    expect(calls).toEqual(['invalidate']);

    const fallback = crc(createCanvas(), createElement(() => undefined, {}));
    driver.flush(2);
    expect(calls).toEqual(['invalidate']);
    fallback.dispose();
  });

  it('releases recursive computed leases when a friend consumer owner is disposed', () => {
    const baseline = signalGraphSnapshot();
    const source = signal(1);
    const inner = computed(() => source.get() + 1);
    const outer = computed(() => inner.get() + 1);
    let consumer: CRCInternalSignalConsumer | undefined;
    const controller = crc(createCanvas(), createElement(() => {
      consumer ??= crcInternalCreateSignalConsumer({
        owner: crcInternalCurrentRenderOwner(),
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
