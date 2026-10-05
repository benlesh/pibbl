import {
  particleChoice,
  particleCurve,
  particleGradient,
  particleInteger,
  particleParameter,
  particleRange,
  type PibblParticleChoice,
  type PibblParticleCurve,
  type PibblParticleCurveOptions,
  type PibblParticleCurveValue,
  type PibblParticleGradient,
  type PibblParticleIntegerRange,
  type PibblParticleParameterReference,
  type PibblParticleRange,
  type PibblParticleScalar,
  type PibblParticleVector2,
} from "@pibbl/core/particles";

const speed: PibblParticleRange = particleRange(60, 120);
const count: PibblParticleIntegerRange = particleInteger(8, 16);
const colors: PibblParticleChoice<string> = particleChoice([
  { value: "#f97316", weight: 3 },
  { value: "#facc15", weight: 1 },
]);
const wind: PibblParticleParameterReference<"wind"> = particleParameter("wind");
const velocity: PibblParticleVector2 = [wind, speed];
const opacity: PibblParticleCurve<number> = particleCurve([
  [0, 1],
  [1, 0],
]);
const color: PibblParticleGradient = particleGradient([
  [0, "#facc15"],
  [1, "#ef4444"],
]);
const sizeValue: PibblParticleCurveValue = [12, 18];
const smooth: PibblParticleCurveOptions = { easing: (t) => t * t };
const size = particleCurve(
  [
    [0, sizeValue],
    [1, [0, 0]],
  ],
  smooth,
);
const lifetime: PibblParticleScalar = particleRange(500, 900);

const output = document.createElement("pre");
output.textContent = JSON.stringify(
  { count, colors, velocity, opacity, color, size, lifetime },
  null,
  2,
);
document.body.append(output);
