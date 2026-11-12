import { describe, expect, it } from 'vitest';
import type { PibblRenderTransaction } from '../types.js';
import { signal, signalGraphSnapshot, withSignalDependencyRole } from '../signals/graph.js';
import { createSignalRenderConsumer, collectSignalReads, disposeSignalRenderConsumer } from '../signals/render-consumer.js';
import { AllocationDependency, adoptAllocationReceiver, invalidateAllocationReceiver, stageAllocationDependency, releaseAllocationReceiver } from './allocation-dependencies.js';

function transaction() {
  const callbacks: ((success: boolean) => void)[] = [];
  return { onFinish: (callback: (success: boolean) => void) => callbacks.push(callback), finish: (success: boolean) => callbacks.forEach(callback => callback(success)) } as unknown as PibblRenderTransaction & { finish(success: boolean): void };
}
describe('allocation receiver dependencies', () => {
  it('uses the existing combined-role receiver subscription without acquiring another signal lease', () => {
    const source = signal(10), owner = {}, receiver = {};
    const changes: number[] = [];
    const baseline = signalGraphSnapshot();
    const consumer = createSignalRenderConsumer({ debugName: 'allocation test', allocationReceiver: owner, invalidate: () => {} });
    collectSignalReads(consumer, () => {
      withSignalDependencyRole('layout', () => source.get());
      withSignalDependencyRole('paint', () => source.get());
    });
    consumer.markClean();
    const before = signalGraphSnapshot();
    const dependency = new AllocationDependency(roles => changes.push(roles));
    const tx = transaction();
    stageAllocationDependency(tx, receiver, dependency); adoptAllocationReceiver(tx, receiver, owner); tx.finish(true);
    expect(signalGraphSnapshot().rendererEdges).toBe(before.rendererEdges);
    source.set(11);
    expect(changes).toEqual([2]);
    disposeSignalRenderConsumer(consumer);
    expect(changes).toEqual([2, 1]);
    source.set(12);
    expect(changes).toEqual([2, 1]);
    dependency.dispose();
    expect(signalGraphSnapshot().rendererEdges).toBe(baseline.rendererEdges);
  });
  it('releases removed receivers and allows the numeric input to bind to a replacement', () => {
    const previous = {}, next = {};
    const changes: number[] = [];
    const dependency = new AllocationDependency(roles => changes.push(roles));
    dependency.adopt(previous); releaseAllocationReceiver(previous);
    invalidateAllocationReceiver(previous, 2);
    expect(changes).toEqual([1]);
    dependency.adopt(next); invalidateAllocationReceiver(next, 4);
    expect(changes).toEqual([1, 4]); dependency.dispose();
  });
  it('routes roles only to the numeric owners of the exact adopted receiver', () => {
    const receiver = {}, owner = {}, otherOwner = {};
    const changes: number[] = [];
    const dependency = new AllocationDependency(roles => changes.push(roles));
    const tx = transaction();
    stageAllocationDependency(tx, receiver, dependency);
    adoptAllocationReceiver(tx, receiver, owner);
    tx.finish(true);
    invalidateAllocationReceiver(otherOwner, 2);
    invalidateAllocationReceiver(owner, 8 | 16 | 32);
    expect(changes).toEqual([]);
    invalidateAllocationReceiver(owner, 2 | 4);
    expect(changes).toEqual([6]);
    dependency.dispose();
    invalidateAllocationReceiver(owner, 2);
    expect(changes).toEqual([6]);
  });
  it('keeps the previous adopted owner on failed replacement and releases it on success', () => {
    const previous = {}, next = {}, receiver = {};
    const changes: number[] = [];
    const dependency = new AllocationDependency(roles => changes.push(roles));
    const first = transaction();
    stageAllocationDependency(first, receiver, dependency); adoptAllocationReceiver(first, receiver, previous); first.finish(true);
    const aborted = transaction();
    stageAllocationDependency(aborted, receiver, dependency); adoptAllocationReceiver(aborted, receiver, next); aborted.finish(false);
    invalidateAllocationReceiver(previous, 2); invalidateAllocationReceiver(next, 4);
    expect(changes).toEqual([2]);
    const committed = transaction();
    stageAllocationDependency(committed, receiver, dependency); adoptAllocationReceiver(committed, receiver, next); committed.finish(true);
    invalidateAllocationReceiver(previous, 2); invalidateAllocationReceiver(next, 4);
    expect(changes).toEqual([2, 4]); dependency.dispose();
  });
  it('does not resurrect a disposed numeric dependency when its transaction finishes', () => {
    const receiver = {}, owner = {};
    const changes: number[] = [];
    const dependency = new AllocationDependency(roles => changes.push(roles));
    const tx = transaction();
    stageAllocationDependency(tx, receiver, dependency); adoptAllocationReceiver(tx, receiver, owner);
    dependency.dispose(); tx.finish(true); invalidateAllocationReceiver(owner, 2);
    expect(changes).toEqual([]);
  });
});
