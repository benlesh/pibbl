import type { ManualSchedulerDriver } from './testing.js';
import { RootRenderTransaction } from '../render-transaction.js';
import { executeRender } from "../execute-render.js";
import { GLOBAL_STATE, NO_PENDING_ROOT } from "../global-state.js";
import {
  createSignalCommitBatch,
  flushPendingComputedValidations,
  hasPendingComputedValidations,
  setSignalGraphPlanWorkNotifier,
  withDirectSignalWriteForbidden,
} from "../signals/graph.js";
import type { PibblInstance, PibblRenderTransaction } from "../types.js";
import { runTeardown } from "../teardowns.js";
import type {
  PibblAdvanceLane,
  PibblAdvanceParticipant,
  PibblBeginCommand,
  PibblBeginCommandHandle,
  PibblFrameCommitAcknowledgement,
  PibblFrameCompletion,
  PibblFramePhase,
  PibblFrameSnapshot,
  RealmSchedulerSnapshot,
  PibblSchedulerTraceCollector,
  PibblSchedulerTraceRecord,
  SchedulerDriver,
} from "./types.js";

interface InstanceRenderJob {
  readonly instance: PibblInstance;
  readonly firstRevision: number;
  readonly revision: number;
  readonly pendingRoot: PibblInstance["pendingRoot"];
  readonly pendingRootRevision: number;
  readonly pendingUpdateParents: boolean;
}

interface PendingInstanceWork {
  /** Earliest accepted revision not yet completed in this eligibility bucket. */
  firstRevision: number;
  revision: number;
  pendingRoot: PibblInstance["pendingRoot"];
  pendingRootRevision: number;
  pendingUpdateParents: boolean;
}

interface InstanceRenderRequest {
  readonly pendingRoot: PibblInstance["pendingRoot"];
  readonly pendingUpdateParents: boolean;
}

interface RootRenderJob {
  readonly root: PibblInstance;
  readonly instances: InstanceRenderJob[];
}

interface RootTransaction extends PibblRenderTransaction {
  finish(success: boolean): void;
}

interface AdvanceRegistration {
  readonly participant: PibblAdvanceParticipant;
  readonly lane: PibblAdvanceLane;
  readonly registrationOrder: number;
  readonly requestsFrames: boolean;
  active: boolean;
}

interface BeginCommandRegistration {
  readonly accepted: {
    readonly sequence: number;
    readonly command: PibblBeginCommand;
  };
  active: boolean;
  owned: boolean;
}

interface OrderedPlaybackCompletion {
  readonly registrationOrder: number;
  readonly sequence: number;
  readonly callback: PibblFrameCompletion;
}

export interface RendererParticipantOwner {
  readonly instance: PibblInstance;
  isActive(): boolean;
}

interface RendererParticipantWorkRequest {
  readonly key: object;
  readonly kind: "resource" | "draw" | "compose";
  readonly run: PibblFrameCompletion;
}

interface RendererParticipantWorkRegistration {
  readonly owner: RendererParticipantOwner;
  request: RendererParticipantWorkRequest;
  readonly order: number;
}

interface RendererParticipantCompletion {
  readonly owner: RendererParticipantOwner;
  readonly callback: PibblFrameCompletion;
  readonly order: number;
}

const registeredRoots = new Set<PibblInstance>();
// A running frame drains only current work. Late work is promoted after
// Complete, so equal owner/key requests never coalesce across frame epochs.
const currentInstanceWork = new Map<PibblInstance, PendingInstanceWork>();
const nextInstanceWork = new Map<PibblInstance, PendingInstanceWork>();
const advanceRegistrations = new Set<AdvanceRegistration>();
const ADVANCE_LANE_ORDER = { animation: 0, physics: 1 } as const;
const beginCommands: BeginCommandRegistration[] = [];
const frameCompletions: PibblFrameCompletion[] = [];
const reactionCompletions: PibblFrameCompletion[] = [];
const currentRendererWorkByOwner = new Map<
  RendererParticipantOwner,
  Map<object, RendererParticipantWorkRegistration>
>();
const nextRendererWorkByOwner = new Map<
  RendererParticipantOwner,
  Map<object, RendererParticipantWorkRegistration>
>();
const currentRendererParticipantCompletions: RendererParticipantCompletion[] =
  [];
const nextRendererParticipantCompletions: RendererParticipantCompletion[] = [];

let phase: PibblFramePhase = "idle";
let pendingHostFrame: number | undefined;
let currentFrame: PibblFrameSnapshot | undefined;
let nextFrameId = 0;
let nextAdvanceRegistrationOrder = 0;
let nextWorkRevision = 0;
let nextRendererWorkOrder = 0;
let nextRendererCompletionOrder = 0;
let schedulerDriver: SchedulerDriver | undefined;
let createdRootRegistrations = 0;
let releasedRootRegistrations = 0;
let createdBeginCommands = 0;
let releasedBeginCommands = 0;
let createdCompletionCallbacks = 0;
let releasedCompletionCallbacks = 0;
let currentFramePlanAdmissionDepth = 0;
let nextBeginCommandSequence = 0;
let currentFramePlaybackCompletions: PibblFrameCompletion[] | undefined;
let currentFrameCommitAcknowledgements:
  PibblFrameCommitAcknowledgement[] | undefined;
