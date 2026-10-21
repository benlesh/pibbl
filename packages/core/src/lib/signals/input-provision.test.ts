import { describe, expect, it } from 'vitest';
import type { PibblRenderTransaction } from '../types.js';
import {
  disposeSignalRenderConsumer,
  collectComponentSignalReads,
  type ComponentSignalRenderOwner,
} from './render-consumer.js';
import { batch, computed, flushPendingComputedValidations, signal, signalGraphSnapshot, withSignalDependencyRole } from './graph.js';
import {
  adoptReceiverInputProvision,
  withReceiverInputProvision,
} from './input-provision.js';

describe('receiver input provisions', () => {
  it('adopts deduplicated prepass reads into the receiver generation', () => {
    const source = signal(1);
    const receiver = {};
    const transaction = testTransaction();
    const owner: ComponentSignalRenderOwner = { signalConsumer: undefined };
    const baseline = signalGraphSnapshot();

    withReceiverInputProvision(transaction, receiver, () => {
      source.get();
      source.get();
    });
    expect(signalGraphSnapshot().receiverInputProvisions)
      .toBe(baseline.receiverInputProvisions + 1);

    collectComponentSignalReads(owner, () => ({
      debugName: 'provision receiver',
      invalidate: () => undefined,
      onMaterialize: () => undefined,
    }), commit => {
      adoptReceiverInputProvision(transaction, receiver);
      source.get();
      commit();
    });

    const adopted = signalGraphSnapshot();
    expect(adopted.receiverInputProvisions).toBe(baseline.receiverInputProvisions);
    expect(adopted.adoptedReceiverInputProvisions)
      .toBe(baseline.adoptedReceiverInputProvisions + 1);
    expect(adopted.rendererEdges).toBe(baseline.rendererEdges + 1);

    transaction.finish(true);
    disposeSignalRenderConsumer(owner.signalConsumer!);
    expect(signalGraphSnapshot().rendererEdges).toBe(baseline.rendererEdges);
  });

  it('rolls back an unclaimed provision when its render transaction fails', () => {
    const source = signal(1);
    const receiver = {};
    const transaction = testTransaction();
    const baseline = signalGraphSnapshot();

    withReceiverInputProvision(transaction, receiver, () => source.get());
    transaction.finish(false);

    const after = signalGraphSnapshot();
    expect(after.receiverInputProvisions).toBe(baseline.receiverInputProvisions);
    expect(after.rolledBackReceiverInputProvisions)
      .toBe(baseline.rolledBackReceiverInputProvisions + 1);
    expect(after.rendererEdges).toBe(baseline.rendererEdges);
  });

  it('keeps committed input roles when a replacement collection fails', () => {
    const source = signal(1);
    const receiver = {};
    const owner: ComponentSignalRenderOwner = { signalConsumer: undefined };
    const first = testTransaction();

    withReceiverInputProvision(first, receiver, () =>
      withSignalDependencyRole('paint', () => source.get()),
    );
    collectComponentSignalReads(owner, () => ({
      debugName: 'role rollback receiver', invalidate: () => undefined, onMaterialize: () => undefined,
    }), commit => {
      adoptReceiverInputProvision(first, receiver);
      withSignalDependencyRole('paint', () => source.get());
      commit();
    });
    owner.signalConsumer!.markClean();
    const before = signalGraphSnapshot();

    const replacement = testTransaction();
    withReceiverInputProvision(replacement, receiver, () =>
      withSignalDependencyRole('layout', () => source.get()),
    );
    expect(() => collectComponentSignalReads(owner, () => ({
      debugName: 'role rollback receiver', invalidate: () => undefined, onMaterialize: () => undefined,
    }), () => {
      adoptReceiverInputProvision(replacement, receiver);
      throw new Error('abort replacement');
    })).toThrow('abort replacement');

    source.set(2);
    const after = signalGraphSnapshot();
    expect(after.paintInputInvalidations).toBe(before.paintInputInvalidations + 1);
    expect(after.layoutInputInvalidations).toBe(before.layoutInputInvalidations);
    disposeSignalRenderConsumer(owner.signalConsumer!);
  });

  it('retains every changed role while one receiver invalidation is batched', () => {
    const paint = signal('#19375b');
    const width = signal(100);
    const owner: ComponentSignalRenderOwner = { signalConsumer: undefined };
    let invalidations = 0;
    collectComponentSignalReads(owner, () => ({
      debugName: 'batched role receiver', invalidate: () => { invalidations++; }, onMaterialize: () => undefined,
    }), commit => {
      withSignalDependencyRole('paint', () => paint.get());
      withSignalDependencyRole('layout', () => width.get());
      commit();
    });
    owner.signalConsumer!.markClean();
    const before = signalGraphSnapshot();

    batch(() => { paint.set('#a63758'); width.set(120); });

    const after = signalGraphSnapshot();
    expect(after.paintInputInvalidations).toBe(before.paintInputInvalidations + 1);
    expect(after.layoutInputInvalidations).toBe(before.layoutInputInvalidations + 1);
    expect(invalidations).toBe(1);
    disposeSignalRenderConsumer(owner.signalConsumer!);
  });

  it('carries a declared role through a computed receiver input', () => {
    const source = signal(100);
    const width = computed(() => source.get());
    const owner: ComponentSignalRenderOwner = { signalConsumer: undefined };
    collectComponentSignalReads(owner, () => ({
      debugName: 'computed role receiver', invalidate: () => undefined, onMaterialize: () => undefined,
    }), commit => {
      withSignalDependencyRole('layout', () => width.get());
      commit();
    });
    owner.signalConsumer!.markClean();
    const before = signalGraphSnapshot();

    source.set(120);
    flushPendingComputedValidations();

    const after = signalGraphSnapshot();
    expect(after.layoutInputInvalidations).toBe(before.layoutInputInvalidations + 1);
    expect(after.unknownInputInvalidations).toBe(before.unknownInputInvalidations);
    disposeSignalRenderConsumer(owner.signalConsumer!);
  });
});

function testTransaction(): PibblRenderTransaction & {
  finish(success: boolean): void;
} {
  const callbacks: Array<(success: boolean) => void> = [];
  return {
    onFinish(callback): void {
      callbacks.push(callback);
    },
    finish(success): void {
      for (const callback of callbacks.splice(0)) callback(success);
    },
  };
}
