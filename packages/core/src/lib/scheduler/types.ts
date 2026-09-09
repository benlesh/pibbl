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

export type CRCAdvanceParticipant = (
  snapshot: CRCFrameSnapshot,
  batch: SignalCommitBatch,
) => void;

export type CRCFrameCompletion = (snapshot: CRCFrameSnapshot) => void;

export interface SchedulerDriver {
  requestFrame(callback: FrameRequestCallback): number;
  cancelFrame(frameId: number): void;
}

export interface RealmSchedulerSnapshot {
  readonly phase: CRCFramePhase;
  readonly pendingHostFrames: number;
  readonly registeredRoots: number;
  readonly dirtyRoots: number;
  readonly registeredAdvanceParticipants: number;
  readonly queuedFrameCompletions: number;
  readonly currentFrame: CRCFrameSnapshot | undefined;
}
