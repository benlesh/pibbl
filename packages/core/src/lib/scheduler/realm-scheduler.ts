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

export interface RendererParticipantOwner {
  readonly instance: CRCInstance;
  isActive(): boolean;
}

interface RendererParticipantWorkRequest {
  readonly key: object;
  readonly kind: 'resource' | 'draw' | 'compose';
  readonly run: CRCFrameCompletion;
}

interface RendererParticipantWorkRegistration {
  readonly owner: RendererParticipantOwner;
  request: RendererParticipantWorkRequest;
  readonly order: number;
}

interface RendererParticipantCompletion {
  readonly owner: RendererParticipantOwner;
  readonly callback: CRCFrameCompletion;
}

const registeredRoots = new Set<CRCInstance>();
const dirtyInstances = new Set<CRCInstance>();
const deferredInstances = new Set<CRCInstance>();
const advanceRegistrations = new Set<AdvanceRegistration>();
const frameCompletions: CRCFrameCompletion[] = [];
const rendererWorkByOwner = new Map<
  RendererParticipantOwner,
  Map<object, RendererParticipantWorkRegistration>
>();
const rendererParticipantCompletions: RendererParticipantCompletion[] = [];

let phase: CRCFramePhase = 'idle';
let pendingHostFrame: number | undefined;
let currentFrame: CRCFrameSnapshot | undefined;
let nextFrameId = 0;
let nextWorkRevision = 0;
let nextRendererWorkOrder = 0;
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

export function requestRendererParticipantWork(
  owner: RendererParticipantOwner,
  request: RendererParticipantWorkRequest,
): void {
  if (!owner.isActive()) return;
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
  callback: CRCFrameCompletion,
): void {
  if (!owner.isActive()) return;
  rendererParticipantCompletions.push({ owner, callback });
  requestHostFrameIfNeeded();
}

export function removeRendererParticipantOwner(
  owner: RendererParticipantOwner,
): void {
  rendererWorkByOwner.delete(owner);
  for (let index = rendererParticipantCompletions.length - 1; index >= 0; index--) {
    if (rendererParticipantCompletions[index].owner === owner) {
      rendererParticipantCompletions.splice(index, 1);
    }
  }
  cancelIdleHostFrame();
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
  const rendererWork = captureRendererParticipantWork();
  const rendererCompletions = rendererParticipantCompletions.splice(0);
  const retryRendererOwners = new Set<RendererParticipantOwner>();

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
    let rendererFailed = false;
    try {
      for (let jobIndex = 0; jobIndex < rootJob.instances.length; jobIndex++) {
        const job = rootJob.instances[jobIndex];
        if (job.instance.mainTeardowns.closed) continue;
        const participantWork = rendererWork.get(job.instance);
        const resourceFailures = runRendererParticipantStage(
          participantWork,
          'resource',
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
          'draw',
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
            'compose',
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
        job.instance.completedRenderRevision = job.revision;
      }
      transactionRecord.success = !rendererFailed;
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
  for (const completion of rendererCompletions) {
    if (!completion.owner.isActive()) continue;
    if (retryRendererOwners.has(completion.owner)) {
      rendererParticipantCompletions.push(completion);
      continue;
    }
    try {
      completion.callback(snapshot);
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
    frameCompletions.length > 0 ||
    rendererWorkByOwner.size > 0 ||
    rendererParticipantCompletions.length > 0;
}

function captureRendererParticipantWork(): Map<
  CRCInstance,
  RendererParticipantWorkRegistration[]
> {
  const byInstance = new Map<
    CRCInstance,
    RendererParticipantWorkRegistration[]
  >();
  for (const [owner, workByKey] of rendererWorkByOwner) {
    rendererWorkByOwner.delete(owner);
    if (!owner.isActive()) continue;
    const work = byInstance.get(owner.instance) ?? [];
    work.push(...workByKey.values());
    byInstance.set(owner.instance, work);
  }
  const kindOrder = { resource: 0, draw: 1, compose: 2 } as const;
  for (const work of byInstance.values()) {
    work.sort((left, right) =>
      kindOrder[left.request.kind] - kindOrder[right.request.kind] ||
      left.order - right.order,
    );
  }
  return byInstance;
}

function runRendererParticipantStage(
  work: RendererParticipantWorkRegistration[] | undefined,
  kind: RendererParticipantWorkRequest['kind'],
  snapshot: CRCFrameSnapshot,
): unknown[] {
  const errors: unknown[] = [];
  if (!work) return errors;
  for (const registration of work) {
    if (
      registration.request.kind !== kind ||
      !registration.owner.isActive()
    ) {
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
  rendererWork: Map<CRCInstance, RendererParticipantWorkRegistration[]>,
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
      let workByKey = rendererWorkByOwner.get(owner);
      if (!workByKey) {
        workByKey = new Map();
        rendererWorkByOwner.set(owner, workByKey);
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
