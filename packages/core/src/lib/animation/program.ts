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

interface WriterSchedule {
  readonly span: WriterSpan;
  readonly period: number;
  readonly iterations: number;
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
  period = 0,
  iterations = 1,
): WriterSchedule {
  return Object.freeze({ span, period, iterations });
}

function finiteWriterSpans(schedules: readonly WriterSchedule[]): readonly WriterSpan[] {
  const spans: WriterSpan[] = [];
  for (const schedule of schedules) {
    if (schedule.iterations === Number.POSITIVE_INFINITY) {
      spans.push(schedule.span);
      continue;
    }
    for (let iteration = 0; iteration < schedule.iterations; iteration++) {
      const offset = iteration * schedule.period;
      spans.push(freezeSpan(
        schedule.span.output,
        schedule.span.start + offset,
        schedule.span.end + offset,
        schedule.span.path,
      ));
    }
  }
  return Object.freeze(spans);
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
    schedule.period,
    schedule.iterations,
  )));
}

function finiteSchedules(schedules: readonly WriterSchedule[]): readonly WriterSchedule[] {
  const expanded: WriterSchedule[] = [];
  for (const schedule of schedules) {
    if (schedule.iterations === Number.POSITIVE_INFINITY) {
      throw new TypeError('A finite animation program cannot contain an infinite writer schedule.');
    }
    for (let iteration = 0; iteration < schedule.iterations; iteration++) {
      const offset = iteration * schedule.period;
      expanded.push(freezeSchedule(freezeSpan(
        schedule.span.output,
        schedule.span.start + offset,
        schedule.span.end + offset,
        schedule.span.path,
      )));
    }
  }
  return Object.freeze(expanded);
}

function withRepeat(
  schedules: readonly WriterSchedule[],
  period: number,
  iterations: number,
): readonly WriterSchedule[] {
  return Object.freeze(finiteSchedules(schedules).map(schedule => freezeSchedule(
    schedule.span,
    period,
    iterations,
  )));
}

function scheduleOccurrenceOverlap(
  first: WriterSchedule,
  second: WriterSchedule,
  firstIteration: number,
): boolean {
  const offset = firstIteration * first.period;
  const span = freezeSpan(
    first.span.output,
    first.span.start + offset,
    first.span.end + offset,
    first.span.path,
  );
  return singleAgainstSchedule(span, second);
}

function singleAgainstSchedule(single: WriterSpan, schedule: WriterSchedule): boolean {
  if (schedule.period === 0) {
    return single.start <= schedule.span.end && schedule.span.start <= single.end;
  }
  const lower = Math.ceil((single.start - schedule.span.end) / schedule.period);
  const upper = Math.floor((single.end - schedule.span.start) / schedule.period);
  const last = schedule.iterations === Number.POSITIVE_INFINITY ?
    Number.POSITIVE_INFINITY : schedule.iterations - 1;
  return Math.max(0, lower) <= Math.min(last, upper);
}

function samePeriodOverlap(
  first: WriterSchedule,
  second: WriterSchedule,
  differentIterations: boolean,
): boolean {
  const period = first.period;
  if (period === 0) {
    if (differentIterations && first.iterations < 2 && second.iterations < 2) return false;
    return first.span.start <= second.span.end && second.span.start <= first.span.end;
  }
  const minimumDifference = first.iterations === Number.POSITIVE_INFINITY ?
    Number.NEGATIVE_INFINITY : -(first.iterations - 1);
  const maximumDifference = second.iterations === Number.POSITIVE_INFINITY ?
    Number.POSITIVE_INFINITY : second.iterations - 1;
  const minimumOverlap = Math.ceil((first.span.start - second.span.end) / period);
  const maximumOverlap = Math.floor((first.span.end - second.span.start) / period);
  const lower = Math.max(minimumDifference, minimumOverlap);
  const upper = Math.min(maximumDifference, maximumOverlap);
  if (lower > upper) return false;
  return !differentIterations || lower !== 0 || upper !== 0;
}

function schedulesOverlap(
  first: WriterSchedule,
  second: WriterSchedule,
  differentIterations = false,
): boolean {
  if (first.period === second.period) {
    return samePeriodOverlap(first, second, differentIterations);
  }
  if (differentIterations) {
    throw new TypeError('Repeat writer schedules must share one iteration period.');
  }
  if (first.iterations === 1) return singleAgainstSchedule(first.span, second);
  if (second.iterations === 1) return singleAgainstSchedule(second.span, first);

  const finiteIterations = Math.min(first.iterations, second.iterations);
  if (finiteIterations !== Number.POSITIVE_INFINITY && finiteIterations <= 100_000) {
    const enumerateFirst = first.iterations <= second.iterations;
    const enumerated = enumerateFirst ? first : second;
    const searched = enumerateFirst ? second : first;
    for (let iteration = 0; iteration < enumerated.iterations; iteration++) {
      if (scheduleOccurrenceOverlap(enumerated, searched, iteration)) return true;
    }
    return false;
  }

  // Different unbounded periods cannot be safely proven disjoint without
  // expanding an infinite timeline. Reject the ambiguous same-output program.
  return true;
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

function validateRepeatSchedules(schedules: readonly WriterSchedule[]): void {
  for (let firstIndex = 0; firstIndex < schedules.length; firstIndex++) {
    for (let secondIndex = firstIndex; secondIndex < schedules.length; secondIndex++) {
      const first = schedules[firstIndex]!;
      const second = schedules[secondIndex]!;
      if (first.span.output === second.span.output && schedulesOverlap(first, second, true)) {
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
  const schedules = childRecord.duration.kind === 'finite' ? withRepeat(
    prefixedSchedules(childRecord.writerSchedules, 0, 0),
    childRecord.duration.milliseconds,
    iterations as number,
  ) : prefixedSchedules(childRecord.writerSchedules, 0, 0);
  validateRepeatSchedules(schedules);
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
