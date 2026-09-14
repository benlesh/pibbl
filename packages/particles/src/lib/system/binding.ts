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
  owner: CRCInternalRenderOwner;
  committed: ParticleBindingCandidate | undefined;
  pending: ParticleBindingCandidate | undefined;
  reservation: ParticleBindingReservation | undefined;
  latestOnEvent: ((event: CRCParticleSystemEvent) => void) | undefined;
  latestOnError: ((error: unknown) => void) | undefined;
  revision: number;
  readonly observers: ParticleBindingObservers;
}

function disposeCandidate(
  candidate: ParticleBindingCandidate | undefined,
): void {
  if (candidate === undefined) return;
  candidate.dispose();
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
        owner,
        committed: undefined,
        pending: undefined,
        reservation: undefined,
        latestOnEvent: undefined,
        latestOnError: undefined,
        revision: 0,
        observers,
      };
      teardowns.add(() => {
        value.controller.cancelBindingReservation(value.reservation);
        value.reservation = undefined;
        value.pending = undefined;
        value.controller.releaseBinding(value.owner, value.committed);
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
    slot.controller.releaseBinding(slot.owner, slot.committed);
    slot.controller = controller;
    slot.committed = undefined;
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
      disposeCandidate(candidate);
    }
    throw error;
  }

  const revision = ++slot.revision;
  slot.pending = candidate;
  crcInternalOnRenderFinish(owner, (success) => {
    if (revision !== slot.revision) {
      controller.cancelBindingReservation(reservation);
      if (candidate !== slot.committed) disposeCandidate(candidate);
      return;
    }
    slot.pending = undefined;
    slot.reservation = undefined;
    if (!success) {
      controller.cancelBindingReservation(reservation);
      if (candidate !== slot.committed) disposeCandidate(candidate);
      return;
    }
    slot.latestOnEvent = input.onEvent;
    slot.latestOnError = input.onError;
    controller.adoptBinding(reservation, candidate, slot.observers);
    slot.committed = candidate;
  });
  return candidate;
}
