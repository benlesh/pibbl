import { getFlowController2D, type CRCFlowField2D } from "../flow/hook.js";
import { FlowParticlePopulation2D } from "../flow/population.js";
import type { RenderingContext2D } from "@crc/core";
import type { CRCInternalRenderOwner } from "@crc/core/internal";
import type { CompiledEffect2D, CompiledEmitter2D } from "../compiler.js";
import { mix32 } from "../random.js";
import {
  Particle2DRegister,
  sampleParticle2D,
  type ParticleBirthView,
} from "../sample.js";
import type {
  ParticleBindingBurstRequest,
  ParticleBindingBurstResult,
  ParticleBindingCandidate,
  ParticleBindingFrameState,
  ParticleSystemFrame,
} from "../system/binding.js";
import {
  CANVAS_LEDGER_NO_SLOT,
  createCanvasBirthLedger,
  type CanvasBirthFrameSummary,
  type CanvasEmitterLedger,
  type CanvasLedgerGeneration,
} from "./birth-ledger.js";
import { createCanvasRasterCache } from "./raster-cache.js";

const TAU = Math.PI * 2;
const DEGREES_TO_RADIANS = Math.PI / 180;
const COMPLEX_RASTER_REUSE_THRESHOLD = 3;

export interface CanvasParticleExecutorOptions {
  readonly flow?: CRCFlowField2D;
  readonly owner: CRCInternalRenderOwner;
  readonly compiled: CompiledEffect2D;
  readonly parameters: Readonly<Float64Array>;
  readonly requestRender: () => void;
  readonly currentSpawnEpoch?: () => number;
  readonly spawnParameters: (epoch: number) => Readonly<Float64Array>;
  readonly retainSpawnEpoch: (epoch: number) => void;
  readonly releaseSpawnEpoch: (epoch: number) => void;
}

export interface CanvasParticleExecutor extends ParticleBindingCandidate {
  readonly compiled: CompiledEffect2D;
  requestedBurstCount(
    emitterIndex: number,
    count: number | undefined,
    seed: number,
  ): number;
  emitBurst(request: ParticleBindingBurstRequest): ParticleBindingBurstResult;
  prepareParameters(parameters: Readonly<Float64Array>): void;
  draw(
    context: RenderingContext2D,
    contentBox: Readonly<{
      x: number;
      y: number;
      width: number;
      height: number;
    }>,
    opacity: number,
    overflow: "visible" | "clip",
  ): void;
  readonly cacheEntries: number;
}

interface MutableParticleBirth extends ParticleBirthView {
  seed: number;
  ordinal: number;
  birthTimeMilliseconds: number;
}

function copyParameters(values: Readonly<Float64Array>): Float64Array {
  return new Float64Array(values);
}

function summaryToFrameState(
  value: CanvasBirthFrameSummary,
): ParticleBindingFrameState {
  return {
    liveCount: value.liveCount,
    nextAutomaticBirthMilliseconds: value.nextAutomaticBirthMilliseconds,
    latestDeathMilliseconds: value.latestDeathMilliseconds,
  };
}

function imageWidth(source: CanvasImageSource): number {
  if (source instanceof HTMLVideoElement) {
    return source.videoWidth;
  }
  if (source instanceof HTMLImageElement) {
    return source.naturalWidth || source.width;
  }
  const sized = source as {
    readonly width?: unknown;
    readonly displayWidth?: unknown;
  };
  if (typeof sized.width === "number") return sized.width;
  return typeof sized.displayWidth === "number" ? sized.displayWidth : 0;
}

function imageHeight(source: CanvasImageSource): number {
  if (source instanceof HTMLVideoElement) {
    return source.videoHeight;
  }
  if (source instanceof HTMLImageElement) {
    return source.naturalHeight || source.height;
  }
  const sized = source as {
    readonly height?: unknown;
    readonly displayHeight?: unknown;
  };
  if (typeof sized.height === "number") return sized.height;
  return typeof sized.displayHeight === "number" ? sized.displayHeight : 0;
}

