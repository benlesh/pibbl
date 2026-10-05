import {
  defineParticleEffect2D,
  particleParameter,
  type CRCParticleParameterDefinition,
  type CRCParticleParameterDefinitions,
  type CRCParticleParameterTiming,
  type CRCParticleParameterValue,
  type CRCParticleParameterValues,
  type CRCParticleValueFor,
  type CRCParticleValuesOf,
} from "@crc/core/particles";

const timing: CRCParticleParameterTiming = "spawn";
const windDefinition: CRCParticleParameterDefinition = {
  type: "number",
  default: 0,
  timing,
};
const parameters = {
  wind: windDefinition,
  tint: { type: "color", default: "#60a5fa", timing: "render" },
} as const satisfies CRCParticleParameterDefinitions;
const wind: CRCParticleValueFor<typeof windDefinition> = 20;
const values: CRCParticleValuesOf<typeof parameters> = {
  wind,
  tint: "#facc15",
};
const oneValue: CRCParticleParameterValue = values.tint;
const overrides: CRCParticleParameterValues = { ...values, current: oneValue };
const effect = defineParticleEffect2D({
  parameters,
  emitters: [{
    name: "sparks",
    capacity: 100,
    emission: [{ type: "rate", particlesPerSecond: 12 }],
    shape: { type: "point" },
    initial: {
      lifetimeMilliseconds: 600,
      velocity: [particleParameter("wind"), -80],
      color: particleParameter("tint"),
    },
    renderer: { type: "circle" },
  }],
});

console.log(effect.dimension, overrides);
