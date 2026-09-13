import {
  createSignalCommitBatch,
  getSignalNode,
  withSignalWriteForbidden,
  type SignalCommitBatch,
} from '../signals/graph.js';
import type { WritableSignal } from '../signals/types.js';
import {
  activateSeekableDefinition,
  getDefinitionRecord,
  getSeekableDefinitionBoundaryValue,
  getStaticSeekableDefinitionBoundaryValue,
  sampleActivatedSeekableDefinition,
  snapshotAnimationActivationValue,
  type SeekableDefinitionActivation,
} from './definition.js';
import {
  getExactSeekableProgramDuration,
  getProgramRecord,
  repeatResolvedWriterSchedules,
  resolvedWriterSchedulesOverlap,
  requiresProgramActivationWriterSafety,
  type ResolvedWriterSchedule,
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
  readonly steppers: readonly ProgramStepperTrace[];
  readonly terminal: ProgramTerminalState;
}

/** @internal Immutable fixed-step facts emitted without application callbacks. */
export interface ProgramStepperTrace {
  readonly programPath: readonly number[];
  readonly repeatIterations: readonly number[];
  readonly appliedSteps: number;
  readonly retainedRemainderMilliseconds: number;
  readonly clampedElapsedMilliseconds: number;
  readonly discardedElapsedMilliseconds: number;
  readonly terminal: {
    readonly step: number;
    readonly time: number;
  } | undefined;
}

export interface TrackStartSnapshot {
  readonly programPath: readonly number[];
  readonly repeatIterations: readonly number[];
  readonly initialValue: unknown;
  readonly duration: number;
}

export interface ActiveStepperSnapshot {
  readonly programPath: readonly number[];
  readonly repeatIterations: readonly number[];
  readonly wholeSteps: number;
  readonly retainedRemainderMilliseconds: number;
  readonly appliedElapsedMilliseconds: number;
  readonly discardedElapsedMilliseconds: number;
}

export interface TerminalStepperSnapshot {
  readonly programPath: readonly number[];
  readonly repeatIterations: readonly number[];
  readonly terminalStep: number;
  readonly terminalTime: number;
}

export interface ProgramActivationRecord {
  readonly program: CRCAnimationProgram;
  readonly registration: object;
  readonly originalValues: ReadonlyMap<WritableSignal<unknown>, unknown>;
  readonly trackStarts: readonly TrackStartSnapshot[];
  readonly activeSteppers: readonly ActiveStepperSnapshot[];
  readonly terminalSteppers: readonly TerminalStepperSnapshot[];
  readonly terminalDuration: number | undefined;
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
  steppers: Map<string, InternalStepperRecord>;
  terminalSteppers: Map<string, InternalStepperTerminal>;
  repeatFrontiers: Map<string, InternalRepeatFrontier>;
  repeatTerminals: Map<string, InternalRepeatTerminal>;
  reverseEndpoints: Map<string, InternalReverseEndpoint>;
  terminalDuration: number | undefined;
}

interface InternalRepeatFrontier {
  readonly programPath: readonly number[];
  readonly repeatIterations: readonly number[];
  completedIterations: number;
  elapsedMilliseconds: number;
  iterationInputValues: Map<WritableSignal<unknown>, unknown>;
  values: Map<WritableSignal<unknown>, unknown>;
}

interface InternalRepeatTerminal {
  readonly programPath: readonly number[];
  readonly repeatIterations: readonly number[];
  readonly duration: number;
  readonly values: ReadonlyMap<WritableSignal<unknown>, unknown>;
}

interface InternalReverseEndpoint {
  readonly programPath: readonly number[];
  readonly repeatIterations: readonly number[];
  readonly duration: number;
  readonly inputValues: ReadonlyMap<WritableSignal<unknown>, unknown>;
}

interface InternalStepperFrameBudget {
  remainingMilliseconds: number;
  readonly discardedMilliseconds: number;
  discardedReported: boolean;
}

interface InternalZeroDurationOccurrenceBudget {
  value: number;
}

interface InternalStepperRecord {
  readonly programPath: readonly number[];
  readonly repeatIterations: readonly number[];
  readonly activationInput: unknown;
  state: unknown;
  wholeSteps: number;
  remainderMilliseconds: number;
  appliedElapsedMilliseconds: number;
  discardedElapsedMilliseconds: number;
  sampledLocalTime: number;
}

interface InternalStepperTerminal {
  readonly programPath: readonly number[];
  readonly repeatIterations: readonly number[];
  readonly activationInput: unknown;
  readonly finalValue: unknown;
  readonly terminalStep: number;
  readonly terminalTime: number;
}

interface SampleState {
  readonly activation: InternalProgramActivation;
  readonly batch: SignalCommitBatch;
  readonly starts: Map<string, InternalTrackStart>;
  readonly durations: Map<string, number>;
  readonly writtenOutputs: Set<WritableSignal<unknown>>;
  readonly snapshots: WeakMap<object, unknown>;
  readonly owners: Map<WritableSignal<unknown>, SampledWriterOwner>;
  readonly steppers: Map<string, InternalStepperRecord>;
  readonly terminalSteppers: Map<string, InternalStepperTerminal>;
  readonly repeatFrontiers: Map<string, InternalRepeatFrontier>;
  readonly repeatTerminals: Map<string, InternalRepeatTerminal>;
  readonly reverseEndpoints: Map<string, InternalReverseEndpoint>;
  readonly stepperFrameBudgets: Map<string, InternalStepperFrameBudget>;
  readonly zeroDurationOccurrences: InternalZeroDurationOccurrenceBudget;
  readonly sampledTimelineEvents: TimelineEvent[];
  readonly nextTimelineSourceOrder: { value: number };
  readonly activeStepperKeys: Set<string>;
  readonly activeRepeatFrontierKeys: Set<string>;
  readonly activeReverseEndpointKeys: Set<string>;
  readonly stepperTraces: ProgramStepperTrace[];
  readonly frameId: number;
  readonly replaySteppers: boolean;
}

interface SampleResult {
  readonly duration: number | undefined;
  readonly atEnd: boolean;
}

interface SampledWriterOwner {
  readonly start: number;
  readonly end: number;
}

const unknownDiscoveredValue = Symbol('unknown animation discovery value');
type DiscoveredValue = unknown | typeof unknownDiscoveredValue;

interface ResolvedWriter {
  readonly output: WritableSignal<unknown>;
  readonly start: number;
  readonly end: number;
  readonly programPath: readonly number[];
  readonly repeatIterations: readonly number[];
  readonly repeats: readonly {
    readonly period: number;
    readonly iterations: number;
  }[];
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
  readonly validateInputs: boolean;
  readonly terminalSteppers: ReadonlyMap<string, InternalStepperTerminal>;
}

interface TimelineEvent {
  readonly kind: 'marker' | 'iteration';
  readonly marker?: string;
  readonly programTime: number;
  readonly programPath: readonly number[];
  readonly repeatIterations: readonly number[];
  readonly iteration: number;
  readonly sourceOrder: number;
}

interface TimeTransform {
  readonly origin: number;
  readonly scale: 1 | -1;
}

const activationRecords = new WeakMap<ProgramActivation, InternalProgramActivation>();
const activationStepperKeys = new WeakMap<ProgramActivation, Set<string>>();
let activeStepperStates = 0;
let acquiredStepperStates = 0;
let releasedStepperStates = 0;

export interface AnimationEvaluationOwnershipSnapshot {
  readonly activeStepperStates: number;
  readonly acquiredStepperStates: number;
  readonly releasedStepperStates: number;
}

/** @internal Exact ownership counters for retained and current-frame stepper state. */
export function animationEvaluationOwnershipSnapshot():
AnimationEvaluationOwnershipSnapshot {
  return Object.freeze({
    activeStepperStates,
    acquiredStepperStates,
    releasedStepperStates,
  });
}

function registerActivationStepperKeys(
  activation: ProgramActivation,
  keys: Iterable<string>,
): void {
  const snapshot = new Set(keys);
  activationStepperKeys.set(activation, snapshot);
  activeStepperStates += snapshot.size;
  acquiredStepperStates += snapshot.size;
}

function reconcileActivationStepperKeys(activation: ProgramActivation): void {
  const tracked = activationStepperKeys.get(activation);
  const record = activationRecords.get(activation);
  if (tracked === undefined || record === undefined) return;
  const next = new Set(record.steppers.keys());
  for (const key of tracked) {
    if (next.has(key)) continue;
    tracked.delete(key);
    activeStepperStates--;
    releasedStepperStates++;
  }
  for (const key of next) {
    if (tracked.has(key)) continue;
    tracked.add(key);
    activeStepperStates++;
    acquiredStepperStates++;
  }
}

function releaseActivationStepperKeys(activation: ProgramActivation): void {
  const tracked = activationStepperKeys.get(activation);
  if (tracked === undefined) return;
  activeStepperStates -= tracked.size;
  releasedStepperStates += tracked.size;
  activationStepperKeys.delete(activation);
}
const baselineWriter = Object.freeze({ name: 'CRC animation activation baseline' });
const directRepeatSelection = new WeakMap<CRCAnimationProgram, boolean>();
const containsStepperDefinition = new WeakMap<CRCAnimationProgram, boolean>();
// Repeated zero-time work cannot be collapsed without dropping callbacks or
// milestones. This fixed shared bound keeps one evaluation deterministic while
// permitting useful finite bursts.
const maximumZeroDurationOccurrencesPerEvaluation = 512;

class StepperCallbackError extends Error {
  constructor(message: string, readonly cause: unknown) {
    super(message);
    this.name = 'StepperCallbackError';
  }
}

function stepperLabel(debugName: string | undefined): string {
  return debugName === undefined ? 'CRC animation stepper' :
    `CRC animation stepper "${debugName}"`;
}

function reserveZeroDurationOccurrence(
  state: SampleState,
  label: string,
  path: readonly number[],
  repeatIterations: readonly number[],
): void {
  if (state.zeroDurationOccurrences.value >=
    maximumZeroDurationOccurrencesPerEvaluation) {
    const repeats = repeatIterations.length === 0 ? '' :
      `, repeat iterations [${repeatIterations.join(', ')}]`;
    throw new RangeError(
      `CRC animation zero-duration occurrence budget of ` +
        `${maximumZeroDurationOccurrencesPerEvaluation} was exhausted before ` +
        `${label} at program path [${path.join(', ')}]${repeats}, ` +
        `frame ${state.frameId}.`,
    );
  }
  state.zeroDurationOccurrences.value++;
}

