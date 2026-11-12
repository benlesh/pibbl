import { disposeAllocationCheckpoint, adoptAllocationCheckpointOwner } from './allocation-checkpoint-owner.js';
import { getLayoutDirection } from './context.js';
import { peekPreNormalizedStyle } from '../style/resolve-dispatch.js';
import type { BoxStyle } from '../style/types.js';
import { isLayoutComponent, prepareLayoutComponent } from './define-layout-component.js';
import { getElementMetadata, setElementMetadata, getPrimitiveReceiverToken } from '../element/metadata.js';
import { LayoutRegion, adoptMountedLayoutRegion } from './wasm/region.js';
import type { PibblComponentRefs, PibblInstance } from '../types.js';
import { GLOBAL_STATE } from '../global-state.js';
import type { PibblElement } from '../element/types.js';
import type { PibblRenderTransaction, SystemStyle } from '../types.js';
import type { ResponsiveStylePreparation } from '../style/responsive.js';
import type { LayoutBox } from './types.js';
import { releaseLayoutTopology, stageLayoutTopology, type LayoutTopologySlot } from './topology.js';
export { snapshotLayoutTopology } from './topology.js';

type PreparedStyle = Readonly<SystemStyle> | ResponsiveStylePreparation<Readonly<SystemStyle>>;
export interface KnownLayoutPreflightOptions { readonly deferStaticContainingDescendants?: boolean; }
type Preflight = (element: PibblElement<any>, style: Readonly<SystemStyle>, content: Readonly<LayoutBox>, receiver: object, slot: PreparedLayoutSlot, parentMainAxis?: 'row' | 'column', options?: KnownLayoutPreflightOptions) => void;
const preflights = new WeakMap<Function, Preflight>();
export function isKnownLayoutType(type: Function): boolean { return preflights.has(type); }
const currentReceiverSlots = new WeakMap<PibblRenderTransaction, WeakMap<object, PreparedLayoutSlot>>();
/** Only the current transaction's settled preparation may be attached to a replay. */
export function currentPreparedReceiverSlot(receiver: object | undefined): PreparedLayoutSlot | undefined {
  const transaction = GLOBAL_STATE.renderTransaction;
  return transaction && receiver ? currentReceiverSlots.get(transaction)?.get(receiver) : undefined;
}
const snapshots = new WeakMap<PibblRenderTransaction, WeakMap<object, { child: PibblElement<any>; width: number; height: number; prepared: PreparedStyle }>>();

