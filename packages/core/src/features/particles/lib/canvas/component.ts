import {
  createElement,
  useLayoutBox,
  layoutDiagnostic,
  type PibblNode,
} from "@pibbl/core";
import {
  pibblInternalCurrentRenderOwner,
  pibblInternalOnRenderFinish,
  pibblInternalRequestRender,
  useInternalHookSlot,
  type PibblInternalRenderOwner,
} from "@pibbl/core/internal";
import { parseParticleColor } from "../color.js";
import type { CompiledEffect2D, CompiledParameterEntry } from "../compiler.js";
import type {
  PibblParticleEffect2D,
  PibblParticleCommonProps,
  PibblParticleParameterValue,
  PibblParticleParameterValues,
  Particles2DProps,
} from "../types.js";
import { useParticleSystemBinding } from "../system/binding.js";
import {
  createParticleSystemController,
  getParticleSystemController,
  type ParticleEffectCandidate,
  type ParticleSystemController,
} from "../system/controller.js";
import { resolveDeclaredParticleProps } from "../signal-inputs.js";
import {
  createCanvasParticleExecutor,
  type CanvasParticleExecutor,
} from "./executor.js";
import { ParticleCanvasPrimitive } from "./primitive.js";

interface ImplicitSystemSlot {
  readonly owner: PibblInternalRenderOwner;
  controller: ParticleSystemController | undefined;
  mountSettled: boolean;
  revision: number;
  disposed: boolean;
}

interface CanvasExecutorSlot {
  readonly owner: PibblInternalRenderOwner;
  controller: ParticleSystemController | undefined;
  pendingController: ParticleSystemController | undefined;
  committed: CanvasParticleExecutor | undefined;
  pending: CanvasParticleExecutor | undefined;
  revision: number;
  disposed: boolean;
}

function validateAllocation(
  allocation: Readonly<{
    width: number;
    height: number;
  }>,
): void {
  if (!Number.isFinite(allocation.width)) {
    throw layoutDiagnostic({
      component: "Particles2D",
      property: "width",
      value: allocation.width,
      algorithm: "component-allocation",
      reason: "requires a finite declared allocation",
    });
  }
  if (!Number.isFinite(allocation.height)) {
    throw layoutDiagnostic({
      component: "Particles2D",
      property: "height",
      value: allocation.height,
      algorithm: "component-allocation",
      reason: "requires a finite declared allocation",
    });
  }
}

function writeParameter(
  output: Float64Array,
  entry: CompiledParameterEntry,
  value: PibblParticleParameterValue,
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
      `Pibbl Particles2D parameter "${entry.name}" does not match ${entry.type}.`,
    );
  }
  output.set(numeric, entry.offset);
}

function resolveParameters(
  compiled: CompiledEffect2D,
  supplied: Readonly<Partial<PibblParticleParameterValues>> | undefined,
): Float64Array {
  const result = new Float64Array(compiled.parameterLayout.defaults);
  if (supplied === undefined) return result;
  for (const [name, value] of Object.entries(supplied)) {
    const entry = compiled.parameterLayout.byName.get(name);
    if (entry === undefined) {
      throw new TypeError(
        `Pibbl Particles2D received unknown parameter "${name}".`,
      );
    }
    if (value === undefined) continue;
    writeParameter(result, entry, value);
  }
  return result;
}

