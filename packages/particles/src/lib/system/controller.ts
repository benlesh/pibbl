import { signal } from "@crc/core";
import {
  crcInternalAssertCommandAllowed,
  crcInternalQueueBegin,
  crcInternalQueueCurrentCommit,
  crcInternalQueueCurrentComplete,
  crcInternalRegisterAdvance,
  type CRCInternalCommandHandle,
  type CRCInternalFrame,
  type CRCInternalRenderOwner,
  type CRCInternalSignalBatch,
} from "@crc/core/internal";
import { parseParticleColor } from "../color.js";
import {
  compileParticleEffect2D,
  compileParticleEffect3D,
  type CompiledEffect2D,
  type CompiledEffect3D,
  type CompiledParameterEntry,
} from "../compiler.js";
import {
  getParticleEffect2DRecord,
  getParticleEffect3DRecord,
} from "../definition-records.js";
import { sampleBurstCount } from "../emission.js";
import type {
  CRCParticleBurstOverrides,
  CRCParticleEffect2D,
  CRCParticleExecution,
  CRCParticleSystem,
  CRCParticleSystemEvent,
  CRCParticleSystemOptions,
  CRCParticleSystemStatus,
} from "../types.js";
import type { CRCParticleEffect3D } from "../webgl-types.js";
import type {
  CompiledParticleEffect,
  ParticleBindingCandidate,
  ParticleBindingBurstResult,
  ParticleBindingFrameState,
  ParticleSystemFrame,
} from "./binding.js";
import {
  recordParticleBindingAcquired,
  recordParticleCommandCreated,
  recordParticleParameterEpochCreated,
  recordParticleSystemCreated,
} from "./ownership.js";

type ParticleEffect = CRCParticleEffect2D | CRCParticleEffect3D;

export interface ParticleBindingObservers {
  readonly onEvent?: (event: CRCParticleSystemEvent) => void;
  readonly onError?: (error: unknown) => void;
}

export interface ParticleBindingReservation {
  readonly owner: CRCInternalRenderOwner;
  readonly backend: "canvas" | "webgl";
  readonly token: object;
}

export interface ParticleEffectCandidate {
  readonly effect: ParticleEffect;
  readonly compiled: CompiledParticleEffect;
  readonly options: CRCParticleSystemOptions;
  readonly debugName: string | undefined;
}

interface ParameterEpoch {
  readonly id: number;
  readonly parameters: Float64Array;
  readonly releaseOwnership: () => void;
  references: number;
}

interface AcceptedLifetime {
  readonly deathTime: number;
  readonly emitter: string;
  readonly epoch: number;
  count: number;
}

interface ActiveBinding {
  readonly candidate: ParticleBindingCandidate;
  readonly owner: CRCInternalRenderOwner;
  readonly releaseOwnership: () => void;
  observers: ParticleBindingObservers;
}

interface PendingCommand {
  readonly handle: CRCInternalCommandHandle;
  readonly releaseOwnership: () => void;
}

interface Delivery {
  readonly frameId: number;
  readonly events: CRCParticleSystemEvent[];
  readonly errors: unknown[];
  commitApplied: boolean;
  commitCompleted: boolean;
  finalized: boolean;
  presentationOwner: CRCInternalRenderOwner | undefined;
  rendererSucceeded: boolean | undefined;
  stateBefore: ControllerStateSnapshot | undefined;
  resourcesBefore: ControllerResourceSnapshot | undefined;
  metadataAfter: ControllerMetadataSnapshot | undefined;
  metadataDeferred: boolean;
  publicationQueued: boolean;
}

interface ControllerMetadataSnapshot {
  readonly status: CRCParticleSystemStatus;
  readonly execution: CRCParticleExecution;
}

interface ControllerResourceSnapshot {
  readonly nextEpoch: number;
  readonly currentEpoch: number;
  readonly epochs: readonly Readonly<{
    id: number;
    parameters: Float64Array;
    references: number;
  }>[];
  readonly acceptedLifetimes: readonly AcceptedLifetime[];
  readonly liveByEmitter: ReadonlyMap<string, number>;
  readonly nextOrdinalByEmitter: ReadonlyMap<string, number>;
  readonly simulationParameters: Float64Array;
  readonly renderParameters: Float64Array;
}

interface ControllerStateSnapshot {
  readonly status: CRCParticleSystemStatus;
  readonly execution: CRCParticleExecution;
  readonly generation: number;
  readonly seed: number;
  readonly effectTime: number;
  readonly previousEffectTime: number;
  readonly anchorEffectTime: number;
  readonly anchorLogicalTime: number;
  readonly startPending: boolean;
  readonly automaticClosed: boolean;
  readonly drainFinishTime: number;
  readonly pendingFrameAdoption: boolean;
  readonly bindingFrameState: ParticleBindingFrameState | undefined;
}

export interface ParticleSystemControllerSnapshot {
  readonly disposed: boolean;
  readonly generation: number;
  readonly seed: number;
  readonly effectTimeMilliseconds: number;
  readonly previousEffectTimeMilliseconds: number;
  readonly binding: "canvas" | "webgl" | "unbound";
  readonly parameterEpochs: number;
}

export interface ParticleSystemController {
  readonly handle: CRCParticleSystem;
  readonly compiled: CompiledParticleEffect;
  readonly bindingCandidate: ParticleBindingCandidate | undefined;
  readonly currentSpawnEpoch: number;
  readonly simulationParameters: Readonly<Float64Array>;
  readonly renderParameters: Readonly<Float64Array>;
  prepareEffect(
    effect: ParticleEffect,
    options?: CRCParticleSystemOptions,
  ): ParticleEffectCandidate;
  cancelEffect(candidate: ParticleEffectCandidate): void;
  adoptEffect(candidate: ParticleEffectCandidate): void;
  reserveBinding(
    owner: CRCInternalRenderOwner,
    backend: "canvas" | "webgl",
  ): ParticleBindingReservation;
  validateBindingCandidate(
    reservation: ParticleBindingReservation,
    candidate: ParticleBindingCandidate,
  ): void;
  cancelBindingReservation(
    reservation: ParticleBindingReservation | undefined,
  ): void;
  discardBindingCandidate(
    candidate: ParticleBindingCandidate,
    operation: string,
  ): void;
  adoptBinding(
    reservation: ParticleBindingReservation,
    candidate: ParticleBindingCandidate,
    observers?: ParticleBindingObservers,
  ): void;
  releaseBinding(
    owner: CRCInternalRenderOwner,
    candidate?: ParticleBindingCandidate,
  ): void;
  recordRendererTransaction(
    owner: CRCInternalRenderOwner,
    success: boolean,
  ): void;
  spawnParameters(epoch: number): Readonly<Float64Array>;
  retainSpawnEpoch(epoch: number, count?: number): void;
  releaseSpawnEpoch(epoch: number, count?: number): void;
  snapshot(): ParticleSystemControllerSnapshot;
  dispose(): void;
}

const controllers = new WeakMap<CRCParticleSystem, ParticleSystemController>();

function normalizeSeed(value: number | undefined): number {
  if (value === undefined) return 0;
  if (!Number.isFinite(value)) {
    throw new RangeError("CRC particle system seed must be finite.");
  }
  return Math.trunc(value) >>> 0;
}

function validateOptions(options: CRCParticleSystemOptions): void {
  if (options.autoplay !== undefined && typeof options.autoplay !== "boolean") {
    throw new TypeError("CRC particle system autoplay must be boolean.");
  }
  normalizeSeed(options.seed);
  if (
    options.debugName !== undefined &&
    typeof options.debugName !== "string"
  ) {
    throw new TypeError("CRC particle system debugName must be a string.");
  }
  if (options.onEvent !== undefined && typeof options.onEvent !== "function") {
    throw new TypeError("CRC particle system onEvent must be a function.");
  }
  if (options.onError !== undefined && typeof options.onError !== "function") {
    throw new TypeError("CRC particle system onError must be a function.");
  }
}

