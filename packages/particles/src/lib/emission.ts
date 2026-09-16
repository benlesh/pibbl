import { getParticleDescriptorRecord } from "./particle.js";
import type { CRCParticleEmission } from "./types.js";
import { hashEmitterName, sampleInteger, sampleUnit } from "./random.js";

export type ParticleCompletion =
  "finite" | "automatic-infinite" | "manual-open";

export type CompiledMaximumLifetime =
  | Readonly<{ kind: "fixed"; milliseconds: number }>
  | Readonly<{ kind: "parameter"; offset: number }>;

export interface CompiledRateEmission {
  readonly type: "rate";
  readonly sourceIndex: number;
  readonly startMilliseconds: number;
  readonly durationMilliseconds: number | null;
  readonly intervalMilliseconds: number;
  readonly probability: number;
  readonly probabilityChannel: number;
  readonly repeatEveryMilliseconds: number | null;
  readonly cycleCount: number;
}

export interface CompiledBurstEmission {
  readonly type: "burst";
  readonly sourceIndex: number;
  readonly cycleIndex: number;
  readonly atMilliseconds: number;
  readonly minimumCount: number;
  readonly maximumCount: number;
  readonly countChannel: number;
  readonly probability: number;
  readonly probabilityChannel: number;
}

export interface CompiledManualEmission {
  readonly type: "manual";
  readonly sourceIndex: number;
  readonly minimumCount: number;
  readonly maximumCount: number;
  readonly countChannel: number;
}

export interface CompiledEmissionSchedule {
  readonly rates: readonly CompiledRateEmission[];
  readonly bursts: readonly CompiledBurstEmission[];
  readonly manual: readonly CompiledManualEmission[];
  readonly completion: ParticleCompletion;
  readonly maximumLifetime: CompiledMaximumLifetime;
  readonly earliestAutomaticBirthMilliseconds: number | null;
  readonly latestAutomaticBirthMilliseconds: number | null;
  readonly completionMilliseconds: number | null;
  readonly maximumPotentiallyLiveOrdinals: number | null;
}

function channelFor(sourceIndex: number, property: string): number {
  return hashEmitterName(`emission[${sourceIndex}].${property}`);
}

function countRange(
  count: number | object | undefined,
  fallback: number,
): readonly [minimum: number, maximum: number] {
  if (count === undefined) return [fallback, fallback];
  if (typeof count === "number") return [count, count];
  const record = getParticleDescriptorRecord(count);
  if (record?.type !== "integer") {
    throw new TypeError("Particle emission count must use particleInteger().");
  }
  return [record.min, record.max];
}

function rateCycleCount(
  source: Extract<CRCParticleEmission, { type: "rate" }>,
): number {
  return source.repeat?.count ?? 1;
}

function rateCycleOffset(
  rate: CompiledRateEmission,
  cycleIndex: number,
): number {
  return cycleIndex * (rate.repeatEveryMilliseconds ?? 0);
}

function birthsInOneRateCycle(rate: CompiledRateEmission): number {
  if (!Number.isFinite(rate.intervalMilliseconds)) return 0;
  if (rate.durationMilliseconds === null) return Number.POSITIVE_INFINITY;
  return Math.floor(rate.durationMilliseconds / rate.intervalMilliseconds);
}

export function rateBirthTimeAt(
  rate: CompiledRateEmission,
  birthIndex: number,
  cycleIndex: number,
): number {
  return (
    rate.startMilliseconds +
    rateCycleOffset(rate, cycleIndex) +
    (birthIndex + 1) * rate.intervalMilliseconds
  );
}

export function countRateBirthsThrough(
  rate: CompiledRateEmission,
  effectTimeMilliseconds: number,
): number {
  if (!Number.isFinite(rate.intervalMilliseconds)) return 0;
  let total = 0;
  const perCycle = birthsInOneRateCycle(rate);
  for (let cycle = 0; cycle < rate.cycleCount; cycle += 1) {
    const elapsed =
      effectTimeMilliseconds -
      rate.startMilliseconds -
      rateCycleOffset(rate, cycle);
    if (elapsed < rate.intervalMilliseconds) continue;
    const count = Math.floor(elapsed / rate.intervalMilliseconds);
    total += Math.min(count, perCycle);
  }
  return total;
}

export function isPotentialBirthAccepted(
  probability: number,
  seed: number,
  emitterHash: number,
  potentialOrdinal: number,
  probabilityChannel: number,
): boolean {
  if (probability <= 0) return false;
  if (probability >= 1) return true;
  return (
    sampleUnit(seed, emitterHash, potentialOrdinal, probabilityChannel) <
    probability
  );
}

export function sampleBurstCount(
  burst: CompiledBurstEmission | CompiledManualEmission,
  seed: number,
  emitterHash: number,
  potentialOrdinal: number,
): number {
  if (burst.minimumCount === burst.maximumCount) return burst.minimumCount;
  return sampleInteger(
    sampleUnit(seed, emitterHash, potentialOrdinal, burst.countChannel),
    burst.minimumCount,
    burst.maximumCount,
  );
}

function finiteRateBirthTimes(
  rate: CompiledRateEmission,
): readonly [number, number] | null {
  const birthsPerCycle = birthsInOneRateCycle(rate);
  if (
    !Number.isFinite(birthsPerCycle) ||
    birthsPerCycle <= 0 ||
    rate.probability <= 0
  ) {
    return null;
  }
  return [
    rateBirthTimeAt(rate, 0, 0),
    rateBirthTimeAt(rate, birthsPerCycle - 1, rate.cycleCount - 1),
  ];
}

