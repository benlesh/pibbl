import { GLOBAL_STATE } from "../global-state.js";
import { requireHookContext, useInternalHookSlot } from "../hooks/hook-slot.js";
import {
  discardSignalCommitBatchProvenance,
  discardSignalCommitBatchWriterForProvenance,
  stageSignalCommitBatchWithProvenance,
  type SignalCommitBatch,
} from "../signals/graph.js";
import type { WritableSignal } from "../signals/types.js";
import type { PibblComponentRefs, PibblInstance } from "../types.js";
import {
  queueBeginCommand,
  queueCurrentFrameCommitAcknowledgement,
  queueCurrentFrameCompletion,
  registerAdvanceParticipant,
  requestInstanceRender,
} from "./realm-scheduler.js";
import type { PibblAdvanceLane, PibblBeginCommandHandle } from "./types.js";
import type {
  PibblInternalFrame,
  PibblInternalSignalBatch,
} from "./renderer-participant.js";

/**
 * The scheduler lane in which an official simulation integration advances.
 *
 * @see {@link pibblInternalRegisterSimulationAdvance}
 */
export type PibblInternalAdvanceLane = PibblAdvanceLane;

declare const internalSimulationOwnerBrand: unique symbol;
/**
 * Opaque ownership identity tying simulation work to a mounted runtime resource.
 *
 * @see {@link pibblInternalCurrentSimulationOwner}
 * @see {@link pibblInternalOnSimulationRenderTransactionFinish}
 * @see {@link pibblInternalQueueSimulationBegin}
 */
export interface PibblInternalSimulationOwner {
  readonly [internalSimulationOwnerBrand]: true;
}

interface SimulationOwnerState {
  readonly component: PibblComponentRefs<any>;
  readonly instance: PibblInstance;
  readonly cancellations: Set<() => void>;
  active: boolean;
}

const ownerStates = new WeakMap<
  PibblInternalSimulationOwner,
  SimulationOwnerState
>();
const batchViews = new WeakMap<SignalCommitBatch, PibblInternalSignalBatch>();
let currentSimulationOwner: PibblInternalSimulationOwner | undefined;

/**
 * Returns the active mount's simulation owner for a matching official integration.
 *
 * @returns The simulation owner for the active runtime context. See
 * {@link PibblInternalSimulationOwner} .
 *
 * @see {@link PibblInternalSimulationOwner}
 */
export function pibblInternalCurrentSimulationOwner(): PibblInternalSimulationOwner {
  const { componentRefs, pibblInstance } = requireHookContext();
  const slot = useInternalHookSlot<PibblInternalSimulationOwner>(
    "internalSimulationOwner",
    (teardowns) => {
      const owner = {} as PibblInternalSimulationOwner;
      ownerStates.set(owner, {
        component: componentRefs,
        instance: pibblInstance,
        cancellations: new Set(),
        active: true,
      });
      teardowns.add(() => disposeSimulationOwner(owner));
      return owner;
    },
  );
  requireActiveOwner(slot.value);
  return slot.value;
}

/**
 * Queues a cancellable simulation command for the shared scheduler's Begin phase.
 *
 * @param owner - Simulation owner admitting this command. See {@link PibblInternalSimulationOwner}.
 * @param command - Begin-phase work receiving frame, staged signal writes, and command sequence.
 * See {@link PibblInternalFrame} , {@link PibblInternalSignalBatch} .
 * @returns A command sequence and cancellation handle.
 *
 * @see {@link PibblInternalSimulationOwner}
 * @see {@link PibblInternalFrame}
 * @see {@link PibblInternalSignalBatch}
 */
export function pibblInternalQueueSimulationBegin(
  owner: PibblInternalSimulationOwner,
  command: (
    frame: PibblInternalFrame,
    batch: PibblInternalSignalBatch,
    sequence: number,
  ) => void,
): Readonly<{ readonly sequence: number; cancel(): void }> {
  const state = requireActiveOwner(owner);
  let active = true;
  let handle: PibblBeginCommandHandle;
  const cancel = (): void => {
    if (!active) return;
    active = false;
    state.cancellations.delete(cancel);
    handle.cancel();
  };
  handle = queueBeginCommand((frame, batch, sequence) => {
    if (!active) return;
    active = false;
    state.cancellations.delete(cancel);
    if (!isCurrentOwner(state)) return;
    try {
      withCurrentSimulationOwner(owner, () => {
        command(frame, simulationBatchView(batch), sequence);
      });
      if (!isCurrentOwner(state)) {
        discardSimulationOwnerWriters(batch, owner);
      }
    } catch (error) {
      discardSimulationOwnerWriters(batch, owner);
      throw error;
    }
  });
  state.cancellations.add(cancel);
  return Object.freeze({ sequence: handle.sequence, cancel });
}

