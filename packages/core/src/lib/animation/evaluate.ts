import {
  createSignalCommitBatch,
  getSignalNode,
  type SignalCommitBatch,
} from '../signals/graph.js';
import type { WritableSignal } from '../signals/types.js';
import {
  activateSeekableDefinition,
  sampleActivatedSeekableDefinition,
  snapshotAnimationActivationValue,
  type SeekableDefinitionActivation,
} from './definition.js';
import {
  getExactSeekableProgramDuration,
  getProgramRecord,
} from './program.js';
import type { CRCAnimationProgram } from './types.js';

declare const programActivationBrand: unique symbol;

/** @internal Opaque state retained for one activated program run. */
export interface ProgramActivation {
  readonly [programActivationBrand]: true;
}

export type ProgramTraversalDirection = 'forward' | 'reverse';

export interface ProgramEvaluationInput {
  readonly previousTime: number | undefined;
  readonly time: number;
  readonly direction: ProgramTraversalDirection;
  readonly frameId: number;
  readonly writer: object;
  readonly batch: SignalCommitBatch;
}

interface ProgramMilestoneBase {
  readonly programTime: number;
  readonly frameId: number;
  readonly registration: object;
  readonly programPath: readonly number[];
  readonly iteration: number;
}

export interface ProgramMarkerMilestone extends ProgramMilestoneBase {
  readonly kind: 'marker';
  readonly marker: string;
}

export interface ProgramIterationMilestone extends ProgramMilestoneBase {
  readonly kind: 'iteration';
}

export type ProgramMilestone = ProgramMarkerMilestone | ProgramIterationMilestone;

export interface ProgramTerminalState {
  readonly duration: number | undefined;
  readonly atStart: boolean;
  readonly atEnd: boolean;
  readonly reached: boolean;
}

export interface ProgramEvaluationResult {
  readonly batch: SignalCommitBatch;
  readonly milestones: readonly ProgramMilestone[];
  readonly terminal: ProgramTerminalState;
}

export interface TrackStartSnapshot {
  readonly programPath: readonly number[];
  readonly repeatIterations: readonly number[];
  readonly initialValue: unknown;
  readonly duration: number;
}

export interface ProgramActivationRecord {
  readonly program: CRCAnimationProgram;
  readonly registration: object;
  readonly originalValues: ReadonlyMap<WritableSignal<unknown>, unknown>;
  readonly trackStarts: readonly TrackStartSnapshot[];
}

interface InternalTrackStart {
  readonly programPath: readonly number[];
  readonly repeatIterations: readonly number[];
  readonly initialValue: unknown;
  readonly definition: SeekableDefinitionActivation<unknown>;
}

interface InternalProgramActivation {
  readonly program: CRCAnimationProgram;
  readonly registration: object;
  readonly originalValues: ReadonlyMap<WritableSignal<unknown>, unknown>;
  starts: Map<string, InternalTrackStart>;
}

interface SampleState {
  readonly batch: SignalCommitBatch;
  readonly starts: Map<string, InternalTrackStart>;
  readonly durations: Map<string, number>;
  readonly writtenOutputs: Set<WritableSignal<unknown>>;
  readonly snapshots: WeakMap<object, unknown>;
}

interface SampleResult {
  readonly duration: number | undefined;
  readonly atEnd: boolean;
}

interface TimelineEvent {
  readonly kind: 'marker' | 'iteration';
  readonly marker?: string;
  readonly programTime: number;
  readonly programPath: readonly number[];
  readonly iteration: number;
  readonly sourceOrder: number;
}

interface TimeTransform {
  readonly origin: number;
  readonly scale: 1 | -1;
}

const activationRecords = new WeakMap<ProgramActivation, InternalProgramActivation>();
const baselineWriter = Object.freeze({ name: 'CRC animation activation baseline' });

function freezePath(path: readonly number[]): readonly number[] {
  return Object.freeze([...path]);
}

function immutableMap<K, V>(source: ReadonlyMap<K, V>): ReadonlyMap<K, V> {
  const target = new Map(source);
  const proxy = new Proxy(target, {
    get(map, key) {
      if (key === 'set' || key === 'delete' || key === 'clear') {
        return (): never => {
          throw new TypeError('Cannot mutate an animation activation snapshot.');
        };
      }
      const member = Reflect.get(map, key, map);
      return typeof member === 'function' ? member.bind(map) : member;
    },
    set(): false {
      return false;
    },
    defineProperty(): false {
      return false;
    },
    deleteProperty(): false {
      return false;
    },
  });
  return Object.freeze(proxy);
}

