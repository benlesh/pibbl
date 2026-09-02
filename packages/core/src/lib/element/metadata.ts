import type {
  MeasureInput,
  MeasureResult,
  NormalizedStyle,
  PrimitiveProgramProps,
  CRCRenderTransaction,
  RenderingContext2D,
  ResolvedStyle,
  SpecifiedStyle,
  StyleResolutionContext,
  SystemStyle,
} from '../types.js';
import type { CRCElement } from './types.js';

export interface CRCElementSource {
  readonly fileName: string;
  readonly lineNumber: number;
  readonly columnNumber: number;
}

export interface InternalElementMetadata {
  readonly source?: CRCElementSource;
  readonly specifiedStyle?: Readonly<SystemStyle>;
  readonly legacyProgramProps?: unknown;
  readonly primitiveReceiverToken?: object;
  identityHint?: unknown;
}

const elementMetadata = new WeakMap<CRCElement<any>, InternalElementMetadata>();
const elementCloneMetadataHandlers = new Set<(
  source: CRCElement<any>,
  clone: CRCElement<any>,
) => void>();
const primitiveDefinitions = new WeakMap<Function, PrimitiveDefinition>();
const childPrimitiveReceiverTransactions = new WeakMap<
  CRCRenderTransaction,
  WeakMap<object, Map<number, object>>
>();

export interface PrimitiveDefinition<
  P = any,
  S extends SystemStyle = SystemStyle,
  N extends SystemStyle = S,
  R extends SystemStyle = N,
> {
  readonly render: (
    props: Readonly<PrimitiveProgramProps<P>>,
    style: ResolvedStyle<R>,
    context: RenderingContext2D,
  ) => import('./types.js').CRCNode[] | import('./types.js').CRCNode | void;
  readonly normalizeStyle?: (
    style: SpecifiedStyle<S>,
  ) => NormalizedStyle<N>;
  readonly resolveStyle?: (
    style: NormalizedStyle<N>,
    context: Readonly<StyleResolutionContext>,
  ) => ResolvedStyle<R>;
  readonly measure?: (
    input: MeasureInput<PrimitiveProgramProps<P>, N>,
  ) => MeasureResult;
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
  primitiveDefinitions.set(type, definition as PrimitiveDefinition);
}

/** @internal Reads platform behavior without attaching fields to a function. */
export function getPrimitiveDefinition(
  type: Function,
): PrimitiveDefinition | undefined {
  return primitiveDefinitions.get(type);
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

/** @internal Temporary bridge while defineComp still strips style from callbacks. */
export function getLegacyProgramProps<P>(element: CRCElement<any>): P | undefined {
  return elementMetadata.get(element)?.legacyProgramProps as P | undefined;
}

/** @internal Temporary bridge while defineComp still strips style from callbacks. */
export function setLegacyProgramProps<P>(element: CRCElement<any>, props: P): void {
  const current = elementMetadata.get(element) ?? {};
  elementMetadata.set(element, { ...current, legacyProgramProps: props });
}

/** @internal Returns program props with primitive-owned style removed. */
export function getPrimitiveProgramProps<P>(element: CRCElement<any>): P {
  const legacy = getLegacyProgramProps<P>(element);
  if (legacy !== undefined) return legacy;
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

/** @internal Temporary bridge for the legacy placement identity field. */
export function getLegacyIdentityHint<T>(element: CRCElement<any>): T | undefined {
  return elementMetadata.get(element)?.identityHint as T | undefined;
}

/** @internal Temporary bridge for the legacy placement identity field. */
export function setLegacyIdentityHint<T>(element: CRCElement<any>, value: T): void {
  const current = elementMetadata.get(element) ?? {};
  elementMetadata.set(element, { ...current, identityHint: value });
}
