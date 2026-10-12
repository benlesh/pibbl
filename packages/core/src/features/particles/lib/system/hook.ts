import {
  pibblInternalCurrentRenderOwner,
  pibblInternalOnRenderFinish,
  useInternalHookSlot,
  type PibblInternalRenderOwner,
} from "@pibbl/core/internal";
import type {
  PibblParticleEffect2D,
  PibblParticleParameterValues,
  PibblParticleSystem,
  PibblParticleSystemOptions,
} from "../types.js";
import {
  resolveSignalFields,
  type SignalFields,
} from "../signal-inputs.js";
import { resolveSignalValue, type SignalValue } from "@pibbl/core";
import {
  createParticleSystemController,
  type ParticleSystemController,
} from "./controller.js";

interface ParticleSystemHookSlot {
  readonly controller: ParticleSystemController;
  readonly owner: PibblInternalRenderOwner;
  mountSettled: boolean;
  revision: number;
}

/**
 * Creates a mount-owned system retaining the effect's emitter and parameter types. See
 * {@link PibblParticleEffect2D}, {@link PibblParticleSystemOptions}, and {@link PibblParticleSystem}.
 * @param effect - Effect definition, optionally supplied by a signal. See {@link SignalValue} ,
 * {@link PibblParticleEffect2D} .
 * @param options - Playback and simulation options, optionally supplied by a signal. See
 * {@link SignalValue} , {@link SignalFields} , {@link PibblParticleSystemOptions} .
 * @returns Stable mount-owned controls for the particle simulation. See {@link PibblParticleSystem}.
 */
export function useParticleSystem<
  EmitterName extends string,
  Parameters extends PibblParticleParameterValues,
>(
  effect: SignalValue<PibblParticleEffect2D<EmitterName, Parameters>>,
  options?: SignalValue<SignalFields<PibblParticleSystemOptions>>,
): PibblParticleSystem<EmitterName, Parameters>;
/**
 * Creates one stable particle-system handle owned by the current hook slot.
 *
 * @param effectInput - Effect definition, optionally supplied by a signal. See {@link SignalValue}
 * , {@link PibblParticleEffect2D} .
 * @param optionsInput - Playback and simulation options, optionally supplied by a signal. See
 * {@link SignalValue} , {@link SignalFields} , {@link PibblParticleSystemOptions} .
 * @returns Stable mount-owned controls for the particle simulation. See {@link PibblParticleSystem}.
 *
 * @see {@link SignalValue}
 * @see {@link PibblParticleEffect2D}
 * @see {@link PibblParticleSystemOptions}
 * @see {@link PibblParticleSystem}
 */
export function useParticleSystem(
  effectInput: SignalValue<PibblParticleEffect2D>,
  optionsInput: SignalValue<SignalFields<PibblParticleSystemOptions>> = {},
): PibblParticleSystem {
  const owner = pibblInternalCurrentRenderOwner();
  const effect = resolveSignalValue(effectInput);
  const options = resolveSignalFields(optionsInput);
  const slot = useInternalHookSlot<ParticleSystemHookSlot>(
    "particle-system",
    (teardowns) => {
      const controller = createParticleSystemController(owner, effect, options);
      const value: ParticleSystemHookSlot = {
        controller,
        owner,
        mountSettled: false,
        revision: 0,
      };
      teardowns.add(() => controller.dispose());
      return value;
    },
  ).value;
  if (slot.owner !== owner) {
    throw new Error("A Pibbl particle system hook changed render ownership.");
  }
  const candidate = slot.controller.prepareEffect(effect, options);
  const revision = ++slot.revision;
  pibblInternalOnRenderFinish(owner, (success) => {
    if (!success || revision !== slot.revision) {
      slot.controller.cancelEffect(candidate);
      return;
    }
    slot.controller.adoptEffect(candidate);
    if (!slot.mountSettled) {
      slot.mountSettled = true;
      if (options.autoplay === true) slot.controller.handle.play();
    }
  });
  return slot.controller.handle;
}
