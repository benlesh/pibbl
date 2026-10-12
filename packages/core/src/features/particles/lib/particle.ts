import type {
  PibblParticleChoice,
  PibblParticleCurve,
  PibblParticleCurveOptions,
  PibblParticleCurveValue,
  PibblParticleGradient,
  PibblParticleIntegerRange,
  PibblParticleParameterReference,
  PibblParticleRange,
} from './types.js';

export type ParticleDescriptorRecord =
  | Readonly<{ type: 'between'; min: number; max: number }>
  | Readonly<{ type: 'integer'; min: number; max: number }>
  | Readonly<{ type: 'choice'; choices: readonly Readonly<{ value: unknown; weight: number }>[] }>
  | Readonly<{ type: 'parameter'; name: string }>
  | Readonly<{
      type: 'curve';
      keys: readonly (readonly [number, PibblParticleCurveValue])[];
      options: PibblParticleCurveOptions | undefined;
    }>
  | Readonly<{
      type: 'gradient';
      keys: readonly (readonly [number, string])[];
      options: PibblParticleCurveOptions | undefined;
    }>;

const descriptorRecords = new WeakMap<object, ParticleDescriptorRecord>();

function descriptor<T extends object>(value: T, record: ParticleDescriptorRecord): T {
  const frozen = Object.freeze(value);
  descriptorRecords.set(frozen, Object.freeze(record));
  return frozen;
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be finite; received ${String(value)}.`);
  }
}

function cloneFrozenValue<T>(value: T, seen = new WeakMap<object, unknown>()): T {
  if (value === null || typeof value !== 'object') return value;
  const existing = seen.get(value);
  if (existing !== undefined) return existing as T;
  if (Array.isArray(value)) {
    const result: unknown[] = [];
    seen.set(value, result);
    for (const entry of value) result.push(cloneFrozenValue(entry, seen));
    return Object.freeze(result) as T;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return value;
  const result: Record<string, unknown> = Object.create(prototype);
  seen.set(value, result);
  for (const [key, entry] of Object.entries(value)) {
    result[key] = cloneFrozenValue(entry, seen);
  }
  return Object.freeze(result) as T;
}

function validateRange(min: number, max: number, label: string): void {
  assertFinite(min, `${label} min`);
  assertFinite(max, `${label} max`);
  if (min > max) {
    throw new RangeError(
      `${label} bounds require min to be at most max; received ${String(min)} through ${String(max)}.`,
    );
  }
}

function curveValueDimension(value: PibblParticleCurveValue): 1 | 2 {
  if (typeof value === 'number') {
    assertFinite(value, 'particleCurve value');
    return 1;
  }
  if (!Array.isArray(value) || value.length !== 2) {
    throw new TypeError('particleCurve values must be finite numbers or two-dimensional vectors.');
  }
  assertFinite(value[0], 'particleCurve vector value[0]');
  assertFinite(value[1], 'particleCurve vector value[1]');
  return 2;
}

function validateKeyTimes(
  keys: readonly (readonly [time: number, value: unknown])[],
  label: string,
): void {
  if (keys.length === 0) throw new TypeError(`${label} keys must be nonempty.`);
  if (keys[0]?.[0] !== 0 || keys.at(-1)?.[0] !== 1) {
    throw new RangeError(`${label} keys must cover normalized time 0 through 1.`);
  }
  let previous = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < keys.length; index += 1) {
    const time = keys[index]?.[0];
    assertFinite(time as number, `${label} keys[${index}] time`);
    if ((time as number) <= previous) {
      throw new RangeError(`${label} key times must be strictly increasing.`);
    }
    previous = time as number;
  }
}

function normalizeOptions(
  options: PibblParticleCurveOptions | undefined,
  label: string,
): PibblParticleCurveOptions | undefined {
  if (options === undefined) return undefined;
  if (options.easing !== undefined && typeof options.easing !== 'function') {
    throw new TypeError(`${label} options.easing must be a Pibbl easing function.`);
  }
  return Object.freeze({ easing: options.easing });
}

function between(min: number, max: number): PibblParticleRange {
  validateRange(min, max, 'particleRange');
  if (!Number.isFinite(max - min)) {
    throw new RangeError('particleRange span must be finite.');
  }
  const value = { type: 'between' as const, min, max };
  return descriptor(value, value);
}

function integer(min: number, max: number): PibblParticleIntegerRange {
  validateRange(min, max, 'particleInteger');
  if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max)) {
    throw new RangeError('particleInteger min and max must be safe integers.');
  }
  if (!Number.isSafeInteger(max - min + 1)) {
    throw new RangeError('particleInteger inclusive span must be a safe integer.');
  }
  const value = { type: 'integer' as const, min, max };
  return descriptor(value, value);
}

function choice<const T>(
  choices: readonly Readonly<{ value: T; weight: number }>[],
): PibblParticleChoice<T> {
  if (choices.length === 0) {
    throw new TypeError('particleChoice choices must be nonempty.');
  }
  let totalWeight = 0;
  const copied = Object.freeze(choices.map(({ value, weight }, index) => {
    if (!Number.isFinite(weight) || weight <= 0) {
      throw new RangeError(
        `particleChoice choices[${index}].weight must be positive and finite; received ${String(weight)}.`,
      );
    }
    totalWeight += weight;
    if (!Number.isFinite(totalWeight)) {
      throw new RangeError('particleChoice total weight must be finite.');
    }
    return Object.freeze({ value: cloneFrozenValue(value), weight });
  }));
  const value = { type: 'choice' as const, choices: copied };
  return descriptor(value, value as ParticleDescriptorRecord) as PibblParticleChoice<T>;
}

function parameter<const Name extends string>(
  name: Name,
): PibblParticleParameterReference<Name> {
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new TypeError('particleParameter name must be a nonempty string.');
  }
  const value = { type: 'parameter' as const, name };
  return descriptor(value, value);
}

function curve<const T extends PibblParticleCurveValue>(
  keys: readonly (readonly [time: number, value: T])[],
  options?: PibblParticleCurveOptions,
): PibblParticleCurve<T> {
  validateKeyTimes(keys, 'particleCurve');
  let dimension: 1 | 2 | undefined;
  const copied = Object.freeze(keys.map(([time, value], index) => {
    const currentDimension = curveValueDimension(value);
    if (dimension !== undefined && dimension !== currentDimension) {
      throw new TypeError(
        `particleCurve keys[${index}] value dimension must match earlier keys.`,
      );
    }
    dimension = currentDimension;
    return Object.freeze([time, cloneFrozenValue(value)] as const);
  }));
  const normalizedOptions = normalizeOptions(options, 'particleCurve');
  const value = {
    type: 'curve' as const,
    keys: copied,
    ...(normalizedOptions === undefined ? {} : { options: normalizedOptions }),
  };
  return descriptor(value, {
    type: 'curve', keys: copied, options: normalizedOptions,
  }) as PibblParticleCurve<T>;
}

function gradient(
  keys: readonly (readonly [time: number, color: string])[],
  options?: PibblParticleCurveOptions,
): PibblParticleGradient {
  validateKeyTimes(keys, 'particleGradient');
  const copied = Object.freeze(keys.map(([time, color], index) => {
    if (typeof color !== 'string' || color.trim().length === 0) {
      throw new TypeError(`particleGradient keys[${index}] color must be a nonempty string.`);
    }
    return Object.freeze([time, color] as const);
  }));
  const normalizedOptions = normalizeOptions(options, 'particleGradient');
  const value = {
    type: 'gradient' as const,
    keys: copied,
    ...(normalizedOptions === undefined ? {} : { options: normalizedOptions }),
  };
  return descriptor(value, {
    type: 'gradient', keys: copied, options: normalizedOptions,
  });
}

/** @internal Returns metadata only for descriptors created by this package instance. */
export function getParticleDescriptorRecord(value: unknown): ParticleDescriptorRecord | undefined {
  return typeof value === 'object' && value !== null ? descriptorRecords.get(value) : undefined;
}

/**
 * Describes a continuous random range for particle sampling.
 *
 * @param min - Finite lower bound, no greater than max.
 * @param max - Finite upper bound; the span must also be finite.
 * @returns An immutable continuous sampling descriptor. See {@link PibblParticleRange}.
 *
 * @see {@link PibblParticleRange}
 */
export const particleRange = between;
/**
 * Describes a random integer range for particle sampling.
 *
 * @param min - Inclusive lower bound, a safe integer.
 * @param max - Inclusive upper bound; the inclusive span must be a safe integer.
 * @returns An immutable integer sampling descriptor. See {@link PibblParticleIntegerRange}.
 *
 * @see {@link PibblParticleIntegerRange}
 */
export const particleInteger = integer;
/**
 * Describes weighted choices sampled by a particle effect.
 *
 * @param choices - Nonempty weighted values; every weight and their total must be positive and
 * finite.
 * @returns An immutable descriptor containing copied choices. See {@link PibblParticleChoice}.
 *
 * @see {@link PibblParticleChoice}
 */
export const particleChoice = choice;
/**
 * References a named parameter declared by a particle effect.
 *
 * @param name - Nonempty name of a parameter declared by the effect.
 * @returns A typed parameter reference. See {@link PibblParticleParameterReference}.
 *
 * @see {@link PibblParticleParameterReference}
 */
export const particleParameter = parameter;
/**
 * Describes keyframed scalar or vector values over normalized particle lifetime.
 *
 * @param keys - Scalar or 2D-vector keys with strictly increasing normalized times, starting at 0
 * and ending at 1.
 * @param options - Optional segment easing. See {@link PibblParticleCurveOptions}.
 * @returns An immutable lifetime curve containing copied keys. See {@link PibblParticleCurve}.
 *
 * @see {@link PibblParticleCurveOptions}
 * @see {@link PibblParticleCurve}
 * @see {@link PibblParticleCurveValue}
 */
export const particleCurve = curve;
/**
 * Describes keyframed colors over normalized particle lifetime.
 *
 * @param keys - Color keys with strictly increasing normalized times, starting at 0 and ending at
 * 1.
 * @param options - Optional segment easing. See {@link PibblParticleCurveOptions}.
 * @returns An immutable lifetime color gradient containing copied keys. See
 * {@link PibblParticleGradient} .
 *
 * @see {@link PibblParticleCurveOptions}
 * @see {@link PibblParticleGradient}
 */
export const particleGradient = gradient;

/** @internal Legacy test convenience; not exported from the public package entry. */
export const particle = Object.freeze({
  between,
  integer,
  choice,
  parameter,
  curve,
  gradient,
});
