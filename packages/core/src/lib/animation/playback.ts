import {
  getSignalNode,
  signal,
  type SignalCommitBatch,
} from '../signals/graph.js';
import type { WritableSignal } from '../signals/types.js';
import {
  queueBeginCommand,
  queueCurrentFrameCompletion,
  recordSchedulerTrace,
  registerAdvanceParticipant,
  snapshotRealmScheduler,
} from '../scheduler/realm-scheduler.js';
import type {
  CRCBeginCommandHandle,
  CRCFrameSnapshot,
} from '../scheduler/types.js';
import { getDefinitionRecord } from './definition.js';
import {
  evaluateProgram,
  finishProgram,
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
  acquireProgramWriterLeases,
  type ProgramWriterLease,
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
  readonly lease: ProgramWriterLease;
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
}

interface PendingTraceWrite {
  readonly signal: WritableSignal<unknown>;
  readonly version: number;
  readonly target: string;
}

interface FrameDelivery {
  readonly frameId: number;
  readonly logicalTime: number;
  readonly events: CRCPlaybackEvent[];
  readonly errors: unknown[];
  readonly terminalRuns: Set<PlaybackRun>;
  readonly writes: PendingTraceWrite[];
}

export interface AnimationPlaybackSnapshot {
  readonly activePlaybacks: number;
  readonly createdPlaybacks: number;
  readonly releasedPlaybacks: number;
  readonly queuedCommands: number;
  readonly queuedMilestones: number;
}

export interface AnimationPlaybackController {
  readonly handle: CRCPlayback;
  adopt(program: CRCAnimationProgram, options?: CRCPlaybackOptions): void;
  dispose(): void;
}

let nextPlaybackRegistrationOrder = 0;
let activePlaybacks = 0;
let createdPlaybacks = 0;
let releasedPlaybacks = 0;
let queuedCommands = 0;
let queuedMilestones = 0;
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

function throwFailures(failures: readonly unknown[]): void {
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1) {
    throw new AggregateError(failures, 'Multiple CRC playback callbacks failed.');
  }
}

/**
 * Creates one scheduler-owned playback slot. Component lifetime is added by
 * crcPlayback in the following implementation task.
 */
