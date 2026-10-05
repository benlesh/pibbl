import { describe, expect, it } from 'vitest';
import type { PibblRenderTransaction } from '../types.js';
import {
  disposeSignalRenderConsumer,
  collectComponentSignalReads,
  type ComponentSignalRenderOwner,
} from './render-consumer.js';
import { signal, signalGraphSnapshot } from './graph.js';
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
