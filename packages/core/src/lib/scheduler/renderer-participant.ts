import type { crcInternalQueueSimulationBegin } from './simulation-participant.js';
import {
  GLOBAL_STATE,
} from '../global-state.js';
import {
  collectSignalReads,
  createSignalRenderConsumer,
  disposeSignalRenderConsumer,
} from '../signals/render-consumer.js';
import {
  assertSignalCommandAllowed,
} from '../signals/graph.js';
import type { WritableSignal } from '../signals/types.js';
import { usePaintTarget } from '../hooks/use-paint-target.js';
import type {
  CRCEventHandlers,
  CRCEventTargetOptions,
  CRCEventTargetSnapshot,
  CRCPointerEvents,
} from '../events/types.js';
import type { CRCComponentRefs, CRCInstance } from '../types.js';
import {
  getCurrentFrameSnapshot,
  queueBeginCommand,
  queueCurrentFrameCommitAcknowledgement,
  queueCurrentFrameCompletion,
  queueRendererParticipantComplete,
  registerAdvanceParticipant,
  removeRendererParticipantOwner,
  requestInstanceRender,
  requestRendererParticipantWork,
  type RendererParticipantOwner,
} from './realm-scheduler.js';

declare const internalRenderOwnerBrand: unique symbol;

/**
 * Opaque ownership identity for renderer scheduling and cleanup.
 *
 * @see {@link crcInternalCreateSignalConsumer}
 * @see {@link crcInternalCurrentRenderOwner}
 * @see {@link crcInternalOnRenderFinish}
 */
export interface CRCInternalRenderOwner {
  readonly [internalRenderOwnerBrand]: true;
}

/**
 * Shared scheduler frame identity, logical timing, and admission context.
 *
 * @see {@link crcInternalCurrentFrame}
 * @see {@link crcInternalQueueBegin}
 * @see {@link crcInternalQueueComplete}
 */
export interface CRCInternalFrame {
  /** Identifier of the shared scheduler frame. See {@link CRCInternalFrame}. */
  readonly frameId: number;
  /** Logical scheduler time in milliseconds. See {@link CRCInternalFrame}. */
  readonly logicalTime: number;
}

/**
 * Staged signal writes published together during scheduler Commit.
 *
 * @see {@link WritableSignal}
 * @see {@link crcInternalQueueBegin}
 * @see {@link crcInternalRegisterAdvance}
 * @see {@link crcInternalQueueSimulationBegin}
 */
export interface CRCInternalSignalBatch {
  /**
   * Reads the current committed values required by this integration. See
   * {@link CRCInternalSignalBatch}.
   * @param signal - Signal whose staged or committed value should be read. See
   * {@link WritableSignal} .
   * @returns The current batch value, falling back to the committed signal value.
   */
  read<T>(signal: WritableSignal<T>): T;
  /**
   * Stages a signal write for publication during Commit. See {@link CRCInternalSignalBatch}.
   * @param signal - Signal that will receive the value during Commit. See {@link WritableSignal}.
   * @param value - Value to stage.
   * @param writer - Identity used to attribute and discard staged writes.
   */
  stage<T>(signal: WritableSignal<T>, value: T, writer: object): void;
  /**
   * Discards writes belonging to the specified writer. See {@link CRCInternalSignalBatch}.
   * @param writer - Writer identity whose pending writes should be discarded.
   */
  discardWriter(writer: object): void;
}

/**
 * Sequence identity and cancellation capability for a queued scheduler command.
 *
 * @see {@link crcInternalQueueBegin}
 */
export interface CRCInternalCommandHandle {
  /**
   * Sequence number assigned when the scheduler command is queued. See
   * {@link CRCInternalCommandHandle}.
   */
  readonly sequence: number;
  /**
   * Cancels this queued command before it is admitted by the scheduler. See
   * {@link CRCInternalCommandHandle}.
   */
  cancel(): void;
}

/**
 * Ordered renderer stages around one owning Canvas instance traversal.
 * Every active callback in a stage runs in registration order. If one or more
 * callbacks fail, their errors are reported in that order, later dependent
 * stages are skipped, the root transaction fails, the instance revision stays
 * incomplete, and the failed batch plus unexecuted batches later in the same
 * root are retried on the next realm frame. Complete callbacks for those
 * retried owners are deferred until a successful frame. Other owners and roots
 * still complete normally.
 *
 * @see {@link crcInternalRequestRendererWork}
 */
export type CRCInternalRendererWorkKind = 'resource' | 'draw' | 'compose';

/**
 * Dependency tracking and disposal operations for an integration-owned signal consumer.
 *
 * @see {@link crcInternalCreateSignalConsumer}
 */
