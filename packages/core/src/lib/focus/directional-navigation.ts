import type { LayoutBox } from '../layout/types.js';
import type { CRCFocusCandidate } from './types.js';

export type CRCDirection = 'left' | 'right' | 'up' | 'down';

export type DirectionalScore = readonly [
  beamPenalty: 0 | 1,
  forwardEdgeDistance: number,
  perpendicularDistance: number,
  sourceIndex: number,
];

interface NormalizedBounds {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
  readonly centerX: number;
  readonly centerY: number;
}

export function findDirectionalCandidate(
  current: CRCFocusCandidate,
  candidates: readonly CRCFocusCandidate[],
  direction: CRCDirection,
): CRCFocusCandidate | undefined {
  let winner: CRCFocusCandidate | undefined;
  let winningScore: DirectionalScore | undefined;
  for (const candidate of candidates) {
    const score = scoreDirectionalCandidate(current, candidate, direction);
    if (!score || winningScore && compareScores(score, winningScore) >= 0) {
      continue;
    }
    winner = candidate;
    winningScore = score;
  }
  return winner;
}

/** Resolves only within the candidate's nearest committed boundary. */
export function findNearestDirectionalCandidate(
  current: CRCFocusCandidate,
  direction: CRCDirection,
): CRCFocusCandidate | undefined {
  const boundary = current.directionalBoundary;
  return boundary ?
    findDirectionalCandidate(current, boundary.candidates, direction) :
    undefined;
}

export function scoreDirectionalCandidate(
  current: CRCFocusCandidate,
  candidate: CRCFocusCandidate,
  direction: CRCDirection,
): DirectionalScore | undefined {
  const currentBounds = normalizeBounds(current.rootBounds);
  const candidateBounds = normalizeBounds(candidate.rootBounds);
  if (!currentBounds || !candidateBounds) return undefined;

  const horizontal = direction === 'left' || direction === 'right';
  const forward = direction === 'right' ?
    candidateBounds.centerX > currentBounds.centerX :
    direction === 'left' ?
      candidateBounds.centerX < currentBounds.centerX :
      direction === 'down' ?
        candidateBounds.centerY > currentBounds.centerY :
        candidateBounds.centerY < currentBounds.centerY;
  if (!forward) return undefined;

  const beamOverlap = horizontal ?
    intervalsOverlap(
      currentBounds.top,
      currentBounds.bottom,
      candidateBounds.top,
      candidateBounds.bottom,
    ) :
    intervalsOverlap(
      currentBounds.left,
      currentBounds.right,
      candidateBounds.left,
      candidateBounds.right,
    );
  const forwardEdgeDistance = direction === 'right' ?
    Math.max(0, candidateBounds.left - currentBounds.right) :
    direction === 'left' ?
      Math.max(0, currentBounds.left - candidateBounds.right) :
      direction === 'down' ?
        Math.max(0, candidateBounds.top - currentBounds.bottom) :
        Math.max(0, currentBounds.top - candidateBounds.bottom);
  const perpendicularDistance = horizontal ?
    Math.abs(candidateBounds.centerY - currentBounds.centerY) :
    Math.abs(candidateBounds.centerX - currentBounds.centerX);

  return [
    beamOverlap ? 0 : 1,
    forwardEdgeDistance,
    perpendicularDistance,
    candidate.sourceIndex,
  ];
}

function normalizeBounds(
  bounds: Readonly<LayoutBox> | undefined,
): NormalizedBounds | undefined {
  if (
    !bounds ||
    !Number.isFinite(bounds.x) ||
    !Number.isFinite(bounds.y) ||
    !Number.isFinite(bounds.width) ||
    !Number.isFinite(bounds.height)
  ) {
    return undefined;
  }
  const x2 = bounds.x + bounds.width;
  const y2 = bounds.y + bounds.height;
  if (!Number.isFinite(x2) || !Number.isFinite(y2)) return undefined;
  const left = Math.min(bounds.x, x2);
  const right = Math.max(bounds.x, x2);
  const top = Math.min(bounds.y, y2);
  const bottom = Math.max(bounds.y, y2);
  return {
    left,
    right,
    top,
    bottom,
    centerX: left / 2 + right / 2,
    centerY: top / 2 + bottom / 2,
  };
}

function intervalsOverlap(
  firstStart: number,
  firstEnd: number,
  secondStart: number,
  secondEnd: number,
): boolean {
  return firstStart <= secondEnd && secondStart <= firstEnd;
}

function compareScores(
  left: DirectionalScore,
  right: DirectionalScore,
): number {
  for (let index = 0; index < left.length; index++) {
    if (left[index] < right[index]) return -1;
    if (left[index] > right[index]) return 1;
  }
  return 0;
}
