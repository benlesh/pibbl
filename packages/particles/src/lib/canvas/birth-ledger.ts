import type {
  CompiledEffect2D,
  CompiledEmitter2D,
  CompiledScalar,
} from "../compiler.js";
import {
  countRateBirthsThrough,
  isPotentialBirthAccepted,
  rateBirthTimeAt,
  sampleBurstCount,
  type CompiledRateEmission,
} from "../emission.js";
import { mix32, sampleBetween, sampleInteger, sampleUnit } from "../random.js";
import type { ParticleSystemFrame } from "../system/binding.js";

export const CANVAS_LEDGER_NO_SLOT = 0xffff_ffff;

export interface CanvasEmitterLedger {
  readonly capacity: number;
  readonly birthTimes: Float64Array;
  readonly deathTimes: Float64Array;
  readonly ordinals: Float64Array;
  readonly sourceIds: Uint32Array;
  readonly seedSalts: Uint32Array;
  readonly origins: Float64Array;
  readonly spawnEpochs: Uint32Array;
  readonly occupied: Uint8Array;
  readonly freeSlots: Uint32Array;
  readonly ageOrder: Uint32Array;
  readonly previousAgeOrder: Uint32Array;
  readonly liveCount: number;
  readonly oldestSlot: number;
  readonly newestSlot: number;
}

export interface CanvasLedgerGeneration {
  readonly emitters: readonly CanvasEmitterLedger[];
}

export interface CanvasBirthFrameSummary {
  readonly accepted: number;
  readonly rejected: number;
  readonly liveCount: number;
  readonly nextAutomaticBirthMilliseconds: number | null;
  readonly latestDeathMilliseconds: number | null;
  readonly enumeratedPotentialBirths: number;
}

export interface CanvasManualBirthRequest {
  readonly generation?: number;
  readonly emitterIndex: number;
  readonly sourceIndex: number;
  readonly count: number;
  readonly birthTimeMilliseconds: number;
  readonly seed: number;
  readonly seedSalt: number;
  readonly origin: readonly [number, number];
  readonly spawnEpoch: number;
  readonly parameters: Readonly<Float64Array>;
}

export interface CanvasManualSourcesRequest extends Omit<
  CanvasManualBirthRequest,
  "sourceIndex" | "count"
> {
  readonly count?: number | undefined;
}

export interface CanvasBirthAcceptance {
  readonly requested: number;
  readonly accepted: number;
  readonly rejected: number;
}

export interface CanvasBirthLedgerOptions {
  readonly retainSpawnEpoch?: (epoch: number) => void;
  readonly releaseSpawnEpoch?: (epoch: number) => void;
}

export interface CanvasBirthLedger {
  readonly committed: CanvasLedgerGeneration;
  readonly candidate: CanvasLedgerGeneration;
  adoptFrame(
    frame: ParticleSystemFrame,
    spawnEpoch: number,
    parameters: Readonly<Float64Array>,
  ): CanvasBirthFrameSummary;
  emitManual(request: CanvasManualBirthRequest): CanvasBirthAcceptance;
  emitManualSources(request: CanvasManualSourcesRequest): CanvasBirthAcceptance;
  requestedManualBirths(
    emitterIndex: number,
    count: number | undefined,
    seed: number,
  ): number;
  clear(): void;
  candidateSummary(): CanvasBirthFrameSummary;
  finishTransaction(success: boolean): void;
  dispose(): void;
}

interface MutableCanvasEmitterLedger extends CanvasEmitterLedger {
  liveCount: number;
  freeCount: number;
  oldestSlot: number;
  newestSlot: number;
  nextOrdinal: number;
  runGeneration: number;
  lastEffectTimeMilliseconds: number;
  zeroBirthProcessed: boolean;
  nextAutomaticBirthMilliseconds: number | null;
  readonly touchedSlotMarks: Uint8Array;
  readonly touchedSlots: Uint32Array;
  touchedSlotCount: number;
  readonly touchedFreeMarks: Uint8Array;
  readonly touchedFreeIndices: Uint32Array;
  touchedFreeCount: number;
}

interface MutableCanvasLedgerGeneration extends CanvasLedgerGeneration {
  readonly emitters: readonly MutableCanvasEmitterLedger[];
}