/** Registers only known declarative input preparation, never component evaluation. */
export function registerKnownLayoutPreflight(type: Function, preflight: Preflight): void { preflights.set(type, preflight); }
export function preflightKnownLayout(element: PibblElement<any>, style: Readonly<SystemStyle>, content: Readonly<LayoutBox>, receiver?: object, occurrence = 0, parentSlot?: PreparedLayoutSlot, parentMainAxis?: 'row' | 'column', options?: KnownLayoutPreflightOptions): PreparedLayoutSlot | undefined {
  const parent = GLOBAL_STATE.componentRefs, owner = GLOBAL_STATE.currentPibblInstance;
  if (!receiver || !parent || !owner || !GLOBAL_STATE.renderTransaction) return;
  const root = isLayoutComponent(element.type) ? prepareLayoutComponent(element, { receiverToken: receiver }) : element;
  const preflight = preflights.get(root.type);
  if (!preflight) return;
  const rootReceiver = root === element ? receiver : getPrimitiveReceiverToken(root);
  if (!rootReceiver) throw new Error('A prepared layout description requires its own root receiver.');
  const transaction = GLOBAL_STATE.renderTransaction;
  let visiting = activeDescriptions.get(transaction);
  if (!visiting) { visiting = new Set(); activeDescriptions.set(transaction, visiting); }
  const source = getElementMetadata(element)?.layoutDescriptionSource ?? element;
  if (visiting.has(source)) throw new Error('Known layout descriptions form a cycle.');
  visiting.add(source);
  try {
  let types = parentSlot?.children ?? slots.get(parent);
  if (!types) {
    types = new Map(); slots.set(parent, types);
    const owned = types;
    parent.teardowns.add(() => { for (const entries of owned.values()) for (const slot of entries.values()) slot.dispose(); owned.clear(); slots.delete(parent); });
  }
  let entries = types.get(element.type);
  if (!entries) { entries = new Map(); types.set(element.type, entries); }
  const key = element.key === undefined ? `occurrence:${occurrence}` : `key:${element.key}`;
  let slot = entries.get(key);
  if (slot && !slot.matchesRoot(root)) {
    slot.dispose(); slot = undefined;
    // Releasing the last old occurrence removes its type table.
    types.set(element.type, entries);
  }
  if (!slot) {
    const ownedEntries = entries, ownedTypes = types;
    const created = new PreparedLayoutSlot(owner.interactionRoot ?? owner, {
      rootType: root.type, rootKey: root.key,
      release: () => {
        if (ownedEntries.get(key) !== created) return;
        ownedEntries.delete(key);
        if (!ownedEntries.size) ownedTypes.delete(element.type);
      },
    });
    slot = created; entries.set(key, slot);
  }
  stageLayoutTopology(transaction, slot, parentSlot);
  preflight(root, style, content, rootReceiver, slot, parentMainAxis, options);
  let receivers = currentReceiverSlots.get(transaction);
  if (!receivers) { receivers = new WeakMap(); currentReceiverSlots.set(transaction, receivers); }
  receivers.set(receiver, slot); receivers.set(rootReceiver, slot);
  return slot;
  } finally { visiting.delete(source); }
}
export function attachPreparedLayoutSlot(element: PibblElement<any>, slot?: PreparedLayoutSlot): void {
  if (slot) setElementMetadata(element, { ...getElementMetadata(element), preparedLayoutSlot: slot });
}
export interface PreparedPlanPending { readonly kind: 'static-flex-containing-origin'; count: number; }
export interface PreparedLayoutPlan {
  readonly region?: LayoutRegion;
  readonly content: Readonly<LayoutBox>;
  readonly children: readonly PibblElement<any>[];
  readonly placements: { box: LayoutBox; element: PibblElement<any> }[];
  /** A staged plan cannot transfer ownership while a late containing origin is unresolved. */
  pending?: PreparedPlanPending;
}
export interface PreparedFlexLayoutPlan extends PreparedLayoutPlan { readonly region: LayoutRegion; readonly cached: boolean; readonly revision: number; readonly placements: { box: LayoutBox; layoutY: number; usedWidth: number; usedHeight: number; element: PibblElement<any> }[]; }
export class PreparedLayoutSlot implements LayoutTopologySlot {
  region: LayoutRegion | undefined;
  private boundaryOwner: PibblComponentRefs<any> | undefined;
  claimBoundary(): void {
    const refs = GLOBAL_STATE.componentRefs!;
    if (this.boundaryOwner === refs) return;
    this.boundaryOwner = refs; adoptAllocationCheckpointOwner(this); refs.teardowns.add(() => { if (this.boundaryOwner === refs) this.dispose(); });
  }
  readonly children = new Map<Function, Map<string, PreparedLayoutSlot>>();
  private disposeChildren(): void {
    for (const entries of this.children.values()) for (const child of entries.values()) child.dispose();
    this.children.clear();
  }
  private readonly rootType: Function;
  private readonly rootKey: string | undefined;
  private readonly release: () => void;
  constructor(readonly topologyOwner: PibblInstance, options: { rootType: Function; rootKey?: string; release: () => void }) {
    this.rootType = options.rootType; this.rootKey = options.rootKey; this.release = options.release;
  }
  matchesRoot(root: PibblElement<any>): boolean { return this.rootType === root.type && this.rootKey === root.key; }
  acquire(): LayoutRegion { return this.region ??= new LayoutRegion(this.topologyOwner); }
  dispose(): void { disposeAllocationCheckpoint(this); const region = this.region; this.region = undefined; this.boundaryOwner = undefined; try { this.disposeChildren(); region?.dispose(); } finally { releaseLayoutTopology(this); this.release(); } }
  claim(region: LayoutRegion): void {
    if (this.region !== region) throw new Error('Prepared layout region is stale.');
    adoptMountedLayoutRegion(region, () => { if (this.region === region) { this.region = undefined; this.disposeChildren(); releaseLayoutTopology(this); this.release(); } });
  }
}
const activeDescriptions = new WeakMap<PibblRenderTransaction, Set<PibblElement<any>>>();
const slots = new WeakMap<PibblComponentRefs<any>, Map<Function, Map<string, PreparedLayoutSlot>>>();
const plans = new WeakMap<PibblRenderTransaction, Map<PreparedLayoutSlot, { plan: PreparedLayoutPlan; direction: 'ltr' | 'rtl'; claimed: boolean }>>();
export function stagePreparedLayoutPlan(slot: PreparedLayoutSlot, plan: PreparedLayoutPlan): void {
  const transaction = GLOBAL_STATE.renderTransaction!;
  let pending = plans.get(transaction);
  if (!pending) {
    pending = new Map(); plans.set(transaction, pending);
    const owned = pending;
    transaction.onFinish(() => { for (const [slot, entry] of owned) if (!entry.claimed) slot.dispose(); owned.clear(); plans.delete(transaction); });
  }
  if (pending.has(slot)) throw new Error('Duplicate known layout occurrence during preparation.');
  pending.set(slot, { plan, direction: getLayoutDirection(), claimed: false });
}
export function claimPreparedLayoutPlan(element: PibblElement<any>, content: Readonly<LayoutBox>): PreparedLayoutPlan | undefined {
  const transaction = GLOBAL_STATE.renderTransaction;
  const slot = getElementMetadata(element)?.preparedLayoutSlot as PreparedLayoutSlot | undefined;
  if (!transaction || !slot) return;
  const entry = plans.get(transaction)?.get(slot);
  if (!entry || entry.claimed || entry.direction !== getLayoutDirection() || entry.plan.content.width !== content.width || entry.plan.content.height !== content.height) throw new Error('Prepared layout plan does not match its allocation.');
  if (entry.plan.pending?.count) throw new Error('Prepared static Flex descendants did not receive a settled containing origin.');
  if (entry.plan.region) slot.claim(entry.plan.region); else slot.claimBoundary();
  entry.claimed = true;
  return entry.plan;
}
export function claimPreparedFlexPlan(element: PibblElement<any>, content: Readonly<LayoutBox>): PreparedFlexLayoutPlan | undefined {
  const plan = claimPreparedLayoutPlan(element, content);
  if (!plan) return;
  if (!plan.region || !('cached' in plan) || typeof plan.cached !== 'boolean' || !('revision' in plan) || typeof plan.revision !== 'number') throw new Error('Prepared Flex plan is incompatible with this boundary.');
  return plan as PreparedFlexLayoutPlan;
}

