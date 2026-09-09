import { describe, expect, it } from 'vitest';
import { computed, signal } from '../../index';
import { flushPendingComputedValidations } from './graph';
import {
  collectSignalReads,
  createSignalRenderConsumer,
  disposeSignalRenderConsumer,
} from './render-consumer';

describe('signal render consumers', () => {
  it('replaces dynamic dependencies and releases them on disposal', () => {
    const chooseLeft = signal(true);
    const left = signal(1);
    const right = signal(20);
    const selector = computed(() => chooseLeft.get() ? left.get() : right.get());
    let invalidations = 0;
    const consumer = createSignalRenderConsumer({
      debugName: 'test consumer',
      invalidate: () => invalidations++,
    });

    expect(collectSignalReads(consumer, () => selector.get())).toBe(1);
    consumer.markClean();

    chooseLeft.set(false);
    flushPendingComputedValidations();
    expect(invalidations).toBe(1);

    invalidations = 0;
    expect(collectSignalReads(consumer, () => selector.get())).toBe(20);
    consumer.markClean();

    left.set(3);
    flushPendingComputedValidations();
    expect(invalidations).toBe(0);

    right.set(21);
    flushPendingComputedValidations();
    expect(invalidations).toBe(1);

    invalidations = 0;
    disposeSignalRenderConsumer(consumer);
    disposeSignalRenderConsumer(consumer);
    left.set(4);
    right.set(22);
    flushPendingComputedValidations();

    expect(invalidations).toBe(0);
    expect(consumer.releaseCount).toBe(1);
  });

  it('retains successful dependencies when a later collection fails', () => {
    const left = signal(2);
    const right = signal(20);
    let invalidations = 0;
    const consumer = createSignalRenderConsumer({
      debugName: 'test consumer',
      invalidate: () => invalidations++,
    });

    collectSignalReads(consumer, () => right.get());
    consumer.markClean();

    expect(() =>
      collectSignalReads(consumer, () => {
        left.get();
        throw new Error('failed render');
      }),
    ).toThrow('failed render');

    left.set(3);
    flushPendingComputedValidations();
    expect(invalidations).toBe(0);

    right.set(21);
    flushPendingComputedValidations();
    expect(invalidations).toBe(1);
  });
});