function createEmitterLedger(capacity: number): MutableCanvasEmitterLedger {
  const freeSlots = new Uint32Array(capacity);
  for (let index = 0; index < capacity; index += 1) {
    freeSlots[index] = capacity - index - 1;
  }
  const ageOrder = new Uint32Array(capacity);
  const previousAgeOrder = new Uint32Array(capacity);
  ageOrder.fill(CANVAS_LEDGER_NO_SLOT);
  previousAgeOrder.fill(CANVAS_LEDGER_NO_SLOT);
  return {
    capacity,
    birthTimes: new Float64Array(capacity),
    deathTimes: new Float64Array(capacity),
    ordinals: new Float64Array(capacity),
    sourceIds: new Uint32Array(capacity),
    seedSalts: new Uint32Array(capacity),
    origins: new Float64Array(capacity * 2),
    spawnEpochs: new Uint32Array(capacity),
    occupied: new Uint8Array(capacity),
    freeSlots,
    ageOrder,
    previousAgeOrder,
    liveCount: 0,
    freeCount: capacity,
    oldestSlot: CANVAS_LEDGER_NO_SLOT,
    newestSlot: CANVAS_LEDGER_NO_SLOT,
    nextOrdinal: 0,
    runGeneration: 0,
    lastEffectTimeMilliseconds: 0,
    zeroBirthProcessed: false,
    nextAutomaticBirthMilliseconds: null,
    touchedSlotMarks: new Uint8Array(capacity),
    touchedSlots: new Uint32Array(capacity),
    touchedSlotCount: 0,
    touchedFreeMarks: new Uint8Array(capacity),
    touchedFreeIndices: new Uint32Array(capacity),
    touchedFreeCount: 0,
  };
}

function createGeneration(compiled: CompiledEffect2D) {
  return {
    emitters: compiled.emitters.map((emitter) =>
      createEmitterLedger(emitter.capacity),
    ),
  } satisfies MutableCanvasLedgerGeneration;
}

function touchSlot(ledger: MutableCanvasEmitterLedger, slot: number): void {
  if (ledger.touchedSlotMarks[slot] === 1) return;
  ledger.touchedSlotMarks[slot] = 1;
  ledger.touchedSlots[ledger.touchedSlotCount++] = slot;
}

function touchFreeIndex(
  ledger: MutableCanvasEmitterLedger,
  index: number,
): void {
  if (ledger.touchedFreeMarks[index] === 1) return;
  ledger.touchedFreeMarks[index] = 1;
  ledger.touchedFreeIndices[ledger.touchedFreeCount++] = index;
}

function resetTouches(ledger: MutableCanvasEmitterLedger): void {
  for (let index = 0; index < ledger.touchedSlotCount; index += 1) {
    ledger.touchedSlotMarks[ledger.touchedSlots[index]!] = 0;
  }
  for (let index = 0; index < ledger.touchedFreeCount; index += 1) {
    ledger.touchedFreeMarks[ledger.touchedFreeIndices[index]!] = 0;
  }
  ledger.touchedSlotCount = 0;
  ledger.touchedFreeCount = 0;
}

function copyTouchedEmitter(
  source: MutableCanvasEmitterLedger,
  destination: MutableCanvasEmitterLedger,
): void {
  for (let index = 0; index < source.touchedSlotCount; index += 1) {
    const slot = source.touchedSlots[index]!;
    destination.birthTimes[slot] = source.birthTimes[slot]!;
    destination.deathTimes[slot] = source.deathTimes[slot]!;
    destination.ordinals[slot] = source.ordinals[slot]!;
    destination.sourceIds[slot] = source.sourceIds[slot]!;
    destination.seedSalts[slot] = source.seedSalts[slot]!;
    destination.origins[slot * 2] = source.origins[slot * 2]!;
    destination.origins[slot * 2 + 1] = source.origins[slot * 2 + 1]!;
    destination.spawnEpochs[slot] = source.spawnEpochs[slot]!;
    destination.occupied[slot] = source.occupied[slot]!;
    destination.ageOrder[slot] = source.ageOrder[slot]!;
    destination.previousAgeOrder[slot] = source.previousAgeOrder[slot]!;
  }
  for (let index = 0; index < source.touchedFreeCount; index += 1) {
    const freeIndex = source.touchedFreeIndices[index]!;
    destination.freeSlots[freeIndex] = source.freeSlots[freeIndex]!;
  }
  destination.liveCount = source.liveCount;
  destination.freeCount = source.freeCount;
  destination.oldestSlot = source.oldestSlot;
  destination.newestSlot = source.newestSlot;
  destination.nextOrdinal = source.nextOrdinal;
  destination.runGeneration = source.runGeneration;
  destination.lastEffectTimeMilliseconds = source.lastEffectTimeMilliseconds;
  destination.zeroBirthProcessed = source.zeroBirthProcessed;
  destination.nextAutomaticBirthMilliseconds =
    source.nextAutomaticBirthMilliseconds;
}

