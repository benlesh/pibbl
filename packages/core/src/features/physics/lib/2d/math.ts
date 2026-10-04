import type {
  CRCPhysicsAabb2D,
  CRCPhysicsPose2D,
  CRCPhysicsVector2,
} from '../../2d-geometry.js';
import { copyFiniteVector2, requireFiniteNumber } from '../shared/validation.js';
import { DEGREES_TO_RADIANS, GEOMETRY_EPSILON } from './numeric-policy.js';

export const CURVE_FLATTENING_TOLERANCE = 0.05;
export const CURVE_FLATTENING_MAX_DEPTH = 12;

export interface InternalPose2D {
  readonly x: number;
  readonly y: number;
  readonly rotationRadians: number;
}

export const IDENTITY_POSE_2D: InternalPose2D = Object.freeze({
  x: 0,
  y: 0,
  rotationRadians: 0,
});

export function copyPose2D(
  pose: CRCPhysicsPose2D | undefined,
  path: string,
): InternalPose2D {
  if (pose === undefined) {
    return IDENTITY_POSE_2D;
  }
  const position = copyFiniteVector2(pose.position, `${path}.position`);
  return Object.freeze({
    x: position[0],
    y: position[1],
    rotationRadians:
      requireFiniteNumber(pose.rotationDegrees, `${path}.rotationDegrees`) *
      DEGREES_TO_RADIANS,
  });
}

/** Returns outer(inner(point)). */
export function composePose2D(
  outer: InternalPose2D,
  inner: InternalPose2D,
): InternalPose2D {
  const cosine = Math.cos(outer.rotationRadians);
  const sine = Math.sin(outer.rotationRadians);
  return Object.freeze({
    x: outer.x + cosine * inner.x - sine * inner.y,
    y: outer.y + sine * inner.x + cosine * inner.y,
    rotationRadians: outer.rotationRadians + inner.rotationRadians,
  });
}

export function transformPointInto(
  output: Float64Array,
  outputOffset: number,
  x: number,
  y: number,
  pose: InternalPose2D,
): void {
  const cosine = Math.cos(pose.rotationRadians);
  const sine = Math.sin(pose.rotationRadians);
  output[outputOffset] = pose.x + cosine * x - sine * y;
  output[outputOffset + 1] = pose.y + sine * x + cosine * y;
}

export function cross2D(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
): number {
  return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
}

export function canonicalizeContour2D(
  source: readonly CRCPhysicsVector2[],
  options: Readonly<{ strictlyConvex: boolean; path: string }>,
): Float64Array {
  const copied: [number, number][] = source.map((point, index) => {
    const owned = copyFiniteVector2(point, `${options.path}[${index}]`);
    return [owned[0], owned[1]];
  });
  if (
    copied.length > 1 &&
    copied[0]![0] === copied.at(-1)![0] &&
    copied[0]![1] === copied.at(-1)![1]
  ) {
    copied.pop();
  }
  if (copied.length < 3) {
    throw new RangeError(`${options.path} must contain at least three vertices.`);
  }
  const cleaned = options.strictlyConvex
    ? copied
    : removeCollinearAndAdjacentDuplicates(copied);
  for (let first = 0; first < cleaned.length; first += 1) {
    for (let second = first + 1; second < cleaned.length; second += 1) {
      if (
        cleaned[first]![0] === cleaned[second]![0] &&
        cleaned[first]![1] === cleaned[second]![1]
      ) {
        throw new RangeError(`${options.path} must not contain duplicate vertices.`);
      }
    }
  }
  if (cleaned.length < 3) {
    throw new RangeError(`${options.path} must enclose a nonzero area.`);
  }
  if (hasSelfIntersection(cleaned)) {
    throw new RangeError(`${options.path} must describe a simple polygon.`);
  }

  let signedTwiceArea = 0;
  for (let index = 0; index < cleaned.length; index += 1) {
    const current = cleaned[index]!;
    const next = cleaned[(index + 1) % cleaned.length]!;
    signedTwiceArea += current[0] * next[1] - next[0] * current[1];
  }
  if (Math.abs(signedTwiceArea) <= GEOMETRY_EPSILON) {
    throw new RangeError(`${options.path} must enclose a nonzero area.`);
  }
  if (signedTwiceArea < 0) {
    cleaned.reverse();
  }

  if (options.strictlyConvex) {
    for (let index = 0; index < cleaned.length; index += 1) {
      const previous = cleaned[(index + cleaned.length - 1) % cleaned.length]!;
      const current = cleaned[index]!;
      const next = cleaned[(index + 1) % cleaned.length]!;
      if (
        cross2D(
          previous[0],
          previous[1],
          current[0],
          current[1],
          next[0],
          next[1],
        ) <= GEOMETRY_EPSILON
      ) {
        throw new RangeError(
          `${options.path} must describe a strictly convex polygon without collinear vertices.`,
        );
      }
    }
  }

  let start = 0;
  for (let index = 1; index < cleaned.length; index += 1) {
    const candidate = cleaned[index]!;
    const selected = cleaned[start]!;
    if (
      candidate[0] < selected[0] ||
      (candidate[0] === selected[0] && candidate[1] < selected[1])
    ) {
      start = index;
    }
  }
  const result = new Float64Array(cleaned.length * 2);
  for (let index = 0; index < cleaned.length; index += 1) {
    const point = cleaned[(start + index) % cleaned.length]!;
    result[index * 2] = point[0];
    result[index * 2 + 1] = point[1];
  }
  return result;
}

