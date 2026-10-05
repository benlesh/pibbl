import type { tween } from './definition.js';
import type { PibblEasing } from './types.js';

const NEWTON_ITERATIONS = 8;
const BISECTION_ITERATIONS = 50;

function clampProgress(progress: number): number {
  return Math.min(1, Math.max(0, progress));
}

function assertFiniteControl(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`Pibbl cubic bezier ${name} must be finite.`);
  }
}

function sampleCurve(t: number, first: number, second: number): number {
  const inverse = 1 - t;
  return 3 * inverse * inverse * t * first +
    3 * inverse * t * t * second +
    t * t * t;
}

function sampleDerivative(t: number, first: number, second: number): number {
  const inverse = 1 - t;
  return 3 * inverse * inverse * first +
    6 * inverse * t * (second - first) +
    3 * t * t * (1 - second);
}

function cubicBezier(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): PibblEasing {
  assertFiniteControl(x1, 'x1');
  assertFiniteControl(y1, 'y1');
  assertFiniteControl(x2, 'x2');
  assertFiniteControl(y2, 'y2');
  if (x1 < 0 || x1 > 1 || x2 < 0 || x2 > 1) {
    throw new RangeError('Pibbl cubic bezier x1 and x2 must be within [0, 1].');
  }

  return (input: number): number => {
    const progress = clampProgress(input);
    if (progress === 0 || progress === 1) return progress;

    let parameter = progress;
    for (let iteration = 0; iteration < NEWTON_ITERATIONS; iteration++) {
      const x = sampleCurve(parameter, x1, x2) - progress;
      const slope = sampleDerivative(parameter, x1, x2);
      if (Math.abs(slope) < 1e-7) break;
      const candidate = parameter - x / slope;
      if (candidate < 0 || candidate > 1) break;
      parameter = candidate;
    }

    let lower = 0;
    let upper = 1;
    for (let iteration = 0; iteration < BISECTION_ITERATIONS; iteration++) {
      const x = sampleCurve(parameter, x1, x2);
      if (x < progress) lower = parameter;
      else upper = parameter;
      parameter = (lower + upper) / 2;
    }
    return sampleCurve(parameter, y1, y2);
  };
}

function steps(count: number, position: 'start' | 'end' = 'end'): PibblEasing {
  if (!Number.isInteger(count) || count <= 0) {
    throw new RangeError('Pibbl steps count must be a positive integer.');
  }
  if (position !== 'start' && position !== 'end') {
    throw new TypeError('Pibbl steps position must be "start" or "end".');
  }

  return (input: number): number => {
    const progress = clampProgress(input);
    if (position === 'start') {
      return Math.min(1, (Math.floor(progress * count) + 1) / count);
    }
    return progress === 1 ? 1 : Math.floor(progress * count) / count;
  };
}

/**
 * Built-in easing functions for mapping normalized animation progress.
 *
 * @see {@link PibblEasing}
 * @see {@link tween}
 */
export const easing = Object.freeze({
  /**
   * Returns clamped progress unchanged. See {@link PibblEasing}.
   * @param progress - Input progress, clamped to the interval [0, 1].
   * @returns The clamped progress.
   */
  linear: (progress: number): number => clampProgress(progress),
  /**
   * Creates a cubic Bézier easing; control-point x coordinates must be finite and within [0, 1].
   * See {@link PibblEasing}.
   * @param x1 - First control point horizontal coordinate, in [0, 1].
   * @param y1 - Finite first control point vertical coordinate.
   * @param x2 - Second control point horizontal coordinate, in [0, 1].
   * @param y2 - Finite second control point vertical coordinate.
   * @returns A cubic Bézier easing function. See {@link PibblEasing}.
   */
  cubicBezier,
  /**
   * Accelerates from rest using the CSS ease-in control points. See {@link easing}.
   * @param progress - Input progress, clamped to [0, 1].
   * @returns Eased progress. See {@link PibblEasing}.
   */
  easeIn: cubicBezier(0.42, 0, 1, 1),
  /**
   * Decelerates toward rest using the CSS ease-out control points. See {@link easing}.
   * @param progress - Input progress, clamped to [0, 1].
   * @returns Eased progress. See {@link PibblEasing}.
   */
  easeOut: cubicBezier(0, 0, 0.58, 1),
  /**
   * Accelerates then decelerates using the CSS ease-in-out control points. See {@link easing}.
   * @param progress - Input progress, clamped to [0, 1].
   * @returns Eased progress. See {@link PibblEasing}.
   */
  easeInOut: cubicBezier(0.42, 0, 0.58, 1),
  /**
   * Creates a stepped easing with a positive integer count and start or end jump placement. See
   * {@link easing}.
   * @param count - Positive integer number of steps.
   * @param position - Whether jumps occur at the start or end of each interval; defaults to end.
   * @returns A stepped easing function. See {@link PibblEasing}.
   */
  steps,
});