let currentFrameOrderedPlaybackCompletions:
  OrderedPlaybackCompletion[] | undefined;
let nextOrderedPlaybackCompletionSequence = 0;
let schedulerTraceCollector: PibblSchedulerTraceCollector | undefined;
let schedulerTraceExclusive = false;

setSignalGraphPlanWorkNotifier(syncSignalGraphPlanWork);

export function registerRootInstance(instance: PibblInstance): void {
  if (!instance.parent && !registeredRoots.has(instance)) {
    registeredRoots.add(instance);
    createdRootRegistrations++;
  }
}

export function unregisterRootInstance(instance: PibblInstance): void {
  if (registeredRoots.delete(instance)) {
    releasedRootRegistrations++;
  }
  removeRootWork(instance);
  cancelIdleHostFrame();
}

export function requestInstanceRender(
  instance: PibblInstance,
  request: InstanceRenderRequest = {
    pendingRoot: NO_PENDING_ROOT,
    pendingUpdateParents: false,
  },
): number {
  const revision = ++nextWorkRevision;
  const target = shouldDeferNewFrameWork()
    ? nextInstanceWork
    : currentInstanceWork;
  if (
    target === currentInstanceWork &&
    request.pendingRoot !== NO_PENDING_ROOT
  ) {
    supersedeDeferredRootPayloads(instance, revision);
  }
  let current: PibblInstance | undefined = instance;
  while (current) {
    current.requestedRenderRevision = revision;
    mergePendingInstanceWork(target, current, {
      firstRevision: revision,
      revision,
      pendingRoot: current === instance ? request.pendingRoot : NO_PENDING_ROOT,
      pendingRootRevision:
        current === instance && request.pendingRoot !== NO_PENDING_ROOT
          ? revision
          : 0,
      pendingUpdateParents:
        current === instance && request.pendingUpdateParents,
    });
    synchronizeInstancePendingState(current);
    current = current.parent
      ? GLOBAL_STATE.pibblInstances.get(current.parent)
      : undefined;
  }
  requestHostFrameIfNeeded();
  return revision;
}

/** Whether an instance has work that has not yet completed a successful render. */
export function hasPendingInstanceRender(instance: PibblInstance): boolean {
  return (
    instance.requestedRenderRevision > instance.completedRenderRevision &&
    !(phase === "render" && nextInstanceWork.has(instance))
  );
}

export function registerAdvanceParticipant(
  participant: PibblAdvanceParticipant,
  lane: PibblAdvanceLane = "animation",
  requestsFrames = true,
): () => void {
  const registration: AdvanceRegistration = {
    participant,
    lane,
    registrationOrder: ++nextAdvanceRegistrationOrder,
    requestsFrames,
    active: true,
  };
  advanceRegistrations.add(registration);
  requestHostFrameIfNeeded();
  return () => {
    if (!registration.active) return;
    registration.active = false;
    advanceRegistrations.delete(registration);
    cancelIdleHostFrame();
  };
}

/** Queues immutable, realm-ordered work for the next frozen Begin prefix. */
export function queueBeginCommand(
  command: PibblBeginCommand,
): PibblBeginCommandHandle {
  const sequence = ++nextBeginCommandSequence;
  const registration: BeginCommandRegistration = {
    accepted: Object.freeze({ sequence, command }),
    active: true,
    owned: true,
  };
  beginCommands.push(registration);
  createdBeginCommands++;
  requestHostFrameIfNeeded();
  return Object.freeze({
    sequence,
    cancel(): void {
      if (!registration.active) return;
      registration.active = false;
      const index = beginCommands.indexOf(registration);
      if (index >= 0) {
        beginCommands.splice(index, 1);
        releaseBeginCommand(registration);
      }
      cancelIdleHostFrame();
    },
  });
}

/** Queues scheduler-owned work for Complete in the currently advancing frame. */
export function queueCurrentFrameCompletion(
  callback: PibblFrameCompletion,
): () => void {
  if (
    currentFramePlaybackCompletions === undefined ||
    (phase !== "begin" && phase !== "advance")
  ) {
    return queueFrameCompletion(callback);
  }
  currentFramePlaybackCompletions.push(callback);
  createdCompletionCallbacks++;
  return createFrameCompletionCancellation(callback);
}

/** Registers playback state adoption against this frame's explicit Commit outcome. */
export function queueCurrentFrameCommitAcknowledgement(
  callback: PibblFrameCommitAcknowledgement,
): () => void {
  if (
    currentFrameCommitAcknowledgements === undefined ||
    (phase !== "begin" && phase !== "advance")
  ) {
    throw new Error(
      "Pibbl frame Commit acknowledgements may only be queued during Begin or Advance.",
    );
  }
  currentFrameCommitAcknowledgements.push(callback);
  createdCompletionCallbacks++;
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    const acknowledgements = currentFrameCommitAcknowledgements;
    const index = acknowledgements?.indexOf(callback) ?? -1;
    if (index < 0) return;
    acknowledgements!.splice(index, 1);
    releasedCompletionCallbacks++;
    cancelIdleHostFrame();
  };
}