function activationRecord(activation: ProgramActivation): InternalProgramActivation {
  const record = activationRecords.get(activation);
  if (record === undefined) throw new TypeError('Expected a CRC animation program activation.');
  return record;
}

function instanceKey(
  path: readonly number[],
  repeatIterations: readonly number[],
): string {
  return JSON.stringify([path, repeatIterations]);
}

function assertProgramTime(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`CRC animation ${label} must be finite.`);
  }
}

function assertEvaluationInput(input: ProgramEvaluationInput): void {
  assertProgramTime(input.time, 'program time');
  if (input.previousTime !== undefined) {
    assertProgramTime(input.previousTime, 'previous program time');
  }
  if (input.direction !== 'forward' && input.direction !== 'reverse') {
    throw new TypeError('CRC animation traversal direction must be forward or reverse.');
  }
  if (!Number.isFinite(input.frameId)) {
    throw new RangeError('CRC animation frame identity must be finite.');
  }
  if (typeof input.writer !== 'object' || input.writer === null) {
    throw new TypeError('CRC animation writer token must be an object.');
  }
}

function seedOriginalValues(record: InternalProgramActivation): SignalCommitBatch {
  const batch = createSignalCommitBatch();
  for (const [output, value] of record.originalValues) {
    batch.stage(output, value, baselineWriter);
  }
  return batch;
}

function setDuration(
  state: SampleState,
  path: readonly number[],
  repeatIterations: readonly number[],
  duration: number | undefined,
): void {
  if (duration !== undefined) {
    state.durations.set(instanceKey(path, repeatIterations), duration);
  }
}

function knownDuration(
  program: CRCAnimationProgram,
  state: SampleState,
  path: readonly number[],
  repeatIterations: readonly number[],
): number | undefined {
  return state.durations.get(instanceKey(path, repeatIterations)) ??
    getExactSeekableProgramDuration(program);
}

function sampleTrack(
  program: CRCAnimationProgram,
  localTime: number,
  state: SampleState,
  path: readonly number[],
  repeatIterations: readonly number[],
): SampleResult {
  const record = getProgramRecord(program);
  if (record.kind !== 'track') throw new Error('Expected an animation track record.');
  const key = instanceKey(path, repeatIterations);
  let start = state.starts.get(key);
  if (start === undefined) {
    const initialValue = state.batch.read(record.output);
    const definition = activateSeekableDefinition(
      record.definition,
      initialValue,
      state.snapshots,
    );
    start = Object.freeze({
      programPath: freezePath(path),
      repeatIterations: freezePath(repeatIterations),
      initialValue: definition.initialValue,
      definition,
    });
    state.starts.set(key, start);
  }
  const duration = start.definition.duration;
  state.batch.stage(
    record.output,
    sampleActivatedSeekableDefinition(start.definition, Math.min(localTime, duration)),
    baselineWriter,
  );
  state.writtenOutputs.add(record.output);
  setDuration(state, path, repeatIterations, duration);
  return Object.freeze({ duration, atEnd: localTime >= duration });
}

