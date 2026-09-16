import type { CRCNode } from "@crc/core";
import {
  crcInternalCurrentRenderOwner,
  crcInternalOnRenderFinish,
  crcInternalRequestRender,
  getCurrentElementSource,
  useBackendEventTarget,
  useInternalHookSlot,
  type CRCInternalRenderOwner,
} from "@crc/core/internal";
import {
  submitWebGLInstanced,
  type CRCWebGLBounds,
} from "@crc/webgl/internal";
import { parseParticleColor } from "../color.js";
import type {
  CompiledEffect3D,
  CompiledParameterEntry,
} from "../compiler.js";
import type {
  CRCParticleEffect3D,
  Particles3DProps,
  Particles3DStyle,
} from "../webgl-types.js";
import type {
  CRCParticleParameterValue,
  CRCParticleParameterValues,
  CRCParticleSystemStatus,
} from "../types.js";
import {
  createParticleSystemController,
  getParticleSystemController,
  type ParticleEffectCandidate,
  type ParticleSystemController,
} from "../system/controller.js";
import {
  useParticleSystemBinding,
  type ParticleBindingCandidate,
  type ParticleBindingFrameState,
  type ParticleSystemFrame,
} from "../system/binding.js";
import { createParticleRecipes3D } from "./recipe.js";

interface ImplicitSystemSlot {
  readonly owner: CRCInternalRenderOwner;
  controller: ParticleSystemController | undefined;
  mountSettled: boolean;
  revision: number;
  disposed: boolean;
}

interface WebGLExecutorSlot {
  readonly owner: CRCInternalRenderOwner;
  controller: ParticleSystemController | undefined;
  pendingController: ParticleSystemController | undefined;
  committed: WebGLParticleCandidate | undefined;
  pending: WebGLParticleCandidate | undefined;
  revision: number;
  disposed: boolean;
}

interface WebGLParticleCandidate extends ParticleBindingCandidate {
  readonly compiled: CompiledEffect3D;
  prepareParameters(parameters: Readonly<Float64Array>): void;
  frameUniforms(): Readonly<Float32Array>;
}

function writeParameter(
  output: Float64Array,
  entry: CompiledParameterEntry,
  value: CRCParticleParameterValue,
): void {
  const numeric: readonly number[] | undefined =
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
      `CRC Particles3D parameter "${entry.name}" does not match ${entry.type}.`,
    );
  }
  output.set(numeric, entry.offset);
}

function resolveParameters(
  compiled: CompiledEffect3D,
  supplied: Readonly<Partial<CRCParticleParameterValues>> | undefined,
): Float64Array {
  const result = new Float64Array(compiled.parameterLayout.defaults);
  if (supplied === undefined) return result;
  for (const [name, value] of Object.entries(supplied)) {
    const entry = compiled.parameterLayout.byName.get(name);
    if (!entry) {
      throw new TypeError(
        `CRC Particles3D received unknown parameter "${name}".`,
      );
    }
    if (value !== undefined) writeParameter(result, entry, value);
  }
  return result;
}

function prepareImplicitSystem(
  slot: ImplicitSystemSlot,
  owner: CRCInternalRenderOwner,
  effect: CRCParticleEffect3D,
  autoplay: boolean | undefined,
  seed: number | undefined,
): Readonly<{
  controller: ParticleSystemController;
  effectCandidate: ParticleEffectCandidate;
}> {
  if (!slot.controller) {
    slot.controller = createParticleSystemController(owner, effect, {
      autoplay,
      seed,
    });
    slot.mountSettled = false;
  }
  const controller = slot.controller;
  const effectCandidate = controller.prepareEffect(effect, { autoplay, seed });
  const revision = ++slot.revision;
  crcInternalOnRenderFinish(owner, (success) => {
    if (!success || slot.disposed || revision !== slot.revision) {
      controller.cancelEffect(effectCandidate);
      return;
    }
    controller.adoptEffect(effectCandidate);
    if (!slot.mountSettled) {
      slot.mountSettled = true;
      if (autoplay === true) controller.handle.play();
    }
  });
  return { controller, effectCandidate };
}

function maximumLifetime(
  compiled: CompiledEffect3D,
  parameters: Readonly<Float64Array>,
): number {
  let result = 0;
  for (const emitter of compiled.emitters) {
    result = Math.max(
      result,
      emitter.maximumLifetime.kind === "fixed"
        ? emitter.maximumLifetime.milliseconds
        : parameters[emitter.maximumLifetime.offset]!,
    );
  }
  return result;
}

function fixedParametersEqual(
  compiled: CompiledEffect3D,
  left: Readonly<Float64Array>,
  right: Readonly<Float64Array>,
): boolean {
  for (let index = 0; index < left.length; index += 1) {
    if (
      (compiled.parameterLayout.spawnMask[index] === 1 ||
        compiled.parameterLayout.simulationMask[index] === 1) &&
      !Object.is(left[index], right[index])
    ) {
      return false;
    }
  }
  return true;
}