function detachLiveSlot(
  ledger: MutableCanvasEmitterLedger,
  slot: number,
): void {
  const previous = ledger.previousAgeOrder[slot]!;
  const next = ledger.ageOrder[slot]!;
  if (previous === CANVAS_LEDGER_NO_SLOT) ledger.oldestSlot = next;
  else {
    ledger.ageOrder[previous] = next;
    touchSlot(ledger, previous);
  }
  if (next === CANVAS_LEDGER_NO_SLOT) ledger.newestSlot = previous;
  else {
    ledger.previousAgeOrder[next] = previous;
    touchSlot(ledger, next);
  }
  ledger.ageOrder[slot] = CANVAS_LEDGER_NO_SLOT;
  ledger.previousAgeOrder[slot] = CANVAS_LEDGER_NO_SLOT;
  touchSlot(ledger, slot);
}

function releaseSlot(ledger: MutableCanvasEmitterLedger, slot: number): void {
  detachLiveSlot(ledger, slot);
  ledger.occupied[slot] = 0;
  ledger.liveCount -= 1;
  ledger.freeSlots[ledger.freeCount] = slot;
  touchFreeIndex(ledger, ledger.freeCount);
  ledger.freeCount += 1;
  touchSlot(ledger, slot);
}

function appendLiveSlot(
  ledger: MutableCanvasEmitterLedger,
  slot: number,
): void {
  const previous = ledger.newestSlot;
  ledger.previousAgeOrder[slot] = previous;
  ledger.ageOrder[slot] = CANVAS_LEDGER_NO_SLOT;
  if (previous === CANVAS_LEDGER_NO_SLOT) ledger.oldestSlot = slot;
  else {
    ledger.ageOrder[previous] = slot;
    touchSlot(ledger, previous);
  }
  ledger.newestSlot = slot;
  touchSlot(ledger, slot);
}

function expire(ledger: MutableCanvasEmitterLedger, effectTime: number): void {
  let slot = ledger.oldestSlot;
  while (slot !== CANVAS_LEDGER_NO_SLOT) {
    const next = ledger.ageOrder[slot]!;
    if (ledger.deathTimes[slot]! <= effectTime) releaseSlot(ledger, slot);
    slot = next;
  }
}

function clearEmitter(ledger: MutableCanvasEmitterLedger): void {
  let slot = ledger.oldestSlot;
  while (slot !== CANVAS_LEDGER_NO_SLOT) {
    const next = ledger.ageOrder[slot]!;
    releaseSlot(ledger, slot);
    slot = next;
  }
  ledger.nextAutomaticBirthMilliseconds = null;
}

function resetEmitterForRun(
  ledger: MutableCanvasEmitterLedger,
  generation: number,
): void {
  clearEmitter(ledger);
  ledger.nextOrdinal = 0;
  ledger.runGeneration = generation;
  ledger.lastEffectTimeMilliseconds = 0;
  ledger.zeroBirthProcessed = false;
}

function effectiveSeed(seed: number, seedSalt: number): number {
  return mix32((seed >>> 0) ^ (seedSalt >>> 0));
}

function sampleScalar(
  scalar: CompiledScalar,
  seed: number,
  emitterHash: number,
  ordinal: number,
  parameters: Readonly<Float64Array>,
): number {
  switch (scalar.kind) {
    case "constant":
      return scalar.value;
    case "between":
      return sampleBetween(
        sampleUnit(seed, emitterHash, ordinal, scalar.channel),
        scalar.min,
        scalar.max,
      );
    case "integer":
      return sampleInteger(
        sampleUnit(seed, emitterHash, ordinal, scalar.channel),
        scalar.min,
        scalar.max,
      );
    case "choice": {
      const target =
        sampleUnit(seed, emitterHash, ordinal, scalar.channel) *
        scalar.choice.totalWeight;
      for (
        let index = 0;
        index < scalar.choice.cumulativeWeights.length;
        index += 1
      ) {
        if (target < scalar.choice.cumulativeWeights[index]!) {
          return scalar.choice.values[index]!;
        }
      }
      return scalar.choice.values[scalar.choice.values.length - 1]!;
    }
    case "parameter":
      return parameters[scalar.offset]!;
  }
}

