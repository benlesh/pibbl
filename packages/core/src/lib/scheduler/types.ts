import type { SignalCommitBatch } from '../signals/graph.js';

export type CRCFramePhase =
  | 'idle'
  | 'begin'
  | 'advance'
  | 'commit'
  | 'plan'
  | 'render'
  | 'complete';

export interface CRCFrameSnapshot {
  readonly frameId: number;
  readonly hostTime: number;
  readonly logicalTime: number;
}

export type CRCAdvanceLane = 'animation' | 'physics';

export type CRCAdvanceParticipant = (
  snapshot: CRCFrameSnapshot,
  batch: SignalCommitBatch,
) => void;

export type CRCBeginCommand = (
  snapshot: CRCFrameSnapshot,
  batch: SignalCommitBatch,
  sequence: number,
) => void;

export interface CRCBeginCommandHandle {
  readonly sequence: number;
  cancel(): void;
}

export type CRCFrameCompletion = (snapshot: CRCFrameSnapshot) => void;

export interface CRCCommitOutcome {
  readonly applied: boolean;
}

export type CRCFrameCommitAcknowledgement = (
  snapshot: CRCFrameSnapshot,
  outcome: CRCCommitOutcome,
) => void;

export type CRCSchedulerTraceRecord =
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

export type CRCSchedulerTraceCollector = (record: CRCSchedulerTraceRecord) => void;

export interface SchedulerDriver {
  requestFrame(callback: FrameRequestCallback): number;
  cancelFrame(frameId: number): void;
}

export interface RealmSchedulerSnapshot {
  readonly phase: CRCFramePhase;
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
  readonly queuedBeginCommands: number;
  readonly currentFrame: CRCFrameSnapshot | undefined;
}