/** Queues one playback delivery ordered by run identity, then source insertion. */
export function queueCurrentFrameOrderedPlaybackCompletion(
  registrationOrder: number,
  callback: PibblFrameCompletion,
): void {
  if (currentFrameOrderedPlaybackCompletions === undefined) {
    queueFrameCompletion(callback);
    return;
  }
  currentFrameOrderedPlaybackCompletions.push({
    registrationOrder,
    sequence: ++nextOrderedPlaybackCompletionSequence,
    callback,
  });
  createdCompletionCallbacks++;
}

export function queueFrameCompletion(callback: PibblFrameCompletion): () => void {
  frameCompletions.push(callback);
  createdCompletionCallbacks++;
  requestHostFrameIfNeeded();
  return createFrameCompletionCancellation(callback);
}

/** Queues signal-driven imperative work for an eligible Complete phase. */
export function queueReactionCompletion(
  callback: PibblFrameCompletion,
): () => void {
  reactionCompletions.push(callback);
  createdCompletionCallbacks++;
  requestHostFrameIfNeeded();
  return createFrameCompletionCancellation(callback, reactionCompletions);
}

/** @internal Emits one immutable fact only while a source-only collector is installed. */
export function recordSchedulerTrace(record: PibblSchedulerTraceRecord): void {
  const collector = schedulerTraceCollector;
  if (collector === undefined) return;
  try {
    collector(Object.freeze(record));
  } catch {
    if (schedulerTraceCollector === collector) {
      schedulerTraceCollector = undefined;
      schedulerTraceExclusive = false;
    }
  }
}

export function requestRendererParticipantWork(
  owner: RendererParticipantOwner,
  request: RendererParticipantWorkRequest,
): void {
  if (!owner.isActive()) return;
  const rendererWorkByOwner = shouldDeferNewFrameWork()
    ? nextRendererWorkByOwner
    : currentRendererWorkByOwner;
  let workByKey = rendererWorkByOwner.get(owner);
  if (!workByKey) {
    workByKey = new Map();
    rendererWorkByOwner.set(owner, workByKey);
  }
  const existing = workByKey.get(request.key);
  if (existing) {
    existing.request = request;
  } else {
    workByKey.set(request.key, {
      owner,
      request,
      order: ++nextRendererWorkOrder,
    });
  }
  requestInstanceRender(owner.instance);
}

export function queueRendererParticipantComplete(
  owner: RendererParticipantOwner,
  callback: PibblFrameCompletion,
): void {
  if (!owner.isActive()) return;
  const completions = shouldDeferNewFrameWork()
    ? nextRendererParticipantCompletions
    : currentRendererParticipantCompletions;
  completions.push({
    owner,
    callback,
    order: ++nextRendererCompletionOrder,
  });
  createdCompletionCallbacks++;
  requestHostFrameIfNeeded();
}

export function removeRendererParticipantOwner(
  owner: RendererParticipantOwner,
): void {
  currentRendererWorkByOwner.delete(owner);
  nextRendererWorkByOwner.delete(owner);
  for (const completions of [
    currentRendererParticipantCompletions,
    nextRendererParticipantCompletions,
  ]) {
    for (let index = completions.length - 1; index >= 0; index--) {
      if (completions[index].owner === owner) {
        completions.splice(index, 1);
        releasedCompletionCallbacks++;
      }
    }
  }
  cancelIdleHostFrame();
}

export function getCurrentFrameSnapshot(): PibblFrameSnapshot | undefined {
  return GLOBAL_STATE.frameSnapshot ?? currentFrame;
}

/**
 * Returns a diagnostic snapshot of the shared realm scheduler without advancing it.
 *
 * @returns Current scheduler counters and pending-work state. See {@link RealmSchedulerSnapshot}.
 *
 * @see {@link ManualSchedulerDriver}
 */
export function snapshotRealmScheduler(): RealmSchedulerSnapshot {
  return Object.freeze({
    phase,
    pendingHostFrames: pendingHostFrame === undefined ? 0 : 1,
    registeredRoots: registeredRoots.size,
    advanceParticipants: advanceRegistrations.size,
    completionCallbacks:
      frameCompletions.length +
      reactionCompletions.length +
      (currentFrameCommitAcknowledgements?.length ?? 0) +
      (currentFramePlaybackCompletions?.length ?? 0) +
      (currentFrameOrderedPlaybackCompletions?.length ?? 0) +
      currentRendererParticipantCompletions.length +
      nextRendererParticipantCompletions.length,
    createdRootRegistrations,
    releasedRootRegistrations,
    createdBeginCommands,
    releasedBeginCommands,
    createdCompletionCallbacks,
    releasedCompletionCallbacks,
    dirtyInstances: countDirtyInstances(),
    dirtyRoots: countDirtyRoots(),
    registeredAdvanceParticipants: advanceRegistrations.size,
    queuedFrameCompletions: frameCompletions.length,
    queuedReactionCompletions: reactionCompletions.length,
    queuedBeginCommands: beginCommands.length,
    currentFrame,
  });
}

