import type { CRCElement, CRCNodeInput } from './types.js';

export interface FragmentProps {
  children?: CRCNodeInput;
}

/**
 * Compiler-visible fragment value. The renderer handles its descriptor directly.
 *
 * @param props - Children and optional fragment identity. See {@link FragmentProps}.
 * @returns The fragment's children, preserving their order. See {@link CRCNodeInput}.
 *
 * @see {@link CRCNodeInput}
 */
export function Fragment(props: FragmentProps): CRCNodeInput {
  return props.children;
}

/** @internal */
export function isFragmentElement(
  element: CRCElement<any>,
): element is CRCElement<FragmentProps> {
  return element.type === Fragment;
}
