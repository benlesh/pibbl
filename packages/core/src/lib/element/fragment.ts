import type { CRCElement, CRCNode } from './types.js';

export interface FragmentProps {
  children?: CRCNode;
}

/** Compiler-visible fragment value. The renderer handles its descriptor directly. */
export function Fragment(props: FragmentProps): CRCNode {
  return props.children;
}

/** @internal */
export function isFragmentElement(
  element: CRCElement<any>,
): element is CRCElement<FragmentProps> {
  return element.type === Fragment;
}