/**
 * Registers work in a simulation Advance lane and returns its unregister callback.
 *
 * @param owner - Simulation owner registering the work. See {@link PibblInternalSimulationOwner}.
 * @param lane - Advance lane controlling execution order. See {@link PibblInternalAdvanceLane}.
 * @param advance - Advance callback receiving frame timing and staged signal writes. See
 * {@link PibblInternalFrame} , {@link PibblInternalSignalBatch} .
 * @param requestsFrames - Whether this participant requests subsequent host frames; defaults to
 * true.
 * @returns A function that unregisters the participant.
 *
 * @see {@link PibblInternalSimulationOwner}
 * @see {@link PibblInternalAdvanceLane}
 * @see {@link PibblInternalFrame}
 * @see {@link PibblInternalSignalBatch}
 */
export function pibblInternalRegisterSimulationAdvance(
  owner: PibblInternalSimulationOwner,
  lane: PibblInternalAdvanceLane,
  advance: (frame: PibblInternalFrame, batch: PibblInternalSignalBatch) => void,
  requestsFrames = true,
): () => void {
  const state = requireActiveOwner(owner);
  let active = true;
  let unregister: () => void;
  const release = (): void => {
    if (!active) return;
    active = false;
    state.cancellations.delete(release);
    unregister();
  };
  unregister = registerAdvanceParticipant(
    (frame, batch) => {
      if (!active || !isCurrentOwner(state)) return;
      try {
        withCurrentSimulationOwner(owner, () => {
          advance(frame, simulationBatchView(batch));
        });
        if (!isCurrentOwner(state)) {
          discardSimulationOwnerWriters(batch, owner);
        }
      } catch (error) {
        discardSimulationOwnerWriters(batch, owner);
        throw error;
      }
    },
    lane,
    requestsFrames,
  );
  state.cancellations.add(release);
  return release;
}

/**
 * Reports whether the current simulation frame's staged writes were committed.
 *
 * @param owner - Owner of the pending commit. See {@link PibblInternalSimulationOwner}.
 * @param callback - Callback receiving the frame and whether the commit was applied. See
 * {@link PibblInternalFrame} .
 *
 * @see {@link PibblInternalSimulationOwner}
 * @see {@link PibblInternalFrame}
 */
export function pibblInternalQueueSimulationCommitAcknowledgement(
  owner: PibblInternalSimulationOwner,
  callback: (
    frame: PibblInternalFrame,
    outcome: Readonly<{ readonly applied: boolean }>,
  ) => void,
): void {
  const state = requireActiveOwner(owner);
  let active = true;
  let cancelQueued = () => {};
  const cancel = (): void => {
    if (!active) return;
    active = false;
    state.cancellations.delete(cancel);
    cancelQueued();
  };
  cancelQueued = queueCurrentFrameCommitAcknowledgement((frame, outcome) => {
    if (!active) return;
    active = false;
    state.cancellations.delete(cancel);
    if (isCurrentOwner(state)) callback(frame, outcome);
  });
  state.cancellations.add(cancel);
}

/**
 * Queues an owner-scoped callback for the scheduler's Complete phase.
 *
 * @param owner - Owner of the completion work. See {@link PibblInternalSimulationOwner}.
 * @param callback - Callback invoked during Complete with the shared frame. See
 * {@link PibblInternalFrame} .
 *
 * @see {@link PibblInternalSimulationOwner}
 * @see {@link PibblInternalFrame}
 */