export function compileEmissionSchedule(
  sources: readonly CRCParticleEmission[],
  maximumLifetimeInput: number | CompiledMaximumLifetime,
): CompiledEmissionSchedule {
  const maximumLifetime =
    typeof maximumLifetimeInput === "number"
      ? Object.freeze({
          kind: "fixed" as const,
          milliseconds: maximumLifetimeInput,
        })
      : maximumLifetimeInput;
  const rates: CompiledRateEmission[] = [];
  const bursts: CompiledBurstEmission[] = [];
  const manual: CompiledManualEmission[] = [];

  for (let sourceIndex = 0; sourceIndex < sources.length; sourceIndex += 1) {
    const source = sources[sourceIndex]!;
    switch (source.type) {
      case "rate": {
        const rate = Object.freeze({
          type: "rate" as const,
          sourceIndex,
          startMilliseconds: source.startMilliseconds ?? 0,
          durationMilliseconds: source.durationMilliseconds ?? null,
          intervalMilliseconds:
            source.particlesPerSecond === 0
              ? Number.POSITIVE_INFINITY
              : 1_000 / source.particlesPerSecond,
          probability: source.probability ?? 1,
          probabilityChannel: channelFor(sourceIndex, "probability"),
          repeatEveryMilliseconds: source.repeat?.everyMilliseconds ?? null,
          cycleCount: rateCycleCount(source),
        });
        rates.push(rate);
        break;
      }
      case "burst": {
        const [minimumCount, maximumCount] = countRange(source.count, 1);
        const cycles = source.repeat?.count ?? 1;
        const every = source.repeat?.everyMilliseconds ?? 0;
        for (let cycleIndex = 0; cycleIndex < cycles; cycleIndex += 1) {
          bursts.push(
            Object.freeze({
              type: "burst",
              sourceIndex,
              cycleIndex,
              atMilliseconds: source.atMilliseconds + cycleIndex * every,
              minimumCount,
              maximumCount,
              countChannel: channelFor(sourceIndex, "count"),
              probability: source.probability ?? 1,
              probabilityChannel: channelFor(sourceIndex, "probability"),
            }),
          );
        }
        break;
      }
      case "manual": {
        const [minimumCount, maximumCount] = countRange(source.count, 1);
        manual.push(
          Object.freeze({
            type: "manual",
            sourceIndex,
            minimumCount,
            maximumCount,
            countChannel: channelFor(sourceIndex, "count"),
          }),
        );
        break;
      }
    }
  }

  bursts.sort(
    (left, right) =>
      left.atMilliseconds - right.atMilliseconds ||
      left.sourceIndex - right.sourceIndex ||
      left.cycleIndex - right.cycleIndex,
  );

  let earliest: number | null = null;
  let latest: number | null = null;
  let automaticInfinite = false;
  let maximumPotentiallyLiveOrdinals: number | null = 0;

  for (const burst of bursts) {
    if (burst.probability <= 0) continue;
    earliest =
      earliest === null
        ? burst.atMilliseconds
        : Math.min(earliest, burst.atMilliseconds);
    latest =
      latest === null
        ? burst.atMilliseconds
        : Math.max(latest, burst.atMilliseconds);
    if (maximumPotentiallyLiveOrdinals !== null) {
      maximumPotentiallyLiveOrdinals += burst.maximumCount;
    }
  }

  for (const rate of rates) {
    if (rate.probability <= 0 || !Number.isFinite(rate.intervalMilliseconds))
      continue;
    if (rate.durationMilliseconds === null) {
      automaticInfinite = true;
      const first = rateBirthTimeAt(rate, 0, 0);
      earliest = earliest === null ? first : Math.min(earliest, first);
      if (maximumLifetime.kind === "parameter") {
        maximumPotentiallyLiveOrdinals = null;
      } else if (maximumPotentiallyLiveOrdinals !== null) {
        maximumPotentiallyLiveOrdinals +=
          Math.ceil(maximumLifetime.milliseconds / rate.intervalMilliseconds) +
          1;
      }
      continue;
    }
    const interval = finiteRateBirthTimes(rate);
    if (interval === null) continue;
    earliest =
      earliest === null ? interval[0] : Math.min(earliest, interval[0]);
    latest = latest === null ? interval[1] : Math.max(latest, interval[1]);
    if (maximumPotentiallyLiveOrdinals !== null) {
      maximumPotentiallyLiveOrdinals +=
        birthsInOneRateCycle(rate) * rate.cycleCount;
    }
  }

  const completion: ParticleCompletion =
    manual.length > 0
      ? "manual-open"
      : automaticInfinite
        ? "automatic-infinite"
        : "finite";
  const finiteLatest = automaticInfinite ? null : latest;
  return Object.freeze({
    rates: Object.freeze(rates),
    bursts: Object.freeze(bursts),
    manual: Object.freeze(manual),
    completion,
    maximumLifetime,
    earliestAutomaticBirthMilliseconds: earliest,
    latestAutomaticBirthMilliseconds: finiteLatest,
    completionMilliseconds:
      completion !== "finite"
        ? null
        : maximumLifetime.kind === "parameter"
          ? null
          : finiteLatest === null
            ? 0
            : finiteLatest + maximumLifetime.milliseconds,
    maximumPotentiallyLiveOrdinals,
  });
}
