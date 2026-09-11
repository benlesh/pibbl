import { getSignalNode, isSignal } from '../signals/graph.js';
import type { WritableSignal } from '../signals/types.js';
import { getDefinitionRecord } from './definition.js';
import type {
  CRCAnimationDefinition,
  CRCAnimationProgram,
  CRCAnimationRepeatDirection,
  CRCAnimationRepeatOptions,
} from './types.js';

export type ProgramDuration =
  | { readonly kind: 'finite'; readonly milliseconds: number }
  | { readonly kind: 'infinite' }
  | { readonly kind: 'unresolved-stepper' };

export interface WriterSpan {
  readonly output: WritableSignal<unknown>;
  readonly start: number;
  readonly end: number;
  readonly path: readonly number[];
}

interface WriterRepeatFrame {
  readonly period: number;
  readonly iterations: number;
}

interface WriterSchedule {
  readonly span: WriterSpan;
  readonly repeats: readonly WriterRepeatFrame[];
}

interface BaseProgramRecord {
  readonly kind: 'track' | 'sequence' | 'parallel' | 'wait' | 'marker' | 'repeat';
  readonly children: readonly CRCAnimationProgram[];
  readonly duration: ProgramDuration;
  readonly hasReachableWork: boolean;
  readonly outputs: readonly WritableSignal<unknown>[];
  readonly writerSpans: readonly WriterSpan[];
  readonly writerSchedules: readonly WriterSchedule[];
}

export interface TrackProgramRecord extends BaseProgramRecord {
  readonly kind: 'track';
  readonly output: WritableSignal<unknown>;
  readonly definition: CRCAnimationDefinition<unknown>;
}

export interface SequenceProgramRecord extends BaseProgramRecord {
  readonly kind: 'sequence';
}

export interface ParallelProgramRecord extends BaseProgramRecord {
  readonly kind: 'parallel';
}

export interface WaitProgramRecord extends BaseProgramRecord {
  readonly kind: 'wait';
}

export interface MarkerProgramRecord extends BaseProgramRecord {
  readonly kind: 'marker';
  readonly name: string;
}

export interface RepeatProgramRecord extends BaseProgramRecord {
  readonly kind: 'repeat';
  readonly iterations: number;
  readonly direction: CRCAnimationRepeatDirection;
}

export type ProgramRecord =
  | TrackProgramRecord
  | SequenceProgramRecord
  | ParallelProgramRecord
  | WaitProgramRecord
  | MarkerProgramRecord
  | RepeatProgramRecord;

const programRecords = new WeakMap<CRCAnimationProgram, ProgramRecord>();

const finite = (milliseconds: number): ProgramDuration => Object.freeze({
  kind: 'finite' as const,
  milliseconds,
});
const infinite: ProgramDuration = Object.freeze({ kind: 'infinite' as const });
const unresolved: ProgramDuration = Object.freeze({ kind: 'unresolved-stepper' as const });

function freezePath(path: readonly number[]): readonly number[] {
  return Object.freeze([...path]);
}

function freezeSpan(
  output: WritableSignal<unknown>,
  start: number,
  end: number,
  path: readonly number[],
): WriterSpan {
  return Object.freeze({ output, start, end, path: freezePath(path) });
}

function freezeSchedule(
  span: WriterSpan,
  repeats: readonly WriterRepeatFrame[] = [],
): WriterSchedule {
  return Object.freeze({
    span,
    repeats: Object.freeze(repeats.map(repeat => Object.freeze({ ...repeat }))),
  });
}

function finiteWriterSpans(schedules: readonly WriterSchedule[]): readonly WriterSpan[] {
  return Object.freeze(schedules.map(schedule => schedule.span));
}

function outputsFor(schedules: readonly WriterSchedule[]): readonly WritableSignal<unknown>[] {
  const outputs: WritableSignal<unknown>[] = [];
  for (const schedule of schedules) {
    if (!outputs.includes(schedule.span.output)) outputs.push(schedule.span.output);
  }
  return Object.freeze(outputs);
}

function createProgram<T extends ProgramRecord>(record: T): CRCAnimationProgram {
  const program = Object.freeze({}) as CRCAnimationProgram;
  programRecords.set(program, Object.freeze(record) as ProgramRecord);
  return program;
}

function programLabel(path: readonly number[]): string {
  return `[${path.join(', ')}]`;
}

function definitionDuration(definition: CRCAnimationDefinition<unknown>): ProgramDuration {
  const record = getDefinitionRecord(definition);
  if (record.kind !== 'stepper') return finite(record.duration);
  return record.done === undefined ? infinite : unresolved;
}

