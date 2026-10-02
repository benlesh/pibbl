import type {
  BoxStyle,
  PathGeometry,
  CRCEventHandlers,
  CRCEventParticipationOptions,
  CursorStyle,
  LayoutBox,
  LayoutItemStyle,
  Signal,
  SignalValue,
  SystemStyle,
} from "@crc/core";

export type CRCParticleParameterTiming = "spawn" | "simulation" | "render";

export type CRCParticleParameterDefinition =
  | Readonly<{
      type: "number";
      default: number;
      timing: CRCParticleParameterTiming;
    }>
  | Readonly<{
      type: "vector2";
      default: readonly [number, number];
      timing: CRCParticleParameterTiming;
    }>
  | Readonly<{
      type: "color";
      default: string;
      timing: CRCParticleParameterTiming;
    }>;

export type CRCParticleParameterDefinitions = Readonly<
  Record<string, CRCParticleParameterDefinition>
>;

export type CRCParticleValueFor<
  Definition extends CRCParticleParameterDefinition,
> = Definition["type"] extends "number"
  ? number
  : Definition["type"] extends "vector2"
    ? readonly [number, number]
    : Definition["type"] extends "color"
      ? string
      : never;

export type CRCParticleValuesOf<
  Definitions extends CRCParticleParameterDefinitions | undefined,
> = Definitions extends CRCParticleParameterDefinitions
  ? Readonly<{
      [Name in keyof Definitions]: CRCParticleValueFor<Definitions[Name]>;
    }>
  : Readonly<Record<never, never>>;

export type CRCParticleParameterValue =
  | number
  | string
  | readonly [number, number];

export type CRCParticleParameterValues = Readonly<
  Record<string, CRCParticleParameterValue>
>;

export interface CRCParticleRange {
  readonly type: "between";
  readonly min: number;
  readonly max: number;
}

export interface CRCParticleIntegerRange {
  readonly type: "integer";
  readonly min: number;
  readonly max: number;
}

export interface CRCParticleChoice<T> {
  readonly type: "choice";
  readonly choices: readonly Readonly<{ value: T; weight: number }>[];
}

export interface CRCParticleParameterReference<Name extends string> {
  readonly type: "parameter";
  readonly name: Name;
}

export type CRCParticleScalar =
  | number
  | CRCParticleRange
  | CRCParticleIntegerRange
  | CRCParticleChoice<number>
  | CRCParticleParameterReference<string>;

export type CRCParticleVector2 =
  | readonly [CRCParticleScalar, CRCParticleScalar]
  | CRCParticleParameterReference<string>;

export type CRCParticleCurveValue = number | readonly [number, number];

export interface CRCParticleCurveOptions {
  readonly easing?: import("@crc/core").CRCEasing;
}

export interface CRCParticleCurve<T extends CRCParticleCurveValue> {
  readonly type: "curve";
  readonly keys: readonly (readonly [time: number, value: T])[];
  readonly options?: CRCParticleCurveOptions;
}

export interface CRCParticleGradient {
  readonly type: "gradient";
  readonly keys: readonly (readonly [time: number, color: string])[];
  readonly options?: CRCParticleCurveOptions;
}

export type CRCParticleEmission =
  | Readonly<{
      type: "rate";
      particlesPerSecond: number;
      startMilliseconds?: number;
      durationMilliseconds?: number;
      probability?: number;
      repeat?: Readonly<{ everyMilliseconds: number; count: number }>;
    }>
  | Readonly<{
      type: "burst";
      atMilliseconds: number;
      count: number | CRCParticleIntegerRange;
      probability?: number;
      repeat?: Readonly<{ everyMilliseconds: number; count: number }>;
    }>
  | Readonly<{ type: "manual"; count?: number | CRCParticleIntegerRange }>;

export type CRCParticleShape2D =
  | Readonly<{ type: "point"; position?: readonly [number, number] }>
  | Readonly<{
      type: "line";
      from: readonly [number, number];
      to: readonly [number, number];
    }>
  | Readonly<{
      type: "rectangle";
      width: number;
      height: number;
      sample: "interior" | "edge";
    }>
  | Readonly<{
      type: "circle";
      radius: number;
      sample: "interior" | "circumference";
    }>
  | Readonly<{ type: "ring"; innerRadius: number; outerRadius: number }>;

