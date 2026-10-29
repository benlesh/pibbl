import { GLOBAL_STATE } from '../global-state.js';
import { getLogicalLayoutOrigin } from './context.js';
import type { PibblComponentRefs, PibblInstance, PibblRenderTransaction } from '../types.js';

interface GeometryBox {
  readonly nodeId: number;
  readonly width: number;
  readonly height: number;
  readonly x: number;
  readonly y: number;
}
interface GeometryChange {
  readonly previous: GeometryBox | undefined;
  readonly current: GeometryBox | undefined;
}
interface GeometrySnapshot {
  readonly generation: number;
  readonly boxes: readonly GeometryBox[];
  readonly changed: readonly GeometryChange[];
}
type InstanceGeometry = ReadonlyMap<PibblComponentRefs<any>, GeometryBox>;
interface GeometryOwner {
  instances: Map<PibblInstance, InstanceGeometry>;
  snapshot: GeometrySnapshot;
}
let nextNodeId = 0;
const nodeIds = new WeakMap<PibblComponentRefs<any>, number>();
const EMPTY: GeometrySnapshot = Object.freeze({ generation: 0, boxes: Object.freeze([]), changed: Object.freeze([]) });
const owners = new WeakMap<PibblInstance, GeometryOwner>();
const pending = new WeakMap<PibblRenderTransaction, Map<PibblInstance, Map<PibblInstance, Map<PibblComponentRefs<any>, GeometryBox>>>>();

/** Internal immutable receipt; it never establishes a reactive geometry-to-style edge. */
export function snapshotLayoutGeometry(instance: PibblInstance): GeometrySnapshot {
  return owners.get(instance.interactionRoot ?? instance)?.snapshot ?? EMPTY;
}

/** Start one instance's staged geometry, preserving clean managed Layer receipts. */
export function beginLayoutGeometry(instance: PibblInstance, transaction: PibblRenderTransaction): void {
  const root = instance.interactionRoot ?? instance;
  let owner = owners.get(root);
  if (!owner) {
    owner = { instances: new Map(), snapshot: EMPTY };
    owners.set(root, owner);
    root.mainTeardowns.add(() => { owners.delete(root); owner!.instances.clear(); owner!.snapshot = EMPTY; });
  }
  let roots = pending.get(transaction);
  if (!roots) { roots = new Map(); pending.set(transaction, roots); }
  let instances = roots.get(root);
  if (!instances) {
    instances = new Map(); roots.set(root, instances);
    const staged = instances, committed = owner;
    let candidate: GeometrySnapshot | undefined;
    let next: Map<PibblInstance, InstanceGeometry> | undefined;
    transaction.onPreflight?.(() => {
      next = new Map(committed.instances);
      for (const [instance, boxes] of staged) next.set(instance, boxes);
      const boxes: GeometryBox[] = [], changed: GeometryChange[] = [];
      for (const [instance, entries] of next) {
        if (instance.mainTeardowns.closed) { next.delete(instance); continue; }
        const previous = committed.instances.get(instance);
        for (const [component, box] of entries) {
          validate(box);
          boxes.push(box);
          const before = previous?.get(component);
          if (!before || !sameBox(before, box)) changed.push(Object.freeze({ previous: before, current: box }));
        }
      }
      for (const [instance, entries] of committed.instances) {
        const current = next.get(instance);
        for (const [component, previous] of entries) if (!current?.has(component)) changed.push(Object.freeze({ previous, current: undefined }));
      }
      candidate = Object.freeze({ generation: committed.snapshot.generation + 1, boxes: Object.freeze(boxes), changed: Object.freeze(changed) });
    });
    transaction.onFinish(success => {
      // Preflight performs all allocation and validation. Adoption is only pointer swaps.
      if (success && candidate && next && !root.mainTeardowns.closed) {
        committed.instances = next; committed.snapshot = candidate;
      } else if (!success) { committed.instances.clear(); committed.snapshot = EMPTY; }
      staged.clear(); roots!.delete(root);
      if (!roots!.size) pending.delete(transaction);
    });
  }
  instances.set(instance, new Map());
}

/** Record the final logical allocation and accumulated layout origin for this generation. */
export function stageLayoutGeometry(component: PibblComponentRefs<any>): void {
  const instance = GLOBAL_STATE.currentPibblInstance, transaction = GLOBAL_STATE.renderTransaction;
  const allocation = GLOBAL_STATE.layoutStack?.at(-1)?.allocation;
  if (!instance || !transaction || !allocation) return;
  const entries = pending.get(transaction)?.get(instance.interactionRoot ?? instance)?.get(instance);
  if (!entries) return;
  const origin = getLogicalLayoutOrigin();
  let nodeId = nodeIds.get(component);
  if (nodeId === undefined) { nodeId = ++nextNodeId; nodeIds.set(component, nodeId); }
  entries.set(component, Object.freeze({ nodeId, width: allocation.width, height: allocation.height,
    x: origin.x, y: origin.y }));
}
function validate(box: GeometryBox): void {
  if (!Number.isFinite(box.width) || !Number.isFinite(box.height) || box.width < 0 || box.height < 0 ||
      !Number.isFinite(box.x) || !Number.isFinite(box.y)) throw new Error('Layout geometry publication requires finite logical boxes and origins.');
}
function sameBox(a: GeometryBox, b: GeometryBox): boolean {
  return a.width === b.width && a.height === b.height && a.x === b.x && a.y === b.y;
}