function assertWritableSignal<T>(output: WritableSignal<T>): WritableSignal<unknown> {
  if (!isSignal(output) || typeof output.set !== 'function' || typeof output.update !== 'function') {
    throw new TypeError('Expected a writable signal created by signal().');
  }
  return output as WritableSignal<unknown>;
}

function prefixedSchedules(
  schedules: readonly WriterSchedule[],
  childIndex: number,
  offset: number,
): readonly WriterSchedule[] {
  return Object.freeze(schedules.map(schedule => freezeSchedule(
    freezeSpan(
      schedule.span.output,
      schedule.span.start + offset,
      schedule.span.end + offset,
      [childIndex, ...schedule.span.path],
    ),
    schedule.repeats,
  )));
}

function normalizedRepeats(
  repeats: readonly WriterRepeatFrame[],
): readonly WriterRepeatFrame[] {
  const normalized: WriterRepeatFrame[] = [];
  for (const repeat of repeats) {
    if (repeat.iterations === 1) continue;
    const previous = normalized.at(-1);
    const combinedIterations = previous === undefined ? Number.NaN :
      previous.iterations * repeat.iterations;
    if (previous !== undefined &&
      repeat.period === previous.period * previous.iterations &&
      Number.isFinite(combinedIterations) && Number.isInteger(combinedIterations)) {
      normalized[normalized.length - 1] = { period: previous.period, iterations: combinedIterations };
    } else {
      normalized.push({ period: repeat.period, iterations: repeat.iterations });
    }
  }
  return Object.freeze(normalized.map(repeat => Object.freeze(repeat)));
}

function withRepeat(
  schedules: readonly WriterSchedule[],
  period: number,
  iterations: number,
): readonly WriterSchedule[] {
  return Object.freeze(schedules.map(schedule => freezeSchedule(schedule.span, normalizedRepeats([
    ...schedule.repeats,
    { period, iterations },
  ]))));
}

interface ArithmeticSchedule {
  readonly span: WriterSpan;
  readonly period: number;
  readonly iterations: number;
}

interface Dyadic {
  readonly exponent: number;
  readonly numerator: bigint;
}

const numberBits = new DataView(new ArrayBuffer(8));

function dyadic(value: number): Dyadic {
  numberBits.setFloat64(0, value, false);
  const high = numberBits.getUint32(0, false);
  const low = numberBits.getUint32(4, false);
  const fraction = BigInt(high & 0x000f_ffff) << 32n | BigInt(low);
  const exponentBits = (high >>> 20) & 0x7ff;
  if (exponentBits === 0) return { numerator: fraction, exponent: -1074 };
  return {
    numerator: (1n << 52n) | fraction,
    exponent: exponentBits - 1023 - 52,
  };
}

function scaleDyadics(values: readonly number[]): readonly bigint[] {
  const valuesAsDyadics = values.map(dyadic);
  const minimumExponent = Math.min(...valuesAsDyadics.map(value => value.exponent));
  return valuesAsDyadics.map(value =>
    value.numerator << BigInt(value.exponent - minimumExponent),
  );
}

function floorDivide(value: bigint, divisor: bigint): bigint {
  if (value >= 0n) return value / divisor;
  return -((-value + divisor - 1n) / divisor);
}

function clamp(value: bigint, minimum: bigint, maximum: bigint): bigint {
  return value < minimum ? minimum : value > maximum ? maximum : value;
}

/** Returns sum(floor((multiplier * i + offset) / divisor), i = 0..count). */
function floorSum(
  count: bigint,
  divisor: bigint,
  multiplier: bigint,
  offset: bigint,
): bigint {
  let currentCount = count;
  let currentDivisor = divisor;
  let currentMultiplier = multiplier;
  let currentOffset = offset;
  let result = 0n;
  while (true) {
    if (currentMultiplier >= currentDivisor) {
      result += (currentCount - 1n) * currentCount * (currentMultiplier / currentDivisor) / 2n;
      currentMultiplier %= currentDivisor;
    }
    if (currentOffset >= currentDivisor) {
      result += currentCount * (currentOffset / currentDivisor);
      currentOffset %= currentDivisor;
    }
    const maximum = currentMultiplier * currentCount + currentOffset;
    if (maximum < currentDivisor) return result;
    currentCount = maximum / currentDivisor;
    currentOffset = maximum % currentDivisor;
    const previousDivisor = currentDivisor;
    currentDivisor = currentMultiplier;
    currentMultiplier = previousDivisor;
  }
}

