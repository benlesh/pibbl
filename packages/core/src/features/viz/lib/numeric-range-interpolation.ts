import type { NumericDomain } from "./types.js";

function endpoint(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new RangeError(`Numeric range ${name} must be finite.`);
  return value;
}

function range(value: NumericDomain, name: string): readonly [number, number] {
  if (!Array.isArray(value) || value.length !== 2)
    throw new TypeError(`Numeric range ${name} requires two endpoints.`);
  return [endpoint(value[0], `${name}[0]`), endpoint(value[1], `${name}[1]`)];
}

function interpolateEndpoint(from: number, to: number, progress: number): number {
  if (progress === 0 || from === to) return from;
  if (progress === 1) return to;
  const difference = to - from;
  const direct = from + difference * progress;
  if (Number.isFinite(direct)) return direct;

  // Scaling avoids overflow in the subtraction for opposite, very large endpoints.
  const scale = Math.max(Math.abs(from), Math.abs(to));
  const scaled =
    (from / scale + (to / scale - from / scale) * progress) * scale;
  if (!Number.isFinite(scaled))
    throw new RangeError("Numeric range interpolation must produce finite endpoints.");
  return scaled;
}

/**
 * Linearly interpolates both endpoints of a finite numeric range.
 *
 * The returned pair is frozen. It preserves ascending, descending, and flat
 * endpoint order for progress within zero through one. Progress outside that
 * interval deliberately extrapolates, matching Pibbl's numeric tween behavior.
 *
 * @param from - Starting finite endpoint pair.
 * @param to - Ending finite endpoint pair.
 * @param progress - Finite interpolation progress supplied by an animation definition.
 * @returns A frozen finite endpoint pair.
 */
export function interpolateNumericRange(
  from: NumericDomain,
  to: NumericDomain,
  progress: number,
): NumericDomain {
  const start = range(from, "from");
  const end = range(to, "to");
  if (typeof progress !== "number" || !Number.isFinite(progress))
    throw new RangeError("Numeric range interpolation progress must be finite.");
  return Object.freeze([
    interpolateEndpoint(start[0], end[0], progress),
    interpolateEndpoint(start[1], end[1], progress),
  ]);
}
