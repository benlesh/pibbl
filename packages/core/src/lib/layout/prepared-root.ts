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

type PreparedStyle = Readonly<SystemStyle> | ResponsiveStylePreparation<Readonly<SystemStyle>>;
type Preflight = (element: PibblElement<any>, style: Readonly<SystemStyle>, content: Readonly<LayoutBox>, receiver: object, slot: PreparedLayoutSlot) => void;
const preflights = new WeakMap<Function, Preflight>();
export function isKnownLayoutType(type: Function): boolean { return preflights.has(type); }
const snapshots = new WeakMap<PibblRenderTransaction, WeakMap<object, { child: PibblElement<any>; width: number; height: number; prepared: PreparedStyle }>>();

/** Registers only known declarative input preparation, never component evaluation. */
export function registerKnownLayoutPreflight(type: Function, preflight: Preflight): void { preflights.set(type, preflight); }
export function preflightKnownLayout(element: PibblElement<any>, style: Readonly<SystemStyle>, content: Readonly<LayoutBox>, receiver?: object, occurrence = 0, parentSlot?: PreparedLayoutSlot): PreparedLayoutSlot | undefined {
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
  preflight(root, style, content, rootReceiver, slot);
  return slot;
  } finally { visiting.delete(source); }
}
export function attachPreparedLayoutSlot(element: PibblElement<any>, slot?: PreparedLayoutSlot): void {
  if (slot) setElementMetadata(element, { ...getElementMetadata(element), preparedLayoutSlot: slot });
}
export interface PreparedLayoutPlan {
  readonly region: LayoutRegion;
  readonly content: Readonly<LayoutBox>;
  readonly children: readonly PibblElement<any>[];
  readonly placements: { box: LayoutBox; usedWidth: number; usedHeight: number; element: PibblElement<any> }[];
  readonly cached: boolean;
  readonly revision: number;
}
export class PreparedLayoutSlot {
  region: LayoutRegion | undefined;
  private boundaryOwner: PibblComponentRefs<any> | undefined;
  claimBoundary(): void {
    const refs = GLOBAL_STATE.componentRefs!;
    if (this.boundaryOwner === refs) return;
    this.boundaryOwner = refs; refs.teardowns.add(() => this.dispose());
  }
  readonly children = new Map<Function, Map<string, PreparedLayoutSlot>>();
  private disposeChildren(): void {
    for (const entries of this.children.values()) for (const child of entries.values()) child.dispose();
    this.children.clear();
  }
  private readonly rootType: Function;
  private readonly rootKey: string | undefined;
  private readonly release: () => void;
  constructor(private readonly owner: PibblInstance, options: { rootType: Function; rootKey?: string; release: () => void }) {
    this.rootType = options.rootType; this.rootKey = options.rootKey; this.release = options.release;
  }
  matchesRoot(root: PibblElement<any>): boolean { return this.rootType === root.type && this.rootKey === root.key; }
  acquire(): LayoutRegion { return this.region ??= new LayoutRegion(this.owner); }
  dispose(): void { const region = this.region; this.region = undefined; this.boundaryOwner = undefined; try { this.disposeChildren(); region?.dispose(); } finally { this.release(); } }
  claim(region: LayoutRegion): void {
    if (this.region !== region) throw new Error('Prepared layout region is stale.');
    adoptMountedLayoutRegion(region, () => { if (this.region === region) { this.region = undefined; this.disposeChildren(); this.release(); } });
  }
}
const activeDescriptions = new WeakMap<PibblRenderTransaction, Set<PibblElement<any>>>();
const slots = new WeakMap<PibblComponentRefs<any>, Map<Function, Map<string, PreparedLayoutSlot>>>();
const plans = new WeakMap<PibblRenderTransaction, Map<PreparedLayoutSlot, { plan: PreparedLayoutPlan; claimed: boolean }>>();
export function stagePreparedLayoutPlan(slot: PreparedLayoutSlot, plan: PreparedLayoutPlan): void {
  const transaction = GLOBAL_STATE.renderTransaction!;
  let pending = plans.get(transaction);
  if (!pending) {
    pending = new Map(); plans.set(transaction, pending);
    const owned = pending;
    transaction.onFinish(() => { for (const [slot, entry] of owned) if (!entry.claimed) slot.dispose(); owned.clear(); plans.delete(transaction); });
  }
  if (pending.has(slot)) throw new Error('Duplicate known layout occurrence during preparation.');
  pending.set(slot, { plan, claimed: false });
}
export function claimPreparedLayoutPlan(element: PibblElement<any>, content: Readonly<LayoutBox>): PreparedLayoutPlan | undefined {
  const transaction = GLOBAL_STATE.renderTransaction;
  const slot = getElementMetadata(element)?.preparedLayoutSlot as PreparedLayoutSlot | undefined;
  if (!transaction || !slot) return;
  const entry = plans.get(transaction)?.get(slot);
  if (!entry || entry.claimed || entry.plan.content.width !== content.width || entry.plan.content.height !== content.height) throw new Error('Prepared layout plan does not match its allocation.');
  slot.claim(entry.plan.region); entry.claimed = true;
  return entry.plan;
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


const boundaryChildren = new WeakMap<PibblRenderTransaction, Map<PreparedLayoutSlot, { children: readonly PibblElement<any>[]; claimed: boolean }>>();
export function stagePreparedBoundaryChildren(slot: PreparedLayoutSlot, children: readonly PibblElement<any>[]): void {
  const transaction = GLOBAL_STATE.renderTransaction!;
  let pending = boundaryChildren.get(transaction);
  if (!pending) {
    pending = new Map(); boundaryChildren.set(transaction, pending);
    const owned = pending;
    transaction.onFinish(() => { for (const [slot, entry] of owned) if (!entry.claimed) slot.dispose(); owned.clear(); boundaryChildren.delete(transaction); });
  }
  if (pending.has(slot)) throw new Error('Duplicate known layout boundary during preparation.');
  pending.set(slot, { children, claimed: false });
}
export function takePreparedBoundaryChildren(element: PibblElement<any>): readonly PibblElement<any>[] | undefined {
  const transaction = GLOBAL_STATE.renderTransaction;
  const slot = getElementMetadata(element)?.preparedLayoutSlot as PreparedLayoutSlot | undefined;
  if (!transaction || !slot) return;
  const entry = boundaryChildren.get(transaction)?.get(slot);
  if (!entry || entry.claimed) throw new Error('Prepared boundary children are stale.');
  entry.claimed = true; slot.claimBoundary(); return entry.children;
}
/** A clean Layer keeps the mounted descendants that already own these plans. */
export function retainPreparedBoundarySubtree(element: PibblElement<any>): void {
  const transaction = GLOBAL_STATE.renderTransaction;
  const slot = getElementMetadata(element)?.preparedLayoutSlot as PreparedLayoutSlot | undefined;
  if (!transaction || !slot) return;
  retainPreparedSubtree(slot, plans.get(transaction));
}
function retainPreparedSubtree(parent: PreparedLayoutSlot, pending: Map<PreparedLayoutSlot, { plan: PreparedLayoutPlan; claimed: boolean }> | undefined): void {
  for (const entries of parent.children.values()) for (const child of entries.values()) {
    const entry = pending?.get(child);
    if (entry) entry.claimed = true;
    retainPreparedSubtree(child, pending);
  }
}


/** Carries a settled placement into known preparation without a second placement pass. */
export function preparePlacedKnownLayout(element: PibblElement<any>, occurrence: number): void {
  const prepared = peekPreNormalizedStyle(element);
  if (!prepared) throw new Error('Known layout preparation requires settled receiver inputs.');
  const settled = prepared.style as Readonly<BoxStyle>;
  const width = settled.width, height = settled.height;
  if (typeof width !== 'number' || typeof height !== 'number') throw new Error('Known layout preparation requires settled content geometry.');
  const slot = preflightKnownLayout(prepared.source, prepared.style, { x: 0, y: 0, width, height }, getPrimitiveReceiverToken(element), occurrence);
  attachPreparedLayoutSlot(element, slot);
}