/** Counts bounded nonnegative pairs where a*i + b*j is at most limit. */
function boundedLinearCount(
  firstPeriod: bigint,
  firstIterations: bigint,
  secondPeriod: bigint,
  secondIterations: bigint,
  limit: bigint,
): bigint {
  if (limit < 0n) return 0n;
  const nonemptyFirst = clamp(floorDivide(limit, firstPeriod) + 1n, 0n, firstIterations);
  if (nonemptyFirst === 0n) return 0n;
  const completeFirst = clamp(
    floorDivide(limit - secondPeriod * (secondIterations - 1n), firstPeriod) + 1n,
    0n,
    nonemptyFirst,
  );
  const partialCount = nonemptyFirst - completeFirst;
  if (partialCount === 0n) return completeFirst * secondIterations;
  const reverseOffset = limit - firstPeriod * (nonemptyFirst - 1n);
  return completeFirst * secondIterations + partialCount + floorSum(
    partialCount,
    secondPeriod,
    firstPeriod,
    reverseOffset,
  );
}

function oneRepeatSchedule(schedule: WriterSchedule): ArithmeticSchedule | undefined {
  if (schedule.repeats.length === 0) {
    return { span: schedule.span, period: 0, iterations: 1 };
  }
  if (schedule.repeats.length !== 1) return undefined;
  const repeat = schedule.repeats[0]!;
  return { span: schedule.span, period: repeat.period, iterations: repeat.iterations };
}

function fixedAgainstPeriodic(
  fixed: WriterSpan,
  periodic: ArithmeticSchedule,
): boolean {
  const [fixedStart, fixedEnd, periodicStart, periodicEnd, period] = scaleDyadics([
    fixed.start,
    fixed.end,
    periodic.span.start,
    periodic.span.end,
    periodic.period,
  ]);
  const first = floorDivide(fixedStart - periodicEnd + period - 1n, period);
  const last = floorDivide(fixedEnd - periodicStart, period);
  if (last < 0n) return false;
  if (periodic.iterations === Number.POSITIVE_INFINITY) return first <= last;
  const maximum = BigInt(periodic.iterations) - 1n;
  return first <= maximum && clamp(first, 0n, maximum) <= clamp(last, 0n, maximum);
}

function arithmeticSchedulesOverlap(first: ArithmeticSchedule, second: ArithmeticSchedule): boolean {
  if (!Number.isFinite(first.span.end) || !Number.isFinite(second.span.end)) {
    return first.span.start <= second.span.end && second.span.start <= first.span.end;
  }
  if (first.period === 0 && second.period === 0) {
    return first.span.start <= second.span.end && second.span.start <= first.span.end;
  }
  if (first.period === 0) return fixedAgainstPeriodic(first.span, second);
  if (second.period === 0) return fixedAgainstPeriodic(second.span, first);
  if (first.iterations === Number.POSITIVE_INFINITY ||
    second.iterations === Number.POSITIVE_INFINITY) {
    const firstRange = scheduleRange(freezeSchedule(first.span, [{
      period: first.period,
      iterations: first.iterations,
    }]));
    const secondRange = scheduleRange(freezeSchedule(second.span, [{
      period: second.period,
      iterations: second.iterations,
    }]));
    return firstRange.start <= secondRange.end && secondRange.start <= firstRange.end;
  }
  const [firstStart, firstEnd, secondStart, secondEnd, firstPeriod, secondPeriod] = scaleDyadics([
    first.span.start,
    first.span.end,
    second.span.start,
    second.span.end,
    first.period,
    second.period,
  ]);
  const firstIterations = BigInt(first.iterations);
  const secondIterations = BigInt(second.iterations);
  const lower = secondStart - firstEnd;
  const upper = secondEnd - firstStart;
  const atMostUpper = boundedLinearCount(
    firstPeriod,
    firstIterations,
    secondPeriod,
    secondIterations,
    upper + secondPeriod * (secondIterations - 1n),
  );
  const belowLower = boundedLinearCount(
    firstPeriod,
    firstIterations,
    secondPeriod,
    secondIterations,
    lower - 1n + secondPeriod * (secondIterations - 1n),
  );
  return atMostUpper > belowLower;
}

function scheduleRange(schedule: WriterSchedule): { readonly start: number; readonly end: number } {
  const offset = schedule.repeats.reduce((total, repeat) =>
    total + (repeat.iterations - 1) * repeat.period,
  0);
  return Object.freeze({ start: schedule.span.start, end: schedule.span.end + offset });
}