function frameState(
  compiled: CompiledEffect3D,
  parameters: Readonly<Float64Array>,
  frame: ParticleSystemFrame,
  emissionCutoff: number,
): ParticleBindingFrameState {
  const lifetime = maximumLifetime(compiled, parameters);
  const latestDeath = emissionCutoff + lifetime;
  const alive =
    frame.status !== "idle" &&
    frame.status !== "finished" &&
    (frame.status !== "draining" || frame.effectTimeMilliseconds < latestDeath);
  const infinite = compiled.emitters.some(
    (emitter) => emitter.emission.completion === "automatic-infinite",
  );
  const latestAutomatic = Math.max(
    ...compiled.emitters.map(
      (emitter) => emitter.emission.latestAutomaticBirthMilliseconds ?? -1,
    ),
  );
  return Object.freeze({
    liveCount: alive
      ? compiled.emitters.reduce((sum, emitter) => sum + emitter.capacity, 0)
      : 0,
    nextAutomaticBirthMilliseconds:
      frame.status !== "running"
        ? null
        : infinite || frame.effectTimeMilliseconds < latestAutomatic
          ? frame.effectTimeMilliseconds + 1
          : null,
    latestDeathMilliseconds: alive ? latestDeath : null,
  });
}

function createWebGLParticleCandidate(input: Readonly<{
  owner: CRCInternalRenderOwner;
  compiled: CompiledEffect3D;
  parameters: Readonly<Float64Array>;
}>): WebGLParticleCandidate {
  let committedParameters = new Float64Array(input.parameters);
  let pendingParameters = committedParameters;
  let frame: ParticleSystemFrame | undefined;
  let emissionCutoff = 0;
  let generation = -1;
  let disposed = false;

  const candidate: WebGLParticleCandidate = {
    owner: input.owner,
    backend: "webgl",
    execution: "stateless-webgl",
    compiled: input.compiled,
    get parameters() {
      return pendingParameters;
    },
    prepareParameters(parameters) {
      if (disposed) throw new Error("CRC Particles3D executor is disposed.");
      if (!fixedParametersEqual(input.compiled, committedParameters, parameters)) {
        throw new TypeError(
          "CRC Particles3D spawn and simulation parameters are fixed for a running stateless WebGL binding; restart with a new system to change them.",
        );
      }
      pendingParameters = new Float64Array(parameters);
    },
    requestRender() {
      if (!disposed) crcInternalRequestRender(input.owner);
    },
    adoptFrame(nextFrame) {
      if (nextFrame.generation !== generation) {
        generation = nextFrame.generation;
        emissionCutoff = nextFrame.effectTimeMilliseconds;
      }
      if (nextFrame.status === "running") {
        emissionCutoff = nextFrame.effectTimeMilliseconds;
      }
      frame = nextFrame;
      return frameState(
        input.compiled,
        committedParameters,
        nextFrame,
        emissionCutoff,
      );
    },
    clear() {
      frame = undefined;
      emissionCutoff = 0;
      return Object.freeze({
        liveCount: 0,
        nextAutomaticBirthMilliseconds: null,
        latestDeathMilliseconds: null,
      });
    },
    finishTransaction(success) {
      if (success) committedParameters = pendingParameters;
      else pendingParameters = committedParameters;
    },
    frameUniforms() {
      const output = new Float32Array(
        5 + input.compiled.parameterLayout.defaults.length,
      );
      const current = frame;
      const seed = current?.seed ?? 0;
      output[0] = current?.effectTimeMilliseconds ?? 0;
      output[1] = seed & 0xffff;
      output[2] = seed >>> 16;
      output[3] = isVisibleStatus(current?.status) ? 1 : 0;
      output[4] = current ? emissionCutoff : 0;
      output.set(pendingParameters, 5);
      return output;
    },
    dispose() {
      disposed = true;
      frame = undefined;
    },
  };
  return Object.freeze(candidate);
}

function isVisibleStatus(status: CRCParticleSystemStatus | undefined): boolean {
  return status === "running" || status === "paused" || status === "draining";
}

function validateBounds(bounds: CRCWebGLBounds, field: string): void {
  for (const axis of [0, 1, 2] as const) {
    if (!Number.isFinite(bounds.min[axis]) || !Number.isFinite(bounds.max[axis])) {
      throw new TypeError(`CRC Particles3D ${field} must contain finite bounds.`);
    }
    if (bounds.min[axis] > bounds.max[axis]) {
      throw new RangeError(
        `CRC Particles3D ${field}.min[${axis}] must not exceed max[${axis}].`,
      );
    }
  }
}

