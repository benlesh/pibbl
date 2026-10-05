import {
  crcInternalCurrentRenderOwner,
  crcInternalOnRenderFinish,
  useInternalHookSlot,
  type CRCInternalRenderOwner,
} from "@crc/core/internal";
import type {
  CRCParticleEffect2D,
  CRCParticleParameterValues,
  CRCParticleSystem,
  CRCParticleSystemOptions,
} from "../types.js";
import {
  resolveSignalFields,
  type SignalFields,
} from "../signal-inputs.js";
import { resolveSignalValue, type SignalValue } from "@crc/core";
import {
  createParticleSystemController,
  type ParticleSystemController,
} from "./controller.js";

interface ParticleSystemHookSlot {
  readonly controller: ParticleSystemController;
  readonly owner: CRCInternalRenderOwner;
  mountSettled: boolean;
  revision: number;
}

/**
 * Creates a mount-owned system retaining the effect's emitter and parameter types. See
 * {@link CRCParticleEffect2D}, {@link CRCParticleSystemOptions}, and {@link CRCParticleSystem}.
 * @param effect - Effect definition, optionally supplied by a signal. See {@link SignalValue} ,
 * {@link CRCParticleEffect2D} .
 * @param options - Playback and simulation options, optionally supplied by a signal. See
 * {@link SignalValue} , {@link SignalFields} , {@link CRCParticleSystemOptions} .
 * @returns Stable mount-owned controls for the particle simulation. See {@link CRCParticleSystem}.
 */
export function useParticleSystem<
  EmitterName extends string,
  Parameters extends CRCParticleParameterValues,
>(
  effect: SignalValue<CRCParticleEffect2D<EmitterName, Parameters>>,
  options?: SignalValue<SignalFields<CRCParticleSystemOptions>>,
): CRCParticleSystem<EmitterName, Parameters>;
/**
 * Creates one stable particle-system handle owned by the current hook slot.
 *
 * @param effectInput - Effect definition, optionally supplied by a signal. See {@link SignalValue}
 * , {@link CRCParticleEffect2D} .
 * @param optionsInput - Playback and simulation options, optionally supplied by a signal. See
 * {@link SignalValue} , {@link SignalFields} , {@link CRCParticleSystemOptions} .
 * @returns Stable mount-owned controls for the particle simulation. See {@link CRCParticleSystem}.
 *
 * @see {@link SignalValue}
 * @see {@link CRCParticleEffect2D}
 * @see {@link CRCParticleSystemOptions}
 * @see {@link CRCParticleSystem}
 */
export function useParticleSystem(
  effectInput: SignalValue<CRCParticleEffect2D>,
  optionsInput: SignalValue<SignalFields<CRCParticleSystemOptions>> = {},
): CRCParticleSystem {
  const owner = crcInternalCurrentRenderOwner();
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
    throw new Error("A CRC particle system hook changed render ownership.");
  }
  const candidate = slot.controller.prepareEffect(effect, options);
  const revision = ++slot.revision;
  crcInternalOnRenderFinish(owner, (success) => {
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