export function installSchedulerDriverForTest(
  driver: SchedulerDriver,
): () => void {
  if (pendingHostFrame !== undefined || phase !== "idle") {
    throw new Error(
      "Cannot replace the Pibbl scheduler driver while a frame is active.",
    );
  }
  const previous = schedulerDriver;
  schedulerDriver = driver;
  return () => {
    if (pendingHostFrame !== undefined || phase !== "idle") {
      throw new Error(
        "Cannot restore the Pibbl scheduler driver while a frame is active.",
      );
    }
    schedulerDriver = previous;
  };
}

/** @internal Test/diagnostic seam; production retains no trace history. */
export function installSchedulerTraceCollectorForTest(
  collector: PibblSchedulerTraceCollector,
  exclusive = false,
): () => void {
  if (schedulerTraceExclusive || (exclusive && schedulerTraceCollector !== undefined)) {
    throw new Error('Scheduler trace collector is already owned.');
  }
  const previous = schedulerTraceCollector;
  schedulerTraceCollector = collector;
  schedulerTraceExclusive = exclusive;
  return () => {
    if (schedulerTraceCollector === collector) {
      schedulerTraceCollector = previous;
      schedulerTraceExclusive = false;
    }
  };
}

function requestHostFrameIfNeeded(): void {
  if (pendingHostFrame !== undefined || phase !== "idle" || !hasFrameWork()) {
    return;
  }
  const driver = getSchedulerDriver();
  pendingHostFrame = driver.requestFrame(runFrame);
}

