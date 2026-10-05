import {
  getElementEnhancerDescriptors,
  type CRCElementEnhancerDescriptor,
} from '../element-enhancers.js';
import { materializeContainerChildren } from '../element/children.js';
import { isCRCElement } from '../element/create-element.js';
import type { CRCElement, CRCNodeInput } from '../element/types.js';

interface LayerElementSnapshot {
  readonly kind: 'element';
  readonly type: CRCElement<any>['type'];
  readonly key: string | undefined;
  readonly enhancers: readonly CRCElementEnhancerDescriptor[];
  readonly nonChildProps: readonly LayerPropertySnapshot[];
  readonly style: readonly LayerPropertySnapshot[];
  readonly children: LayerNodeSnapshot;
}

interface LayerArraySnapshot {
  readonly kind: 'array';
  readonly children: readonly LayerNodeSnapshot[];
}

interface LayerOpaqueSnapshot {
  readonly kind: 'opaque';
  readonly value: unknown;
}

interface LayerPropertySnapshot {
  readonly key: PropertyKey;
  readonly value: unknown;
}

/**
 * Captured element structure used to compare managed-layer inputs.
 *
 * @see {@link haveSameLayerNodeTree}
 * @see {@link snapshotLayerNodeTree}
 */
export type LayerNodeSnapshot =
  | LayerElementSnapshot
  | LayerArraySnapshot
  | LayerOpaqueSnapshot;

/**
 * Materializes retained Layer children once before a private renderer owns them.
 *
 * @param node - Recursive child structure to materialize. See {@link CRCNodeInput}.
 * @param receiver - Receiver name used in invalid-child diagnostics.
 * @returns The ordered element descriptors retained by the layer. See {@link CRCElement}.
 *
 * @see {@link CRCNodeInput}
 * @see {@link CRCElement}
 */
export function materializeRetainedLayerChildren(
  node: CRCNodeInput,
  receiver: string,
): readonly CRCElement<any>[] {
  return materializeContainerChildren(node, receiver);
}

/**
 * Captures Layer's successfully rendered tree without retaining mutable
 * author-owned containers. Direct Layer children are already materialized;
 * nested opaque iterables remain identity values and are never evaluated.
 *
 * @param node - Node tree to record.
 * @returns A snapshot used for subsequent structural equality checks. See
 * {@link LayerNodeSnapshot} .
 *
 * @see {@link LayerNodeSnapshot}
 */
export function snapshotLayerNodeTree(node: unknown): LayerNodeSnapshot {
  if (isCRCElement(node)) {
    const props = splitProps(node.props);
    return Object.freeze({
      kind: 'element',
      type: node.type,
      key: node.key,
      enhancers: Object.freeze([...getElementEnhancerDescriptors(node)]),
      nonChildProps: snapshotProperties(props.nonChild),
      style: snapshotProperties(props.style),
      children: snapshotLayerNodeTree(props.children),
    });
  }

  if (Array.isArray(node)) {
    return Object.freeze({
      kind: 'array',
      children: Object.freeze(node.map(snapshotLayerNodeTree)),
    });
  }

  return Object.freeze({ kind: 'opaque', value: node });
}

/**
 * Compares an immutable successful-render snapshot with an already-materialized
 * candidate tree. Opaque nested iterables compare only by identity.
 *
 * @param snapshot - Previously recorded node-tree snapshot, if any. See {@link LayerNodeSnapshot}.
 * @param node - Current node tree to compare.
 * @returns Whether the current tree matches the retained snapshot.
 *
 * @see {@link LayerNodeSnapshot}
 */
export function haveSameLayerNodeTree(
  snapshot: LayerNodeSnapshot | undefined,
  node: unknown,
): boolean {
  if (!snapshot) return false;

  switch (snapshot.kind) {
    case 'element':
      return isCRCElement(node) && haveSameLayerElement(snapshot, node);
    case 'array':
      return Array.isArray(node) &&
        snapshot.children.length === node.length &&
        snapshot.children.every((child, index) =>
          haveSameLayerNodeTree(child, node[index])
        );
    case 'opaque':
      return snapshot.value === node;
  }
}

function haveSameLayerElement(
  snapshot: LayerElementSnapshot,
  element: CRCElement<any>,
): boolean {
  if (snapshot.type !== element.type || snapshot.key !== element.key) {
    return false;
  }

  const enhancers = getElementEnhancerDescriptors(element);
  if (
    snapshot.enhancers.length !== enhancers.length ||
    !snapshot.enhancers.every((descriptor, index) =>
      descriptor === enhancers[index]
    )
  ) {
    return false;
  }

  const props = splitProps(element.props);
  return haveSameProperties(snapshot.nonChildProps, props.nonChild) &&
    haveSameProperties(snapshot.style, props.style) &&
    haveSameLayerNodeTree(snapshot.children, props.children);
}

function snapshotProperties(
  value: Readonly<Record<PropertyKey, unknown>>,
): readonly LayerPropertySnapshot[] {
  return Object.freeze(enumerableOwnKeys(value).map(key => Object.freeze({
    key,
    value: value[key],
  })));
}

function haveSameProperties(
  snapshot: readonly LayerPropertySnapshot[],
  value: Readonly<Record<PropertyKey, unknown>>,
): boolean {
  const keys = enumerableOwnKeys(value);
  return snapshot.length === keys.length && snapshot.every(property =>
    Object.prototype.propertyIsEnumerable.call(value, property.key) &&
    value[property.key] === property.value
  );
}

function enumerableOwnKeys(
  value: Readonly<Record<PropertyKey, unknown>>,
): readonly PropertyKey[] {
  return Reflect.ownKeys(value).filter(key =>
    Object.prototype.propertyIsEnumerable.call(value, key)
  );
}

function splitProps(props: Readonly<Record<PropertyKey, unknown>>): {
  children: unknown;
  nonChild: Readonly<Record<PropertyKey, unknown>>;
  style: Readonly<Record<PropertyKey, unknown>>;
} {
  const {
    children,
    style,
    ...nonChild
  } = props as Readonly<{
    children?: unknown;
    style?: Readonly<Record<PropertyKey, unknown>>;
    [key: PropertyKey]: unknown;
  }>;
  return {
    children,
    nonChild,
    style: style ?? EMPTY_PROPS,
  };
}

const EMPTY_PROPS: Readonly<Record<PropertyKey, unknown>> = Object.freeze({});
