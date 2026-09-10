import type { CRCEasing } from './types.js';

const NEWTON_ITERATIONS = 8;
const BISECTION_ITERATIONS = 50;

function clampProgress(progress: number): number {
  return Math.min(1, Math.max(0, progress));
}

function assertFiniteControl(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`CRC cubic bezier ${name} must be finite.`);
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
): CRCEasing {
  assertFiniteControl(x1, 'x1');
  assertFiniteControl(y1, 'y1');
  assertFiniteControl(x2, 'x2');
  assertFiniteControl(y2, 'y2');
  if (x1 < 0 || x1 > 1 || x2 < 0 || x2 > 1) {
    throw new RangeError('CRC cubic bezier x1 and x2 must be within [0, 1].');
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

function steps(count: number, position: 'start' | 'end' = 'end'): CRCEasing {
  if (!Number.isInteger(count) || count <= 0) {
    throw new RangeError('CRC steps count must be a positive integer.');
  }
  if (position !== 'start' && position !== 'end') {
    throw new TypeError('CRC steps position must be "start" or "end".');
  }

  return (input: number): number => {
    const progress = clampProgress(input);
    if (position === 'start') {
      return Math.min(1, (Math.floor(progress * count) + 1) / count);
    }
    return progress === 1 ? 1 : Math.floor(progress * count) / count;
  };
}

export const easing = Object.freeze({
  linear: (progress: number): number => clampProgress(progress),
  cubicBezier,
  easeIn: cubicBezier(0.42, 0, 1, 1),
  easeOut: cubicBezier(0, 0, 0.58, 1),
  easeInOut: cubicBezier(0.42, 0, 0.58, 1),
  steps,
});
