import type { CRCWebGLTransformStyle } from "@crc/webgl";
import type {
  CRCParticleAppearance,
  CRCParticleEmission,
  CRCParticleOverflow,
  CRCParticleParameterDefinitions,
  CRCParticleParameterReference,
  CRCParticleParameterValues,
  CRCParticleScalar,
  CRCParticleSystem,
  CRCParticleVector2,
  CRCParticleVector3,
} from "./types.js";

export type { CRCParticleVector3 } from "./types.js";

export type CRCParticleShape3D =
  | Readonly<{ type: "point"; position?: readonly [number, number, number] }>
  | Readonly<{
      type: "line";
      from: readonly [number, number, number];
      to: readonly [number, number, number];
    }>
  | Readonly<{
      type: "box";
      size: readonly [number, number, number];
      sample: "volume" | "surface";
    }>
  | Readonly<{
      type: "sphere";
      radius: number;
      thickness?: number;
      sample: "volume" | "surface";
    }>
  | Readonly<{ type: "ring"; innerRadius: number; outerRadius: number }>
  | Readonly<{
      type: "cone";
      direction: readonly [number, number, number];
      spreadDegrees: number;
      length: number;
      sample: "volume" | "surface";
    }>;

export interface CRCParticleConeVelocity3D {
  readonly type: "cone";
  readonly direction: CRCParticleVector3;
  readonly speed: CRCParticleScalar;
  readonly spreadDegrees: CRCParticleScalar;
}

export interface CRCParticleInitial3D {
  readonly lifetimeMilliseconds: CRCParticleScalar;
  readonly velocity?: CRCParticleVector3 | CRCParticleConeVelocity3D;
  readonly size?: CRCParticleScalar | CRCParticleVector2;
  readonly rotationDegrees?: CRCParticleScalar;
  readonly angularVelocityDegreesPerSecond?: CRCParticleScalar;
  readonly color?:
    | string
    | import("./types.js").CRCParticleChoice<string>
    | CRCParticleParameterReference<string>;
  readonly opacity?: CRCParticleScalar;
}

export type CRCParticleMotion3D =
  | Readonly<{ type: "acceleration" | "gravity"; value: CRCParticleVector3 }>
  | Readonly<{ type: "drag"; amount: CRCParticleScalar }>
  | Readonly<{ type: "drift"; velocity: CRCParticleVector3 }>
  | Readonly<{
      type: "radialAcceleration";
      center: readonly [number, number, number];
      amount: CRCParticleScalar;
    }>
  | Readonly<{
      type: "orbit";
      center: readonly [number, number, number];
      axis: CRCParticleVector3;
      degreesPerSecond: CRCParticleScalar;
    }>
  | Readonly<{
      type: "sway";
      direction: CRCParticleVector3;
      amplitude: CRCParticleScalar;
      frequency: CRCParticleScalar | readonly [number, number];
    }>
  | Readonly<{ type: "angularVelocity"; degreesPerSecond: CRCParticleVector3 }>;

export type CRCParticleRenderer3D =
  | Readonly<{
      type: "point";
      material: "unlit" | "emissive";
      blend: "alpha" | "additive" | "cutout";
      depthTest?: boolean;
      depthWrite?: boolean;
      sorting?: "none" | "oldest-first" | "youngest-first" | "distance";
    }>
  | Readonly<{
      type: "billboard";
      source?: CanvasImageSource;
      material: "unlit" | "emissive";
      blend: "alpha" | "additive" | "cutout";
      depthTest?: boolean;
      depthWrite?: boolean;
      sorting?: "none" | "oldest-first" | "youngest-first" | "distance";
    }>;

export interface CRCParticleBounds3D {
  readonly min: readonly [number, number, number];
  readonly max: readonly [number, number, number];
}

export interface CRCParticleEmitter3D {
  readonly name: string;
  readonly capacity: number;
  readonly overflow?: CRCParticleOverflow;
  readonly space?: "local";
  readonly emission: readonly CRCParticleEmission[];
  readonly shape: CRCParticleShape3D;
  readonly initial: CRCParticleInitial3D;
  readonly motion?: readonly CRCParticleMotion3D[];
  readonly appearance?: CRCParticleAppearance;
  readonly renderer: CRCParticleRenderer3D;
  readonly bounds?: CRCParticleBounds3D;
}

export interface CRCParticleEffect3DInput {
  readonly debugName?: string;
  readonly parameters?: CRCParticleParameterDefinitions;
  readonly emitters: readonly [CRCParticleEmitter3D, ...CRCParticleEmitter3D[]];
}

declare const particleEffect3DBrand: unique symbol;

export interface CRCParticleEffect3D<
  EmitterName extends string = string,
  Parameters extends CRCParticleParameterValues = CRCParticleParameterValues,
> {
  readonly dimension: 3;
  readonly [particleEffect3DBrand]: {
    readonly emitterName: EmitterName;
    readonly parameters: Parameters;
  };
}

export type CRCParticleExecutionCapability =
  | Readonly<{ type: "stateless-canvas"; supported: true }>
  | Readonly<{ type: "stateless-webgl"; supported: true }>
  | Readonly<{
      type: "stateful-canvas" | "stateful-cpu-webgl" | "stateful-gpu-webgl";
      supported: false;
      reasons: readonly string[];
    }>;

export interface Particles3DStyle extends CRCWebGLTransformStyle {
  readonly opacity?: number;
  readonly cursor?: string;
  readonly filter?: never;
}

export type Particles3DProps<
  EmitterName extends string = string,
  Parameters extends CRCParticleParameterValues = CRCParticleParameterValues,
> = import("./types.js").CRCParticleCommonProps<Parameters> & {
  readonly style?: Particles3DStyle;
  readonly execution?: "auto" | "cpu" | "gpu";
  readonly interactionBounds?: CRCParticleBounds3D;
} & (
    | {
        readonly effect: CRCParticleEffect3D<EmitterName, Parameters>;
        readonly system?: never;
        readonly autoplay?: boolean;
        readonly seed?: number;
      }
    | {
        readonly effect?: never;
        readonly system: CRCParticleSystem<EmitterName, Parameters, 3>;
        readonly autoplay?: never;
        readonly seed?: never;
      }
  );
