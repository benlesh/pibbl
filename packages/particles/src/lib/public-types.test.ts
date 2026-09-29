import type {
  CRCParticleAppearance,
  CRCParticleBounds2D,
  CRCParticleBurstAcceptedEvent,
  CRCParticleBurstOverrides,
  CRCParticleBurstRejectedEvent,
  CRCParticleChoice,
  CRCParticleCommonProps,
  CRCParticleCurve,
  CRCParticleCurveOptions,
  CRCParticleCurveValue,
  CRCParticleDiagnostic,
  CRCParticleDrainStartEvent,
  CRCParticleEffect2D,
  CRCParticleEffect2DInput,
  CRCParticleEmission,
  CRCParticleEmitter2D,
  CRCParticleExecution,
  CRCParticleFinishEvent,
  CRCParticleGradient,
  CRCParticleInitial2D,
  CRCParticleIntegerRange,
  CRCParticleMotion2D,
  CRCParticleOverflow,
  CRCParticleParameterDefinition,
  CRCParticleParameterDefinitions,
  CRCParticleParameterReference,
  CRCParticleParameterTiming,
  CRCParticleParameterValue,
  CRCParticleParameterValues,
  CRCParticleRange,
  CRCParticleRenderer2D,
  CRCParticleScalar,
  CRCParticleShape2D,
  CRCParticleStartEvent,
  CRCParticleSystem,
  CRCParticleSystemEvent,
  CRCParticleSystemOptions,
  CRCParticleSystemStatus,
  CRCParticleValueFor,
  CRCParticleValuesOf,
  CRCParticleVector2,
  Particles2DProps,
  Particles2DStyle,
} from "@crc/particles";
import { particleParameter } from "@crc/particles";
import { expectTypeOf, it } from "vitest";

const parameterDefinitions = {
  wind: { type: "vector2", default: [0, 0], timing: "simulation" },
  tint: { type: "color", default: "#ffffff", timing: "render" },
} as const satisfies CRCParticleParameterDefinitions;

type Parameters = CRCParticleValuesOf<typeof parameterDefinitions>;
type WindValue = CRCParticleValueFor<(typeof parameterDefinitions)["wind"]>;

const parameters: Parameters = { wind: [0, 0], tint: "#ffffff" };
const wind: WindValue = [1, 2];
void parameters;
void wind;

// @ts-expect-error vector2 parameters reject vector3 values
const wrongWind: Parameters = { wind: [0, 0, 0], tint: "#ffffff" };
void wrongWind;

const effectDefinition = {
  parameters: parameterDefinitions,
  emitters: [{ name: "impact" }, { name: "smoke" }],
} as const;

type InferredEffect = CRCParticleEffect2D<
  (typeof effectDefinition)["emitters"][number]["name"],
  CRCParticleValuesOf<(typeof effectDefinition)["parameters"]>
>;
type InferredSystem =
  InferredEffect extends CRCParticleEffect2D<
    infer EmitterName,
    infer EffectParameters
  >
    ? CRCParticleSystem<EmitterName, EffectParameters>
    : never;

declare const effect2D: InferredEffect;
declare const system2D: InferredSystem;

function assertParticlePublicTypes(): void {
  const vector2Reference: CRCParticleVector2 = particleParameter("wind");
  const parameterizedInitial2D: CRCParticleInitial2D = {
    lifetimeMilliseconds: 1_000,
    velocity: particleParameter("wind"),
    color: particleParameter("tint"),
  };
  const parameterizedMotion2D: CRCParticleMotion2D = {
    type: "acceleration",
    value: particleParameter("wind"),
  };
  void vector2Reference;
  void parameterizedInitial2D;
  void parameterizedMotion2D;

  system2D.emit("impact");
  // @ts-expect-error emitter names stay narrowed from the inferred effect
  system2D.emit("unknown");
  // @ts-expect-error dimension-2 systems reject three-dimensional bursts
  system2D.emit("impact", { position: [0, 0, 0] });

  const implicit2D: Particles2DProps<"impact" | "smoke", Parameters> = {
    effect: effect2D,
    parameters,
    autoplay: true,
  };
  void implicit2D;

  // @ts-expect-error effect and system modes are mutually exclusive
  const conflicting2D: Particles2DProps<"impact" | "smoke", Parameters> = {
    effect: effect2D,
    system: system2D,
  };
  void conflicting2D;

}
void assertParticlePublicTypes;

it("runs as an inert compile fixture", () => {
  expectTypeOf<InferredSystem>().toMatchTypeOf<
    CRCParticleSystem<"impact" | "smoke", Parameters>
  >();
});

type RootPublicTypes =
  | CRCParticleAppearance
  | CRCParticleBounds2D
  | CRCParticleBurstAcceptedEvent
  | CRCParticleBurstOverrides
  | CRCParticleBurstRejectedEvent
  | CRCParticleChoice<unknown>
  | CRCParticleCommonProps<CRCParticleParameterValues>
  | CRCParticleCurve<CRCParticleCurveValue>
  | CRCParticleCurveOptions
  | CRCParticleCurveValue
  | CRCParticleDiagnostic
  | CRCParticleDrainStartEvent
  | CRCParticleEffect2D
  | CRCParticleEffect2DInput
  | CRCParticleEmission
  | CRCParticleEmitter2D
  | CRCParticleExecution
  | CRCParticleFinishEvent
  | CRCParticleGradient
  | CRCParticleInitial2D
  | CRCParticleIntegerRange
  | CRCParticleMotion2D
  | CRCParticleOverflow
  | CRCParticleParameterDefinition
  | CRCParticleParameterDefinitions
  | CRCParticleParameterReference<string>
  | CRCParticleParameterTiming
  | CRCParticleParameterValue
  | CRCParticleParameterValues
  | CRCParticleRange
  | CRCParticleRenderer2D
  | CRCParticleScalar
  | CRCParticleShape2D
  | CRCParticleStartEvent
  | CRCParticleSystem
  | CRCParticleSystemEvent
  | CRCParticleSystemOptions
  | CRCParticleSystemStatus
  | CRCParticleVector2
  | Particles2DStyle;

declare const rootPublicTypes: RootPublicTypes;

function assertPublicTypeUnions(): void {
  void rootPublicTypes;
}
void assertPublicTypeUnions;