function runFrame(hostTime: number): void {
  pendingHostFrame = undefined;
  const snapshot = Object.freeze({
    frameId: ++nextFrameId,
    hostTime,
    logicalTime: hostTime,
  });
  currentFrame = snapshot;
  const errors: unknown[] = [];
  const transactions: Array<{
    root: PibblInstance;
    transaction: RootTransaction;
    success: boolean;
  }> = [];

  phase = "begin";
  if (schedulerTraceCollector) recordSchedulerTrace({ kind: 'scheduler-phase', collectedErrors: errors.length, phase, ...snapshot });
  let rootJobs = captureRootJobs();
  const commands = beginCommands.splice(0);
  const completions = frameCompletions.splice(0);
  const batch = createSignalCommitBatch();
  currentFramePlaybackCompletions = [];
  currentFrameCommitAcknowledgements = [];
  currentFrameOrderedPlaybackCompletions = [];
  for (const registration of commands) {
    if (!registration.active) {
      releaseBeginCommand(registration);
      continue;
    }
    registration.active = false;
    const { command, sequence } = registration.accepted;
    try {
      command(snapshot, batch, sequence);
    } catch (error) {
      batch.discardWriter(command);
      errors.push(error);
    } finally {
      releaseBeginCommand(registration);
    }
  }
  const registrations = Object.freeze(
    Array.from(advanceRegistrations).sort(
      (a, b) =>
        ADVANCE_LANE_ORDER[a.lane] - ADVANCE_LANE_ORDER[b.lane] ||
        a.registrationOrder - b.registrationOrder,
    ),
  );

  phase = "advance";
  if (schedulerTraceCollector) recordSchedulerTrace({ kind: 'scheduler-phase', collectedErrors: errors.length, phase, ...snapshot });
  for (const registration of registrations) {
    if (!registration.active) continue;
    const { participant } = registration;
    try {
      withDirectSignalWriteForbidden(
        "Cannot write to a signal directly during Pibbl scheduler Advance; stage it through the provided batch.",
        () => participant(snapshot, batch),
      );
    } catch (error) {
      batch.discardWriter(participant);
      errors.push(error);
    }
  }

  phase = "commit";
  if (schedulerTraceCollector) recordSchedulerTrace({ kind: 'scheduler-phase', collectedErrors: errors.length, phase, ...snapshot });
  let commitApplied = false;
  try {
    withCurrentFramePlanAdmission(() =>
      batch.commit(() => {
        commitApplied = true;
      }),
    );
  } catch (error) {
    errors.push(error);
  }
  const commitAcknowledgements = currentFrameCommitAcknowledgements;
  currentFrameCommitAcknowledgements = undefined;
  const commitOutcome = Object.freeze({ applied: commitApplied });
  for (const acknowledgement of commitAcknowledgements) {
    try {
      acknowledgement(snapshot, commitOutcome);
    } catch (error) {
      errors.push(error);
    } finally {
      releasedCompletionCallbacks++;
    }
  }

  phase = "plan";
  if (schedulerTraceCollector) recordSchedulerTrace({ kind: 'scheduler-phase', collectedErrors: errors.length, commitApplied, phase, ...snapshot });
  try {
    withCurrentFramePlanAdmission(flushPendingComputedValidations);
  } catch (error) {
    errors.push(error);
  }
  rootJobs = mergeRootJobs(rootJobs, captureRootJobs());
  const executableInstances = new Set(
    rootJobs.flatMap((rootJob) =>
      rootJob.instances.map((instanceJob) => instanceJob.instance),
    ),
  );
  const blockedRendererOwners = new Set<RendererParticipantOwner>();
  const rendererWork = captureRendererParticipantWork(
    executableInstances,
    blockedRendererOwners,
  );
  const rendererCompletions = captureRendererParticipantCompletions(
    blockedRendererOwners,
  );
  const retryRendererOwners = new Set<RendererParticipantOwner>();

  phase = "render";
  if (schedulerTraceCollector) recordSchedulerTrace({ kind: 'scheduler-phase', collectedErrors: errors.length, commitApplied, phase, ...snapshot });
  for (const rootJob of rootJobs) {
    if (
      !registeredRoots.has(rootJob.root) ||
      rootJob.root.mainTeardowns.closed
    ) {
      continue;
    }
    const transaction = createRootTransaction();
    const transactionRecord = {
      root: rootJob.root,
      transaction,
      success: false,
    };
    transactions.push(transactionRecord);
    rootJob.root.eventRoot.renderTransaction = transaction;
    let failedInstance: PibblInstance | undefined;
    let rendererFailed = false;
    try {
      for (let jobIndex = 0; jobIndex < rootJob.instances.length; jobIndex++) {
        const job = rootJob.instances[jobIndex];
        if (job.instance.mainTeardowns.closed) continue;
        const participantWork = rendererWork.get(job.instance);
        const resourceFailures = runRendererParticipantStage(
          participantWork,
          "resource",
          snapshot,
        );
        if (resourceFailures.length > 0) {
          restoreRendererParticipantFailure(
            rootJob,
            rendererWork,
            jobIndex,
            retryRendererOwners,
          );
          errors.push(...resourceFailures);
          rendererFailed = true;
          break;
        }
        const drawFailures = runRendererParticipantStage(
          participantWork,
          "draw",
          snapshot,
        );
        if (drawFailures.length > 0) {
          restoreRendererParticipantFailure(
            rootJob,
            rendererWork,
            jobIndex,
            retryRendererOwners,
          );
          errors.push(...drawFailures);
          rendererFailed = true;
          break;
        }
        try {
          executeRender(
            job.instance.canvas,
            snapshot.logicalTime,
            job.pendingRoot,
            false,
            snapshot,
          );
          const composeFailures = runRendererParticipantStage(
            participantWork,
            "compose",
            snapshot,
          );
          if (composeFailures.length > 0) {
            restoreRendererParticipantFailure(
              rootJob,
              rendererWork,
              jobIndex,
              retryRendererOwners,
            );
            errors.push(...composeFailures);
            rendererFailed = true;
            break;
          }
        } catch (error) {
          failedInstance = job.instance;
          throw error;
        }
        completeInstanceRenderRevision(job.instance, job.revision);
      }
      transactionRecord.success = !rendererFailed;
    } catch (error) {
      if (failedInstance && failedInstance !== rootJob.root) {
        restoreRootJob(rootJob);
      }
      errors.push(error);
    }
  }

  phase = "complete";
  if (schedulerTraceCollector) recordSchedulerTrace({ kind: 'scheduler-phase', collectedErrors: errors.length, commitApplied, phase, ...snapshot });
  const reactions = reactionCompletions.splice(0);
  for (const record of transactions) {
    try {
      record.transaction.finish(record.success);
    } catch (error) {
      errors.push(error);
    } finally {
      if (record.root.eventRoot.renderTransaction === record.transaction) {
        record.root.eventRoot.renderTransaction = undefined;
      }
    }
  }
  for (const reaction of reactions) {
    try {
      reaction(snapshot);
    } catch (error) {
      errors.push(error);
    } finally {
      releasedCompletionCallbacks++;
    }
  }
  for (const completion of completions) {
    try {
      completion(snapshot);
    } catch (error) {
      errors.push(error);
    } finally {
      releasedCompletionCallbacks++;
    }
  }
  const playbackCompletions = currentFramePlaybackCompletions;
  for (const completion of playbackCompletions) {
    try {
      completion(snapshot);
    } catch (error) {
      errors.push(error);
    } finally {
      releasedCompletionCallbacks++;
    }
  }
  currentFramePlaybackCompletions = undefined;
  const orderedPlaybackCompletions = currentFrameOrderedPlaybackCompletions;
  currentFrameOrderedPlaybackCompletions = undefined;
  orderedPlaybackCompletions.sort(
    (left, right) =>
      left.registrationOrder - right.registrationOrder ||
      left.sequence - right.sequence,
  );
  for (const completion of orderedPlaybackCompletions) {
    try {
      completion.callback(snapshot);
    } catch (error) {
      errors.push(error);
    } finally {
      releasedCompletionCallbacks++;
    }
  }
  for (const completion of rendererCompletions) {
    if (!completion.owner.isActive()) {
      releasedCompletionCallbacks++;
      continue;
    }
    if (retryRendererOwners.has(completion.owner)) {
      nextRendererParticipantCompletions.push(completion);
      continue;
    }
    try {
      completion.callback(snapshot);
    } catch (error) {
      errors.push(error);
    } finally {
      releasedCompletionCallbacks++;
    }
  }
  batch.clear();
  currentFrame = undefined;
  phase = "idle";
  if (schedulerTraceCollector) recordSchedulerTrace({ kind: 'scheduler-phase', collectedErrors: errors.length, commitApplied, phase, ...snapshot, errorCount: errors.length });
  promoteNextFrameWork();
  requestHostFrameIfNeeded();
  throwCollectedErrors(errors);
}