/** @internal Reads a current staged plan without transferring its region. */
export function peekPreparedLayoutPlan(slot: PreparedLayoutSlot, content: Readonly<LayoutBox>, direction: 'ltr' | 'rtl' = getLayoutDirection()): PreparedLayoutPlan | undefined {
  const transaction = GLOBAL_STATE.renderTransaction;
  const entry = transaction ? plans.get(transaction)?.get(slot) : undefined;
  if (!entry || entry.claimed || entry.direction !== direction ||
      entry.plan.content.width !== content.width || entry.plan.content.height !== content.height) return;
  return entry.plan;
}

/** @internal Reads a current staged Flex plan without transferring its region. */
export function peekPreparedFlexPlan(slot: PreparedLayoutSlot, content: Readonly<LayoutBox>, direction: 'ltr' | 'rtl' = getLayoutDirection()): PreparedFlexLayoutPlan | undefined {
  const plan = peekPreparedLayoutPlan(slot, content, direction);
  if (!plan) return;
  if (!plan.region || !('cached' in plan) || typeof plan.cached !== 'boolean' ||
      !('revision' in plan) || typeof plan.revision !== 'number') {
    throw new Error('Prepared Flex plan is incompatible with this baseline allocation.');
  }
  return plan as PreparedFlexLayoutPlan;
}
export function stagePreparedChildStyle(child: PibblElement<any>, receiver: object, content: Readonly<LayoutBox>, prepared: PreparedStyle): void {
  const transaction = GLOBAL_STATE.renderTransaction;
  if (!transaction) return;
  let pending = snapshots.get(transaction);
  if (!pending) {
    pending = new WeakMap(); snapshots.set(transaction, pending);
    transaction.onFinish(() => snapshots.delete(transaction));
  }
  pending.set(receiver, { child, width: content.width, height: content.height, prepared });
}
export function takePreparedChildStyle(child: PibblElement<any>, receiver?: object, content?: Readonly<LayoutBox>): PreparedStyle | undefined {
  const transaction = GLOBAL_STATE.renderTransaction;
  if (!transaction || !receiver || !content) return;
  const pending = snapshots.get(transaction), snapshot = pending?.get(receiver);
  if (!snapshot || snapshot.child !== child || snapshot.width !== content.width || snapshot.height !== content.height) return;
  pending!.delete(receiver);
  return snapshot.prepared;
}

