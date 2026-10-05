import type { SignalCommitBatch } from '../signals/graph.js';

export type PibblFramePhase =
  | 'idle'
  | 'begin'
  | 'advance'
  | 'commit'
  | 'plan'
  | 'render'
  | 'complete';

export interface PibblFrameSnapshot {
  readonly frameId: number;
  readonly hostTime: number;
  readonly logicalTime: number;
}

export type PibblAdvanceLane = 'animation' | 'physics';

export type PibblAdvanceParticipant = (
  snapshot: PibblFrameSnapshot,
  batch: SignalCommitBatch,
) => void;

export type PibblBeginCommand = (
  snapshot: PibblFrameSnapshot,
  batch: SignalCommitBatch,
  sequence: number,
) => void;

export interface PibblBeginCommandHandle {
  readonly sequence: number;
  cancel(): void;
}

export type PibblFrameCompletion = (snapshot: PibblFrameSnapshot) => void;

export interface PibblCommitOutcome {
  readonly applied: boolean;
}

export type PibblFrameCommitAcknowledgement = (
  snapshot: PibblFrameSnapshot,
  outcome: PibblCommitOutcome,
) => void;

export type PibblSchedulerTraceRecord =
  | {
      readonly kind: 'scheduler-phase';
      readonly collectedErrors: number;
      /** Known from Plan onward; true includes empty/equality-suppressed batches. */
      readonly commitApplied?: boolean;
      /** Only present on idle: entries collected for subsequent error delivery. */
      readonly errorCount?: number;
      readonly phase: PibblFramePhase;
      readonly frameId: number;
      readonly hostTime: number;
      readonly logicalTime: number;
    }
  | {
      readonly kind: 'animation-command';
      readonly frameId: number;
      readonly logicalTime: number;
      readonly sequence: number;
      readonly command: string;
      readonly debugName: string | undefined;
    }
  | {
      readonly kind: 'animation-sample';
      readonly frameId: number;
      readonly logicalTime: number;
      readonly registrationOrder: number;
      readonly debugName: string | undefined;
      readonly localTime: number;
      readonly direction: 'forward' | 'reverse';
    }
  | {
      readonly kind: 'animation-write';
      readonly frameId: number;
      readonly logicalTime: number;
      readonly debugName: string | undefined;
      readonly target: string;
      readonly outcome: 'staged' | 'equality-suppressed';
    }
  | {
      readonly kind: 'animation-milestone';
      readonly frameId: number;
      readonly logicalTime: number;
      readonly debugName: string | undefined;
      readonly event: string;
      readonly programPath: readonly number[];
      readonly iteration: number;
    }
  | {
      readonly kind: 'animation-stepper';
      readonly frameId: number;
      readonly logicalTime: number;
      readonly debugName: string | undefined;
      readonly programPath: readonly number[];
      readonly repeatIterations: readonly number[];
      readonly appliedSteps: number;
      readonly retainedRemainderMilliseconds: number;
      readonly clampedElapsedMilliseconds: number;
      readonly discardedElapsedMilliseconds: number;
    }
  | {
      readonly kind: 'animation-error';
      readonly frameId: number;
      readonly logicalTime: number;
      readonly debugName: string | undefined;
      readonly error: unknown;
    };

export type PibblSchedulerTraceCollector = (record: PibblSchedulerTraceRecord) => void;

export interface SchedulerDriver {
  requestFrame(callback: FrameRequestCallback): number;
  cancelFrame(frameId: number): void;
}

export interface RealmSchedulerSnapshot {
  readonly phase: PibblFramePhase;
  readonly pendingHostFrames: number;
  readonly registeredRoots: number;
  readonly advanceParticipants: number;
  readonly completionCallbacks: number;
  readonly createdRootRegistrations: number;
  readonly releasedRootRegistrations: number;
  readonly createdBeginCommands: number;
  readonly releasedBeginCommands: number;
  readonly createdCompletionCallbacks: number;
  readonly releasedCompletionCallbacks: number;
  readonly dirtyInstances: number;
  readonly dirtyRoots: number;
  readonly registeredAdvanceParticipants: number;
  readonly queuedFrameCompletions: number;
  readonly queuedReactionCompletions: number;
  readonly queuedBeginCommands: number;
  readonly currentFrame: PibblFrameSnapshot | undefined;
}
