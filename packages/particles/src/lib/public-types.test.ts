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
  CRCParticleVector3,
  Particles2DProps,
  Particles2DStyle,
} from "@crc/particles";
import type {
  CRCParticleBounds3D,
  CRCParticleConeVelocity3D,
  CRCParticleEffect3D,
  CRCParticleEffect3DInput,
  CRCParticleEmitter3D,
  CRCParticleExecutionCapability,
  CRCParticleInitial3D,
  CRCParticleMotion3D,
  CRCParticleRenderer3D,
  CRCParticleShape3D,
  Particles3DProps,
  Particles3DStyle,
} from "@crc/particles/webgl";
import { particle } from "@crc/particles";
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
    ? CRCParticleSystem<EmitterName, EffectParameters, 2>
    : never;

declare const effect2D: InferredEffect;
declare const system2D: InferredSystem;
declare const system3D: CRCParticleSystem<"impact", Parameters, 3>;

function assertParticlePublicTypes(): void {
  const vector2Reference: CRCParticleVector2 = particle.parameter("wind");
  const vector3Reference: CRCParticleVector3 = particle.parameter("velocity");
  const parameterizedInitial2D: CRCParticleInitial2D = {
    lifetimeMilliseconds: 1_000,
    velocity: particle.parameter("wind"),
    color: particle.parameter("tint"),
  };
  const parameterizedMotion2D: CRCParticleMotion2D = {
    type: "acceleration",
    value: particle.parameter("wind"),
  };
  const parameterizedInitial3D: CRCParticleInitial3D = {
    lifetimeMilliseconds: 1_000,
    velocity: particle.parameter("velocity"),
    color: particle.parameter("tint"),
  };
  const parameterizedMotion3D: CRCParticleMotion3D = {
    type: "angularVelocity",
    degreesPerSecond: particle.parameter("spin"),
  };
  void vector2Reference;
  void vector3Reference;
  void parameterizedInitial2D;
  void parameterizedMotion2D;
  void parameterizedInitial3D;
  void parameterizedMotion3D;

  system2D.emit("impact");
  // @ts-expect-error emitter names stay narrowed from the inferred effect
  system2D.emit("unknown");
  // @ts-expect-error dimension-2 systems reject three-dimensional bursts
  system2D.emit("impact", { position: [0, 0, 0] });
  system3D.emit("impact", { position: [0, 0, 0] });

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

  const particle3DStyle: Particles3DStyle = { opacity: 0.5 };
  void particle3DStyle;
  // @ts-expect-error Canvas filters belong on the receiving WebGLLayer
  const filtered3DStyle: Particles3DStyle = { filter: [] };
  void filtered3DStyle;
}
void assertParticlePublicTypes;

it("runs as an inert compile fixture", () => {
  expectTypeOf<InferredSystem>().toMatchTypeOf<
    CRCParticleSystem<"impact" | "smoke", Parameters, 2>
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
  | CRCParticleVector3
  | Particles2DStyle;

type WebGLPublicTypes =
  | CRCParticleBounds3D
  | CRCParticleConeVelocity3D
  | CRCParticleEffect3D
  | CRCParticleEffect3DInput
  | CRCParticleEmitter3D
  | CRCParticleExecutionCapability
  | CRCParticleInitial3D
  | CRCParticleMotion3D
  | CRCParticleRenderer3D
  | CRCParticleShape3D
  | CRCParticleVector3
  | Particles3DProps
  | Particles3DStyle;

declare const rootPublicTypes: RootPublicTypes;
declare const webglPublicTypes: WebGLPublicTypes;

function assertPublicTypeUnions(): void {
  void rootPublicTypes;
  void webglPublicTypes;
}
void assertPublicTypeUnions;
