import { GEOMETRY_EPSILON } from '../numeric-policy.js';

export interface AnalyticDistance2D {
  readonly separation: number;
  readonly firstX: number;
  readonly firstY: number;
  readonly secondX: number;
  readonly secondY: number;
  readonly normalX: number;
  readonly normalY: number;
}

export function distanceCircleToCircle2D(
  firstX: number,
  firstY: number,
  firstRadius: number,
  secondX: number,
  secondY: number,
  secondRadius: number,
  fallbackNormalX = 1,
  fallbackNormalY = 0,
): AnalyticDistance2D {
  const dx = firstX - secondX;
  const dy = firstY - secondY;
  const distance = Math.hypot(dx, dy);
  const normal = unitOrFallback(dx, dy, fallbackNormalX, fallbackNormalY);
  return {
    separation: distance - firstRadius - secondRadius,
    firstX: firstX - normal[0] * firstRadius,
    firstY: firstY - normal[1] * firstRadius,
    secondX: secondX + normal[0] * secondRadius,
    secondY: secondY + normal[1] * secondRadius,
    normalX: normal[0],
    normalY: normal[1],
  };
}

export function distancePointToCircle2D(
  pointX: number,
  pointY: number,
  centerX: number,
  centerY: number,
  radius: number,
  fallbackNormalX = 1,
  fallbackNormalY = 0,
): AnalyticDistance2D {
  const dx = pointX - centerX;
  const dy = pointY - centerY;
  const distance = Math.hypot(dx, dy);
  const normal = unitOrFallback(dx, dy, fallbackNormalX, fallbackNormalY);
  return {
    separation: distance - radius,
    firstX: pointX,
    firstY: pointY,
    secondX: centerX + normal[0] * radius,
    secondY: centerY + normal[1] * radius,
    normalX: normal[0],
    normalY: normal[1],
  };
}

export function distancePointToCapsule2D(
  pointX: number,
  pointY: number,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  radius: number,
  fallbackNormalX = 1,
  fallbackNormalY = 0,
): AnalyticDistance2D {
  const closest = closestPointOnSegment2D(pointX, pointY, startX, startY, endX, endY);
  return distancePointToCircle2D(
    pointX,
    pointY,
    closest[0],
    closest[1],
    radius,
    fallbackNormalX,
    fallbackNormalY,
  );
}

export function distancePointToSegment2D(
  pointX: number,
  pointY: number,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  fallbackNormalX = 1,
  fallbackNormalY = 0,
): AnalyticDistance2D {
  const closest = closestPointOnSegment2D(pointX, pointY, startX, startY, endX, endY);
  const dx = pointX - closest[0];
  const dy = pointY - closest[1];
  const distance = Math.hypot(dx, dy);
  const normal = unitOrFallback(dx, dy, fallbackNormalX, fallbackNormalY);
  return {
    separation: distance,
    firstX: pointX,
    firstY: pointY,
    secondX: closest[0],
    secondY: closest[1],
    normalX: normal[0],
    normalY: normal[1],
  };
}

export function distanceCapsuleToCapsule2D(
  firstStartX: number,
  firstStartY: number,
  firstEndX: number,
  firstEndY: number,
  firstRadius: number,
  secondStartX: number,
  secondStartY: number,
  secondEndX: number,
  secondEndY: number,
  secondRadius: number,
  fallbackNormalX = 1,
  fallbackNormalY = 0,
): AnalyticDistance2D {
  const closest = closestPointsOnSegments2D(
    firstStartX,
    firstStartY,
    firstEndX,
    firstEndY,
    secondStartX,
    secondStartY,
    secondEndX,
    secondEndY,
  );
  const dx = closest[0] - closest[2];
  const dy = closest[1] - closest[3];
  const distance = Math.hypot(dx, dy);
  const normal = unitOrFallback(dx, dy, fallbackNormalX, fallbackNormalY);
  return {
    separation: distance - firstRadius - secondRadius,
    firstX: closest[0] - normal[0] * firstRadius,
    firstY: closest[1] - normal[1] * firstRadius,
    secondX: closest[2] + normal[0] * secondRadius,
    secondY: closest[3] + normal[1] * secondRadius,
    normalX: normal[0],
    normalY: normal[1],
  };
}

