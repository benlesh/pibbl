import {
  copyElementCloneMetadata,
  getElementMetadata,
  setElementMetadata,
  type CRCElementSource,
} from './metadata.js';
import type {
  CRCElement,
  CRCElementType,
  CRCKey,
} from './types.js';

const CRC_ELEMENT_TYPE = Symbol.for('@crc/core.element');

type ElementProps = Record<PropertyKey, unknown>;
type UnionKeys<T> = T extends unknown ? keyof T : never;
type ElementInput<P> = 0 extends (1 & P) ?
  P & { key?: CRCKey } :
  'key' extends UnionKeys<P> ? never :
  P & { key?: CRCKey };
type ElementInputOrNull<P> = [ElementInput<P>] extends [never] ?
  never :
  ElementInput<P> | null;
type ChildrenForProps<P> = P extends unknown ?
  'children' extends keyof P ? P['children'] : never :
  never;
type MultipleChildren<C> = C extends unknown ?
  C extends readonly (infer Child)[] ?
    Child[] extends C ? [Child, Child, ...Child[]] : never :
  C extends Iterable<infer Child> ?
    Child[] extends C ? [Child, Child, ...Child[]] : never :
  never :
  never;
type ChildrenArguments<P> = P extends unknown ?
  'children' extends keyof P ?
    | []
    | [ChildrenForProps<P>]
    | MultipleChildren<ChildrenForProps<P>> :
  [] :
  never;

/** Public constructor used by direct element authoring. */
export function createElement<P>(
  type: CRCElementType<P>,
  props: ElementInputOrNull<P>,
  ...children: ChildrenArguments<P>
): CRCElement<P> {
  const withChildren = children.length === 0 ? props : {
    ...(props as object | null),
    children: children.length === 1 ? children[0] : children,
  };
  return createCRCElement(type, withChildren as P | null, undefined, undefined);
}

/** @internal Shared construction path for direct and compiler element creation. */
export function createCRCElement<P>(
  type: CRCElementType<P>,
  incomingProps: P | null,
  compilerKey: CRCKey | null | undefined,
  source: CRCElementSource | undefined,
): CRCElement<P> {
  const rawProps = (incomingProps ?? {}) as ElementProps;
  const defensiveKey = Object.prototype.hasOwnProperty.call(rawProps, 'key') ?
    rawProps.key :
    undefined;
  const rawKey = compilerKey === undefined ? defensiveKey : compilerKey;
  const { key: _key, ...props } = rawProps;
  const normalizedKey = rawKey === undefined || rawKey === null ?
    undefined :
    String(rawKey);
  return finalizeCRCElement(type, props as P, normalizedKey, { source });
}

function finalizeCRCElement<P>(
  type: CRCElementType<P>,
  props: P,
  key: string | undefined,
  metadata: Parameters<typeof setElementMetadata>[1],
): CRCElement<P> {
  const element = (key === undefined ?
    { type, props } :
    { type, props, key }) as CRCElement<P>;

  setElementMetadata(element, metadata);
  Object.defineProperties(element, {
    $$typeof: {
      configurable: false,
      enumerable: false,
      value: CRC_ELEMENT_TYPE,
      writable: false,
    },
  });

  const isDevelopment = (
    import.meta as ImportMeta & { env?: { readonly DEV?: boolean } }
  ).env?.DEV ?? false;
  if (isDevelopment) {
    Object.freeze(props);
    Object.freeze(element);
  }
  return element;
}

/** @internal */
export function isCRCElement(value: unknown): value is CRCElement<any> {
  return !!value &&
    typeof value === 'object' &&
    (value as { $$typeof?: unknown }).$$typeof === CRC_ELEMENT_TYPE;
}

/** @internal Creates another immutable descriptor while retaining private annotations. */
export function cloneCRCElement<P>(element: CRCElement<P>): CRCElement<P> {
  const metadata = getElementMetadata(element);
  const clone = finalizeCRCElement(
    element.type,
    element.props,
    element.key,
    metadata ? { ...metadata } : {},
  );
  copyElementCloneMetadata(element, clone);
  return clone;
}
