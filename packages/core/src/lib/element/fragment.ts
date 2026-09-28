import type { CRCElement, CRCNodeInput } from './types.js';

export interface FragmentProps {
  children?: CRCNodeInput;
}

/** Compiler-visible fragment value. The renderer handles its descriptor directly. */
export function Fragment(props: FragmentProps): CRCNodeInput {
  return props.children;
}

/** @internal */
export function isFragmentElement(
  element: CRCElement<any>,
): element is CRCElement<FragmentProps> {
  return element.type === Fragment;
}
