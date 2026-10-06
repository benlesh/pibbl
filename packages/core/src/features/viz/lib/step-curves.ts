import {
  createSeriesCurve,
  type SeriesCurve,
  type SeriesCurvePoint,
} from "./curve-definition.js";

function segment(end: SeriesCurvePoint) {
  return Object.freeze({ end });
}

function stepBeforeSegments(points: readonly SeriesCurvePoint[]) {
  const segments = [];
  for (let i = 1; i < points.length; i++) {
    const previous = points[i - 1],
      next = points[i];
    segments.push(segment([previous[0], next[1]]), segment(next));
  }
  return segments;
}

function stepAfterSegments(points: readonly SeriesCurvePoint[]) {
  const segments = [];
  for (let i = 1; i < points.length; i++) {
    const previous = points[i - 1],
      next = points[i];
    segments.push(segment([next[0], previous[1]]), segment(next));
  }
  return segments;
}

function stepMidpointSegments(points: readonly SeriesCurvePoint[]) {
  const segments = [];
  for (let i = 1; i < points.length; i++) {
    const previous = points[i - 1],
      next = points[i];
    const midpoint = previous[0] / 2 + next[0] / 2;
    segments.push(
      segment([midpoint, previous[1]]),
      segment([midpoint, next[1]]),
      segment(next),
    );
  }
  return segments;
}

const before = /* @__PURE__ */ createSeriesCurve(stepBeforeSegments);
const after = /* @__PURE__ */ createSeriesCurve(stepAfterSegments);
const midpoint = /* @__PURE__ */ createSeriesCurve(stepMidpointSegments);

/**
 * Returns the immutable definition that jumps to the next value at the prior x coordinate.
 *
 * @returns The named {@link SeriesCurve} definition.
 */
export function stepBefore(): SeriesCurve {
  return before;
}

/**
 * Returns the immutable definition that holds the prior value until the next x coordinate.
 *
 * @returns The named {@link SeriesCurve} definition.
 */
export function stepAfter(): SeriesCurve {
  return after;
}

/**
 * Returns the immutable definition that places each value transition halfway between x values.
 *
 * @returns The named {@link SeriesCurve} definition.
 */
export function stepMidpoint(): SeriesCurve {
  return midpoint;
}