function schedulesOverlap(first: WriterSchedule, second: WriterSchedule): boolean {
  const firstArithmetic = oneRepeatSchedule(first);
  const secondArithmetic = oneRepeatSchedule(second);
  if (firstArithmetic !== undefined && secondArithmetic !== undefined) {
    return arithmeticSchedulesOverlap(firstArithmetic, secondArithmetic);
  }
  const firstRange = scheduleRange(first);
  const secondRange = scheduleRange(second);
  return firstRange.start <= secondRange.end && secondRange.start <= firstRange.end;
}

function throwWriterConflict(first: WriterSchedule, second: WriterSchedule): never {
  const name = getSignalNode(first.span.output).debugName ?? '<unnamed signal>';
  throw new RangeError(
    `Animation program writers at paths ${programLabel(first.span.path)} and ` +
      `${programLabel(second.span.path)} overlap for signal "${name}".`,
  );
}

function validateParallelChildren(children: readonly ProgramRecord[]): void {
  for (let firstIndex = 0; firstIndex < children.length; firstIndex++) {
    for (let secondIndex = firstIndex + 1; secondIndex < children.length; secondIndex++) {
      const firstSchedules = prefixedSchedules(children[firstIndex]!.writerSchedules, firstIndex, 0);
      const secondSchedules = prefixedSchedules(children[secondIndex]!.writerSchedules, secondIndex, 0);
      for (const first of firstSchedules) {
        for (const second of secondSchedules) {
          if (first.span.output === second.span.output && schedulesOverlap(first, second)) {
            throwWriterConflict(first, second);
          }
        }
      }
    }
  }
}

function validateRepeatSchedules(
  schedules: readonly WriterSchedule[],
  period: number,
  iterations: number,
): void {
  if (iterations < 2) return;
  for (const first of schedules) {
    const firstRange = scheduleRange(first);
    for (const second of schedules) {
      if (first.span.output !== second.span.output) continue;
      const secondRange = scheduleRange(second);
      if (firstRange.end >= period + secondRange.start) {
        throwWriterConflict(first, second);
      }
    }
  }
}

function sequenceDuration(records: readonly ProgramRecord[]): ProgramDuration {
  let milliseconds = 0;
  for (let index = 0; index < records.length; index++) {
    const duration = records[index]!.duration;
    if (duration.kind === 'finite') {
      milliseconds += duration.milliseconds;
      if (!Number.isFinite(milliseconds)) {
        throw new RangeError('CRC animation program duration must be finite and representable.');
      }
      continue;
    }
    if (duration.kind === 'infinite') {
      if (records.slice(index + 1).some(record => record.hasReachableWork)) {
        throw new RangeError('A statically infinite animation program cannot precede reachable sequence content.');
      }
      return infinite;
    }
    return unresolved;
  }
  return finite(milliseconds);
}

function parallelDuration(records: readonly ProgramRecord[]): ProgramDuration {
  if (records.some(record => record.duration.kind === 'infinite')) return infinite;
  if (records.some(record => record.duration.kind === 'unresolved-stepper')) return unresolved;
  return finite(Math.max(0, ...records.map(record =>
    (record.duration as Extract<ProgramDuration, { kind: 'finite' }>).milliseconds,
  )));
}

/** Binds one animation definition to one writable signal. */
export function track<T>(
  output: WritableSignal<T>,
  definition: CRCAnimationDefinition<T>,
): CRCAnimationProgram {
  const writableOutput = assertWritableSignal(output);
  const normalizedDefinition = definition as CRCAnimationDefinition<unknown>;
  const duration = definitionDuration(normalizedDefinition);
  const end = duration.kind === 'finite' ? duration.milliseconds : Number.POSITIVE_INFINITY;
  const schedule = freezeSchedule(freezeSpan(writableOutput, 0, end, []));
  return createProgram({
    kind: 'track',
    children: Object.freeze([]),
    duration,
    hasReachableWork: true,
    output: writableOutput,
    definition: normalizedDefinition,
    outputs: Object.freeze([writableOutput]),
    writerSchedules: Object.freeze([schedule]),
    writerSpans: finiteWriterSpans([schedule]),
  });
}

/** Activates children in source order. */
export function sequence(...children: readonly CRCAnimationProgram[]): CRCAnimationProgram {
  const records = children.map(getProgramRecord);
  const duration = sequenceDuration(records);
  let offset = 0;
  const schedules: WriterSchedule[] = [];
  for (let index = 0; index < records.length; index++) {
    const record = records[index]!;
    schedules.push(...prefixedSchedules(record.writerSchedules, index, offset));
    if (record.duration.kind === 'finite') offset += record.duration.milliseconds;
  }
  const frozenSchedules = Object.freeze(schedules);
  return createProgram({
    kind: 'sequence',
    children: Object.freeze([...children]),
    duration,
    hasReachableWork: records.some(record => record.hasReachableWork),
    outputs: outputsFor(frozenSchedules),
    writerSchedules: frozenSchedules,
    writerSpans: finiteWriterSpans(frozenSchedules),
  });
}

