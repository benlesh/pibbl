import type { CRCSpringOptions } from './types.js';

const DEFAULT_MASS = 1;
const DEFAULT_STIFFNESS = 170;
const DEFAULT_DAMPING = 26;
const DEFAULT_INITIAL_VELOCITY = 0;
const DEFAULT_REST_SPEED = 0.01;
const DEFAULT_REST_DELTA = 0.001;
const DEFAULT_MAX_DURATION = 10_000;

/**
 * Ratios this close to one use the critical solution. This avoids dividing by
 * a vanishing damped frequency or root separation without changing visibly
 * distinct underdamped and overdamped springs.
 */
const CRITICAL_DAMPING_EPSILON = 1e-7;
const DURATION_BISECTION_ITERATIONS = 64;
const INITIAL_BRACKET_SECONDS = 0.001;

export interface SpringDefinitionRecord {
  readonly kind: 'spring';
  readonly duration: number;
  readonly debugName: string | undefined;
  readonly hasFrom: boolean;
  readonly from: number;
  readonly to: number;
  readonly mass: number;
  readonly stiffness: number;
  readonly damping: number;
  readonly initialVelocity: number;
  readonly restSpeed: number;
  readonly restDelta: number;
  readonly maxDuration: number;
}

export interface SpringSample {
  readonly position: number;
  readonly velocity: number;
}

type SpringWithoutDuration = Omit<SpringDefinitionRecord, 'duration'>;

interface SpringEnvelope {
  readonly lastPeakSeconds: number;
  readonly displacement: (seconds: number) => number;
  readonly velocity: (seconds: number) => number;
}

function definitionLabel(debugName: string | undefined): string {
  return debugName === undefined ? 'CRC spring definition' :
    `CRC spring definition "${debugName}"`;
}