function closestPointsOnSegments2D(
  firstStartX: number,
  firstStartY: number,
  firstEndX: number,
  firstEndY: number,
  secondStartX: number,
  secondStartY: number,
  secondEndX: number,
  secondEndY: number,
): readonly [number, number, number, number] {
  const candidates: [number, number, number, number][] = [];
  const firstDx = firstEndX - firstStartX;
  const firstDy = firstEndY - firstStartY;
  const secondDx = secondEndX - secondStartX;
  const secondDy = secondEndY - secondStartY;
  const denominator = firstDx * secondDy - firstDy * secondDx;
  if (Math.abs(denominator) > GEOMETRY_EPSILON) {
    const offsetX = secondStartX - firstStartX;
    const offsetY = secondStartY - firstStartY;
    const firstAmount = (offsetX * secondDy - offsetY * secondDx) / denominator;
    const secondAmount = (offsetX * firstDy - offsetY * firstDx) / denominator;
    if (firstAmount >= 0 && firstAmount <= 1 && secondAmount >= 0 && secondAmount <= 1) {
      const x = firstStartX + firstAmount * firstDx;
      const y = firstStartY + firstAmount * firstDy;
      candidates.push([x, y, x, y]);
    }
  }
  addEndpointCandidate(candidates, firstStartX, firstStartY, secondStartX, secondStartY, secondEndX, secondEndY, true);
  addEndpointCandidate(candidates, firstEndX, firstEndY, secondStartX, secondStartY, secondEndX, secondEndY, true);
  addEndpointCandidate(candidates, secondStartX, secondStartY, firstStartX, firstStartY, firstEndX, firstEndY, false);
  addEndpointCandidate(candidates, secondEndX, secondEndY, firstStartX, firstStartY, firstEndX, firstEndY, false);
  candidates.sort(compareSegmentCandidates);
  return candidates[0]!;
}

function addEndpointCandidate(
  output: [number, number, number, number][],
  pointX: number,
  pointY: number,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  pointBelongsToFirst: boolean,
): void {
  const closest = closestPointOnSegment2D(pointX, pointY, startX, startY, endX, endY);
  output.push(pointBelongsToFirst
    ? [pointX, pointY, closest[0], closest[1]]
    : [closest[0], closest[1], pointX, pointY]);
}

function compareSegmentCandidates(
  first: readonly [number, number, number, number],
  second: readonly [number, number, number, number],
): number {
  const firstDistance = (first[0] - first[2]) ** 2 + (first[1] - first[3]) ** 2;
  const secondDistance = (second[0] - second[2]) ** 2 + (second[1] - second[3]) ** 2;
  if (Math.abs(firstDistance - secondDistance) > GEOMETRY_EPSILON * GEOMETRY_EPSILON) {
    return firstDistance - secondDistance;
  }
  const firstKey = [(first[0] + first[2]) / 2, (first[1] + first[3]) / 2, Math.min(first[0], first[2]), Math.min(first[1], first[3])];
  const secondKey = [(second[0] + second[2]) / 2, (second[1] + second[3]) / 2, Math.min(second[0], second[2]), Math.min(second[1], second[3])];
  for (let index = 0; index < firstKey.length; index += 1) {
    const difference = firstKey[index]! - secondKey[index]!;
    if (Math.abs(difference) > GEOMETRY_EPSILON) return difference;
  }
  return 0;
}

export function closestPointOnSegment2D(
  pointX: number,
  pointY: number,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): readonly [number, number, number] {
  const dx = endX - startX;
  const dy = endY - startY;
  const denominator = dx * dx + dy * dy;
  const amount = denominator <= GEOMETRY_EPSILON * GEOMETRY_EPSILON
    ? 0
    : Math.max(0, Math.min(1, ((pointX - startX) * dx + (pointY - startY) * dy) / denominator));
  return [startX + amount * dx, startY + amount * dy, amount];
}

function unitOrFallback(
  x: number,
  y: number,
  fallbackX: number,
  fallbackY: number,
): readonly [number, number] {
  const length = Math.hypot(x, y);
  if (length > GEOMETRY_EPSILON) {
    return [x / length, y / length];
  }
  const fallbackLength = Math.hypot(fallbackX, fallbackY);
  return fallbackLength > GEOMETRY_EPSILON
    ? [fallbackX / fallbackLength, fallbackY / fallbackLength]
    : [1, 0];
}
