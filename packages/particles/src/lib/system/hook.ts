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
import type { CRCParticleEffect3D } from "../webgl-types.js";
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

export function crcParticleSystem<
  EmitterName extends string,
  Parameters extends CRCParticleParameterValues,
>(
  effect: CRCParticleEffect2D<EmitterName, Parameters>,
  options?: CRCParticleSystemOptions,
): CRCParticleSystem<EmitterName, Parameters, 2>;
export function crcParticleSystem<
  EmitterName extends string,
  Parameters extends CRCParticleParameterValues,
>(
  effect: CRCParticleEffect3D<EmitterName, Parameters>,
  options?: CRCParticleSystemOptions,
): CRCParticleSystem<EmitterName, Parameters, 3>;
/** Creates one stable particle-system handle owned by the current hook slot. */
export function crcParticleSystem(
  effect: CRCParticleEffect2D | CRCParticleEffect3D,
  options: CRCParticleSystemOptions = {},
): CRCParticleSystem {
  const owner = crcInternalCurrentRenderOwner();
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
