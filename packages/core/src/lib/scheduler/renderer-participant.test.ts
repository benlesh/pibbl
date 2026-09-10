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
import { getSignalNode } from '../signals/graph';
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

    getSignalNode(rendererValue).observers.add(() => calls.push('commit'));
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
});

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);
  return canvas;
}