function releaseBeginCommand(registration: BeginCommandRegistration): void {
  if (!registration.owned) return;
  registration.owned = false;
  releasedBeginCommands++;
}

function createFrameCompletionCancellation(
  callback: PibblFrameCompletion,
  ownedCompletions?: PibblFrameCompletion[],
): () => void {
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    for (const completions of ownedCompletions === undefined
      ? [frameCompletions, currentFramePlaybackCompletions]
      : [ownedCompletions]) {
      const index = completions?.indexOf(callback) ?? -1;
      if (index < 0) continue;
      completions!.splice(index, 1);
      releasedCompletionCallbacks++;
      cancelIdleHostFrame();
      return;
    }
  };
}

function captureRootJobs(): RootRenderJob[] {
  const requested = Array.from(currentInstanceWork);
  currentInstanceWork.clear();
  const jobsByRoot = new Map<PibblInstance, InstanceRenderJob[]>();
  for (const [instance, work] of requested) {
    synchronizeInstancePendingState(instance);
    if (instance.mainTeardowns.closed) continue;
    const root = findRoot(instance);
    if (!root || !registeredRoots.has(root)) continue;
    const jobs = jobsByRoot.get(root) ?? [];
    jobs.push({
      instance,
      firstRevision: work.firstRevision,
      revision: work.revision,
      pendingRoot: work.pendingRoot,
      pendingRootRevision: work.pendingRootRevision,
      pendingUpdateParents: work.pendingUpdateParents,
    });
    jobsByRoot.set(root, jobs);
  }

  const result: RootRenderJob[] = [];
  for (const root of registeredRoots) {
    const jobs = jobsByRoot.get(root);
    if (!jobs) continue;
    jobs.sort(
      (left, right) =>
        instanceDepth(right.instance) - instanceDepth(left.instance),
    );
    result.push({ root, instances: jobs });
  }
  return result;
}

function mergeRootJobs(
  initial: RootRenderJob[],
  planned: RootRenderJob[],
): RootRenderJob[] {
  const plannedByRoot = new Map(
    planned.map((job) => [job.root, job.instances]),
  );
  const merged: RootRenderJob[] = [];
  for (const root of registeredRoots) {
    const initialJob = initial.find((job) => job.root === root);
    const plannedInstances = plannedByRoot.get(root);
    if (!initialJob && !plannedInstances) continue;
    const byInstance = new Map<PibblInstance, InstanceRenderJob>();
    for (const job of initialJob?.instances ?? []) {
      byInstance.set(job.instance, job);
    }
    for (const job of plannedInstances ?? []) {
      const existing = byInstance.get(job.instance);
      byInstance.set(
        job.instance,
        existing
          ? {
              instance: job.instance,
              firstRevision: Math.min(
                existing.firstRevision,
                job.firstRevision,
              ),
              revision: Math.max(existing.revision, job.revision),
              pendingRoot:
                job.pendingRootRevision > existing.pendingRootRevision
                  ? job.pendingRoot
                  : existing.pendingRoot,
              pendingRootRevision: Math.max(
                existing.pendingRootRevision,
                job.pendingRootRevision,
              ),
              pendingUpdateParents:
                existing.pendingUpdateParents || job.pendingUpdateParents,
            }
          : job,
      );
    }
    const instances = Array.from(byInstance.values());
    instances.sort(
      (left, right) =>
        instanceDepth(right.instance) - instanceDepth(left.instance),
    );
    merged.push({ root, instances });
  }
  return merged;
}

function findRoot(instance: PibblInstance): PibblInstance | undefined {
  let current: PibblInstance | undefined = instance;
  while (current?.parent) {
    current = GLOBAL_STATE.pibblInstances.get(current.parent);
  }
  return current;
}

function supersedeDeferredRootPayloads(
  ancestor: PibblInstance,
  revision: number,
): void {
  for (const [instance, deferred] of nextInstanceWork) {
    if (
      deferred.pendingRootRevision > 0 &&
      deferred.pendingRootRevision < revision &&
      isInstanceWithin(instance, ancestor)
    ) {
      // A later sanctioned ancestor root owns the retained subtree. Preserve
      // the older revision/composition job, but never let its obsolete root
      // payload overwrite the newer tree in the following frame.
      deferred.pendingRoot = NO_PENDING_ROOT;
      deferred.pendingRootRevision = 0;
      synchronizeInstancePendingState(instance);
    }
  }
}

function isInstanceWithin(
  instance: PibblInstance,
  ancestor: PibblInstance,
): boolean {
  let current: PibblInstance | undefined = instance;
  while (current) {
    if (current === ancestor) return true;
    current = current.parent
      ? GLOBAL_STATE.pibblInstances.get(current.parent)
      : undefined;
  }
  return false;
}