function resolveOpacity(style: Particles3DStyle | undefined): number {
  const opacity = style?.opacity ?? 1;
  if (!Number.isFinite(opacity)) {
    throw new TypeError("CRC Particles3D style.opacity must be finite.");
  }
  if (opacity < 0 || opacity > 1) {
    throw new RangeError(
      "CRC Particles3D style.opacity must be between 0 and 1.",
    );
  }
  if ((style as { filter?: unknown } | undefined)?.filter !== undefined) {
    throw new TypeError(
      "CRC Particles3D cannot use Canvas filters; apply filters to WebGLLayer.",
    );
  }
  return opacity;
}

function composeModelMatrix(
  style: Particles3DStyle | undefined,
): Float32Array {
  const read = (field: keyof Particles3DStyle, fallback: number) => {
    const value = style?.[field] ?? fallback;
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new TypeError(`CRC Particles3D style.${field} must be finite.`);
    }
    if (field.startsWith("scale") && value === 0) {
      throw new RangeError(`CRC Particles3D style.${field} must be nonzero.`);
    }
    return value;
  };
  const tx = read("translateX", 0);
  const ty = read("translateY", 0);
  const tz = read("translateZ", 0);
  const rx = (read("rotationXDegrees", 0) * Math.PI) / 180;
  const ry = (read("rotationYDegrees", 0) * Math.PI) / 180;
  const rz = (read("rotationZDegrees", 0) * Math.PI) / 180;
  const sx = read("scaleX", 1);
  const sy = read("scaleY", 1);
  const sz = read("scaleZ", 1);
  const sinX = Math.sin(rx);
  const cosX = Math.cos(rx);
  const sinY = Math.sin(ry);
  const cosY = Math.cos(ry);
  const sinZ = Math.sin(rz);
  const cosZ = Math.cos(rz);
  return new Float32Array([
    cosZ * cosY * sx,
    sinZ * cosY * sx,
    -sinY * sx,
    0,
    (cosZ * sinY * sinX - sinZ * cosX) * sy,
    (sinZ * sinY * sinX + cosZ * cosX) * sy,
    cosY * sinX * sy,
    0,
    (cosZ * sinY * cosX + sinZ * sinX) * sz,
    (sinZ * sinY * cosX - cosZ * sinX) * sz,
    cosY * cosX * sz,
    0,
    tx,
    ty,
    tz,
    1,
  ]);
}

/** Contributes one stateless, fixed-capacity 3D particle system to WebGLLayer. */
export function Particles3D<
  EmitterName extends string,
  Parameters extends CRCParticleParameterValues,
