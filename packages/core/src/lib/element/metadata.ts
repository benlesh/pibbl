import type { PibblBackendPrimitiveInput } from '../backend/types.js';
import type { PibblInternalPrimitiveAttachmentInput } from '../element-enhancers.js';
import type { getCurrentElementSource } from '../../internal.js';
import type {
  PibblRenderTransaction,
  SystemStyle,
} from '../types.js';
import type { PibblElement } from './types.js';
import type { PrimitivePresentation } from '../primitive-presentation.js';
import type { PibblBackendPrimitiveDefinition } from '../backend/types.js';

/**
 * Authoring source location attached to an element for diagnostics.
 *
 * @see {@link PibblBackendPrimitiveInput}
 * @see {@link PibblInternalPrimitiveAttachmentInput}
 * @see {@link getCurrentElementSource}
 */
export interface PibblElementSource {
  /** Source filename recorded for diagnostics. See {@link PibblElementSource}. */
  readonly fileName: string;
  /** Source line recorded for diagnostics. See {@link PibblElementSource}. */
  readonly lineNumber: number;
  /** Source column recorded for diagnostics. See {@link PibblElementSource}. */
  readonly columnNumber: number;
}

export interface InternalElementMetadata {
  readonly source?: PibblElementSource;
  readonly specifiedStyle?: Readonly<SystemStyle>;
  readonly primitiveProgramProps?: Readonly<Record<PropertyKey, unknown>>;
  readonly primitiveReceiverToken?: object;
  readonly policyPreparationSource?: PibblElement<any>;
  identityHint?: unknown;
  placementConsumed?: boolean;
  placementSignalHandoff?: Readonly<SystemStyle>;
}

const elementMetadata = new WeakMap<PibblElement<any>, InternalElementMetadata>();
const elementCloneMetadataHandlers = new Set<(
  source: PibblElement<any>,
  clone: PibblElement<any>,
) => void>();
const primitiveDefinitions = new WeakMap<Function, PrimitiveDefinition>();
const primitiveDefinitionTypes = new WeakMap<PrimitiveDefinition, Function>();
const primitivePresentationResolvers = new WeakMap<
  Function,
  (style: Readonly<any>) => Readonly<PrimitivePresentation> | undefined
>();
const policyDefinitions = new WeakMap<Function, ElementPolicyDefinition>();
const childPrimitiveReceiverTransactions = new WeakMap<
  PibblRenderTransaction,
  WeakMap<object, Map<number, object>>
>();

export interface PrimitiveDefinition<
  P = any,
  S extends SystemStyle = SystemStyle,
  N extends SystemStyle = S,
  R extends SystemStyle = N,
> extends PibblBackendPrimitiveDefinition<P, S, N, R> {}

export interface ElementPolicyDefinition {
  readonly prepare: (
    policy: PibblElement<any>,
    child: PibblElement<any>,
  ) => PibblElement<any>;
}

/** @internal Registers the platform behavior for one component value. */
export function setPrimitiveDefinition<
  P,
  S extends SystemStyle,
  N extends SystemStyle,
  R extends SystemStyle,
>(
  type: Function,
  definition: PrimitiveDefinition<P, S, N, R>,
): void {
  const erased = definition as PrimitiveDefinition;
  primitiveDefinitions.set(type, erased);
  primitiveDefinitionTypes.set(erased, type);
}

/** @internal Reads platform behavior without attaching fields to a function. */
export function getPrimitiveDefinition(
  type: Function,
): PrimitiveDefinition | undefined {
  return primitiveDefinitions.get(type);
}

/** @internal Copies one primitive definition and presentation onto a new identity. */
export function derivePrimitiveMetadata(source: Function, derived: Function): void {
  const definition = primitiveDefinitions.get(source);
  if (!definition) throw new TypeError('Can only derive a Pibbl primitive component.');
  setPrimitiveDefinition(derived, { ...definition });
  const presentation = primitivePresentationResolvers.get(source);
  if (presentation) primitivePresentationResolvers.set(derived, presentation);
}

/** @internal Resolves Canvas presentation behavior from erased backend input. */
export function getDefinitionPrimitivePresentation<S>(
  definition: PrimitiveDefinition,
  style: Readonly<S>,
): Readonly<PrimitivePresentation> | undefined {
  const type = primitiveDefinitionTypes.get(definition);
  return type ? getPrimitivePresentation(type, style) : undefined;
}

/** @internal Registers private presentation behavior for one primitive. */
export function setPrimitivePresentation<S>(
  type: Function,
  resolve: (
    style: Readonly<S>,
  ) => Readonly<PrimitivePresentation> | undefined,
): void {
  primitivePresentationResolvers.set(type, resolve);
}

/** @internal Resolves private presentation behavior for one primitive. */
export function getPrimitivePresentation<S>(
  type: Function,
  style: Readonly<S>,
): Readonly<PrimitivePresentation> | undefined {
  return primitivePresentationResolvers.get(type)?.(style);
}

/** @internal Registers an identity-transparent element preparation policy. */
export function setElementPolicyDefinition(
  type: Function,
  definition: ElementPolicyDefinition,
): void {
  policyDefinitions.set(type, definition);
}

/** @internal Reads a policy before ordinary component identity is assigned. */
export function getElementPolicyDefinition(
  type: Function,
): ElementPolicyDefinition | undefined {
  return policyDefinitions.get(type);
}

