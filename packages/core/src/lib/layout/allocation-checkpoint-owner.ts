import { GLOBAL_STATE } from '../global-state.js';
const mountedOwners = new WeakMap<object, object>();
const phases = new WeakMap<object, Map<unknown, object>>();
const generations = new WeakMap<object, number>();
const disposals = new WeakMap<object, () => void>();
export function checkpointGeneration(owner: object): number { return generations.get(owner) ?? 0; }
export function registerCheckpointDisposal(owner: object, dispose: () => void): void { disposals.set(owner, dispose); }
/** Release numeric snapshots and reverse input relationships with their owner. */
export function disposeAllocationCheckpoint(owner: object): void {
  for (const phase of phases.get(owner)?.values() ?? []) disposeAllocationCheckpoint(phase);
  phases.delete(owner);
  disposals.get(owner)?.(); disposals.delete(owner);
  generations.set(owner, checkpointGeneration(owner) + 1);
}

/** Allocation-only owners do not create an otherwise unused native arena. */
export function mountedAllocationCheckpointOwner(): object | undefined {
  const refs = GLOBAL_STATE.componentRefs;
  if (!refs) return;
  let owner = mountedOwners.get(refs);
  if (!owner) {
    owner = refs; mountedOwners.set(refs, owner);
    const owned = owner;
    refs.teardowns.add(() => { disposeAllocationCheckpoint(owned); mountedOwners.delete(refs); });
  }
  return owner;
}
export function adoptAllocationCheckpointOwner(owner: object): void {
  const refs = GLOBAL_STATE.componentRefs;
  if (refs) mountedOwners.set(refs, owner);
}

/** Separate numeric phases share the owning region's lifetime, not each other's snapshots. */
export function allocationCheckpointPhaseOwner(owner: object, key: unknown): object {
  let entries = phases.get(owner);
  if (!entries) { entries = new Map(); phases.set(owner, entries); }
  let phase = entries.get(key);
  if (!phase) { phase = {}; entries.set(key, phase); }
  return phase;
}

/** Retire unreachable numeric phases only when the new preparation commits. */
export function retainAllocationCheckpointPhases(owner: object, keys: readonly unknown[]): void {
  const transaction = GLOBAL_STATE.renderTransaction;
  if (!transaction) return;
  let retained = pendingPhases.get(transaction);
  if (!retained) {
    retained = new Map(); pendingPhases.set(transaction, retained);
    const pending = retained;
    transaction.onFinish(success => {
      pendingPhases.delete(transaction);
      if (!success) return;
      for (const [owner, retention] of pending) {
        if (checkpointGeneration(owner) !== retention.generation) continue;
        const entries = phases.get(owner);
        if (!entries) continue;
        for (const [key, phase] of entries) if (!retention.keys.has(key)) {
          disposeAllocationCheckpoint(phase); entries.delete(key);
        }
        if (!entries.size) phases.delete(owner);
      }
    });
  }
  retained.set(owner, { keys: new Set(keys), generation: checkpointGeneration(owner) });
}
const pendingPhases = new WeakMap<object, Map<object, { keys: Set<unknown>; generation: number }>>();