function quantizedDimension(value: number): number {
  return Math.min(16_384, Math.max(1, Math.round(Math.abs(value))));
}

function colorChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value * 255)));
}

function colorKey(red: number, green: number, blue: number): number {
  return (
    (colorChannel(red) << 16) | (colorChannel(green) << 8) | colorChannel(blue)
  );
}

function colorString(red: number, green: number, blue: number): string {
  return `rgb(${colorChannel(red)} ${colorChannel(green)} ${colorChannel(blue)})`;
}

function assertDecodedSpriteSources(compiled: CompiledEffect2D): void {
  for (const emitter of compiled.emitters) {
    const renderer = emitter.renderer;
    if (renderer.type !== "sprite") continue;
    const width = imageWidth(renderer.source);
    const height = imageHeight(renderer.source);
    if (
      (renderer.source instanceof HTMLImageElement &&
        (!renderer.source.complete || renderer.source.naturalWidth <= 0)) ||
      (renderer.source instanceof HTMLVideoElement &&
        renderer.source.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) ||
      !Number.isFinite(width) ||
      !Number.isFinite(height) ||
      width <= 0 ||
      height <= 0
    ) {
      throw new TypeError(
        `CRC Canvas particle emitter "${emitter.name}" requires a decoded sprite source with finite dimensions.`,
      );
    }
  }
}

function missesContentBox(
  emitter: CompiledEmitter2D,
  ledger: CanvasEmitterLedger,
  width: number,
  height: number,
): boolean {
  const bounds = emitter.bounds;
  if (bounds === undefined) return false;
  const [minX, minY] = bounds.min;
  const [maxX, maxY] = bounds.max;
  if (
    !Number.isFinite(minX) ||
    !Number.isFinite(minY) ||
    !Number.isFinite(maxX) ||
    !Number.isFinite(maxY)
  ) {
    return false;
  }
  let slot = ledger.oldestSlot;
  let visited = 0;
  while (slot !== CANVAS_LEDGER_NO_SLOT && visited < ledger.liveCount) {
    const originX = ledger.origins[slot * 2]!;
    const originY = ledger.origins[slot * 2 + 1]!;
    if (
      maxX + originX >= 0 &&
      maxY + originY >= 0 &&
      minX + originX <= width &&
      minY + originY <= height
    ) {
      return false;
    }
    slot = ledger.ageOrder[slot]!;
    visited += 1;
  }
  return true;
}

function createOwnedRaster(
  width: number,
  height: number,
  paint: (context: OffscreenCanvasRenderingContext2D) => void,
): ImageBitmap {
  const surface = new OffscreenCanvas(width, height);
  const context = surface.getContext("2d");
  if (context === null) {
    throw new Error("CRC Canvas particle rasterization requires a 2D context.");
  }
  paint(context);
  return surface.transferToImageBitmap();
}

