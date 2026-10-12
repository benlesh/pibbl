import type { pibblInternalQueueSimulationBegin } from './simulation-participant.js';
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
  PibblEventHandlers,
  PibblEventTargetOptions,
  PibblEventTargetSnapshot,
  PibblPointerEvents,
} from '../events/types.js';
import type { PibblComponentRefs, PibblInstance } from '../types.js';
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
 * @see {@link pibblInternalCreateSignalConsumer}
 * @see {@link pibblInternalCurrentRenderOwner}
 * @see {@link pibblInternalOnRenderFinish}
 */
export interface PibblInternalRenderOwner {
  readonly [internalRenderOwnerBrand]: true;
}

/**
 * Shared scheduler frame identity, logical timing, and admission context.
 *
 * @see {@link pibblInternalCurrentFrame}
 * @see {@link pibblInternalQueueBegin}
 * @see {@link pibblInternalQueueComplete}
 */
export interface PibblInternalFrame {
  /** Identifier of the shared scheduler frame. See {@link PibblInternalFrame}. */
  readonly frameId: number;
  /** Logical scheduler time in milliseconds. See {@link PibblInternalFrame}. */
  readonly logicalTime: number;
}

/**
 * Staged signal writes published together during scheduler Commit.
 *
 * @see {@link WritableSignal}
 * @see {@link pibblInternalQueueBegin}
 * @see {@link pibblInternalRegisterAdvance}
 * @see {@link pibblInternalQueueSimulationBegin}
 */
export interface PibblInternalSignalBatch {
  /**
   * Reads the current committed values required by this integration. See
   * {@link PibblInternalSignalBatch}.
   * @param signal - Signal whose staged or committed value should be read. See
   * {@link WritableSignal} .
   * @returns The current batch value, falling back to the committed signal value.
   */
  read<T>(signal: WritableSignal<T>): T;
  /**
   * Stages a signal write for publication during Commit. See {@link PibblInternalSignalBatch}.
   * @param signal - Signal that will receive the value during Commit. See {@link WritableSignal}.
   * @param value - Value to stage.
   * @param writer - Identity used to attribute and discard staged writes.
   */
  stage<T>(signal: WritableSignal<T>, value: T, writer: object): void;
  /**
   * Discards writes belonging to the specified writer. See {@link PibblInternalSignalBatch}.
   * @param writer - Writer identity whose pending writes should be discarded.
   */
  discardWriter(writer: object): void;
}

/**
 * Sequence identity and cancellation capability for a queued scheduler command.
 *
 * @see {@link pibblInternalQueueBegin}
 */
