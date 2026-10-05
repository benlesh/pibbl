import {
  particleChoice,
  particleCurve,
  particleGradient,
  particleInteger,
  particleParameter,
  particleRange,
  type CRCParticleChoice,
  type CRCParticleCurve,
  type CRCParticleCurveOptions,
  type CRCParticleCurveValue,
  type CRCParticleGradient,
  type CRCParticleIntegerRange,
  type CRCParticleParameterReference,
  type CRCParticleRange,
  type CRCParticleScalar,
  type CRCParticleVector2,
} from "@crc/core/particles";

const speed: CRCParticleRange = particleRange(60, 120);
const count: CRCParticleIntegerRange = particleInteger(8, 16);
const colors: CRCParticleChoice<string> = particleChoice([
  { value: "#f97316", weight: 3 },
  { value: "#facc15", weight: 1 },
]);
const wind: CRCParticleParameterReference<"wind"> = particleParameter("wind");
const velocity: CRCParticleVector2 = [wind, speed];
const opacity: CRCParticleCurve<number> = particleCurve([[0, 1], [1, 0]]);
const color: CRCParticleGradient = particleGradient([
  [0, "#facc15"],
  [1, "#ef4444"],
]);
const sizeValue: CRCParticleCurveValue = [12, 18];
const smooth: CRCParticleCurveOptions = { easing: (t) => t * t };
const size = particleCurve([[0, sizeValue], [1, [0, 0]]], smooth);
const lifetime: CRCParticleScalar = particleRange(500, 900);

console.log({ count, colors, velocity, opacity, color, size, lifetime });