export function triangulateContour2D(vertices: Float64Array): readonly Float64Array[] {
  const count = vertices.length / 2;
  const remaining = Array.from({ length: count }, (_, index) => index);
  const triangles: Float64Array[] = [];
  while (remaining.length > 3) {
    let selectedPosition = -1;
    let selectedCanonicalIndex = Number.POSITIVE_INFINITY;
    for (let position = 0; position < remaining.length; position += 1) {
      const previous = remaining[(position + remaining.length - 1) % remaining.length]!;
      const current = remaining[position]!;
      const next = remaining[(position + 1) % remaining.length]!;
      const turn = cross2D(
        vertices[previous * 2]!,
        vertices[previous * 2 + 1]!,
        vertices[current * 2]!,
        vertices[current * 2 + 1]!,
        vertices[next * 2]!,
        vertices[next * 2 + 1]!,
      );
      if (turn <= GEOMETRY_EPSILON) {
        continue;
      }
      let containsVertex = false;
      for (const candidate of remaining) {
        if (candidate === previous || candidate === current || candidate === next) {
          continue;
        }
        if (pointInTriangle(vertices, candidate, previous, current, next)) {
          containsVertex = true;
          break;
        }
      }
      if (!containsVertex && current < selectedCanonicalIndex) {
        selectedPosition = position;
        selectedCanonicalIndex = current;
      }
    }
    if (selectedPosition < 0) {
      throw new RangeError('contour could not be triangulated deterministically.');
    }
    const previous = remaining[(selectedPosition + remaining.length - 1) % remaining.length]!;
    const current = remaining[selectedPosition]!;
    const next = remaining[(selectedPosition + 1) % remaining.length]!;
    triangles.push(copyTriangle(vertices, previous, current, next));
    remaining.splice(selectedPosition, 1);
  }
  triangles.push(copyTriangle(vertices, remaining[0]!, remaining[1]!, remaining[2]!));
  return Object.freeze(triangles);
}

export function polygonMassData2D(vertices: Float64Array): Readonly<{
  area: number;
  centroidX: number;
  centroidY: number;
  unitInertia: number;
}> {
  let twiceArea = 0;
  let centroidXTimesSixArea = 0;
  let centroidYTimesSixArea = 0;
  let inertiaTimesTwelve = 0;
  for (let offset = 0; offset < vertices.length; offset += 2) {
    const nextOffset = (offset + 2) % vertices.length;
    const x1 = vertices[offset]!;
    const y1 = vertices[offset + 1]!;
    const x2 = vertices[nextOffset]!;
    const y2 = vertices[nextOffset + 1]!;
    const cross = x1 * y2 - x2 * y1;
    twiceArea += cross;
    centroidXTimesSixArea += (x1 + x2) * cross;
    centroidYTimesSixArea += (y1 + y2) * cross;
    inertiaTimesTwelve +=
      cross *
      (x1 * x1 + x1 * x2 + x2 * x2 + y1 * y1 + y1 * y2 + y2 * y2);
  }
  const area = twiceArea / 2;
  const centroidX = centroidXTimesSixArea / (3 * twiceArea);
  const centroidY = centroidYTimesSixArea / (3 * twiceArea);
  const inertiaAboutOrigin = inertiaTimesTwelve / 12;
  return Object.freeze({
    area,
    centroidX,
    centroidY,
    unitInertia:
      inertiaAboutOrigin - area * (centroidX * centroidX + centroidY * centroidY),
  });
}

