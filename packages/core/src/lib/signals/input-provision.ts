import type { PibblRenderTransaction } from '../types.js';
import { GLOBAL_STATE } from '../global-state.js';
import { getPrimitiveReceiverToken } from '../element/metadata.js';
import {
  recordReceiverInputProvisionAdopted,
  recordReceiverInputProvisionCreated,
  recordReceiverInputProvisionRolledBack,
  trackSignalDependency,
  untracked,
  withSignalTracking,
  type SignalDependencyCollector,
  type SignalNode,
} from './graph.js';

interface ReceiverInputProvision {
  readonly nodes: SignalNode<unknown>[];
  settled: boolean;
}

const transactionProvisions = new WeakMap<
  PibblRenderTransaction,
  WeakMap<object, ReceiverInputProvision>
>();

export function withReceiverInputProvision<T>(
  transaction: PibblRenderTransaction | undefined,
  receiver: object | undefined,
  callback: () => T,
): T {
  if (!transaction || !receiver) return untracked(callback);
  if (currentComponentOwnsReceiver(receiver)) return callback();

  let provision: ReceiverInputProvision | undefined;
  const collector: SignalDependencyCollector = {
    addDependency(node): void {
      if (provision === undefined) {
        provision = createProvision(transaction, receiver);
      }
      if (!provision.nodes.includes(node)) provision.nodes.push(node);
    },
  };
  return withSignalTracking(collector, callback);
}

export function adoptReceiverInputProvision(
  transaction: PibblRenderTransaction | undefined,
  receiver: object,
): void {
  if (!transaction) return;
  const receivers = transactionProvisions.get(transaction);
  const provision = receivers?.get(receiver);
  if (!provision || provision.settled) return;

  provision.settled = true;
  receivers!.delete(receiver);
  for (const node of provision.nodes) trackSignalDependency(node);
  provision.nodes.length = 0;
  recordReceiverInputProvisionAdopted();
}

function createProvision(
  transaction: PibblRenderTransaction,
  receiver: object,
): ReceiverInputProvision {
  let receivers = transactionProvisions.get(transaction);
  if (!receivers) {
    receivers = new WeakMap();
    transactionProvisions.set(transaction, receivers);
  }
  let provision = receivers.get(receiver);
  if (provision) return provision;

  provision = { nodes: [], settled: false };
  receivers.set(receiver, provision);
  recordReceiverInputProvisionCreated();
  const ownedProvision = provision;
  transaction.onFinish(() => {
    if (ownedProvision.settled) return;
    ownedProvision.settled = true;
    receivers!.delete(receiver);
    ownedProvision.nodes.length = 0;
    recordReceiverInputProvisionRolledBack();
  });
  return provision;
}

function currentComponentOwnsReceiver(receiver: object): boolean {
  const component = GLOBAL_STATE.componentRefs;
  if (!component) return false;
  return (getPrimitiveReceiverToken(component.element) ?? component) === receiver;
}