function reservePotentialZeroDurationStepperOccurrence(
  state: SampleState,
  debugName: string | undefined,
  path: readonly number[],
  repeatIterations: readonly number[],
): void {
  reserveZeroDurationOccurrence(
    state,
    stepperLabel(debugName),
    path,
    repeatIterations,
  );
}

function invokeStepperCallback<T>(
  debugName: string | undefined,
  callbackName: 'initial' | 'step' | 'read' | 'done',
  path: readonly number[],
  repeatIterations: readonly number[],
  frameId: number,
  localTime: number,
  callback: () => T,
): T {
  try {
    return withSignalWriteForbidden(
      `${stepperLabel(debugName)} callbacks cannot write to signals.`,
      callback,
    );
  } catch (error) {
    const repeats = repeatIterations.length === 0 ? '' :
      `, repeat iterations [${repeatIterations.join(', ')}]`;
    const detail = error instanceof Error ? `: ${error.message}` : '';
    throw new StepperCallbackError(
      `${stepperLabel(debugName)} ${callbackName} callback failed at program path ` +
        `[${path.join(', ')}]${repeats}, frame ${frameId}, local time ${localTime}${detail}`,
      error,
    );
  }
}

function validateStepperOutput(value: unknown, debugName: string | undefined): unknown {
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new RangeError(
      `${stepperLabel(debugName)} read callback produced a nonfinite value.`,
    );
  }
  return value;
}

function programContainsStepper(program: CRCAnimationProgram): boolean {
  const cached = containsStepperDefinition.get(program);
  if (cached !== undefined) return cached;
  const record = getProgramRecord(program);
  const contains = record.kind === 'track' ?
    getDefinitionRecord(record.definition).kind === 'stepper' :
    record.children.some(programContainsStepper);
  containsStepperDefinition.set(program, contains);
  return contains;
}

function knownProgramTerminalDuration(record: InternalProgramActivation): number | undefined {
  const exact = getExactSeekableProgramDuration(record.program);
  if (exact !== undefined && Number.isFinite(exact)) return exact;
  return record.terminalDuration;
}

function validateActivationWriterSafety(
  program: CRCAnimationProgram,
  originalValues: ReadonlyMap<WritableSignal<unknown>, unknown>,
): void {
  if (!requiresProgramActivationWriterSafety(program)) return;
  if (!programContainsStepper(program)) {
    const discoveryState = createDiscoveryState(originalValues, new Map(), true);
    discoverNode(program, Number.POSITIVE_INFINITY, discoveryState, [], []);
    return;
  }
  for (const child of getProgramRecord(program).children) {
    validateActivationWriterSafety(child, originalValues);
  }
}

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

function stepperFrameBudgetKey(path: readonly number[]): string {
  return JSON.stringify(path);
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
    const terminal = state.terminalSteppers.get(key);
    if (terminal !== undefined) return terminal.terminalTime;
  }
  return getExactSeekableProgramDuration(program);
}

function canDirectlySelectRepeat(program: CRCAnimationProgram): boolean {
  const cached = directRepeatSelection.get(program);
  if (cached !== undefined) return cached;
  const record = getProgramRecord(program);
  let direct: boolean;
  if (record.kind === 'track') {
    const definition = getDefinitionRecord(record.definition);
    direct = definition.kind === 'keyframes' ||
      definition.kind === 'tween' && definition.hasFrom ||
      definition.kind === 'spring' && definition.hasFrom;
  } else {
    direct = record.kind === 'wait' || record.kind === 'marker' ||
      record.children.every(canDirectlySelectRepeat);
  }
  directRepeatSelection.set(program, direct);
  return direct;
}

function needsCallbackFreeDurationSeed(program: CRCAnimationProgram): boolean {
  const record = getProgramRecord(program);
  if (record.kind === 'repeat' && record.direction !== 'normal' &&
    getExactSeekableProgramDuration(record.children[0]!) === undefined) {
    return true;
  }
  return record.children.some(needsCallbackFreeDurationSeed);
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

function chronologicalEndWrites(
  children: readonly DiscoveryResult[],
  failClosedOnUnknownTiming = false,
): Map<WritableSignal<unknown>, DiscoveredValue> {
  const selected = new Map<WritableSignal<unknown>, {
    readonly end: number;
    readonly value: DiscoveredValue;
    readonly timingUnknown: boolean;
  }>();
  for (const child of children) {
    for (const [output, value] of child.endWrites) {
      let end = Number.NEGATIVE_INFINITY;
      for (const writerSpan of child.writers) {
        if (writerSpan.output === output) {
          const resolvedEnd = writerSpan.repeats.reduce((writerEnd, repeat) =>
            writerEnd + (repeat.iterations - 1) * repeat.period,
          writerSpan.end);
          end = Math.max(end, resolvedEnd);
        }
      }
      const current = selected.get(output);
      if (current === undefined) {
        selected.set(output, {
          end,
          value,
          timingUnknown: child.duration === undefined,
        });
      } else if (failClosedOnUnknownTiming &&
        (child.duration === undefined || current.timingUnknown)) {
        selected.set(output, {
          end: Number.POSITIVE_INFINITY,
          value: unknownDiscoveredValue,
          timingUnknown: true,
        });
      } else if (end >= current.end) {
        selected.set(output, { end, value, timingUnknown: false });
      }
    }
  }
  return new Map([...selected].map(([output, selectedValue]) =>
    [output, selectedValue.value],
  ));
}

function applyDiscoveredWrites(
  values: Map<WritableSignal<unknown>, DiscoveredValue>,
  writes: ReadonlyMap<WritableSignal<unknown>, DiscoveredValue>,
): void {
  for (const [output, value] of writes) values.set(output, value);
}

function unknownRepeatDiscovery(
  program: CRCAnimationProgram,
  outputs: readonly WritableSignal<unknown>[],
  state: DiscoveryState,
  path: readonly number[],
  repeatIterations: readonly number[],
): DiscoveryResult {
  const duration = getExactSeekableProgramDuration(program);
  const writes = new Map(outputs.map(output =>
    [output, unknownDiscoveredValue] as const,
  ));
  applyDiscoveredWrites(state.values, writes);
  if (duration !== undefined) {
    state.durations.set(instanceKey(path, repeatIterations), duration);
  }
  const writerEnd = duration ?? Number.POSITIVE_INFINITY;
  return {
    duration,
    writers: Object.freeze(outputs.map(output => Object.freeze({
      output,
      start: 0,
      end: writerEnd,
      programPath: freezePath(path),
      repeatIterations: freezePath(repeatIterations),
      repeats: Object.freeze([]),
    }))),
    startWrites: writes,
    endWrites: writes,
  };
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
      const firstSchedule: ResolvedWriterSchedule = {
        output: firstWriter.output,
        start: firstWriter.start,
        end: firstWriter.end,
        path: firstWriter.programPath,
        repeats: firstWriter.repeats,
      };
      const secondSchedule: ResolvedWriterSchedule = {
        output: secondWriter.output,
        start: secondWriter.start,
        end: secondWriter.end,
        path: secondWriter.programPath,
        repeats: secondWriter.repeats,
      };
      if (resolvedWriterSchedulesOverlap(firstSchedule, secondSchedule)) {
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
  const definitionRecord = getDefinitionRecord(record.definition);
  if (definitionRecord.kind === 'stepper') {
    const terminal = state.terminalSteppers.get(key);
    if (terminal === undefined) {
      if (state.validateWriters) {
        throw new RangeError(
          `CRC animation activation-dependent writer schedule at path ` +
            `[${path.join(', ')}] contains a stepper whose terminal time is not discovered.`,
        );
      }
      return {
        duration: undefined,
        writers: Object.freeze([]),
        startWrites: new Map([[record.output, unknownDiscoveredValue]]),
        endWrites: new Map([[record.output, unknownDiscoveredValue]]),
      };
    }
    state.durations.set(key, terminal.terminalTime);
    state.values.set(record.output, terminal.finalValue);
    return {
      duration: terminal.terminalTime,
      writers: Object.freeze([Object.freeze({
        output: record.output,
        start: 0,
        end: terminal.terminalTime,
        programPath: freezePath(path),
        repeatIterations: freezePath(repeatIterations),
        repeats: Object.freeze([]),
      })]),
      startWrites: new Map([[record.output, terminal.activationInput]]),
      endWrites: new Map([[record.output, terminal.finalValue]]),
    };
  }
  let start = state.starts.get(key);
  if (start === undefined) {
    const initialValue = state.values.has(record.output) ?
      state.values.get(record.output)! : unknownDiscoveredValue;
    const needsCapturedInput = definitionRecord.kind === 'spring' &&
      !definitionRecord.hasFrom || definitionRecord.kind === 'tween' &&
      !definitionRecord.hasFrom;
    if (state.validateInputs && needsCapturedInput &&
      initialValue === unknownDiscoveredValue) {
      const label = definitionRecord.debugName === undefined ?
        'CRC animation definition' :
        `CRC animation definition "${definitionRecord.debugName}"`;
      throw new TypeError(
        `${label} activation input could not be determined callback-free at ` +
          `program path [${path.join(', ')}].`,
      );
    }
    if (initialValue !== unknownDiscoveredValue) {
      if (state.validateInputs && definitionRecord.kind === 'tween' &&
        !definitionRecord.hasFrom && definitionRecord.interpolate === undefined &&
        (typeof initialValue !== 'number' || typeof definitionRecord.to !== 'number')) {
        const label = definitionRecord.debugName === undefined ?
          'CRC animation definition' :
          `CRC animation definition "${definitionRecord.debugName}"`;
        throw new TypeError(
          `${label} requires an explicit interpolator for nonnumeric values.`,
        );
      }
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
      repeats: Object.freeze([]),
    })]),
    startWrites,
    endWrites,
  };
}

function discoveredValuesEqual(
  first: ReadonlyMap<WritableSignal<unknown>, DiscoveredValue>,
  second: ReadonlyMap<WritableSignal<unknown>, DiscoveredValue>,
): boolean {
  if (first.size !== second.size) return false;
  for (const [output, value] of first) {
    if (!second.has(output) || !Object.is(value, second.get(output))) return false;
  }
  return true;
}

