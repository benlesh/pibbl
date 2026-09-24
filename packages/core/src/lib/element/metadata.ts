import type {
  CRCRenderTransaction,
  SystemStyle,
} from '../types.js';
import type { CRCElement } from './types.js';
import type { PrimitivePresentation } from '../primitive-presentation.js';
import type { CRCBackendPrimitiveDefinition } from '../backend/types.js';

export interface CRCElementSource {
  readonly fileName: string;
  readonly lineNumber: number;
  readonly columnNumber: number;
}

export interface InternalElementMetadata {
  readonly source?: CRCElementSource;
  readonly specifiedStyle?: Readonly<SystemStyle>;
  readonly primitiveProgramProps?: Readonly<Record<PropertyKey, unknown>>;
  readonly primitiveReceiverToken?: object;
  readonly policyPreparationSource?: CRCElement<any>;
  identityHint?: unknown;
}

const elementMetadata = new WeakMap<CRCElement<any>, InternalElementMetadata>();
const elementCloneMetadataHandlers = new Set<(
  source: CRCElement<any>,
  clone: CRCElement<any>,
) => void>();
const primitiveDefinitions = new WeakMap<Function, PrimitiveDefinition>();
const primitiveDefinitionTypes = new WeakMap<PrimitiveDefinition, Function>();
const primitivePresentationResolvers = new WeakMap<
  Function,
  (style: Readonly<any>) => Readonly<PrimitivePresentation> | undefined
>();
const policyDefinitions = new WeakMap<Function, ElementPolicyDefinition>();
const childPrimitiveReceiverTransactions = new WeakMap<
  CRCRenderTransaction,
  WeakMap<object, Map<number, object>>
>();

export interface PrimitiveDefinition<
  P = any,
  S extends SystemStyle = SystemStyle,
  N extends SystemStyle = S,
  R extends SystemStyle = N,
> extends CRCBackendPrimitiveDefinition<P, S, N, R> {}

export interface ElementPolicyDefinition {
  readonly prepare: (
    policy: CRCElement<any>,
    child: CRCElement<any>,
  ) => CRCElement<any>;
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
  if (!definition) throw new TypeError('Can only derive a CRC primitive component.');
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
  element: CRCElement<any>,
  metadata: InternalElementMetadata,
): void {
  elementMetadata.set(element, metadata);
}

/** @internal */
export function getElementMetadata(
  element: CRCElement<any>,
): InternalElementMetadata | undefined {
  return elementMetadata.get(element);
}

/** @internal Retains the original measurable identity behind policy clones. */
export function setPolicyPreparationSource(
  element: CRCElement<any>,
  source: CRCElement<any>,
): void {
  elementMetadata.set(element, {
    ...elementMetadata.get(element),
    policyPreparationSource: source,
  });
}

/** @internal Reads the original measurable identity behind policy clones. */
export function getPolicyPreparationSource(
  element: CRCElement<any>,
): CRCElement<any> | undefined {
  return elementMetadata.get(element)?.policyPreparationSource;
}

/** @internal Registers private WeakMap-backed annotations for immutable clones. */
export function registerElementCloneMetadataHandler(
  handler: (source: CRCElement<any>, clone: CRCElement<any>) => void,
): void {
  elementCloneMetadataHandlers.add(handler);
}

/** @internal Copies every registered private annotation to a finalized clone. */
export function copyElementCloneMetadata(
  source: CRCElement<any>,
  clone: CRCElement<any>,
): void {
  for (const handler of elementCloneMetadataHandlers) handler(source, clone);
}

/** @internal */
export function getElementSource(
  element: CRCElement<any>,
): CRCElementSource | undefined {
  return elementMetadata.get(element)?.source;
}

/** @internal */
export function getSpecifiedStyle<S extends SystemStyle>(
  element: CRCElement<{ style?: S }>,
): Readonly<S> | undefined {
  return element.props.style;
}

/** @internal Returns program props with primitive-owned style removed. */
export function getPrimitiveProgramProps<P>(element: CRCElement<any>): P {
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
  element: CRCElement<any>,
  token: object,
): void {
  const current = elementMetadata.get(element) ?? {};
  elementMetadata.set(element, { ...current, primitiveReceiverToken: token });
}

/** @internal Reads the occurrence token carried by an internal clone. */
export function getPrimitiveReceiverToken(
  element: CRCElement<any>,
): object | undefined {
  return elementMetadata.get(element)?.primitiveReceiverToken;
}

/** @internal Creates one receiver identity for a standalone measurement. */
export function createPrimitiveReceiverToken(): object {
  return {};
}

/** @internal Reuses a direct-child occurrence across layout measurement and paint. */
export function getChildPrimitiveReceiverToken(
  transaction: CRCRenderTransaction | undefined,
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
export function getPlacementIdentityHint<T>(element: CRCElement<any>): T | undefined {
  return elementMetadata.get(element)?.identityHint as T | undefined;
}

/** @internal Stores the private identity override for a placed element. */
export function setPlacementIdentityHint<T>(element: CRCElement<any>, value: T): void {
  const current = elementMetadata.get(element) ?? {};
  elementMetadata.set(element, { ...current, identityHint: value });
}