function acceptBirth(
  emitter: CompiledEmitter2D,
  ledger: MutableCanvasEmitterLedger,
  sourceIndex: number,
  birthTime: number,
  seed: number,
  seedSalt: number,
  originX: number,
  originY: number,
  spawnEpoch: number,
  parameters: Readonly<Float64Array>,
): boolean {
  const ordinal = ledger.nextOrdinal++;
  let slot: number;
  if (ledger.freeCount > 0) {
    ledger.freeCount -= 1;
    touchFreeIndex(ledger, ledger.freeCount);
    slot = ledger.freeSlots[ledger.freeCount]!;
    ledger.liveCount += 1;
  } else if (emitter.overflow === "recycle-oldest") {
    slot = ledger.oldestSlot;
    detachLiveSlot(ledger, slot);
  } else {
    return false;
  }
  const birthSeed = effectiveSeed(seed, seedSalt);
  ledger.birthTimes[slot] = birthTime;
  ledger.deathTimes[slot] =
    birthTime +
    sampleScalar(
      emitter.initial.lifetime,
      birthSeed,
      emitter.emitterHash,
      ordinal,
      parameters,
    );
  ledger.ordinals[slot] = ordinal;
  ledger.sourceIds[slot] = sourceIndex >>> 0;
  ledger.seedSalts[slot] = seedSalt >>> 0;
  ledger.origins[slot * 2] = originX;
  ledger.origins[slot * 2 + 1] = originY;
  ledger.spawnEpochs[slot] = spawnEpoch >>> 0;
  ledger.occupied[slot] = 1;
  appendLiveSlot(ledger, slot);
  touchSlot(ledger, slot);
  return true;
}

function birthsPerRateCycle(rate: CompiledRateEmission): number {
  if (!Number.isFinite(rate.intervalMilliseconds)) return 0;
  if (rate.durationMilliseconds === null) return Number.POSITIVE_INFINITY;
  return Math.floor(rate.durationMilliseconds / rate.intervalMilliseconds);
}

function rateBirthsAt(rate: CompiledRateEmission, time: number): number {
  if (!Number.isFinite(rate.intervalMilliseconds)) return 0;
  const maximum = birthsPerRateCycle(rate);
  let count = 0;
  for (let cycle = 0; cycle < rate.cycleCount; cycle += 1) {
    const cycleStart =
      rate.startMilliseconds + cycle * (rate.repeatEveryMilliseconds ?? 0);
    const raw = (time - cycleStart) / rate.intervalMilliseconds;
    const rounded = Math.round(raw);
    const tolerance = Number.EPSILON * Math.max(8, Math.abs(raw) * 8);
    if (
      rounded >= 1 &&
      rounded <= maximum &&
      Math.abs(raw - rounded) <= tolerance
    ) {
      count += 1;
    }
  }
  return count;
}

function nextRateBirthAfter(
  rate: CompiledRateEmission,
  after: number,
): number | null {
  if (!Number.isFinite(rate.intervalMilliseconds)) return null;
  const maximum = birthsPerRateCycle(rate);
  let next: number | null = null;
  for (let cycle = 0; cycle < rate.cycleCount; cycle += 1) {
    const cycleStart =
      rate.startMilliseconds + cycle * (rate.repeatEveryMilliseconds ?? 0);
    const elapsed = after - cycleStart;
    const birthIndex = Math.max(
      0,
      Math.floor(elapsed / rate.intervalMilliseconds),
    );
    if (birthIndex >= maximum) continue;
    const time = rateBirthTimeAt(rate, birthIndex, cycle);
    if (time <= after) {
      const followingIndex = birthIndex + 1;
      if (followingIndex >= maximum) continue;
      const following = rateBirthTimeAt(rate, followingIndex, cycle);
      next = next === null ? following : Math.min(next, following);
    } else {
      next = next === null ? time : Math.min(next, time);
    }
  }
  return next;
}

