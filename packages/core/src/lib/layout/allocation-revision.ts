import { GLOBAL_STATE } from '../global-state.js';
import type { PibblInstance } from '../types.js';

// Existing signal roles drive one revision per owning root. Unknown consumers
// retain the conservative realm-wide fallback; this is not another signal graph.
let nextRevision = 0;
let fallbackStructuralRevision = 0;
let fallbackMetricRevision = 0;
let isolatedOwner: PibblInstance | undefined;
interface AllocationRevisions { structural: number; metric: number; }
const revisions = new WeakMap<PibblInstance, AllocationRevisions>();

export interface AllocationInputState {
  readonly structural: number;
  readonly metric: number;
}

export function allocationOwner(): PibblInstance | undefined {
  const owner = isolatedOwner ?? GLOBAL_STATE.currentPibblInstance;
  return owner?.interactionRoot ?? owner;
}
export function setAllocationOwner(owner: PibblInstance | undefined): PibblInstance | undefined {
  const previous = isolatedOwner; isolatedOwner = owner; return previous;
}
export function allocationInputRevision(owner = allocationOwner()): number {
  const state = allocationInputState(owner);
  return Math.max(state.structural, state.metric);
}
export function allocationStructuralRevision(owner = allocationOwner()): number {
  const local = owner ? revisions.get(owner.interactionRoot ?? owner) : undefined;
  return Math.max(fallbackStructuralRevision, local?.structural ?? 0);
}
export function allocationInputState(owner = allocationOwner()): AllocationInputState {
  const local = owner ? revisions.get(owner.interactionRoot ?? owner) : undefined;
  return {
    structural: Math.max(fallbackStructuralRevision, local?.structural ?? 0),
    metric: Math.max(fallbackMetricRevision, local?.metric ?? 0),
  };
}
export function invalidateAllocationInputs(owner?: PibblInstance, kind: 'structural' | 'metric' = 'structural'): void {
  const revision = ++nextRevision;
  if (!owner) {
    if (kind === 'metric') fallbackMetricRevision = revision;
    else fallbackStructuralRevision = revision;
    return;
  }
  const key = owner.interactionRoot ?? owner;
  const previous = revisions.get(key) ?? { structural: 0, metric: 0 };
  revisions.set(key, kind === 'metric' ? { ...previous, metric: revision } : { ...previous, structural: revision });
}
