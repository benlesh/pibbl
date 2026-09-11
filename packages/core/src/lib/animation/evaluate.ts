import {
  createSignalCommitBatch,
  getSignalNode,
  type SignalCommitBatch,
} from '../signals/graph.js';
import type { WritableSignal } from '../signals/types.js';
import {
  activateSeekableDefinition,
  getSeekableDefinitionBoundaryValue,
  getStaticSeekableDefinitionBoundaryValue,
  sampleActivatedSeekableDefinition,
  snapshotAnimationActivationValue,
  type SeekableDefinitionActivation,
} from './definition.js';
import {
  getExactSeekableProgramDuration,
  getProgramRecord,
  requiresProgramActivationWriterSafety,
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

const unknownDiscoveredValue = Symbol('unknown animation discovery value');
type DiscoveredValue = unknown | typeof unknownDiscoveredValue;

interface ResolvedWriter {
  readonly output: WritableSignal<unknown>;
  readonly start: number;
  readonly end: number;
  readonly programPath: readonly number[];
  readonly repeatIterations: readonly number[];
}

interface DiscoveryResult {
  readonly duration: number | undefined;
  readonly writers: readonly ResolvedWriter[];
  readonly startWrites: ReadonlyMap<WritableSignal<unknown>, DiscoveredValue>;
  readonly endWrites: ReadonlyMap<WritableSignal<unknown>, DiscoveredValue>;
}

interface DiscoveryState {
  readonly values: Map<WritableSignal<unknown>, DiscoveredValue>;
  readonly starts: Map<string, InternalTrackStart>;
  readonly durations: Map<string, number>;
  readonly snapshots: WeakMap<object, unknown>;
  readonly validateWriters: boolean;
  readonly writerBudget: { remaining: number };
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
const maximumResolvedWriterComparisons = 512;

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
  const key = instanceKey(path, repeatIterations);
  const resolved = state.durations.get(key);
  if (resolved !== undefined) return resolved;
  const record = getProgramRecord(program);
  if (record.kind === 'track') {
    const start = state.starts.get(key);
    if (start !== undefined) return start.definition.duration;
  }
  return getExactSeekableProgramDuration(program);
}

function discoveredWrites(
  ...sources: readonly ReadonlyMap<WritableSignal<unknown>, DiscoveredValue>[]
): Map<WritableSignal<unknown>, DiscoveredValue> {
  const writes = new Map<WritableSignal<unknown>, DiscoveredValue>();
  for (const source of sources) {
    for (const [output, value] of source) writes.set(output, value);
  }
  return writes;
}

function applyDiscoveredWrites(
  values: Map<WritableSignal<unknown>, DiscoveredValue>,
  writes: ReadonlyMap<WritableSignal<unknown>, DiscoveredValue>,
): void {
  for (const [output, value] of writes) values.set(output, value);
}

function shiftedResolvedWriters(
  writers: readonly ResolvedWriter[],
  offset: number,
): readonly ResolvedWriter[] {
  return writers.map(writerSpan => Object.freeze({
    ...writerSpan,
    start: writerSpan.start + offset,
    end: writerSpan.end + offset,
  }));
}

function resolvedWriterLabel(writerSpan: ResolvedWriter): string {
  const iterations = writerSpan.repeatIterations.length === 0 ? '' :
    ` in repeat iterations [${writerSpan.repeatIterations.join(', ')}]`;
  return `[${writerSpan.programPath.join(', ')}]${iterations}`;
}

function assertResolvedWritersDisjoint(
  first: readonly ResolvedWriter[],
  second: readonly ResolvedWriter[],
  state: DiscoveryState,
): void {
  if (!state.validateWriters) return;
  for (const firstWriter of first) {
    for (const secondWriter of second) {
      if (firstWriter.output !== secondWriter.output) continue;
      if (state.writerBudget.remaining === 0) {
        const name = getSignalNode(firstWriter.output).debugName ?? '<unnamed signal>';
        throw new RangeError(
          `CRC animation activation-dependent writer schedule proof exhausted its ` +
            `${maximumResolvedWriterComparisons}-comparison budget for signal "${name}".`,
        );
      }
      state.writerBudget.remaining--;
      if (firstWriter.start <= secondWriter.end && secondWriter.start <= firstWriter.end) {
        const name = getSignalNode(firstWriter.output).debugName ?? '<unnamed signal>';
        throw new RangeError(
          `CRC animation activation-dependent writer schedules at paths ` +
            `${resolvedWriterLabel(firstWriter)} and ` +
            `${resolvedWriterLabel(secondWriter)} overlap for signal "${name}".`,
        );
      }
    }
  }
}

function discoverTrack(
  program: CRCAnimationProgram,
  state: DiscoveryState,
  path: readonly number[],
  repeatIterations: readonly number[],
): DiscoveryResult {
  const record = getProgramRecord(program);
  if (record.kind !== 'track') throw new Error('Expected an animation track record.');
  const key = instanceKey(path, repeatIterations);
  let start = state.starts.get(key);
  if (start === undefined) {
    const initialValue = state.values.has(record.output) ?
      state.values.get(record.output)! : unknownDiscoveredValue;
    if (initialValue !== unknownDiscoveredValue) {
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
  }
  const duration = start?.definition.duration ?? getExactSeekableProgramDuration(program);
  if (duration === undefined || duration === Number.POSITIVE_INFINITY) {
    throw new TypeError(
      'Stateful or value-dependent animation timing could not be discovered callback-free.',
    );
  }
  state.durations.set(key, duration);
  let startValue: DiscoveredValue = unknownDiscoveredValue;
  let endValue: DiscoveredValue = unknownDiscoveredValue;
  if (start !== undefined) {
    const first = getSeekableDefinitionBoundaryValue(start.definition, 'start');
    const last = getSeekableDefinitionBoundaryValue(start.definition, 'end');
    if (first.kind === 'known') startValue = first.value;
    if (last.kind === 'known') endValue = last.value;
  } else {
    const first = getStaticSeekableDefinitionBoundaryValue(record.definition, 'start');
    const last = getStaticSeekableDefinitionBoundaryValue(record.definition, 'end');
    if (first.kind === 'known') startValue = first.value;
    if (last.kind === 'known') endValue = last.value;
  }
  const startWrites = new Map([[record.output, startValue]]);
  const endWrites = new Map([[record.output, endValue]]);
  state.values.set(record.output, endValue);
  return {
    duration,
    writers: Object.freeze([Object.freeze({
      output: record.output,
      start: 0,
      end: duration,
      programPath: freezePath(path),
      repeatIterations: freezePath(repeatIterations),
    })]),
    startWrites,
    endWrites,
  };
}

function discoverNode(
  program: CRCAnimationProgram,
  requestedTime: number,
  state: DiscoveryState,
  path: readonly number[],
  repeatIterations: readonly number[],
): DiscoveryResult {
  const record = getProgramRecord(program);
  const localTime = Math.max(0, requestedTime);
  if (record.kind === 'track') {
    return discoverTrack(program, state, path, repeatIterations);
  }
  if (record.kind === 'wait' || record.kind === 'marker') {
    const duration = record.kind === 'wait' && record.duration.kind === 'finite' ?
      record.duration.milliseconds : 0;
    state.durations.set(instanceKey(path, repeatIterations), duration);
    return {
      duration,
      writers: Object.freeze([]),
      startWrites: new Map(),
      endWrites: new Map(),
    };
  }
  if (record.kind === 'sequence') {
    let remaining = localTime;
    let elapsed = 0;
    const writers: ResolvedWriter[] = [];
    const startWrites = new Map<WritableSignal<unknown>, DiscoveredValue>();
    const endWrites = new Map<WritableSignal<unknown>, DiscoveredValue>();
    let startBoundaryOpen = true;
    let stoppedAt: number | undefined;
    for (let index = 0; index < record.children.length; index++) {
      const child = record.children[index]!;
      const discovered = discoverNode(
        child,
        remaining,
        state,
        [...path, index],
        repeatIterations,
      );
      writers.push(...shiftedResolvedWriters(discovered.writers, elapsed));
      if (startBoundaryOpen) {
        applyDiscoveredWrites(startWrites, discovered.startWrites);
        if (discovered.duration === 0) {
          applyDiscoveredWrites(startWrites, discovered.endWrites);
        } else {
          startBoundaryOpen = false;
        }
      }
      applyDiscoveredWrites(endWrites, discovered.endWrites);
      if (discovered.duration === undefined || remaining < discovered.duration) {
        stoppedAt = index;
        break;
      }
      elapsed += discovered.duration;
      remaining = Math.max(0, remaining - discovered.duration);
    }
    let duration: number | undefined = stoppedAt === undefined ? elapsed : undefined;
    if (stoppedAt !== undefined) {
      const activeDuration = state.durations.get(instanceKey(
        [...path, stoppedAt],
        repeatIterations,
      ));
      duration = activeDuration === undefined ? undefined : elapsed + activeDuration;
      for (let index = stoppedAt + 1;
        duration !== undefined && index < record.children.length;
        index++) {
        const childDuration = getExactSeekableProgramDuration(record.children[index]!);
        duration = childDuration === undefined ? undefined : duration + childDuration;
      }
    }
    if (duration !== undefined) state.durations.set(instanceKey(path, repeatIterations), duration);
    return { duration, writers: Object.freeze(writers), startWrites, endWrites };
  }
  if (record.kind === 'parallel') {
    const baseline = new Map(state.values);
    const children: DiscoveryResult[] = [];
    let duration: number | undefined = 0;
    for (let index = 0; index < record.children.length; index++) {
      const branchState: DiscoveryState = { ...state, values: new Map(baseline) };
      const child = discoverNode(
        record.children[index]!,
        localTime,
        branchState,
        [...path, index],
        repeatIterations,
      );
      for (const previous of children) {
        assertResolvedWritersDisjoint(previous.writers, child.writers, state);
      }
      children.push(child);
      duration = duration === undefined || child.duration === undefined ? undefined :
        Math.max(duration, child.duration);
    }
    const startWrites = discoveredWrites(...children.map(child => child.startWrites));
    const endWrites = discoveredWrites(...children.map(child => child.endWrites));
    state.values.clear();
    for (const [output, value] of baseline) state.values.set(output, value);
    applyDiscoveredWrites(state.values, endWrites);
    if (duration !== undefined) state.durations.set(instanceKey(path, repeatIterations), duration);
    return {
      duration,
      writers: Object.freeze(children.flatMap(child => child.writers)),
      startWrites,
      endWrites,
    };
  }

  let remaining = localTime;
  let elapsed = 0;
  let firstWrites = new Map<WritableSignal<unknown>, DiscoveredValue>();
  let lastWrites = new Map<WritableSignal<unknown>, DiscoveredValue>();
  let previousWriters: readonly ResolvedWriter[] = Object.freeze([]);
  const writers: ResolvedWriter[] = [];
  for (let iteration = 0; iteration < record.iterations; iteration++) {
    const child = record.children[0]!;
    const iterationPath = [...repeatIterations, iteration];
    const reversed = record.direction === 'reverse' ||
      record.direction === 'alternate-reverse' && iteration % 2 === 0 ||
      record.direction === 'alternate' && iteration % 2 === 1;
    const baseline = new Map(state.values);
    const discovered = discoverNode(
      child,
      reversed ? Number.POSITIVE_INFINITY : remaining,
      state,
      [...path, 0],
      iterationPath,
    );
    const duration = discovered.duration;
    if (duration === undefined || duration === Number.POSITIVE_INFINITY) {
      return {
        duration: undefined,
        writers: Object.freeze(writers),
        startWrites: firstWrites,
        endWrites: lastWrites,
      };
    }
    if (duration === 0 && record.iterations === Number.POSITIVE_INFINITY) {
      throw new TypeError('An infinite repeat with zero duration cannot be discovered seekably.');
    }
    const iterationWriters = shiftedResolvedWriters(discovered.writers, elapsed);
    assertResolvedWritersDisjoint(previousWriters, iterationWriters, state);
    writers.push(...iterationWriters);
    previousWriters = iterationWriters;
    const iterationStartWrites = reversed ? discovered.endWrites : discovered.startWrites;
    const iterationEndWrites = reversed ? discovered.startWrites : discovered.endWrites;
    if (iteration === 0) firstWrites = new Map(iterationStartWrites);
    lastWrites = new Map(iterationEndWrites);
    state.values.clear();
    for (const [output, value] of baseline) state.values.set(output, value);
    applyDiscoveredWrites(state.values, iterationEndWrites);
    elapsed += duration;
    if (remaining < duration) {
      const exact = getExactSeekableProgramDuration(program);
      if (exact !== undefined) state.durations.set(instanceKey(path, repeatIterations), exact);
      return {
        duration: exact,
        writers: Object.freeze(writers),
        startWrites: firstWrites,
        endWrites: lastWrites,
      };
    }
    if (iteration + 1 === record.iterations) {
      state.durations.set(instanceKey(path, repeatIterations), elapsed);
      return {
        duration: elapsed,
        writers: Object.freeze(writers),
        startWrites: firstWrites,
        endWrites: lastWrites,
      };
    }
    remaining = Math.max(0, remaining - duration);
  }
  return {
    duration: elapsed,
    writers: Object.freeze(writers),
    startWrites: firstWrites,
    endWrites: lastWrites,
  };
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
      const exactDuration = knownDuration(child, state, childPath, iterationPath);
      if (exactDuration === undefined) {
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
      } else {
        if (exactDuration === Number.POSITIVE_INFINITY) {
          throw new TypeError('A reversed repeat child must have a finite seekable duration.');
        }
        duration = exactDuration;
      }
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
  durations: Map<string, number> = new Map(),
): SampleState {
  return {
    batch: seedOriginalValues(record),
    starts,
    durations,
    writtenOutputs: new Set(),
    snapshots: new WeakMap(),
  };
}

function createDiscoveryState(
  originalValues: ReadonlyMap<WritableSignal<unknown>, unknown>,
  starts: Map<string, InternalTrackStart>,
  validateWriters: boolean,
): DiscoveryState {
  return {
    values: new Map(originalValues),
    starts,
    durations: new Map(),
    snapshots: new WeakMap(),
    validateWriters,
    writerBudget: { remaining: maximumResolvedWriterComparisons },
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
  const discoveryState = createDiscoveryState(
    record.originalValues,
    rebuildStarts ? new Map() : new Map(record.starts),
    false,
  );
  const discoveryResult = discoverNode(
    record.program,
    horizon,
    discoveryState,
    [],
    [],
  );
  const destinationStarts = rebuildStarts ? new Map<string, InternalTrackStart>() :
    new Map(record.starts);
  const destinationState = createSampleState(
    record,
    destinationStarts,
    new Map(discoveryState.durations),
  );
  const destinationResult = sampleNode(record.program, time, destinationState, [], []);
  const milestoneState = createSampleState(
    record,
    discoveryState.starts,
    discoveryState.durations,
  );
  const milestones = crossedMilestones(record, normalizedInput, horizon, milestoneState);
  record.starts = destinationState.starts;
  for (const output of getProgramRecord(record.program).outputs) {
    if (destinationState.writtenOutputs.has(output)) {
      input.batch.stage(output, destinationState.batch.read(output), input.writer);
    }
  }

  const atStart = time === 0;
  const atEnd = destinationResult.atEnd;
  const duration = discoveryResult.duration ?? destinationResult.duration ??
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
  if (requiresProgramActivationWriterSafety(program)) {
    const discoveryState = createDiscoveryState(originalValues, new Map(), true);
    discoverNode(program, Number.POSITIVE_INFINITY, discoveryState, [], []);
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
