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
import { clearSharedState } from '../global-state';
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
    expect(frames[0]).toMatchObject({ frameId: 2, logicalTime: 25 });
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