export function pibblInternalQueueSimulationComplete(
  owner: PibblInternalSimulationOwner,
  callback: (frame: PibblInternalFrame) => void,
): void {
  const state = requireActiveOwner(owner);
  let active = true;
  let cancelQueued = () => {};
  const cancel = (): void => {
    if (!active) return;
    active = false;
    state.cancellations.delete(cancel);
    cancelQueued();
  };
  cancelQueued = queueCurrentFrameCompletion((frame) => {
    if (!active) return;
    active = false;
    state.cancellations.delete(cancel);
    if (isCurrentOwner(state)) callback(frame);
  });
  state.cancellations.add(cancel);
}

/**
 * Invalidates the renderer associated with a simulation owner.
 *
 * @param owner - Owner whose renderer should become dirty. See {@link PibblInternalSimulationOwner}.
 *
 * @see {@link PibblInternalSimulationOwner}
 */
export function pibblInternalRequestSimulationRender(
  owner: PibblInternalSimulationOwner,
): void {
  const state = requireActiveOwner(owner);
  requestInstanceRender(state.instance);
}

/**
 * Registers a callback reporting whether the owner's current render transaction succeeded.
 *
 * @param owner - Owner of the rendering transaction. See {@link PibblInternalSimulationOwner}.
 * @param callback - Callback receiving whether the transaction succeeded.
 *
 * @see {@link PibblInternalSimulationOwner}
 */
export function pibblInternalOnSimulationRenderTransactionFinish(
  owner: PibblInternalSimulationOwner,
  callback: (success: boolean) => void,
): void {
  const state = requireActiveOwner(owner);
  const transaction = state.instance.eventRoot.renderTransaction;
  if (!transaction) {
    throw new Error(
      "pibblInternalOnSimulationRenderTransactionFinish() requires an active Pibbl render transaction.",
    );
  }
  let active = true;
  const cancel = (): void => {
    if (!active) return;
    active = false;
    state.cancellations.delete(cancel);
  };
  state.cancellations.add(cancel);
  transaction.onFinish((success) => {
    if (!active) return;
    active = false;
    state.cancellations.delete(cancel);
    if (isCurrentOwner(state)) callback(success);
  });
}

function simulationBatchView(batch: SignalCommitBatch): PibblInternalSignalBatch {
  const existing = batchViews.get(batch);
  if (existing) return existing;
  const view = Object.freeze({
    read<T>(signal: WritableSignal<T>): T {
      return batch.read(signal);
    },
    stage<T>(signal: WritableSignal<T>, value: T, writer: object): void {
      const owner = currentSimulationOwner;
      if (owner === undefined) {
        throw new Error(
          "Pibbl internal simulation batches may only stage during their owning callback.",
        );
      }
      stageSignalCommitBatchWithProvenance(batch, owner, signal, value, writer);
    },
    discardWriter(writer: object): void {
      const owner = currentSimulationOwner;
      if (owner === undefined) {
        throw new Error(
          "Pibbl internal simulation batches may only discard during their owning callback.",
        );
      }
      discardSignalCommitBatchWriterForProvenance(batch, owner, writer);
    },
  });
  batchViews.set(batch, view);
  return view;
}

function withCurrentSimulationOwner<T>(
  owner: PibblInternalSimulationOwner,
  callback: () => T,
): T {
  const previous = currentSimulationOwner;
  currentSimulationOwner = owner;
  try {
    return callback();
  } finally {
    currentSimulationOwner = previous;
  }
}

function discardSimulationOwnerWriters(
  batch: SignalCommitBatch,
  owner: PibblInternalSimulationOwner,
): void {
  discardSignalCommitBatchProvenance(batch, owner);
}

function requireActiveOwner(
  owner: PibblInternalSimulationOwner,
): SimulationOwnerState {
  const state = ownerStates.get(owner);
  if (!state || !state.active || !isCurrentOwner(state)) {
    throw new TypeError("Expected an active Pibbl internal simulation owner.");
  }
  return state;
}

function isCurrentOwner(state: SimulationOwnerState): boolean {
  return (
    !state.component.teardowns.closed &&
    !state.instance.mainTeardowns.closed &&
    GLOBAL_STATE.pibblInstances.get(state.instance.canvas) === state.instance &&
    state.instance.refs.get(state.component.id) === state.component
  );
}

function disposeSimulationOwner(owner: PibblInternalSimulationOwner): void {
  const state = ownerStates.get(owner);
  if (!state || !state.active) return;
  state.active = false;
  for (const cancel of Array.from(state.cancellations)) cancel();
  state.cancellations.clear();
}
