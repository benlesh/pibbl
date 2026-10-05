import type { CRCNestedResolverInput } from '../backend/types.js';
import type { CRCClippingStackEntry, CRCInstance } from '../types.js';
import type { CRCEventTargetRegistration } from './registrations.js';
import type { CRCResolverInputWinner } from './resolver-input.js';

export const enum CRCHitDisposition {
  Miss = 0,
  Block = 1,
  Target = 2,
}

export interface CRCHitTestInput {
  rootX: number;
  rootY: number;
}

/**
 * The result of evaluating one paint entry's logical hit test.
 *
 * @see {@link CRCEventTargetRegistration}
 * @see {@link CRCNestedResolverInput}
 */
export interface CRCHitTestOutput {
  /**
   * Whether the hit test selects a target, blocks lower paint, or passes through. See
   * {@link CRCHitDisposition}.
   */
  disposition: CRCHitDisposition;
  /**
   * The selected logical target or target configuration. See {@link CRCEventTargetRegistration}.
   */
  target: CRCEventTargetRegistration | null;
  /** @internal Resolver identity for winner-only external input delivery. */
  winner?: CRCResolverInputWinner;
  /** @internal Resolver-owned immutable state from this exact lookup. */
  winnerState?: unknown;
}

export const enum CRCPaintEntryKind {
  Path = 0,
  NestedInstance = 1,
  Resolver = 2,
}

export interface CRCPathPaintEntry {
  readonly paintKind: CRCPaintEntryKind.Path;
  target: CRCEventTargetRegistration;
  path: Path2D;
  fill: boolean;
  lineInteractionWidth: number;
  transform: DOMMatrix;
  clippingStack: readonly CRCClippingStackEntry[];
}

export interface CRCNestedPaintEntry {
  readonly paintKind:
    | CRCPaintEntryKind.NestedInstance
    | CRCPaintEntryKind.Resolver;
  instance: CRCInstance;
  bounds: Path2D;
  transform: DOMMatrix;
  clippingStack: readonly CRCClippingStackEntry[];
  resolveLocal:
    | ((localX: number, localY: number, output: CRCHitTestOutput) => void)
    | undefined;
}

export type CRCPaintEntry = CRCPathPaintEntry | CRCNestedPaintEntry;

export interface CRCHitTestScratch {
  readonly input: CRCHitTestInput;
  readonly output: CRCHitTestOutput;
}

export function createHitTestOutput(): CRCHitTestOutput {
  return { disposition: CRCHitDisposition.Miss, target: null };
}

/** @internal Mutable only to make root-owned scratch allocation observable. */
export const hitTestScratchFactory = {
  create(): CRCHitTestScratch {
    return {
      input: { rootX: 0, rootY: 0 },
      output: createHitTestOutput(),
    };
  },
};
