import type {
  PibblParticleAppearance,
  PibblParticleBounds2D,
  PibblParticleBurstAcceptedEvent,
  PibblParticleBurstOverrides,
  PibblParticleBurstRejectedEvent,
  PibblParticleChoice,
  PibblParticleCommonProps,
  PibblParticleCurve,
  PibblParticleCurveOptions,
  PibblParticleCurveValue,
  PibblParticleDiagnostic,
  PibblParticleDrainStartEvent,
  PibblParticleEffect2D,
  PibblParticleEffect2DInput,
  PibblParticleEmission,
  PibblParticleEmitter2D,
  PibblParticleExecution,
  PibblParticleFinishEvent,
  PibblParticleGradient,
  PibblParticleInitial2D,
  PibblParticleIntegerRange,
  PibblParticleMotion2D,
  PibblParticleOverflow,
  PibblParticleParameterDefinition,
  PibblParticleParameterDefinitions,
  PibblParticleParameterReference,
  PibblParticleParameterTiming,
  PibblParticleParameterValue,
  PibblParticleParameterValues,
  PibblParticleRange,
  PibblParticleRenderer2D,
  PibblParticleScalar,
  PibblParticleShape2D,
  PibblParticleStartEvent,
  PibblParticleSystem,
  PibblParticleSystemEvent,
  PibblParticleSystemOptions,
  PibblParticleSystemStatus,
  PibblParticleValueFor,
  PibblParticleValuesOf,
  PibblParticleVector2,
  Particles2DProps,
  Particles2DStyle,
} from "@pibbl/core/particles";
import { particleParameter } from "@pibbl/core/particles";
import { expectTypeOf, it } from "vitest";

const parameterDefinitions = {
  wind: { type: "vector2", default: [0, 0], timing: "simulation" },
  tint: { type: "color", default: "#ffffff", timing: "render" },
} as const satisfies PibblParticleParameterDefinitions;

type Parameters = PibblParticleValuesOf<typeof parameterDefinitions>;
type WindValue = PibblParticleValueFor<(typeof parameterDefinitions)["wind"]>;

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

type InferredEffect = PibblParticleEffect2D<
  (typeof effectDefinition)["emitters"][number]["name"],
  PibblParticleValuesOf<(typeof effectDefinition)["parameters"]>
>;
type InferredSystem =
  InferredEffect extends PibblParticleEffect2D<
    infer EmitterName,
    infer EffectParameters
  >
    ? PibblParticleSystem<EmitterName, EffectParameters>
    : never;

declare const effect2D: InferredEffect;
declare const system2D: InferredSystem;

function assertParticlePublicTypes(): void {
  const vector2Reference: PibblParticleVector2 = particleParameter("wind");
  const parameterizedInitial2D: PibblParticleInitial2D = {
    lifetimeMilliseconds: 1_000,
    velocity: particleParameter("wind"),
    color: particleParameter("tint"),
  };
  const parameterizedMotion2D: PibblParticleMotion2D = {
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
    PibblParticleSystem<"impact" | "smoke", Parameters>
  >();
});

type RootPublicTypes =
  | PibblParticleAppearance
  | PibblParticleBounds2D
  | PibblParticleBurstAcceptedEvent
  | PibblParticleBurstOverrides
  | PibblParticleBurstRejectedEvent
  | PibblParticleChoice<unknown>
  | PibblParticleCommonProps<PibblParticleParameterValues>
  | PibblParticleCurve<PibblParticleCurveValue>
  | PibblParticleCurveOptions
  | PibblParticleCurveValue
  | PibblParticleDiagnostic
  | PibblParticleDrainStartEvent
  | PibblParticleEffect2D
  | PibblParticleEffect2DInput
  | PibblParticleEmission
  | PibblParticleEmitter2D
  | PibblParticleExecution
  | PibblParticleFinishEvent
  | PibblParticleGradient
  | PibblParticleInitial2D
  | PibblParticleIntegerRange
  | PibblParticleMotion2D
  | PibblParticleOverflow
  | PibblParticleParameterDefinition
  | PibblParticleParameterDefinitions
  | PibblParticleParameterReference<string>
  | PibblParticleParameterTiming
  | PibblParticleParameterValue
  | PibblParticleParameterValues
  | PibblParticleRange
  | PibblParticleRenderer2D
  | PibblParticleScalar
  | PibblParticleShape2D
  | PibblParticleStartEvent
  | PibblParticleSystem
  | PibblParticleSystemEvent
  | PibblParticleSystemOptions
  | PibblParticleSystemStatus
  | PibblParticleVector2
  | Particles2DStyle;

declare const rootPublicTypes: RootPublicTypes;

function assertPublicTypeUnions(): void {
  void rootPublicTypes;
}
void assertPublicTypeUnions;