function restoreRootJob(rootJob: RootRenderJob): void {
  if (!registeredRoots.has(rootJob.root) || rootJob.root.mainTeardowns.closed) {
    return;
  }
  for (const job of rootJob.instances) {
    const { instance } = job;
    if (
      instance.mainTeardowns.closed ||
      GLOBAL_STATE.pibblInstances.get(instance.canvas) !== instance
    ) {
      continue;
    }
    mergePendingInstanceWork(nextInstanceWork, instance, job);
    synchronizeInstancePendingState(instance);
  }
}

function instanceDepth(instance: PibblInstance): number {
  let depth = 0;
  let current: PibblInstance | undefined = instance;
  while (current?.parent) {
    depth++;
    current = GLOBAL_STATE.pibblInstances.get(current.parent);
  }
  return depth;
}

function removeRootWork(root: PibblInstance): void {
  for (const workByInstance of [currentInstanceWork, nextInstanceWork]) {
    for (const instance of workByInstance.keys()) {
      if (findRoot(instance) === root) {
        workByInstance.delete(instance);
        synchronizeInstancePendingState(instance);
      }
    }
  }
}

function countDirtyRoots(): number {
  const roots = new Set<PibblInstance>();
  for (const workByInstance of [currentInstanceWork, nextInstanceWork]) {
    for (const instance of workByInstance.keys()) {
      const root = findRoot(instance);
      if (root && registeredRoots.has(root)) roots.add(root);
    }
  }
  return roots.size;
}

function countDirtyInstances(): number {
  return new Set([...currentInstanceWork.keys(), ...nextInstanceWork.keys()])
    .size;
}

function hasActiveAdvanceParticipant(): boolean {
  for (const registration of advanceRegistrations)
    if (registration.requestsFrames) return true;
  return false;
}

function hasFrameWork(): boolean {
  return (
    currentInstanceWork.size > 0 ||
    nextInstanceWork.size > 0 ||
    hasPendingComputedValidations() ||
    beginCommands.length > 0 ||
    hasActiveAdvanceParticipant() ||
    frameCompletions.length > 0 ||
    reactionCompletions.length > 0 ||
    currentRendererWorkByOwner.size > 0 ||
    nextRendererWorkByOwner.size > 0 ||
    currentRendererParticipantCompletions.length > 0 ||
    nextRendererParticipantCompletions.length > 0
  );
}

function captureRendererParticipantWork(
  executableInstances: ReadonlySet<PibblInstance>,
  blockedOwners: Set<RendererParticipantOwner>,
): Map<PibblInstance, RendererParticipantWorkRegistration[]> {
  const byInstance = new Map<
    PibblInstance,
    RendererParticipantWorkRegistration[]
  >();
  for (const [owner, workByKey] of currentRendererWorkByOwner) {
    if (!owner.isActive()) {
      currentRendererWorkByOwner.delete(owner);
      continue;
    }
    if (!executableInstances.has(owner.instance)) {
      blockedOwners.add(owner);
      continue;
    }
    const work = byInstance.get(owner.instance) ?? [];
    for (const registration of workByKey.values()) {
      work.push(registration);
    }
    currentRendererWorkByOwner.delete(owner);
    if (work.length > 0) byInstance.set(owner.instance, work);
  }
  const kindOrder = { resource: 0, draw: 1, compose: 2 } as const;
  for (const work of byInstance.values()) {
    work.sort(
      (left, right) =>
        kindOrder[left.request.kind] - kindOrder[right.request.kind] ||
        left.order - right.order,
    );
  }
  return byInstance;
}

function captureRendererParticipantCompletions(
  blockedOwners: ReadonlySet<RendererParticipantOwner>,
): RendererParticipantCompletion[] {
  const captured: RendererParticipantCompletion[] = [];
  for (let index = 0; index < currentRendererParticipantCompletions.length;) {
    const completion = currentRendererParticipantCompletions[index];
    if (blockedOwners.has(completion.owner)) {
      index++;
      continue;
    }
    currentRendererParticipantCompletions.splice(index, 1);
    captured.push(completion);
  }
  captured.sort((left, right) => left.order - right.order);
  return captured;
}

function runRendererParticipantStage(
  work: RendererParticipantWorkRegistration[] | undefined,
  kind: RendererParticipantWorkRequest["kind"],
  snapshot: PibblFrameSnapshot,
): unknown[] {
  const errors: unknown[] = [];
  if (!work) return errors;
  for (const registration of work) {
    if (registration.request.kind !== kind || !registration.owner.isActive()) {
      continue;
    }
    try {
      registration.request.run(snapshot);
    } catch (error) {
      errors.push(error);
    }
  }
  return errors;
}

function restoreRendererParticipantFailure(
  rootJob: RootRenderJob,
  rendererWork: Map<PibblInstance, RendererParticipantWorkRegistration[]>,
  failedJobIndex: number,
  retryOwners: Set<RendererParticipantOwner>,
): void {
  restoreRootJob(rootJob);
  const ownersToRequest = new Set<RendererParticipantOwner>();
  for (
    let jobIndex = failedJobIndex;
    jobIndex < rootJob.instances.length;
    jobIndex++
  ) {
    const work = rendererWork.get(rootJob.instances[jobIndex].instance);
    if (!work) continue;
    for (const registration of work) {
      const { owner, request } = registration;
      if (!owner.isActive()) continue;
      let workByKey = nextRendererWorkByOwner.get(owner);
      if (!workByKey) {
        workByKey = new Map();
        nextRendererWorkByOwner.set(owner, workByKey);
      }
      if (!workByKey.has(request.key)) {
        workByKey.set(request.key, registration);
      }
      ownersToRequest.add(owner);
      retryOwners.add(owner);
    }
  }
  for (const owner of ownersToRequest) {
    requestInstanceRender(owner.instance);
  }
}