function sampleNode(
  program: CRCAnimationProgram,
  requestedTime: number,
  state: SampleState,
  path: readonly number[],
  repeatIterations: readonly number[],
): SampleResult {
  const record = getProgramRecord(program);
  const localTime = Math.max(0, requestedTime);
  if (record.kind === 'track') {
    return sampleTrack(program, localTime, state, path, repeatIterations);
  }
  if (record.kind === 'wait') {
    const duration = record.duration.kind === 'finite' ? record.duration.milliseconds : 0;
    setDuration(state, path, repeatIterations, duration);
    return Object.freeze({ duration, atEnd: localTime >= duration });
  }
  if (record.kind === 'marker') {
    setDuration(state, path, repeatIterations, 0);
    return Object.freeze({ duration: 0, atEnd: true });
  }
  if (record.kind === 'sequence') {
    let remaining = localTime;
    let elapsed = 0;
    for (let index = 0; index < record.children.length; index++) {
      const child = record.children[index]!;
      const childPath = [...path, index];
      const sampled = sampleNode(child, remaining, state, childPath, repeatIterations);
      if (!sampled.atEnd || sampled.duration === undefined) {
        let resolvedDuration = sampled.duration === undefined ? undefined :
          elapsed + sampled.duration;
        for (let later = index + 1;
          resolvedDuration !== undefined && later < record.children.length;
          later++) {
          const laterDuration = getExactSeekableProgramDuration(record.children[later]!);
          resolvedDuration = laterDuration === undefined ? undefined :
            resolvedDuration + laterDuration;
        }
        setDuration(state, path, repeatIterations, resolvedDuration);
        return Object.freeze({ duration: resolvedDuration, atEnd: false });
      }
      elapsed += sampled.duration;
      remaining = Math.max(0, remaining - sampled.duration);
    }
    setDuration(state, path, repeatIterations, elapsed);
    return Object.freeze({ duration: elapsed, atEnd: true });
  }
  if (record.kind === 'parallel') {
    let duration = 0;
    let durationKnown = true;
    let atEnd = true;
    for (let index = 0; index < record.children.length; index++) {
      const sampled = sampleNode(
        record.children[index]!,
        localTime,
        state,
        [...path, index],
        repeatIterations,
      );
      if (sampled.duration === undefined) durationKnown = false;
      else duration = Math.max(duration, sampled.duration);
      if (!sampled.atEnd) atEnd = false;
    }
    const resolvedDuration = durationKnown ? duration : undefined;
    setDuration(state, path, repeatIterations, resolvedDuration);
    return Object.freeze({ duration: resolvedDuration, atEnd });
  }

  if (localTime === Number.POSITIVE_INFINITY &&
    record.iterations === Number.POSITIVE_INFINITY) {
    throw new TypeError('An infinite repeat cannot be resolved to a seekable terminal state.');
  }
  let remaining = localTime;
  let elapsed = 0;
  for (let iteration = 0; iteration < record.iterations; iteration++) {
    const child = record.children[0]!;
    const childPath = [...path, 0];
    const iterationPath = [...repeatIterations, iteration];
    const reversed = record.direction === 'reverse' ||
      record.direction === 'alternate-reverse' && iteration % 2 === 0 ||
      record.direction === 'alternate' && iteration % 2 === 1;
    let duration: number;
    if (reversed) {
      const terminal = sampleNode(
        child,
        Number.POSITIVE_INFINITY,
        state,
        childPath,
        iterationPath,
      );
      if (!terminal.atEnd || terminal.duration === undefined ||
        terminal.duration === Number.POSITIVE_INFINITY) {
        throw new TypeError('A reversed repeat child must have a finite seekable duration.');
      }
      duration = terminal.duration;
      sampleNode(
        child,
        duration - Math.min(remaining, duration),
        state,
        childPath,
        iterationPath,
      );
    } else {
      const sampled = sampleNode(child, remaining, state, childPath, iterationPath);
      if (sampled.duration === undefined) {
        return Object.freeze({ duration: undefined, atEnd: false });
      }
      duration = sampled.duration;
    }
    if (duration === 0 && record.iterations === Number.POSITIVE_INFINITY) {
      throw new TypeError('An infinite repeat with zero duration cannot be evaluated seekably.');
    }
    const iterationComplete = remaining >= duration;
    elapsed += duration;
    if (!iterationComplete) {
      const exact = getExactSeekableProgramDuration(program);
      setDuration(state, path, repeatIterations, exact);
      return Object.freeze({ duration: exact, atEnd: false });
    }
    if (iteration + 1 === record.iterations) {
      setDuration(state, path, repeatIterations, elapsed);
      return Object.freeze({ duration: elapsed, atEnd: true });
    }
    remaining = Math.max(0, remaining - duration);
  }
  setDuration(state, path, repeatIterations, elapsed);
  return Object.freeze({ duration: elapsed, atEnd: true });
}

function durationForTimeline(
  program: CRCAnimationProgram,
  state: SampleState,
  path: readonly number[],
  repeatIterations: readonly number[],
): number | undefined {
  return knownDuration(program, state, path, repeatIterations);
}

function transformedTime(transform: TimeTransform, localTime: number): number {
  const result = transform.origin + transform.scale * localTime;
  return Object.is(result, -0) ? 0 : result;
}