export interface CRCParticleInitial2D {
  readonly lifetimeMilliseconds: CRCParticleScalar;
  readonly velocity?: CRCParticleVector2;
  readonly size?: CRCParticleScalar | CRCParticleVector2;
  readonly rotationDegrees?: CRCParticleScalar;
  readonly angularVelocityDegreesPerSecond?: CRCParticleScalar;
  readonly color?:
    string | CRCParticleChoice<string> | CRCParticleParameterReference<string>;
  readonly opacity?: CRCParticleScalar;
}

export type CRCParticleMotion2D =
  | Readonly<{ type: "acceleration" | "gravity"; value: CRCParticleVector2 }>
  | Readonly<{ type: "drag"; amount: CRCParticleScalar }>
  | Readonly<{ type: "drift"; velocity: CRCParticleVector2 }>
  | Readonly<{
      type: "radialAcceleration";
      center: readonly [number, number];
      amount: CRCParticleScalar;
    }>
  | Readonly<{
      type: "orbit";
      center: readonly [number, number];
      degreesPerSecond: CRCParticleScalar;
    }>
  | Readonly<{
      type: "sway";
      amplitude: CRCParticleScalar;
      frequency: CRCParticleScalar | readonly [number, number];
    }>
  | Readonly<{ type: "angularVelocity"; degreesPerSecond: CRCParticleScalar }>;

export interface CRCParticleAppearance {
  readonly size?: CRCParticleCurve<number | readonly [number, number]>;
  readonly rotationDegrees?: CRCParticleCurve<number>;
  readonly color?: CRCParticleGradient;
  readonly opacity?: CRCParticleCurve<number>;
}

export type CRCParticleRenderer2D =
  | Readonly<{ type: "circle"; blend?: "source-over" | "additive" }>
  | Readonly<{
      type: "rectangle";
      aspectRatio?: number;
      blend?: "source-over" | "additive";
    }>
  | Readonly<{
      type: "path";
      path: Path2D | PathGeometry;
      blend?: "source-over" | "additive";
    }>
  | Readonly<{
      type: "sprite";
      source: CanvasImageSource;
      anchor?: readonly [number, number];
      blend?: "source-over" | "additive";
    }>;

export interface CRCParticleBounds2D {
  readonly min: readonly [number, number];
  readonly max: readonly [number, number];
}

export type CRCParticleOverflow = "reject-newest" | "recycle-oldest";

export interface CRCParticleEmitter2D {
  readonly name: string;
  readonly capacity: number;
  readonly overflow?: CRCParticleOverflow;
  readonly space?: "local";
  readonly emission: readonly CRCParticleEmission[];
  readonly shape: CRCParticleShape2D;
  readonly initial: CRCParticleInitial2D;
  readonly motion?: readonly CRCParticleMotion2D[];
  readonly appearance?: CRCParticleAppearance;
  readonly renderer: CRCParticleRenderer2D;
  readonly bounds?: CRCParticleBounds2D;
}

export interface CRCParticleEffect2DInput {
  readonly debugName?: string;
  readonly parameters?: CRCParticleParameterDefinitions;
  readonly emitters: readonly [CRCParticleEmitter2D, ...CRCParticleEmitter2D[]];
}

declare const particleEffectBrand: unique symbol;

export interface CRCParticleEffect2D<
  EmitterName extends string = string,
  Parameters extends CRCParticleParameterValues = CRCParticleParameterValues,
> {
  readonly dimension: 2;
  readonly [particleEffectBrand]: {
    readonly emitterName: EmitterName;
    readonly parameters: Parameters;
  };
}

export type CRCParticleSystemStatus =
  | "idle"
  | "scheduled"
  | "running"
  | "paused"
  | "draining"
  | "finished"
  | "disposed";

export type CRCParticleExecution =
  | "unbound"
  | "stateless-canvas";

export interface CRCParticleStartEvent {
  readonly type: "start";
}

export interface CRCParticleBurstAcceptedEvent {
  readonly type: "burst-accepted";
  readonly emitter: string;
  readonly requested: number;
  readonly accepted: number;
}