export function freezeBounds2D(
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): CRCPhysicsAabb2D {
  return Object.freeze({
    min: Object.freeze([cleanZero(minX), cleanZero(minY)] as const),
    max: Object.freeze([cleanZero(maxX), cleanZero(maxY)] as const),
  });
}

export function cleanZero(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}

function removeCollinearAndAdjacentDuplicates(
  source: readonly [number, number][],
): [number, number][] {
  const points = source.filter((point, index) => {
    const previous = source[(index + source.length - 1) % source.length]!;
    return point[0] !== previous[0] || point[1] !== previous[1];
  });
  let removed = true;
  while (removed && points.length >= 3) {
    removed = false;
    for (let index = 0; index < points.length; index += 1) {
      const previous = points[(index + points.length - 1) % points.length]!;
      const current = points[index]!;
      const next = points[(index + 1) % points.length]!;
      if (
        Math.abs(
          cross2D(
            previous[0],
            previous[1],
            current[0],
            current[1],
            next[0],
            next[1],
          ),
        ) <= GEOMETRY_EPSILON
      ) {
        points.splice(index, 1);
        removed = true;
        break;
      }
    }
  }
  return points;
}

function hasSelfIntersection(points: readonly [number, number][]): boolean {
  for (let first = 0; first < points.length; first += 1) {
    const firstNext = (first + 1) % points.length;
    for (let second = first + 1; second < points.length; second += 1) {
      const secondNext = (second + 1) % points.length;
      if (
        first === second ||
        firstNext === second ||
        secondNext === first
      ) {
        continue;
      }
      if (
        segmentsIntersect(
          points[first]!,
          points[firstNext]!,
          points[second]!,
          points[secondNext]!,
        )
      ) {
        return true;
      }
    }
  }
  return false;
}

function segmentsIntersect(
  firstStart: readonly [number, number],
  firstEnd: readonly [number, number],
  secondStart: readonly [number, number],
  secondEnd: readonly [number, number],
): boolean {
  const firstSide = cross2D(
    firstStart[0],
    firstStart[1],
    firstEnd[0],
    firstEnd[1],
    secondStart[0],
    secondStart[1],
  );
  const secondSide = cross2D(
    firstStart[0],
    firstStart[1],
    firstEnd[0],
    firstEnd[1],
    secondEnd[0],
    secondEnd[1],
  );
  const thirdSide = cross2D(
    secondStart[0],
    secondStart[1],
    secondEnd[0],
    secondEnd[1],
    firstStart[0],
    firstStart[1],
  );
  const fourthSide = cross2D(
    secondStart[0],
    secondStart[1],
    secondEnd[0],
    secondEnd[1],
    firstEnd[0],
    firstEnd[1],
  );
  return (
    Math.sign(firstSide) !== Math.sign(secondSide) &&
    Math.sign(thirdSide) !== Math.sign(fourthSide)
  );
}

function pointInTriangle(
  vertices: Float64Array,
  point: number,
  first: number,
  second: number,
  third: number,
): boolean {
  const px = vertices[point * 2]!;
  const py = vertices[point * 2 + 1]!;
  const firstCross = cross2D(vertices[first * 2]!, vertices[first * 2 + 1]!, vertices[second * 2]!, vertices[second * 2 + 1]!, px, py);
  const secondCross = cross2D(vertices[second * 2]!, vertices[second * 2 + 1]!, vertices[third * 2]!, vertices[third * 2 + 1]!, px, py);
  const thirdCross = cross2D(vertices[third * 2]!, vertices[third * 2 + 1]!, vertices[first * 2]!, vertices[first * 2 + 1]!, px, py);
  return (
    firstCross >= -GEOMETRY_EPSILON &&
    secondCross >= -GEOMETRY_EPSILON &&
    thirdCross >= -GEOMETRY_EPSILON
  );
}

function copyTriangle(
  vertices: Float64Array,
  first: number,
  second: number,
  third: number,
): Float64Array {
  return new Float64Array([
    vertices[first * 2]!, vertices[first * 2 + 1]!,
    vertices[second * 2]!, vertices[second * 2 + 1]!,
    vertices[third * 2]!, vertices[third * 2 + 1]!,
  ]);
}