export function createAnimationPlaybackController(
  initialProgram: CRCAnimationProgram,
  initialOptions: CRCPlaybackOptions = {},
): AnimationPlaybackController {
  getProgramRecord(initialProgram);
  validateOptions(initialOptions);

  let program = initialProgram;
  let options = { ...initialOptions };
  let disposed = false;
  let queuedGeneration = 0;
  let run: PlaybackRun | undefined;
  let storedPlaybackRate = 1;
  let delivery: FrameDelivery | undefined;
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
    };
    delivery = current;
    queueCurrentFrameCompletion(() => {
      if (delivery === current) delivery = undefined;
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

      queuedMilestones -= current.events.length;
      if (disposed) return;
      const failures: unknown[] = [];
      for (const event of current.events) {
        try {
          options.onEvent?.(event);
        } catch (error) {
          failures.push(error);
        }
      }
      for (const error of current.errors) {
        try {
          if (options.onError) options.onError(error);
          else failures.push(error);
        } catch (callbackError) {
          failures.push(callbackError);
        }
      }
      throwFailures(failures);
    });
    return current;
  }

  function queueEvent(snapshot: CRCFrameSnapshot, event: CRCPlaybackEvent): void {
    const frame = ensureDelivery(snapshot);
    frame.events.push(event);
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

  function queueError(snapshot: CRCFrameSnapshot, error: unknown): void {
    ensureDelivery(snapshot).errors.push(error);
    recordSchedulerTrace({
      kind: 'animation-error',
      frameId: snapshot.frameId,
      logicalTime: snapshot.logicalTime,
      debugName: debugName(),
      error,
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
    target.status = 'ending';
    target.unregisterAdvance?.();
    target.unregisterAdvance = undefined;
    stageStatus(batch, snapshot, 'cancelled');
    queueEvent(snapshot, playbackEvent('cancel', snapshot));
    scheduleTerminal(snapshot, target);
    if (releaseImmediately) releaseRun(target);
  }

  function queueEvaluationTraces(
    target: PlaybackRun,
    snapshot: CRCFrameSnapshot,
    result: ProgramEvaluationResult,
    stagedOutputs: ReadonlySet<WritableSignal<unknown>>,
  ): void {
    recordSchedulerTrace({
      kind: 'animation-sample',
      frameId: snapshot.frameId,
      logicalTime: snapshot.logicalTime,
      registrationOrder: target.registrationOrder,
      debugName: debugName(),
      localTime: target.position,
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
      ));
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
      if (disposed || run !== target || target.released) return;
      advanceRun(target, snapshot, batch);
    });
  }

  function advanceRun(
    target: PlaybackRun,
    snapshot: CRCFrameSnapshot,
    batch: SignalCommitBatch,
  ): void {
    const stagedOutputs = new Set<WritableSignal<unknown>>();
    const evaluationBatch: SignalCommitBatch = {
      read<T>(value: WritableSignal<T>): T {
        return batch.read(value);
      },
      stage<T>(value: WritableSignal<T>, nextValue: T, writer: object): void {
        batch.stage(value, nextValue, writer);
        if (writer === target.token) {
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
          result = finishProgram(target.activation, {
            previousTime: target.previousTime,
            frameId: snapshot.frameId,
            writer: target.token,
            batch: evaluationBatch,
          });
        } else {
          result = seekProgram(target.activation, {
            previousTime: target.previousTime,
            time: staticDuration,
            direction: 'forward',
            frameId: snapshot.frameId,
            writer: target.token,
            batch: evaluationBatch,
          });
        }
      } else if (pending?.kind === 'seek') {
        result = seekProgram(target.activation, {
          previousTime: target.previousTime,
          time: destination,
          direction: pending.direction ??
            (destination < target.position ? 'reverse' : 'forward'),
          frameId: snapshot.frameId,
          writer: target.token,
          batch: evaluationBatch,
        });
      } else {
        result = evaluateProgram(target.activation, {
          previousTime: target.previousTime,
          time: destination,
          direction: target.direction,
          frameId: snapshot.frameId,
          writer: target.token,
          batch: evaluationBatch,
        });
      }
    } catch (error) {
      batch.discardWriter(target.token);
      target.unregisterAdvance?.();
      target.unregisterAdvance = undefined;
      stageStatus(batch, snapshot, 'cancelled');
      queueEvent(snapshot, playbackEvent('cancel', snapshot));
      queueError(snapshot, error);
      scheduleTerminal(snapshot, target);
      return;
    }

    if (disposed || run !== target || target.released) {
      batch.discardWriter(target.token);
      return;
    }

    const duration = result.terminal.duration;
    const presentedTime = duration !== undefined && Number.isFinite(duration) &&
      result.terminal.atEnd ? duration : destination;
    target.position = presentedTime;
    target.previousTime = presentedTime;
    target.anchorPosition = presentedTime;
    target.anchorLogicalTime = snapshot.logicalTime;
    target.pendingEvaluation = undefined;
    stageCurrentTime(batch, snapshot, presentedTime);
    queueEvaluationTraces(target, snapshot, result, stagedOutputs);
    queueEvaluationMilestones(snapshot, result);

    const terminalReached = target.status === 'running' && result.terminal.reached ||
      pending?.kind === 'finish';
    if (terminalReached) {
      target.unregisterAdvance?.();
      target.unregisterAdvance = undefined;
      stageStatus(batch, snapshot, 'finished');
      queueEvent(snapshot, playbackEvent('finish', snapshot));
      scheduleTerminal(snapshot, target);
      return;
    }
    stageStatus(batch, snapshot, target.status === 'paused' ? 'paused' : 'running');
    if (target.status === 'paused') {
      target.unregisterAdvance?.();
      target.unregisterAdvance = undefined;
    }
  }

  function createRun(
    generation: number,
    snapshot: CRCFrameSnapshot,
    batch: SignalCommitBatch,
    conflict: 'error' | 'replace',
  ): PlaybackRun | undefined {
    const registration = Object.freeze({});
    const registrationOrder = ++nextPlaybackRegistrationOrder;
    const token = Object.freeze({ registrationOrder });
    let target!: PlaybackRun;
    try {
      const lease = acquireProgramWriterLeases(program, registration, {
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
      }, { conflict });
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
      };
    } catch (error) {
      stageStatus(batch, snapshot, 'cancelled');
      queueError(snapshot, error);
      return undefined;
    }
    run = target;
    activePlaybacks++;
    createdPlaybacks++;
    return target;
  }

  function acceptPlay(
    generation: number,
    conflict: 'error' | 'replace',
    snapshot: CRCFrameSnapshot,
    batch: SignalCommitBatch,
  ): void {
    try {
      preflightProgramActivation(program);
    } catch (error) {
      if (run === undefined || run.status === 'ending') {
        stageStatus(batch, snapshot, 'cancelled');
      } else if (queuedGeneration === generation) {
        queuedGeneration = run.generation;
      }
      queueError(snapshot, error);
      return;
    }
    if (run !== undefined) cancelRun(run, snapshot, batch, true);
    const target = createRun(generation, snapshot, batch, conflict);
    if (target === undefined) return;
    stageStatus(batch, snapshot, 'scheduled');
    stageCurrentTime(batch, snapshot, 0);
    stageStatus(batch, snapshot, 'running');
    queueEvent(snapshot, playbackEvent('start', snapshot));
    registerRun(target);
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
        queueError(snapshot, error);
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
      queueEvent(snapshot, playbackEvent('start', snapshot));
    } else if (command === 'finish') {
      target.status = 'running';
      target.pendingEvaluation = { kind: 'finish' };
      stageStatus(batch, snapshot, 'scheduled');
      stageStatus(batch, snapshot, 'running');
      queueEvent(snapshot, playbackEvent('start', snapshot));
    } else {
      const staticDuration = finiteDuration(getProgramRecord(target.program).duration);
      target.pendingEvaluation = {
        kind: 'seek',
        time: Math.max(0, staticDuration === undefined ? seekTime! :
          Math.min(seekTime!, staticDuration)),
      };
      stageStatus(batch, snapshot, 'paused');
    }
    registerRun(target);
  }

  function enqueue(
    command: PlaybackCommandName,
    generation: number,
    argument?: number | 'error' | 'replace',
  ): void {
    if (disposed) return;
    queuedCommands++;
    let commandHandle!: CRCBeginCommandHandle;
    commandHandle = queueBeginCommand((snapshot, batch, sequence) => {
      pendingCommands.delete(commandHandle);
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
        target.status = 'paused';
        target.unregisterAdvance?.();
        target.unregisterAdvance = undefined;
        stageStatus(batch, snapshot, 'paused');
      }
      return;
    }
    if (command === 'resume') {
      if (target.status === 'paused') {
        target.status = 'running';
        target.anchorPosition = target.position;
        target.anchorLogicalTime = snapshot.logicalTime;
        stageStatus(batch, snapshot, 'running');
        registerRun(target);
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
      queueError(snapshot, unavailable);
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
      getProgramRecord(nextProgram);
      validateOptions(nextOptions);
      program = nextProgram;
      options = { ...nextOptions };
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