export interface CRCParticleBurstRejectedEvent {
  readonly type: "burst-rejected";
  readonly emitter: string;
  readonly requested: number;
  readonly accepted: number;
  readonly reason: "capacity" | "paused" | "stopped" | "disposed";
}

export interface CRCParticleDrainStartEvent {
  readonly type: "drain-start";
}

export interface CRCParticleFinishEvent {
  readonly type: "finish";
}

export type CRCParticleSystemEvent =
  | CRCParticleStartEvent
  | CRCParticleBurstAcceptedEvent
  | CRCParticleBurstRejectedEvent
  | CRCParticleDrainStartEvent
  | CRCParticleFinishEvent;

export type CRCParticleDiagnostic =
  | Readonly<{
      type: "definition-invalid";
      message: string;
      effect?: string;
      emitter?: string;
      property?: string;
    }>
  | Readonly<{
      type: "capability-unsupported";
      message: string;
      capability: string;
      effect?: string;
      emitter?: string;
    }>
  | Readonly<{
      type: "asset-invalid" | "binding-conflict" | "backend-mismatch";
      message: string;
      effect?: string;
      emitter?: string;
    }>
  | Readonly<{
      type: "capacity-rejected" | "execution-failed" | "disposed";
      message: string;
      effect?: string;
      emitter?: string;
    }>;

export interface CRCParticleSystemOptions {
  readonly autoplay?: boolean;
  readonly seed?: number;
  readonly debugName?: string;
  readonly onEvent?: (event: CRCParticleSystemEvent) => void;
  readonly onError?: (error: unknown) => void;
}

export interface CRCParticleBurstOverrides {
  readonly count?: number;
  readonly position?: readonly [number, number];
  readonly seedSalt?: number;
  readonly parameters?: Readonly<
    Record<string, number | readonly number[] | string>
  >;
}

declare const particleSystemBrand: unique symbol;

export interface CRCParticleSystem<
  EmitterName extends string = string,
  Parameters extends CRCParticleParameterValues = CRCParticleParameterValues,
> {
  readonly [particleSystemBrand]: {
    readonly parameters: Parameters;
    readonly dimension: 2;
  };
  readonly status: Signal<CRCParticleSystemStatus>;
  readonly execution: Signal<CRCParticleExecution>;
  play(): void;
  pause(): void;
  resume(): void;
  restart(options?: Readonly<{ seed?: number }>): void;
  emit(
    emitter: EmitterName,
    options?: CRCParticleBurstOverrides,
  ): void;
  stop(options?: Readonly<{ mode?: "drain" | "clear" }>): void;
}

export interface CRCParticleCommonProps<
  Parameters extends CRCParticleParameterValues,
>
  extends CRCEventHandlers, CRCEventParticipationOptions {
  readonly parameters?: Readonly<Partial<Parameters>>;
  readonly keyboardFocusable?: boolean;
  readonly keyboardNavigationBounds?: Readonly<LayoutBox>;
  readonly onEvent?: (event: CRCParticleSystemEvent) => void;
  readonly onError?: (error: unknown) => void;
}

export type CRCParticleCommonInputProps<
  Parameters extends CRCParticleParameterValues,
> = {
  readonly [K in keyof CRCParticleCommonProps<Parameters>]:
    SignalValue<CRCParticleCommonProps<Parameters>[K]>;
};

type CRCParticleStyleInput<S extends object> = SignalValue<{
  readonly [K in keyof S]: SignalValue<S[K]>;
}>;

export interface Particles2DStyle
  extends SystemStyle, BoxStyle, LayoutItemStyle, CursorStyle {
  readonly opacity?: number;
}

export type Particles2DProps<
  EmitterName extends string = string,
  Parameters extends CRCParticleParameterValues = CRCParticleParameterValues,
> = CRCParticleCommonInputProps<Parameters> & {
  readonly style?: CRCParticleStyleInput<Particles2DStyle>;
} & (
    | {
        readonly effect: SignalValue<
          CRCParticleEffect2D<EmitterName, Parameters>
        >;
        readonly system?: never;
        readonly autoplay?: SignalValue<boolean>;
        readonly seed?: SignalValue<number>;
      }
    | {
        readonly effect?: never;
        readonly system: CRCParticleSystem<EmitterName, Parameters>;
        readonly autoplay?: never;
        readonly seed?: never;
      }
  );
