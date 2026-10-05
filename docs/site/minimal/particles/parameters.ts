import {
  defineParticleEffect2D,
  particleParameter,
  type PibblParticleParameterDefinition,
  type PibblParticleParameterDefinitions,
  type PibblParticleParameterTiming,
  type PibblParticleParameterValue,
  type PibblParticleParameterValues,
  type PibblParticleValueFor,
  type PibblParticleValuesOf,
} from "@pibbl/core/particles";

const timing: PibblParticleParameterTiming = "spawn";
const windDefinition: PibblParticleParameterDefinition = {
  type: "number",
  default: 0,
  timing,
};
const parameters = {
  wind: windDefinition,
  tint: { type: "color", default: "#60a5fa", timing: "render" },
} as const satisfies PibblParticleParameterDefinitions;
const wind: PibblParticleValueFor<typeof windDefinition> = 20;
const values: PibblParticleValuesOf<typeof parameters> = {
  wind,
  tint: "#facc15",
};
const oneValue: PibblParticleParameterValue = values.tint;
const overrides: PibblParticleParameterValues = { ...values, current: oneValue };
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