function symbolicRepeatWriters(
  writers: readonly ResolvedWriter[],
  period: number,
  iterations: number,
  offset = 0,
): readonly ResolvedWriter[] {
  const schedules = repeatResolvedWriterSchedules(writers.map(writerSpan => ({
    output: writerSpan.output,
    start: writerSpan.start + offset,
    end: writerSpan.end + offset,
    path: writerSpan.programPath,
    repeats: writerSpan.repeats,
  })), period, iterations);
  return Object.freeze(schedules.map((schedule, index) => Object.freeze({
    output: schedule.output,
    start: schedule.start,
    end: schedule.end,
    programPath: freezePath(schedule.path),
    repeatIterations: writers[index]!.repeatIterations,
    repeats: schedule.repeats,
  })));
}

function applyIterationEnd(
  state: DiscoveryState,
  baseline: ReadonlyMap<WritableSignal<unknown>, DiscoveredValue>,
  discovered: DiscoveryResult,
  reversed: boolean,
): ReadonlyMap<WritableSignal<unknown>, DiscoveredValue> {
  const writes = reversed ? discovered.startWrites : discovered.endWrites;
  state.values.clear();
  for (const [output, value] of baseline) state.values.set(output, value);
  applyDiscoveredWrites(state.values, writes);
  return writes;
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
    if (state.validateInputs) {
      let elapsed: number | undefined = 0;
      const writers: ResolvedWriter[] = [];
      const startWrites = new Map<WritableSignal<unknown>, DiscoveredValue>();
      const endWrites = new Map<WritableSignal<unknown>, DiscoveredValue>();
      let startBoundaryOpen = true;
      for (let index = 0; index < record.children.length; index++) {
        const discovered = discoverNode(
          record.children[index]!,
          Number.POSITIVE_INFINITY,
          state,
          [...path, index],
          repeatIterations,
        );
        writers.push(...shiftedResolvedWriters(
          discovered.writers,
          elapsed ?? Number.POSITIVE_INFINITY,
        ));
        if (startBoundaryOpen) {
          applyDiscoveredWrites(startWrites, discovered.startWrites);
          if (discovered.duration === 0) {
            applyDiscoveredWrites(startWrites, discovered.endWrites);
          } else {
            startBoundaryOpen = false;
          }
        }
        applyDiscoveredWrites(endWrites, discovered.endWrites);
        applyDiscoveredWrites(state.values, discovered.endWrites);
        elapsed = elapsed === undefined || discovered.duration === undefined ?
          undefined : elapsed + discovered.duration;
      }
      if (elapsed !== undefined) {
        state.durations.set(instanceKey(path, repeatIterations), elapsed);
      }
      return { duration: elapsed, writers: Object.freeze(writers), startWrites, endWrites };
    }
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
    const endWrites = chronologicalEndWrites(children, state.validateInputs);
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

  if ((state.validateWriters || state.validateInputs) && record.iterations > 1) {
    const child = record.children[0]!;
    const initialValues = new Map(state.values);
    const firstReversed = record.direction === 'reverse' ||
      record.direction === 'alternate-reverse';
    const first = discoverNode(
      child,
      Number.POSITIVE_INFINITY,
      state,
      [...path, 0],
      [...repeatIterations, 0],
    );
    if (first.duration === undefined || !Number.isFinite(first.duration)) {
      if (state.validateInputs && !state.validateWriters) {
        return unknownRepeatDiscovery(
          program,
          record.outputs,
          state,
          path,
          repeatIterations,
        );
      }
      throw new RangeError(
        'CRC animation activation-dependent repeat writer period could not be proven finite.',
      );
    }
    const firstEndWrites = applyIterationEnd(state, initialValues, first, firstReversed);
    const stableAfterFirst = discoveredValuesEqual(initialValues, state.values);
    const alternating = record.direction === 'alternate' ||
      record.direction === 'alternate-reverse';
    if (stableAfterFirst && !alternating) {
      const next = shiftedResolvedWriters(first.writers, first.duration);
      assertResolvedWritersDisjoint(first.writers, next, state);
      const writers = symbolicRepeatWriters(
        first.writers,
        first.duration,
        record.iterations,
      );
      const duration = record.iterations === Number.POSITIVE_INFINITY ?
        Number.POSITIVE_INFINITY : first.duration * record.iterations;
      state.durations.set(instanceKey(path, repeatIterations), duration);
      return {
        duration,
        writers,
        startWrites: new Map(firstReversed ? first.endWrites : first.startWrites),
        endWrites: new Map(firstEndWrites),
      };
    }

    const steadyBaseline = new Map(state.values);
    const secondReversed = record.direction === 'reverse' ||
      record.direction === 'alternate';
    const second = discoverNode(
      child,
      Number.POSITIVE_INFINITY,
      state,
      [...path, 0],
      [...repeatIterations, 1],
    );
    if (second.duration === undefined || !Number.isFinite(second.duration)) {
      if (state.validateInputs && !state.validateWriters) {
        return unknownRepeatDiscovery(
          program,
          record.outputs,
          state,
          path,
          repeatIterations,
        );
      }
      throw new RangeError(
        'CRC animation activation-dependent repeat writer period could not be proven finite.',
      );
    }
    const secondEndWrites = applyIterationEnd(
      state,
      steadyBaseline,
      second,
      secondReversed,
    );
    const shiftedSecond = shiftedResolvedWriters(second.writers, first.duration);
    assertResolvedWritersDisjoint(first.writers, shiftedSecond, state);
    if (record.iterations === 2) {
      const duration = first.duration + second.duration;
      state.durations.set(instanceKey(path, repeatIterations), duration);
      return {
        duration,
        writers: Object.freeze([...first.writers, ...shiftedSecond]),
        startWrites: new Map(firstReversed ? first.endWrites : first.startWrites),
        endWrites: new Map(secondEndWrites),
      };
    }
    if (alternating) {
      if (!discoveredValuesEqual(initialValues, state.values)) {
        if (state.validateInputs && !state.validateWriters) {
          const pairEndValues = new Map(state.values);
          const third = discoverNode(
            child,
            Number.POSITIVE_INFINITY,
            state,
            [...path, 0],
            [...repeatIterations, 2],
          );
          if (third.duration === undefined || !Number.isFinite(third.duration)) {
            return unknownRepeatDiscovery(
              program,
              record.outputs,
              state,
              path,
              repeatIterations,
            );
          }
          const thirdEndWrites = applyIterationEnd(
            state,
            pairEndValues,
            third,
            firstReversed,
          );
          const fourthBaseline = new Map(state.values);
          const fourth = discoverNode(
            child,
            Number.POSITIVE_INFINITY,
            state,
            [...path, 0],
            [...repeatIterations, 3],
          );
          if (fourth.duration === undefined || !Number.isFinite(fourth.duration)) {
            return unknownRepeatDiscovery(
              program,
              record.outputs,
              state,
              path,
              repeatIterations,
            );
          }
          const fourthEndWrites = applyIterationEnd(
            state,
            fourthBaseline,
            fourth,
            secondReversed,
          );
          if (!discoveredValuesEqual(pairEndValues, state.values)) {
            return unknownRepeatDiscovery(
              program,
              record.outputs,
              state,
              path,
              repeatIterations,
            );
          }
          const firstPairDuration = first.duration + second.duration;
          const steadyPairDuration = third.duration + fourth.duration;
          const pairCount = record.iterations === Number.POSITIVE_INFINITY ?
            Number.POSITIVE_INFINITY : Math.floor(record.iterations / 2);
          const hasOddIteration = record.iterations !== Number.POSITIVE_INFINITY &&
            record.iterations % 2 === 1;
          const duration = record.iterations === Number.POSITIVE_INFINITY ?
            Number.POSITIVE_INFINITY : firstPairDuration +
              (pairCount - 1) * steadyPairDuration +
              (hasOddIteration ? third.duration : 0);
          const finalIteration = hasOddIteration ? third : fourth;
          const finalIterationDuration = hasOddIteration ?
            third.duration : fourth.duration;
          const finalEndWrites = hasOddIteration ? thirdEndWrites : fourthEndWrites;
          if (hasOddIteration) {
            state.values.clear();
            for (const [output, value] of pairEndValues) {
              state.values.set(output, value);
            }
            applyDiscoveredWrites(state.values, thirdEndWrites);
          }
          state.durations.set(instanceKey(path, repeatIterations), duration);
          const finalOffset = Number.isFinite(duration) ?
            duration - finalIterationDuration : Number.POSITIVE_INFINITY;
          return {
            duration,
            writers: Object.freeze(shiftedResolvedWriters(
              finalIteration.writers,
              finalOffset,
            )),
            startWrites: new Map(firstReversed ? first.endWrites : first.startWrites),
            endWrites: new Map(finalEndWrites),
          };
        }
        throw new RangeError(
          'CRC animation activation-dependent alternating repeat writer schedule did not reach a bounded symbolic period.',
        );
      }
      const pairDuration = first.duration + second.duration;
      assertResolvedWritersDisjoint(
        second.writers,
        shiftedResolvedWriters(first.writers, pairDuration - first.duration),
        state,
      );
      const pairCount = record.iterations === Number.POSITIVE_INFINITY ?
        Number.POSITIVE_INFINITY : Math.floor(record.iterations / 2);
      const writers: ResolvedWriter[] = [
        ...symbolicRepeatWriters(first.writers, pairDuration, pairCount),
        ...symbolicRepeatWriters(second.writers, pairDuration, pairCount, first.duration),
      ];
      const hasOddIteration = record.iterations !== Number.POSITIVE_INFINITY &&
        record.iterations % 2 === 1;
      if (hasOddIteration) {
        writers.push(...shiftedResolvedWriters(first.writers, pairCount * pairDuration));
      }
      const duration = record.iterations === Number.POSITIVE_INFINITY ?
        Number.POSITIVE_INFINITY : pairCount * pairDuration +
          (hasOddIteration ? first.duration : 0);
      state.durations.set(instanceKey(path, repeatIterations), duration);
      return {
        duration,
        writers: Object.freeze(writers),
        startWrites: new Map(firstReversed ? first.endWrites : first.startWrites),
        endWrites: new Map(hasOddIteration ? firstEndWrites : secondEndWrites),
      };
    }
    if (!discoveredValuesEqual(steadyBaseline, state.values)) {
      if (state.validateInputs && !state.validateWriters) {
        return unknownRepeatDiscovery(
          program,
          record.outputs,
          state,
          path,
          repeatIterations,
        );
      }
      throw new RangeError(
        'CRC animation activation-dependent repeat writer schedule did not reach a bounded symbolic period.',
      );
    }
    assertResolvedWritersDisjoint(
      second.writers,
      shiftedResolvedWriters(second.writers, second.duration),
      state,
    );
    const remainingIterations = record.iterations === Number.POSITIVE_INFINITY ?
      Number.POSITIVE_INFINITY : record.iterations - 1;
    const writers = Object.freeze([
      ...first.writers,
      ...symbolicRepeatWriters(
        second.writers,
        second.duration,
        remainingIterations,
        first.duration,
      ),
    ]);
    const duration = record.iterations === Number.POSITIVE_INFINITY ?
      Number.POSITIVE_INFINITY :
      first.duration + second.duration * remainingIterations;
    state.durations.set(instanceKey(path, repeatIterations), duration);
    return {
      duration,
      writers,
      startWrites: new Map(firstReversed ? first.endWrites : first.startWrites),
      endWrites: new Map(secondEndWrites),
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
    if (state.validateWriters) {
      assertResolvedWritersDisjoint(previousWriters, iterationWriters, state);
      writers.push(...iterationWriters);
      previousWriters = iterationWriters;
    }
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

function frozenStepperTerminal(
  path: readonly number[],
  repeatIterations: readonly number[],
  activationInput: unknown,
  finalValue: unknown,
  terminalStep: number,
  terminalTime: number,
): InternalStepperTerminal {
  return Object.freeze({
    programPath: freezePath(path),
    repeatIterations: freezePath(repeatIterations),
    activationInput,
    finalValue,
    terminalStep,
    terminalTime,
  });
}

function frozenStepperTrace(
  path: readonly number[],
  repeatIterations: readonly number[],
  appliedSteps: number,
  retainedRemainderMilliseconds: number,
  clampedElapsedMilliseconds: number,
  discardedElapsedMilliseconds: number,
  terminal: InternalStepperTerminal | undefined,
): ProgramStepperTrace {
  return Object.freeze({
    programPath: freezePath(path),
    repeatIterations: freezePath(repeatIterations),
    appliedSteps,
    retainedRemainderMilliseconds,
    clampedElapsedMilliseconds,
    discardedElapsedMilliseconds,
    terminal: terminal === undefined ? undefined : Object.freeze({
      step: terminal.terminalStep,
      time: terminal.terminalTime,
    }),
  });
}

function sampleStepperTrack(
  program: CRCAnimationProgram,
  localTime: number,
  state: SampleState,
  path: readonly number[],
  repeatIterations: readonly number[],
  offset: number,
): SampleResult {
  const trackRecord = getProgramRecord(program);
  if (trackRecord.kind !== 'track') throw new Error('Expected an animation track record.');
  const definitionRecord = getDefinitionRecord(trackRecord.definition);
  if (definitionRecord.kind !== 'stepper') {
    throw new Error('Expected a stateful animation definition.');
  }
  const key = instanceKey(path, repeatIterations);
  const knownTerminal = state.terminalSteppers.get(key);
  if (!state.replaySteppers && knownTerminal !== undefined &&
    localTime >= knownTerminal.terminalTime) {
    state.batch.stage(trackRecord.output, knownTerminal.finalValue, baselineWriter);
    state.writtenOutputs.add(trackRecord.output);
    state.owners.set(trackRecord.output, Object.freeze({
      start: offset,
      end: offset + knownTerminal.terminalTime,
    }));
    state.stepperTraces.push(frozenStepperTrace(
      path,
      repeatIterations,
      0,
      0,
      0,
      0,
      undefined,
    ));
    setDuration(state, path, repeatIterations, knownTerminal.terminalTime);
    return Object.freeze({ duration: knownTerminal.terminalTime, atEnd: true });
  }
  if (!Number.isFinite(localTime)) {
    throw new TypeError(
      `${stepperLabel(definitionRecord.debugName)} terminal time is not discovered.`,
    );
  }

  let stepperRecord = state.steppers.get(key);
  let newlyInitialized = false;
  let zeroDurationReservation = false;
  if (stepperRecord === undefined) {
    if (definitionRecord.done !== undefined) {
      reservePotentialZeroDurationStepperOccurrence(
        state,
        definitionRecord.debugName,
        path,
        repeatIterations,
      );
      zeroDurationReservation = true;
    }
    const activationInput = snapshotAnimationActivationValue(
      state.batch.read(trackRecord.output),
      state.snapshots,
    );
    const initialState = invokeStepperCallback(
      definitionRecord.debugName,
      'initial',
      path,
      repeatIterations,
      state.frameId,
      0,
      () => definitionRecord.initial(activationInput),
    );
    stepperRecord = {
      programPath: freezePath(path),
      repeatIterations: freezePath(repeatIterations),
      activationInput,
      state: initialState,
      wholeSteps: 0,
      remainderMilliseconds: 0,
      appliedElapsedMilliseconds: 0,
      discardedElapsedMilliseconds: 0,
      sampledLocalTime: 0,
    };
    newlyInitialized = true;
  }

  let terminal: InternalStepperTerminal | undefined;
  if (newlyInitialized && definitionRecord.done !== undefined && invokeStepperCallback(
    definitionRecord.debugName,
    'done',
    path,
    repeatIterations,
    state.frameId,
    stepperRecord.appliedElapsedMilliseconds,
    () => definitionRecord.done!(stepperRecord.state),
  )) {
    terminal = frozenStepperTerminal(
      path,
      repeatIterations,
      stepperRecord.activationInput,
      undefined,
      stepperRecord.wholeSteps,
      stepperRecord.appliedElapsedMilliseconds,
    );
  }
  if (zeroDurationReservation && terminal === undefined) {
    state.zeroDurationOccurrences.value--;
  }

  const rawContribution = Math.max(0, localTime - stepperRecord.sampledLocalTime);
  let frameBudget: InternalStepperFrameBudget | undefined;
  if (!state.replaySteppers) {
    const budgetKey = stepperFrameBudgetKey(path);
    frameBudget = state.stepperFrameBudgets.get(budgetKey);
    if (frameBudget === undefined) {
      const available = Math.min(
        rawContribution,
        definitionRecord.maxElapsedMilliseconds,
      );
      frameBudget = {
        remainingMilliseconds: available,
        discardedMilliseconds: rawContribution - available,
        discardedReported: false,
      };
      state.stepperFrameBudgets.set(budgetKey, frameBudget);
    }
  }
  const clampedCandidate = frameBudget === undefined ? rawContribution :
    Math.min(rawContribution, frameBudget.remainingMilliseconds);
  const previousRemainder = stepperRecord.remainderMilliseconds;
  const accumulator = previousRemainder + clampedCandidate;
  const availableSteps = terminal === undefined ?
    Math.floor(accumulator / definitionRecord.stepMilliseconds) : 0;
  if (!Number.isSafeInteger(availableSteps)) {
    throw new RangeError(
      `${stepperLabel(definitionRecord.debugName)} whole-step count must be a safe integer ` +
        `at program path [${path.join(', ')}], frame ${state.frameId}, local time ` +
        `${localTime}; received ${availableSteps}.`,
    );
  }
  let appliedSteps = 0;
  for (; appliedSteps < availableSteps; appliedSteps++) {
    stepperRecord.state = invokeStepperCallback(
      definitionRecord.debugName,
      'step',
      path,
      repeatIterations,
      state.frameId,
      stepperRecord.appliedElapsedMilliseconds + definitionRecord.stepMilliseconds,
      () => definitionRecord.step(
        stepperRecord.state,
        definitionRecord.stepMilliseconds,
      ),
    );
    stepperRecord.wholeSteps++;
    stepperRecord.appliedElapsedMilliseconds =
      stepperRecord.wholeSteps * definitionRecord.stepMilliseconds;
    if (definitionRecord.done !== undefined && invokeStepperCallback(
      definitionRecord.debugName,
      'done',
      path,
      repeatIterations,
      state.frameId,
      stepperRecord.appliedElapsedMilliseconds,
      () => definitionRecord.done!(stepperRecord.state),
    )) {
      appliedSteps++;
      terminal = frozenStepperTerminal(
        path,
        repeatIterations,
        stepperRecord.activationInput,
        undefined,
        stepperRecord.wholeSteps,
        stepperRecord.appliedElapsedMilliseconds,
      );
      break;
    }
  }
  stepperRecord.remainderMilliseconds = terminal === undefined ?
    accumulator - appliedSteps * definitionRecord.stepMilliseconds : 0;
  if (Math.abs(stepperRecord.remainderMilliseconds) < Number.EPSILON) {
    stepperRecord.remainderMilliseconds = 0;
  }
  const clampedContribution = terminal === undefined ? clampedCandidate :
    Math.max(0, Math.min(
      clampedCandidate,
      appliedSteps * definitionRecord.stepMilliseconds - previousRemainder,
    ));
  if (frameBudget !== undefined) {
    frameBudget.remainingMilliseconds = Math.max(
      0,
      frameBudget.remainingMilliseconds - clampedContribution,
    );
  }
  const discardedGap = frameBudget !== undefined &&
    !frameBudget.discardedReported ? frameBudget.discardedMilliseconds : 0;
  if (frameBudget !== undefined && !frameBudget.discardedReported) {
    frameBudget.discardedReported = true;
  }
  stepperRecord.discardedElapsedMilliseconds += discardedGap;
  stepperRecord.sampledLocalTime = localTime;

  const projected = invokeStepperCallback(
    definitionRecord.debugName,
    'read',
    path,
    repeatIterations,
    state.frameId,
    stepperRecord.appliedElapsedMilliseconds,
    () => validateStepperOutput(
      definitionRecord.read(stepperRecord.state),
      definitionRecord.debugName,
    ),
  );
  if (terminal !== undefined) {
    terminal = frozenStepperTerminal(
      path,
      repeatIterations,
      stepperRecord.activationInput,
      projected,
      terminal.terminalStep,
      terminal.terminalTime,
    );
    state.terminalSteppers.set(key, terminal);
    state.steppers.delete(key);
  } else {
    state.steppers.set(key, stepperRecord);
    state.activeStepperKeys.add(key);
  }
  state.stepperTraces.push(frozenStepperTrace(
    path,
    repeatIterations,
    appliedSteps,
    stepperRecord.remainderMilliseconds,
    clampedContribution,
    discardedGap,
    terminal,
  ));
  state.batch.stage(trackRecord.output, projected, baselineWriter);
  state.writtenOutputs.add(trackRecord.output);
  const duration = terminal?.terminalTime ??
    (definitionRecord.done === undefined ? Number.POSITIVE_INFINITY : undefined);
  state.owners.set(trackRecord.output, Object.freeze({
    start: offset,
    end: offset + (duration ?? Number.POSITIVE_INFINITY),
  }));
  setDuration(state, path, repeatIterations, duration);
  return Object.freeze({
    duration,
    atEnd: terminal !== undefined && localTime >= terminal.terminalTime,
  });
}

function sampleTrack(
  program: CRCAnimationProgram,
  localTime: number,
  state: SampleState,
  path: readonly number[],
  repeatIterations: readonly number[],
  offset: number,
): SampleResult {
  const record = getProgramRecord(program);
  if (record.kind !== 'track') throw new Error('Expected an animation track record.');
  if (getDefinitionRecord(record.definition).kind === 'stepper') {
    return sampleStepperTrack(
      program,
      localTime,
      state,
      path,
      repeatIterations,
      offset,
    );
  }
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
  state.owners.set(record.output, Object.freeze({
    start: offset,
    end: offset + duration,
  }));
  setDuration(state, path, repeatIterations, duration);
  return Object.freeze({ duration, atEnd: localTime >= duration });
}

function forkSampleState(
  state: SampleState,
  outputs: readonly WritableSignal<unknown>[],
): SampleState {
  const batch = createSignalCommitBatch();
  for (const output of outputs) {
    batch.stage(output, state.batch.read(output), baselineWriter);
  }
  return {
    activation: state.activation,
    batch,
    starts: state.starts,
    durations: state.durations,
    writtenOutputs: new Set(),
    snapshots: state.snapshots,
    owners: new Map(),
    steppers: state.steppers,
    terminalSteppers: state.terminalSteppers,
    repeatFrontiers: state.repeatFrontiers,
    repeatTerminals: state.repeatTerminals,
    reverseEndpoints: state.reverseEndpoints,
    stepperFrameBudgets: state.stepperFrameBudgets,
    zeroDurationOccurrences: state.zeroDurationOccurrences,
    sampledTimelineEvents: state.sampledTimelineEvents,
    nextTimelineSourceOrder: state.nextTimelineSourceOrder,
    activeStepperKeys: state.activeStepperKeys,
    activeRepeatFrontierKeys: state.activeRepeatFrontierKeys,
    activeReverseEndpointKeys: state.activeReverseEndpointKeys,
    stepperTraces: state.stepperTraces,
    frameId: state.frameId,
    replaySteppers: state.replaySteppers,
  };
}

function ownerWins(
  candidate: SampledWriterOwner,
  current: SampledWriterOwner | undefined,
  time: number,
): boolean {
  if (current === undefined) return true;
  const candidateActive = candidate.start <= time && time <= candidate.end;
  const currentActive = current.start <= time && time <= current.end;
  if (candidateActive !== currentActive) return candidateActive;
  return candidate.end >= current.end;
}

function queueSampledTimelineEvent(
  state: SampleState,
  event: Omit<TimelineEvent, 'sourceOrder'>,
): void {
  const duplicate = state.sampledTimelineEvents.some(existing =>
    existing.kind === event.kind &&
    existing.marker === event.marker &&
    existing.programTime === event.programTime &&
    existing.iteration === event.iteration &&
    existing.repeatIterations.length === event.repeatIterations.length &&
    existing.repeatIterations.every(
      (part, index) => part === event.repeatIterations[index],
    ) &&
    existing.programPath.length === event.programPath.length &&
    existing.programPath.every((part, index) => part === event.programPath[index]),
  );
  if (duplicate) return;
  state.sampledTimelineEvents.push(Object.freeze({
    ...event,
    programPath: freezePath(event.programPath),
    repeatIterations: freezePath(event.repeatIterations),
    sourceOrder: state.nextTimelineSourceOrder.value++,
  }));
}

function pathHasPrefix(
  path: readonly number[],
  prefix: readonly number[],
): boolean {
  return prefix.length <= path.length &&
    prefix.every((part, index) => path[index] === part);
}

function belongsToOccurrence(
  programPath: readonly number[],
  repeatIterations: readonly number[],
  childPath: readonly number[],
  iterationPath: readonly number[],
): boolean {
  return pathHasPrefix(programPath, childPath) &&
    pathHasPrefix(repeatIterations, iterationPath);
}

function clearOccurrenceState(
  state: SampleState,
  childPath: readonly number[],
  iterationPath: readonly number[],
): void {
  for (const [key, start] of state.starts) {
    if (belongsToOccurrence(
      start.programPath,
      start.repeatIterations,
      childPath,
      iterationPath,
    )) state.starts.delete(key);
  }
  for (const [key, stepperRecord] of state.steppers) {
    if (belongsToOccurrence(
      stepperRecord.programPath,
      stepperRecord.repeatIterations,
      childPath,
      iterationPath,
    )) state.steppers.delete(key);
  }
  for (const [key, terminal] of state.terminalSteppers) {
    if (belongsToOccurrence(
      terminal.programPath,
      terminal.repeatIterations,
      childPath,
      iterationPath,
    )) state.terminalSteppers.delete(key);
  }
  for (const [key, frontier] of state.repeatFrontiers) {
    if (belongsToOccurrence(
      frontier.programPath,
      frontier.repeatIterations,
      childPath,
      iterationPath,
    )) state.repeatFrontiers.delete(key);
  }
  for (const [key, terminal] of state.repeatTerminals) {
    if (belongsToOccurrence(
      terminal.programPath,
      terminal.repeatIterations,
      childPath,
      iterationPath,
    )) state.repeatTerminals.delete(key);
  }
  for (const [key, endpoint] of state.reverseEndpoints) {
    if (belongsToOccurrence(
      endpoint.programPath,
      endpoint.repeatIterations,
      childPath,
      iterationPath,
    )) state.reverseEndpoints.delete(key);
  }
}

function programValues(
  program: CRCAnimationProgram,
  batch: SignalCommitBatch,
): Map<WritableSignal<unknown>, unknown> {
  return new Map(getProgramRecord(program).outputs.map(output => [output, batch.read(output)]));
}

function stageProgramValues(
  program: CRCAnimationProgram,
  values: ReadonlyMap<WritableSignal<unknown>, unknown>,
  state: SampleState,
  offset: number,
  duration: number | undefined,
): void {
  for (const output of getProgramRecord(program).outputs) {
    if (!values.has(output)) continue;
    state.batch.stage(output, values.get(output), baselineWriter);
    state.writtenOutputs.add(output);
    state.owners.set(output, Object.freeze({
      start: offset,
      end: offset + (duration ?? Number.POSITIVE_INFINITY),
    }));
  }
}

function firstStepperDebugName(program: CRCAnimationProgram): string | undefined {
  const record = getProgramRecord(program);
  if (record.kind === 'track') {
    const definition = getDefinitionRecord(record.definition);
    return definition.kind === 'stepper' ? definition.debugName : undefined;
  }
  for (const child of record.children) {
    if (programContainsStepper(child)) return firstStepperDebugName(child);
  }
  return undefined;
}

function isolatedReplayState(
  state: SampleState,
  values: ReadonlyMap<WritableSignal<unknown>, unknown>,
): SampleState {
  const isolated = createSampleState(
    state.activation,
    new Map(),
    new Map(),
    new Map(),
    new Map(),
    new Map(),
    new Map(),
    new Map(),
    state.frameId,
    true,
    state.zeroDurationOccurrences,
  );
  for (const [output, value] of values) {
    isolated.batch.stage(output, value, baselineWriter);
  }
  return isolated;
}

function mergeReplaySample(
  program: CRCAnimationProgram,
  replay: SampleState,
  state: SampleState,
  offset: number,
  duration: number,
): void {
  for (const [key, value] of replay.durations) state.durations.set(key, value);
  state.stepperTraces.push(...replay.stepperTraces);
  stageProgramValues(program, programValues(program, replay.batch), state, offset, duration);
}

function programValuesEqual(
  program: CRCAnimationProgram,
  first: ReadonlyMap<WritableSignal<unknown>, unknown>,
  second: ReadonlyMap<WritableSignal<unknown>, unknown>,
): boolean {
  return getProgramRecord(program).outputs.every(output =>
    first.has(output) && second.has(output) && Object.is(first.get(output), second.get(output)),
  );
}

function rememberForwardEndpoint(
  state: SampleState,
  endpointPath: readonly number[],
  endpointRepeatIterations: readonly number[],
  values: ReadonlyMap<WritableSignal<unknown>, unknown>,
  duration: number,
): void {
  const endpointKey = instanceKey(endpointPath, endpointRepeatIterations);
  state.reverseEndpoints.set(endpointKey, Object.freeze({
    programPath: freezePath(endpointPath),
    repeatIterations: freezePath(endpointRepeatIterations),
    duration,
    inputValues: new Map(values),
  }));
  state.activeReverseEndpointKeys.add(endpointKey);
}

function requireReverseEndpoint(
  program: CRCAnimationProgram,
  state: SampleState,
  endpointPath: readonly number[],
  endpointRepeatIterations: readonly number[],
  path: readonly number[],
  repeatIterations: readonly number[],
  values: ReadonlyMap<WritableSignal<unknown>, unknown>,
): number {
  const debugName = firstStepperDebugName(program);
  const repeats = repeatIterations.length === 0 ? '' :
    `, repeat iterations [${repeatIterations.join(', ')}]`;
  if (getProgramRecord(program).duration.kind === 'infinite') {
    throw new TypeError(
      `${stepperLabel(debugName)} has no finite endpoint for reversed execution at ` +
        `program path [${path.join(', ')}]${repeats}.`,
    );
  }
  const endpointKey = instanceKey(endpointPath, endpointRepeatIterations);
  const knownEndpoint = state.reverseEndpoints.get(endpointKey);
  if (knownEndpoint === undefined ||
    !programValuesEqual(program, knownEndpoint.inputValues, values)) {
    throw new TypeError(
      `${stepperLabel(debugName)} reversed occurrence requires a previously discovered ` +
        `finite endpoint for the exact activation input at program path ` +
        `[${path.join(', ')}]${repeats}.`,
    );
  }
  state.activeReverseEndpointKeys.add(endpointKey);
  return knownEndpoint.duration;
}

function sampleReversedOccurrence(
  program: CRCAnimationProgram,
  occurrenceTime: number,
  state: SampleState,
  path: readonly number[],
  repeatIterations: readonly number[],
  endpointPath: readonly number[],
  endpointRepeatIterations: readonly number[],
  values: ReadonlyMap<WritableSignal<unknown>, unknown>,
  offset: number,
): SampleResult {
  const duration = requireReverseEndpoint(
    program,
    state,
    endpointPath,
    endpointRepeatIterations,
    path,
    repeatIterations,
    values,
  );
  const replay = isolatedReplayState(state, values);
  sampleNode(
    program,
    duration - Math.min(occurrenceTime, duration),
    replay,
    path,
    repeatIterations,
    offset,
  );
  mergeReplaySample(program, replay, state, offset, duration);
  return Object.freeze({ duration, atEnd: occurrenceTime >= duration });
}

function reversedRepeatOccurrence(
  direction: 'normal' | 'reverse' | 'alternate' | 'alternate-reverse',
  iteration: number,
): boolean {
  return direction === 'reverse' ||
    direction === 'alternate-reverse' && iteration % 2 === 0 ||
    direction === 'alternate' && iteration % 2 === 1;
}

function sampleStatefulRepeatFrontier(
  program: CRCAnimationProgram,
  localTime: number,
  state: SampleState,
  path: readonly number[],
  repeatIterations: readonly number[],
  offset: number,
): SampleResult {
  const record = getProgramRecord(program);
  if (record.kind !== 'repeat') throw new Error('Expected an animation repeat record.');
  const child = record.children[0]!;
  const childPath = [...path, 0];
  const key = instanceKey(path, repeatIterations);
  if (state.reverseEndpoints.has(key)) {
    state.activeReverseEndpointKeys.add(key);
  }
  const terminal = state.repeatTerminals.get(key);
  if (terminal !== undefined && localTime >= terminal.duration) {
    stageProgramValues(program, terminal.values, state, offset, terminal.duration);
    setDuration(state, path, repeatIterations, terminal.duration);
    return Object.freeze({ duration: terminal.duration, atEnd: true });
  }

  let frontier = state.repeatFrontiers.get(key);
  if (frontier === undefined || localTime < frontier.elapsedMilliseconds) {
    const initialValues = programValues(program, state.batch);
    frontier = {
      programPath: freezePath(path),
      repeatIterations: freezePath(repeatIterations),
      completedIterations: 0,
      elapsedMilliseconds: 0,
      iterationInputValues: new Map(initialValues),
      values: new Map(initialValues),
    };
    state.repeatFrontiers.set(key, frontier);
  }
  stageProgramValues(program, frontier.values, state, offset, undefined);

  let remaining = Math.max(0, localTime - frontier.elapsedMilliseconds);
  for (let iteration = frontier.completedIterations;
    iteration < record.iterations;
    iteration++) {
    const iterationPath = [...repeatIterations, iteration];
    const reversed = reversedRepeatOccurrence(record.direction, iteration);
    const sampled = reversed ? sampleReversedOccurrence(
      child,
      remaining,
      state,
      childPath,
      iterationPath,
      path,
      repeatIterations,
      frontier.iterationInputValues,
      offset + frontier.elapsedMilliseconds,
    ) : sampleNode(
      child,
      remaining,
      state,
      childPath,
      iterationPath,
      offset + frontier.elapsedMilliseconds,
    );

    if (sampled.duration === undefined) {
      frontier.values = programValues(program, state.batch);
      state.activeRepeatFrontierKeys.add(key);
      return Object.freeze({ duration: undefined, atEnd: false });
    }
    if (sampled.duration === 0 && record.iterations === Number.POSITIVE_INFINITY) {
      throw new TypeError('An infinite repeat with zero duration cannot be evaluated seekably.');
    }
    if (!sampled.atEnd) {
      frontier.values = programValues(program, state.batch);
      state.activeRepeatFrontierKeys.add(key);
      return Object.freeze({
        duration: getExactSeekableProgramDuration(program),
        atEnd: false,
      });
    }

    frontier.values = programValues(program, state.batch);
    if (!reversed) {
      rememberForwardEndpoint(
        state,
        path,
        repeatIterations,
        frontier.iterationInputValues,
        sampled.duration,
      );
    }
    if (programContainsStepper(child)) {
      clearOccurrenceState(state, childPath, iterationPath);
    }
    frontier.completedIterations = iteration + 1;
    frontier.elapsedMilliseconds += sampled.duration;
    if (frontier.completedIterations < record.iterations) {
      queueSampledTimelineEvent(state, {
        kind: 'iteration',
        programTime: offset + frontier.elapsedMilliseconds,
        programPath: path,
        repeatIterations,
        iteration: frontier.completedIterations,
      });
    }
    if (frontier.completedIterations === record.iterations) {
      const repeatTerminal: InternalRepeatTerminal = Object.freeze({
        programPath: freezePath(path),
        repeatIterations: freezePath(repeatIterations),
        duration: frontier.elapsedMilliseconds,
        values: new Map(frontier.values),
      });
      state.repeatFrontiers.delete(key);
      state.repeatTerminals.set(key, repeatTerminal);
      setDuration(state, path, repeatIterations, repeatTerminal.duration);
      return Object.freeze({ duration: repeatTerminal.duration, atEnd: true });
    }

    remaining = Math.max(0, remaining - sampled.duration);
    frontier.iterationInputValues = new Map(frontier.values);
    stageProgramValues(
      program,
      frontier.values,
      state,
      offset + frontier.elapsedMilliseconds,
      undefined,
    );
  }
  throw new Error('CRC animation repeat frontier exceeded its declared iterations.');
}

function sampleNode(
  program: CRCAnimationProgram,
  requestedTime: number,
  state: SampleState,
  path: readonly number[],
  repeatIterations: readonly number[],
  offset = 0,
): SampleResult {
  const record = getProgramRecord(program);
  const localTime = Math.max(0, requestedTime);
  if (record.kind === 'track') {
    return sampleTrack(program, localTime, state, path, repeatIterations, offset);
  }
  if (record.kind === 'wait') {
    const duration = record.duration.kind === 'finite' ? record.duration.milliseconds : 0;
    setDuration(state, path, repeatIterations, duration);
    return Object.freeze({ duration, atEnd: localTime >= duration });
  }
  if (record.kind === 'marker') {
    queueSampledTimelineEvent(state, {
      kind: 'marker',
      marker: record.name,
      programTime: offset,
      programPath: path,
      repeatIterations,
      iteration: repeatIterations.at(-1) ?? 0,
    });
    setDuration(state, path, repeatIterations, 0);
    return Object.freeze({ duration: 0, atEnd: true });
  }
  if (record.kind === 'sequence') {
    let remaining = localTime;
    let elapsed = 0;
    for (let index = 0; index < record.children.length; index++) {
      const child = record.children[index]!;
      const childPath = [...path, index];
      const sampled = sampleNode(
        child,
        remaining,
        state,
        childPath,
        repeatIterations,
        offset + elapsed,
      );
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
    const selected = new Map<WritableSignal<unknown>, {
      readonly owner: SampledWriterOwner;
      readonly value: unknown;
    }>();
    for (let index = 0; index < record.children.length; index++) {
      const child = record.children[index]!;
      const branchState = forkSampleState(state, getProgramRecord(child).outputs);
      const sampled = sampleNode(
        child,
        localTime,
        branchState,
        [...path, index],
        repeatIterations,
        offset,
      );
      if (sampled.duration === undefined) durationKnown = false;
      else duration = Math.max(duration, sampled.duration);
      if (!sampled.atEnd) atEnd = false;
      for (const output of branchState.writtenOutputs) {
        const owner = branchState.owners.get(output)!;
        if (ownerWins(owner, selected.get(output)?.owner, offset + localTime)) {
          selected.set(output, { owner, value: branchState.batch.read(output) });
        }
      }
    }
    for (const [output, candidate] of selected) {
      state.batch.stage(output, candidate.value, baselineWriter);
      state.writtenOutputs.add(output);
      state.owners.set(output, candidate.owner);
    }
    const resolvedDuration = durationKnown ? duration : undefined;
    setDuration(state, path, repeatIterations, resolvedDuration);
    return Object.freeze({ duration: resolvedDuration, atEnd });
  }

  const directChild = record.children[0]!;
  if (programContainsStepper(directChild) && !state.replaySteppers) {
    return sampleStatefulRepeatFrontier(
      program,
      localTime,
      state,
      path,
      repeatIterations,
      offset,
    );
  }
  const directChildDuration = getExactSeekableProgramDuration(directChild);
  if (directChildDuration !== undefined && Number.isFinite(directChildDuration) &&
    (directChildDuration > 0 || record.iterations !== Number.POSITIVE_INFINITY) &&
    canDirectlySelectRepeat(directChild)) {
    const totalDuration = directChildDuration === 0 ? 0 :
      record.iterations === Number.POSITIVE_INFINITY ? Number.POSITIVE_INFINITY :
        directChildDuration * record.iterations;
    const atEnd = localTime >= totalDuration;
    if (directChildDuration === 0 && getProgramRecord(directChild).outputs.length === 0) {
      setDuration(state, path, repeatIterations, totalDuration);
      return Object.freeze({ duration: totalDuration, atEnd });
    }
    const iteration = atEnd ? Math.max(0, record.iterations - 1) :
      Math.floor(localTime / directChildDuration);
    const iterationStart = iteration * directChildDuration;
    const iterationTime = atEnd ? directChildDuration : localTime - iterationStart;
    const reversed = record.direction === 'reverse' ||
      record.direction === 'alternate-reverse' && iteration % 2 === 0 ||
      record.direction === 'alternate' && iteration % 2 === 1;
    sampleNode(
      directChild,
      reversed ? directChildDuration - iterationTime : iterationTime,
      state,
      [...path, 0],
      [...repeatIterations, iteration],
      offset + iterationStart,
    );
    setDuration(state, path, repeatIterations, totalDuration);
    return Object.freeze({ duration: totalDuration, atEnd });
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
    const reversed = reversedRepeatOccurrence(record.direction, iteration);
    const inputValues = programValues(child, state.batch);
    let duration: number;
    if (reversed && programContainsStepper(child)) {
      const sampled = sampleReversedOccurrence(
        child,
        remaining,
        state,
        childPath,
        iterationPath,
        path,
        repeatIterations,
        inputValues,
        offset + elapsed,
      );
      duration = sampled.duration!;
    } else if (reversed) {
      const exactDuration = knownDuration(child, state, childPath, iterationPath);
      if (exactDuration === undefined) {
        const terminal = sampleNode(
          child,
          Number.POSITIVE_INFINITY,
          state,
          childPath,
          iterationPath,
          offset + elapsed,
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
        offset + elapsed,
      );
    } else {
      const sampled = sampleNode(
        child,
        remaining,
        state,
        childPath,
        iterationPath,
        offset + elapsed,
      );
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
    if (programContainsStepper(child)) {
      if (!reversed) {
        rememberForwardEndpoint(
          state,
          path,
          repeatIterations,
          inputValues,
          duration,
        );
      }
      clearOccurrenceState(state, childPath, iterationPath);
    }
    if (iteration + 1 < record.iterations) {
      queueSampledTimelineEvent(state, {
        kind: 'iteration',
        programTime: offset + elapsed,
        programPath: path,
        repeatIterations,
        iteration: iteration + 1,
      });
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
      repeatIterations: freezePath(repeatIterations),
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
    if (duration === 0 && !programContainsStepper(child)) {
      const childRecord = getProgramRecord(child);
      const label = childRecord.kind === 'marker' ?
        `marker "${childRecord.name}"` : `${childRecord.kind} program`;
      reserveZeroDurationOccurrence(state, label, childPath, iterationPath);
    }
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
        repeatIterations: freezePath(repeatIterations),
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
  steppers: Map<string, InternalStepperRecord> = new Map(record.steppers),
  terminalSteppers: Map<string, InternalStepperTerminal> =
    new Map(record.terminalSteppers),
  repeatFrontiers: Map<string, InternalRepeatFrontier> =
    new Map(record.repeatFrontiers),
  repeatTerminals: Map<string, InternalRepeatTerminal> =
    new Map(record.repeatTerminals),
  reverseEndpoints: Map<string, InternalReverseEndpoint> =
    new Map(record.reverseEndpoints),
  frameId = 0,
  replaySteppers = false,
  zeroDurationOccurrences: InternalZeroDurationOccurrenceBudget = { value: 0 },
): SampleState {
  return {
    activation: record,
    batch: seedOriginalValues(record),
    starts,
    durations,
    writtenOutputs: new Set(),
    snapshots: new WeakMap(),
    owners: new Map(),
    steppers,
    terminalSteppers,
    repeatFrontiers,
    repeatTerminals,
    reverseEndpoints,
    stepperFrameBudgets: new Map(),
    zeroDurationOccurrences,
    sampledTimelineEvents: [],
    nextTimelineSourceOrder: { value: 0 },
    activeStepperKeys: new Set(),
    activeRepeatFrontierKeys: new Set(),
    activeReverseEndpointKeys: new Set(),
    stepperTraces: [],
    frameId,
    replaySteppers,
  };
}

function cloneRepeatFrontiers(
  source: ReadonlyMap<string, InternalRepeatFrontier>,
): Map<string, InternalRepeatFrontier> {
  return new Map([...source].map(([key, frontier]) => [key, {
    programPath: frontier.programPath,
    repeatIterations: frontier.repeatIterations,
    completedIterations: frontier.completedIterations,
    elapsedMilliseconds: frontier.elapsedMilliseconds,
    iterationInputValues: new Map(frontier.iterationInputValues),
    values: new Map(frontier.values),
  }]));
}

function cloneStepperRecords(
  source: ReadonlyMap<string, InternalStepperRecord>,
): Map<string, InternalStepperRecord> {
  return new Map([...source].map(([key, stepperRecord]) => [key, {
    ...stepperRecord,
    // A stepper's opaque state belongs to its callbacks. CRC can transact its
    // own mutable counters, but cannot clone arbitrary class/closure state
    // without changing user-observable identity or semantics.
    state: stepperRecord.state,
  }]));
}

function cloneRepeatTerminals(
  source: ReadonlyMap<string, InternalRepeatTerminal>,
): Map<string, InternalRepeatTerminal> {
  return new Map([...source].map(([key, terminal]) => [key, Object.freeze({
    ...terminal,
    values: new Map(terminal.values),
  })]));
}

function cloneReverseEndpoints(
  source: ReadonlyMap<string, InternalReverseEndpoint>,
): Map<string, InternalReverseEndpoint> {
  return new Map([...source].map(([key, endpoint]) => [key, Object.freeze({
    ...endpoint,
    inputValues: new Map(endpoint.inputValues),
  })]));
}

function cloneProgramActivationRecord(
  source: InternalProgramActivation,
): InternalProgramActivation {
  return {
    program: source.program,
    registration: source.registration,
    originalValues: source.originalValues,
    starts: new Map(source.starts),
    steppers: cloneStepperRecords(source.steppers),
    terminalSteppers: new Map(source.terminalSteppers),
    repeatFrontiers: cloneRepeatFrontiers(source.repeatFrontiers),
    repeatTerminals: cloneRepeatTerminals(source.repeatTerminals),
    reverseEndpoints: cloneReverseEndpoints(source.reverseEndpoints),
    terminalDuration: source.terminalDuration,
  };
}

function createDiscoveryState(
  originalValues: ReadonlyMap<WritableSignal<unknown>, unknown>,
  starts: Map<string, InternalTrackStart>,
  validateWriters: boolean,
  terminalSteppers: ReadonlyMap<string, InternalStepperTerminal> = new Map(),
  validateInputs = false,
): DiscoveryState {
  return {
    values: new Map(originalValues),
    starts,
    durations: new Map(),
    snapshots: new WeakMap(),
    validateWriters,
    validateInputs,
    terminalSteppers,
  };
}

function crossedMilestones(
  record: InternalProgramActivation,
  input: ProgramEvaluationInput,
  horizon: number,
  state: SampleState,
  sampledEvents: readonly TimelineEvent[],
): readonly ProgramMilestone[] {
  if (input.previousTime === input.time) return Object.freeze([]);
  const timeline: TimelineEvent[] = [...sampledEvents];
  collectTimeline(
    record.program,
    horizon,
    state,
    [],
    [],
    Object.freeze({ origin: 0, scale: 1 }),
    timeline,
    { value: state.nextTimelineSourceOrder.value },
  );
  const uniqueTimeline = timeline.filter((event, index) =>
    timeline.findIndex(candidate =>
      candidate.kind === event.kind &&
      candidate.marker === event.marker &&
      candidate.programTime === event.programTime &&
      candidate.iteration === event.iteration &&
      candidate.repeatIterations.length === event.repeatIterations.length &&
      candidate.repeatIterations.every(
        (part, pathIndex) => part === event.repeatIterations[pathIndex],
      ) &&
      candidate.programPath.length === event.programPath.length &&
      candidate.programPath.every(
        (part, pathIndex) => part === event.programPath[pathIndex],
      ),
    ) === index,
  );
  const crossed = uniqueTimeline.filter(event => {
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
  if (rebuildStarts && input.direction === 'reverse' && previousTime === undefined &&
    knownProgramTerminalDuration(record) === undefined) {
    throw new TypeError(
      'CRC animation stateful terminal time is not discovered; reverse-from-idle is unavailable.',
    );
  }
  const normalizedInput = { ...input, time, previousTime };
  const horizon = Math.max(time, previousTime ?? time);
  const replaySteppers = rebuildStarts || input.direction === 'reverse' ||
    previousTime !== undefined && time < previousTime;
  const destinationStarts = rebuildStarts ? new Map<string, InternalTrackStart>() :
    new Map(record.starts);
  const destinationSteppers = replaySteppers ? new Map<string, InternalStepperRecord>() :
    new Map(record.steppers);
  const destinationTerminals = new Map(record.terminalSteppers);
  const destinationRepeatFrontiers = replaySteppers ?
    new Map<string, InternalRepeatFrontier>() : cloneRepeatFrontiers(record.repeatFrontiers);
  const destinationRepeatTerminals = replaySteppers ?
    new Map<string, InternalRepeatTerminal>() : new Map(record.repeatTerminals);
  const destinationReverseEndpoints = replaySteppers ?
    new Map<string, InternalReverseEndpoint>() : new Map(record.reverseEndpoints);
  const zeroDurationOccurrences = { value: 0 };
  let seededDurations = new Map<string, number>();
  if (needsCallbackFreeDurationSeed(record.program)) {
    const seedState = createDiscoveryState(
      record.originalValues,
      new Map(destinationStarts),
      false,
      destinationTerminals,
    );
    discoverNode(record.program, time, seedState, [], []);
    seededDurations = seedState.durations;
  }
  const destinationState = createSampleState(
    record,
    destinationStarts,
    seededDurations,
    destinationSteppers,
    destinationTerminals,
    destinationRepeatFrontiers,
    destinationRepeatTerminals,
    destinationReverseEndpoints,
    input.frameId,
    replaySteppers,
    zeroDurationOccurrences,
  );
  try {
    const destinationResult = sampleNode(record.program, time, destinationState, [], []);
    const exactDuration = getExactSeekableProgramDuration(record.program);
    let discoveredDuration = exactDuration;
    let milestoneState = destinationState;
    let milestoneEvents: readonly TimelineEvent[] = destinationState.sampledTimelineEvents;
    const needsReverseHorizonReplay = input.direction === 'reverse' &&
      horizon > time && programContainsStepper(record.program);
    if (needsReverseHorizonReplay) {
      const horizonState = createSampleState(
        record,
        new Map(),
        new Map(),
        new Map(),
        new Map(),
        new Map(),
        new Map(),
        new Map(record.reverseEndpoints),
        input.frameId,
        true,
        zeroDurationOccurrences,
      );
      sampleNode(record.program, horizon, horizonState, [], []);
      milestoneState = horizonState;
      milestoneEvents = horizonState.sampledTimelineEvents;
    }
    if (exactDuration === undefined) {
      const discoveryState = createDiscoveryState(
        record.originalValues,
        new Map(destinationState.starts),
        false,
        destinationState.terminalSteppers,
      );
      const discoveryResult = discoverNode(
        record.program,
        horizon,
        discoveryState,
        [],
        [],
      );
      discoveredDuration = discoveryResult.duration;
      if (!needsReverseHorizonReplay) {
        milestoneState = createSampleState(
          record,
          discoveryState.starts,
          discoveryState.durations,
          new Map(),
          destinationState.terminalSteppers,
          new Map(),
          new Map(),
          new Map(),
          0,
          false,
          zeroDurationOccurrences,
        );
      }
    }
    const milestones = crossedMilestones(
      record,
      normalizedInput,
      horizon,
      milestoneState,
      milestoneEvents,
    );
    for (const key of destinationState.steppers.keys()) {
      if (!destinationState.activeStepperKeys.has(key)) {
        destinationState.steppers.delete(key);
      }
    }
    for (const key of destinationState.repeatFrontiers.keys()) {
      if (!destinationState.activeRepeatFrontierKeys.has(key)) {
        destinationState.repeatFrontiers.delete(key);
      }
    }
    for (const key of destinationState.reverseEndpoints.keys()) {
      if (!destinationState.activeReverseEndpointKeys.has(key)) {
        destinationState.reverseEndpoints.delete(key);
      }
    }
    if (destinationResult.atEnd) {
      destinationState.steppers.clear();
      destinationState.terminalSteppers.clear();
      destinationState.repeatFrontiers.clear();
      destinationState.repeatTerminals.clear();
      destinationState.reverseEndpoints.clear();
    }
    record.starts = destinationState.starts;
    record.steppers = destinationState.steppers;
    record.terminalSteppers = destinationState.terminalSteppers;
    record.repeatFrontiers = destinationState.repeatFrontiers;
    record.repeatTerminals = destinationState.repeatTerminals;
    record.reverseEndpoints = destinationState.reverseEndpoints;
    for (const output of getProgramRecord(record.program).outputs) {
      if (destinationState.writtenOutputs.has(output)) {
        input.batch.stage(output, destinationState.batch.read(output), input.writer);
      }
    }

    const atStart = time === 0;
    const atEnd = destinationResult.atEnd;
    const duration = discoveredDuration ?? destinationResult.duration;
    if (duration !== undefined && Number.isFinite(duration)) {
      record.terminalDuration = duration;
    }
    return Object.freeze({
      batch: input.batch,
      milestones,
      steppers: Object.freeze([...destinationState.stepperTraces]),
      terminal: Object.freeze({
        duration,
        atStart,
        atEnd,
        reached: input.direction === 'forward' ? atEnd : atStart,
      }),
    });
  } catch (error) {
    if (programContainsStepper(record.program)) {
      record.steppers.clear();
      record.terminalSteppers.clear();
      record.repeatFrontiers.clear();
      record.repeatTerminals.clear();
      record.reverseEndpoints.clear();
      record.terminalDuration = undefined;
    }
    throw error;
  }
}

/** Captures one program token, its committed outputs, and registration identity. */
export function activateProgram(
  program: CRCAnimationProgram,
  registration: object,
): ProgramActivation {
  if (typeof registration !== 'object' || registration === null) {
    throw new TypeError('CRC animation registration identity must be an object.');
  }
  const originalValues = captureProgramOriginalValues(program, false);
  const activation = Object.freeze({}) as ProgramActivation;
  activationRecords.set(activation, {
    program,
    registration,
    originalValues,
    starts: new Map(),
    steppers: new Map(),
    terminalSteppers: new Map(),
    repeatFrontiers: new Map(),
    repeatTerminals: new Map(),
    reverseEndpoints: new Map(),
    terminalDuration: undefined,
  });
  registerActivationStepperKeys(activation, []);
  return activation;
}

/** @internal Forks engine-owned activation state for an outer transaction. */
export function forkProgramActivation(
  activation: ProgramActivation,
): ProgramActivation {
  const fork = Object.freeze({}) as ProgramActivation;
  const record = cloneProgramActivationRecord(activationRecord(activation));
  activationRecords.set(fork, record);
  registerActivationStepperKeys(fork, record.steppers.keys());
  return fork;
}

/** @internal Publishes one successfully committed activation fork and consumes it. */
export function adoptProgramActivationFork(
  activation: ProgramActivation,
  fork: ProgramActivation,
): void {
  const target = activationRecord(activation);
  const source = activationRecord(fork);
  if (source.program !== target.program || source.registration !== target.registration ||
    source.originalValues !== target.originalValues) {
      throw new TypeError('CRC animation activation fork does not belong to this activation.');
  }
  reconcileActivationStepperKeys(activation);
  reconcileActivationStepperKeys(fork);
  releaseActivationStepperKeys(activation);
  const forkKeys = activationStepperKeys.get(fork) ?? new Set<string>();
  activationStepperKeys.delete(fork);
  activationStepperKeys.set(activation, forkKeys);
  target.starts = source.starts;
  target.steppers = source.steppers;
  target.terminalSteppers = source.terminalSteppers;
  target.repeatFrontiers = source.repeatFrontiers;
  target.repeatTerminals = source.repeatTerminals;
  target.reverseEndpoints = source.reverseEndpoints;
  target.terminalDuration = source.terminalDuration;
  activationRecords.delete(fork);
}

function captureProgramOriginalValues(
  program: CRCAnimationProgram,
  validateInputs: boolean,
): ReadonlyMap<WritableSignal<unknown>, unknown> {
  const programRecord = getProgramRecord(program);
  const snapshots = new WeakMap<object, unknown>();
  const originalValues = new Map<WritableSignal<unknown>, unknown>();
  for (const output of programRecord.outputs) {
    originalValues.set(
      output,
      snapshotAnimationActivationValue(getSignalNode(output).value, snapshots),
    );
  }
  if (validateInputs) validateCapturedDefinitionInputs(program, originalValues);
  validateActivationWriterSafety(program, originalValues);
  return immutableMap(originalValues);
}

function validateCapturedDefinitionInputs(
  program: CRCAnimationProgram,
  originalValues: ReadonlyMap<WritableSignal<unknown>, unknown>,
): void {
  if (!requiresCapturedDefinitionInput(program)) return;
  const state = createDiscoveryState(
    originalValues,
    new Map(),
    false,
    new Map(),
    true,
  );
  discoverNode(program, Number.POSITIVE_INFINITY, state, [], []);
}

function requiresCapturedDefinitionInput(program: CRCAnimationProgram): boolean {
  const record = getProgramRecord(program);
  if (record.kind === 'track') {
    const definition = getDefinitionRecord(record.definition);
    return definition.kind === 'spring' && !definition.hasFrom ||
      definition.kind === 'tween' && !definition.hasFrom;
  }
  return record.children.some(requiresCapturedDefinitionInput);
}

/** @internal Validates one current committed activation snapshot without retaining it. */
export function preflightProgramActivation(program: CRCAnimationProgram): void {
  captureProgramOriginalValues(program, true);
}

/** Evaluates one ordinary advance without committing staged output values. */
export function evaluateProgram(
  activation: ProgramActivation,
  input: ProgramEvaluationInput,
): ProgramEvaluationResult {
  try {
    return evaluate(activation, input, false);
  } finally {
    reconcileActivationStepperKeys(activation);
  }
}

/** Rebuilds activation starts from the original run snapshot before sampling. */
export function seekProgram(
  activation: ProgramActivation,
  input: ProgramEvaluationInput,
): ProgramEvaluationResult {
  try {
    return evaluate(activation, input, true);
  } finally {
    reconcileActivationStepperKeys(activation);
  }
}

export interface ProgramFinishInput {
  readonly previousTime: number | undefined;
  readonly frameId: number;
  readonly writer: object;
  readonly batch: SignalCommitBatch;
}

/** Replays a finite program to its exact known terminal state. */
export function finishProgram(
  activation: ProgramActivation,
  input: ProgramFinishInput,
): ProgramEvaluationResult {
  const record = activationRecord(activation);
  const duration = knownProgramTerminalDuration(record);
  if (duration === undefined) {
    throw new TypeError(
      'CRC animation stateful terminal time is not discovered; finish is unavailable.',
    );
  }
  try {
    return evaluate(activation, {
      ...input,
      time: duration,
      direction: 'forward',
    }, true);
  } finally {
    reconcileActivationStepperKeys(activation);
  }
}

/** Releases every resource retained by one activated program run. */
export function releaseProgramActivation(activation: ProgramActivation): void {
  const record = activationRecord(activation);
  reconcileActivationStepperKeys(activation);
  releaseActivationStepperKeys(activation);
  record.starts.clear();
  record.steppers.clear();
  record.terminalSteppers.clear();
  record.repeatFrontiers.clear();
  record.repeatTerminals.clear();
  record.reverseEndpoints.clear();
  activationRecords.delete(activation);
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
    activeSteppers: Object.freeze([...record.steppers.values()].map(stepperRecord =>
      Object.freeze({
        programPath: freezePath(stepperRecord.programPath),
        repeatIterations: freezePath(stepperRecord.repeatIterations),
        wholeSteps: stepperRecord.wholeSteps,
        retainedRemainderMilliseconds: stepperRecord.remainderMilliseconds,
        appliedElapsedMilliseconds: stepperRecord.appliedElapsedMilliseconds,
        discardedElapsedMilliseconds: stepperRecord.discardedElapsedMilliseconds,
      }),
    )),
    terminalSteppers: Object.freeze([...record.terminalSteppers.values()].map(terminal =>
      Object.freeze({
        programPath: freezePath(terminal.programPath),
        repeatIterations: freezePath(terminal.repeatIterations),
        terminalStep: terminal.terminalStep,
        terminalTime: terminal.terminalTime,
      }),
    )),
    terminalDuration: record.terminalDuration,
  });
}
