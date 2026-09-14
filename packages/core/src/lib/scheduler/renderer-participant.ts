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
import { crcPaintTarget } from '../hooks/crc-paint-target.js';
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

export interface CRCInternalRenderOwner {
  readonly [internalRenderOwnerBrand]: true;
}

export interface CRCInternalFrame {
  readonly frameId: number;
  readonly logicalTime: number;
}

export interface CRCInternalSignalBatch {
  read<T>(signal: WritableSignal<T>): T;
  stage<T>(signal: WritableSignal<T>, value: T, writer: object): void;
  discardWriter(writer: object): void;
}

export interface CRCInternalCommandHandle {
  readonly sequence: number;
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
 */
export type CRCInternalRendererWorkKind = 'resource' | 'draw' | 'compose';

export interface CRCInternalSignalConsumer {
  collect<T>(read: () => T): T;
  markClean(): void;
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

export function crcInternalAssertCommandAllowed(): void {
  assertSignalCommandAllowed();
}

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

export function crcInternalRequestRender(owner: CRCInternalRenderOwner): void {
  const state = requireActiveOwner(owner);
  requestInstanceRender(state.instance);
}

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

export function crcInternalPaintTarget(
  handlers: CRCEventHandlers,
  options: CRCEventTargetOptions,
  pointerEvents: CRCPointerEvents = 'auto',
): CRCEventTargetSnapshot {
  return crcPaintTarget(handlers, options, pointerEvents);
}

export function crcInternalCurrentFrame(): CRCInternalFrame {
  const frame = getCurrentFrameSnapshot();
  if (!frame) {
    throw new Error('crcInternalCurrentFrame() requires a current CRC frame.');
  }
  return frame;
}

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