>(props: Particles3DProps<EmitterName, Parameters>): CRCNode {
  const owner = crcInternalCurrentRenderOwner();
  const looseProps = props as Particles3DProps & {
    readonly effect?: CRCParticleEffect3D;
  };
  const hasEffect = looseProps.effect !== undefined;
  const hasSystem = looseProps.system !== undefined;
  if (hasEffect === hasSystem) {
    throw new TypeError(
      "CRC Particles3D requires exactly one of effect or system.",
    );
  }
  if (
    hasSystem &&
    (looseProps.autoplay !== undefined || looseProps.seed !== undefined)
  ) {
    throw new TypeError(
      "CRC Particles3D autoplay and seed belong to implicit effect mode.",
    );
  }
  if (looseProps.execution === "cpu") {
    throw new TypeError(
      "CRC Particles3D CPU WebGL execution is not available; use auto or gpu for stateless analytic effects.",
    );
  }
  if (
    looseProps.execution !== undefined &&
    looseProps.execution !== "auto" &&
    looseProps.execution !== "gpu"
  ) {
    throw new TypeError(
      'CRC Particles3D execution must be "auto", "cpu", or "gpu".',
    );
  }

  const implicitSlot = useInternalHookSlot<ImplicitSystemSlot>(
    "particles3d-implicit-system",
    (teardowns) => {
      const value: ImplicitSystemSlot = {
        owner,
        controller: undefined,
        mountSettled: false,
        revision: 0,
        disposed: false,
      };
      teardowns.add(() => {
        value.disposed = true;
        value.controller?.dispose();
        value.controller = undefined;
      });
      return value;
    },
  ).value;
  if (implicitSlot.owner !== owner) {
    throw new Error("CRC Particles3D changed render ownership.");
  }

  let controller: ParticleSystemController;
  let compiled: CompiledEffect3D;
  if (hasEffect) {
    const prepared = prepareImplicitSystem(
      implicitSlot,
      owner,
      looseProps.effect!,
      looseProps.autoplay,
      looseProps.seed,
    );
    controller = prepared.controller;
    compiled = prepared.effectCandidate.compiled as CompiledEffect3D;
  } else {
    controller = getParticleSystemController(looseProps.system!);
    if (controller.compiled.dimension !== 3) {
      throw new TypeError("CRC Particles3D requires a three-dimensional system.");
    }
    compiled = controller.compiled;
    implicitSlot.revision += 1;
  }
  const capability = compiled.execution["stateless-webgl"];
  if (!capability.supported) {
    throw new TypeError(
      `CRC Particles3D cannot use stateless WebGL execution: ${capability.reasons.join("; ")}.`,
    );
  }
  const parameters = resolveParameters(
    compiled,
    looseProps.parameters as
      | Readonly<Partial<CRCParticleParameterValues>>
      | undefined,
  );

  const executorSlot = useInternalHookSlot<WebGLExecutorSlot>(
    "particles3d-webgl-executor",
    (teardowns) => {
      const value: WebGLExecutorSlot = {
        owner,
        controller: undefined,
        pendingController: undefined,
        committed: undefined,
        pending: undefined,
        revision: 0,
        disposed: false,
      };
      teardowns.add(() => {
        value.disposed = true;
        value.pending?.dispose();
        if (value.committed !== value.pending) value.committed?.dispose();
        value.pending = undefined;
        value.committed = undefined;
      });
      return value;
    },
  ).value;
  if (executorSlot.owner !== owner) {
    throw new Error("CRC Particles3D executor changed render ownership.");
  }

  let candidate: WebGLParticleCandidate;
  if (
    executorSlot.pending &&
    executorSlot.pendingController === controller &&
    executorSlot.pending.compiled === compiled
  ) {
    useInternalHookSlot("particle-system-binding", () => {
      throw new Error("CRC Particles3D binding state was not initialized.");
    });
    candidate = executorSlot.pending;
    candidate.prepareParameters(parameters);
  } else {
    candidate = useParticleSystemBinding({
      system: controller.handle,
      backend: "webgl",
      onEvent: looseProps.onEvent,
      onError: looseProps.onError,
      create(bindingOwner) {
        const current = executorSlot.committed;
        if (
          current &&
          executorSlot.controller === controller &&
          current.compiled === compiled
        ) {
          current.prepareParameters(parameters);
          executorSlot.pending = current;
          executorSlot.pendingController = controller;
          return current;
        }
        const next = createWebGLParticleCandidate({
          owner: bindingOwner,
          compiled,
          parameters,
        });
        executorSlot.pending = next;
        executorSlot.pendingController = controller;
        return next;
      },
    }) as WebGLParticleCandidate;
  }

  const revision = ++executorSlot.revision;
  crcInternalOnRenderFinish(owner, (success) => {
    if (executorSlot.disposed || revision !== executorSlot.revision) return;
    executorSlot.pending = undefined;
    executorSlot.pendingController = undefined;
    if (!success) return;
    executorSlot.committed = candidate;
    executorSlot.controller = controller;
    if (!hasEffect && implicitSlot.controller) {
      const previous = implicitSlot.controller;
      implicitSlot.controller = undefined;
      implicitSlot.mountSettled = false;
      previous.dispose();
    }
  });

  const interactionBounds = looseProps.interactionBounds;
  const pointerEvents = looseProps.pointerEvents ?? "auto";
  if (pointerEvents !== "none" && interactionBounds === undefined) {
    throw new TypeError(
      'CRC Particles3D requires finite interactionBounds unless pointerEvents is "none".',
    );
  }
  if (interactionBounds) validateBounds(interactionBounds, "interactionBounds");
  const target = useBackendEventTarget(
    looseProps,
    {
      cursor: looseProps.style?.cursor,
      deferKeyboardNavigationGeometry: true,
      keyboardFocusable: looseProps.keyboardFocusable,
    },
    pointerEvents,
  );
  const opacity = resolveOpacity(looseProps.style);
  const localModel = composeModelMatrix(looseProps.style);
  const source = getCurrentElementSource();
  const frameUniforms = candidate.frameUniforms();
  const recipes = createParticleRecipes3D(compiled, candidate.parameters);
  for (let index = 0; index < recipes.length; index += 1) {
    const { emitter, recipe } = recipes[index]!;
    const bounds = interactionBounds ?? emitter.bounds;
    validateBounds(bounds, `emitter "${emitter.name}" bounds`);
    submitWebGLInstanced({
      kind: "instanced",
      componentName: `Particles3D(${emitter.name})`,
      source,
      localModel,
      localBounds: bounds,
      opacity,
      material: {
        type: emitter.renderer.material,
        blend: emitter.renderer.blend,
      },
      depthTest: emitter.renderer.depthTest ?? true,
      depthWrite:
        emitter.renderer.depthWrite ?? emitter.renderer.blend === "cutout",
      sorting:
        emitter.renderer.sorting === "oldest-first" ||
        emitter.renderer.sorting === "youngest-first"
          ? emitter.renderer.sorting
          : "none",
      target: index === 0 ? target : undefined,
      recipe,
      frameUniforms,
    });
  }
  return undefined;
}
