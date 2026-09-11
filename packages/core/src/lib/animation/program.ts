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

/** @internal Activation-resolved symbolic writer schedule. */
export interface ResolvedWriterSchedule {
  readonly output: WritableSignal<unknown>;
  readonly start: number;
  readonly end: number;
  readonly path: readonly number[];
  readonly repeats: readonly WriterRepeatFrame[];
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
const exactSeekableDurations = new WeakMap<CRCAnimationProgram, number | undefined>();
const activationDependentWriterOutputs = new WeakMap<
  CRCAnimationProgram,
  ReadonlySet<WritableSignal<unknown>>
>();

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

interface Dyadic {
  readonly exponent: number;
  readonly numerator: bigint;
}

interface ExactWriterSpan {
  readonly start: bigint;
  readonly end: bigint;
}

interface ExactWriterRepeatFrame {
  readonly period: bigint;
  readonly iterations: number;
}

interface ExactWriterSchedule {
  readonly span: ExactWriterSpan;
  readonly repeats: readonly ExactWriterRepeatFrame[];
}

interface ExactArithmeticSchedule {
  readonly span: ExactWriterSpan;
  readonly period: bigint;
  readonly iterations: number;
}

interface OverlapProofBudget {
  remainingAlignments: number;
}

/**
 * Caps exact recursive alignment descents during one writer-pair proof. This
 * is an availability boundary, not an acceptance shortcut: exhaustion rejects
 * the composition instead of claiming that the schedules are disjoint.
 */
const maximumNestedAlignmentDescents = 512;

class OverlapProofBudgetExceeded extends Error {}

const numberBits = new DataView(new ArrayBuffer(8));

function dyadic(value: number): Dyadic {
  numberBits.setFloat64(0, value, false);
  const high = numberBits.getUint32(0, false);
  const low = numberBits.getUint32(4, false);
  const fraction = BigInt(high & 0x000f_ffff) << 32n | BigInt(low);
  const exponentBits = (high >>> 20) & 0x7ff;
  if (exponentBits === 0 && fraction === 0n) return { numerator: 0n, exponent: 0 };
  if (exponentBits === 0) return { numerator: fraction, exponent: -1074 };
  return {
    numerator: (1n << 52n) | fraction,
    exponent: exponentBits - 1023 - 52,
  };
}

function exactScheduleValues(schedule: WriterSchedule): readonly number[] {
  return [
    schedule.span.start,
    schedule.span.end,
    ...schedule.repeats.map(repeat => repeat.period),
  ];
}

function commonDyadicExponent(
  first: WriterSchedule,
  second: WriterSchedule,
): number {
  const values = [...exactScheduleValues(first), ...exactScheduleValues(second)]
    .map(dyadic)
    .filter(value => value.numerator !== 0n);
  return values.length === 0 ? 0 : Math.min(...values.map(value => value.exponent));
}

function scaleDyadic(value: number, exponent: number): bigint {
  const exact = dyadic(value);
  return exact.numerator << BigInt(exact.exponent - exponent);
}

function exactSchedule(schedule: WriterSchedule, exponent: number): ExactWriterSchedule {
  return {
    span: {
      start: scaleDyadic(schedule.span.start, exponent),
      end: scaleDyadic(schedule.span.end, exponent),
    },
    repeats: schedule.repeats.map(repeat => ({
      period: scaleDyadic(repeat.period, exponent),
      iterations: repeat.iterations,
    })),
  };
}

function floorDivide(value: bigint, divisor: bigint): bigint {
  if (value >= 0n) return value / divisor;
  return -((-value + divisor - 1n) / divisor);
}

function ceilDivide(value: bigint, divisor: bigint): bigint {
  return -floorDivide(-value, divisor);
}

function clamp(value: bigint, minimum: bigint, maximum: bigint): bigint {
  return value < minimum ? minimum : value > maximum ? maximum : value;
}

function greatestCommonDivisor(first: bigint, second: bigint): bigint {
  let left = first;
  let right = second;
  while (right !== 0n) {
    const remainder = left % right;
    left = right;
    right = remainder;
  }
  return left;
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

function boundedIndexRangeExists(
  first: bigint,
  last: bigint,
  iterations: number,
): boolean {
  if (last < 0n) return false;
  if (iterations === Number.POSITIVE_INFINITY) return first <= last;
  const maximum = BigInt(iterations) - 1n;
  return first <= maximum && clamp(first, 0n, maximum) <= clamp(last, 0n, maximum);
}

/**
 * Tests lower <= secondPeriod*j - firstPeriod*i <= upper without visiting
 * either index domain. Infinite domains are first clipped to the finite band;
 * the remaining bounded rectangle is counted with Euclidean floor sums.
 */
function boundedDifferenceExists(
  firstPeriod: bigint,
  firstIterations: number,
  secondPeriod: bigint,
  secondIterations: number,
  lower: bigint,
  upper: bigint,
): boolean {
  if (lower > upper) return false;
  if (firstPeriod === 0n && secondPeriod === 0n) return lower <= 0n && 0n <= upper;
  if (firstPeriod === 0n) {
    return boundedIndexRangeExists(
      ceilDivide(lower, secondPeriod),
      floorDivide(upper, secondPeriod),
      secondIterations,
    );
  }
  if (secondPeriod === 0n) {
    return boundedIndexRangeExists(
      ceilDivide(-upper, firstPeriod),
      floorDivide(-lower, firstPeriod),
      firstIterations,
    );
  }
  if (firstIterations === Number.POSITIVE_INFINITY &&
    secondIterations === Number.POSITIVE_INFINITY) {
    const increment = greatestCommonDivisor(firstPeriod, secondPeriod);
    return ceilDivide(lower, increment) * increment <= upper;
  }

  const boundedFirstIterations = firstIterations === Number.POSITIVE_INFINITY ?
    floorDivide(
      secondPeriod * (BigInt(secondIterations) - 1n) - lower,
      firstPeriod,
    ) + 1n : BigInt(firstIterations);
  const boundedSecondIterations = secondIterations === Number.POSITIVE_INFINITY ?
    floorDivide(
      upper + firstPeriod * (BigInt(firstIterations) - 1n),
      secondPeriod,
    ) + 1n : BigInt(secondIterations);
  if (boundedFirstIterations <= 0n || boundedSecondIterations <= 0n) return false;

  const translatedUpper = upper + firstPeriod * (boundedFirstIterations - 1n);
  const translatedBelowLower = lower - 1n +
    firstPeriod * (boundedFirstIterations - 1n);
  const atMostUpper = boundedLinearCount(
    firstPeriod,
    boundedFirstIterations,
    secondPeriod,
    boundedSecondIterations,
    translatedUpper,
  );
  const belowLower = boundedLinearCount(
    firstPeriod,
    boundedFirstIterations,
    secondPeriod,
    boundedSecondIterations,
    translatedBelowLower,
  );
  return atMostUpper > belowLower;
}

function leastBoundedDifference(
  firstPeriod: bigint,
  firstIterations: number,
  secondPeriod: bigint,
  secondIterations: number,
  lower: bigint,
  upper: bigint,
): bigint | undefined {
  if (!boundedDifferenceExists(
    firstPeriod,
    firstIterations,
    secondPeriod,
    secondIterations,
    lower,
    upper,
  )) return undefined;
  let start = lower;
  let end = upper;
  while (start < end) {
    const middle = floorDivide(start + end, 2n);
    if (boundedDifferenceExists(
      firstPeriod,
      firstIterations,
      secondPeriod,
      secondIterations,
      lower,
      middle,
    )) {
      end = middle;
    } else {
      start = middle + 1n;
    }
  }
  return start;
}

function oneRepeatSchedule(
  schedule: ExactWriterSchedule,
): ExactArithmeticSchedule | undefined {
  if (schedule.repeats.length === 0) {
    return { span: schedule.span, period: 0n, iterations: 1 };
  }
  if (schedule.repeats.length !== 1) return undefined;
  const repeat = schedule.repeats[0]!;
  return { span: schedule.span, period: repeat.period, iterations: repeat.iterations };
}

function fixedAgainstPeriodic(
  fixed: ExactWriterSpan,
  periodic: ExactArithmeticSchedule,
): boolean {
  return boundedIndexRangeExists(
    ceilDivide(fixed.start - periodic.span.end, periodic.period),
    floorDivide(fixed.end - periodic.span.start, periodic.period),
    periodic.iterations,
  );
}

function arithmeticSchedulesOverlap(
  first: ExactArithmeticSchedule,
  second: ExactArithmeticSchedule,
): boolean {
  if (first.period === 0n && second.period === 0n) {
    return first.span.start <= second.span.end && second.span.start <= first.span.end;
  }
  if (first.period === 0n) return fixedAgainstPeriodic(first.span, second);
  if (second.period === 0n) return fixedAgainstPeriodic(second.span, first);
  return boundedDifferenceExists(
    first.period,
    first.iterations,
    second.period,
    second.iterations,
    first.span.start - second.span.end,
    first.span.end - second.span.start,
  );
}

function scheduleRange(schedule: WriterSchedule): { readonly start: number; readonly end: number } {
  const offset = schedule.repeats.reduce((total, repeat) =>
    total + (repeat.iterations - 1) * repeat.period,
  0);
  return Object.freeze({ start: schedule.span.start, end: schedule.span.end + offset });
}

function exactScheduleRange(
  schedule: ExactWriterSchedule,
): { readonly start: bigint; readonly end: bigint } {
  let end = schedule.span.end;
  for (const repeat of schedule.repeats) {
    if (repeat.iterations === Number.POSITIVE_INFINITY) {
      throw new Error('An infinite repeat frame cannot be nested inside another finite frame.');
    }
    end += (BigInt(repeat.iterations) - 1n) * repeat.period;
  }
  return { start: schedule.span.start, end };
}

function withoutOuterRepeat(schedule: ExactWriterSchedule): ExactWriterSchedule {
  return { span: schedule.span, repeats: schedule.repeats.slice(0, -1) };
}

function shiftedSchedule(
  schedule: ExactWriterSchedule,
  offset: bigint,
): ExactWriterSchedule {
  return {
    span: {
      start: schedule.span.start + offset,
      end: schedule.span.end + offset,
    },
    repeats: schedule.repeats,
  };
}

function symbolicOuterRepeatOverlap(
  first: ExactWriterSchedule,
  second: ExactWriterSchedule,
  budget: OverlapProofBudget,
): boolean {
  const firstOuter = first.repeats.at(-1)!;
  const secondOuter = second.repeats.at(-1)!;
  const firstInner = withoutOuterRepeat(first);
  const secondInner = withoutOuterRepeat(second);
  const firstRange = exactScheduleRange(firstInner);
  const secondRange = exactScheduleRange(secondInner);
  const lower = firstRange.start - secondRange.end;
  const upper = firstRange.end - secondRange.start;
  let difference = leastBoundedDifference(
    firstOuter.period,
    firstOuter.iterations,
    secondOuter.period,
    secondOuter.iterations,
    lower,
    upper,
  );
  while (difference !== undefined) {
    if (budget.remainingAlignments === 0) throw new OverlapProofBudgetExceeded();
    budget.remainingAlignments--;
    if (exactSchedulesOverlap(
      firstInner,
      shiftedSchedule(secondInner, difference),
      budget,
    )) return true;
    if (difference === upper) return false;
    difference = leastBoundedDifference(
      firstOuter.period,
      firstOuter.iterations,
      secondOuter.period,
      secondOuter.iterations,
      difference + 1n,
      upper,
    );
  }
  return false;
}

function nextScheduleTime(
  schedule: ExactWriterSchedule,
  target: bigint,
): bigint | undefined {
  const outer = schedule.repeats.at(-1);
  if (outer === undefined) {
    if (target > schedule.span.end) return undefined;
    return target > schedule.span.start ? target : schedule.span.start;
  }
  const inner = withoutOuterRepeat(schedule);
  const innerRange = exactScheduleRange(inner);
  let iteration = ceilDivide(target - innerRange.end, outer.period);
  if (iteration < 0n) iteration = 0n;
  const maximum = outer.iterations === Number.POSITIVE_INFINITY ? undefined :
    BigInt(outer.iterations) - 1n;
  if (maximum !== undefined && iteration > maximum) return undefined;
  const offset = iteration * outer.period;
  const innerTime = nextScheduleTime(inner, target - offset);
  if (innerTime !== undefined) return innerTime + offset;
  iteration += 1n;
  if (maximum !== undefined && iteration > maximum) return undefined;
  return innerRange.start + iteration * outer.period;
}

function repeatAgainstStaticOverlap(
  repeated: ExactWriterSchedule,
  staticSchedule: ExactWriterSchedule,
): boolean {
  const first = nextScheduleTime(repeated, staticSchedule.span.start);
  return first !== undefined && first <= staticSchedule.span.end;
}

function exactSchedulesOverlap(
  first: ExactWriterSchedule,
  second: ExactWriterSchedule,
  budget: OverlapProofBudget,
): boolean {
  const firstArithmetic = oneRepeatSchedule(first);
  const secondArithmetic = oneRepeatSchedule(second);
  if (firstArithmetic !== undefined && secondArithmetic !== undefined) {
    return arithmeticSchedulesOverlap(firstArithmetic, secondArithmetic);
  }
  const firstOuter = first.repeats.at(-1);
  const secondOuter = second.repeats.at(-1);
  if (firstOuter !== undefined && secondOuter !== undefined) {
    return symbolicOuterRepeatOverlap(first, second, budget);
  }
  if (firstOuter !== undefined) return repeatAgainstStaticOverlap(first, second);
  if (secondOuter !== undefined) return repeatAgainstStaticOverlap(second, first);
  return false;
}

function schedulesOverlap(first: WriterSchedule, second: WriterSchedule): boolean {
  if (!Number.isFinite(first.span.end) || !Number.isFinite(second.span.end)) {
    const firstRange = scheduleRange(first);
    const secondRange = scheduleRange(second);
    return firstRange.start <= secondRange.end && secondRange.start <= firstRange.end;
  }
  const exponent = commonDyadicExponent(first, second);
  try {
    return exactSchedulesOverlap(
      exactSchedule(first, exponent),
      exactSchedule(second, exponent),
      { remainingAlignments: maximumNestedAlignmentDescents },
    );
  } catch (error) {
    if (!(error instanceof OverlapProofBudgetExceeded)) throw error;
    const name = getSignalNode(first.span.output).debugName ?? '<unnamed signal>';
    throw new RangeError(
      `Animation program cannot prove nested same-output writer schedules at paths ` +
        `${programLabel(first.span.path)} and ${programLabel(second.span.path)} are disjoint ` +
        `for signal "${name}" within its structural validation budget. Refactor the nested ` +
        `repeats into sequential programs or use nonoverlapping output signals.`,
      { cause: error },
    );
  }
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

/**
 * @internal Returns a construction-time exact seekable duration when no track
 * needs activation data to resolve it. Positive infinity is exact; `undefined`
 * means activation or Task 5 state is required.
 */
export function getExactSeekableProgramDuration(
  program: CRCAnimationProgram,
): number | undefined {
  if (exactSeekableDurations.has(program)) return exactSeekableDurations.get(program);
  const record = getProgramRecord(program);
  let duration: number | undefined;
  if (record.kind === 'track') {
    const definition = getDefinitionRecord(record.definition);
    duration = definition.kind === 'stepper' ||
      definition.kind === 'spring' && !definition.hasFrom ?
      undefined : definition.duration;
  } else if (record.kind === 'wait') {
    duration = record.duration.kind === 'finite' ? record.duration.milliseconds : undefined;
  } else if (record.kind === 'marker') {
    duration = 0;
  } else {
    const childDurations = record.children.map(getExactSeekableProgramDuration);
    if (childDurations.some(childDuration => childDuration === undefined)) {
      duration = undefined;
    } else if (record.kind === 'sequence') {
      duration = (childDurations as number[]).reduce<number>((total, childDuration) =>
        total + childDuration, 0);
    } else if (record.kind === 'parallel') {
      duration = Math.max(0, ...(childDurations as number[]));
    } else {
      const childDuration = childDurations[0] as number;
      duration = record.iterations === Number.POSITIVE_INFINITY ?
        Number.POSITIVE_INFINITY : childDuration * record.iterations;
    }
  }
  exactSeekableDurations.set(program, duration);
  return duration;
}

function resolvedSchedule(schedule: ResolvedWriterSchedule): WriterSchedule {
  return freezeSchedule(
    freezeSpan(schedule.output, schedule.start, schedule.end, schedule.path),
    schedule.repeats,
  );
}

/** @internal Uses Task 3's bounded exact symbolic proof for resolved schedules. */
export function resolvedWriterSchedulesOverlap(
  first: ResolvedWriterSchedule,
  second: ResolvedWriterSchedule,
): boolean {
  return schedulesOverlap(resolvedSchedule(first), resolvedSchedule(second));
}

/** @internal Adds one normalized symbolic repeat frame without expansion. */
export function repeatResolvedWriterSchedules(
  schedules: readonly ResolvedWriterSchedule[],
  period: number,
  iterations: number,
): readonly ResolvedWriterSchedule[] {
  return Object.freeze(withRepeat(
    schedules.map(resolvedSchedule),
    period,
    iterations,
  ).map(schedule => Object.freeze({
    output: schedule.span.output,
    start: schedule.span.start,
    end: schedule.span.end,
    path: freezePath(schedule.span.path),
    repeats: schedule.repeats,
  })));
}

function dependentWriterOutputs(
  program: CRCAnimationProgram,
): ReadonlySet<WritableSignal<unknown>> {
  const cached = activationDependentWriterOutputs.get(program);
  if (cached !== undefined) return cached;
  const record = getProgramRecord(program);
  const dependent = new Set<WritableSignal<unknown>>();
  if (record.kind === 'track') {
    const definition = getDefinitionRecord(record.definition);
    if (definition.kind === 'spring' && !definition.hasFrom) {
      dependent.add(record.output);
    }
  } else if (record.kind === 'sequence') {
    let prefixDurationDependsOnActivation = false;
    for (const child of record.children) {
      for (const output of dependentWriterOutputs(child)) dependent.add(output);
      if (prefixDurationDependsOnActivation) {
        for (const output of getProgramRecord(child).outputs) dependent.add(output);
      }
      if (getExactSeekableProgramDuration(child) === undefined) {
        prefixDurationDependsOnActivation = true;
      }
    }
  } else {
    for (const child of record.children) {
      for (const output of dependentWriterOutputs(child)) dependent.add(output);
    }
    if (record.kind === 'repeat' &&
      getExactSeekableProgramDuration(record.children[0]!) === undefined &&
      (record.iterations > 1 || record.direction !== 'normal')) {
      for (const output of record.outputs) dependent.add(output);
    }
  }
  activationDependentWriterOutputs.set(program, dependent);
  return dependent;
}

function requiresActivationWriterSafetyAt(program: CRCAnimationProgram): boolean {
  const record = getProgramRecord(program);
  if (record.kind === 'parallel') {
    for (let firstIndex = 0; firstIndex < record.children.length; firstIndex++) {
      for (let secondIndex = firstIndex + 1;
        secondIndex < record.children.length;
        secondIndex++) {
        const first = record.children[firstIndex]!;
        const second = record.children[secondIndex]!;
        const secondOutputs = getProgramRecord(second).outputs;
        const firstDependent = dependentWriterOutputs(first);
        const secondDependent = dependentWriterOutputs(second);
        if (getProgramRecord(first).outputs.some(candidate =>
          secondOutputs.includes(candidate) &&
          (firstDependent.has(candidate) || secondDependent.has(candidate)),
        )) return true;
      }
    }
  }
  if (record.kind === 'repeat' && record.iterations > 1 &&
    getExactSeekableProgramDuration(record.children[0]!) === undefined &&
    record.outputs.length > 0) {
    return true;
  }
  return record.children.some(requiresActivationWriterSafetyAt);
}

/**
 * @internal Reports whether activation-resolved duration can invalidate a
 * construction-time parallel or repeat writer proof. The evaluator performs
 * the exact resolved proof against its private activation snapshot.
 */
export function requiresProgramActivationWriterSafety(
  program: CRCAnimationProgram,
): boolean {
  return requiresActivationWriterSafetyAt(program);
}
