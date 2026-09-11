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

interface SpringFrequencies {
  readonly natural: number;
  readonly ratio: number;
  readonly decay: number;
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

function defaulted(value: number | undefined, fallback: number): number {
  return value === undefined ? fallback : value;
}

function normalizedSpring(options: Readonly<CRCSpringOptions>): SpringWithoutDuration {
  const debugName = options.debugName;
  const hasFrom = options.from !== undefined;
  return {
    kind: 'spring',
    debugName,
    hasFrom,
    from: finite(defaulted(options.from, 0), 'from', debugName),
    to: finite(options.to, 'to', debugName),
    mass: positive(defaulted(options.mass, DEFAULT_MASS), 'mass', debugName),
    stiffness: positive(
      defaulted(options.stiffness, DEFAULT_STIFFNESS),
      'stiffness',
      debugName,
    ),
    damping: nonnegative(
      defaulted(options.damping, DEFAULT_DAMPING),
      'damping',
      debugName,
    ),
    initialVelocity: finite(
      defaulted(options.initialVelocity, DEFAULT_INITIAL_VELOCITY),
      'initialVelocity',
      debugName,
    ),
    restSpeed: nonnegative(
      defaulted(options.restSpeed, DEFAULT_REST_SPEED),
      'restSpeed',
      debugName,
    ),
    restDelta: nonnegative(
      defaulted(options.restDelta, DEFAULT_REST_DELTA),
      'restDelta',
      debugName,
    ),
    maxDuration: positive(
      defaulted(options.maxDuration, DEFAULT_MAX_DURATION),
      'maxDuration',
      debugName,
    ),
  };
}

function frequencies(record: SpringWithoutDuration): SpringFrequencies {
  const logMass = Math.log(record.mass);
  const logStiffness = Math.log(record.stiffness);
  const natural = Math.exp((logStiffness - logMass) / 2);
  const dampingLog = record.damping === 0 ? Number.NEGATIVE_INFINITY :
    Math.log(record.damping);
  const ratio = record.damping === 0 ? 0 : Math.exp(
    dampingLog - Math.LN2 - logStiffness / 2 - logMass / 2,
  );
  const decay = record.damping === 0 ? 0 : Math.exp(
    dampingLog - Math.LN2 - logMass,
  );
  if (!(natural > 0) || !Number.isFinite(natural) ||
    !Number.isFinite(ratio) || !Number.isFinite(decay)) {
    throw new RangeError(
      `${definitionLabel(record.debugName)} parameters must produce finite representable frequencies.`,
    );
  }
  return { natural, ratio, decay };
}

function displacement(record: SpringWithoutDuration): number {
  const value = record.from - record.to;
  if (!Number.isFinite(value)) {
    throw new RangeError(
      `${definitionLabel(record.debugName)} displacement must be finite and representable.`,
    );
  }
  return value;
}

function assertRepresentable(
  record: SpringWithoutDuration,
  ...values: readonly number[]
): void {
  if (values.some(value => !Number.isFinite(value))) {
    throw new RangeError(
      `${definitionLabel(record.debugName)} parameters must produce finite representable coefficients.`,
    );
  }
}

function underdampedTerms(
  record: SpringWithoutDuration,
  natural: number,
  ratio: number,
  decay: number,
): {
  readonly displacement: number;
  readonly damped: number;
  readonly velocityCoefficient: number;
} {
  const initialDisplacement = displacement(record);
  const damped = natural * Math.sqrt((1 - ratio) * (1 + ratio));
  const velocityCoefficient =
    record.initialVelocity + decay * initialDisplacement;
  const maximumSeconds = record.maxDuration / 1000;
  if (!(damped > 0)) {
    throw new RangeError(
      `${definitionLabel(record.debugName)} parameters must produce finite representable coefficients.`,
    );
  }
  assertRepresentable(
    record,
    damped,
    velocityCoefficient,
    damped * maximumSeconds,
    velocityCoefficient * maximumSeconds,
    initialDisplacement * damped,
    decay * velocityCoefficient * maximumSeconds,
    Math.abs(record.to) + Math.abs(initialDisplacement) +
      Math.abs(velocityCoefficient * maximumSeconds),
  );
  return { displacement: initialDisplacement, damped, velocityCoefficient };
}

function criticalEnvelope(
  record: SpringWithoutDuration,
  natural: number,
): SpringEnvelope {
  const a = displacement(record);
  const b = record.initialVelocity + natural * a;
  const maximumSeconds = record.maxDuration / 1000;
  assertRepresentable(
    record,
    b,
    b * maximumSeconds,
    natural * a,
    natural * b,
    natural * b * maximumSeconds,
    Math.abs(record.to) + Math.abs(a) + Math.abs(b * maximumSeconds),
  );
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
  decay: number,
): SpringEnvelope {
  const terms = underdampedTerms(record, natural, ratio, decay);
  const a = terms.displacement;
  const b = terms.velocityCoefficient / terms.damped;
  const displacementAmplitude = Math.hypot(a, b);
  const velocitySineCoefficient = terms.velocityCoefficient === 0 ? 0 :
    -a * terms.damped - (decay / terms.damped) * terms.velocityCoefficient;
  const velocityAmplitude = Math.hypot(
    record.initialVelocity,
    velocitySineCoefficient,
  );
  const conservative = (value: number): number =>
    Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
  return {
    lastPeakSeconds: 0,
    displacement: seconds =>
      conservative(displacementAmplitude * Math.exp(-decay * seconds)),
    velocity: seconds =>
      conservative(velocityAmplitude * Math.exp(-decay * seconds)),
  };
}

function overdampedTerms(
  record: SpringWithoutDuration,
  natural: number,
  ratio: number,
  decay: number,
): {
  readonly firstCoefficient: number;
  readonly firstRoot: number;
  readonly secondCoefficient: number;
  readonly secondRoot: number;
} {
  const reciprocalRatio = 1 / ratio;
  const rootOffsetRatio = Math.sqrt(
    (1 - reciprocalRatio) * (1 + reciprocalRatio),
  );
  const rootSum = decay * (1 + rootOffsetRatio);
  const firstRoot = -(natural / rootSum) * natural;
  const secondRoot = -rootSum;
  const initialDisplacement = displacement(record);
  const firstCoefficient =
    (record.initialVelocity - secondRoot * initialDisplacement) /
    (firstRoot - secondRoot);
  const secondCoefficient = initialDisplacement - firstCoefficient;
  if (!(firstRoot < 0) || !(secondRoot < 0)) {
    throw new RangeError(
      `${definitionLabel(record.debugName)} parameters must produce finite representable coefficients.`,
    );
  }
  assertRepresentable(
    record,
    firstRoot,
    secondRoot,
    firstCoefficient,
    secondCoefficient,
    firstRoot * firstCoefficient,
    secondRoot * secondCoefficient,
    Math.abs(record.to) + Math.abs(firstCoefficient) + Math.abs(secondCoefficient),
  );
  return {
    firstCoefficient,
    firstRoot,
    secondCoefficient,
    secondRoot,
  };
}

function overdampedEnvelope(
  record: SpringWithoutDuration,
  natural: number,
  ratio: number,
  decay: number,
): SpringEnvelope {
  const terms = overdampedTerms(record, natural, ratio, decay);
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
  const { natural, ratio, decay } = frequencies(record);
  if (Math.abs(ratio - 1) <= CRITICAL_DAMPING_EPSILON) {
    return criticalEnvelope(record, natural);
  }
  return ratio < 1 ?
    underdampedEnvelope(record, natural, ratio, decay) :
    overdampedEnvelope(record, natural, ratio, decay);
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
  if (!normalized.hasFrom) frequencies(normalized);
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

  const initialDisplacement = displacement(record);
  const { natural, ratio, decay: decayRate } = frequencies(record);
  let offset: number;
  let velocity: number;
  if (Math.abs(ratio - 1) <= CRITICAL_DAMPING_EPSILON) {
    const b = record.initialVelocity + natural * initialDisplacement;
    const decay = Math.exp(-natural * time);
    offset = (initialDisplacement + b * time) * decay;
    velocity = (b - natural * (initialDisplacement + b * time)) * decay;
  } else if (ratio < 1) {
    const terms = underdampedTerms(record, natural, ratio, decayRate);
    const angle = terms.damped * time;
    const sine = Math.sin(angle);
    const sineOverFrequency = angle === 0 ? time : time * sine / angle;
    const decay = Math.exp(-decayRate * time);
    const cosine = Math.cos(angle);
    offset = decay * (
      initialDisplacement * cosine +
      terms.velocityCoefficient * sineOverFrequency
    );
    velocity = decay * (
      record.initialVelocity * cosine -
      initialDisplacement * terms.damped * sine -
      decayRate * terms.velocityCoefficient * sineOverFrequency
    );
  } else {
    const terms = overdampedTerms(record, natural, ratio, decayRate);
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
