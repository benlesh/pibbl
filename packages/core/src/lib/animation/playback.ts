import {
  getSignalNode,
  signal,
  type SignalCommitBatch,
} from '../signals/graph.js';
import type { WritableSignal } from '../signals/types.js';
import {
  queueBeginCommand,
  queueCurrentFrameCommitAcknowledgement,
  queueCurrentFrameCompletion,
  queueCurrentFrameOrderedPlaybackCompletion,
  recordSchedulerTrace,
  registerAdvanceParticipant,
  snapshotRealmScheduler,
} from '../scheduler/realm-scheduler.js';
import type {
  CRCBeginCommandHandle,
  CRCFrameSnapshot,
} from '../scheduler/types.js';
import { getDefinitionRecord } from './definition.js';
import { sampleSpring, type SpringSample } from './spring.js';
import {
  adoptProgramActivationFork,
  evaluateProgram,
  finishProgram,
  forkProgramActivation,
  getProgramActivationRecord,
  preflightProgramActivation,
  releaseProgramActivation,
  seekProgram,
  type ProgramActivation,
  type ProgramEvaluationResult,
} from './evaluate.js';
import { getProgramRecord, type ProgramDuration } from './program.js';
import type {
  CRCAnimationProgram,
  CRCPlayback,
  CRCPlaybackEvent,
  CRCPlaybackOptions,
  CRCPlaybackStatus,
} from './types.js';
import {
  acquireTransactionalProgramWriterLeases,
  preflightProgramWriterLeaseAcquisition,
  type AnimationWriterLeaseReplacement,
  type TransactionalProgramWriterLease,
} from './writer-leases.js';

type PlaybackCommandName =
  | 'play'
  | 'pause'
  | 'resume'
  | 'cancel'
  | 'finish'
  | 'seek'
  | 'reverse'
  | 'setPlaybackRate';

type PendingEvaluation =
  | {
      readonly kind: 'seek';
      readonly time: number;
      readonly direction?: 'forward' | 'reverse';
    }
  | { readonly kind: 'finish' };

interface PlaybackRun {
  readonly generation: number;
  readonly registration: object;
  readonly registrationOrder: number;
  readonly token: object;
  readonly lease: TransactionalProgramWriterLease;
  readonly activation: ProgramActivation;
  readonly program: CRCAnimationProgram;
  direction: 'forward' | 'reverse';
  playbackRate: number;
  position: number;
  anchorPosition: number;
  anchorLogicalTime: number;
  previousTime: number | undefined;
  status: 'running' | 'paused' | 'ending';
  pendingEvaluation: PendingEvaluation | undefined;
  unregisterAdvance: (() => void) | undefined;
  released: boolean;
  startPending: boolean;
  startQueuedFrameId: number | undefined;
}

interface PendingTraceWrite {
  readonly signal: WritableSignal<unknown>;
  readonly version: number;
  readonly target: string;
}

interface FrameDelivery {
  readonly frameId: number;
  readonly logicalTime: number;
  readonly events: Array<{
    readonly event: CRCPlaybackEvent;
    readonly registrationOrder: number;
  }>;
  readonly errors: Array<{
    readonly error: unknown;
    readonly registrationOrder: number;
    readonly commitRequired: boolean;
  }>;
  readonly terminalRuns: Set<PlaybackRun>;
  readonly writes: PendingTraceWrite[];
  commitApplied: boolean;
}

export interface AnimationPlaybackSnapshot {
  readonly activePlaybacks: number;
  readonly createdPlaybacks: number;
  readonly releasedPlaybacks: number;
  readonly queuedCommands: number;
  readonly queuedMilestones: number;
  readonly outputStageAttempts: number;
}

export interface AnimationPlaybackController {
  readonly handle: CRCPlayback;
  adopt(program: CRCAnimationProgram, options?: CRCPlaybackOptions): void;
  committedSpringSnapshot(): SpringSample | undefined;
  retarget(program: CRCAnimationProgram, options?: CRCPlaybackOptions): void;
  dispose(): void;
}

export interface AnimationPlaybackCandidate {
  readonly program: CRCAnimationProgram;
  readonly options: CRCPlaybackOptions;
}

let nextPlaybackRegistrationOrder = 0;
let activePlaybacks = 0;
let createdPlaybacks = 0;
let releasedPlaybacks = 0;
let queuedCommands = 0;
let queuedMilestones = 0;
let outputStageAttempts = 0;
let activePlaybackBeginContext: {
  readonly snapshot: CRCFrameSnapshot;
  readonly batch: SignalCommitBatch;
} | undefined;

/** @internal Deterministic resource counters for tests and diagnostics. */
export function animationPlaybackSnapshot(): AnimationPlaybackSnapshot {
  return Object.freeze({
    activePlaybacks,
    createdPlaybacks,
    releasedPlaybacks,
    queuedCommands,
    queuedMilestones,
    outputStageAttempts,
  });
}

function freezePath(path: readonly number[]): readonly number[] {
  return Object.freeze([...path]);
}