/** @internal */
export function setElementMetadata(
  element: PibblElement<any>,
  metadata: InternalElementMetadata,
): void {
  elementMetadata.set(element, metadata);
}

/** @internal */
export function getElementMetadata(
  element: PibblElement<any>,
): InternalElementMetadata | undefined {
  return elementMetadata.get(element);
}

/** @internal Retains the original measurable identity behind policy clones. */
export function setPolicyPreparationSource(
  element: PibblElement<any>,
  source: PibblElement<any>,
): void {
  elementMetadata.set(element, {
    ...elementMetadata.get(element),
    policyPreparationSource: source,
  });
}

/** @internal Reads the original measurable identity behind policy clones. */
export function getPolicyPreparationSource(
  element: PibblElement<any>,
): PibblElement<any> | undefined {
  return elementMetadata.get(element)?.policyPreparationSource;
}

/** @internal Registers private WeakMap-backed annotations for immutable clones. */
export function registerElementCloneMetadataHandler(
  handler: (source: PibblElement<any>, clone: PibblElement<any>) => void,
): void {
  elementCloneMetadataHandlers.add(handler);
}

/** @internal Copies every registered private annotation to a finalized clone. */
export function copyElementCloneMetadata(
  source: PibblElement<any>,
  clone: PibblElement<any>,
): void {
  for (const handler of elementCloneMetadataHandlers) handler(source, clone);
}

/** @internal */
export function getElementSource(
  element: PibblElement<any>,
): PibblElementSource | undefined {
  return elementMetadata.get(element)?.source;
}

/** @internal */
export function getSpecifiedStyle<S extends SystemStyle>(
  element: PibblElement<{ style?: S }>,
): Readonly<S> | undefined {
  return element.props.style;
}

/** @internal Returns program props with primitive-owned style removed. */
export function getPrimitiveProgramProps<P>(element: PibblElement<any>): P {
  const prepared = elementMetadata.get(element)?.primitiveProgramProps;
  if (prepared !== undefined) return prepared as P;
  const { style: _style, ...programProps } = element.props as {
    readonly style?: unknown;
    readonly [key: PropertyKey]: unknown;
  };
  return programProps as P;
}

/** @internal Associates measurement and paint clones for one occurrence. */
export function setPrimitiveReceiverToken(
  element: PibblElement<any>,
  token: object,
): void {
  const current = elementMetadata.get(element) ?? {};
  elementMetadata.set(element, { ...current, primitiveReceiverToken: token });
}

/** @internal Reads the occurrence token carried by an internal clone. */
export function getPrimitiveReceiverToken(
  element: PibblElement<any>,
): object | undefined {
  return elementMetadata.get(element)?.primitiveReceiverToken;
}

/** @internal Creates one receiver identity for a standalone measurement. */
export function createPrimitiveReceiverToken(): object {
  return {};
}

/** @internal Reuses a direct-child occurrence across layout measurement and paint. */
export function getChildPrimitiveReceiverToken(
  transaction: PibblRenderTransaction | undefined,
  parent: object | undefined,
  occurrence: number,
): object {
  if (!transaction || !parent) return createPrimitiveReceiverToken();
  let parents = childPrimitiveReceiverTransactions.get(transaction);
  if (!parents) {
    parents = new WeakMap();
    childPrimitiveReceiverTransactions.set(transaction, parents);
  }
  let children = parents.get(parent);
  if (!children) {
    children = new Map();
    parents.set(parent, children);
  }
  let token = children.get(occurrence);
  if (!token) {
    token = createPrimitiveReceiverToken();
    children.set(occurrence, token);
  }
  return token;
}

/** @internal Reads the private identity override for a placed element. */
export function getPlacementIdentityHint<T>(element: PibblElement<any>): T | undefined {
  return elementMetadata.get(element)?.identityHint as T | undefined;
}

/** @internal Stores the private identity override for a placed element. */
export function setPlacementIdentityHint<T>(element: PibblElement<any>, value: T): void {
  const current = elementMetadata.get(element) ?? {};
  elementMetadata.set(element, { ...current, identityHint: value });
}

const opaquePrimitiveProps = new WeakMap<Function, readonly string[]>();
/** @internal Built-in opaque payloads, without widening definePrimitive's API. */
export function registerOpaquePrimitiveProps(type: Function, keys: readonly string[]): void {
  opaquePrimitiveProps.set(type, keys);
}
export function getOpaquePrimitiveProps(type: Function): readonly string[] | undefined {
  return opaquePrimitiveProps.get(type);
}

/** @internal Marks authored left/top as consumed by a parent layout wrapper. */
export function setPlacementConsumed(element: PibblElement<any>): void {
  const current = elementMetadata.get(element) ?? {};
  elementMetadata.set(element, { ...current, placementConsumed: true });
}

/** @internal */
export function isPlacementConsumed(element: PibblElement<any>): boolean {
  return elementMetadata.get(element)?.placementConsumed === true;
}


/** @internal Marks an element created with a forwarded placement style signal. */
export function setPlacementSignalHandoff(
  element: PibblElement<any>,
  style: Readonly<SystemStyle>,
): void {
  const current = elementMetadata.get(element) ?? {};
  elementMetadata.set(element, { ...current, placementSignalHandoff: style });
}

/** @internal */
export function getPlacementSignalHandoffStyle(
  element: PibblElement<any>,
): Readonly<SystemStyle> | undefined {
  return elementMetadata.get(element)?.placementSignalHandoff;
}