export interface CRCInternalSignalConsumer {
  /**
   * Evaluates a callback while collecting signal dependencies for this consumer. See
   * {@link CRCInternalSignalConsumer}.
   * @param read - Synchronous computation whose signal dependencies are collected.
   * @returns The computation's return value.
   */
  collect<T>(read: () => T): T;
  /**
   * Acknowledges the consumer's current invalidation as processed. See
   * {@link CRCInternalSignalConsumer}.
   */
  markClean(): void;
  /** Releases resources owned by this mounted object. See {@link CRCInternalSignalConsumer}. */
  dispose(): void;
}

interface RenderOwnerState {
  readonly component: CRCComponentRefs<any>;
  readonly instance: CRCInstance;
  readonly schedulerOwner: RendererParticipantOwner;
  readonly consumers: Set<CRCInternalSignalConsumer>;
  readonly beginCommands: Set<CRCInternalCommandHandle>;
  readonly advanceRegistrations: Set<() => void>;
  active: boolean;
}

const ownersByComponent = new WeakMap<
  CRCComponentRefs<any>,
  CRCInternalRenderOwner
>();
const ownerStates = new WeakMap<CRCInternalRenderOwner, RenderOwnerState>();

/**
 * Returns the active render owner required by official integration scheduling operations.
 *
 * @returns The render owner for the current runtime context. See {@link CRCInternalRenderOwner}.
 *
 * @see {@link CRCInternalRenderOwner}
 */
export function crcInternalCurrentRenderOwner(): CRCInternalRenderOwner {
  const component = GLOBAL_STATE.componentRefs;
  const instance = GLOBAL_STATE.currentCRCInstance;
  if (!component || !instance) {
    throw new Error(
      'crcInternalCurrentRenderOwner() is only available during CRC component evaluation.',
    );
  }

  const existing = ownersByComponent.get(component);
  if (existing) return existing;

  const owner = {} as CRCInternalRenderOwner;
  const state = {} as RenderOwnerState;
  const schedulerOwner: RendererParticipantOwner = {
    instance,
    isActive: () => state.active && isCurrentOwner(state),
  };
  Object.assign(state, {
    component,
    instance,
    schedulerOwner,
    consumers: new Set<CRCInternalSignalConsumer>(),
    beginCommands: new Set<CRCInternalCommandHandle>(),
    advanceRegistrations: new Set<() => void>(),
    active: true,
  });
  ownersByComponent.set(component, owner);
  ownerStates.set(owner, state);
  component.teardowns.add(() => disposeRenderOwner(owner));
  return owner;
}

/**
 * Creates an owner-scoped dependency consumer for an official renderer integration.
 *
 * @param options - Render owner, optional diagnostic name, and invalidation callback. See
 * {@link CRCInternalRenderOwner} .
 * @returns A consumer that tracks signal dependencies and owns their cleanup. See
 * {@link CRCInternalSignalConsumer} .
 *
 * @see {@link CRCInternalRenderOwner}
 * @see {@link CRCInternalSignalConsumer}
 */
export function crcInternalCreateSignalConsumer(options: {
  owner: CRCInternalRenderOwner;
  debugName?: string;
  invalidate(): void;
}): CRCInternalSignalConsumer {
  const ownerState = requireActiveOwner(options.owner);
  let disposed = false;
  const signalConsumer = createSignalRenderConsumer({
    debugName: options.debugName ??
      `official renderer (${ownerState.component.id})`,
    invalidate: () => {
      if (!disposed && ownerState.schedulerOwner.isActive()) {
        options.invalidate();
      }
    },
  });
  const consumer: CRCInternalSignalConsumer = {
    collect<T>(read: () => T): T {
      if (disposed) {
        throw new Error('Cannot collect signal reads with a disposed CRC renderer consumer.');
      }
      requireActiveOwner(options.owner);
      return collectSignalReads(signalConsumer, () => read());
    },
    markClean(): void {
      if (!disposed) signalConsumer.markClean();
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      ownerState.consumers.delete(consumer);
      disposeSignalRenderConsumer(signalConsumer);
    },
  };
  ownerState.consumers.add(consumer);
  return consumer;
}

/**
 * Requests keyed renderer work in the shared scheduler without creating a second frame loop.
 *
 * @param owner - Owner whose renderer work is being requested. See {@link CRCInternalRenderOwner}.
 * @param request - Work identity, renderer category, and frame callback. See
 * {@link CRCInternalRendererWorkKind} , {@link CRCInternalFrame} .
 *
 * @see {@link CRCInternalRenderOwner}
 * @see {@link CRCInternalRendererWorkKind}
 * @see {@link CRCInternalFrame}
 */
