import {
  crcInternalCurrentRenderOwner,
  crcInternalOnRenderFinish,
  useInternalHookSlot,
  type CRCInternalRenderOwner,
} from "@crc/core/internal";
import type { CompiledEffect2D, CompiledEffect3D } from "../compiler.js";
import type {
  CRCParticleExecution,
  CRCParticleSystem,
  CRCParticleSystemEvent,
  CRCParticleSystemStatus,
} from "../types.js";
import {
  getParticleSystemController,
  type ParticleBindingObservers,
  type ParticleBindingReservation,
  type ParticleSystemController,
} from "./controller.js";

export type CompiledParticleEffect = CompiledEffect2D | CompiledEffect3D;

export interface ParticleBindingCandidate {
  readonly owner: CRCInternalRenderOwner;
  readonly backend: "canvas" | "webgl";
  readonly execution: CRCParticleExecution;
  readonly compiled: CompiledParticleEffect;
  readonly parameters: Readonly<Float64Array>;
  requestRender(): void;
  adoptFrame(frame: ParticleSystemFrame): void;
  clear(): void;
  dispose(): void;
}

export interface ParticleSystemFrame {
  readonly generation: number;
  readonly frameId: number;
  readonly logicalTime: number;
  readonly effectTimeMilliseconds: number;
  readonly previousEffectTimeMilliseconds: number;
  readonly seed: number;
  readonly status: CRCParticleSystemStatus;
}

export interface ParticleSystemBindingInput {
  readonly system: CRCParticleSystem;
  readonly backend: "canvas" | "webgl";
  readonly create: (owner: CRCInternalRenderOwner) => ParticleBindingCandidate;
  readonly onEvent?: (event: CRCParticleSystemEvent) => void;
  readonly onError?: (error: unknown) => void;
}

interface ParticleBindingHookSlot {
  controller: ParticleSystemController;
  committedController: ParticleSystemController | undefined;
  owner: CRCInternalRenderOwner;
  committed: ParticleBindingCandidate | undefined;
  pending: ParticleBindingCandidate | undefined;
  reservation: ParticleBindingReservation | undefined;
  latestOnEvent: ((event: CRCParticleSystemEvent) => void) | undefined;
  latestOnError: ((error: unknown) => void) | undefined;
  revision: number;
  disposed: boolean;
  readonly observers: ParticleBindingObservers;
}

/**
 * Reserves, validates, and transactionally adopts one renderer-owned particle
 * candidate. The factory is deliberately called only after conflict checking.
 */
export function useParticleSystemBinding(
  input: ParticleSystemBindingInput,
): ParticleBindingCandidate {
  const owner = crcInternalCurrentRenderOwner();
  const controller = getParticleSystemController(input.system);
  const slot = useInternalHookSlot<ParticleBindingHookSlot>(
    "particle-system-binding",
    (teardowns) => {
      let value!: ParticleBindingHookSlot;
      const observers: ParticleBindingObservers = Object.freeze({
        onEvent(event: CRCParticleSystemEvent) {
          value.latestOnEvent?.(event);
        },
        onError(error: unknown) {
          value.latestOnError?.(error);
        },
      });
      value = {
        controller,
        committedController: undefined,
        owner,
        committed: undefined,
        pending: undefined,
        reservation: undefined,
        latestOnEvent: undefined,
        latestOnError: undefined,
        revision: 0,
        disposed: false,
        observers,
      };
      teardowns.add(() => {
        value.disposed = true;
        const pending = value.pending;
        value.controller.cancelBindingReservation(value.reservation);
        value.reservation = undefined;
        value.pending = undefined;
        if (pending !== undefined && pending !== value.committed) {
          value.controller.discardBindingCandidate(
            pending,
            "dispose-pending-binding",
          );
        }
        value.committedController?.releaseBinding(value.owner, value.committed);
        value.committedController = undefined;
        value.committed = undefined;
      });
      return value;
    },
  ).value;

  if (slot.owner !== owner) {
    throw new Error("A CRC particle binding hook changed render ownership.");
  }
  if (slot.controller !== controller) {
    slot.controller.cancelBindingReservation(slot.reservation);
    slot.controller = controller;
    slot.pending = undefined;
    slot.reservation = undefined;
  }

  const reservation = controller.reserveBinding(owner, input.backend);
  slot.reservation = reservation;
  let candidate: ParticleBindingCandidate | undefined;
  try {
    candidate = input.create(owner);
    controller.validateBindingCandidate(reservation, candidate);
  } catch (error) {
    controller.cancelBindingReservation(reservation);
    slot.reservation = undefined;
    if (candidate !== undefined && candidate !== slot.committed) {
      controller.discardBindingCandidate(candidate, "dispose-invalid-binding");
    }
    throw error;
  }

  const revision = ++slot.revision;
  slot.pending = candidate;
  crcInternalOnRenderFinish(owner, (success) => {
    if (slot.disposed) return;
    if (revision !== slot.revision) {
      controller.cancelBindingReservation(reservation);
      if (candidate !== slot.committed) {
        controller.discardBindingCandidate(candidate, "dispose-stale-binding");
      }
      return;
    }
    slot.pending = undefined;
    slot.reservation = undefined;
    if (!success) {
      controller.recordRendererTransaction(owner, false);
      if (slot.committedController !== controller) {
        slot.committedController?.recordRendererTransaction(owner, false);
      }
      controller.cancelBindingReservation(reservation);
      if (candidate !== slot.committed) {
        controller.discardBindingCandidate(candidate, "dispose-failed-binding");
      }
      return;
    }
    slot.latestOnEvent = input.onEvent;
    slot.latestOnError = input.onError;
    const previousController = slot.committedController;
    const previousCandidate = slot.committed;
    controller.adoptBinding(reservation, candidate, slot.observers);
    slot.committedController = controller;
    slot.committed = candidate;
    if (previousController !== undefined && previousController !== controller) {
      previousController.releaseBinding(slot.owner, previousCandidate);
    }
    controller.recordRendererTransaction(owner, true);
  });
  return candidate;
}
