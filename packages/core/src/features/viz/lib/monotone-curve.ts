import {
  createSeriesCurve,
  type SeriesCurve,
  type SeriesCurvePoint,
} from "./curve-definition.js";

function endpointSlope(
  h0: number,
  h1: number,
  first: number,
  second: number,
): number {
  let slope = ((2 * h0 + h1) * first - h0 * second) / (h0 + h1);
  if (Math.sign(slope) !== Math.sign(first)) return 0;
  if (
    Math.sign(first) !== Math.sign(second) &&
    Math.abs(slope) > Math.abs(3 * first)
  )
    slope = 3 * first;
  return slope;
}

function monotoneSegments(points: readonly SeriesCurvePoint[]) {
  if (points.length < 2) return [];
  const direction = points[1][0] > points[0][0] ? 1 : -1;
  const x = points.map((point) => direction * point[0]);
  const h: number[] = [];
  const delta: number[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const width = x[i + 1] - x[i];
    if (!Number.isFinite(width) || width <= 0)
      throw new RangeError(
        "monotoneX requires strictly ascending or descending finite x coordinates.",
      );
    h.push(width);
    delta.push((points[i + 1][1] - points[i][1]) / width);
  }
  const slopes = new Array<number>(points.length);
  if (points.length === 2) slopes[0] = slopes[1] = delta[0];
  else {
    slopes[0] = endpointSlope(h[0], h[1], delta[0], delta[1]);
    slopes[points.length - 1] = endpointSlope(
      h.at(-1)!,
      h.at(-2)!,
      delta.at(-1)!,
      delta.at(-2)!,
    );
    for (let i = 1; i < points.length - 1; i++) {
      const previous = delta[i - 1],
        next = delta[i];
      slopes[i] =
        previous === 0 || next === 0 || Math.sign(previous) !== Math.sign(next)
          ? 0
          : (3 * (h[i - 1] + h[i])) /
            ((2 * h[i] + h[i - 1]) / previous + (h[i] + 2 * h[i - 1]) / next);
    }
  }
  return points.slice(1).map((end, index) => {
    const start = points[index],
      width = h[index];
    const control1: SeriesCurvePoint = [
      start[0] + (end[0] - start[0]) / 3,
      start[1] + (slopes[index] * width) / 3,
    ];
    const control2: SeriesCurvePoint = [
      end[0] - (end[0] - start[0]) / 3,
      end[1] - (slopes[index + 1] * width) / 3,
    ];
    if (![...control1, ...control2, ...end].every(Number.isFinite))
      throw new RangeError("monotoneX generated non-finite cubic controls.");
    return Object.freeze({ end, control1, control2 });
  });
}

const monotone = /* @__PURE__ */ createSeriesCurve(monotoneSegments);

/**
 * Returns the immutable monotone-X cubic Hermite definition.
 *
 * It uses weighted harmonic interior slopes and limited one-sided endpoint slopes, preserving every observation,
 * flat segment, and local extremum without sorting data. Each run must have strictly ascending
 * or strictly descending x coordinates.
 *
 * @returns The named {@link SeriesCurve} definition.
 */
export function monotoneX(): SeriesCurve {
  return monotone;
}