export function crcInternalRequestRendererWork(
  owner: CRCInternalRenderOwner,
  request: {
    key: object;
    kind: CRCInternalRendererWorkKind;
    run(frame: CRCInternalFrame): void;
  },
): void {
  const state = requireActiveOwner(owner);
  requestRendererParticipantWork(state.schedulerOwner, request);
}

/**
 * Rejects commands issued from runtime evaluation contexts that forbid mutation.
 *
 * @see {@link crcInternalQueueBegin}
 */
export function crcInternalAssertCommandAllowed(): void {
  assertSignalCommandAllowed();
}

/**
 * Queues an owner-scoped Begin command and returns a cancellation handle.
 *
 * @param owner - Owner admitting the command. See {@link CRCInternalRenderOwner}.
 * @param callback - Begin-phase callback receiving frame, staged writes, and command sequence. See
 * {@link CRCInternalFrame} , {@link CRCInternalSignalBatch} .
 * @returns A handle that can cancel the queued command. See {@link CRCInternalCommandHandle}.
 *
 * @see {@link CRCInternalRenderOwner}
 * @see {@link CRCInternalFrame}
 * @see {@link CRCInternalSignalBatch}
 * @see {@link CRCInternalCommandHandle}
 */
export function crcInternalQueueBegin(
  owner: CRCInternalRenderOwner,
  callback: (
    frame: CRCInternalFrame,
    batch: CRCInternalSignalBatch,
    sequence: number,
  ) => void,
): CRCInternalCommandHandle {
  const state = requireActiveOwner(owner);
  let handle: CRCInternalCommandHandle;
  const schedulerHandle = queueBeginCommand((frame, batch, sequence) => {
    state.beginCommands.delete(handle);
    if (!state.schedulerOwner.isActive()) return;
    callback(frame, batch, sequence);
  });
  handle = Object.freeze({
    sequence: schedulerHandle.sequence,
    cancel(): void {
      state.beginCommands.delete(handle);
      schedulerHandle.cancel();
    },
  });
  state.beginCommands.add(handle);
  return handle;
}

/**
 * Registers renderer work for shared-frame Advance and returns its unregister callback.
 *
 * @param owner - Owner of the advancing work. See {@link CRCInternalRenderOwner}.
 * @param callback - Advance callback receiving the frame and staged signal writes. See
 * {@link CRCInternalFrame} , {@link CRCInternalSignalBatch} .
 * @returns A function unregistering the Advance callback.
 *
 * @see {@link CRCInternalRenderOwner}
 * @see {@link CRCInternalFrame}
 * @see {@link CRCInternalSignalBatch}
 */
export function crcInternalRegisterAdvance(
  owner: CRCInternalRenderOwner,
  callback: (frame: CRCInternalFrame, batch: CRCInternalSignalBatch) => void,
): () => void {
  const state = requireActiveOwner(owner);
  let released = false;
  const unregister = registerAdvanceParticipant((frame, batch) => {
    if (!state.schedulerOwner.isActive()) return;
    callback(frame, batch);
  });
  const release = (): void => {
    if (released) return;
    released = true;
    state.advanceRegistrations.delete(release);
    unregister();
  };
  state.advanceRegistrations.add(release);
  return release;
}

/**
 * Registers acknowledgement of the current frame's committed staged writes.
 *
 * @param owner - Owner of the pending commit. See {@link CRCInternalRenderOwner}.
 * @param callback - Callback receiving the frame and whether the commit was applied. See
 * {@link CRCInternalFrame} .
 *
 * @see {@link CRCInternalRenderOwner}
 * @see {@link CRCInternalFrame}
 */
export function crcInternalQueueCurrentCommit(
  owner: CRCInternalRenderOwner,
  callback: (
    frame: CRCInternalFrame,
    outcome: Readonly<{ applied: boolean }>,
  ) => void,
): void {
  const state = requireActiveOwner(owner);
  queueCurrentFrameCommitAcknowledgement((frame, outcome) => {
    if (!state.schedulerOwner.isActive()) return;
    callback(frame, outcome);
  });
}

/**
 * Queues an owner-scoped completion callback in the current scheduler transaction.
 *
 * @param owner - Owner of the completion work. See {@link CRCInternalRenderOwner}.
 * @param callback - Callback invoked during Complete with the shared frame. See
 * {@link CRCInternalFrame} .
 *
 * @see {@link CRCInternalRenderOwner}
 * @see {@link CRCInternalFrame}
 */
export function crcInternalQueueCurrentComplete(
  owner: CRCInternalRenderOwner,
  callback: (frame: CRCInternalFrame) => void,
): void {
  const state = requireActiveOwner(owner);
  queueCurrentFrameCompletion(frame => {
    if (!state.schedulerOwner.isActive()) return;
    callback(frame);
  });
}

