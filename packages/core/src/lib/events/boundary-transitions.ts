import type { CRCEventNode } from './registrations.js';

export interface CRCBoundaryTransitionPlan {
  readonly commonPrefixLength: number;
  /** Nodes exited from leaf toward the nearest exclusive ancestor. */
  readonly exited: readonly CRCEventNode[];
  /** Nodes entered from the nearest exclusive ancestor toward the leaf. */
  readonly entered: readonly CRCEventNode[];
}

export function planBoundaryTransitions(
  oldPath: readonly CRCEventNode[],
  newPath: readonly CRCEventNode[],
): CRCBoundaryTransitionPlan {
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
