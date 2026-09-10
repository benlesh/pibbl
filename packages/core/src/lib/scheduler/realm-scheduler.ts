import { executeRender } from '../execute-render.js';
import {
  GLOBAL_STATE,
  NO_PENDING_ROOT,
} from '../global-state.js';
import {
  createSignalCommitBatch,
  flushPendingComputedValidations,
} from '../signals/graph.js';
import type { CRCInstance, CRCRenderTransaction } from '../types.js';
import type {
  CRCAdvanceParticipant,
  CRCFrameCompletion,
  CRCFramePhase,
  CRCFrameSnapshot,
  RealmSchedulerSnapshot,
  SchedulerDriver,
} from './types.js';

interface InstanceRenderJob {
  readonly instance: CRCInstance;
  readonly revision: number;
  readonly pendingRoot: CRCInstance['pendingRoot'];
  readonly pendingUpdateParents: boolean;
}

interface RootRenderJob {
  readonly root: CRCInstance;
  readonly instances: InstanceRenderJob[];
}

interface RootTransaction extends CRCRenderTransaction {
  finish(success: boolean): void;
}

interface AdvanceRegistration {
  readonly participant: CRCAdvanceParticipant;
  active: boolean;
}

const registeredRoots = new Set<CRCInstance>();
const dirtyInstances = new Set<CRCInstance>();
const deferredInstances = new Set<CRCInstance>();
const advanceRegistrations = new Set<AdvanceRegistration>();
const frameCompletions: CRCFrameCompletion[] = [];

let phase: CRCFramePhase = 'idle';
let pendingHostFrame: number | undefined;
let currentFrame: CRCFrameSnapshot | undefined;
let nextFrameId = 0;
let nextWorkRevision = 0;
let schedulerDriver: SchedulerDriver | undefined;

export function registerRootInstance(instance: CRCInstance): void {
  if (!instance.parent) {
    registeredRoots.add(instance);
  }
}

export function unregisterRootInstance(instance: CRCInstance): void {
  registeredRoots.delete(instance);
  removeRootWork(instance);
  cancelIdleHostFrame();
}

export function requestInstanceRender(instance: CRCInstance): number {
  const revision = ++nextWorkRevision;
  const deferUntilNextFrame = phase === 'render';
  let current: CRCInstance | undefined = instance;
  while (current) {
    current.requestedRenderRevision = revision;
    dirtyInstances.add(current);
    if (deferUntilNextFrame) {
      deferredInstances.add(current);
    }
    current = current.parent ? GLOBAL_STATE.crcInstances.get(current.parent) : undefined;
  }
  requestHostFrameIfNeeded();
  return revision;
}

/** Whether an instance has work that has not yet completed a successful render. */
export function hasPendingInstanceRender(instance: CRCInstance): boolean {
  return instance.requestedRenderRevision > instance.completedRenderRevision &&
    !(phase === 'render' && deferredInstances.has(instance));
}

export function registerAdvanceParticipant(
  participant: CRCAdvanceParticipant,
): () => void {
  const registration: AdvanceRegistration = { participant, active: true };
  advanceRegistrations.add(registration);
  requestHostFrameIfNeeded();
  return () => {
    if (!registration.active) return;
    registration.active = false;
    advanceRegistrations.delete(registration);
    cancelIdleHostFrame();
  };
}

export function queueFrameCompletion(callback: CRCFrameCompletion): void {
  frameCompletions.push(callback);
  requestHostFrameIfNeeded();
}

export function getCurrentFrameSnapshot(): CRCFrameSnapshot | undefined {
  return GLOBAL_STATE.frameSnapshot ?? currentFrame;
}

export function snapshotRealmScheduler(): RealmSchedulerSnapshot {
  return Object.freeze({
    phase,
    pendingHostFrames: pendingHostFrame === undefined ? 0 : 1,
    registeredRoots: registeredRoots.size,
    dirtyInstances: dirtyInstances.size,
    dirtyRoots: countDirtyRoots(),
    registeredAdvanceParticipants: advanceRegistrations.size,
    queuedFrameCompletions: frameCompletions.length,
    currentFrame,
  });
}

export function installSchedulerDriverForTest(
  driver: SchedulerDriver,
): () => void {
  if (pendingHostFrame !== undefined || phase !== 'idle') {
    throw new Error('Cannot replace the CRC scheduler driver while a frame is active.');
  }
  const previous = schedulerDriver;
  schedulerDriver = driver;
  return () => {
    if (pendingHostFrame !== undefined || phase !== 'idle') {
      throw new Error('Cannot restore the CRC scheduler driver while a frame is active.');
    }
    schedulerDriver = previous;
  };
}

