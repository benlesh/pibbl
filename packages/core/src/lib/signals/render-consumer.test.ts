import { describe, expect, it } from 'vitest';
import { computed, signal } from '../../index';
import { flushPendingComputedValidations, getSignalNode } from './graph';
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

  it('does not retain reads collected after disposal during an active render', () => {
    const retained = signal(1);
    const abandoned = signal(2);
    let invalidations = 0;
    const consumer = createSignalRenderConsumer({
      debugName: 'test consumer',
      invalidate: () => invalidations++,
    });

    collectSignalReads(consumer, () => retained.get());
    consumer.markClean();
    collectSignalReads(consumer, () => {
      abandoned.get();
      disposeSignalRenderConsumer(consumer);
    });

    expect(getSignalNode(retained).observers.size).toBe(0);
    expect(getSignalNode(abandoned).observers.size).toBe(0);
    retained.set(3);
    abandoned.set(4);

    expect(invalidations).toBe(0);
    expect(consumer.releaseCount).toBe(1);
  });

  it('keeps disposed nested consumer reads out of the active parent collection', () => {
    const parentSource = signal(1);
    const childSource = signal(2);
    let parentInvalidations = 0;
    const parent = createSignalRenderConsumer({
      debugName: 'parent consumer',
      invalidate: () => parentInvalidations++,
    });
    const child = createSignalRenderConsumer({
      debugName: 'child consumer',
      invalidate: () => { throw new Error('disposed child was invalidated'); },
    });
    disposeSignalRenderConsumer(child);

    collectSignalReads(parent, () => {
      collectSignalReads(child, () => childSource.get());
      return parentSource.get();
    });
    parent.markClean();

    childSource.set(3);
    expect(parentInvalidations).toBe(0);

    parentSource.set(4);
    expect(parentInvalidations).toBe(1);
  });

  it('calls its owner once while multiple direct dependencies leave it dirty', () => {
    const left = signal(1);
    const right = signal(2);
    let invalidations = 0;
    const consumer = createSignalRenderConsumer({
      debugName: 'test consumer',
      invalidate: () => invalidations++,
    });

    collectSignalReads(consumer, () => left.get() + right.get());
    consumer.markClean();

    left.set(3);
    right.set(4);
    expect(invalidations).toBe(1);

    consumer.markClean();
    right.set(5);
    expect(invalidations).toBe(2);
  });
});