function playbackEvent(
  type: CRCPlaybackEvent['type'],
  snapshot: CRCFrameSnapshot,
  programPath: readonly number[] = [],
  iteration = 0,
  marker?: string,
): CRCPlaybackEvent {
  return Object.freeze({
    type,
    logicalTime: snapshot.logicalTime,
    frameId: snapshot.frameId,
    programPath: freezePath(programPath),
    iteration,
    ...(marker === undefined ? {} : { marker }),
  });
}

function validateOptions(options: CRCPlaybackOptions): void {
  if (options.conflict !== undefined &&
    options.conflict !== 'error' && options.conflict !== 'replace') {
    throw new TypeError('CRC animation playback conflict must be "error" or "replace".');
  }
  if (options.debugName !== undefined &&
    (typeof options.debugName !== 'string' || options.debugName.length === 0)) {
    throw new TypeError('CRC animation playback debugName must be nonempty when provided.');
  }
  if (options.onEvent !== undefined && typeof options.onEvent !== 'function') {
    throw new TypeError('CRC animation playback onEvent must be a function.');
  }
  if (options.onError !== undefined && typeof options.onError !== 'function') {
    throw new TypeError('CRC animation playback onError must be a function.');
  }
}

/** @internal Creates one validated immutable render-time playback candidate. */
export function normalizeAnimationPlaybackCandidate(
  program: CRCAnimationProgram,
  options: CRCPlaybackOptions = {},
): AnimationPlaybackCandidate {
  getProgramRecord(program);
  const normalizedOptions = Object.freeze({ ...options });
  validateOptions(normalizedOptions);
  return Object.freeze({ program, options: normalizedOptions });
}

function firstStepperName(program: CRCAnimationProgram): string | undefined {
  const record = getProgramRecord(program);
  if (record.kind === 'track') {
    const definition = getDefinitionRecord(record.definition);
    return definition.kind === 'stepper' ? definition.debugName : undefined;
  }
  for (const child of record.children) {
    const name = firstStepperName(child);
    if (name !== undefined) return name;
  }
  return undefined;
}

function unavailableControlError(
  program: CRCAnimationProgram,
  control: 'reverse' | 'finish',
): Error | undefined {
  const duration = getProgramRecord(program).duration;
  if (duration.kind === 'infinite') {
    return new TypeError(
      `CRC animation program is infinite; ${control} is unavailable.`,
    );
  }
  if (duration.kind === 'unresolved-stepper') {
    const name = firstStepperName(program);
    const label = name === undefined ? 'CRC animation stateful program' :
      `CRC animation stepper "${name}"`;
    return new TypeError(
      `${label} terminal time is not discovered; ${control} is unavailable.`,
    );
  }
  return undefined;
}

function finiteDuration(duration: ProgramDuration): number | undefined {
  return duration.kind === 'finite' ? duration.milliseconds : undefined;
}

/**
 * Creates one scheduler-owned playback slot. Component lifetime is added by
 * usePlayback in the following implementation task.
 */