/** Creates the renderer-owned, transactional Canvas execution candidate. */
export function createCanvasParticleExecutor(
  options: CanvasParticleExecutorOptions,
): CanvasParticleExecutor {
  const { compiled } = options;
  const flow = options.flow === undefined ? undefined : getFlowController2D(options.flow);
  if (flow) {
    for (const emitter of compiled.emitters) {
      if (emitter.motion.some((module) => module.type !== "angularVelocity") ||
        !Array.isArray(emitter.initial.velocity) ||
        emitter.initial.velocity.some((value) => value.kind !== "constant" || value.value !== 0)) {
        throw new TypeError("Flow-bound particles use field velocity; put translational forces on useFlowSource2D instead of particle motion or initial velocity.");
      }
    }
  }
  let committedFlow = flow ? compiled.emitters.map((emitter) => new FlowParticlePopulation2D(emitter.capacity)) : [];
  let candidateFlow = flow ? compiled.emitters.map((emitter) => new FlowParticlePopulation2D(emitter.capacity)) : [];
  let flowTransactionOpen = false;
  const parameterLength = compiled.parameterLayout.defaults.length;
  if (options.parameters.length !== parameterLength) {
    throw new RangeError(
      "CRC Canvas particle parameter register length mismatch.",
    );
  }
  assertDecodedSpriteSources(compiled);

  const ledger = createCanvasBirthLedger(compiled, {
    retainSpawnEpoch: options.retainSpawnEpoch,
    releaseSpawnEpoch: options.releaseSpawnEpoch,
  });
  const rasterCache = createCanvasRasterCache();
  const registers = new Float64Array(13);
  const resolvedParameters = new Float64Array(parameterLength);
  const committedParameters = copyParameters(options.parameters);
  const candidateParameters = copyParameters(options.parameters);
  const birth: MutableParticleBirth = {
    seed: 0,
    ordinal: 0,
    birthTimeMilliseconds: 0,
  };
  const colorStrings = new Map<number, string>();
  const primeColor = (red: number, green: number, blue: number): void => {
    colorStrings.set(colorKey(red, green, blue), colorString(red, green, blue));
  };
  for (const emitter of compiled.emitters) {
    const initialColor = emitter.initial.color;
    if (initialColor.kind === "constant") {
      primeColor(
        initialColor.color[0],
        initialColor.color[1],
        initialColor.color[2],
      );
    } else if (initialColor.kind === "choice") {
      for (const sample of initialColor.samples) {
        primeColor(sample[0], sample[1], sample[2]);
      }
    }
    const gradient = emitter.appearance.color;
    if (gradient !== null) {
      for (let index = 0; index < gradient.samples.length; index += 4) {
        primeColor(
          gradient.samples[index]!,
          gradient.samples[index + 1]!,
          gradient.samples[index + 2]!,
        );
      }
    }
  }
  let committedEffectTime = 0;
  let candidateEffectTime = 0;
  let committedRunSeed = 0;
  let candidateRunSeed = 0;
  let parameterTransactionOpen = false;
  let ledgerTransactionOpen = false;
  let disposed = false;

  function requireActive(): void {
    if (disposed) throw new Error("CRC Canvas particle executor is disposed.");
  }

  function selectedGeneration(): CanvasLedgerGeneration {
    return ledgerTransactionOpen ? ledger.candidate : ledger.committed;
  }

  function selectedParameters(): Readonly<Float64Array> {
    return parameterTransactionOpen ? candidateParameters : committedParameters;
  }

  function selectedEffectTime(): number {
    return ledgerTransactionOpen ? candidateEffectTime : committedEffectTime;
  }

  function selectedRunSeed(): number {
    return ledgerTransactionOpen ? candidateRunSeed : committedRunSeed;
  }

  function resolveParameters(
    current: Readonly<Float64Array>,
    spawnEpoch: number,
  ): Readonly<Float64Array> {
    resolvedParameters.set(current);
    const spawned = options.spawnParameters(spawnEpoch);
    const mask = compiled.parameterLayout.spawnMask;
    for (let index = 0; index < mask.length; index += 1) {
      if (mask[index] === 1) resolvedParameters[index] = spawned[index]!;
    }
    return resolvedParameters;
  }

  function beginFlowTransaction(): void {
    if (!flow || flowTransactionOpen) return;
    for (let i = 0; i < committedFlow.length; i++) candidateFlow[i]!.copyFrom(committedFlow[i]!);
    flowTransactionOpen = true;
  }

  function advanceFlow(): void {
    if (!flow) return;
    beginFlowTransaction();
    const generation = ledger.candidate;
    for (let i = 0; i < compiled.emitters.length; i++) {
      const emitter = compiled.emitters[i]!;
      const births = generation.emitters[i]!;
      const population = candidateFlow[i]!;
      let slot = births.oldestSlot, visited = 0;
      while (slot !== CANVAS_LEDGER_NO_SLOT && visited++ < births.liveCount) {
        const identity = births.ordinals[slot]!;
        const time = births.birthTimes[slot]!;
        if (!population.hasBirth(slot, identity, time)) {
          birth.seed = mix32((candidateRunSeed >>> 0) ^ (births.seedSalts[slot]! >>> 0));
          birth.ordinal = identity;
          birth.birthTimeMilliseconds = time;
          sampleParticle2D(emitter, birth, time, resolveParameters(selectedParameters(), births.spawnEpochs[slot]!), registers);
          population.birth(slot, identity, time,
            registers[Particle2DRegister.X]! + births.origins[slot * 2]!,
            registers[Particle2DRegister.Y]! + births.origins[slot * 2 + 1]!);
        }
        slot = births.ageOrder[slot]!;
      }
      population.advance(flow.requireActive(), births.oldestSlot, births.ageOrder, births.liveCount, candidateEffectTime);
    }
  }

  function fillColor(context: RenderingContext2D): number {
    const red = registers[Particle2DRegister.Red]!;
    const green = registers[Particle2DRegister.Green]!;
    const blue = registers[Particle2DRegister.Blue]!;
    const key = colorKey(red, green, blue);
    let value = colorStrings.get(key);
    if (value === undefined) {
      value = colorString(red, green, blue);
      colorStrings.set(key, value);
    }
    context.fillStyle = value;
    return key;
  }

  function drawPathRaster(
    context: RenderingContext2D,
    path: Path2D,
    width: number,
    height: number,
    colorKey: number,
  ): void {
    const rasterWidth = quantizedDimension(width);
    const rasterHeight = quantizedDimension(height);
    const key =
      colorKey * 268_435_456 + (rasterWidth - 1) * 16_384 + rasterHeight - 1;
    let raster = rasterCache.find<ImageBitmap>(path, key);
    if (raster === undefined) {
      raster = rasterCache.insert(
        path,
        key,
        createOwnedRaster(rasterWidth, rasterHeight, (rasterContext) => {
          rasterContext.fillStyle = context.fillStyle;
          rasterContext.translate(rasterWidth / 2, rasterHeight / 2);
          rasterContext.scale(rasterWidth, rasterHeight);
          rasterContext.fill(path);
        }),
      );
    }
    context.drawImage(
      raster,
      -Math.abs(width) / 2,
      -Math.abs(height) / 2,
      Math.abs(width),
      Math.abs(height),
    );
  }

  function drawEmitter(
    context: RenderingContext2D,
    emitter: CompiledEmitter2D,
    emitterLedger: CanvasEmitterLedger,
    currentParameters: Readonly<Float64Array>,
    effectTime: number,
    runSeed: number,
    componentOpacity: number,
    baseAlpha: number,
    baseTransform: DOMMatrix,
    population: FlowParticlePopulation2D | undefined,
  ): void {
    const renderer = emitter.renderer;
    const spriteSourceWidth =
      renderer.type === "sprite" ? imageWidth(renderer.source) : 0;
    const spriteSourceHeight =
      renderer.type === "sprite" ? imageHeight(renderer.source) : 0;
    context.globalCompositeOperation =
      renderer.blend === "additive" ? "lighter" : "source-over";

    let slot = emitterLedger.oldestSlot;
    let visited = 0;
    while (
      slot !== CANVAS_LEDGER_NO_SLOT &&
      visited < emitterLedger.liveCount
    ) {
      const next = emitterLedger.ageOrder[slot]!;
      visited += 1;
      if (emitterLedger.occupied[slot] === 1 && !population?.isRetired(slot)) {
        birth.seed = mix32(
          (runSeed >>> 0) ^ (emitterLedger.seedSalts[slot]! >>> 0),
        );
        birth.ordinal = emitterLedger.ordinals[slot]!;
        birth.birthTimeMilliseconds = emitterLedger.birthTimes[slot]!;
        const parameters = resolveParameters(
          currentParameters,
          emitterLedger.spawnEpochs[slot]!,
        );
        if (
          sampleParticle2D(emitter, birth, effectTime, parameters, registers)
        ) {
          const alpha = registers[Particle2DRegister.Alpha]! * componentOpacity;
          if (alpha > 0) {
            const width = registers[Particle2DRegister.SizeX]!;
            const height = registers[Particle2DRegister.SizeY]!;
            const x = population ? population.positions[slot * 2]! :
              registers[Particle2DRegister.X]! + emitterLedger.origins[slot * 2]!;
            const y = population ? population.positions[slot * 2 + 1]! :
              registers[Particle2DRegister.Y]! + emitterLedger.origins[slot * 2 + 1]!;
            context.setTransform(baseTransform);
            context.translate(x, y);
            context.rotate(
              registers[Particle2DRegister.Rotation]! * DEGREES_TO_RADIANS,
            );
            context.globalAlpha = baseAlpha * alpha;
            const colorKey = renderer.type === "sprite" ? 0 : fillColor(context);

            switch (renderer.type) {
              case "circle":
                context.beginPath();
                context.arc(0, 0, Math.abs(width) / 2, 0, TAU);
                context.fill();
                break;
              case "rectangle": {
                const drawWidth = Math.abs(width) * (renderer.aspectRatio ?? 1);
                const drawHeight = Math.abs(height);
                context.beginPath();
                context.rect(
                  -drawWidth / 2,
                  -drawHeight / 2,
                  drawWidth,
                  drawHeight,
                );
                context.fill();
                break;
              }
              case "path":
                if (emitterLedger.liveCount >= COMPLEX_RASTER_REUSE_THRESHOLD) {
                  drawPathRaster(
                    context,
                    renderer.path,
                    width,
                    height,
                    colorKey,
                  );
                } else {
                  context.scale(width, height);
                  context.fill(renderer.path);
                }
                break;
              case "sprite": {
                if (spriteSourceWidth <= 0 || spriteSourceHeight <= 0) break;
                const anchorX = renderer.anchor?.[0] ?? 0.5;
                const anchorY = renderer.anchor?.[1] ?? 0.5;
                context.drawImage(
                  renderer.source,
                  -anchorX * Math.abs(width),
                  -anchorY * Math.abs(height),
                  Math.abs(width),
                  Math.abs(height),
                );
                break;
              }
            }
          }
        }
      }
      slot = next;
    }
  }

  const executor: CanvasParticleExecutor = {
    owner: options.owner,
    backend: "canvas",
    execution: flow ? "flow-canvas" : "stateless-canvas",
    compiled,

    get parameters(): Readonly<Float64Array> {
      return selectedParameters();
    },

    requestRender(): void {
      options.requestRender();
    },

    prepareParameters(parameters): void {
      requireActive();
      if (parameters.length !== parameterLength) {
        throw new RangeError(
          "CRC Canvas particle parameter register length mismatch.",
        );
      }
      candidateParameters.set(parameters);
      parameterTransactionOpen = true;
    },

    adoptFrame(frame: ParticleSystemFrame): ParticleBindingFrameState {
      requireActive();
      ledgerTransactionOpen = true;
      candidateEffectTime = frame.effectTimeMilliseconds;
      candidateRunSeed = frame.seed;
      const epoch = options.currentSpawnEpoch?.() ?? 0;
      const summary = ledger.adoptFrame(frame, epoch, options.spawnParameters(epoch));
      advanceFlow();
      return summaryToFrameState(summary);
    },

    requestedBurstCount(emitterIndex, count, seed): number {
      requireActive();
      return ledger.requestedManualBirths(emitterIndex, count, seed);
    },

    emitBurst(
      request: ParticleBindingBurstRequest,
    ): ParticleBindingBurstResult {
      requireActive();
      if (request.origin.length !== 2) {
        throw new TypeError(
          "CRC Canvas particle burst origin must be two-dimensional.",
        );
      }
      ledgerTransactionOpen = true;
      candidateEffectTime = request.birthTimeMilliseconds;
      candidateRunSeed = request.seed;
      const result = ledger.emitManualSources({
        generation: request.generation,
        emitterIndex: request.emitterIndex,
        count: request.count,
        birthTimeMilliseconds: request.birthTimeMilliseconds,
        seed: request.seed,
        seedSalt: request.seedSalt,
        origin: request.origin,
        spawnEpoch: request.spawnEpoch,
        parameters: options.spawnParameters(request.spawnEpoch),
      });
      advanceFlow();
      const frameState = ledger.candidateSummary();
      return {
        ...summaryToFrameState(frameState),
        requested: result.requested,
        accepted: result.accepted,
        rejected: result.rejected,
      };
    },

    clear(): ParticleBindingFrameState {
      requireActive();
      ledgerTransactionOpen = true;
      ledger.clear();
      beginFlowTransaction();
      for (const population of candidateFlow) population.clear();
      return summaryToFrameState(ledger.candidateSummary());
    },

    finishTransaction(success: boolean): void {
      requireActive();
      if (flowTransactionOpen) {
        if (success) { const previous = committedFlow; committedFlow = candidateFlow; candidateFlow = previous; }
        flowTransactionOpen = false;
      }
      if (ledgerTransactionOpen) {
        ledger.finishTransaction(success);
        if (success) {
          committedEffectTime = candidateEffectTime;
          committedRunSeed = candidateRunSeed;
        } else {
          candidateEffectTime = committedEffectTime;
          candidateRunSeed = committedRunSeed;
        }
        ledgerTransactionOpen = false;
      }
      if (parameterTransactionOpen) {
        if (success) committedParameters.set(candidateParameters);
        else candidateParameters.set(committedParameters);
        parameterTransactionOpen = false;
      }
    },

    draw(context, contentBox, opacity, overflow): void {
      requireActive();
      const generation = selectedGeneration();
      const parameters = selectedParameters();
      const effectTime = selectedEffectTime();
      const runSeed = selectedRunSeed();
      context.save();
      try {
        context.translate(contentBox.x, contentBox.y);
        if (overflow === "clip") {
          context.beginPath();
          context.rect(0, 0, contentBox.width, contentBox.height);
          context.clip();
        }
        const baseAlpha = context.globalAlpha;
        const baseTransform = context.getTransform();
        for (
          let emitterIndex = 0;
          emitterIndex < compiled.emitters.length;
          emitterIndex += 1
        ) {
          const emitter = compiled.emitters[emitterIndex]!;
          const emitterLedger = generation.emitters[emitterIndex]!;
          if (
            !flow && missesContentBox(
              emitter,
              emitterLedger,
              contentBox.width,
              contentBox.height,
            )
          )
            continue;
          drawEmitter(
            context,
            emitter,
            emitterLedger,
            parameters,
            effectTime,
            runSeed,
            opacity,
            baseAlpha,
            baseTransform,
            (flowTransactionOpen ? candidateFlow : committedFlow)[emitterIndex],
          );
        }
      } finally {
        context.restore();
      }
    },

    get cacheEntries(): number {
      return rasterCache.totalSize;
    },

    dispose(): void {
      if (disposed) return;
      ledgerTransactionOpen = false;
      parameterTransactionOpen = false;
      disposed = true;
      committedFlow = [];
      candidateFlow = [];
      let firstError: unknown;
      try {
        ledger.dispose();
      } catch (error) {
        firstError = error;
      }
      try {
        rasterCache.dispose();
      } catch (error) {
        firstError ??= error;
      } finally {
        colorStrings.clear();
      }
      if (firstError !== undefined) throw firstError;
    },
  };
  return executor;
}
