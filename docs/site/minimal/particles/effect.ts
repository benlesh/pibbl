import {
  defineParticleEffect2D,
  particleCurve,
  particleGradient,
  type CRCParticleAppearance,
  type CRCParticleBounds2D,
  type CRCParticleEffect2D,
  type CRCParticleEffect2DInput,
  type CRCParticleEmission,
  type CRCParticleEmitter2D,
  type CRCParticleInitial2D,
  type CRCParticleMotion2D,
  type CRCParticleOverflow,
  type CRCParticleRenderer2D,
  type CRCParticleShape2D,
} from "@crc/core/particles";

const emission: CRCParticleEmission = { type: "rate", particlesPerSecond: 24 };
const shape: CRCParticleShape2D = {
  type: "line",
  from: [-30, 0],
  to: [30, 0],
};
const initial: CRCParticleInitial2D = {
  lifetimeMilliseconds: 800,
  velocity: [0, -90],
  size: 8,
  color: "#f97316",
};
const motion: CRCParticleMotion2D = {
  type: "gravity",
  value: [0, 120],
};
const appearance: CRCParticleAppearance = {
  opacity: particleCurve([[0, 1], [1, 0]]),
  color: particleGradient([[0, "#facc15"], [1, "#ef4444"]]),
};
const renderer: CRCParticleRenderer2D = { type: "circle" };
const bounds: CRCParticleBounds2D = {
  min: [-100, -150],
  max: [100, 150],
};
const overflow: CRCParticleOverflow = "recycle-oldest";
const emitter: CRCParticleEmitter2D = {
  name: "embers",
  capacity: 300,
  overflow,
  emission: [emission],
  shape,
  initial,
  motion: [motion],
  appearance,
  renderer,
  bounds,
};
const input: CRCParticleEffect2DInput = { emitters: [emitter] };
const effect: CRCParticleEffect2D = defineParticleEffect2D(input);

console.log(effect.dimension);
