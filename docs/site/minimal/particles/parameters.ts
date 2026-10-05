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
  emitters: [
    {
      name: "sparks",
      capacity: 100,
      emission: [{ type: "rate", particlesPerSecond: 12 }],
      shape: { type: "point" },
      initial: {
        lifetimeMilliseconds: 600,
        velocity: [particleParameter("wind"), -80],
        color: particleParameter("tint"),
      },
      bounds: { min: [-100, -100], max: [100, 100] },
      renderer: { type: "circle" },
    },
  ],
});

const output = document.createElement("pre");
output.textContent = `${effect.dimension}D effect parameters\n${JSON.stringify(overrides, null, 2)}`;
document.body.append(output);
