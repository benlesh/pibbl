import type { PibblComponent, PibblElement, PibblNodeInput } from '../element/types.js';
import { clonePibblElement } from '../element/create-element.js';
import { materializeContainerChildren } from '../element/children.js';
import { getChildPrimitiveReceiverToken, getElementMetadata, setElementMetadata, getPrimitiveDefinition, getPrimitiveReceiverToken, setPrimitiveReceiverToken } from '../element/metadata.js';
import { GLOBAL_STATE } from '../global-state.js';
import { withHooksForbidden } from '../hooks/hook-slot.js';
import { withSignalWriteForbidden } from '../signals/graph.js';
import { adoptReceiverInputProvision, withReceiverInputProvision } from '../signals/input-provision.js';
import type { PibblRenderTransaction } from '../types.js';
import { withIsolatedRenderState } from './measure.js';
import { setPreNormalizedStyle, type PreparedStyleInput } from '../style/resolve-dispatch.js';

const definitions = new WeakMap<Function, (props: any) => PibblNodeInput>();
const transactions = new WeakMap<PibblRenderTransaction, WeakMap<object, PibblElement<any>>>();

/**
 * Defines pure reusable structure that a parent can inspect before allocation.
 * The description returns one drawing or layout primitive root, optionally inside
 * transparent fragments. Forward any authored style explicitly to that root.
 * Signal reads are supported; hooks, Canvas/allocation reads, writes and resource
 * creation are excluded. Descriptions are shared only within one transaction.
 *
 * @param describe - Pure synchronous description using authored readonly props.
 * @returns A component for JSX or createElement, preserving normal type/key identity.
 * @throws When called directly, or when its description has no single primitive root.
 * @see {@link PibblComponent}
 * @see {@link PibblNodeInput}
 */
export function defineLayoutComponent<P>(
  describe: (props: Readonly<P>) => PibblNodeInput,
): PibblComponent<P> {
  if (typeof describe !== 'function') throw new TypeError('A layout description must be a function.');
  const component: PibblComponent<P> = function LayoutComponent() {
    throw new Error('Mount layout components through JSX or createElement; do not call them directly.');
  };
  definitions.set(component, describe);
  return component;
}

export function isLayoutComponent(type: Function): boolean { return definitions.has(type); }

/** One prepared root per layout occurrence, never cached by mutable prop identity. */
export function prepareLayoutComponent(
  element: PibblElement<any>, options?: { receiverToken?: object },
): PibblElement<any> {
  const describe = definitions.get(element.type);
  if (!describe) throw new Error('The element has no structural layout description.');
  const transaction = GLOBAL_STATE.renderTransaction;
  const receiver = options?.receiverToken ?? getPrimitiveReceiverToken(element) ??
    (GLOBAL_STATE.componentRefs?.element === element ? GLOBAL_STATE.componentRefs : element);
  let prepared = transaction ? transactions.get(transaction) : undefined;
  const cached = prepared?.get(receiver);
  if (cached) return cached;
  const root = withHooksForbidden('Hooks are forbidden in a layout description.', () =>
    withSignalWriteForbidden('Signal writes are forbidden in a layout description.', () =>
      withIsolatedRenderState(() => withReceiverInputProvision(transaction, receiver, () => {
        const roots = materializeContainerChildren(describe(element.props), element);
        if (roots.length !== 1 || !getPrimitiveDefinition(roots[0].type)) {
          throw new Error('A layout description must return exactly one drawing or layout primitive root.');
        }
        const root = clonePibblElement(roots[0]);
        setElementMetadata(root, {
          ...getElementMetadata(root),
          layoutDescriptionSource: getElementMetadata(roots[0])?.layoutDescriptionSource ?? roots[0],
        });
        return root;
      })),
    ),
  );
  const current = GLOBAL_STATE.componentRefs;
  if (current && (getPrimitiveReceiverToken(current.element) ?? current) === receiver) {
    adoptReceiverInputProvision(transaction, receiver);
  }
  setPrimitiveReceiverToken(root, getChildPrimitiveReceiverToken(transaction, receiver, 0));
  if (transaction) {
    if (!prepared) { prepared = new WeakMap(); transactions.set(transaction, prepared); }
    prepared.set(receiver, root);
  }
  return root;
}

/** Carries the parent's settled content size into the same prepared root. */
export function placedLayoutComponentRoot(element: PibblElement<any>, style?: PreparedStyleInput): PibblElement<any> {
  const root = prepareLayoutComponent(element);
  const slot = getElementMetadata(element)?.preparedLayoutSlot;
  if (!style && !slot) return root;
  const placed = clonePibblElement(root);
  if (style) setPreNormalizedStyle(placed, style.style, root, getPrimitiveReceiverToken(root), style.query);
  if (slot) setElementMetadata(placed, { ...getElementMetadata(placed), preparedLayoutSlot: slot });
  return placed;
}
