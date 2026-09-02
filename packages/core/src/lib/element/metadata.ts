import type { SystemStyle } from '../types.js';
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
  identityHint?: unknown;
}

const elementMetadata = new WeakMap<CRCElement<any>, InternalElementMetadata>();

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

/** @internal Temporary bridge for the legacy placement identity field. */
export function getLegacyIdentityHint<T>(element: CRCElement<any>): T | undefined {
  return elementMetadata.get(element)?.identityHint as T | undefined;
}

/** @internal Temporary bridge for the legacy placement identity field. */
export function setLegacyIdentityHint<T>(element: CRCElement<any>, value: T): void {
  const current = elementMetadata.get(element) ?? {};
  elementMetadata.set(element, { ...current, identityHint: value });
}