export function hasPreparedChildStyles(): boolean {
  const transaction = GLOBAL_STATE.renderTransaction;
  return !!transaction && snapshots.has(transaction);
}


const boundaryChildren = new WeakMap<PibblRenderTransaction, Map<PreparedLayoutSlot, { children: readonly PibblElement<any>[]; direction: 'ltr' | 'rtl'; claimed: boolean; needsAllocationParent: boolean }>>();
export function stagePreparedBoundaryChildren(slot: PreparedLayoutSlot, children: readonly PibblElement<any>[]): void {
  const transaction = GLOBAL_STATE.renderTransaction!;
  let pending = boundaryChildren.get(transaction);
  if (!pending) {
    pending = new Map(); boundaryChildren.set(transaction, pending);
    const owned = pending;
    transaction.onFinish(() => { for (const [slot, entry] of owned) if (!entry.claimed) slot.dispose(); owned.clear(); boundaryChildren.delete(transaction); });
  }
  if (pending.has(slot)) throw new Error('Duplicate known layout boundary during preparation.');
  let needsAllocationParent = false;
  const numericPlans = plans.get(transaction);
  for (let index = 0; index < children.length; index++) {
    const childSlot = getElementMetadata(children[index])?.preparedLayoutSlot as PreparedLayoutSlot | undefined;
    if (childSlot && (numericPlans?.has(childSlot) || pending.get(childSlot)?.needsAllocationParent)) {
      needsAllocationParent = true;
      break;
    }
  }
  pending.set(slot, { children, direction: getLayoutDirection(), claimed: false, needsAllocationParent });
}
export function takePreparedBoundaryChildren(element: PibblElement<any>): readonly PibblElement<any>[] | undefined {
  const transaction = GLOBAL_STATE.renderTransaction;
  const slot = getElementMetadata(element)?.preparedLayoutSlot as PreparedLayoutSlot | undefined;
  if (!transaction || !slot) return;
  const entry = boundaryChildren.get(transaction)?.get(slot);
  // A retained Layer root may carry the previous transaction's private slot.
  // Only a plan staged in this transaction can be claimed; otherwise prepare anew.
  if (!entry) return;
  if (entry.claimed || entry.direction !== getLayoutDirection()) throw new Error('Prepared boundary children are stale.');
  entry.claimed = true; slot.claimBoundary(); return entry.children;
}

/**
 * Whether a staged raster boundary contains a settled numeric layout plan.
 * Opaque descendants deliberately do not count: they retain the scheduler's
 * child-first ownership path until they are themselves prepared.
 */
export function preparedBoundaryNeedsAllocationParent(element: PibblElement<any>): boolean {
  const transaction = GLOBAL_STATE.renderTransaction;
  const slot = getElementMetadata(element)?.preparedLayoutSlot as PreparedLayoutSlot | undefined;
  if (!transaction || !slot) return false;
  return plans.get(transaction)?.has(slot) === true || boundaryChildren.get(transaction)?.get(slot)?.needsAllocationParent === true;
}
/** A clean Layer keeps the mounted descendants that already own these plans. */
export function retainPreparedBoundarySubtree(element: PibblElement<any>): void {
  const transaction = GLOBAL_STATE.renderTransaction;
  const slot = getElementMetadata(element)?.preparedLayoutSlot as PreparedLayoutSlot | undefined;
  if (!transaction || !slot) return;
  retainPreparedSubtree(slot, plans.get(transaction), boundaryChildren.get(transaction));
}
function retainPreparedSubtree(parent: PreparedLayoutSlot, pending: Map<PreparedLayoutSlot, { plan: PreparedLayoutPlan; direction: 'ltr' | 'rtl'; claimed: boolean }> | undefined, boundaries: Map<PreparedLayoutSlot, { children: readonly PibblElement<any>[]; direction: 'ltr' | 'rtl'; claimed: boolean; needsAllocationParent: boolean }> | undefined): void {
  for (const entries of parent.children.values()) for (const child of entries.values()) {
    const entry = pending?.get(child);
    if (entry) entry.claimed = true;
    const boundary = boundaries?.get(child);
    if (boundary) boundary.claimed = true;
    retainPreparedSubtree(child, pending, boundaries);
  }
}