function nextAutomaticTime(
  emitter: CompiledEmitter2D,
  after: number,
  includeZero: boolean,
): number | null {
  let next: number | null = null;
  for (const rate of emitter.emission.rates) {
    if (rate.probability <= 0) continue;
    const time = nextRateBirthAfter(rate, after);
    if (time !== null) next = next === null ? time : Math.min(next, time);
  }
  for (const burst of emitter.emission.bursts) {
    if (burst.probability <= 0 || burst.maximumCount <= 0) continue;
    if (
      burst.atMilliseconds > after ||
      (includeZero && burst.atMilliseconds === 0)
    ) {
      next =
        next === null
          ? burst.atMilliseconds
          : Math.min(next, burst.atMilliseconds);
    }
  }
  return next;
}

function addSkippedRateBirths(
  emitter: CompiledEmitter2D,
  ledger: MutableCanvasEmitterLedger,
  fromExclusive: number,
  throughInclusive: number,
  excludeThrough: boolean,
): void {
  for (const rate of emitter.emission.rates) {
    if (rate.probability <= 0) continue;
    let count =
      countRateBirthsThrough(rate, throughInclusive) -
      countRateBirthsThrough(rate, fromExclusive);
    if (excludeThrough) count -= rateBirthsAt(rate, throughInclusive);
    ledger.nextOrdinal += Math.max(0, count);
  }
}

function maximumSourceIndex(emitter: CompiledEmitter2D): number {
  let maximum = -1;
  for (const rate of emitter.emission.rates) {
    maximum = Math.max(maximum, rate.sourceIndex);
  }
  for (const burst of emitter.emission.bursts) {
    maximum = Math.max(maximum, burst.sourceIndex);
  }
  return maximum;
}

function fastForwardDeadBirths(
  emitter: CompiledEmitter2D,
  ledger: MutableCanvasEmitterLedger,
  fromExclusive: number,
  throughInclusive: number,
  includeZero: boolean,
  seed: number,
): void {
  let cursor = fromExclusive;
  let includeZeroAtCursor = includeZero;
  while (true) {
    let burstTime: number | null = null;
    for (const burst of emitter.emission.bursts) {
      if (
        burst.probability <= 0 ||
        burst.maximumCount <= 0 ||
        burst.atMilliseconds > throughInclusive ||
        (burst.atMilliseconds <= cursor &&
          !(includeZeroAtCursor && burst.atMilliseconds === 0))
      ) {
        continue;
      }
      burstTime =
        burstTime === null
          ? burst.atMilliseconds
          : Math.min(burstTime, burst.atMilliseconds);
    }
    if (burstTime === null) break;
    addSkippedRateBirths(emitter, ledger, cursor, burstTime, true);
    const maximumSource = maximumSourceIndex(emitter);
    for (let source = 0; source <= maximumSource; source += 1) {
      for (const rate of emitter.emission.rates) {
        if (rate.probability <= 0 || rate.sourceIndex !== source) continue;
        ledger.nextOrdinal += rateBirthsAt(rate, burstTime);
      }
      for (const burst of emitter.emission.bursts) {
        if (
          burst.probability <= 0 ||
          burst.maximumCount <= 0 ||
          burst.sourceIndex !== source ||
          burst.atMilliseconds !== burstTime
        )
          continue;
        const requested = sampleBurstCount(
          burst,
          seed,
          emitter.emitterHash,
          ledger.nextOrdinal,
        );
        ledger.nextOrdinal += requested;
      }
    }
    cursor = burstTime;
    includeZeroAtCursor = false;
  }
  addSkippedRateBirths(emitter, ledger, cursor, throughInclusive, false);
}

