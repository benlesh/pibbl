import type { PibblRenderTransaction } from '../types.js';

// These are numeric input relationships, not reactive subscriptions. The existing
// receiver's single combined-role consumer remains the sole signal lease owner.
const owners = new WeakMap<object, Set<AllocationDependency>>();
const pending = new WeakMap<PibblRenderTransaction, WeakMap<object, Set<AllocationDependency>>>();
const allocationRoles = 1 | 2 | 4 | 64;
let activeDependencies = 0;
let activeBindings = 0;

/** One numeric contribution consumed by an allocating region. */
export class AllocationDependency {
  private owner: object | undefined;
  private disposed = false;
  constructor(private readonly invalidate: (roles: number) => void) { activeDependencies++; }
  notify(roles: number): void {
    if (!this.disposed && (roles & allocationRoles)) this.invalidate(roles & allocationRoles);
  }
  adopt(owner: object): void {
    if (this.disposed || this.owner === owner) return;
    this.detach();
    this.owner = owner; activeBindings++;
    let dependencies = owners.get(owner);
    if (!dependencies) { dependencies = new Set(); owners.set(owner, dependencies); }
    dependencies.add(this);
  }
  private detach(): void {
    if (!this.owner) return;
    const dependencies = owners.get(this.owner);
    dependencies?.delete(this);
    if (!dependencies?.size) owners.delete(this.owner);
    this.owner = undefined; activeBindings--;
  }
  release(owner: object): void {
    if (this.owner !== owner) return;
    this.detach();
    this.notify(1);
  }
  dispose(): void { if (this.disposed) return; this.disposed = true; this.detach(); activeDependencies--; }
}

/** Stage correspondence using this transaction's receiver, never an old token. */
export function stageAllocationDependency(transaction: PibblRenderTransaction, receiver: object, dependency: AllocationDependency): void {
  let receivers = pending.get(transaction);
  if (!receivers) { receivers = new WeakMap(); pending.set(transaction, receivers); transaction.onFinish(() => pending.delete(transaction)); }
  let dependencies = receivers.get(receiver);
  if (!dependencies) { dependencies = new Set(); receivers.set(receiver, dependencies); }
  dependencies.add(dependency);
}

/** Publish identity correspondence only after successful receiver adoption. */
export function adoptAllocationReceiver(transaction: PibblRenderTransaction, receiver: object, owner: object & { readonly teardowns?: { readonly closed: boolean } }): void {
  const dependencies = pending.get(transaction)?.get(receiver);
  if (!dependencies) return;
  transaction.onFinish(success => { if (success && !owner.teardowns?.closed) for (const dependency of dependencies) dependency.adopt(owner); });
}

/** Called by the existing combined-role receiver consumer, before coalescing paint. */
export function invalidateAllocationReceiver(owner: object, roles: number): void {
  if (!(roles & allocationRoles)) return;
  const dependencies = owners.get(owner);
  if (dependencies) for (const dependency of dependencies) dependency.notify(roles);
}

/** Removal releases reverse numeric relationships without holding component refs. */
export function releaseAllocationReceiver(owner: object): void {
  const dependencies = owners.get(owner);
  if (dependencies) for (const dependency of dependencies) dependency.release(owner);
}

/** Internal ownership diagnostics; numeric relationships acquire no signal lease. */
export function snapshotAllocationDependencies(): Readonly<{ dependencies: number; bindings: number }> {
  return { dependencies: activeDependencies, bindings: activeBindings };
}