/** Carries a settled placement into known preparation without a second placement pass. */
export function preparePlacedKnownLayout(element: PibblElement<any>, occurrence: number, parentSlot?: PreparedLayoutSlot): void {
  const prepared = peekPreNormalizedStyle(element);
  if (!prepared) throw new Error('Known layout preparation requires settled receiver inputs.');
  const settled = prepared.style as Readonly<BoxStyle>;
  const width = settled.width, height = settled.height;
  if (typeof width !== 'number' || typeof height !== 'number') throw new Error('Known layout preparation requires settled content geometry.');
  const slot = preflightKnownLayout(prepared.source, prepared.style, { x: 0, y: 0, width, height }, getPrimitiveReceiverToken(element), occurrence, parentSlot);
  attachPreparedLayoutSlot(element, slot);
}


/** Recursively admits known placed roots without evaluating opaque components. */
export function prepareKnownLayoutDescendants(plan: Pick<PreparedLayoutPlan, 'children' | 'placements'>, parentSlot: PreparedLayoutSlot): void {
  let occurrences: Map<Function, number> | undefined;
  for (let index = 0; index < plan.children.length; index++) {
    const child = plan.children[index];
    if (!isKnownLayoutType(child.type) && !isLayoutComponent(child.type)) continue;
    let occurrence = 0;
    if (child.key === undefined) {
      occurrences ??= new Map(); occurrence = occurrences.get(child.type) ?? 0;
      occurrences.set(child.type, occurrence + 1);
    }
    preparePlacedKnownLayout(plan.placements[index].element, occurrence, parentSlot);
  }
}

/**
 * A native intrinsic-main query has already chosen final numeric child bounds.
 * It is scoped to this render transaction and consumed once by the matching
 * normal Flex root; no persistent layout graph or receiver receipt is retained.
 */
export interface PreparedIntrinsicMainStage {
  /** The flattened source descriptors measured by this stage. */
  readonly elements: readonly PibblElement<any>[];
  readonly axis: 'row' | 'column';
  readonly style: Readonly<BoxStyle>;
  readonly rootMin?: number;
  readonly rootMax?: number;
  readonly contentMain: number;
  /** Normal numeric-owner phases already include the final recursive bounds. */
  readonly normalOwner?: boolean;
  /** Native phase residual, distinct from final geometric remainder. */
  readonly autoMarginFreeMain?: number;
  readonly revision: number;
  readonly items: readonly Readonly<{ sourceIndex: number; target: number; min: number; max: number; measured?: boolean }>[];
}
const intrinsicMainStages = new WeakMap<PibblRenderTransaction, WeakMap<object, PreparedIntrinsicMainStage>>();
export function stagePreparedIntrinsicMain(receiver: object | undefined, stage: PreparedIntrinsicMainStage): void {
  const transaction = GLOBAL_STATE.renderTransaction;
  if (!transaction || !receiver) return;
  let pending = intrinsicMainStages.get(transaction);
  if (!pending) {
    pending = new WeakMap(); intrinsicMainStages.set(transaction, pending);
    transaction.onFinish(() => intrinsicMainStages.delete(transaction));
  }
  pending.set(receiver, stage);
}
export function peekPreparedIntrinsicMain(
  receiver: object | undefined,
  elements: readonly PibblElement<any>[],
  axis: 'row' | 'column',
  contentMain: number,
  revision: number,
): PreparedIntrinsicMainStage | undefined {
  const transaction = GLOBAL_STATE.renderTransaction;
  const stage = transaction && receiver ? intrinsicMainStages.get(transaction)?.get(receiver) : undefined;
  if (!stage || stage.axis !== axis || stage.contentMain !== contentMain || stage.revision !== revision ||
      stage.elements.length !== elements.length) return;
  for (let index = 0; index < elements.length; index++) {
    if (stage.elements[index] !== elements[index]) return;
  }
  return stage;
}
export function takePreparedIntrinsicMain(
  receiver: object | undefined, elements: readonly PibblElement<any>[],
  axis: 'row' | 'column', contentMain: number, revision: number,
): PreparedIntrinsicMainStage | undefined {
  const stage = peekPreparedIntrinsicMain(receiver, elements, axis, contentMain, revision);
  if (stage) intrinsicMainStages.get(GLOBAL_STATE.renderTransaction!)!.delete(receiver!);
  return stage;
}
