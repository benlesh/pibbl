import {
  defineParticleEffect2D,
  particleCurve,
  particleGradient,
  type PibblParticleAppearance,
  type PibblParticleBounds2D,
  type PibblParticleEffect2D,
  type PibblParticleEffect2DInput,
  type PibblParticleEmission,
  type PibblParticleEmitter2D,
  type PibblParticleInitial2D,
  type PibblParticleMotion2D,
  type PibblParticleOverflow,
  type PibblParticleRenderer2D,
  type PibblParticleShape2D,
} from "@pibbl/core/particles";

const emission: PibblParticleEmission = { type: "rate", particlesPerSecond: 24 };
const shape: PibblParticleShape2D = {
  type: "line",
  from: [-30, 0],
  to: [30, 0],
};
const initial: PibblParticleInitial2D = {
  lifetimeMilliseconds: 800,
  velocity: [0, -90],
  size: 8,
  color: "#f97316",
};
const motion: PibblParticleMotion2D = {
  type: "gravity",
  value: [0, 120],
};
const appearance: PibblParticleAppearance = {
  opacity: particleCurve([
    [0, 1],
    [1, 0],
  ]),
  color: particleGradient([
    [0, "#facc15"],
    [1, "#ef4444"],
  ]),
};
const renderer: PibblParticleRenderer2D = { type: "circle" };
const bounds: PibblParticleBounds2D = {
  min: [-100, -150],
  max: [100, 150],
};
const overflow: PibblParticleOverflow = "recycle-oldest";
const emitter: PibblParticleEmitter2D = {
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
const input: PibblParticleEffect2DInput = { emitters: [emitter] };
const effect: PibblParticleEffect2D = defineParticleEffect2D(input);

const output = document.createElement("pre");
output.textContent = `Created ${effect.dimension}D effect with ${input.emitters.length} emitter.`;
document.body.append(output);