function collectTimeline(
  program: CRCAnimationProgram,
  requestedTime: number,
  state: SampleState,
  path: readonly number[],
  repeatIterations: readonly number[],
  transform: TimeTransform,
  events: TimelineEvent[],
  nextSourceOrder: { value: number },
): void {
  const record = getProgramRecord(program);
  const localTime = Math.max(0, requestedTime);
  if (record.kind === 'track' || record.kind === 'wait') return;
  if (record.kind === 'marker') {
    events.push(Object.freeze({
      kind: 'marker',
      marker: record.name,
      programTime: transformedTime(transform, 0),
      programPath: freezePath(path),
      iteration: repeatIterations.at(-1) ?? 0,
      sourceOrder: nextSourceOrder.value++,
    }));
    return;
  }
  if (record.kind === 'sequence') {
    let remaining = localTime;
    let offset = 0;
    for (let index = 0; index < record.children.length; index++) {
      const child = record.children[index]!;
      const childPath = [...path, index];
      const duration = durationForTimeline(child, state, childPath, repeatIterations);
      if (duration === undefined) return;
      collectTimeline(
        child,
        Math.min(remaining, duration),
        state,
        childPath,
        repeatIterations,
        Object.freeze({
          origin: transformedTime(transform, offset),
          scale: transform.scale,
        }),
        events,
        nextSourceOrder,
      );
      if (remaining < duration) return;
      remaining = Math.max(0, remaining - duration);
      offset += duration;
    }
    return;
  }
  if (record.kind === 'parallel') {
    for (let index = 0; index < record.children.length; index++) {
      const child = record.children[index]!;
      const childPath = [...path, index];
      const duration = durationForTimeline(child, state, childPath, repeatIterations);
      if (duration === undefined) continue;
      collectTimeline(
        child,
        Math.min(localTime, duration),
        state,
        childPath,
        repeatIterations,
        transform,
        events,
        nextSourceOrder,
      );
    }
    return;
  }

  let remaining = localTime;
  let offset = 0;
  for (let iteration = 0; iteration < record.iterations; iteration++) {
    const child = record.children[0]!;
    const childPath = [...path, 0];
    const iterationPath = [...repeatIterations, iteration];
    const duration = durationForTimeline(child, state, childPath, iterationPath);
    if (duration === undefined || duration === Number.POSITIVE_INFINITY) return;
    const reversed = record.direction === 'reverse' ||
      record.direction === 'alternate-reverse' && iteration % 2 === 0 ||
      record.direction === 'alternate' && iteration % 2 === 1;
    const childTransform: TimeTransform = reversed ? Object.freeze({
      origin: transformedTime(transform, offset + duration),
      scale: transform.scale === 1 ? -1 : 1,
    }) : Object.freeze({
      origin: transformedTime(transform, offset),
      scale: transform.scale,
    });
    collectTimeline(
      child,
      reversed ? duration : Math.min(remaining, duration),
      state,
      childPath,
      iterationPath,
      childTransform,
      events,
      nextSourceOrder,
    );
    if (remaining < duration) return;
    remaining = Math.max(0, remaining - duration);
    offset += duration;
    if (iteration + 1 < record.iterations) {
      events.push(Object.freeze({
        kind: 'iteration',
        programTime: transformedTime(transform, offset),
        programPath: freezePath(path),
        iteration: iteration + 1,
        sourceOrder: nextSourceOrder.value++,
      }));
    }
  }
}

function createSampleState(
  record: InternalProgramActivation,
  starts: Map<string, InternalTrackStart>,
): SampleState {
  return {
    batch: seedOriginalValues(record),
    starts,
    durations: new Map(),
    writtenOutputs: new Set(),
    snapshots: new WeakMap(),
  };
}

function crossedMilestones(
  record: InternalProgramActivation,
  input: ProgramEvaluationInput,
  horizon: number,
  state: SampleState,
): readonly ProgramMilestone[] {
  const timeline: TimelineEvent[] = [];
  collectTimeline(
    record.program,
    horizon,
    state,
    [],
    [],
    Object.freeze({ origin: 0, scale: 1 }),
    timeline,
    { value: 0 },
  );
  const crossed = timeline.filter(event => {
    if (input.previousTime === undefined) {
      return event.programTime >= 0 && event.programTime <= input.time;
    }
    return input.direction === 'forward' ?
      event.programTime > input.previousTime && event.programTime <= input.time :
      event.programTime >= input.time && event.programTime < input.previousTime;
  });
  crossed.sort((first, second) => {
    const timeOrder = input.direction === 'forward' ?
      first.programTime - second.programTime : second.programTime - first.programTime;
    return timeOrder === 0 ? first.sourceOrder - second.sourceOrder : timeOrder;
  });
  return Object.freeze(crossed.map(event => Object.freeze(event.kind === 'marker' ? {
    kind: 'marker' as const,
    marker: event.marker!,
    programTime: event.programTime,
    frameId: input.frameId,
    registration: record.registration,
    programPath: freezePath(event.programPath),
    iteration: event.iteration,
  } : {
    kind: 'iteration' as const,
    programTime: event.programTime,
    frameId: input.frameId,
    registration: record.registration,
    programPath: freezePath(event.programPath),
    iteration: event.iteration,
  })));
}

