import type { HtmlFocusRegion } from '../focus/html-focus-region.js';
import { resolveStagedTargetRootBounds } from '../focus/geometry.js';
import type { PibblEventTargetRegistration } from '../events/registrations.js';
import type { LayoutBox } from './types.js';
import { PibblPaintEntryKind, type PibblPaintEntry } from '../events/paint-entry.js';
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
  paint: ReadonlyMap<PibblInstance, readonly PibblPaintEntry[]>;
  targets: Map<PibblEventTargetRegistration, Readonly<LayoutBox> | undefined>;
  candidateTargets?: Map<PibblEventTargetRegistration, Readonly<LayoutBox> | undefined>;
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
    owner = { instances: new Map(), snapshot: EMPTY, paint: new Map(), targets: new Map() };
    owners.set(root, owner);
    root.mainTeardowns.add(() => { owners.delete(root); owner!.instances.clear(); owner!.snapshot = EMPTY; owner!.paint = new Map(); owner!.targets = new Map(); });
  }
  let roots = pending.get(transaction);
  if (!roots) { roots = new Map(); pending.set(transaction, roots); }
  let instances = roots.get(root);
  if (!instances) {
    instances = new Map(); roots.set(root, instances);
    const staged = instances, committed = owner;
    let candidate: GeometrySnapshot | undefined;
    let next: Map<PibblInstance, InstanceGeometry> | undefined;
    let paint: Map<PibblInstance, readonly PibblPaintEntry[]> | undefined;
    let targets: Map<PibblEventTargetRegistration, Readonly<LayoutBox> | undefined> | undefined;
    transaction.onPreflight?.(() => {
      targets = new Map();
      committed.candidateTargets = targets;
      for (const target of root.eventRoot.targets) {
        if (!retiredTargets.get(transaction)?.has(target)) targets.set(target, preparedLayoutTargetBounds(transaction, target));
      }
      for (const target of preparedTargets.get(transaction)?.keys() ?? []) {
        if ((target.owner.interactionRoot ?? target.owner) === root && !retiredTargets.get(transaction)?.has(target)) targets.set(target, preparedLayoutTargetBounds(transaction, target));
      }
      next = new Map(committed.instances);
      paint = new Map(committed.paint);
      for (const instance of staged.keys()) {
        const entries: PibblPaintEntry[] = [];
        for (const entry of instance.paintEntries) {
          const transform = copyMatrix(entry.transform);
          const clippingStack = Object.freeze(entry.clippingStack.map(clip => Object.freeze({
            ...clip, path: new Path2D(clip.path), transform: copyMatrix(clip.transform),
          })));
          entries.push(entry.paintKind === PibblPaintEntryKind.Path ?
            Object.freeze({ ...entry, path: new Path2D(entry.path), transform, clippingStack }) :
            Object.freeze({ ...entry, bounds: new Path2D(entry.bounds), transform, clippingStack }));
        }
        paint.set(instance, Object.freeze(entries));
      }
      for (const [instance, boxes] of staged) next.set(instance, boxes);
      const boxes: GeometryBox[] = [], changed: GeometryChange[] = [];
      for (const [instance, entries] of next) {
        if (instance.mainTeardowns.closed) { next.delete(instance); paint.delete(instance); continue; }
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
    const adopt = () => {
      // Preflight performs allocation and validation. Adoption is pointer swaps only.
      if (candidate && next && paint && targets && !root.mainTeardowns.closed) {
        committed.instances = next; committed.snapshot = candidate; committed.paint = paint; committed.targets = targets;
      }
    };
    if (transaction.onAdopt) transaction.onAdopt(adopt);
    transaction.onFinish(success => {
      if (success && !transaction.onAdopt) adopt();
      if (!success && transaction.failed !== false) { committed.instances.clear(); committed.snapshot = EMPTY; committed.paint = new Map(); committed.targets = new Map(); }
      if (committed.candidateTargets === targets) committed.candidateTargets = undefined;
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


/** Input reads the last successful geometry, never the mutable paint preparation ledger. */
export function committedLayoutPaintEntries(instance: PibblInstance): readonly PibblPaintEntry[] | undefined {
  const owner = owners.get(instance.interactionRoot ?? instance);
  // Unmanaged test/backend registrations keep their existing immediate semantics.
  if (!owner) return;
  return owner.paint.get(instance) ?? [];
}

/** Composes only committed parent bridges, including clean managed Layers. */
export function committedInstanceRootTransform(instance: PibblInstance): DOMMatrix | undefined {
  const root = instance.eventRoot.rootInstance;
  if (!root || instance.mainTeardowns.closed) return;
  let owner = instance;
  let transform = new DOMMatrix();
  while (owner !== root) {
    const parent = owner.parent && GLOBAL_STATE.pibblInstances.get(owner.parent);
    if (!parent || parent.mainTeardowns.closed) return;
    const entries = committedLayoutPaintEntries(parent) ?? Array.from(parent.paintEntries);
    const bridge = entries.find(entry => (entry.paintKind === PibblPaintEntryKind.NestedInstance || entry.paintKind === PibblPaintEntryKind.Resolver) && entry.instance === owner);
    if (!bridge) return;
    transform = bridge.transform.multiply(transform);
    owner = parent;
  }
  return transform;
}

function copyMatrix(matrix: DOMMatrix): DOMMatrix {
  return new DOMMatrix([matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f]);
}

/** Released registrations cannot be retained by either committed or prepared geometry. */
export function releaseLayoutTargetGeometry(target: PibblEventTargetRegistration): void {
  const owner = owners.get(target.owner.interactionRoot ?? target.owner);
  owner?.targets.delete(target);
  owner?.candidateTargets?.delete(target);
  const transaction = GLOBAL_STATE.renderTransaction ?? target.owner.eventRoot.renderTransaction;
  if (transaction) {
    stageLayoutTargetRetirement(transaction, target);
    preparedTargets.get(transaction)?.delete(target);
    preparedTargetResults.get(transaction)?.delete(target);
  }
}

/** Returns a published target rectangle, including an intentional absent rectangle. */
export function committedLayoutTargetBounds(target: PibblEventTargetRegistration): ReadonlyMap<PibblEventTargetRegistration, Readonly<LayoutBox> | undefined> | undefined {
  const owner = owners.get(target.owner.interactionRoot ?? target.owner);
  return owner?.targets;
}


interface PreparedHtmlGeometry { readonly active: boolean; readonly bounds: Readonly<LayoutBox>; }
const preparedHtml = new WeakMap<PibblRenderTransaction, Map<HtmlFocusRegion, PreparedHtmlGeometry>>();

/** HTML and focus preflight share one candidate, without mutating the live region. */
export function stageLayoutHtmlGeometry(transaction: PibblRenderTransaction, region: HtmlFocusRegion, geometry: PreparedHtmlGeometry): void {
  let entries = preparedHtml.get(transaction);
  if (!entries) {
    entries = new Map(); preparedHtml.set(transaction, entries);
    transaction.onFinish(() => preparedHtml.delete(transaction));
  }
  entries.set(region, geometry);
}

export function preparedLayoutHtmlGeometry(transaction: PibblRenderTransaction, region: HtmlFocusRegion): PreparedHtmlGeometry | undefined {
  return preparedHtml.get(transaction)?.get(region);
}


interface PreparedTargetGeometry {
  readonly bounds: Readonly<LayoutBox> | undefined;
  readonly transform: DOMMatrix;
}
const preparedTargets = new WeakMap<PibblRenderTransaction, Map<PibblEventTargetRegistration, PreparedTargetGeometry>>();
const preparedTargetResults = new WeakMap<PibblRenderTransaction, Map<PibblEventTargetRegistration, Readonly<LayoutBox> | undefined>>();

const retiredTargets = new WeakMap<PibblRenderTransaction, Set<PibblEventTargetRegistration>>();

/** Excludes retiring registrations from the candidate without touching committed ownership. */
export function stageLayoutTargetRetirement(transaction: PibblRenderTransaction, target: PibblEventTargetRegistration): void {
  let entries = retiredTargets.get(transaction);
  if (!entries) {
    entries = new Set(); retiredTargets.set(transaction, entries);
    transaction.onFinish(() => retiredTargets.delete(transaction));
  }
  entries.add(target);
}

/** External renderer targets join geometry preparation without changing live registrations. */
export function stageLayoutTargetGeometry(transaction: PibblRenderTransaction, target: PibblEventTargetRegistration, geometry: PreparedTargetGeometry): void {
  if (retiredTargets.get(transaction)?.has(target)) return;
  let entries = preparedTargets.get(transaction);
  if (!entries) {
    entries = new Map(); preparedTargets.set(transaction, entries);
    transaction.onFinish(() => preparedTargets.delete(transaction));
  }
  entries.set(target, geometry);
}

/** The shared preflight result used by both the receipt and focus candidates. */
export function preparedLayoutTargetBounds(transaction: PibblRenderTransaction, target: PibblEventTargetRegistration): Readonly<LayoutBox> | undefined {
  let results = preparedTargetResults.get(transaction);
  if (!results) {
    results = new Map(); preparedTargetResults.set(transaction, results);
    transaction.onFinish(() => preparedTargetResults.delete(transaction));
  }
  if (results.has(target)) return results.get(target);
  const staged = preparedTargets.get(transaction)?.get(target);
  const bounds = staged ? resolveStagedTargetRootBounds({ ...target,
    keyboardNavigationBounds: staged.bounds, keyboardNavigationPoints: undefined,
    paintEntry: { ...target.paintEntry, transform: staged.transform } as NonNullable<PibblEventTargetRegistration['paintEntry']>,
  }) : resolveStagedTargetRootBounds(target);
  results.set(target, bounds);
  return bounds;
}