function requestHostFrameIfNeeded(): void {
  if (pendingHostFrame !== undefined || phase !== 'idle' || !hasFrameWork()) {
    return;
  }
  const driver = getSchedulerDriver();
  pendingHostFrame = driver.requestFrame(runFrame);
}

function runFrame(hostTime: number): void {
  pendingHostFrame = undefined;
  deferredInstances.clear();
  const snapshot = Object.freeze({
    frameId: ++nextFrameId,
    hostTime,
    logicalTime: hostTime,
  });
  currentFrame = snapshot;
  const errors: unknown[] = [];
  const transactions: Array<{
    root: CRCInstance;
    transaction: RootTransaction;
    success: boolean;
  }> = [];

  phase = 'begin';
  let rootJobs = captureRootJobs();
  const registrations = Array.from(advanceRegistrations);
  const completions = frameCompletions.splice(0);
  const batch = createSignalCommitBatch();

  phase = 'advance';
  for (const registration of registrations) {
    if (!registration.active) continue;
    const { participant } = registration;
    try {
      participant(snapshot, batch);
    } catch (error) {
      batch.discardWriter(participant);
      errors.push(error);
    }
  }

  phase = 'commit';
  try {
    batch.commit();
  } catch (error) {
    errors.push(error);
  }

  phase = 'plan';
  try {
    flushPendingComputedValidations();
  } catch (error) {
    errors.push(error);
  }
  rootJobs = mergeRootJobs(rootJobs, captureRootJobs(true));

  phase = 'render';
  for (const rootJob of rootJobs) {
    if (!registeredRoots.has(rootJob.root) || rootJob.root.mainTeardowns.closed) {
      continue;
    }
    const transaction = createRootTransaction();
    const transactionRecord = { root: rootJob.root, transaction, success: false };
    transactions.push(transactionRecord);
    rootJob.root.eventRoot.renderTransaction = transaction;
    let failedInstance: CRCInstance | undefined;
    try {
      for (const job of rootJob.instances) {
        if (job.instance.mainTeardowns.closed) continue;
        try {
          executeRender(
            job.instance.canvas,
            snapshot.logicalTime,
            job.pendingRoot,
            false,
            snapshot,
          );
        } catch (error) {
          failedInstance = job.instance;
          throw error;
        }
        job.instance.completedRenderRevision = job.revision;
      }
      transactionRecord.success = true;
    } catch (error) {
      if (failedInstance && failedInstance !== rootJob.root) {
        restoreRootJob(rootJob);
      }
      errors.push(error);
    }
  }

  phase = 'complete';
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
  for (const completion of completions) {
    try {
      completion(snapshot);
    } catch (error) {
      errors.push(error);
    }
  }
  batch.clear();
  currentFrame = undefined;
  phase = 'idle';
  requestHostFrameIfNeeded();
  throwCollectedErrors(errors);
}

function captureRootJobs(planOnly = false): RootRenderJob[] {
  const deferredRoots = new Set<CRCInstance>();
  if (planOnly) {
    for (const instance of dirtyInstances) {
      if (instance.pendingRoot === NO_PENDING_ROOT) continue;
      const root = findRoot(instance);
      if (root) deferredRoots.add(root);
    }
  }
  const requested: CRCInstance[] = [];
  for (const instance of dirtyInstances) {
    const root = findRoot(instance);
    if (root && deferredRoots.has(root)) continue;
    dirtyInstances.delete(instance);
    requested.push(instance);
  }
  const jobsByRoot = new Map<CRCInstance, InstanceRenderJob[]>();
  for (const instance of requested) {
    if (instance.mainTeardowns.closed) continue;
    const root = findRoot(instance);
    if (!root || !registeredRoots.has(root)) continue;
    const jobs = jobsByRoot.get(root) ?? [];
    jobs.push({
      instance,
      revision: instance.requestedRenderRevision,
      pendingRoot: instance.pendingRoot,
      pendingUpdateParents: instance.pendingUpdateParents,
    });
    instance.pendingRoot = NO_PENDING_ROOT;
    instance.pendingUpdateParents = false;
    jobsByRoot.set(root, jobs);
  }

  const result: RootRenderJob[] = [];
  for (const root of registeredRoots) {
    const jobs = jobsByRoot.get(root);
    if (!jobs) continue;
    jobs.sort((left, right) => instanceDepth(right.instance) - instanceDepth(left.instance));
    result.push({ root, instances: jobs });
  }
  return result;
}