function prepareImplicitSystem(
  slot: ImplicitSystemSlot,
  owner: PibblInternalRenderOwner,
  effect: PibblParticleEffect2D,
  autoplay: boolean | undefined,
  seed: number | undefined,
): Readonly<{
  controller: ParticleSystemController;
  effectCandidate: ParticleEffectCandidate;
}> {
  if (slot.controller === undefined) {
    slot.controller = createParticleSystemController(owner, effect, {
      autoplay,
      seed,
    });
    slot.mountSettled = false;
  }
  const controller = slot.controller;
  const effectCandidate = controller.prepareEffect(effect, { autoplay, seed });
  const revision = ++slot.revision;
  pibblInternalOnRenderFinish(owner, (success) => {
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

/**
 * Renders one 2D effect through exactly one private Canvas drawing primitive.
 *
 * @param props - Particle system, drawing configuration, and event handlers. See
 * {@link Particles2DProps} .
 * @returns Pibbl nodes that paint the system's Canvas particles. See {@link PibblNode}.
 *
 * @see {@link Particles2DProps}
 * @see {@link PibblNode}
 * @see {@link PibblParticleParameterValues}
 */
export function Particles2D<
  EmitterName extends string,
  Parameters extends PibblParticleParameterValues,
>(props: Particles2DProps<EmitterName, Parameters>): PibblNode {
  const looseProps = resolveDeclaredParticleProps(
    props,
    PRESERVED_PARTICLE_PROPS,
    "style",
  ) as unknown as PibblParticleCommonProps<Parameters> & {
    readonly effect?: PibblParticleEffect2D<EmitterName, Parameters>;
    readonly system?: import("../types.js").PibblParticleSystem<
      EmitterName,
      Parameters
    >;
    readonly autoplay?: boolean;
    readonly seed?: number;
    readonly style?: import("../types.js").Particles2DStyle;
  };
  const owner = pibblInternalCurrentRenderOwner();
  const allocation = useLayoutBox();
  validateAllocation(allocation);

  const hasEffect = looseProps.effect !== undefined;
  const hasSystem = looseProps.system !== undefined;
  if (hasEffect === hasSystem) {
    throw new TypeError(
      "Pibbl Particles2D requires exactly one of effect or system.",
    );
  }
  if (
    hasSystem &&
    (looseProps.autoplay !== undefined || looseProps.seed !== undefined)
  ) {
    throw new TypeError(
      "Pibbl Particles2D autoplay and seed belong to implicit effect mode.",
    );
  }

  const implicitSlot = useInternalHookSlot<ImplicitSystemSlot>(
    "particles2d-implicit-system",
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
    throw new Error("Pibbl Particles2D changed render ownership.");
  }

  let controller: ParticleSystemController;
  let compiled: CompiledEffect2D;
  if (hasEffect) {
    const prepared = prepareImplicitSystem(
      implicitSlot,
      owner,
      looseProps.effect!,
      looseProps.autoplay,
      looseProps.seed,
    );
    controller = prepared.controller;
    compiled = prepared.effectCandidate.compiled as CompiledEffect2D;
  } else {
    controller = getParticleSystemController(looseProps.system!);
    if (controller.compiled.dimension !== 2) {
      throw new TypeError("Pibbl Particles2D requires a two-dimensional system.");
    }
    compiled = controller.compiled;
    implicitSlot.revision += 1;
  }

  const parameters = resolveParameters(
    compiled,
    looseProps.parameters as
      Readonly<Partial<PibblParticleParameterValues>> | undefined,
  );
  const executorSlot = useInternalHookSlot<CanvasExecutorSlot>(
    "particles2d-canvas-executor",
    (teardowns) => {
      const value: CanvasExecutorSlot = {
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
        value.controller = undefined;
        value.pendingController = undefined;
      });
      return value;
    },
  ).value;
  if (executorSlot.owner !== owner) {
    throw new Error("Pibbl Particles2D executor changed render ownership.");
  }

  let candidate: CanvasParticleExecutor;
  if (
    executorSlot.pending !== undefined &&
    executorSlot.pendingController === controller &&
    executorSlot.pending.compiled === compiled
  ) {
    // A managed Layer can compose the same child again before the shared outer
    // render transaction finishes. Consume the binding hook in place and keep
    // drawing its existing candidate; the original finish callback remains the
    // sole owner of reservation adoption and transaction finalization.
    useInternalHookSlot("particle-system-binding", () => {
      throw new Error("Pibbl Particles2D binding state was not initialized.");
    });
    candidate = executorSlot.pending;
    candidate.prepareParameters(parameters);
  } else {
    candidate = useParticleSystemBinding({
      system: controller.handle,
      backend: "canvas",
      onEvent: looseProps.onEvent,
      onError: looseProps.onError,
      create(bindingOwner) {
        const current = executorSlot.committed;
        if (
          current !== undefined &&
          executorSlot.controller === controller &&
          current.compiled === compiled
        ) {
          current.prepareParameters(parameters);
          executorSlot.pending = current;
          executorSlot.pendingController = controller;
          return current;
        }
        const next = createCanvasParticleExecutor({
          owner: bindingOwner,
          flow: controller.flow,
          compiled,
          parameters,
          requestRender: () => pibblInternalRequestRender(bindingOwner),
          currentSpawnEpoch: () => controller.currentSpawnEpoch,
          spawnParameters: (epoch) => controller.spawnParameters(epoch),
          retainSpawnEpoch: (epoch) => controller.retainSpawnEpoch(epoch),
          releaseSpawnEpoch: (epoch) => controller.releaseSpawnEpoch(epoch),
        });
        executorSlot.pending = next;
        executorSlot.pendingController = controller;
        return next;
      },
    }) as CanvasParticleExecutor;
  }

  const executorRevision = ++executorSlot.revision;
  pibblInternalOnRenderFinish(owner, (success) => {
    if (executorSlot.disposed || executorRevision !== executorSlot.revision) {
      return;
    }
    executorSlot.pending = undefined;
    executorSlot.pendingController = undefined;
    if (!success) return;
    executorSlot.committed = candidate;
    executorSlot.controller = controller;

    if (!hasEffect && implicitSlot.controller !== undefined) {
      const previousImplicit = implicitSlot.controller;
      implicitSlot.controller = undefined;
      implicitSlot.mountSettled = false;
      previousImplicit.dispose();
    }
  });

  return createElement(ParticleCanvasPrimitive, {
    executor: candidate,
    interaction: looseProps,
    style: looseProps.style,
  });
}

const PRESERVED_PARTICLE_PROPS = new Set<PropertyKey>(["system"]);
