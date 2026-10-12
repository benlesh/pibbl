import {
  copyElementCloneMetadata,
  getElementMetadata,
  getPrimitiveDefinition,
  setElementMetadata,
  type PibblElementSource,
} from './metadata.js';
import type {
  PibblElement,
  PibblElementType,
  PibblKey,
} from './types.js';
import { isDevelopment } from '../development.js';
import { capturePlacementHandoff } from '../style/positioning.js';

const PIBBL_ELEMENT_TYPE = Symbol.for('@pibbl/core.element');

type ElementProps = Record<PropertyKey, unknown>;
type UnionKeys<T> = T extends unknown ? keyof T : never;
type ElementInput<P> = 0 extends (1 & P) ?
  P & { key?: PibblKey } :
  'key' extends UnionKeys<P> ? never :
  P & { key?: PibblKey };
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

/**
 * Public constructor used by direct element authoring.
 *
 * @param type - Pibbl component or fragment to instantiate. See {@link PibblElementType}.
 * @param props - Authored props, or null when allowed by the component's input type. See
 * {@link ElementInputOrNull} .
 * @param children - Child nodes supplied in source order. See {@link ChildrenArguments}.
 * @returns A branded Pibbl element descriptor; rendering occurs when it is mounted. See
 * {@link PibblElement} .
 *
 * @see {@link PibblElementType}
 * @see {@link PibblElement}
 */
export function createElement<P>(
  type: PibblElementType<P>,
  props: ElementInputOrNull<P>,
  ...children: ChildrenArguments<P>
): PibblElement<P> {
  const withChildren = children.length === 0 ? props : {
    ...(props as object | null),
    children: children.length === 1 ? children[0] : children,
  };
  return createPibblElement(type, withChildren as P | null, undefined, undefined);
}

/** @internal Shared construction path for direct and compiler element creation. */
export function createPibblElement<P>(
  type: PibblElementType<P>,
  incomingProps: P | null,
  compilerKey: PibblKey | null | undefined,
  source: PibblElementSource | undefined,
): PibblElement<P> {
  const rawProps = (incomingProps ?? {}) as ElementProps;
  const defensiveKey = Object.prototype.hasOwnProperty.call(rawProps, 'key') ?
    rawProps.key :
    undefined;
  const rawKey = compilerKey === undefined ? defensiveKey : compilerKey;
  const { key: _key, ...props } = rawProps;
  const primitiveProgramProps = getPrimitiveDefinition(type) === undefined ?
    undefined :
    preparePrimitiveProgramProps(props);
  const normalizedKey = rawKey === undefined || rawKey === null ?
    undefined :
    String(rawKey);
  return finalizePibblElement(type, props as P, normalizedKey, {
    source,
    primitiveProgramProps,
  });
}

function preparePrimitiveProgramProps(
  props: Readonly<ElementProps>,
): Readonly<ElementProps> {
  if (!Object.prototype.hasOwnProperty.call(props, 'style')) return props;
  const { style: _style, ...programProps } = props;
  return programProps;
}

function finalizePibblElement<P>(
  type: PibblElementType<P>,
  props: P,
  key: string | undefined,
  metadata: Parameters<typeof setElementMetadata>[1],
): PibblElement<P> {
  const element = (key === undefined ?
    { type, props } :
    { type, props, key }) as PibblElement<P>;

  setElementMetadata(element, metadata);
  Object.defineProperties(element, {
    $$typeof: {
      configurable: false,
      enumerable: false,
      value: PIBBL_ELEMENT_TYPE,
      writable: false,
    },
  });

  capturePlacementHandoff(
    element,
    (props as { readonly style?: unknown }).style,
  );
  if (isDevelopment) {
    Object.freeze(props);
    Object.freeze(element);
  }
  return element;
}

/** @internal */
export function isPibblElement(value: unknown): value is PibblElement<any> {
  return !!value &&
    typeof value === 'object' &&
    (value as { $$typeof?: unknown }).$$typeof === PIBBL_ELEMENT_TYPE;
}

/** @internal Creates another immutable descriptor while retaining private annotations. */
export function clonePibblElement<P>(element: PibblElement<P>): PibblElement<P> {
  const metadata = getElementMetadata(element);
  const clone = finalizePibblElement(
    element.type,
    element.props,
    element.key,
    metadata ? { ...metadata } : {},
  );
  copyElementCloneMetadata(element, clone);
  return clone;
}
