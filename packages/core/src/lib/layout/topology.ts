import type { PibblInstance, PibblRenderTransaction } from '../types.js';

/**
 * Root-owned identity ledger for the subset of layout roots that can be
 * prepared without evaluating an opaque component. It deliberately records
 * topology only; allocation and geometry remain owned by the matching layout
 * family until a later publication phase can adopt them atomically.
 */
export interface LayoutTopologySlot {
  readonly topologyOwner: PibblInstance;
}

interface TopologyRecord {
  parent: LayoutTopologySlot | undefined;
}

interface PendingTopologyChange {
  readonly slot: LayoutTopologySlot;
  readonly parent: LayoutTopologySlot | undefined;
}

interface RootTopology {
  readonly owner: PibblInstance;
  live: boolean;
  revision: number;
  pending: number;
  readonly records: Map<LayoutTopologySlot, TopologyRecord>;
  readonly teardown: () => void;
}

interface PendingTopologyBatch {
  readonly root: RootTopology;
  readonly changes: Map<LayoutTopologySlot, PendingTopologyChange>;
}

const roots = new WeakMap<PibblInstance, RootTopology>();
const pending = new WeakMap<PibblRenderTransaction, Map<PibblInstance, PendingTopologyBatch>>();
const disposedSlots = new WeakSet<LayoutTopologySlot>();
let activeRoots = 0;
let activeRecords = 0;
let activePending = 0;

function interactionRoot(owner: PibblInstance): PibblInstance {
  return owner.interactionRoot ?? owner;
}

function topologyFor(owner: PibblInstance): RootTopology {
  const rootOwner = interactionRoot(owner);
  let topology = roots.get(rootOwner);
  if (topology) return topology;
  const created: RootTopology = {
    owner: rootOwner,
    live: true,
    revision: 0,
    pending: 0,
    records: new Map(),
    teardown: () => releaseRoot(rootOwner, created),
  };
  roots.set(rootOwner, created);
  activeRoots++;
  rootOwner.mainTeardowns.add(created.teardown);
  return created;
}

function releaseRoot(owner: PibblInstance, topology: RootTopology): void {
  if (roots.get(owner) !== topology) return;
  topology.live = false;
  activeRecords -= topology.records.size;
  topology.records.clear();
  roots.delete(owner);
  activeRoots--;
}

function releaseEmptyRoot(topology: RootTopology): void {
  if (!topology.live || topology.records.size || topology.pending) return;
  topology.owner.mainTeardowns.remove(topology.teardown);
  releaseRoot(topology.owner, topology);
}

/** Stages one stable prepared-root relationship for commit with its render. */
export function stageLayoutTopology(
  transaction: PibblRenderTransaction,
  slot: LayoutTopologySlot,
  parent: LayoutTopologySlot | undefined,
): void {
  if (disposedSlots.has(slot)) return;
  const owner = interactionRoot(slot.topologyOwner);
  let byRoot = pending.get(transaction);
  if (!byRoot) {
    byRoot = new Map();
    pending.set(transaction, byRoot);
    const owned = byRoot;
    transaction.onFinish(success => {
      if (success) {
        for (const batch of owned.values()) commit(batch);
      }
      for (const batch of owned.values()) {
        batch.root.pending -= batch.changes.size;
        activePending -= batch.changes.size;
        releaseEmptyRoot(batch.root);
      }
      pending.delete(transaction);
    });
  }
  let batch = byRoot.get(owner);
  if (!batch) {
    batch = { root: topologyFor(owner), changes: new Map() };
    byRoot.set(owner, batch);
  }
  if (!batch.changes.has(slot)) { batch.root.pending++; activePending++; }
  batch.changes.set(slot, { slot, parent });
}

function commit(batch: PendingTopologyBatch): void {
  // A root may be disposed while a failed/aborted traversal still owns the
  // transaction. Its later finish callback must not resurrect its records.
  if (!batch.root.live) return;
  let changed = false;
  for (const change of batch.changes.values()) {
    if (disposedSlots.has(change.slot)) continue;
    const previous = batch.root.records.get(change.slot);
    if (!previous) {
      batch.root.records.set(change.slot, { parent: change.parent });
      activeRecords++;
      changed = true;
    } else if (previous.parent !== change.parent) {
      previous.parent = change.parent;
      changed = true;
    }
  }
  if (changed) batch.root.revision++;
}

/** Removes a disposed prepared root and commits the removal immediately. */
export function releaseLayoutTopology(slot: LayoutTopologySlot): void {
  disposedSlots.add(slot);
  const topology = roots.get(interactionRoot(slot.topologyOwner));
  if (!topology || !topology.records.delete(slot)) return;
  activeRecords--; topology.revision++;
  releaseEmptyRoot(topology);
}

/** Internal diagnostics for focused lifecycle and topology tests. */
export function snapshotLayoutTopology(owner?: PibblInstance): Readonly<{ roots: number; records: number; pending: number; revision?: number }> {
  if (owner) {
    const topology = roots.get(interactionRoot(owner));
    return Object.freeze({
      roots: topology ? 1 : 0,
      records: topology?.records.size ?? 0,
      pending: topology?.pending ?? 0,
      revision: topology?.revision ?? 0,
    });
  }
  return Object.freeze({ roots: activeRoots, records: activeRecords, pending: activePending });
}