function compileEffect(effect: ParticleEffect): ParticleEffectCandidate {
  try {
    const record = getParticleEffect2DRecord(effect as CRCParticleEffect2D);
    return {
      effect,
      compiled: compileParticleEffect2D(effect as CRCParticleEffect2D),
      options: {},
      debugName: record.debugName,
    };
  } catch (error2D) {
    try {
      const record = getParticleEffect3DRecord(effect as CRCParticleEffect3D);
      return {
        effect,
        compiled: compileParticleEffect3D(effect as CRCParticleEffect3D),
        options: {},
        debugName: record.debugName,
      };
    } catch {
      throw error2D;
    }
  }
}

function parameterValuesEqual(
  left: Readonly<Float64Array>,
  right: Readonly<Float64Array>,
  mask?: Readonly<Uint8Array>,
): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (
      (mask === undefined || mask[index] === 1) &&
      left[index] !== right[index]
    ) {
      return false;
    }
  }
  return true;
}

function copyParameters(parameters: Readonly<Float64Array>): Float64Array {
  return new Float64Array(parameters);
}

function validateParameterArray(
  compiled: CompiledParticleEffect,
  parameters: Readonly<Float64Array>,
): void {
  if (!(parameters instanceof Float64Array)) {
    throw new TypeError(
      "CRC particle binding parameters must be a Float64Array.",
    );
  }
  if (parameters.length !== compiled.parameterLayout.defaults.length) {
    throw new RangeError(
      `CRC particle binding parameter length must be ${compiled.parameterLayout.defaults.length}; received ${parameters.length}.`,
    );
  }
  for (let index = 0; index < parameters.length; index += 1) {
    if (!Number.isFinite(parameters[index])) {
      throw new RangeError(
        `CRC particle binding parameter at offset ${index} must be finite.`,
      );
    }
  }
}

function eventRecord(
  type: CRCParticleSystemEvent["type"],
  frame: CRCInternalFrame,
  effect: string | undefined,
  fields: Readonly<Record<string, unknown>> = {},
): CRCParticleSystemEvent {
  return Object.freeze({
    type,
    frameId: frame.frameId,
    logicalTime: frame.logicalTime,
    ...(effect === undefined ? {} : { effect }),
    ...fields,
  }) as CRCParticleSystemEvent;
}

function diagnosticRecord(
  type: string,
  message: string,
  frame: CRCInternalFrame,
  effect: string | undefined,
  fields: Readonly<Record<string, unknown>> = {},
): unknown {
  return Object.freeze({
    type,
    message,
    frameId: frame.frameId,
    logicalTime: frame.logicalTime,
    ...(effect === undefined ? {} : { effect }),
    ...fields,
  });
}

function aggregateObserverFailures(failures: readonly unknown[]): never {
  const messages = failures.map((error) =>
    error instanceof Error ? error.message : String(error),
  );
  throw new AggregateError(
    failures,
    `CRC particle observer failed: ${messages.join("; ")}`,
  );
}