function mergeRootJobs(
  initial: RootRenderJob[],
  planned: RootRenderJob[],
): RootRenderJob[] {
  const plannedByRoot = new Map(planned.map(job => [job.root, job.instances]));
  const merged: RootRenderJob[] = [];
  for (const root of registeredRoots) {
    const initialJob = initial.find(job => job.root === root);
    const plannedInstances = plannedByRoot.get(root);
    if (!initialJob && !plannedInstances) continue;
    const byInstance = new Map<CRCInstance, InstanceRenderJob>();
    for (const job of initialJob?.instances ?? []) {
      byInstance.set(job.instance, job);
    }
    for (const job of plannedInstances ?? []) {
      const existing = byInstance.get(job.instance);
      byInstance.set(job.instance, existing ? {
        instance: job.instance,
        revision: job.revision,
        pendingRoot: existing.pendingRoot,
        pendingUpdateParents:
          existing.pendingUpdateParents || job.pendingUpdateParents,
      } : job);
    }
    const instances = Array.from(byInstance.values());
    instances.sort((left, right) =>
      instanceDepth(right.instance) - instanceDepth(left.instance),
    );
    merged.push({ root, instances });
  }
  return merged;
}

function findRoot(instance: CRCInstance): CRCInstance | undefined {
  let current: CRCInstance | undefined = instance;
  while (current?.parent) {
    current = GLOBAL_STATE.crcInstances.get(current.parent);
  }
  return current;
}

function restoreRootJob(rootJob: RootRenderJob): void {
  if (!registeredRoots.has(rootJob.root) || rootJob.root.mainTeardowns.closed) {
    return;
  }
  for (const job of rootJob.instances) {
    const { instance } = job;
    if (
      instance.mainTeardowns.closed ||
      GLOBAL_STATE.crcInstances.get(instance.canvas) !== instance
    ) {
      continue;
    }
    dirtyInstances.add(instance);
    if (
      instance.pendingRoot === NO_PENDING_ROOT &&
      job.pendingRoot !== NO_PENDING_ROOT
    ) {
      instance.pendingRoot = job.pendingRoot;
    }
    instance.pendingUpdateParents ||= job.pendingUpdateParents;
  }
}

function instanceDepth(instance: CRCInstance): number {
  let depth = 0;
  let current: CRCInstance | undefined = instance;
  while (current?.parent) {
    depth++;
    current = GLOBAL_STATE.crcInstances.get(current.parent);
  }
  return depth;
}

function removeRootWork(root: CRCInstance): void {
  for (const instance of dirtyInstances) {
    if (findRoot(instance) === root) {
      dirtyInstances.delete(instance);
    }
  }
  for (const instance of deferredInstances) {
    if (findRoot(instance) === root) {
      deferredInstances.delete(instance);
    }
  }
}

function countDirtyRoots(): number {
  const roots = new Set<CRCInstance>();
  for (const instance of dirtyInstances) {
    const root = findRoot(instance);
    if (root && registeredRoots.has(root)) roots.add(root);
  }
  return roots.size;
}

function hasFrameWork(): boolean {
  return dirtyInstances.size > 0 ||
    advanceRegistrations.size > 0 ||
    frameCompletions.length > 0;
}

function cancelIdleHostFrame(): void {
  if (pendingHostFrame === undefined || hasFrameWork()) return;
  getSchedulerDriver().cancelFrame(pendingHostFrame);
  pendingHostFrame = undefined;
}

function getSchedulerDriver(): SchedulerDriver {
  return schedulerDriver ?? {
    requestFrame: callback => globalThis.requestAnimationFrame(callback),
    cancelFrame: frameId => globalThis.cancelAnimationFrame(frameId),
  };
}

function createRootTransaction(): RootTransaction {
  const callbacks = new Set<(success: boolean) => void>();
  let result: boolean | undefined;
  return {
    onFinish(callback): void {
      if (result !== undefined) {
        callback(result);
      } else {
        callbacks.add(callback);
      }
    },
    finish(success): void {
      if (result !== undefined) return;
      result = success;
      const pending = Array.from(callbacks);
      callbacks.clear();
      const failures: unknown[] = [];
      for (const callback of pending) {
        try {
          callback(success);
        } catch (error) {
          failures.push(error);
        }
      }
      throwCollectedErrors(failures);
    },
  };
}

function throwCollectedErrors(errors: unknown[]): void {
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) {
    throw new AggregateError(errors, 'Multiple CRC frame operations failed.');
  }
}