export interface PibblInternalCommandHandle {
  /**
   * Sequence number assigned when the scheduler command is queued. See
   * {@link PibblInternalCommandHandle}.
   */
  readonly sequence: number;
  /**
   * Cancels this queued command before it is admitted by the scheduler. See
   * {@link PibblInternalCommandHandle}.
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
 * @see {@link pibblInternalRequestRendererWork}
 */
export type PibblInternalRendererWorkKind = 'resource' | 'draw' | 'compose';

/**
 * Dependency tracking and disposal operations for an integration-owned signal consumer.
 *
 * @see {@link pibblInternalCreateSignalConsumer}
 */
export interface PibblInternalSignalConsumer {
  /**
   * Evaluates a callback while collecting signal dependencies for this consumer. See
   * {@link PibblInternalSignalConsumer}.
   * @param read - Synchronous computation whose signal dependencies are collected.
   * @returns The computation's return value.
   */
  collect<T>(read: () => T): T;
  /**
   * Acknowledges the consumer's current invalidation as processed. See
   * {@link PibblInternalSignalConsumer}.
   */
  markClean(): void;
  /** Releases resources owned by this mounted object. See {@link PibblInternalSignalConsumer}. */
  dispose(): void;
}

interface RenderOwnerState {
  readonly component: PibblComponentRefs<any>;
  readonly instance: PibblInstance;
  readonly schedulerOwner: RendererParticipantOwner;
  readonly consumers: Set<PibblInternalSignalConsumer>;
  readonly beginCommands: Set<PibblInternalCommandHandle>;
  readonly advanceRegistrations: Set<() => void>;
  active: boolean;
}

const ownersByComponent = new WeakMap<
  PibblComponentRefs<any>,
  PibblInternalRenderOwner
>();
const ownerStates = new WeakMap<PibblInternalRenderOwner, RenderOwnerState>();

/**
 * Returns the active render owner required by official integration scheduling operations.
 *
 * @returns The render owner for the current runtime context. See {@link PibblInternalRenderOwner}.
 *
 * @see {@link PibblInternalRenderOwner}
 */
export function pibblInternalCurrentRenderOwner(): PibblInternalRenderOwner {
  const component = GLOBAL_STATE.componentRefs;
  const instance = GLOBAL_STATE.currentPibblInstance;
  if (!component || !instance) {
    throw new Error(
      'pibblInternalCurrentRenderOwner() is only available during Pibbl component evaluation.',
    );
  }

  const existing = ownersByComponent.get(component);
  if (existing) return existing;

  const owner = {} as PibblInternalRenderOwner;
  const state = {} as RenderOwnerState;
  const schedulerOwner: RendererParticipantOwner = {
    instance,
    isActive: () => state.active && isCurrentOwner(state),
  };
  Object.assign(state, {
    component,
    instance,
    schedulerOwner,
    consumers: new Set<PibblInternalSignalConsumer>(),
    beginCommands: new Set<PibblInternalCommandHandle>(),
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
 * {@link PibblInternalRenderOwner} .
 * @returns A consumer that tracks signal dependencies and owns their cleanup. See
 * {@link PibblInternalSignalConsumer} .
 *
 * @see {@link PibblInternalRenderOwner}
 * @see {@link PibblInternalSignalConsumer}
 */
export function pibblInternalCreateSignalConsumer(options: {
  owner: PibblInternalRenderOwner;
  debugName?: string;
  invalidate(): void;
}): PibblInternalSignalConsumer {
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
  const consumer: PibblInternalSignalConsumer = {
    collect<T>(read: () => T): T {
      if (disposed) {
        throw new Error('Cannot collect signal reads with a disposed Pibbl renderer consumer.');
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
 * @param owner - Owner whose renderer work is being requested. See {@link PibblInternalRenderOwner}.
 * @param request - Work identity, renderer category, and frame callback. See
 * {@link PibblInternalRendererWorkKind} , {@link PibblInternalFrame} .
 *
 * @see {@link PibblInternalRenderOwner}
 * @see {@link PibblInternalRendererWorkKind}
 * @see {@link PibblInternalFrame}
 */
export function pibblInternalRequestRendererWork(
  owner: PibblInternalRenderOwner,
  request: {
    key: object;
    kind: PibblInternalRendererWorkKind;
    run(frame: PibblInternalFrame): void;
  },
): void {
  const state = requireActiveOwner(owner);
  requestRendererParticipantWork(state.schedulerOwner, request);
}

/**
 * Rejects commands issued from runtime evaluation contexts that forbid mutation.
 *
 * @see {@link pibblInternalQueueBegin}
 */
export function pibblInternalAssertCommandAllowed(): void {
  assertSignalCommandAllowed();
}

/**
 * Queues an owner-scoped Begin command and returns a cancellation handle.
 *
 * @param owner - Owner admitting the command. See {@link PibblInternalRenderOwner}.
 * @param callback - Begin-phase callback receiving frame, staged writes, and command sequence. See
 * {@link PibblInternalFrame} , {@link PibblInternalSignalBatch} .
 * @returns A handle that can cancel the queued command. See {@link PibblInternalCommandHandle}.
 *
 * @see {@link PibblInternalRenderOwner}
 * @see {@link PibblInternalFrame}
 * @see {@link PibblInternalSignalBatch}
 * @see {@link PibblInternalCommandHandle}
 */
export function pibblInternalQueueBegin(
  owner: PibblInternalRenderOwner,
  callback: (
    frame: PibblInternalFrame,
    batch: PibblInternalSignalBatch,
    sequence: number,
  ) => void,
): PibblInternalCommandHandle {
  const state = requireActiveOwner(owner);
  let handle: PibblInternalCommandHandle;
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
 * @param owner - Owner of the advancing work. See {@link PibblInternalRenderOwner}.
 * @param callback - Advance callback receiving the frame and staged signal writes. See
 * {@link PibblInternalFrame} , {@link PibblInternalSignalBatch} .
 * @returns A function unregistering the Advance callback.
 *
 * @see {@link PibblInternalRenderOwner}
 * @see {@link PibblInternalFrame}
 * @see {@link PibblInternalSignalBatch}
 */
export function pibblInternalRegisterAdvance(
  owner: PibblInternalRenderOwner,
  callback: (frame: PibblInternalFrame, batch: PibblInternalSignalBatch) => void,
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
 * @param owner - Owner of the pending commit. See {@link PibblInternalRenderOwner}.
 * @param callback - Callback receiving the frame and whether the commit was applied. See
 * {@link PibblInternalFrame} .
 *
 * @see {@link PibblInternalRenderOwner}
 * @see {@link PibblInternalFrame}
 */
export function pibblInternalQueueCurrentCommit(
  owner: PibblInternalRenderOwner,
  callback: (
    frame: PibblInternalFrame,
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
 * @param owner - Owner of the completion work. See {@link PibblInternalRenderOwner}.
 * @param callback - Callback invoked during Complete with the shared frame. See
 * {@link PibblInternalFrame} .
 *
 * @see {@link PibblInternalRenderOwner}
 * @see {@link PibblInternalFrame}
 */
export function pibblInternalQueueCurrentComplete(
  owner: PibblInternalRenderOwner,
  callback: (frame: PibblInternalFrame) => void,
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
 * @param owner - Owner whose renderer should become dirty. See {@link PibblInternalRenderOwner}.
 *
 * @see {@link PibblInternalRenderOwner}
 */
export function pibblInternalRequestRender(owner: PibblInternalRenderOwner): void {
  const state = requireActiveOwner(owner);
  requestInstanceRender(state.instance);
}

/**
 * Registers a callback reporting the outcome of the owner's render transaction.
 *
 * @param owner - Owner of the rendering transaction. See {@link PibblInternalRenderOwner}.
 * @param callback - Callback receiving whether the transaction succeeded.
 *
 * @see {@link PibblInternalRenderOwner}
 */
export function pibblInternalOnRenderFinish(
  owner: PibblInternalRenderOwner,
  callback: (success: boolean) => void,
): void {
  const state = requireActiveOwner(owner);
  if (
    GLOBAL_STATE.componentRefs !== state.component ||
    GLOBAL_STATE.currentPibblInstance !== state.instance ||
    !GLOBAL_STATE.renderTransaction
  ) {
    throw new Error(
      'pibblInternalOnRenderFinish() requires its owner to be the currently evaluating Pibbl component.',
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
 * @param handlers - Handlers for the painted target. See {@link PibblEventHandlers}.
 * @param options - Hit geometry and focus metadata. See {@link PibblEventTargetOptions}.
 * @param pointerEvents - Pointer participation policy; defaults to auto. See
 * {@link PibblPointerEvents} .
 * @returns The painted event target snapshot. See {@link PibblEventTargetSnapshot}.
 *
 * @see {@link PibblEventHandlers}
 * @see {@link PibblEventTargetOptions}
 * @see {@link PibblPointerEvents}
 * @see {@link PibblEventTargetSnapshot}
 */
export function pibblInternalPaintTarget(
  handlers: PibblEventHandlers,
  options: PibblEventTargetOptions,
  pointerEvents: PibblPointerEvents = 'auto',
): PibblEventTargetSnapshot {
  return usePaintTarget(handlers, options, pointerEvents);
}

/**
 * Returns timing and phase information for the current shared scheduler frame.
 *
 * @returns The shared scheduler frame for the active phase. See {@link PibblInternalFrame}.
 *
 * @see {@link PibblInternalFrame}
 */
export function pibblInternalCurrentFrame(): PibblInternalFrame {
  const frame = getCurrentFrameSnapshot();
  if (!frame) {
    throw new Error('pibblInternalCurrentFrame() requires a current Pibbl frame.');
  }
  return frame;
}

/**
 * Queues an owner-scoped callback for a scheduler Complete phase.
 *
 * @param owner - Owner of the completion work. See {@link PibblInternalRenderOwner}.
 * @param callback - Callback invoked during Complete with the shared frame. See
 * {@link PibblInternalFrame} .
 *
 * @see {@link PibblInternalRenderOwner}
 * @see {@link PibblInternalFrame}
 */
export function pibblInternalQueueComplete(
  owner: PibblInternalRenderOwner,
  callback: (frame: PibblInternalFrame) => void,
): void {
  const state = requireActiveOwner(owner);
  queueRendererParticipantComplete(state.schedulerOwner, callback);
}

function requireActiveOwner(owner: PibblInternalRenderOwner): RenderOwnerState {
  const state = ownerStates.get(owner);
  if (!state || !state.active || !isCurrentOwner(state)) {
    throw new TypeError('Expected an active Pibbl internal render owner.');
  }
  return state;
}

function isCurrentOwner(state: RenderOwnerState): boolean {
  return !state.component.teardowns.closed &&
    !state.instance.mainTeardowns.closed &&
    GLOBAL_STATE.pibblInstances.get(state.instance.canvas) === state.instance &&
    state.instance.refs.get(state.component.id) === state.component;
}

function disposeRenderOwner(owner: PibblInternalRenderOwner): void {
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