function mergePendingInstanceWork(
  target: Map<PibblInstance, PendingInstanceWork>,
  instance: PibblInstance,
  incoming: PendingInstanceWork,
): void {
  const existing = target.get(instance);
  if (!existing) {
    target.set(instance, { ...incoming });
    return;
  }
  existing.firstRevision = Math.min(
    existing.firstRevision,
    incoming.firstRevision,
  );
  existing.revision = Math.max(existing.revision, incoming.revision);
  if (incoming.pendingRootRevision > existing.pendingRootRevision) {
    existing.pendingRoot = incoming.pendingRoot;
    existing.pendingRootRevision = incoming.pendingRootRevision;
  }
  existing.pendingUpdateParents ||= incoming.pendingUpdateParents;
}

function synchronizeInstancePendingState(instance: PibblInstance): void {
  const current = currentInstanceWork.get(instance);
  const next = nextInstanceWork.get(instance);
  const rootSource = !current
    ? next
    : !next
      ? current
      : current.pendingRootRevision >= next.pendingRootRevision
        ? current
        : next;
  instance.pendingRoot = rootSource ? rootSource.pendingRoot : NO_PENDING_ROOT;
  instance.pendingUpdateParents = Boolean(
    current?.pendingUpdateParents || next?.pendingUpdateParents,
  );
}

export function completeInstanceRenderRevision(
  instance: PibblInstance,
  revision: number,
): void {
  const pendingFirstRevisions = [
    currentInstanceWork.get(instance)?.firstRevision,
    nextInstanceWork.get(instance)?.firstRevision,
  ].filter((value): value is number => value !== undefined);
  if (pendingFirstRevisions.length === 0) {
    instance.completedRenderRevision = instance.requestedRenderRevision;
    return;
  }
  // Revisions are global request order. Do not advance across an older hole
  // that was deferred before newer Commit/Plan work joined this frame.
  if (Math.min(...pendingFirstRevisions) > revision) {
    instance.completedRenderRevision = Math.max(
      instance.completedRenderRevision,
      revision,
    );
  }
}

function promoteNextFrameWork(): void {
  const pendingInstances = new Set<PibblInstance>();
  for (const [instance, work] of nextInstanceWork) {
    mergePendingInstanceWork(currentInstanceWork, instance, work);
    pendingInstances.add(instance);
  }
  nextInstanceWork.clear();
  for (const instance of pendingInstances) {
    synchronizeInstancePendingState(instance);
  }

  for (const [owner, nextWorkByKey] of nextRendererWorkByOwner) {
    let currentWorkByKey = currentRendererWorkByOwner.get(owner);
    if (!currentWorkByKey) {
      currentWorkByKey = new Map();
      currentRendererWorkByOwner.set(owner, currentWorkByKey);
    }
    for (const [key, registration] of nextWorkByKey) {
      const existing = currentWorkByKey.get(key);
      if (existing) {
        existing.request = registration.request;
      } else {
        currentWorkByKey.set(key, registration);
      }
    }
  }
  nextRendererWorkByOwner.clear();

  currentRendererParticipantCompletions.push(
    ...nextRendererParticipantCompletions,
  );
  currentRendererParticipantCompletions.sort(
    (left, right) => left.order - right.order,
  );
  nextRendererParticipantCompletions.length = 0;
}

function cancelIdleHostFrame(): void {
  if (pendingHostFrame === undefined || hasFrameWork()) return;
  const frame = pendingHostFrame;
  pendingHostFrame = undefined;
  runTeardown(() => getSchedulerDriver().cancelFrame(frame));
}

function syncSignalGraphPlanWork(): void {
  if (hasPendingComputedValidations()) {
    requestHostFrameIfNeeded();
  } else {
    cancelIdleHostFrame();
  }
}

function withCurrentFramePlanAdmission<T>(callback: () => T): T {
  currentFramePlanAdmissionDepth++;
  try {
    return callback();
  } finally {
    currentFramePlanAdmissionDepth--;
  }
}

function shouldDeferNewFrameWork(): boolean {
  return (
    phase !== "idle" &&
    phase !== "begin" &&
    currentFramePlanAdmissionDepth === 0
  );
}

function getSchedulerDriver(): SchedulerDriver {
  return (
    schedulerDriver ?? {
      requestFrame: (callback) => globalThis.requestAnimationFrame(callback),
      cancelFrame: (frameId) => globalThis.cancelAnimationFrame(frameId),
    }
  );
}

function createRootTransaction(): RootTransaction {
  return new RootRenderTransaction();
}

function throwCollectedErrors(errors: unknown[]): void {
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) {
    throw new AggregateError(errors, "Multiple Pibbl frame operations failed.");
  }
}