function finite(value: number, property: string, debugName: string | undefined): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${definitionLabel(debugName)} ${property} must be finite.`);
  }
  return value;
}

function positive(value: number, property: string, debugName: string | undefined): number {
  finite(value, property, debugName);
  if (value <= 0) {
    throw new RangeError(`${definitionLabel(debugName)} ${property} must be positive.`);
  }
  return value;
}

function nonnegative(
  value: number,
  property: string,
  debugName: string | undefined,
): number {
  finite(value, property, debugName);
  if (value < 0) {
    throw new RangeError(`${definitionLabel(debugName)} ${property} must be nonnegative.`);
  }
  return value;
}

function normalizedSpring(options: Readonly<CRCSpringOptions>): SpringWithoutDuration {
  const debugName = options.debugName;
  const hasFrom = options.from !== undefined;
  return {
    kind: 'spring',
    debugName,
    hasFrom,
    from: finite(options.from ?? 0, 'from', debugName),
    to: finite(options.to, 'to', debugName),
    mass: positive(options.mass ?? DEFAULT_MASS, 'mass', debugName),
    stiffness: positive(options.stiffness ?? DEFAULT_STIFFNESS, 'stiffness', debugName),
    damping: nonnegative(options.damping ?? DEFAULT_DAMPING, 'damping', debugName),
    initialVelocity: finite(
      options.initialVelocity ?? DEFAULT_INITIAL_VELOCITY,
      'initialVelocity',
      debugName,
    ),
    restSpeed: nonnegative(options.restSpeed ?? DEFAULT_REST_SPEED, 'restSpeed', debugName),
    restDelta: nonnegative(options.restDelta ?? DEFAULT_REST_DELTA, 'restDelta', debugName),
    maxDuration: positive(
      options.maxDuration ?? DEFAULT_MAX_DURATION,
      'maxDuration',
      debugName,
    ),
  };
}

function frequencies(record: SpringWithoutDuration): {
  readonly natural: number;
  readonly ratio: number;
} {
  return {
    natural: Math.sqrt(record.stiffness / record.mass),
    ratio: record.damping / (2 * Math.sqrt(record.stiffness * record.mass)),
  };
}

function criticalEnvelope(
  record: SpringWithoutDuration,
  natural: number,
): SpringEnvelope {
  const a = record.from - record.to;
  const b = record.initialVelocity + natural * a;
  const velocityA = b - natural * a;
  const velocityB = -natural * b;
  const displacementA = Math.abs(a);
  const displacementB = Math.abs(b);
  const speedA = Math.abs(velocityA);
  const speedB = Math.abs(velocityB);
  const peak = (constant: number, slope: number): number => {
    if (slope === 0 || !Number.isFinite(slope)) return 0;
    return Math.max(0, (slope - natural * constant) / (natural * slope));
  };
  return {
    lastPeakSeconds: Math.max(
      peak(displacementA, displacementB),
      peak(speedA, speedB),
    ),
    displacement: seconds =>
      (displacementA + displacementB * seconds) * Math.exp(-natural * seconds),
    velocity: seconds =>
      (speedA + speedB * seconds) * Math.exp(-natural * seconds),
  };
}

function underdampedEnvelope(
  record: SpringWithoutDuration,
  natural: number,
  ratio: number,
): SpringEnvelope {
  const a = record.from - record.to;
  const decay = ratio * natural;
  const damped = natural * Math.sqrt(1 - ratio * ratio);
  const b = (record.initialVelocity + decay * a) / damped;
  const displacementAmplitude = Math.hypot(a, b);
  const velocityAmplitude = Math.hypot(
    b * damped - decay * a,
    -a * damped - decay * b,
  );
  return {
    lastPeakSeconds: 0,
    displacement: seconds => displacementAmplitude * Math.exp(-decay * seconds),
    velocity: seconds => velocityAmplitude * Math.exp(-decay * seconds),
  };
}

function overdampedTerms(
  record: SpringWithoutDuration,
  natural: number,
  ratio: number,
): {
  readonly firstCoefficient: number;
  readonly firstRoot: number;
  readonly secondCoefficient: number;
  readonly secondRoot: number;
} {
  const rootOffset = Math.sqrt(ratio * ratio - 1);
  const firstRoot = -natural * (ratio - rootOffset);
  const secondRoot = -natural * (ratio + rootOffset);
  const displacement = record.from - record.to;
  const firstCoefficient =
    (record.initialVelocity - secondRoot * displacement) / (firstRoot - secondRoot);
  return {
    firstCoefficient,
    firstRoot,
    secondCoefficient: displacement - firstCoefficient,
    secondRoot,
  };
}

function overdampedEnvelope(
  record: SpringWithoutDuration,
  natural: number,
  ratio: number,
): SpringEnvelope {
  const terms = overdampedTerms(record, natural, ratio);
  return {
    lastPeakSeconds: 0,
    displacement: seconds =>
      Math.abs(terms.firstCoefficient) * Math.exp(terms.firstRoot * seconds) +
      Math.abs(terms.secondCoefficient) * Math.exp(terms.secondRoot * seconds),
    velocity: seconds =>
      Math.abs(terms.firstRoot * terms.firstCoefficient) *
        Math.exp(terms.firstRoot * seconds) +
      Math.abs(terms.secondRoot * terms.secondCoefficient) *
        Math.exp(terms.secondRoot * seconds),
  };
}

function springEnvelope(record: SpringWithoutDuration): SpringEnvelope {
  const { natural, ratio } = frequencies(record);
  if (Math.abs(ratio - 1) <= CRITICAL_DAMPING_EPSILON) {
    return criticalEnvelope(record, natural);
  }
  return ratio < 1 ?
    underdampedEnvelope(record, natural, ratio) :
    overdampedEnvelope(record, natural, ratio);
}

/** @internal Resolves a deterministic settlement duration in milliseconds. */
export function resolveSpringDuration(record: SpringWithoutDuration): number {
  if (record.from === record.to && record.initialVelocity === 0) return 0;
  const envelope = springEnvelope(record);
  const maximumSeconds = record.maxDuration / 1000;
  const settled = (seconds: number): boolean =>
    envelope.displacement(seconds) <= record.restDelta &&
    envelope.velocity(seconds) <= record.restSpeed;

  let lower = Math.min(maximumSeconds, envelope.lastPeakSeconds);
  if (!Number.isFinite(lower)) return record.maxDuration;
  if (settled(lower)) return lower * 1000;

  let bracketSize = Math.max(INITIAL_BRACKET_SECONDS, lower);
  let upper = lower;
  while (upper < maximumSeconds) {
    upper = Math.min(maximumSeconds, lower + bracketSize);
    if (settled(upper)) break;
    lower = upper;
    bracketSize *= 2;
  }
  if (!settled(upper)) return record.maxDuration;

  for (let iteration = 0; iteration < DURATION_BISECTION_ITERATIONS; iteration++) {
    const middle = lower + (upper - lower) / 2;
    if (settled(middle)) upper = middle;
    else lower = middle;
  }
  return upper * 1000;
}

/** @internal Creates the fully normalized immutable spring definition record. */
export function createSpringRecord(
  options: Readonly<CRCSpringOptions>,
): SpringDefinitionRecord {
  const normalized = normalizedSpring(options);
  return Object.freeze({
    ...normalized,
    duration: normalized.hasFrom ?
      resolveSpringDuration(normalized) : normalized.maxDuration,
  });
}

/** @internal Resolves an omitted start from a track's activation snapshot. */
export function resolveSpringStart(
  record: SpringDefinitionRecord,
  initialValue: number,
): SpringDefinitionRecord {
  if (record.hasFrom) return record;
  const resolved = {
    ...record,
    hasFrom: true,
    from: finite(initialValue, 'activation value', record.debugName),
  };
  return Object.freeze({
    ...resolved,
    duration: resolveSpringDuration(resolved),
  });
}

/** @internal Samples position and logical-units-per-second velocity analytically. */
export function sampleSpring(
  record: SpringDefinitionRecord,
  seconds: number,
): SpringSample {
  finite(seconds, 'sample time', record.debugName);
  const time = Math.max(0, seconds);
  if (time >= record.duration / 1000) {
    return Object.freeze({ position: record.to, velocity: 0 });
  }
  if (time === 0) {
    return Object.freeze({
      position: record.from,
      velocity: record.initialVelocity,
    });
  }

  const displacement = record.from - record.to;
  const { natural, ratio } = frequencies(record);
  let offset: number;
  let velocity: number;
  if (Math.abs(ratio - 1) <= CRITICAL_DAMPING_EPSILON) {
    const b = record.initialVelocity + natural * displacement;
    const decay = Math.exp(-natural * time);
    offset = (displacement + b * time) * decay;
    velocity = (b - natural * (displacement + b * time)) * decay;
  } else if (ratio < 1) {
    const decayRate = ratio * natural;
    const damped = natural * Math.sqrt(1 - ratio * ratio);
    const b = (record.initialVelocity + decayRate * displacement) / damped;
    const decay = Math.exp(-decayRate * time);
    const cosine = Math.cos(damped * time);
    const sine = Math.sin(damped * time);
    offset = decay * (displacement * cosine + b * sine);
    velocity = decay * (
      (b * damped - decayRate * displacement) * cosine +
      (-displacement * damped - decayRate * b) * sine
    );
  } else {
    const terms = overdampedTerms(record, natural, ratio);
    const first = terms.firstCoefficient * Math.exp(terms.firstRoot * time);
    const second = terms.secondCoefficient * Math.exp(terms.secondRoot * time);
    offset = first + second;
    velocity = terms.firstRoot * first + terms.secondRoot * second;
  }

  const position = record.to + offset;
  if (!Number.isFinite(position) || !Number.isFinite(velocity)) {
    throw new RangeError(`${definitionLabel(record.debugName)} sampled values must be finite.`);
  }
  return Object.freeze({ position, velocity });
}