/** Activates all children from one shared local origin. */
export function parallel(...children: readonly CRCAnimationProgram[]): CRCAnimationProgram {
  const records = children.map(getProgramRecord);
  validateParallelChildren(records);
  const schedules = Object.freeze(records.flatMap((record, index) =>
    prefixedSchedules(record.writerSchedules, index, 0),
  ));
  return createProgram({
    kind: 'parallel',
    children: Object.freeze([...children]),
    duration: parallelDuration(records),
    hasReachableWork: records.some(record => record.hasReachableWork),
    outputs: outputsFor(schedules),
    writerSchedules: schedules,
    writerSpans: finiteWriterSpans(schedules),
  });
}

/** Adds finite nonnegative local time without writing an output. */
export function wait(duration: number): CRCAnimationProgram {
  if (!Number.isFinite(duration) || duration < 0) {
    throw new RangeError('CRC animation wait duration must be finite and nonnegative.');
  }
  return createProgram({
    kind: 'wait',
    children: Object.freeze([]),
    duration: finite(duration),
    hasReachableWork: duration > 0,
    outputs: Object.freeze([]),
    writerSchedules: Object.freeze([]),
    writerSpans: Object.freeze([]),
  });
}

/** Queues one named playback milestone without invoking user code. */
export function marker(name: string): CRCAnimationProgram {
  if (typeof name !== 'string' || name.length === 0) {
    throw new TypeError('CRC animation marker name must be nonempty.');
  }
  return createProgram({
    kind: 'marker',
    name,
    children: Object.freeze([]),
    duration: finite(0),
    hasReachableWork: true,
    outputs: Object.freeze([]),
    writerSchedules: Object.freeze([]),
    writerSpans: Object.freeze([]),
  });
}

/** Repeats one child a total number of iterations. */
export function repeat(
  child: CRCAnimationProgram,
  options: Readonly<CRCAnimationRepeatOptions>,
): CRCAnimationProgram {
  const childRecord = getProgramRecord(child);
  const iterations = options?.iterations;
  if (iterations !== Number.POSITIVE_INFINITY &&
    (!Number.isInteger(iterations) || (iterations as number) < 1)) {
    throw new RangeError('CRC animation repeat iterations must be an integer >= 1 or positive infinity.');
  }
  const direction = options?.direction ?? 'normal';
  if (direction !== 'normal' && direction !== 'reverse' &&
    direction !== 'alternate' && direction !== 'alternate-reverse') {
    throw new TypeError('CRC animation repeat direction must be normal, reverse, alternate, or alternate-reverse.');
  }
  const duration = iterations === Number.POSITIVE_INFINITY ? infinite :
    childRecord.duration.kind === 'infinite' ? infinite :
      childRecord.duration.kind === 'unresolved-stepper' ? unresolved :
        finiteProduct(childRecord.duration.milliseconds, iterations as number);
  const childSchedules = prefixedSchedules(childRecord.writerSchedules, 0, 0);
  if (childRecord.duration.kind === 'finite') {
    validateRepeatSchedules(
      childSchedules,
      childRecord.duration.milliseconds,
      iterations as number,
    );
  }
  const schedules = childRecord.duration.kind === 'finite' ? withRepeat(
    childSchedules,
    childRecord.duration.milliseconds,
    iterations as number,
  ) : childSchedules;
  return createProgram({
    kind: 'repeat',
    children: Object.freeze([child]),
    duration,
    hasReachableWork: childRecord.hasReachableWork,
    iterations: iterations as number,
    direction,
    outputs: outputsFor(schedules),
    writerSchedules: schedules,
    writerSpans: finiteWriterSpans(schedules),
  });
}

function finiteProduct(milliseconds: number, iterations: number): ProgramDuration {
  const result = milliseconds * iterations;
  if (!Number.isFinite(result)) {
    throw new RangeError('CRC animation program duration must be finite and representable.');
  }
  return finite(result);
}

/** @internal Returns the private immutable record associated with a program. */
export function getProgramRecord(program: CRCAnimationProgram): ProgramRecord {
  const record = programRecords.get(program);
  if (record === undefined) throw new TypeError('Expected a CRC animation program.');
  return record;
}
