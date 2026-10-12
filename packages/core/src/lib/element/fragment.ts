import type { PibblElement, PibblNodeInput } from './types.js';

export interface FragmentProps {
  children?: PibblNodeInput;
}

/**
 * Compiler-visible fragment value. The renderer handles its descriptor directly.
 *
 * @param props - Children and optional fragment identity. See {@link FragmentProps}.
 * @returns The fragment's children, preserving their order. See {@link PibblNodeInput}.
 *
 * @see {@link PibblNodeInput}
 */
export function Fragment(props: FragmentProps): PibblNodeInput {
  return props.children;
}

/** @internal */
export function isFragmentElement(
  element: PibblElement<any>,
): element is PibblElement<FragmentProps> {
  return element.type === Fragment;
}