function enumerateAutomaticBirths(
  emitter: CompiledEmitter2D,
  ledger: MutableCanvasEmitterLedger,
  fromExclusive: number,
  throughInclusive: number,
  includeZero: boolean,
  seed: number,
  spawnEpoch: number,
  parameters: Readonly<Float64Array>,
): Readonly<{
  accepted: number;
  rejected: number;
  enumerated: number;
}> {
  let accepted = 0;
  let rejected = 0;
  let enumerated = 0;
  let cursor = fromExclusive;
  let includeZeroAtCursor = includeZero;
  while (true) {
    const time = nextAutomaticTime(emitter, cursor, includeZeroAtCursor);
    if (time === null || time > throughInclusive) break;
    expire(ledger, time);
    const maximumSource = maximumSourceIndex(emitter);
    for (let source = 0; source <= maximumSource; source += 1) {
      for (const rate of emitter.emission.rates) {
        if (rate.probability <= 0 || rate.sourceIndex !== source) continue;
        const count = rateBirthsAt(rate, time);
        for (let index = 0; index < count; index += 1) {
          const ordinal = ledger.nextOrdinal;
          enumerated += 1;
          if (
            isPotentialBirthAccepted(
              rate.probability,
              seed,
              emitter.emitterHash,
              ordinal,
              rate.probabilityChannel,
            )
          ) {
            if (
              acceptBirth(
                emitter,
                ledger,
                source,
                time,
                seed,
                0,
                0,
                0,
                spawnEpoch,
                parameters,
              )
            )
              accepted += 1;
            else rejected += 1;
          } else {
            ledger.nextOrdinal += 1;
          }
        }
      }
      for (const burst of emitter.emission.bursts) {
        if (
          burst.probability <= 0 ||
          burst.maximumCount <= 0 ||
          burst.sourceIndex !== source ||
          burst.atMilliseconds !== time
        )
          continue;
        const ordinal = ledger.nextOrdinal;
        const requested = sampleBurstCount(
          burst,
          seed,
          emitter.emitterHash,
          ordinal,
        );
        for (let index = 0; index < requested; index += 1) {
          enumerated += 1;
          if (
            isPotentialBirthAccepted(
              burst.probability,
              seed,
              emitter.emitterHash,
              ledger.nextOrdinal,
              burst.probabilityChannel,
            )
          ) {
            if (
              acceptBirth(
                emitter,
                ledger,
                source,
                time,
                seed,
                0,
                0,
                0,
                spawnEpoch,
                parameters,
              )
            )
              accepted += 1;
            else rejected += 1;
          } else {
            ledger.nextOrdinal += 1;
          }
        }
      }
    }
    cursor = time;
    includeZeroAtCursor = false;
  }
  return { accepted, rejected, enumerated };
}

function maximumLifetime(
  emitter: CompiledEmitter2D,
  parameters: Readonly<Float64Array>,
): number {
  return emitter.maximumLifetime.kind === "fixed"
    ? emitter.maximumLifetime.milliseconds
    : parameters[emitter.maximumLifetime.offset]!;
}

function latestDeath(generation: MutableCanvasLedgerGeneration): number | null {
  let latest: number | null = null;
  for (const emitter of generation.emitters) {
    for (let slot = 0; slot < emitter.capacity; slot += 1) {
      if (emitter.occupied[slot] !== 1) continue;
      latest =
        latest === null
          ? emitter.deathTimes[slot]!
          : Math.max(latest, emitter.deathTimes[slot]!);
    }
  }
  return latest;
}

function summary(
  generation: MutableCanvasLedgerGeneration,
  accepted = 0,
  rejected = 0,
  enumeratedPotentialBirths = 0,
): CanvasBirthFrameSummary {
  let liveCount = 0;
  let nextAutomaticBirthMilliseconds: number | null = null;
  for (const emitter of generation.emitters) {
    liveCount += emitter.liveCount;
    const next = emitter.nextAutomaticBirthMilliseconds;
    if (next !== null) {
      nextAutomaticBirthMilliseconds =
        nextAutomaticBirthMilliseconds === null
          ? next
          : Math.min(nextAutomaticBirthMilliseconds, next);
    }
  }
  return Object.freeze({
    accepted,
    rejected,
    liveCount,
    nextAutomaticBirthMilliseconds,
    latestDeathMilliseconds: latestDeath(generation),
    enumeratedPotentialBirths,
  });
}

