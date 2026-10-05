import type { PibblEventNode } from './registrations.js';

export interface PibblBoundaryTransitionPlan {
  readonly commonPrefixLength: number;
  /** Nodes exited from leaf toward the nearest exclusive ancestor. */
  readonly exited: readonly PibblEventNode[];
  /** Nodes entered from the nearest exclusive ancestor toward the leaf. */
  readonly entered: readonly PibblEventNode[];
}

export function planBoundaryTransitions(
  oldPath: readonly PibblEventNode[],
  newPath: readonly PibblEventNode[],
): PibblBoundaryTransitionPlan {
  let commonPrefixLength = 0;
  const length = Math.min(oldPath.length, newPath.length);
  while (
    commonPrefixLength < length &&
    oldPath[commonPrefixLength] === newPath[commonPrefixLength]
  ) {
    commonPrefixLength++;
  }
  return {
    commonPrefixLength,
    exited: Object.freeze(oldPath.slice(commonPrefixLength).reverse()),
    entered: Object.freeze(newPath.slice(commonPrefixLength)),
  };
}