/**
 * Marks the owning renderer dirty and requests shared scheduler work.
 *
 * @param owner - Owner whose renderer should become dirty. See {@link CRCInternalRenderOwner}.
 *
 * @see {@link CRCInternalRenderOwner}
 */
export function crcInternalRequestRender(owner: CRCInternalRenderOwner): void {
  const state = requireActiveOwner(owner);
  requestInstanceRender(state.instance);
}

/**
 * Registers a callback reporting the outcome of the owner's render transaction.
 *
 * @param owner - Owner of the rendering transaction. See {@link CRCInternalRenderOwner}.
 * @param callback - Callback receiving whether the transaction succeeded.
 *
 * @see {@link CRCInternalRenderOwner}
 */
export function crcInternalOnRenderFinish(
  owner: CRCInternalRenderOwner,
  callback: (success: boolean) => void,
): void {
  const state = requireActiveOwner(owner);
  if (
    GLOBAL_STATE.componentRefs !== state.component ||
    GLOBAL_STATE.currentCRCInstance !== state.instance ||
    !GLOBAL_STATE.renderTransaction
  ) {
    throw new Error(
      'crcInternalOnRenderFinish() requires its owner to be the currently evaluating CRC component.',
    );
  }
  GLOBAL_STATE.renderTransaction.onFinish(success => {
    if (success && !state.schedulerOwner.isActive()) return;
    callback(success);
  });
}

/**
 * Registers one painted logical target with its handlers, geometry, and participation policy.
 *
 * @param handlers - Handlers for the painted target. See {@link CRCEventHandlers}.
 * @param options - Hit geometry and focus metadata. See {@link CRCEventTargetOptions}.
 * @param pointerEvents - Pointer participation policy; defaults to auto. See
 * {@link CRCPointerEvents} .
 * @returns The painted event target snapshot. See {@link CRCEventTargetSnapshot}.
 *
 * @see {@link CRCEventHandlers}
 * @see {@link CRCEventTargetOptions}
 * @see {@link CRCPointerEvents}
 * @see {@link CRCEventTargetSnapshot}
 */
export function crcInternalPaintTarget(
  handlers: CRCEventHandlers,
  options: CRCEventTargetOptions,
  pointerEvents: CRCPointerEvents = 'auto',
): CRCEventTargetSnapshot {
  return usePaintTarget(handlers, options, pointerEvents);
}

/**
 * Returns timing and phase information for the current shared scheduler frame.
 *
 * @returns The shared scheduler frame for the active phase. See {@link CRCInternalFrame}.
 *
 * @see {@link CRCInternalFrame}
 */
export function crcInternalCurrentFrame(): CRCInternalFrame {
  const frame = getCurrentFrameSnapshot();
  if (!frame) {
    throw new Error('crcInternalCurrentFrame() requires a current CRC frame.');
  }
  return frame;
}

/**
 * Queues an owner-scoped callback for a scheduler Complete phase.
 *
 * @param owner - Owner of the completion work. See {@link CRCInternalRenderOwner}.
 * @param callback - Callback invoked during Complete with the shared frame. See
 * {@link CRCInternalFrame} .
 *
 * @see {@link CRCInternalRenderOwner}
 * @see {@link CRCInternalFrame}
 */
export function crcInternalQueueComplete(
  owner: CRCInternalRenderOwner,
  callback: (frame: CRCInternalFrame) => void,
): void {
  const state = requireActiveOwner(owner);
  queueRendererParticipantComplete(state.schedulerOwner, callback);
}

function requireActiveOwner(owner: CRCInternalRenderOwner): RenderOwnerState {
  const state = ownerStates.get(owner);
  if (!state || !state.active || !isCurrentOwner(state)) {
    throw new TypeError('Expected an active CRC internal render owner.');
  }
  return state;
}

function isCurrentOwner(state: RenderOwnerState): boolean {
  return !state.component.teardowns.closed &&
    !state.instance.mainTeardowns.closed &&
    GLOBAL_STATE.crcInstances.get(state.instance.canvas) === state.instance &&
    state.instance.refs.get(state.component.id) === state.component;
}

function disposeRenderOwner(owner: CRCInternalRenderOwner): void {
  const state = ownerStates.get(owner);
  if (!state || !state.active) return;
  state.active = false;
  for (const command of Array.from(state.beginCommands)) {
    command.cancel();
  }
  state.beginCommands.clear();
  for (const release of Array.from(state.advanceRegistrations)) {
    release();
  }
  state.advanceRegistrations.clear();
  removeRendererParticipantOwner(state.schedulerOwner);
  for (const consumer of Array.from(state.consumers)) {
    consumer.dispose();
  }
  state.consumers.clear();
}