/** Creates one allocation-stable, transactional Canvas birth ledger. */
export function createCanvasBirthLedger(
  compiled: CompiledEffect2D,
  options: CanvasBirthLedgerOptions = {},
): CanvasBirthLedger {
  let committed = createGeneration(compiled);
  let candidate = createGeneration(compiled);
  let transactionOpen = false;
  let disposed = false;

  function ensureCandidate(): void {
    if (disposed) throw new Error("Cannot use a disposed Canvas birth ledger.");
    transactionOpen = true;
  }

  function reconcileEpochs(): void {
    for (
      let emitterIndex = 0;
      emitterIndex < candidate.emitters.length;
      emitterIndex += 1
    ) {
      const next = candidate.emitters[emitterIndex]!;
      const previous = committed.emitters[emitterIndex]!;
      for (let index = 0; index < next.touchedSlotCount; index += 1) {
        const slot = next.touchedSlots[index]!;
        const hadPrevious = previous.occupied[slot] === 1;
        const hasNext = next.occupied[slot] === 1;
        const previousEpoch = previous.spawnEpochs[slot]!;
        const nextEpoch = next.spawnEpochs[slot]!;
        if (hasNext && (!hadPrevious || previousEpoch !== nextEpoch)) {
          options.retainSpawnEpoch?.(nextEpoch);
        }
      }
      for (let index = 0; index < next.touchedSlotCount; index += 1) {
        const slot = next.touchedSlots[index]!;
        const hadPrevious = previous.occupied[slot] === 1;
        const hasNext = next.occupied[slot] === 1;
        const previousEpoch = previous.spawnEpochs[slot]!;
        const nextEpoch = next.spawnEpochs[slot]!;
        if (hadPrevious && (!hasNext || previousEpoch !== nextEpoch)) {
          options.releaseSpawnEpoch?.(previousEpoch);
        }
      }
    }
  }

  const api: CanvasBirthLedger = {
    get committed() {
      return committed;
    },
    get candidate() {
      return candidate;
    },
    adoptFrame(frame, spawnEpoch, parameters) {
      ensureCandidate();
      let accepted = 0;
      let rejected = 0;
      let enumeratedPotentialBirths = 0;
      for (
        let emitterIndex = 0;
        emitterIndex < compiled.emitters.length;
        emitterIndex += 1
      ) {
        const emitter = compiled.emitters[emitterIndex]!;
        const state = candidate.emitters[emitterIndex]!;
        const changedGeneration = state.runGeneration !== frame.generation;
        if (changedGeneration) resetEmitterForRun(state, frame.generation);
        expire(state, frame.effectTimeMilliseconds);
        if (frame.status === "running") {
          const from = changedGeneration
            ? 0
            : Math.max(
                state.lastEffectTimeMilliseconds,
                frame.previousEffectTimeMilliseconds,
              );
          const includeZero = changedGeneration && !state.zeroBirthProcessed;
          const deadThrough =
            frame.effectTimeMilliseconds - maximumLifetime(emitter, parameters);
          const liveFrom = Math.max(from, deadThrough);
          if (
            liveFrom > from ||
            (includeZero && deadThrough >= 0 && liveFrom === 0)
          ) {
            fastForwardDeadBirths(
              emitter,
              state,
              from,
              liveFrom,
              includeZero,
              frame.seed,
            );
          }
          const births = enumerateAutomaticBirths(
            emitter,
            state,
            liveFrom,
            frame.effectTimeMilliseconds,
            includeZero && liveFrom === 0 && deadThrough < 0,
            frame.seed,
            spawnEpoch,
            parameters,
          );
          expire(state, frame.effectTimeMilliseconds);
          accepted += births.accepted;
          rejected += births.rejected;
          enumeratedPotentialBirths += births.enumerated;
          state.lastEffectTimeMilliseconds = frame.effectTimeMilliseconds;
          state.zeroBirthProcessed = true;
          state.nextAutomaticBirthMilliseconds = nextAutomaticTime(
            emitter,
            frame.effectTimeMilliseconds,
            false,
          );
        } else {
          state.lastEffectTimeMilliseconds = frame.effectTimeMilliseconds;
          state.zeroBirthProcessed = true;
          state.nextAutomaticBirthMilliseconds = null;
        }
      }
      return summary(candidate, accepted, rejected, enumeratedPotentialBirths);
    },
    emitManual(request) {
      ensureCandidate();
      const emitter = compiled.emitters[request.emitterIndex];
      const state = candidate.emitters[request.emitterIndex];
      if (emitter === undefined || state === undefined) {
        throw new RangeError("Canvas birth request emitter index is invalid.");
      }
      if (
        request.generation !== undefined &&
        state.runGeneration !== request.generation
      ) {
        resetEmitterForRun(state, request.generation);
      }
      expire(state, request.birthTimeMilliseconds);
      let accepted = 0;
      for (let index = 0; index < request.count; index += 1) {
        if (
          acceptBirth(
            emitter,
            state,
            request.sourceIndex,
            request.birthTimeMilliseconds,
            request.seed,
            request.seedSalt,
            request.origin[0],
            request.origin[1],
            request.spawnEpoch,
            request.parameters,
          )
        ) {
          accepted += 1;
        }
      }
      return Object.freeze({
        requested: request.count,
        accepted,
        rejected: request.count - accepted,
      });
    },
    emitManualSources(request) {
      ensureCandidate();
      const emitter = compiled.emitters[request.emitterIndex];
      const state = candidate.emitters[request.emitterIndex];
      if (emitter === undefined || state === undefined) {
        throw new RangeError("Canvas birth request emitter index is invalid.");
      }
      if (
        request.generation !== undefined &&
        state.runGeneration !== request.generation
      ) {
        resetEmitterForRun(state, request.generation);
      }
      expire(state, request.birthTimeMilliseconds);
      let requested = 0;
      let accepted = 0;
      if (request.count !== undefined) {
        const source = emitter.emission.manual[0];
        if (source === undefined) {
          throw new RangeError("Canvas birth request has no manual source.");
        }
        requested = request.count;
        for (let index = 0; index < requested; index += 1) {
          if (
            acceptBirth(
              emitter,
              state,
              source.sourceIndex,
              request.birthTimeMilliseconds,
              request.seed,
              request.seedSalt,
              request.origin[0],
              request.origin[1],
              request.spawnEpoch,
              request.parameters,
            )
          )
            accepted += 1;
        }
      } else {
        for (const source of emitter.emission.manual) {
          const count = sampleBurstCount(
            source,
            request.seed,
            emitter.emitterHash,
            state.nextOrdinal,
          );
          requested += count;
          for (let index = 0; index < count; index += 1) {
            if (
              acceptBirth(
                emitter,
                state,
                source.sourceIndex,
                request.birthTimeMilliseconds,
                request.seed,
                request.seedSalt,
                request.origin[0],
                request.origin[1],
                request.spawnEpoch,
                request.parameters,
              )
            )
              accepted += 1;
          }
        }
      }
      return Object.freeze({
        requested,
        accepted,
        rejected: requested - accepted,
      });
    },
    requestedManualBirths(emitterIndex, count, seed) {
      if (count !== undefined) return count;
      const emitter = compiled.emitters[emitterIndex];
      const state = candidate.emitters[emitterIndex];
      if (emitter === undefined || state === undefined) {
        throw new RangeError("Canvas birth request emitter index is invalid.");
      }
      let requested = 0;
      let ordinal = state.nextOrdinal;
      for (const source of emitter.emission.manual) {
        const sourceCount = sampleBurstCount(
          source,
          seed,
          emitter.emitterHash,
          ordinal,
        );
        requested += sourceCount;
        ordinal += sourceCount;
      }
      return requested;
    },
    clear() {
      ensureCandidate();
      for (const emitter of candidate.emitters) clearEmitter(emitter);
    },
    candidateSummary() {
      return summary(candidate);
    },
    finishTransaction(success) {
      if (!transactionOpen || disposed) return;
      if (success) reconcileEpochs();
      for (
        let emitterIndex = 0;
        emitterIndex < candidate.emitters.length;
        emitterIndex += 1
      ) {
        const source = success
          ? candidate.emitters[emitterIndex]!
          : committed.emitters[emitterIndex]!;
        const destination = success
          ? committed.emitters[emitterIndex]!
          : candidate.emitters[emitterIndex]!;
        if (!success) {
          for (
            let index = 0;
            index < destination.touchedSlotCount;
            index += 1
          ) {
            const slot = destination.touchedSlots[index]!;
            if (source.touchedSlotMarks[slot] === 0) {
              source.touchedSlotMarks[slot] = 1;
              source.touchedSlots[source.touchedSlotCount++] = slot;
            }
          }
          for (
            let index = 0;
            index < destination.touchedFreeCount;
            index += 1
          ) {
            const freeIndex = destination.touchedFreeIndices[index]!;
            if (source.touchedFreeMarks[freeIndex] === 0) {
              source.touchedFreeMarks[freeIndex] = 1;
              source.touchedFreeIndices[source.touchedFreeCount++] = freeIndex;
            }
          }
        }
        copyTouchedEmitter(source, destination);
      }
      if (success) {
        const previous = committed;
        committed = candidate;
        candidate = previous;
      }
      for (const emitter of committed.emitters) resetTouches(emitter);
      for (const emitter of candidate.emitters) resetTouches(emitter);
      transactionOpen = false;
    },
    dispose() {
      if (disposed) return;
      if (transactionOpen) api.finishTransaction(false);
      disposed = true;
      for (const emitter of committed.emitters) {
        for (let slot = 0; slot < emitter.capacity; slot += 1) {
          if (emitter.occupied[slot] === 1) {
            options.releaseSpawnEpoch?.(emitter.spawnEpochs[slot]!);
          }
        }
      }
    },
  };
  return api;
}
