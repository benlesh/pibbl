import type { PibblNestedResolverInput } from '../backend/types.js';
import type { PibblClippingStackEntry, PibblInstance } from '../types.js';
import type { PibblEventTargetRegistration } from './registrations.js';
import type { PibblResolverInputWinner } from './resolver-input.js';

export const enum PibblHitDisposition {
  Miss = 0,
  Block = 1,
  Target = 2,
}

export interface PibblHitTestInput {
  rootX: number;
  rootY: number;
}

/**
 * The result of evaluating one paint entry's logical hit test.
 *
 * @see {@link PibblEventTargetRegistration}
 * @see {@link PibblNestedResolverInput}
 */
export interface PibblHitTestOutput {
  /**
   * Whether the hit test selects a target, blocks lower paint, or passes through. See
   * {@link PibblHitDisposition}.
   */
  disposition: PibblHitDisposition;
  /**
   * The selected logical target or target configuration. See {@link PibblEventTargetRegistration}.
   */
  target: PibblEventTargetRegistration | null;
  /** @internal Resolver identity for winner-only external input delivery. */
  winner?: PibblResolverInputWinner;
  /** @internal Resolver-owned immutable state from this exact lookup. */
  winnerState?: unknown;
}

export const enum PibblPaintEntryKind {
  Path = 0,
  NestedInstance = 1,
  Resolver = 2,
}

export interface PibblPathPaintEntry {
  readonly paintKind: PibblPaintEntryKind.Path;
  target: PibblEventTargetRegistration;
  path: Path2D;
  fill: boolean;
  lineInteractionWidth: number;
  transform: DOMMatrix;
  clippingStack: readonly PibblClippingStackEntry[];
}

export interface PibblNestedPaintEntry {
  readonly paintKind:
    | PibblPaintEntryKind.NestedInstance
    | PibblPaintEntryKind.Resolver;
  instance: PibblInstance;
  bounds: Path2D;
  transform: DOMMatrix;
  clippingStack: readonly PibblClippingStackEntry[];
  resolveLocal:
    | ((localX: number, localY: number, output: PibblHitTestOutput) => void)
    | undefined;
}

export type PibblPaintEntry = PibblPathPaintEntry | PibblNestedPaintEntry;

export interface PibblHitTestScratch {
  readonly input: PibblHitTestInput;
  readonly output: PibblHitTestOutput;
}

export function createHitTestOutput(): PibblHitTestOutput {
  return { disposition: PibblHitDisposition.Miss, target: null };
}

/** @internal Mutable only to make root-owned scratch allocation observable. */
export const hitTestScratchFactory = {
  create(): PibblHitTestScratch {
    return {
      input: { rootX: 0, rootY: 0 },
      output: createHitTestOutput(),
    };
  },
};
