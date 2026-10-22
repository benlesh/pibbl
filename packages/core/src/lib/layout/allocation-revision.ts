// Existing signal roles and explicit render requests conservatively invalidate
// optional allocation caches. This is a revision, not another dependency graph.
let revision = 0;
export function allocationInputRevision(): number { return revision; }
export function invalidateAllocationInputs(): void { revision++; }