/** Creates one hook-owned particle controller over the realm scheduler. */
export function createParticleSystemController(
  owner: CRCInternalRenderOwner,
  initialEffect: ParticleEffect,
  initialOptions: CRCParticleSystemOptions = {},
): ParticleSystemController {
  validateOptions(initialOptions);
  const initial = compileEffect(initialEffect);
  let compiled = initial.compiled;
  let effectDebugName = initial.debugName;
  let options = Object.freeze({ ...initialOptions });
  let originalSeed = normalizeSeed(initialOptions.seed);
  let seed = originalSeed;
  let disposed = false;
  let statusState: CRCParticleSystemStatus = "idle";
  let executionState: CRCParticleExecution = "unbound";
  let generation = 0;
  let effectTime = 0;
  let previousEffectTime = 0;
  let anchorEffectTime = 0;
  let anchorLogicalTime = 0;
  let startPending = false;
  let automaticClosed = false;
  let drainFinishTime = 0;
  let pendingFrameAdoption = false;
  let bindingFrameState: ParticleBindingFrameState | undefined;
  let activeBinding: ActiveBinding | undefined;
  let reservation: ParticleBindingReservation | undefined;
  let unregisterAdvance: (() => void) | undefined;
  const deliveries: Delivery[] = [];
  let metadataPublication: Delivery | undefined;
  let nextEpoch = 0;
  let currentEpoch = 0;
  let simulationParameters = copyParameters(compiled.parameterLayout.defaults);
  let renderParameters = copyParameters(compiled.parameterLayout.defaults);
  const epochs = new Map<number, ParameterEpoch>();
  const acceptedLifetimes: AcceptedLifetime[] = [];
  const liveByEmitter = new Map<string, number>();
  const nextOrdinalByEmitter = new Map<string, number>();
  const pendingCommands = new Set<PendingCommand>();
  const retiredCandidates = new Set<ParticleBindingCandidate>();
  const metadataWriter = Object.freeze({
    name: "CRC particle system metadata",
  });
  const releaseSystemOwnership = recordParticleSystemCreated();
  const statusSignal = signal<CRCParticleSystemStatus>("idle", {
    debugName:
      initialOptions.debugName === undefined
        ? undefined
        : `${initialOptions.debugName} status`,
  });
  const executionSignal = signal<CRCParticleExecution>("unbound", {
    debugName:
      initialOptions.debugName === undefined
        ? undefined
        : `${initialOptions.debugName} execution`,
  });

  function releaseEpoch(epoch: ParameterEpoch): void {
    if (!epochs.delete(epoch.id)) return;
    epoch.releaseOwnership();
  }

  function releaseAllEpochs(): void {
    for (const epoch of Array.from(epochs.values())) releaseEpoch(epoch);
    currentEpoch = 0;
  }

  function releaseInactiveEpochs(): void {
    for (const epoch of Array.from(epochs.values())) {
      if (epoch.id !== currentEpoch && epoch.references === 0) {
        releaseEpoch(epoch);
      }
    }
  }

  function createEpoch(parameters: Readonly<Float64Array>): number {
    const id = ++nextEpoch;
    epochs.set(id, {
      id,
      parameters: copyParameters(parameters),
      references: 0,
      releaseOwnership: recordParticleParameterEpochCreated(),
    });
    return id;
  }

  function adoptParameters(parameters: Readonly<Float64Array>): void {
    validateParameterArray(compiled, parameters);
    const previous = epochs.get(currentEpoch);
    if (
      previous === undefined ||
      !parameterValuesEqual(
        previous.parameters,
        parameters,
        compiled.parameterLayout.spawnMask,
      )
    ) {
      currentEpoch = createEpoch(parameters);
    }
    simulationParameters = copyParameters(parameters);
    renderParameters = copyParameters(parameters);
  }

  function pruneEpoch(epoch: ParameterEpoch): void {
    if (epoch.id !== currentEpoch && epoch.references === 0)
      releaseEpoch(epoch);
  }

  function retainEpoch(epochId: number, count: number): void {
    const epoch = epochs.get(epochId);
    if (epoch === undefined) {
      throw new RangeError(
        `CRC particle system received unknown parameter epoch ${epochId}.`,
      );
    }
    if (!Number.isSafeInteger(count) || count <= 0) {
      throw new RangeError(
        "CRC particle epoch retain count must be a positive safe integer.",
      );
    }
    epoch.references += count;
  }

  function releaseEpochReferences(epochId: number, count: number): void {
    const epoch = epochs.get(epochId);
    if (epoch === undefined) {
      throw new RangeError(
        `CRC particle system received unknown parameter epoch ${epochId}.`,
      );
    }
    if (
      !Number.isSafeInteger(count) ||
      count <= 0 ||
      count > epoch.references
    ) {
      throw new RangeError(
        "CRC particle epoch release exceeds its retained references.",
      );
    }
    epoch.references -= count;
    pruneEpoch(epoch);
  }

  function ensureDelivery(frame: CRCInternalFrame): Delivery {
    const latest = deliveries.at(-1);
    if (latest?.frameId === frame.frameId && !latest.finalized) return latest;
    const pendingPresentation = deliveries.findLast(
      (candidate) =>
        !candidate.finalized &&
        candidate.presentationOwner !== undefined &&
        candidate.rendererSucceeded === undefined,
    );
    const current: Delivery = {
      frameId: frame.frameId,
      events: [],
      errors: [],
      commitApplied: false,
      commitCompleted: false,
      finalized: false,
      presentationOwner: pendingPresentation?.presentationOwner,
      rendererSucceeded: undefined,
      stateBefore: undefined,
      resourcesBefore: undefined,
      metadataAfter: undefined,
      metadataDeferred: false,
      publicationQueued: false,
    };
    deliveries.push(current);
    crcInternalQueueCurrentCommit(owner, (_commitFrame, outcome) => {
      current.commitApplied = outcome.applied;
    });
    crcInternalQueueCurrentComplete(owner, () => {
      current.commitCompleted = true;
      finalizeDeliveryIfReady(current);
    });
    return current;
  }

  function removeDelivery(current: Delivery): void {
    current.finalized = true;
    const index = deliveries.indexOf(current);
    if (index >= 0) deliveries.splice(index, 1);
  }

  function deliverRecords(
    events: readonly CRCParticleSystemEvent[],
    errors: readonly unknown[],
  ): void {
    const failures: unknown[] = [];
    for (const event of events) {
      try {
        options.onEvent?.(event);
      } catch (error) {
        failures.push(error);
      }
      try {
        activeBinding?.observers.onEvent?.(event);
      } catch (error) {
        failures.push(error);
      }
    }
    for (const error of errors) {
      let observed = false;
      if (options.onError !== undefined) {
        observed = true;
        try {
          options.onError(error);
        } catch (observerError) {
          failures.push(observerError);
        }
      }
      if (activeBinding?.observers.onError !== undefined) {
        observed = true;
        try {
          activeBinding.observers.onError(error);
        } catch (observerError) {
          failures.push(observerError);
        }
      }
      if (!observed) failures.push(error);
    }
    if (failures.length > 0) aggregateObserverFailures(failures);
  }

  function deliver(current: Delivery): void {
    deliverRecords(current.events, current.errors);
  }

  function rollbackDelivery(current: Delivery): void {
    if (current.resourcesBefore !== undefined) {
      restoreResourceSnapshot(current.resourcesBefore);
    }
    if (current.stateBefore !== undefined) restoreState(current.stateBefore);
    executionState = activeBinding?.candidate.execution ?? "unbound";
  }

  function failDeliveryCascade(current: Delivery): void {
    const index = deliveries.indexOf(current);
    if (index < 0) return;
    for (const failed of deliveries.slice(index)) removeDelivery(failed);
    rollbackDelivery(current);
  }

  function queueMetadataPublication(current: Delivery): void {
    if (
      current.publicationQueued ||
      current.metadataAfter === undefined ||
      metadataPublication !== undefined
    )
      return;
    current.publicationQueued = true;
    metadataPublication = current;
    const metadata = current.metadataAfter;
    enqueue((_frame, batch) => {
      if (current.finalized) {
        if (metadataPublication === current) metadataPublication = undefined;
        queueNextMetadataPublication();
        return;
      }
      stageMetadata(batch, metadata, current);
      let applied = false;
      crcInternalQueueCurrentCommit(owner, (_commitFrame, outcome) => {
        applied = outcome.applied;
      });
      crcInternalQueueCurrentComplete(owner, () => {
        if (metadataPublication === current) metadataPublication = undefined;
        if (current.finalized) {
          queueNextMetadataPublication();
          return;
        }
        if (!applied) {
          failDeliveryCascade(current);
          return;
        }
        removeDelivery(current);
        try {
          if (!disposed) deliver(current);
        } finally {
          queueNextMetadataPublication();
        }
      });
    });
  }

  function queueNextMetadataPublication(): void {
    if (disposed || metadataPublication !== undefined) return;
    const next = deliveries.find(
      (current) =>
        !current.finalized &&
        current.metadataDeferred &&
        !current.publicationQueued &&
        current.metadataAfter !== undefined &&
        current.commitCompleted &&
        current.commitApplied &&
        (current.presentationOwner === undefined ||
          current.rendererSucceeded === true),
    );
    if (next !== undefined) queueMetadataPublication(next);
  }

  function metadataMatchesPrecedingSnapshot(current: Delivery): boolean {
    const metadata = current.metadataAfter;
    if (metadata === undefined) return true;
    const index = deliveries.indexOf(current);
    for (
      let precedingIndex = index - 1;
      precedingIndex >= 0;
      precedingIndex--
    ) {
      const preceding = deliveries[precedingIndex];
      if (preceding?.finalized || preceding?.metadataAfter === undefined)
        continue;
      return (
        preceding.metadataAfter.status === metadata.status &&
        preceding.metadataAfter.execution === metadata.execution
      );
    }
    return (
      statusSignal.get() === metadata.status &&
      executionSignal.get() === metadata.execution
    );
  }

  function finalizeDeliveryIfReady(current: Delivery): void {
    if (current.finalized || !current.commitCompleted) return;
    if (!current.commitApplied) {
      failDeliveryCascade(current);
      return;
    }
    if (
      current.presentationOwner !== undefined &&
      current.rendererSucceeded === undefined
    ) {
      return;
    }
    if (current.rendererSucceeded === false) {
      removeDelivery(current);
      rollbackDelivery(current);
      return;
    }
    if (current.metadataDeferred) {
      if (
        current.events.length === 0 &&
        current.errors.length === 0 &&
        metadataMatchesPrecedingSnapshot(current)
      ) {
        removeDelivery(current);
        return;
      }
      queueMetadataPublication(current);
      return;
    }
    removeDelivery(current);
    if (!disposed) deliver(current);
  }

  function requirePresentation(
    frame: CRCInternalFrame,
    bindingOwner: CRCInternalRenderOwner,
  ): void {
    const current = ensureDelivery(frame);
    if (
      current.presentationOwner !== undefined &&
      current.presentationOwner !== bindingOwner
    ) {
      throw new Error(
        "A CRC particle frame cannot target multiple renderer owners.",
      );
    }
    current.presentationOwner = bindingOwner;
  }

  function failRendererTransactions(
    bindingOwner: CRCInternalRenderOwner,
  ): void {
    const failed = deliveries.filter(
      (current) =>
        !current.finalized &&
        current.presentationOwner === bindingOwner &&
        current.rendererSucceeded === undefined,
    );
    if (failed.length === 0) return;
    const earliest = failed[0]!;
    for (const current of failed) removeDelivery(current);
    rollbackDelivery(earliest);
  }

  function queueEvent(
    frame: CRCInternalFrame,
    type: CRCParticleSystemEvent["type"],
    fields?: Readonly<Record<string, unknown>>,
  ): void {
    ensureDelivery(frame).events.push(
      eventRecord(type, frame, effectDebugName, fields),
    );
  }

  function queueError(frame: CRCInternalFrame, error: unknown): void {
    ensureDelivery(frame).errors.push(error);
  }

  function queueIsolatedError(error: unknown): void {
    enqueue((_frame, _batch) => {
      let applied = false;
      crcInternalQueueCurrentCommit(owner, (_commitFrame, outcome) => {
        applied = outcome.applied;
      });
      crcInternalQueueCurrentComplete(owner, () => {
        if (applied && !disposed) deliverRecords([], [error]);
      });
    });
  }

  function failCurrentDelivery(
    frame: CRCInternalFrame,
    error: unknown,
    operation: string,
  ): void {
    const current = ensureDelivery(frame);
    failDeliveryCascade(current);
    const diagnostic = diagnosticRecord(
      "execution-failed",
      error instanceof Error ? error.message : String(error),
      frame,
      effectDebugName,
      { operation },
    );
    crcInternalQueueCurrentComplete(owner, () => {
      if (!disposed) queueIsolatedError(diagnostic);
    });
  }

  function disposeRendererCandidate(
    candidate: ParticleBindingCandidate,
    operation: string,
  ): void {
    try {
      candidate.dispose();
      retiredCandidates.delete(candidate);
    } catch (error) {
      retiredCandidates.add(candidate);
      if (disposed) return;
      enqueue((frame, batch) => {
        transaction(frame, batch, () => {
          queueError(
            frame,
            diagnosticRecord(
              "execution-failed",
              error instanceof Error ? error.message : String(error),
              frame,
              effectDebugName,
              { operation },
            ),
          );
        });
      });
    }
  }

  function snapshotMetadata(): ControllerMetadataSnapshot {
    return { status: statusState, execution: executionState };
  }

  function stageMetadata(
    batch: CRCInternalSignalBatch,
    metadata: ControllerMetadataSnapshot = snapshotMetadata(),
    writer: object = metadataWriter,
  ): void {
    batch.stage(statusSignal, metadata.status, writer);
    batch.stage(executionSignal, metadata.execution, writer);
  }

  function snapshotState(): ControllerStateSnapshot {
    return {
      status: statusState,
      execution: executionState,
      generation,
      seed,
      effectTime,
      previousEffectTime,
      anchorEffectTime,
      anchorLogicalTime,
      startPending,
      automaticClosed,
      drainFinishTime,
      pendingFrameAdoption,
      bindingFrameState,
    };
  }

  function snapshotResources(): ControllerResourceSnapshot {
    return {
      nextEpoch,
      currentEpoch,
      epochs: Array.from(epochs.values(), (epoch) => ({
        id: epoch.id,
        parameters: copyParameters(epoch.parameters),
        references: epoch.references,
      })),
      acceptedLifetimes: acceptedLifetimes.map((accepted) => ({
        ...accepted,
      })),
      liveByEmitter: new Map(liveByEmitter),
      nextOrdinalByEmitter: new Map(nextOrdinalByEmitter),
      simulationParameters: copyParameters(simulationParameters),
      renderParameters: copyParameters(renderParameters),
    };
  }

  function restoreResourceSnapshot(snapshot: ControllerResourceSnapshot): void {
    releaseAllEpochs();
    nextEpoch = snapshot.nextEpoch;
    currentEpoch = snapshot.currentEpoch;
    for (const saved of snapshot.epochs) {
      epochs.set(saved.id, {
        id: saved.id,
        parameters: copyParameters(saved.parameters),
        references: saved.references,
        releaseOwnership: recordParticleParameterEpochCreated(),
      });
    }
    acceptedLifetimes.length = 0;
    acceptedLifetimes.push(
      ...snapshot.acceptedLifetimes.map((accepted) => ({ ...accepted })),
    );
    liveByEmitter.clear();
    for (const [name, count] of snapshot.liveByEmitter) {
      liveByEmitter.set(name, count);
    }
    nextOrdinalByEmitter.clear();
    for (const [name, ordinal] of snapshot.nextOrdinalByEmitter) {
      nextOrdinalByEmitter.set(name, ordinal);
    }
    simulationParameters = copyParameters(snapshot.simulationParameters);
    renderParameters = copyParameters(snapshot.renderParameters);
  }

  function restoreState(snapshot: ControllerStateSnapshot): void {
    statusState = snapshot.status;
    executionState = snapshot.execution;
    generation = snapshot.generation;
    seed = snapshot.seed;
    effectTime = snapshot.effectTime;
    previousEffectTime = snapshot.previousEffectTime;
    anchorEffectTime = snapshot.anchorEffectTime;
    anchorLogicalTime = snapshot.anchorLogicalTime;
    startPending = snapshot.startPending;
    automaticClosed = snapshot.automaticClosed;
    drainFinishTime = snapshot.drainFinishTime;
    pendingFrameAdoption = snapshot.pendingFrameAdoption;
    bindingFrameState = snapshot.bindingFrameState;
    synchronizeAdvanceRegistration();
  }

  function transaction(
    frame: CRCInternalFrame,
    batch: CRCInternalSignalBatch,
    mutate: () => void,
  ): void {
    const current = ensureDelivery(frame);
    current.stateBefore ??= snapshotState();
    current.resourcesBefore ??= snapshotResources();
    mutate();
    if (current.finalized) return;
    if (
      current.presentationOwner === undefined &&
      activeBinding !== undefined &&
      shouldAdvance()
    ) {
      requirePresentation(frame, activeBinding.owner);
    }
    current.metadataAfter = snapshotMetadata();
    if (
      current.presentationOwner === undefined &&
      metadataPublication === undefined
    ) {
      stageMetadata(batch, current.metadataAfter);
    } else {
      current.metadataDeferred = true;
      batch.discardWriter(metadataWriter);
    }
  }

  function maximumLifetimeMilliseconds(): number {
    let maximum = 0;
    const epoch = epochs.get(currentEpoch)?.parameters ?? simulationParameters;
    for (const emitter of compiled.emitters) {
      const lifetime = emitter.maximumLifetime;
      maximum = Math.max(
        maximum,
        lifetime.kind === "fixed"
          ? lifetime.milliseconds
          : epoch[lifetime.offset]!,
      );
    }
    return maximum;
  }

  function finiteCompletionMilliseconds(): number | undefined {
    let completion = 0;
    for (const emitter of compiled.emitters) {
      if (emitter.emission.completion !== "finite") return undefined;
      const latest = emitter.emission.latestAutomaticBirthMilliseconds;
      if (latest === null) continue;
      const lifetime = emitter.maximumLifetime;
      const lifetimeMilliseconds =
        lifetime.kind === "fixed"
          ? lifetime.milliseconds
          : (epochs.get(currentEpoch)?.parameters[lifetime.offset] ??
            simulationParameters[lifetime.offset]!);
      completion = Math.max(completion, latest + lifetimeMilliseconds);
    }
    return completion;
  }

  function hasOpenAutomaticEmission(): boolean {
    if (automaticClosed) return false;
    return compiled.emitters.some(
      (emitter) =>
        emitter.emission.rates.length > 0 || emitter.emission.bursts.length > 0,
    );
  }

  function shouldAdvance(): boolean {
    if (activeBinding === undefined || disposed) return false;
    if (pendingFrameAdoption) return true;
    if (statusState === "running") {
      if (bindingFrameState !== undefined) {
        return (
          bindingFrameState.nextAutomaticBirthMilliseconds !== null ||
          bindingFrameState.liveCount > 0
        );
      }
      return (
        hasOpenAutomaticEmission() ||
        acceptedLifetimes.length > 0 ||
        finiteCompletionMilliseconds() !== undefined
      );
    }
    return (
      statusState === "draining" &&
      (bindingFrameState === undefined || bindingFrameState.liveCount > 0)
    );
  }

  function synchronizeAdvanceRegistration(): void {
    if (shouldAdvance()) {
      unregisterAdvance ??= crcInternalRegisterAdvance(owner, advance);
    } else if (unregisterAdvance !== undefined) {
      unregisterAdvance();
      unregisterAdvance = undefined;
    }
  }

  function releaseExpired(effectTimeMilliseconds: number): void {
    let writeIndex = 0;
    for (let index = 0; index < acceptedLifetimes.length; index += 1) {
      const accepted = acceptedLifetimes[index]!;
      if (accepted.deathTime <= effectTimeMilliseconds) {
        liveByEmitter.set(
          accepted.emitter,
          Math.max(
            0,
            (liveByEmitter.get(accepted.emitter) ?? 0) - accepted.count,
          ),
        );
        releaseEpochReferences(accepted.epoch, accepted.count);
      } else {
        acceptedLifetimes[writeIndex++] = accepted;
      }
    }
    acceptedLifetimes.length = writeIndex;
  }

  function releaseAcceptedLifetimes(): void {
    for (const accepted of acceptedLifetimes) {
      const epoch = epochs.get(accepted.epoch);
      if (epoch !== undefined) {
        epoch.references = Math.max(0, epoch.references - accepted.count);
        pruneEpoch(epoch);
      }
    }
    acceptedLifetimes.length = 0;
    liveByEmitter.clear();
  }

  function startRun(frame: CRCInternalFrame, nextSeed: number): void {
    generation += 1;
    seed = nextSeed;
    effectTime = 0;
    previousEffectTime = 0;
    anchorEffectTime = 0;
    anchorLogicalTime = frame.logicalTime;
    automaticClosed = false;
    drainFinishTime = 0;
    pendingFrameAdoption = true;
    bindingFrameState = undefined;
    startPending = true;
    nextOrdinalByEmitter.clear();
    if (activeBinding === undefined) {
      statusState = "scheduled";
      return;
    }
    statusState = "running";
    startPending = false;
    queueEvent(frame, "start");
  }

  function resetRunStorage(frame: CRCInternalFrame): boolean {
    try {
      const cleared = activeBinding?.candidate.clear();
      if (cleared !== undefined) bindingFrameState = cleared;
    } catch (error) {
      queueError(
        frame,
        diagnosticRecord(
          "execution-failed",
          error instanceof Error ? error.message : String(error),
          frame,
          effectDebugName,
          { operation: "clear-binding" },
        ),
      );
      return false;
    }
    releaseAcceptedLifetimes();
    nextOrdinalByEmitter.clear();
    return true;
  }

  function effectTimeAt(logicalTime: number): number {
    if (statusState === "paused") return effectTime;
    return anchorEffectTime + Math.max(0, logicalTime - anchorLogicalTime);
  }

  function finishRun(frame: CRCInternalFrame): void {
    if (statusState === "finished") return;
    statusState = "finished";
    automaticClosed = true;
    queueEvent(frame, "finish");
  }

  function advance(
    frame: CRCInternalFrame,
    batch: CRCInternalSignalBatch,
  ): void {
    if (disposed || activeBinding === undefined) return;
    transaction(frame, batch, () => {
      const binding = activeBinding!;
      previousEffectTime = effectTime;
      effectTime = effectTimeAt(frame.logicalTime);
      if (bindingFrameState === undefined) releaseExpired(effectTime);
      const particleFrame: ParticleSystemFrame = Object.freeze({
        generation,
        frameId: frame.frameId,
        logicalTime: frame.logicalTime,
        effectTimeMilliseconds: effectTime,
        previousEffectTimeMilliseconds: previousEffectTime,
        seed,
        status: statusState,
      });
      try {
        const adopted = binding.candidate.adoptFrame(particleFrame);
        if (adopted !== undefined) bindingFrameState = adopted;
      } catch (error) {
        failCurrentDelivery(frame, error, "adopt-frame");
        return;
      }
      if (bindingFrameState !== undefined) {
        if (
          statusState === "running" &&
          compiled.emitters.every(
            (emitter) => emitter.emission.completion === "finite",
          ) &&
          bindingFrameState.nextAutomaticBirthMilliseconds === null &&
          bindingFrameState.liveCount === 0
        ) {
          finishRun(frame);
        } else if (
          statusState === "draining" &&
          bindingFrameState.liveCount === 0
        ) {
          finishRun(frame);
        }
      } else if (statusState === "running") {
        const completion = finiteCompletionMilliseconds();
        if (completion !== undefined && effectTime >= completion)
          finishRun(frame);
      } else if (
        statusState === "draining" &&
        effectTime >= drainFinishTime &&
        acceptedLifetimes.length === 0
      ) {
        finishRun(frame);
      }
      try {
        binding.candidate.requestRender();
      } catch (error) {
        failCurrentDelivery(frame, error, "request-render");
        return;
      }
      requirePresentation(frame, binding.owner);
      pendingFrameAdoption = false;
      synchronizeAdvanceRegistration();
    });
  }

  function cancelPendingCommands(): void {
    for (const pending of Array.from(pendingCommands)) {
      pending.handle.cancel();
      pending.releaseOwnership();
    }
    pendingCommands.clear();
  }

  function enqueue(
    apply: (frame: CRCInternalFrame, batch: CRCInternalSignalBatch) => void,
  ): void {
    if (disposed) return;
    const releaseOwnership = recordParticleCommandCreated();
    let pending!: PendingCommand;
    try {
      const handle = crcInternalQueueBegin(owner, (frame, batch) => {
        pendingCommands.delete(pending);
        releaseOwnership();
        if (!disposed) apply(frame, batch);
      });
      pending = { handle, releaseOwnership };
      pendingCommands.add(pending);
    } catch (error) {
      releaseOwnership();
      throw error;
    }
  }

  function emitterByName(name: string) {
    return compiled.emitters.find((emitter) => emitter.name === name);
  }

  function emitterIndexByName(name: string): number {
    for (let index = 0; index < compiled.emitters.length; index += 1) {
      if (compiled.emitters[index]?.name === name) return index;
    }
    return -1;
  }

  function validatePositiveCount(count: number | undefined): void {
    if (count !== undefined && (!Number.isSafeInteger(count) || count <= 0)) {
      throw new RangeError(
        "CRC particle burst count must be a positive safe integer.",
      );
    }
  }

  function validateFiniteVector(
    name: string,
    value: readonly number[] | undefined,
    dimension: number,
  ): void {
    if (value === undefined) return;
    if (
      !Array.isArray(value) ||
      value.length !== dimension ||
      value.some((entry) => !Number.isFinite(entry))
    ) {
      throw new RangeError(
        `CRC particle burst ${name} must be a finite ${dimension}-dimensional vector.`,
      );
    }
  }

  function writeParameterOverride(
    output: Float64Array,
    entry: CompiledParameterEntry,
    value: number | readonly number[] | string,
  ): void {
    if (entry.timing !== "spawn") {
      throw new TypeError(
        `CRC particle burst parameter "${entry.name}" must use spawn timing.`,
      );
    }
    const numeric =
      entry.type === "color"
        ? typeof value === "string"
          ? parseParticleColor(value)
          : undefined
        : entry.length === 1
          ? typeof value === "number"
            ? [value]
            : undefined
          : Array.isArray(value)
            ? value
            : undefined;
    if (
      numeric === undefined ||
      numeric.length !== entry.length ||
      numeric.some((component) => !Number.isFinite(component))
    ) {
      throw new TypeError(
        `CRC particle burst parameter "${entry.name}" does not match ${entry.type}.`,
      );
    }
    output.set(numeric, entry.offset);
  }

  function validateBurst(
    emitterName: string,
    overrides: CRCParticleBurstOverrides,
  ): Readonly<Float64Array> | undefined {
    const emitter = emitterByName(emitterName);
    if (emitter === undefined) {
      throw new TypeError(
        `CRC particle system received unknown emitter "${emitterName}".`,
      );
    }
    if (emitter.emission.manual.length === 0) {
      throw new TypeError(
        `CRC particle emitter "${emitterName}" has no manual emission source.`,
      );
    }
    validatePositiveCount(overrides.count);
    validateFiniteVector("position", overrides.position, compiled.dimension);
    if (
      overrides.seedSalt !== undefined &&
      !Number.isFinite(overrides.seedSalt)
    ) {
      throw new RangeError("CRC particle burst seedSalt must be finite.");
    }
    if (overrides.parameters !== undefined) {
      const values = copyParameters(
        epochs.get(currentEpoch)?.parameters ?? simulationParameters,
      );
      for (const [name, value] of Object.entries(overrides.parameters)) {
        const entry = compiled.parameterLayout.byName.get(name);
        if (entry === undefined) {
          throw new TypeError(
            `CRC particle burst references unknown parameter "${name}".`,
          );
        }
        writeParameterOverride(values, entry, value);
      }
      return values;
    }
    return undefined;
  }

  function requestedBurstCount(
    emitter:
      | CompiledEffect2D["emitters"][number]
      | CompiledEffect3D["emitters"][number],
    override: number | undefined,
  ): number {
    if (override !== undefined) return override;
    let requested = 0;
    let ordinal = nextOrdinalByEmitter.get(emitter.name) ?? 0;
    for (const manual of emitter.emission.manual) {
      requested += sampleBurstCount(
        manual,
        seed,
        emitter.emitterHash,
        ordinal++,
      );
    }
    return requested;
  }

  function acceptBurst(
    emitterName: string,
    overrides: CRCParticleBurstOverrides,
    overrideParameters: Readonly<Float64Array> | undefined,
    frame: CRCInternalFrame,
  ): void {
    const emitter = emitterByName(emitterName)!;
    const emitterIndex = emitterIndexByName(emitterName);
    const requested =
      activeBinding?.candidate.requestedBurstCount?.(
        emitterIndex,
        overrides.count,
        seed,
      ) ?? requestedBurstCount(emitter, overrides.count);
    if (
      statusState === "paused" ||
      statusState === "draining" ||
      statusState === "finished" ||
      activeBinding === undefined
    ) {
      const reason = statusState === "paused" ? "paused" : "stopped";
      queueEvent(frame, "burst-rejected", {
        emitter: emitterName,
        requested,
        accepted: 0,
        reason,
      });
      return;
    }
    if (statusState === "idle") startRun(frame, seed);
    if (activeBinding?.candidate.emitBurst !== undefined) {
      const currentParameters = epochs.get(currentEpoch)!.parameters;
      const epoch =
        overrideParameters !== undefined &&
        !parameterValuesEqual(
          currentParameters,
          overrideParameters,
          compiled.parameterLayout.spawnMask,
        )
          ? createEpoch(overrideParameters)
          : currentEpoch;
      let result: ParticleBindingBurstResult;
      try {
        result = activeBinding.candidate.emitBurst({
          generation,
          emitterIndex,
          count: overrides.count,
          birthTimeMilliseconds: effectTimeAt(frame.logicalTime),
          seed,
          seedSalt: Math.trunc(overrides.seedSalt ?? 0) >>> 0,
          origin:
            overrides.position ??
            (compiled.dimension === 2
              ? ([0, 0] as const)
              : ([0, 0, 0] as const)),
          spawnEpoch: epoch,
        });
      } catch (error) {
        if (epoch !== currentEpoch) releaseEpoch(epochs.get(epoch)!);
        failCurrentDelivery(frame, error, "emit-burst");
        return;
      }
      bindingFrameState = result;
      if (result.accepted === 0 && epoch !== currentEpoch) {
        releaseEpoch(epochs.get(epoch)!);
      }
      const exactRequested = result.requested;
      if (result.accepted > 0) {
        queueEvent(frame, "burst-accepted", {
          emitter: emitterName,
          requested: exactRequested,
          accepted: result.accepted,
        });
      } else {
        queueEvent(frame, "burst-rejected", {
          emitter: emitterName,
          requested: exactRequested,
          accepted: 0,
          reason: "capacity",
        });
      }
      if (result.rejected > 0) {
        queueError(
          frame,
          diagnosticRecord(
            "capacity-rejected",
            `CRC particle emitter "${emitterName}" accepted ${result.accepted} of ${exactRequested} requested particles.`,
            frame,
            effectDebugName,
            {
              emitter: emitterName,
              requested: exactRequested,
              accepted: result.accepted,
            },
          ),
        );
      }
      synchronizeAdvanceRegistration();
      return;
    }
    const live = liveByEmitter.get(emitterName) ?? 0;
    const available = Math.max(0, emitter.capacity - live);
    const accepted = Math.min(requested, available);
    if (accepted > 0) {
      const currentParameters = epochs.get(currentEpoch)!.parameters;
      const epoch =
        overrideParameters !== undefined &&
        !parameterValuesEqual(
          currentParameters,
          overrideParameters,
          compiled.parameterLayout.spawnMask,
        )
          ? createEpoch(overrideParameters)
          : currentEpoch;
      retainEpoch(epoch, accepted);
      acceptedLifetimes.push({
        deathTime:
          effectTimeAt(frame.logicalTime) +
          (emitter.maximumLifetime.kind === "fixed"
            ? emitter.maximumLifetime.milliseconds
            : epochs.get(epoch)!.parameters[emitter.maximumLifetime.offset]!),
        emitter: emitterName,
        epoch,
        count: accepted,
      });
      liveByEmitter.set(emitterName, live + accepted);
      nextOrdinalByEmitter.set(
        emitterName,
        (nextOrdinalByEmitter.get(emitterName) ?? 0) + requested,
      );
      queueEvent(frame, "burst-accepted", {
        emitter: emitterName,
        requested,
        accepted,
      });
    } else {
      queueEvent(frame, "burst-rejected", {
        emitter: emitterName,
        requested,
        accepted: 0,
        reason: "capacity",
      });
    }
    if (accepted < requested) {
      queueError(
        frame,
        diagnosticRecord(
          "capacity-rejected",
          `CRC particle emitter "${emitterName}" accepted ${accepted} of ${requested} requested particles.`,
          frame,
          effectDebugName,
          { emitter: emitterName, requested, accepted },
        ),
      );
    }
    synchronizeAdvanceRegistration();
  }

  const handle = Object.freeze({
    status: statusSignal.asReadonly(),
    execution: executionSignal.asReadonly(),
    play(): void {
      crcInternalAssertCommandAllowed();
      if (disposed) return;
      enqueue((frame, batch) => {
        transaction(frame, batch, () => {
          if (
            statusState === "running" ||
            statusState === "paused" ||
            statusState === "draining" ||
            statusState === "scheduled"
          ) {
            return;
          }
          if (!resetRunStorage(frame)) return;
          startRun(frame, originalSeed);
          synchronizeAdvanceRegistration();
        });
      });
    },
    pause(): void {
      crcInternalAssertCommandAllowed();
      if (disposed) return;
      enqueue((frame, batch) => {
        transaction(frame, batch, () => {
          if (statusState !== "running") return;
          effectTime = effectTimeAt(frame.logicalTime);
          previousEffectTime = effectTime;
          anchorEffectTime = effectTime;
          anchorLogicalTime = frame.logicalTime;
          statusState = "paused";
          synchronizeAdvanceRegistration();
        });
      });
    },
    resume(): void {
      crcInternalAssertCommandAllowed();
      if (disposed) return;
      enqueue((frame, batch) => {
        transaction(frame, batch, () => {
          if (statusState !== "paused") return;
          anchorEffectTime = effectTime;
          anchorLogicalTime = frame.logicalTime;
          statusState = activeBinding === undefined ? "scheduled" : "running";
          synchronizeAdvanceRegistration();
        });
      });
    },
    restart(restartOptions: Readonly<{ seed?: number }> = {}): void {
      crcInternalAssertCommandAllowed();
      if (
        restartOptions === null ||
        typeof restartOptions !== "object" ||
        Array.isArray(restartOptions)
      ) {
        throw new TypeError("CRC particle restart options must be a record.");
      }
      const nextSeed =
        restartOptions.seed === undefined
          ? originalSeed
          : normalizeSeed(restartOptions.seed);
      if (disposed) return;
      enqueue((frame, batch) => {
        transaction(frame, batch, () => {
          if (!resetRunStorage(frame)) return;
          startRun(frame, nextSeed);
          synchronizeAdvanceRegistration();
        });
      });
    },
    emit(emitter: string, overrides: CRCParticleBurstOverrides = {}): void {
      crcInternalAssertCommandAllowed();
      if (typeof emitter !== "string") {
        throw new TypeError("CRC particle emitter name must be a string.");
      }
      if (
        overrides === null ||
        typeof overrides !== "object" ||
        Array.isArray(overrides)
      ) {
        throw new TypeError("CRC particle burst overrides must be a record.");
      }
      const overrideParameters = validateBurst(emitter, overrides);
      if (disposed) return;
      const frozenOverrides = Object.freeze({ ...overrides });
      enqueue((frame, batch) => {
        transaction(frame, batch, () =>
          acceptBurst(emitter, frozenOverrides, overrideParameters, frame),
        );
      });
    },
    stop(stopOptions: Readonly<{ mode?: "drain" | "clear" }> = {}): void {
      crcInternalAssertCommandAllowed();
      if (
        stopOptions === null ||
        typeof stopOptions !== "object" ||
        Array.isArray(stopOptions)
      ) {
        throw new TypeError("CRC particle stop options must be a record.");
      }
      const mode = stopOptions.mode ?? "drain";
      if (mode !== "drain" && mode !== "clear") {
        throw new TypeError(
          'CRC particle stop mode must be "drain" or "clear".',
        );
      }
      if (disposed) return;
      enqueue((frame, batch) => {
        transaction(frame, batch, () => {
          if (statusState === "idle" || statusState === "finished") return;
          const clearBinding = mode === "clear" ? activeBinding : undefined;
          if (clearBinding !== undefined) {
            try {
              clearBinding.candidate.requestRender();
            } catch (error) {
              failCurrentDelivery(frame, error, "request-clear-render");
              return;
            }
          }
          if (mode === "clear" && !resetRunStorage(frame)) return;
          effectTime = effectTimeAt(frame.logicalTime);
          previousEffectTime = effectTime;
          anchorEffectTime = effectTime;
          anchorLogicalTime = frame.logicalTime;
          automaticClosed = true;
          if (mode === "clear") {
            if (clearBinding !== undefined) {
              requirePresentation(frame, clearBinding.owner);
            }
            finishRun(frame);
          } else {
            statusState = "draining";
            pendingFrameAdoption = true;
            const hasAutomaticSources = compiled.emitters.some(
              (emitter) =>
                emitter.emission.rates.length > 0 ||
                emitter.emission.bursts.length > 0,
            );
            drainFinishTime = Math.max(
              effectTime,
              ...acceptedLifetimes.map((accepted) => accepted.deathTime),
              bindingFrameState?.latestDeathMilliseconds ?? effectTime,
              hasAutomaticSources
                ? effectTime + maximumLifetimeMilliseconds()
                : effectTime,
            );
            queueEvent(frame, "drain-start");
          }
          synchronizeAdvanceRegistration();
        });
      });
    },
  }) as CRCParticleSystem;

  let preparedCompiled = compiled;
  let preparedEffectCandidate: ParticleEffectCandidate | undefined;

  const controller: ParticleSystemController = Object.freeze({
    handle,
    get compiled() {
      return compiled;
    },
    get bindingCandidate() {
      return activeBinding?.candidate;
    },
    get currentSpawnEpoch() {
      return currentEpoch;
    },
    get simulationParameters() {
      return simulationParameters;
    },
    get renderParameters() {
      return renderParameters;
    },
    prepareEffect(
      effect: ParticleEffect,
      nextOptions: CRCParticleSystemOptions = {},
    ): ParticleEffectCandidate {
      validateOptions(nextOptions);
      const compiledCandidate = compileEffect(effect);
      const candidate = Object.freeze({
        ...compiledCandidate,
        options: Object.freeze({ ...nextOptions }),
      });
      preparedEffectCandidate = candidate;
      preparedCompiled = candidate.compiled;
      return candidate;
    },
    cancelEffect(candidate: ParticleEffectCandidate): void {
      if (preparedEffectCandidate !== candidate) return;
      preparedEffectCandidate = undefined;
      preparedCompiled = compiled;
    },
    adoptEffect(candidate: ParticleEffectCandidate): void {
      if (disposed) return;
      if (preparedEffectCandidate !== candidate) return;
      preparedEffectCandidate = undefined;
      const changed = compiled !== candidate.compiled;
      if (changed) {
        const restartMode =
          statusState === "paused"
            ? "paused"
            : statusState === "running" ||
                statusState === "draining" ||
                statusState === "scheduled"
              ? "running"
              : "idle";
        cancelPendingCommands();
        releaseAcceptedLifetimes();
        nextOrdinalByEmitter.clear();
        currentEpoch = 0;
        releaseInactiveEpochs();
        compiled = candidate.compiled;
        bindingFrameState = undefined;
        originalSeed = normalizeSeed(candidate.options.seed);
        enqueue((frame, batch) => {
          transaction(frame, batch, () => {
            seed = originalSeed;
            effectTime = 0;
            previousEffectTime = 0;
            anchorEffectTime = 0;
            anchorLogicalTime = frame.logicalTime;
            automaticClosed = false;
            drainFinishTime = 0;
            nextOrdinalByEmitter.clear();
            if (restartMode === "idle") {
              statusState = "idle";
              startPending = false;
              pendingFrameAdoption = false;
            } else {
              generation += 1;
              statusState =
                restartMode === "paused"
                  ? "paused"
                  : activeBinding === undefined
                    ? "scheduled"
                    : "running";
              startPending = statusState !== "running";
              pendingFrameAdoption = statusState === "running";
              if (statusState === "running") queueEvent(frame, "start");
            }
            synchronizeAdvanceRegistration();
          });
        });
      }
      effectDebugName = candidate.debugName;
      options = Object.freeze({ ...candidate.options });
      preparedCompiled = compiled;
    },
    reserveBinding(
      bindingOwner: CRCInternalRenderOwner,
      backend: "canvas" | "webgl",
    ): ParticleBindingReservation {
      if (disposed) {
        throw new TypeError("Cannot bind a disposed CRC particle system.");
      }
      if (reservation !== undefined) {
        throw new TypeError(
          "CRC particle system already has a pending binding reservation.",
        );
      }
      if (
        activeBinding?.owner !== undefined &&
        activeBinding.owner !== bindingOwner
      ) {
        throw new TypeError(
          "CRC particle system is already bound to another component.",
        );
      }
      const next = Object.freeze({ owner: bindingOwner, backend, token: {} });
      reservation = next;
      return next;
    },
    validateBindingCandidate(
      bindingReservation: ParticleBindingReservation,
      candidate: ParticleBindingCandidate,
    ): void {
      if (reservation !== bindingReservation) {
        throw new TypeError("CRC particle binding reservation is stale.");
      }
      if (
        candidate.owner !== bindingReservation.owner ||
        candidate.backend !== bindingReservation.backend
      ) {
        throw new TypeError(
          "CRC particle binding candidate owner/backend mismatch.",
        );
      }
      if (candidate.compiled !== preparedCompiled) {
        throw new TypeError(
          "CRC particle binding definition does not match its system definition.",
        );
      }
      if (
        (candidate.backend === "canvas" &&
          candidate.compiled.dimension !== 2) ||
        (candidate.backend === "webgl" && candidate.compiled.dimension !== 3)
      ) {
        throw new TypeError(
          "CRC particle binding backend does not match effect dimension.",
        );
      }
      if (
        candidate.execution === "unbound" ||
        (candidate.backend === "canvas" &&
          !candidate.execution.endsWith("canvas")) ||
        (candidate.backend === "webgl" &&
          !candidate.execution.includes("webgl"))
      ) {
        throw new TypeError(
          "CRC particle binding execution does not match its backend.",
        );
      }
      if (!candidate.compiled.execution[candidate.execution].supported) {
        throw new TypeError(
          `CRC particle execution "${candidate.execution}" is unavailable: ${candidate.compiled.execution[candidate.execution].reasons.join("; ")}.`,
        );
      }
      validateParameterArray(candidate.compiled, candidate.parameters);
    },
    cancelBindingReservation(
      bindingReservation: ParticleBindingReservation | undefined,
    ): void {
      if (
        bindingReservation !== undefined &&
        reservation === bindingReservation
      ) {
        reservation = undefined;
      }
    },
    discardBindingCandidate(
      candidate: ParticleBindingCandidate,
      operation: string,
    ): void {
      if (candidate === activeBinding?.candidate) return;
      disposeRendererCandidate(candidate, operation);
    },
    adoptBinding(
      bindingReservation: ParticleBindingReservation,
      candidate: ParticleBindingCandidate,
      observers: ParticleBindingObservers = {},
    ): void {
      if (disposed || reservation !== bindingReservation) {
        controller.cancelBindingReservation(bindingReservation);
        if (candidate !== activeBinding?.candidate) {
          disposeRendererCandidate(candidate, "dispose-stale-binding");
        }
        return;
      }
      controller.validateBindingCandidate(bindingReservation, candidate);
      reservation = undefined;
      adoptParameters(candidate.parameters);
      if (activeBinding?.candidate === candidate) {
        activeBinding.observers = observers;
        return;
      }
      const previous = activeBinding;
      activeBinding = {
        candidate,
        owner: bindingReservation.owner,
        observers,
        releaseOwnership: recordParticleBindingAcquired(),
      };
      executionState = candidate.execution;
      bindingFrameState = undefined;
      previous?.releaseOwnership();
      if (previous !== undefined) {
        disposeRendererCandidate(
          previous.candidate,
          "dispose-replaced-binding",
        );
      }
      enqueue((frame, batch) => {
        transaction(frame, batch, () => {
          executionState = candidate.execution;
          if (statusState === "scheduled") {
            statusState = "running";
            anchorEffectTime = effectTime;
            anchorLogicalTime = frame.logicalTime;
            if (startPending) {
              startPending = false;
              queueEvent(frame, "start");
            }
          }
          synchronizeAdvanceRegistration();
        });
      });
    },
    releaseBinding(
      bindingOwner: CRCInternalRenderOwner,
      candidate?: ParticleBindingCandidate,
    ): void {
      if (
        activeBinding === undefined ||
        activeBinding.owner !== bindingOwner ||
        (candidate !== undefined && candidate !== activeBinding.candidate)
      ) {
        return;
      }
      const released = activeBinding;
      activeBinding = undefined;
      executionState = "unbound";
      bindingFrameState = undefined;
      failRendererTransactions(bindingOwner);
      unregisterAdvance?.();
      unregisterAdvance = undefined;
      released.releaseOwnership();
      try {
        disposeRendererCandidate(
          released.candidate,
          "dispose-released-binding",
        );
      } finally {
        if (!disposed) {
          enqueue((frame, batch) => {
            transaction(frame, batch, () => {
              executionState = "unbound";
            });
          });
        }
      }
    },
    recordRendererTransaction(
      bindingOwner: CRCInternalRenderOwner,
      success: boolean,
    ): void {
      if (!success) {
        failRendererTransactions(bindingOwner);
        return;
      }
      const completed = deliveries.filter(
        (pending) =>
          !pending.finalized &&
          pending.presentationOwner === bindingOwner &&
          pending.rendererSucceeded === undefined,
      );
      for (const current of completed) {
        current.rendererSucceeded = true;
        finalizeDeliveryIfReady(current);
      }
      releaseInactiveEpochs();
    },
    spawnParameters(epoch: number): Readonly<Float64Array> {
      const found = epochs.get(epoch);
      if (found === undefined) {
        throw new RangeError(
          `CRC particle system received unknown parameter epoch ${epoch}.`,
        );
      }
      return found.parameters;
    },
    retainSpawnEpoch(epoch: number, count = 1): void {
      retainEpoch(epoch, count);
    },
    releaseSpawnEpoch(epoch: number, count = 1): void {
      releaseEpochReferences(epoch, count);
    },
    snapshot(): ParticleSystemControllerSnapshot {
      return Object.freeze({
        disposed,
        generation,
        seed,
        effectTimeMilliseconds: effectTime,
        previousEffectTimeMilliseconds: previousEffectTime,
        binding: activeBinding?.candidate.backend ?? "unbound",
        parameterEpochs: epochs.size,
      });
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      metadataPublication = undefined;
      for (const pending of Array.from(deliveries)) removeDelivery(pending);
      cancelPendingCommands();
      preparedEffectCandidate = undefined;
      preparedCompiled = compiled;
      reservation = undefined;
      unregisterAdvance?.();
      unregisterAdvance = undefined;
      releaseAcceptedLifetimes();
      const binding = activeBinding;
      activeBinding = undefined;
      bindingFrameState = undefined;
      binding?.releaseOwnership();
      try {
        if (binding !== undefined) {
          disposeRendererCandidate(binding.candidate, "dispose-binding");
        }
        for (const candidate of Array.from(retiredCandidates)) {
          disposeRendererCandidate(candidate, "retry-retired-binding");
        }
      } finally {
        releaseAllEpochs();
        statusState = "disposed";
        executionState = "unbound";
        statusSignal.set("disposed");
        executionSignal.set("unbound");
        releaseSystemOwnership();
      }
    },
  });
  controllers.set(handle, controller);
  return controller;
}

export function getParticleSystemController(
  system: CRCParticleSystem,
): ParticleSystemController {
  const controller = controllers.get(system);
  if (controller === undefined) {
    throw new TypeError(
      "Expected a CRC particle system created by crcParticleSystem().",
    );
  }
  return controller;
}

export function particleSystemControllerSnapshot(
  system: CRCParticleSystem,
): ParticleSystemControllerSnapshot {
  return getParticleSystemController(system).snapshot();
}