function evaluate(
  activation: ProgramActivation,
  input: ProgramEvaluationInput,
  rebuildStarts: boolean,
): ProgramEvaluationResult {
  assertEvaluationInput(input);
  const record = activationRecord(activation);
  const time = Math.max(0, input.time);
  const previousTime = input.previousTime === undefined ? undefined :
    Math.max(0, input.previousTime);
  const normalizedInput = { ...input, time, previousTime };
  const horizon = Math.max(time, previousTime ?? time);
  const horizonStarts = rebuildStarts ? new Map<string, InternalTrackStart>() :
    new Map(record.starts);
  const horizonState = createSampleState(record, horizonStarts);
  const horizonResult = sampleNode(record.program, horizon, horizonState, [], []);
  const milestones = crossedMilestones(record, normalizedInput, horizon, horizonState);

  let destinationState = horizonState;
  let destinationResult = horizonResult;
  if (horizon !== time) {
    const destinationStarts = rebuildStarts ? new Map<string, InternalTrackStart>() :
      horizonStarts;
    destinationState = createSampleState(record, destinationStarts);
    destinationResult = sampleNode(record.program, time, destinationState, [], []);
  }
  record.starts = destinationState.starts;
  for (const output of getProgramRecord(record.program).outputs) {
    if (destinationState.writtenOutputs.has(output)) {
      input.batch.stage(output, destinationState.batch.read(output), input.writer);
    }
  }

  const atStart = time === 0;
  const atEnd = destinationResult.atEnd;
  const duration = destinationResult.duration ??
    getExactSeekableProgramDuration(record.program);
  return Object.freeze({
    batch: input.batch,
    milestones,
    terminal: Object.freeze({
      duration,
      atStart,
      atEnd,
      reached: input.direction === 'forward' ? atEnd : atStart,
    }),
  });
}

/** Captures one program token, its committed outputs, and registration identity. */
export function activateProgram(
  program: CRCAnimationProgram,
  registration: object,
): ProgramActivation {
  if (typeof registration !== 'object' || registration === null) {
    throw new TypeError('CRC animation registration identity must be an object.');
  }
  const programRecord = getProgramRecord(program);
  const snapshots = new WeakMap<object, unknown>();
  const originalValues = new Map<WritableSignal<unknown>, unknown>();
  for (const output of programRecord.outputs) {
    originalValues.set(
      output,
      snapshotAnimationActivationValue(getSignalNode(output).value, snapshots),
    );
  }
  const activation = Object.freeze({}) as ProgramActivation;
  activationRecords.set(activation, {
    program,
    registration,
    originalValues: immutableMap(originalValues),
    starts: new Map(),
  });
  return activation;
}

/** Evaluates one ordinary advance without committing staged output values. */
export function evaluateProgram(
  activation: ProgramActivation,
  input: ProgramEvaluationInput,
): ProgramEvaluationResult {
  return evaluate(activation, input, false);
}

/** Rebuilds activation starts from the original run snapshot before sampling. */
export function seekProgram(
  activation: ProgramActivation,
  input: ProgramEvaluationInput,
): ProgramEvaluationResult {
  return evaluate(activation, input, true);
}

/** @internal Immutable diagnostic view of one private activation snapshot. */
export function getProgramActivationRecord(
  activation: ProgramActivation,
): ProgramActivationRecord {
  const record = activationRecord(activation);
  return Object.freeze({
    program: record.program,
    registration: record.registration,
    originalValues: record.originalValues,
    trackStarts: Object.freeze([...record.starts.values()].map(start => Object.freeze({
      programPath: freezePath(start.programPath),
      repeatIterations: freezePath(start.repeatIterations),
      initialValue: start.initialValue,
      duration: start.definition.duration,
    }))),
  });
}
