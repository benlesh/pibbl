import { signalGraphSnapshot } from '../../packages/core/src/lib/signals/graph';
/** Source-only passive observation of this loaded runtime's shared scheduler. */
import { installSchedulerTraceCollectorForTest, snapshotRealmScheduler } from '../../packages/core/src/lib/scheduler/realm-scheduler';

export function observeScheduler() {
  const state = snapshotRealmScheduler();
  return Object.freeze({
    schema: 'pibbl-scheduler-observation/1' as const,
    scope: 'loaded-runtime-realm' as const,
    phase: state.phase,
    frame: state.currentFrame ? Object.freeze({
      frameId: state.currentFrame.frameId,
      hostTime: state.currentFrame.hostTime,
      logicalTime: state.currentFrame.logicalTime,
    }) : null,
    work: Object.freeze({
      pendingComputedValidations: signalGraphSnapshot().pendingComputedValidations,
      pendingHostFrames: state.pendingHostFrames,
      registeredRoots: state.registeredRoots,
      dirtyRoots: state.dirtyRoots,
      dirtyInstances: state.dirtyInstances,
      advanceParticipants: state.advanceParticipants,
      queuedBeginCommands: state.queuedBeginCommands,
      completionCallbacks: state.completionCallbacks,
      queuedFrameCompletions: state.queuedFrameCompletions,
      queuedReactionCompletions: state.queuedReactionCompletions,
    }),
    applicationReadiness: 'unknown' as const,
    externalTasks: 'unobserved' as const,
  });
}


/** Explicit instrumentation. Starting this recorder never requests a host frame. */
export function createSchedulerHistory(capacity = 128) {
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 1024) throw new RangeError('Scheduler history capacity must be an integer from 1 to 1024.');
  type PhaseRecord = Readonly<{ commitApplied: boolean | null; collectedErrors: number; outcome: 'errors-collected' | 'no-collected-errors' | null; errorCount: number | null; sequence: number; phase: ReturnType<typeof observeScheduler>['phase']; frameId: number; hostTime: number; logicalTime: number }>;
  const ring: PhaseRecord[] = [];
  let count = 0; let sequence = 0; let cursor = 0;
  let status: 'recording' | 'stopped' | 'disposed' = 'recording';
  const release = installSchedulerTraceCollectorForTest(record => {
    if (status !== 'recording' || record.kind !== 'scheduler-phase') return;
    ring[cursor] = Object.freeze({ commitApplied: record.commitApplied ?? null, collectedErrors: record.collectedErrors, errorCount: record.errorCount ?? null,
      outcome: record.errorCount === undefined ? null : record.errorCount > 0 ? 'errors-collected' : 'no-collected-errors',
      sequence: ++sequence, phase: record.phase,
      frameId: record.frameId, hostTime: record.hostTime, logicalTime: record.logicalTime });
    cursor = (cursor + 1) % capacity;
    count = Math.min(count + 1, capacity);
  }, true);
  function stop() { if (status === 'recording') { status = 'stopped'; release(); } }
  return Object.freeze({
    snapshot() {
      const records = Array.from({ length: count }, (_, index) => ring[(cursor - count + capacity + index) % capacity]);
      const grouped = new Map<number, PhaseRecord[]>();
      for (const record of records) {
        const group = grouped.get(record.frameId);
        if (group) group.push(record); else grouped.set(record.frameId, [record]);
      }
      const phases = ['begin', 'advance', 'commit', 'plan', 'render', 'complete', 'idle'] as const;
      const frames = [...grouped.values()].map(group => {
        const first = group[0]; const last = group[group.length - 1];
        const phaseErrors: Record<Exclude<PhaseRecord['phase'], 'idle'>, number | null> = {
          begin: null, advance: null, commit: null, plan: null, render: null, complete: null,
        };
        for (let index = 1; index < group.length; index++) {
          const previous = group[index - 1]; const current = group[index];
          if (previous.phase !== 'idle' && current.sequence === previous.sequence + 1 &&
              phases.indexOf(current.phase) === phases.indexOf(previous.phase) + 1 &&
              current.collectedErrors >= previous.collectedErrors) {
            phaseErrors[previous.phase] = current.collectedErrors - previous.collectedErrors;
          }
        }
        const complete = group.length === phases.length && group.every((record, index) =>
          record.phase === phases[index] && record.sequence === first.sequence + index);
        return Object.freeze({ frameId: first.frameId, hostTime: first.hostTime, logicalTime: first.logicalTime,
          firstSequence: first.sequence, lastSequence: last.sequence,
          completeness: complete ? 'complete' as const : 'partial' as const,
          missingStart: first.phase !== 'begin', missingEnd: last.phase !== 'idle',
          commitApplied: last.commitApplied,
          errorCount: last.phase === 'idle' ? last.errorCount : null,
          outcome: last.phase === 'idle' ? last.outcome : null,
          phaseErrors: Object.freeze(phaseErrors) });
      });
      return Object.freeze({ schema: 'pibbl-scheduler-history/1', scope: 'loaded-runtime-realm', status,
        capacity, dropped: sequence - count, records: Object.freeze(records), frames: Object.freeze(frames) });
    },
    stop,
    dispose() { stop(); status = 'disposed'; ring.length = 0; count = 0; sequence = 0; cursor = 0; },
  });
}
