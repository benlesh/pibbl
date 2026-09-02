import { createCRCElement } from './create-element.js';
import type { CRCElementSource } from './metadata.js';
import type {
  CRCElement,
  CRCElementType,
  CRCKey,
  CRCNode,
} from './types.js';

interface FragmentProps {
  children?: CRCNode;
}

/** Compiler-visible fragment component. */
export function Fragment(props: FragmentProps): CRCNode {
  return props.children;
}

/** @internal Automatic JSX production constructor. */
export function jsx<P>(
  type: CRCElementType<P>,
  props: P,
  key?: CRCKey,
): CRCElement<P> {
  return createCRCElement(type, props, key, undefined);
}

/** @internal Automatic JSX production constructor for static child lists. */
export const jsxs = jsx;

/** @internal Automatic JSX development constructor. */
export function jsxDEV<P>(
  type: CRCElementType<P>,
  props: P,
  key: CRCKey | undefined,
  _isStaticChildren: boolean,
  source: CRCElementSource | undefined,
  _self: unknown,
): CRCElement<P> {
  return createCRCElement(type, props, key, source);
}
