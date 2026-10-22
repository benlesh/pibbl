import { GLOBAL_STATE } from '../global-state.js';
import type { PibblElement } from '../element/types.js';
import type { PibblRenderTransaction, SystemStyle } from '../types.js';
import type { ResponsiveStylePreparation } from '../style/responsive.js';
import type { LayoutBox } from './types.js';

type PreparedStyle = Readonly<SystemStyle> | ResponsiveStylePreparation<Readonly<SystemStyle>>;
type Preflight = (element: PibblElement<any>, style: Readonly<SystemStyle>, content: Readonly<LayoutBox>, receiver: object) => void;
const preflights = new WeakMap<Function, Preflight>();
const snapshots = new WeakMap<PibblRenderTransaction, WeakMap<object, { child: PibblElement<any>; width: number; height: number; prepared: PreparedStyle }>>();

/** Registers only known declarative input preparation, never component evaluation. */
export function registerKnownLayoutPreflight(type: Function, preflight: Preflight): void { preflights.set(type, preflight); }
export function preflightKnownLayout(element: PibblElement<any>, style: Readonly<SystemStyle>, content: Readonly<LayoutBox>, receiver?: object): void {
  if (receiver && GLOBAL_STATE.renderTransaction) preflights.get(element.type)?.(element, style, content, receiver);
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