export function createAnimationPlaybackController(
  initialProgram: CRCAnimationProgram,
  initialOptions: CRCPlaybackOptions = {},
): AnimationPlaybackController {
  const initialCandidate = normalizeAnimationPlaybackCandidate(
    initialProgram,
    initialOptions,
  );

  let program = initialCandidate.program;
  let options = initialCandidate.options;
  let disposed = false;
  let queuedGeneration = 0;
  let run: PlaybackRun | undefined;
  let storedPlaybackRate = 1;
  let delivery: FrameDelivery | undefined;
  let pendingRetarget: CRCBeginCommandHandle | undefined;
  const pendingCommands = new Set<CRCBeginCommandHandle>();
  const metadataWriter = Object.freeze({ name: 'CRC playback metadata' });
  const status = signal<CRCPlaybackStatus>('idle', {
    debugName: options.debugName === undefined ? undefined : `${options.debugName} status`,
  });
  const currentTime = signal(0, {
    debugName: options.debugName === undefined ? undefined : `${options.debugName} current time`,
  });

  function debugName(): string | undefined {
    return options.debugName;
  }

  function ensureDelivery(snapshot: CRCFrameSnapshot): FrameDelivery {
    if (delivery?.frameId === snapshot.frameId) return delivery;
    const current: FrameDelivery = {
      frameId: snapshot.frameId,
      logicalTime: snapshot.logicalTime,
      events: [],
      errors: [],
      terminalRuns: new Set(),
      writes: [],
      commitApplied: false,
    };
    delivery = current;
    queueCurrentFrameCommitAcknowledgement((_snapshot, outcome) => {
      current.commitApplied = outcome.applied;
    });
    queueCurrentFrameCompletion(() => {
      if (delivery === current) delivery = undefined;
      if (!current.commitApplied) {
        queuedMilestones -= current.events.length;
      } else {
        for (const terminalRun of current.terminalRuns) releaseRun(terminalRun);

        for (const write of current.writes) {
          const node = getSignalNode(write.signal);
          recordSchedulerTrace({
            kind: 'animation-write',
            frameId: current.frameId,
            logicalTime: current.logicalTime,
            debugName: debugName(),
            target: write.target,
            outcome: node.version === write.version ?
              'equality-suppressed' : 'staged',
          });
        }

        for (const { event, registrationOrder } of current.events) {
          queueCurrentFrameOrderedPlaybackCompletion(registrationOrder, () => {
            queuedMilestones--;
            if (!disposed) options.onEvent?.(event);
          });
        }
      }
      for (const { error, registrationOrder, commitRequired } of current.errors) {
        if (commitRequired && !current.commitApplied) continue;
        queueCurrentFrameOrderedPlaybackCompletion(registrationOrder, () => {
          if (disposed) return;
          if (options.onError) options.onError(error);
          else throw error;
        });
      }
    });
    return current;
  }

  function queueEvent(
    snapshot: CRCFrameSnapshot,
    event: CRCPlaybackEvent,
    registrationOrder: number,
  ): void {
    const frame = ensureDelivery(snapshot);
    frame.events.push({ event, registrationOrder });
    queuedMilestones++;
    recordSchedulerTrace({
      kind: 'animation-milestone',
      frameId: snapshot.frameId,
      logicalTime: snapshot.logicalTime,
      debugName: debugName(),
      event: event.type,
      programPath: event.programPath,
      iteration: event.iteration,
    });
  }

  function queueError(
    snapshot: CRCFrameSnapshot,
    error: unknown,
    registrationOrder: number,
    trace = true,
    commitRequired = true,
  ): void {
    ensureDelivery(snapshot).errors.push({ error, registrationOrder, commitRequired });
    if (trace) {
      recordSchedulerTrace({
        kind: 'animation-error',
        frameId: snapshot.frameId,
        logicalTime: snapshot.logicalTime,
        debugName: debugName(),
        error,
      });
    }
  }

  function queueDiagnosticError(
    snapshot: CRCFrameSnapshot,
    error: unknown,
    registrationOrder: number,
  ): void {
    queueError(snapshot, error, registrationOrder, true, false);
  }

  function queuePendingStart(target: PlaybackRun, snapshot: CRCFrameSnapshot): void {
    if (!target.startPending || target.startQueuedFrameId === snapshot.frameId) return;
    target.startQueuedFrameId = snapshot.frameId;
    queueEvent(snapshot, playbackEvent('start', snapshot), target.registrationOrder);
    queueCurrentFrameCommitAcknowledgement((_committedSnapshot, outcome) => {
      if (outcome.applied && !target.released) target.startPending = false;
    });
  }

  function stage<T>(
    batch: SignalCommitBatch,
    snapshot: CRCFrameSnapshot,
    target: WritableSignal<T>,
    value: T,
    label: string,
  ): void {
    const node = getSignalNode(target);
    ensureDelivery(snapshot).writes.push({
      signal: target as WritableSignal<unknown>,
      version: node.version,
      target: label,
    });
    batch.stage(target, value, metadataWriter);
  }

  function stageStatus(
    batch: SignalCommitBatch,
    snapshot: CRCFrameSnapshot,
    value: CRCPlaybackStatus,
  ): void {
    stage(batch, snapshot, status, value, 'status');
  }

  function stageCurrentTime(
    batch: SignalCommitBatch,
    snapshot: CRCFrameSnapshot,
    value: number,
  ): void {
    stage(batch, snapshot, currentTime, value, 'currentTime');
  }

  function releaseRun(target: PlaybackRun): void {
    if (target.released) return;
    target.released = true;
    target.unregisterAdvance?.();
    target.unregisterAdvance = undefined;
    target.lease.release();
    releaseProgramActivation(target.activation);
    activePlaybacks--;
    releasedPlaybacks++;
    if (run === target) run = undefined;
  }

  function scheduleTerminal(snapshot: CRCFrameSnapshot, target: PlaybackRun): void {
    ensureDelivery(snapshot).terminalRuns.add(target);
  }

  function cancelRun(
    target: PlaybackRun,
    snapshot: CRCFrameSnapshot,
    batch: SignalCommitBatch,
    releaseImmediately = false,
  ): void {
    if (target.status === 'ending') return;
    queuePendingStart(target, snapshot);
    const previousStatus = target.status;
    target.status = 'ending';
    stageStatus(batch, snapshot, 'cancelled');
    queueEvent(snapshot, playbackEvent('cancel', snapshot), target.registrationOrder);
    if (releaseImmediately) {
      target.unregisterAdvance?.();
      target.unregisterAdvance = undefined;
      scheduleTerminal(snapshot, target);
      releaseRun(target);
      return;
    }
    queueCurrentFrameCommitAcknowledgement((_committedSnapshot, outcome) => {
      if (disposed || run !== target || target.released) return;
      if (!outcome.applied) {
        target.status = previousStatus;
        enqueue('cancel', target.generation);
        return;
      }
      target.unregisterAdvance?.();
      target.unregisterAdvance = undefined;
      scheduleTerminal(snapshot, target);
    });
  }

  function beginRunReplacement(
    target: PlaybackRun,
    snapshot: CRCFrameSnapshot,
    batch: SignalCommitBatch,
  ): AnimationWriterLeaseReplacement {
    if (target.status === 'ending' || target.released) {
      throw new Error('CRC animation playback run is already ending.');
    }
    const previousStatus = target.status;
    const previousStartPending = target.startPending;
    const wasRegistered = target.unregisterAdvance !== undefined;
    queuePendingStart(target, snapshot);
    target.status = 'ending';
    target.unregisterAdvance?.();
    target.unregisterAdvance = undefined;
    stageStatus(batch, snapshot, 'cancelled');
    queueEvent(snapshot, playbackEvent('cancel', snapshot), target.registrationOrder);
    let pending = true;
    return Object.freeze({
      commit(): void {
        if (!pending) return;
        pending = false;
        scheduleTerminal(snapshot, target);
      },
      rollback(): void {
        if (!pending) return;
        pending = false;
        if (target.released) return;
        if (disposed) {
          releaseRun(target);
          return;
        }
        target.status = previousStatus;
        target.startPending = previousStartPending;
        if (wasRegistered) registerRun(target);
      },
    });
  }

  function queueEvaluationTraces(
    target: PlaybackRun,
    snapshot: CRCFrameSnapshot,
    result: ProgramEvaluationResult,
    stagedOutputs: ReadonlySet<WritableSignal<unknown>>,
    sampledTime: number,
  ): void {
    recordSchedulerTrace({
      kind: 'animation-sample',
      frameId: snapshot.frameId,
      logicalTime: snapshot.logicalTime,
      registrationOrder: target.registrationOrder,
      debugName: debugName(),
      localTime: sampledTime,
      direction: target.direction,
    });
    for (const output of stagedOutputs) {
      ensureDelivery(snapshot).writes.push({
        signal: output,
        version: getSignalNode(output).version,
        target: getSignalNode(output).debugName ?? '<unnamed signal>',
      });
    }
    for (const trace of result.steppers) {
      recordSchedulerTrace({
        kind: 'animation-stepper',
        frameId: snapshot.frameId,
        logicalTime: snapshot.logicalTime,
        debugName: debugName(),
        programPath: trace.programPath,
        repeatIterations: trace.repeatIterations,
        appliedSteps: trace.appliedSteps,
        retainedRemainderMilliseconds: trace.retainedRemainderMilliseconds,
        clampedElapsedMilliseconds: trace.clampedElapsedMilliseconds,
        discardedElapsedMilliseconds: trace.discardedElapsedMilliseconds,
      });
    }
  }

  function queueEvaluationMilestones(
    target: PlaybackRun,
    snapshot: CRCFrameSnapshot,
    result: ProgramEvaluationResult,
  ): void {
    for (const milestone of result.milestones) {
      queueEvent(snapshot, playbackEvent(
        milestone.kind,
        snapshot,
        milestone.programPath,
        milestone.iteration,
        milestone.kind === 'marker' ? milestone.marker : undefined,
      ), target.registrationOrder);
    }
  }

  function clampRunTime(target: PlaybackRun, candidate: number): number {
    const record = getProgramActivationRecord(target.activation);
    const knownDuration = record.terminalDuration ??
      finiteDuration(getProgramRecord(target.program).duration);
    return Math.max(0, knownDuration === undefined ? candidate :
      Math.min(candidate, knownDuration));
  }

  function registerRun(target: PlaybackRun): void {
    if (target.unregisterAdvance !== undefined || target.released) return;
    target.unregisterAdvance = registerAdvanceParticipant((snapshot, batch) => {
      if (disposed || run !== target || target.released || target.status === 'ending') return;
      advanceRun(target, snapshot, batch);
    }, 'animation');
  }

  function advanceRun(
    target: PlaybackRun,
    snapshot: CRCFrameSnapshot,
    batch: SignalCommitBatch,
  ): void {
    queuePendingStart(target, snapshot);
    const evaluationActivation = forkProgramActivation(target.activation);
    const stagedOutputs = new Set<WritableSignal<unknown>>();
    const evaluationBatch: SignalCommitBatch = {
      read<T>(value: WritableSignal<T>): T {
        return batch.read(value);
      },
      stage<T>(value: WritableSignal<T>, nextValue: T, writer: object): void {
        batch.stage(value, nextValue, writer);
        if (writer === target.token) {
          outputStageAttempts++;
          stagedOutputs.add(value as WritableSignal<unknown>);
        }
      },
      discardWriter(writer: object): void {
        batch.discardWriter(writer);
      },
      commit(): void {
        batch.commit();
      },
      clear(): void {
        batch.clear();
      },
    };
    const pending = target.pendingEvaluation;
    let destination = pending?.kind === 'seek' ? pending.time :
      target.anchorPosition +
        (target.direction === 'forward' ? 1 : -1) *
        (snapshot.logicalTime - target.anchorLogicalTime) * target.playbackRate;
    destination = clampRunTime(target, destination);
    let result: ProgramEvaluationResult;
    try {
      if (pending?.kind === 'finish') {
        const staticDuration = finiteDuration(getProgramRecord(target.program).duration);
        if (staticDuration === undefined) {
          result = finishProgram(evaluationActivation, {
            previousTime: target.previousTime,
            frameId: snapshot.frameId,
            writer: target.token,
            batch: evaluationBatch,
          });
        } else {
          result = seekProgram(evaluationActivation, {
            previousTime: target.previousTime,
            time: staticDuration,
            direction: 'forward',
            frameId: snapshot.frameId,
            writer: target.token,
            batch: evaluationBatch,
          });
        }
      } else if (pending?.kind === 'seek') {
        result = seekProgram(evaluationActivation, {
          previousTime: target.previousTime,
          time: destination,
          direction: pending.direction ??
            (destination < target.position ? 'reverse' : 'forward'),
          frameId: snapshot.frameId,
          writer: target.token,
          batch: evaluationBatch,
        });
      } else {
        result = evaluateProgram(evaluationActivation, {
          previousTime: target.previousTime,
          time: destination,
          direction: target.direction,
          frameId: snapshot.frameId,
          writer: target.token,
          batch: evaluationBatch,
        });
      }
    } catch (error) {
      releaseProgramActivation(evaluationActivation);
      batch.discardWriter(target.token);
      stageStatus(batch, snapshot, 'cancelled');
      recordSchedulerTrace({
        kind: 'animation-error',
        frameId: snapshot.frameId,
        logicalTime: snapshot.logicalTime,
        debugName: debugName(),
        error,
      });
      queueCurrentFrameCommitAcknowledgement((_committedSnapshot, outcome) => {
        if (!outcome.applied || disposed || run !== target || target.released) return;
        target.status = 'ending';
        target.unregisterAdvance?.();
        target.unregisterAdvance = undefined;
        queueEvent(snapshot, playbackEvent('cancel', snapshot), target.registrationOrder);
        queueError(snapshot, error, target.registrationOrder, false);
        scheduleTerminal(snapshot, target);
      });
      return;
    }

    if (disposed || run !== target || target.released) {
      releaseProgramActivation(evaluationActivation);
      batch.discardWriter(target.token);
      return;
    }

    const duration = result.terminal.duration;
    const presentedTime = duration !== undefined && Number.isFinite(duration) &&
      result.terminal.atEnd ? duration : destination;
    stageCurrentTime(batch, snapshot, presentedTime);
    queueEvaluationTraces(target, snapshot, result, stagedOutputs, presentedTime);

    const terminalReached = target.status === 'running' && result.terminal.reached ||
      pending?.kind === 'finish';
    if (terminalReached) {
      stageStatus(batch, snapshot, 'finished');
    } else {
      stageStatus(batch, snapshot, target.status === 'paused' ? 'paused' : 'running');
    }
    queueCurrentFrameCommitAcknowledgement((_committedSnapshot, outcome) => {
      if (!outcome.applied || disposed || run !== target || target.released) {
        releaseProgramActivation(evaluationActivation);
        return;
      }
      adoptProgramActivationFork(target.activation, evaluationActivation);
      target.position = presentedTime;
      target.previousTime = presentedTime;
      if (pending?.kind === 'seek') {
        target.anchorPosition = presentedTime;
        target.anchorLogicalTime = snapshot.logicalTime;
      }
      target.pendingEvaluation = undefined;
      queueEvaluationMilestones(target, snapshot, result);
      if (terminalReached) {
        target.unregisterAdvance?.();
        target.unregisterAdvance = undefined;
        queueEvent(snapshot, playbackEvent('finish', snapshot), target.registrationOrder);
        scheduleTerminal(snapshot, target);
      } else if (target.status === 'paused') {
        target.unregisterAdvance?.();
        target.unregisterAdvance = undefined;
      }
    });
  }

  function createRun(
    generation: number,
    snapshot: CRCFrameSnapshot,
    batch: SignalCommitBatch,
    conflict: 'error' | 'replace',
    ignoredToken?: object,
  ): PlaybackRun | undefined {
    const registration = Object.freeze({});
    const registrationOrder = ++nextPlaybackRegistrationOrder;
    const token = Object.freeze({ registrationOrder });
    let target!: PlaybackRun;
    try {
      const lease = acquireTransactionalProgramWriterLeases(program, registration, {
        token,
        registrationOrder,
        debugName: debugName(),
        cancel(): void {
          if (target !== undefined && !target.released) {
            const context = activePlaybackBeginContext;
            if (context === undefined) releaseRun(target);
            else cancelRun(target, context.snapshot, context.batch, true);
          }
        },
        preflightReplacement(): void {
          if (target === undefined || target.released) {
            throw new Error('CRC animation replacement owner is unavailable.');
          }
          if (activePlaybackBeginContext === undefined) {
            throw new Error('CRC animation replacement must begin during Begin.');
          }
          if (target.status === 'ending') {
            throw new Error('CRC animation playback run is already ending.');
          }
        },
        beginReplacement(): AnimationWriterLeaseReplacement {
          if (target === undefined || target.released) {
            throw new Error('CRC animation replacement owner is unavailable.');
          }
          const context = activePlaybackBeginContext;
          if (context === undefined) {
            throw new Error('CRC animation replacement must begin during Begin.');
          }
          return beginRunReplacement(target, context.snapshot, context.batch);
        },
      }, { conflict, ignoredToken });
      target = {
        generation,
        registration,
        registrationOrder,
        token,
        lease,
        activation: lease.activation,
        program,
        direction: 'forward',
        playbackRate: storedPlaybackRate,
        position: 0,
        anchorPosition: 0,
        anchorLogicalTime: snapshot.logicalTime,
        previousTime: undefined,
        status: 'running',
        pendingEvaluation: undefined,
        unregisterAdvance: undefined,
        released: false,
        startPending: false,
        startQueuedFrameId: undefined,
      };
    } catch (error) {
      stageStatus(batch, snapshot, 'cancelled');
      queueDiagnosticError(snapshot, error, registrationOrder);
      return undefined;
    }
    run = target;
    activePlaybacks++;
    createdPlaybacks++;
    return target;
  }

  function settleProvisionalRun(
    target: PlaybackRun,
    previousRun: PlaybackRun | undefined,
    additionalReplacement: AnimationWriterLeaseReplacement | undefined,
  ): void {
    if (target.lease.replacedOwnerCount === 0 && additionalReplacement === undefined) return;
    queueCurrentFrameCommitAcknowledgement((_snapshot, outcome) => {
      if (outcome.applied) {
        target.lease.commitReplacement();
        additionalReplacement?.commit();
        return;
      }
      const targetAlreadyReleased = target.released;
      target.unregisterAdvance?.();
      target.unregisterAdvance = undefined;
      target.released = true;
      if (run === target) run = previousRun;
      if (previousRun !== undefined) queuedGeneration = previousRun.generation;
      if (!targetAlreadyReleased) {
        if (target.lease.replacedOwnerCount === 0) target.lease.release();
        else target.lease.rollbackReplacement();
      }
      additionalReplacement?.rollback();
      if (!targetAlreadyReleased) {
        releaseProgramActivation(target.activation);
        activePlaybacks--;
        releasedPlaybacks++;
      }
    });
  }

  function acceptPlay(
    generation: number,
    conflict: 'error' | 'replace',
    snapshot: CRCFrameSnapshot,
    batch: SignalCommitBatch,
  ): void {
    try {
      if (conflict === 'error') {
        preflightProgramWriterLeaseAcquisition(program, run?.token);
      } else {
        preflightProgramActivation(program);
      }
    } catch (error) {
      if (run === undefined || run.status === 'ending') {
        stageStatus(batch, snapshot, 'cancelled');
      } else if (queuedGeneration === generation) {
        queuedGeneration = run.generation;
      }
      queueDiagnosticError(
        snapshot,
        error,
        run?.registrationOrder ?? Number.MAX_SAFE_INTEGER,
      );
      return;
    }
    const previousRun = run;
    const target = createRun(
      generation,
      snapshot,
      batch,
      conflict,
      previousRun?.token,
    );
    if (target === undefined) return;
    let additionalReplacement: AnimationWriterLeaseReplacement | undefined;
    if (previousRun !== undefined && !previousRun.released &&
      previousRun.status !== 'ending') {
      additionalReplacement = beginRunReplacement(previousRun, snapshot, batch);
    }
    stageStatus(batch, snapshot, 'scheduled');
    stageCurrentTime(batch, snapshot, 0);
    stageStatus(batch, snapshot, 'running');
    target.startPending = true;
    queuePendingStart(target, snapshot);
    registerRun(target);
    settleProvisionalRun(target, previousRun, additionalReplacement);
  }

  function acceptFreshControl(
    generation: number,
    command: 'seek' | 'reverse' | 'finish',
    snapshot: CRCFrameSnapshot,
    batch: SignalCommitBatch,
    seekTime?: number,
  ): void {
    if (command !== 'seek') {
      const error = unavailableControlError(program, command);
      if (error !== undefined) {
        queueDiagnosticError(snapshot, error, Number.MAX_SAFE_INTEGER);
        return;
      }
    }
    const target = createRun(
      generation,
      snapshot,
      batch,
      options.conflict ?? 'error',
    );
    if (target === undefined) return;
    target.status = command === 'reverse' ? 'running' : 'paused';
    if (command === 'reverse') {
      const duration = finiteDuration(getProgramRecord(target.program).duration)!;
      target.direction = 'reverse';
      target.position = duration;
      target.anchorPosition = duration;
      target.pendingEvaluation = { kind: 'seek', time: duration, direction: 'reverse' };
      stageStatus(batch, snapshot, 'scheduled');
      stageStatus(batch, snapshot, 'running');
      target.startPending = true;
    } else if (command === 'finish') {
      target.status = 'running';
      target.pendingEvaluation = { kind: 'finish' };
      stageStatus(batch, snapshot, 'scheduled');
      stageStatus(batch, snapshot, 'running');
      target.startPending = true;
    } else {
      const staticDuration = finiteDuration(getProgramRecord(target.program).duration);
      target.pendingEvaluation = {
        kind: 'seek',
        time: Math.max(0, staticDuration === undefined ? seekTime! :
          Math.min(seekTime!, staticDuration)),
      };
      stageStatus(batch, snapshot, 'paused');
    }
    queuePendingStart(target, snapshot);
    registerRun(target);
    settleProvisionalRun(target, undefined, undefined);
  }

  function enqueue(
    command: PlaybackCommandName,
    generation: number,
    argument?: number | 'error' | 'replace',
  ): CRCBeginCommandHandle | undefined {
    if (disposed) return undefined;
    queuedCommands++;
    let commandHandle!: CRCBeginCommandHandle;
    commandHandle = queueBeginCommand((snapshot, batch, sequence) => {
      pendingCommands.delete(commandHandle);
      if (pendingRetarget === commandHandle) pendingRetarget = undefined;
      queuedCommands--;
      if (disposed || generation !== queuedGeneration) return;
      recordSchedulerTrace({
        kind: 'animation-command',
        frameId: snapshot.frameId,
        logicalTime: snapshot.logicalTime,
        sequence,
        command,
        debugName: debugName(),
      });
      const previousContext = activePlaybackBeginContext;
      activePlaybackBeginContext = { snapshot, batch };
      try {
        acceptCommandWithoutTrace(command, generation, snapshot, batch, argument);
      } finally {
        activePlaybackBeginContext = previousContext;
      }
    });
    pendingCommands.add(commandHandle);
    return commandHandle;
  }

  function acceptCommandWithoutTrace(
    command: PlaybackCommandName,
    generation: number,
    snapshot: CRCFrameSnapshot,
    batch: SignalCommitBatch,
    argument?: number | 'error' | 'replace',
  ): void {
    // Keep trace emission in the immutable scheduler command wrapper so the
    // realm sequence, not a controller-local approximation, is recorded.
    if (command === 'play') {
      acceptPlay(generation, argument as 'error' | 'replace', snapshot, batch);
      return;
    }
    const target = run?.generation === generation ? run : undefined;
    if (target === undefined) {
      if (command === 'seek' || command === 'reverse' || command === 'finish') {
        acceptFreshControl(
          generation,
          command,
          snapshot,
          batch,
          command === 'seek' ? argument as number : undefined,
        );
      } else if (command === 'cancel') {
        stageStatus(batch, snapshot, 'cancelled');
      } else if (command === 'setPlaybackRate') {
        storedPlaybackRate = argument as number;
      }
      return;
    }
    if (target.status === 'ending') {
      if (command === 'seek' || command === 'reverse' || command === 'finish') {
        releaseRun(target);
        acceptFreshControl(
          generation,
          command,
          snapshot,
          batch,
          command === 'seek' ? argument as number : undefined,
        );
      } else if (command === 'setPlaybackRate') {
        storedPlaybackRate = argument as number;
      }
      return;
    }
    if (command === 'pause') {
      if (target.status !== 'paused') {
        const previousStatus = target.status;
        target.status = 'paused';
        target.unregisterAdvance?.();
        target.unregisterAdvance = undefined;
        stageStatus(batch, snapshot, 'paused');
        queueCurrentFrameCommitAcknowledgement((_committedSnapshot, outcome) => {
          if (outcome.applied || disposed || run !== target || target.released) return;
          target.status = previousStatus;
          registerRun(target);
          enqueue('pause', target.generation);
        });
      }
      return;
    }
    if (command === 'resume') {
      if (target.status === 'paused') {
        const previousAnchorPosition = target.anchorPosition;
        const previousAnchorLogicalTime = target.anchorLogicalTime;
        target.status = 'running';
        target.anchorPosition = target.position;
        target.anchorLogicalTime = snapshot.logicalTime;
        stageStatus(batch, snapshot, 'running');
        registerRun(target);
        queueCurrentFrameCommitAcknowledgement((_committedSnapshot, outcome) => {
          if (outcome.applied || disposed || run !== target || target.released) return;
          target.status = 'paused';
          target.anchorPosition = previousAnchorPosition;
          target.anchorLogicalTime = previousAnchorLogicalTime;
          target.unregisterAdvance?.();
          target.unregisterAdvance = undefined;
          enqueue('resume', target.generation);
        });
      }
      return;
    }
    if (command === 'cancel') {
      cancelRun(target, snapshot, batch);
      return;
    }
    if (command === 'seek') {
      const staticDuration = finiteDuration(getProgramRecord(target.program).duration);
      const time = Math.max(0, staticDuration === undefined ? argument as number :
        Math.min(argument as number, staticDuration));
      target.pendingEvaluation = { kind: 'seek', time };
      target.anchorPosition = time;
      target.anchorLogicalTime = snapshot.logicalTime;
      registerRun(target);
      return;
    }
    if (command === 'reverse') {
      target.direction = target.direction === 'forward' ? 'reverse' : 'forward';
      target.anchorPosition = target.position;
      target.anchorLogicalTime = snapshot.logicalTime;
      if (target.status === 'running') registerRun(target);
      return;
    }
    if (command === 'setPlaybackRate') {
      storedPlaybackRate = argument as number;
      target.playbackRate = storedPlaybackRate;
      target.anchorPosition = target.position;
      target.anchorLogicalTime = snapshot.logicalTime;
      return;
    }
    const unavailable = unavailableControlError(target.program, 'finish');
    if (unavailable !== undefined &&
      getProgramActivationRecord(target.activation).terminalDuration === undefined) {
      queueDiagnosticError(snapshot, unavailable, target.registrationOrder);
      return;
    }
    target.pendingEvaluation = { kind: 'finish' };
    registerRun(target);
  }

  const handle: CRCPlayback = Object.freeze({
    status: status.asReadonly(),
    currentTime: currentTime.asReadonly(),
    play(playOptions: { readonly conflict?: 'error' | 'replace' } = {}): void {
      if (disposed) return;
      const conflict = playOptions.conflict ?? options.conflict ?? 'error';
      if (conflict !== 'error' && conflict !== 'replace') {
        throw new TypeError('CRC animation playback conflict must be "error" or "replace".');
      }
      const generation = ++queuedGeneration;
      enqueue('play', generation, conflict);
    },
    pause(): void {
      enqueue('pause', queuedGeneration);
    },
    resume(): void {
      enqueue('resume', queuedGeneration);
    },
    cancel(): void {
      enqueue('cancel', queuedGeneration);
    },
    finish(): void {
      enqueue('finish', queuedGeneration);
    },
    seek(milliseconds: number): void {
      if (disposed) return;
      if (!Number.isFinite(milliseconds)) {
        throw new RangeError('CRC animation playback seek time must be finite.');
      }
      enqueue('seek', queuedGeneration, milliseconds);
    },
    reverse(): void {
      enqueue('reverse', queuedGeneration);
    },
    setPlaybackRate(rate: number): void {
      if (disposed) return;
      if (!Number.isFinite(rate) || rate <= 0) {
        throw new RangeError(
          'CRC animation playback rate must be finite and greater than zero.',
        );
      }
      enqueue('setPlaybackRate', queuedGeneration, rate);
    },
  });

  return Object.freeze({
    handle,
    adopt(nextProgram: CRCAnimationProgram, nextOptions: CRCPlaybackOptions = {}): void {
      if (disposed) return;
      const candidate = normalizeAnimationPlaybackCandidate(nextProgram, nextOptions);
      program = candidate.program;
      options = candidate.options;
    },
    committedSpringSnapshot(): SpringSample | undefined {
      const target = run;
      if (disposed || target === undefined || target.released) return undefined;
      const programRecord = getProgramRecord(target.program);
      if (programRecord.kind !== 'track') return undefined;
      const definitionRecord = getDefinitionRecord(programRecord.definition);
      if (definitionRecord.kind !== 'spring') return undefined;
      return sampleSpring(definitionRecord, target.position / 1000);
    },
    retarget(nextProgram: CRCAnimationProgram, nextOptions: CRCPlaybackOptions = {}): void {
      if (disposed) return;
      const candidate = normalizeAnimationPlaybackCandidate(nextProgram, nextOptions);
      program = candidate.program;
      options = candidate.options;
      if (pendingRetarget !== undefined) {
        pendingRetarget.cancel();
        if (pendingCommands.delete(pendingRetarget)) queuedCommands--;
      }
      const generation = ++queuedGeneration;
      pendingRetarget = enqueue('play', generation, 'replace');
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      queuedGeneration++;
      for (const commandHandle of pendingCommands) {
        commandHandle.cancel();
        queuedCommands--;
      }
      pendingCommands.clear();
      pendingRetarget = undefined;
      if (run !== undefined) releaseRun(run);
      if (delivery !== undefined) {
        queuedMilestones -= delivery.events.length;
        delivery.events.length = 0;
        delivery.errors.length = 0;
        delivery.terminalRuns.clear();
      }
      const schedulerPhase = snapshotRealmScheduler().phase;
      if (schedulerPhase !== 'advance' && schedulerPhase !== 'render') {
        status.set('disposed');
      } else {
        queueBeginCommand((snapshot, batch) => {
          batch.stage(status, 'disposed', metadataWriter);
          recordSchedulerTrace({
            kind: 'animation-write',
            frameId: snapshot.frameId,
            logicalTime: snapshot.logicalTime,
            debugName: debugName(),
            target: 'status',
            outcome: 'staged',
          });
        });
      }
    },
  });
}
