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
  type SignalDependencyRoleInput,
  type SignalNode,
} from './graph.js';
import { signalDependencyRoleMask } from './edge.js';

interface ReceiverInputProvision {
  readonly nodes: Array<{ node: SignalNode<unknown>; roles: number }>;
  settled: boolean;
}

const transactionProvisions = new WeakMap<
  PibblRenderTransaction,
  WeakMap<object, ReceiverInputProvision>
>();

/** @internal Immutable input reads captured for replay into a current receiver. */
export type ReceiverInputProvisionReceipt = readonly { readonly node: SignalNode<unknown>; readonly roles: number }[];

export function withReceiverInputProvision<T>(
  transaction: PibblRenderTransaction | undefined,
  receiver: object | undefined,
  callback: () => T,
): T {
  return runReceiverInputProvision(transaction, receiver, callback);
}

/** @internal Captures every callback read, including roles already provisioned earlier. */
export function captureReceiverInputProvision<T>(
  transaction: PibblRenderTransaction | undefined,
  receiver: object | undefined,
  callback: () => T,
): { value: T; receipt: ReceiverInputProvisionReceipt | undefined } {
  if (!transaction || !receiver || currentComponentOwnsReceiver(receiver)) {
    return { value: runReceiverInputProvision(transaction, receiver, callback), receipt: undefined };
  }
  const receipt: Array<{ node: SignalNode<unknown>; roles: number }> = [];
  const value = runReceiverInputProvision(transaction, receiver, callback, receipt);
  return { value, receipt };
}

/** @internal Replays reads into the current transaction, never an old receiver token. */
export function replayReceiverInputProvision(
  transaction: PibblRenderTransaction | undefined,
  receiver: object | undefined,
  receipt: ReceiverInputProvisionReceipt,
): void {
  withReceiverInputProvision(transaction, receiver, () => {
    for (let index = 0; index < receipt.length; index++) {
      const entry = receipt[index];
      trackSignalDependency(entry.node, entry.roles);
    }
  });
}

function runReceiverInputProvision<T>(
  transaction: PibblRenderTransaction | undefined,
  receiver: object | undefined,
  callback: () => T,
  receipt?: Array<{ node: SignalNode<unknown>; roles: number }>,
): T {
  if (!transaction || !receiver) return untracked(callback);
  if (currentComponentOwnsReceiver(receiver)) return callback();

  let provision: ReceiverInputProvision | undefined;
  const collector: SignalDependencyCollector = {
    addDependency(node, role: SignalDependencyRoleInput = 'unknown'): void {
      if (provision === undefined) {
        provision = createProvision(transaction, receiver);
      }
      const existing = provision.nodes.find(entry => entry.node === node);
      if (existing === undefined) provision.nodes.push({ node, roles: signalDependencyRoleMask(role) });
      else existing.roles |= signalDependencyRoleMask(role);
      if (receipt) {
        const roles = signalDependencyRoleMask(role);
        let captured = false;
        for (let index = 0; index < receipt.length; index++) {
          if (receipt[index].node !== node) continue;
          receipt[index].roles |= roles;
          captured = true;
          break;
        }
        if (!captured) receipt.push({ node, roles });
      }
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
  for (const { node, roles } of provision.nodes) trackSignalDependency(node, roles);
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
