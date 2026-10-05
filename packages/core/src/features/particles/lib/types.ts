import type { CRCEasing } from "@crc/core";
import type { particleChoice, particleCurve, particleGradient, particleInteger, particleRange } from './particle.js';
import type { defineParticleEffect2D } from './definition.js';
import type { useParticleSystem } from './system/hook.js';
import type { Particles2D } from './canvas/component.js';
import type { CRCFlowField2D } from "./flow/hook.js";
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

/**
 * Whether a parameter is sampled at spawn, simulation, or rendering time.
 *
 * @see {@link CRCParticleParameterDefinition}
 */
export type CRCParticleParameterTiming = "spawn" | "simulation" | "render";

/**
 * A typed default value and sampling phase for a named particle parameter.
 *
 * @see {@link CRCParticleParameterTiming}
 * @see {@link CRCParticleParameterDefinitions}
 * @see {@link CRCParticleValueFor}
 */
export type CRCParticleParameterDefinition =
  | Readonly<{
      /** The literal "number" identifying this variant. See {@link CRCParticleParameterDefinition}. */
      type: "number";
      /**
       * Value used when no parameter override is supplied. See
       * {@link CRCParticleParameterDefinition}.
       */
      default: number;
      /** Phase at which the parameter value is sampled. See {@link CRCParticleParameterTiming}. */
      timing: CRCParticleParameterTiming;
    }>
  | Readonly<{
      /** The literal "vector2" identifying this variant. See {@link CRCParticleParameterDefinition}. */
      type: "vector2";
      /**
       * Value used when no parameter override is supplied. See
       * {@link CRCParticleParameterDefinition}.
       */
      default: readonly [number, number];
      /** Phase at which the parameter value is sampled. See {@link CRCParticleParameterTiming}. */
      timing: CRCParticleParameterTiming;
    }>
  | Readonly<{
      /** The literal "color" identifying this variant. See {@link CRCParticleParameterDefinition}. */
      type: "color";
      /**
       * Value used when no parameter override is supplied. See
       * {@link CRCParticleParameterDefinition}.
       */
      default: string;
      /** Phase at which the parameter value is sampled. See {@link CRCParticleParameterTiming}. */
      timing: CRCParticleParameterTiming;
    }>;

/**
 * Named parameter declarations belonging to a particle effect.
 *
 * @see {@link CRCParticleParameterDefinition}
 * @see {@link CRCParticleEffect2DInput}
 * @see {@link CRCParticleValuesOf}
 */
export type CRCParticleParameterDefinitions = Readonly<
  Record<string, CRCParticleParameterDefinition>
>;

/**
 * Derives a parameter's value type from its declared particle parameter kind.
 *
 * @see {@link CRCParticleParameterDefinition}
 * @see {@link CRCParticleValuesOf}
 */
export type CRCParticleValueFor<
  Definition extends CRCParticleParameterDefinition,
> = Definition["type"] extends "number"
  ? number
  : Definition["type"] extends "vector2"
    ? readonly [number, number]
    : Definition["type"] extends "color"
      ? string
      : never;

/**
 * Derives the named value record from an effect's parameter definitions.
 *
 * @see {@link CRCParticleParameterDefinitions}
 * @see {@link CRCParticleValueFor}
 * @see {@link defineParticleEffect2D}
 */
export type CRCParticleValuesOf<
  Definitions extends CRCParticleParameterDefinitions | undefined,
> = Definitions extends CRCParticleParameterDefinitions
  ? Readonly<{
      [Name in keyof Definitions]: CRCParticleValueFor<Definitions[Name]>;
    }>
  : Readonly<Record<never, never>>;

/**
 * A numeric, color, or two-component particle parameter value.
 *
 * @see {@link CRCParticleParameterValues}
 */
export type CRCParticleParameterValue =
  | number
  | string
  | readonly [number, number];

/**
 * Values keyed by a particle effect's parameter names.
 *
 * @see {@link CRCParticleParameterValue}
 * @see {@link CRCParticleCommonProps}
 * @see {@link CRCParticleEffect2D}
 */
export type CRCParticleParameterValues = Readonly<
  Record<string, CRCParticleParameterValue>
>;

/**
 * A continuous numeric interval for particle sampling.
 *
 * @see {@link CRCParticleScalar}
 * @see {@link particleRange}
 */
export interface CRCParticleRange {
  /** The literal "between" identifying this variant. See {@link CRCParticleRange}. */
  readonly type: "between";
  /** Lower bound of the coordinate or sampling interval. See {@link CRCParticleRange}. */
  readonly min: number;
  /** Upper bound of the coordinate or sampling interval. See {@link CRCParticleRange}. */
  readonly max: number;
}

/**
 * An integer-valued random sampling interval.
 *
 * @see {@link CRCParticleEmission}
 * @see {@link CRCParticleScalar}
 * @see {@link particleInteger}
 */
export interface CRCParticleIntegerRange {
  /** The literal "integer" identifying this variant. See {@link CRCParticleIntegerRange}. */
  readonly type: "integer";
  /** Lower bound of the coordinate or sampling interval. See {@link CRCParticleIntegerRange}. */
  readonly min: number;
  /** Upper bound of the coordinate or sampling interval. See {@link CRCParticleIntegerRange}. */
  readonly max: number;
}

/**
 * A weighted collection of candidate values for particle sampling.
 *
 * @see {@link CRCParticleInitial2D}
 * @see {@link CRCParticleScalar}
 * @see {@link particleChoice}
 */
export interface CRCParticleChoice<T> {
  /** The literal "choice" identifying this variant. See {@link CRCParticleChoice}. */
  readonly type: "choice";
  /** Weighted candidate values sampled by the effect. See {@link CRCParticleChoice}. */
  readonly choices: readonly Readonly<{
    /** Value associated with this sample, input, or result. See {@link CRCParticleChoice}. */
    value: T;
    /** Relative sampling weight or source intensity. See {@link CRCParticleChoice}. */
    weight: number;
  }>[];
}

/**
 * A symbolic reference resolved against the owning effect's parameter definitions.
 *
 * @see {@link CRCParticleInitial2D}
 * @see {@link CRCParticleScalar}
 * @see {@link CRCParticleVector2}
 */
export interface CRCParticleParameterReference<Name extends string> {
  /**
   * The literal "parameter" identifying this variant. See {@link CRCParticleParameterReference}.
   */
  readonly type: "parameter";
  /**
   * Name identifying this backend, emitter, or parameter. See
   * {@link CRCParticleParameterReference}.
   */
  readonly name: Name;
}

/**
 * A literal, random distribution, weighted choice, or parameter reference yielding a number.
 *
 * @see {@link CRCParticleRange}
 * @see {@link CRCParticleIntegerRange}
 * @see {@link CRCParticleChoice}
 * @see {@link CRCParticleParameterReference}
 * @see {@link CRCParticleInitial2D}
 */
export type CRCParticleScalar =
  | number
  | CRCParticleRange
  | CRCParticleIntegerRange
  | CRCParticleChoice<number>
  | CRCParticleParameterReference<string>;

/**
 * Two independently sampled scalar values or a reference to a vector parameter.
 *
 * @see {@link CRCParticleScalar}
 * @see {@link CRCParticleParameterReference}
 * @see {@link CRCParticleInitial2D}
 * @see {@link CRCParticleMotion2D}
 */
export type CRCParticleVector2 =
  | readonly [CRCParticleScalar, CRCParticleScalar]
  | CRCParticleParameterReference<string>;

/**
 * A scalar or two-component value supported by particle curves.
 *
 * @see {@link CRCParticleCurve}
 * @see {@link particleCurve}
 */
export type CRCParticleCurveValue = number | readonly [number, number];

/**
 * Easing used to interpolate between particle keyframes.
 *
 * @see {@link CRCParticleCurve}
 * @see {@link CRCParticleGradient}
 * @see {@link particleCurve}
 * @see {@link CRCEasing}
 */
export interface CRCParticleCurveOptions {
  /** Maps normalized progress before interpolation. See {@link CRCParticleCurveOptions}. */
  readonly easing?: import("@crc/core").CRCEasing;
}

/**
 * Keyframes describing a numeric or two-component value over particle lifetime.
 *
 * @see {@link CRCParticleCurveValue}
 * @see {@link CRCParticleCurveOptions}
 * @see {@link CRCParticleAppearance}
 * @see {@link particleCurve}
 */
export interface CRCParticleCurve<T extends CRCParticleCurveValue> {
  /** The literal "curve" identifying this variant. See {@link CRCParticleCurve}. */
  readonly type: "curve";
  /** Ordered keyframes at normalized lifetime positions. See {@link CRCParticleCurve}. */
  readonly keys: readonly (readonly [time: number, value: T])[];
  /** Interpolation options applied between keyframes. See {@link CRCParticleCurveOptions}. */
  readonly options?: CRCParticleCurveOptions;
}

/**
 * Color keyframes interpolated across normalized particle lifetime.
 *
 * @see {@link CRCParticleCurveOptions}
 * @see {@link CRCParticleAppearance}
 * @see {@link particleGradient}
 */
export interface CRCParticleGradient {
  /** The literal "gradient" identifying this variant. See {@link CRCParticleGradient}. */
  readonly type: "gradient";
  /** Ordered keyframes at normalized lifetime positions. See {@link CRCParticleGradient}. */
  readonly keys: readonly (readonly [time: number, color: string])[];
  /** Interpolation options applied between keyframes. See {@link CRCParticleCurveOptions}. */
  readonly options?: CRCParticleCurveOptions;
}

/**
 * A timed rate, scheduled burst, or manually triggered particle emission rule.
 *
 * @see {@link CRCParticleIntegerRange}
 * @see {@link CRCParticleEmitter2D}
 */
export type CRCParticleEmission =
  | Readonly<{
      /** The literal "rate" identifying this variant. See {@link CRCParticleEmission}. */
      type: "rate";
      /** Continuous emission rate in particles per second. See {@link CRCParticleEmission}. */
      particlesPerSecond: number;
      /** Delay before the emission rule becomes active. See {@link CRCParticleEmission}. */
      startMilliseconds?: number;
      /** Duration for which the emission rule remains active. See {@link CRCParticleEmission}. */
      durationMilliseconds?: number;
      /**
       * Probability that an eligible emission is accepted by this rule. See
       * {@link CRCParticleEmission}.
       */
      probability?: number;
      /** Whether the browser reported an auto-repeated key press. See {@link CRCParticleEmission}. */
      repeat?: Readonly<{
        /** Interval between repeated emissions. See {@link CRCParticleEmission}. */
        everyMilliseconds: number;
        /**
         * Number of particles or sources requested by this configuration. See
         * {@link CRCParticleEmission}.
         */
        count: number;
      }>;
    }>
  | Readonly<{
      /** The literal "burst" identifying this variant. See {@link CRCParticleEmission}. */
      type: "burst";
      /** Logical time at which a scheduled burst occurs. See {@link CRCParticleEmission}. */
      atMilliseconds: number;
      /**
       * Number of particles or sources requested by this configuration. See
       * {@link CRCParticleIntegerRange}.
       */
      count: number | CRCParticleIntegerRange;
      /**
       * Probability that an eligible emission is accepted by this rule. See
       * {@link CRCParticleEmission}.
       */
      probability?: number;
      /** Whether the browser reported an auto-repeated key press. See {@link CRCParticleEmission}. */
      repeat?: Readonly<{
        /** Interval between repeated emissions. See {@link CRCParticleEmission}. */
        everyMilliseconds: number;
        /**
         * Number of particles or sources requested by this configuration. See
         * {@link CRCParticleEmission}.
         */
        count: number;
      }>;
    }>
  | Readonly<{
      /** The literal "manual" identifying this variant. See {@link CRCParticleEmission}. */
      type: "manual";
      /**
       * Number of particles or sources requested by this configuration. See
       * {@link CRCParticleIntegerRange}.
       */
      count?: number | CRCParticleIntegerRange;
    }>;

/**
 * The point, line, rectangle, circle, or ring used to sample particle birth positions.
 *
 * @see {@link CRCParticleEmitter2D}
 */
export type CRCParticleShape2D =
  | Readonly<{
      /** The literal "point" identifying this variant. See {@link CRCParticleShape2D}. */
      type: "point";
      /**
       * Position of the geometry, source, or selected resize handle. See
       * {@link CRCParticleShape2D}.
       */
      position?: readonly [number, number];
    }>
  | Readonly<{
      /** The literal "line" identifying this variant. See {@link CRCParticleShape2D}. */
      type: "line";
      /** Starting endpoint or value. See {@link CRCParticleShape2D}. */
      from: readonly [number, number];
      /** Destination endpoint or value. See {@link CRCParticleShape2D}. */
      to: readonly [number, number];
    }>
  | Readonly<{
      /** The literal "rectangle" identifying this variant. See {@link CRCParticleShape2D}. */
      type: "rectangle";
      /**
       * Horizontal extent in the units of the containing geometry or surface. See
       * {@link CRCParticleShape2D}.
       */
      width: number;
      /**
       * Vertical extent in the units of the containing geometry or surface. See
       * {@link CRCParticleShape2D}.
       */
      height: number;
      /** Selects `"interior"`, `"edge"` for sample. See {@link CRCParticleShape2D}. */
      sample: "interior" | "edge";
    }>
  | Readonly<{
      /** The literal "circle" identifying this variant. See {@link CRCParticleShape2D}. */
      type: "circle";
      /** Radius in the coordinate system of this geometry or effect. See {@link CRCParticleShape2D}. */
      radius: number;
      /** Selects `"interior"`, `"circumference"` for sample. See {@link CRCParticleShape2D}. */
      sample: "interior" | "circumference";
    }>
  | Readonly<{
      /** The literal "ring" identifying this variant. See {@link CRCParticleShape2D}. */
      type: "ring";
      /** Radius of the inner boundary. See {@link CRCParticleShape2D}. */
      innerRadius: number;
      /** Radius of the outer boundary. See {@link CRCParticleShape2D}. */
      outerRadius: number;
    }>;

/**
 * Particle birth values for lifetime, velocity, size, rotation, color, and opacity.
 *
 * @see {@link CRCParticleScalar}
 * @see {@link CRCParticleVector2}
 * @see {@link CRCParticleChoice}
 * @see {@link CRCParticleParameterReference}
 * @see {@link CRCParticleEmitter2D}
 */
export interface CRCParticleInitial2D {
  /** Particle lifetime sampled at birth, in milliseconds. See {@link CRCParticleScalar}. */
  readonly lifetimeMilliseconds: CRCParticleScalar;
  /** Linear velocity used by the particle motion rule. See {@link CRCParticleVector2}. */
  readonly velocity?: CRCParticleVector2;
  /**
   * Scalar or two-component size sampled at particle birth. See {@link CRCParticleScalar},
   * {@link CRCParticleVector2}.
   */
  readonly size?: CRCParticleScalar | CRCParticleVector2;
  /** Rotation in degrees sampled at particle birth. See {@link CRCParticleScalar}. */
  readonly rotationDegrees?: CRCParticleScalar;
  /** Angular velocity in degrees per second. See {@link CRCParticleScalar}. */
  readonly angularVelocityDegreesPerSecond?: CRCParticleScalar;
  /**
   * Color sampled at particle birth. See {@link CRCParticleChoice},
   * {@link CRCParticleParameterReference}.
   */
  readonly color?:
    string | CRCParticleChoice<string> | CRCParticleParameterReference<string>;
  /** Opacity sampled at particle birth. See {@link CRCParticleScalar}. */
  readonly opacity?: CRCParticleScalar;
}

/**
 * An analytic 2D motion rule such as gravity, drag, drift, orbit, or sway.
 *
 * @see {@link CRCParticleVector2}
 * @see {@link CRCParticleScalar}
 * @see {@link CRCParticleEmitter2D}
 */
export type CRCParticleMotion2D =
  | Readonly<{
      /** Selects `"acceleration"`, `"gravity"` for type. See {@link CRCParticleMotion2D}. */
      type: "acceleration" | "gravity";
      /** Value associated with this sample, input, or result. See {@link CRCParticleVector2}. */
      value: CRCParticleVector2;
    }>
  | Readonly<{
      /** The literal "drag" identifying this variant. See {@link CRCParticleMotion2D}. */
      type: "drag";
      /** Magnitude of the filter or motion adjustment. See {@link CRCParticleScalar}. */
      amount: CRCParticleScalar;
    }>
  | Readonly<{
      /** The literal "drift" identifying this variant. See {@link CRCParticleMotion2D}. */
      type: "drift";
      /** Linear velocity used by the particle motion rule. See {@link CRCParticleVector2}. */
      velocity: CRCParticleVector2;
    }>
  | Readonly<{
      /** The literal "radialAcceleration" identifying this variant. See {@link CRCParticleMotion2D}. */
      type: "radialAcceleration";
      /** Center of radial acceleration or orbital motion. See {@link CRCParticleMotion2D}. */
      center: readonly [number, number];
      /** Magnitude of the filter or motion adjustment. See {@link CRCParticleScalar}. */
      amount: CRCParticleScalar;
    }>
  | Readonly<{
      /** The literal "orbit" identifying this variant. See {@link CRCParticleMotion2D}. */
      type: "orbit";
      /** Center of radial acceleration or orbital motion. See {@link CRCParticleMotion2D}. */
      center: readonly [number, number];
      /** Angular motion rate in degrees per second. See {@link CRCParticleScalar}. */
      degreesPerSecond: CRCParticleScalar;
    }>
  | Readonly<{
      /** The literal "sway" identifying this variant. See {@link CRCParticleMotion2D}. */
      type: "sway";
      /** Maximum excursion of the oscillating motion. See {@link CRCParticleScalar}. */
      amplitude: CRCParticleScalar;
      /** Rate at which the pattern or motion repeats. See {@link CRCParticleScalar}. */
      frequency: CRCParticleScalar | readonly [number, number];
    }>
  | Readonly<{
      /** The literal "angularVelocity" identifying this variant. See {@link CRCParticleMotion2D}. */
      type: "angularVelocity";
      /** Angular motion rate in degrees per second. See {@link CRCParticleScalar}. */
      degreesPerSecond: CRCParticleScalar;
    }>;

/**
 * Size, rotation, color, and opacity changes over a particle's lifetime.
 *
 * @see {@link CRCParticleCurve}
 * @see {@link CRCParticleGradient}
 * @see {@link CRCParticleEmitter2D}
 */
export interface CRCParticleAppearance {
  /**
   * Scalar or two-component size curve evaluated over normalized particle lifetime. See
   * {@link CRCParticleCurve}.
   */
  readonly size?: CRCParticleCurve<number | readonly [number, number]>;
  /**
   * Rotation curve in degrees evaluated over normalized particle lifetime. See
   * {@link CRCParticleCurve}.
   */
  readonly rotationDegrees?: CRCParticleCurve<number>;
  /**
   * Color gradient evaluated over normalized particle lifetime. See {@link CRCParticleGradient}.
   */
  readonly color?: CRCParticleGradient;
  /** Opacity curve evaluated over normalized particle lifetime. See {@link CRCParticleCurve}. */
  readonly opacity?: CRCParticleCurve<number>;
}

/**
 * Canvas rendering configuration for circles, rectangles, paths, or sprites.
 *
 * @see {@link PathGeometry}
 * @see {@link CRCParticleEmitter2D}
 */
export type CRCParticleRenderer2D =
  | Readonly<{
      /** The literal "circle" identifying this variant. See {@link CRCParticleRenderer2D}. */
      type: "circle";
      /** Selects `"source-over"`, `"additive"` for blend. See {@link CRCParticleRenderer2D}. */
      blend?: "source-over" | "additive";
    }>
  | Readonly<{
      /** The literal "rectangle" identifying this variant. See {@link CRCParticleRenderer2D}. */
      type: "rectangle";
      /** Width-to-height ratio of the particle rectangle. See {@link CRCParticleRenderer2D}. */
      aspectRatio?: number;
      /** Selects `"source-over"`, `"additive"` for blend. See {@link CRCParticleRenderer2D}. */
      blend?: "source-over" | "additive";
    }>
  | Readonly<{
      /** The literal "path" identifying this variant. See {@link CRCParticleRenderer2D}. */
      type: "path";
      /** Path geometry used by this operation. See {@link PathGeometry}. */
      path: Path2D | PathGeometry;
      /** Selects `"source-over"`, `"additive"` for blend. See {@link CRCParticleRenderer2D}. */
      blend?: "source-over" | "additive";
    }>
  | Readonly<{
      /** The literal "sprite" identifying this variant. See {@link CRCParticleRenderer2D}. */
      type: "sprite";
      /** Image used to paint each sprite particle. See {@link CRCParticleRenderer2D}. */
      source: CanvasImageSource;
      /**
       * Logical point to which the content or result is anchored. See
       * {@link CRCParticleRenderer2D}.
       */
      anchor?: readonly [number, number];
      /** Selects `"source-over"`, `"additive"` for blend. See {@link CRCParticleRenderer2D}. */
      blend?: "source-over" | "additive";
    }>;

/**
 * Conservative minimum and maximum particle extents used for emitter culling.
 *
 * @see {@link CRCParticleEmitter2D}
 */
export interface CRCParticleBounds2D {
  /** Lower bound of the coordinate or sampling interval. See {@link CRCParticleBounds2D}. */
  readonly min: readonly [number, number];
  /** Upper bound of the coordinate or sampling interval. See {@link CRCParticleBounds2D}. */
  readonly max: readonly [number, number];
}

/**
 * Whether a full emitter rejects new particles or recycles its oldest particles.
 *
 * @see {@link CRCParticleEmitter2D}
 */
export type CRCParticleOverflow = "reject-newest" | "recycle-oldest";

/**
 * Capacity, emission, spawn geometry, motion, appearance, and rendering of one named emitter.
 *
 * @see {@link CRCParticleOverflow}
 * @see {@link CRCParticleEmission}
 * @see {@link CRCParticleShape2D}
 * @see {@link CRCParticleInitial2D}
 * @see {@link CRCParticleMotion2D}
 * @see {@link CRCParticleAppearance}
 * @see {@link CRCParticleRenderer2D}
 * @see {@link CRCParticleBounds2D}
 * @see {@link CRCParticleEffect2DInput}
 */
export interface CRCParticleEmitter2D {
  /** Name identifying this backend, emitter, or parameter. See {@link CRCParticleEmitter2D}. */
  readonly name: string;
  /** Maximum number of particles retained by this emitter. See {@link CRCParticleEmitter2D}. */
  readonly capacity: number;
  /**
   * Rejects newly emitted particles or recycles the oldest particles when capacity is exhausted.
   * See {@link CRCParticleOverflow}.
   */
  readonly overflow?: CRCParticleOverflow;
  /** The literal "local" identifying this variant. See {@link CRCParticleEmitter2D}. */
  readonly space?: "local";
  /** Timed and manual emission rules for the emitter. See {@link CRCParticleEmission}. */
  readonly emission: readonly CRCParticleEmission[];
  /** Immutable collision geometry or particle spawn shape. See {@link CRCParticleShape2D}. */
  readonly shape: CRCParticleShape2D;
  /**
   * Distributions and parameters sampled when a particle is born. See {@link CRCParticleInitial2D}
   * .
   */
  readonly initial: CRCParticleInitial2D;
  /** Motion rules applied over particle lifetime. See {@link CRCParticleMotion2D}. */
  readonly motion?: readonly CRCParticleMotion2D[];
  /** Lifetime-dependent visual properties of the particles. See {@link CRCParticleAppearance}. */
  readonly appearance?: CRCParticleAppearance;
  /**
   * Canvas mark or sprite configuration used to paint this emitter's particles. See
   * {@link CRCParticleRenderer2D}.
   */
  readonly renderer: CRCParticleRenderer2D;
  /**
   * Conservative emitter bounds used for culling; required when they cannot be derived. See
   * {@link CRCParticleBounds2D}.
   */
  readonly bounds?: CRCParticleBounds2D;
}

/**
 * Authored parameters and nonempty emitter definitions used to create a 2D effect.
 *
 * @see {@link CRCParticleParameterDefinitions}
 * @see {@link CRCParticleEmitter2D}
 * @see {@link CRCParticleDiagnostic}
 * @see {@link defineParticleEffect2D}
 */
export interface CRCParticleEffect2DInput {
  /** Optional label used in diagnostics. See {@link CRCParticleEffect2DInput}. */
  readonly debugName?: string;
  /**
   * Named parameter definitions or values for this effect instance. See
   * {@link CRCParticleParameterDefinitions}.
   */
  readonly parameters?: CRCParticleParameterDefinitions;
  /** Named emitters forming the reusable effect. See {@link CRCParticleEmitter2D}. */
  readonly emitters: readonly [CRCParticleEmitter2D, ...CRCParticleEmitter2D[]];
}

declare const particleEffectBrand: unique symbol;

/**
 * A validated, branded 2D effect carrying its emitter-name and parameter types.
 *
 * @see {@link CRCParticleParameterValues}
 * @see {@link Particles2DProps}
 * @see {@link defineParticleEffect2D}
 * @see {@link useParticleSystem}
 */
export interface CRCParticleEffect2D<
  EmitterName extends string = string,
  Parameters extends CRCParticleParameterValues = CRCParticleParameterValues,
> {
  /** The literal 2 identifying this variant. See {@link CRCParticleEffect2D}. */
  readonly dimension: 2;
  readonly [particleEffectBrand]: {
    readonly emitterName: EmitterName;
    readonly parameters: Parameters;
  };
}

/**
 * The lifecycle state of a mounted particle system, including draining and disposal.
 *
 * @see {@link CRCParticleSystem}
 */
export type CRCParticleSystemStatus =
  | "idle"
  | "scheduled"
  | "running"
  | "paused"
  | "draining"
  | "finished"
  | "disposed";

/**
 * The selected particle execution path, or unbound before a renderer is attached.
 *
 * @see {@link CRCParticleSystem}
 */
export type CRCParticleExecution =
  | "unbound"
  | "stateless-canvas"
  | "flow-canvas";

/**
 * Notifies that a particle system has started a run.
 *
 * @see {@link CRCParticleSystemEvent}
 */
export interface CRCParticleStartEvent {
  /** The literal "start" identifying this variant. See {@link CRCParticleStartEvent}. */
  readonly type: "start";
}

/**
 * Reports the requested and accepted particle counts for an emitter burst.
 *
 * @see {@link CRCParticleSystemEvent}
 */
export interface CRCParticleBurstAcceptedEvent {
  /**
   * The literal "burst-accepted" identifying this variant. See
   * {@link CRCParticleBurstAcceptedEvent}.
   */
  readonly type: "burst-accepted";
  /**
   * Name of the emitter associated with this notification. See
   * {@link CRCParticleBurstAcceptedEvent}.
   */
  readonly emitter: string;
  /** Number of particles requested by the burst. See {@link CRCParticleBurstAcceptedEvent}. */
  readonly requested: number;
  /** Number of particles admitted by the burst. See {@link CRCParticleBurstAcceptedEvent}. */
  readonly accepted: number;
}

/**
 * Reports a burst rejection and whether capacity or system state prevented admission.
 *
 * @see {@link CRCParticleSystemEvent}
 */
export interface CRCParticleBurstRejectedEvent {
  /**
   * The literal "burst-rejected" identifying this variant. See
   * {@link CRCParticleBurstRejectedEvent}.
   */
  readonly type: "burst-rejected";
  /**
   * Name of the emitter associated with this notification. See
   * {@link CRCParticleBurstRejectedEvent}.
   */
  readonly emitter: string;
  /** Number of particles requested by the burst. See {@link CRCParticleBurstRejectedEvent}. */
  readonly requested: number;
  /** Number of particles admitted by the burst. See {@link CRCParticleBurstRejectedEvent}. */
  readonly accepted: number;
  /**
   * Reason the operation could not produce its ordinary result. See
   * {@link CRCParticleBurstRejectedEvent}.
   */
  readonly reason: "capacity" | "paused" | "stopped" | "disposed";
}

/**
 * Notifies that emission has stopped while existing particles finish their lifetimes.
 *
 * @see {@link CRCParticleSystemEvent}
 */
export interface CRCParticleDrainStartEvent {
  /** The literal "drain-start" identifying this variant. See {@link CRCParticleDrainStartEvent}. */
  readonly type: "drain-start";
}

/**
 * Notifies that a particle system has finished its active run.
 *
 * @see {@link CRCParticleSystemEvent}
 */
export interface CRCParticleFinishEvent {
  /** The literal "finish" identifying this variant. See {@link CRCParticleFinishEvent}. */
  readonly type: "finish";
}

/**
 * The lifecycle and burst-admission notifications emitted by a particle system.
 *
 * @see {@link CRCParticleStartEvent}
 * @see {@link CRCParticleBurstAcceptedEvent}
 * @see {@link CRCParticleBurstRejectedEvent}
 * @see {@link CRCParticleDrainStartEvent}
 * @see {@link CRCParticleFinishEvent}
 * @see {@link CRCParticleCommonProps}
 */
export type CRCParticleSystemEvent =
  | CRCParticleStartEvent
  | CRCParticleBurstAcceptedEvent
  | CRCParticleBurstRejectedEvent
  | CRCParticleDrainStartEvent
  | CRCParticleFinishEvent;

/**
 * Structured validation, capability, asset, execution, or ownership failure from a particle system.
 *
 * @see {@link CRCParticleSystemOptions}
 * @see {@link CRCParticleEffect2DInput}
 */
export type CRCParticleDiagnostic =
  | Readonly<{
      /**
       * The literal "definition-invalid" identifying this variant. See
       * {@link CRCParticleDiagnostic}.
       */
      type: "definition-invalid";
      /** Human-readable diagnostic explanation. See {@link CRCParticleDiagnostic}. */
      message: string;
      /**
       * Particle effect associated with this input or diagnostic. See
       * {@link CRCParticleDiagnostic}.
       */
      effect?: string;
      /** Name of the emitter associated with this notification. See {@link CRCParticleDiagnostic}. */
      emitter?: string;
      /** Name of the affected input property. See {@link CRCParticleDiagnostic}. */
      property?: string;
    }>
  | Readonly<{
      /**
       * The literal "capability-unsupported" identifying this variant. See
       * {@link CRCParticleDiagnostic}.
       */
      type: "capability-unsupported";
      /** Human-readable diagnostic explanation. See {@link CRCParticleDiagnostic}. */
      message: string;
      /** Name of the unsupported runtime capability. See {@link CRCParticleDiagnostic}. */
      capability: string;
      /**
       * Particle effect associated with this input or diagnostic. See
       * {@link CRCParticleDiagnostic}.
       */
      effect?: string;
      /** Name of the emitter associated with this notification. See {@link CRCParticleDiagnostic}. */
      emitter?: string;
    }>
  | Readonly<{
      /**
       * Selects `"asset-invalid"` , `"binding-conflict"` , `"backend-mismatch"` for type. See
       * {@link CRCParticleDiagnostic}.
       */
      type: "asset-invalid" | "binding-conflict" | "backend-mismatch";
      /** Human-readable diagnostic explanation. See {@link CRCParticleDiagnostic}. */
      message: string;
      /**
       * Particle effect associated with this input or diagnostic. See
       * {@link CRCParticleDiagnostic}.
       */
      effect?: string;
      /** Name of the emitter associated with this notification. See {@link CRCParticleDiagnostic}. */
      emitter?: string;
    }>
  | Readonly<{
      /**
       * Selects `"capacity-rejected"` , `"execution-failed"` , `"disposed"` for type. See
       * {@link CRCParticleDiagnostic}.
       */
      type: "capacity-rejected" | "execution-failed" | "disposed";
      /** Human-readable diagnostic explanation. See {@link CRCParticleDiagnostic}. */
      message: string;
      /**
       * Particle effect associated with this input or diagnostic. See
       * {@link CRCParticleDiagnostic}.
       */
      effect?: string;
      /** Name of the emitter associated with this notification. See {@link CRCParticleDiagnostic}. */
      emitter?: string;
    }>;

/**
 * Autoplay, deterministic seed, flow binding, and lifecycle callbacks for a mounted system.
 *
 * @see {@link CRCFlowField2D}
 * @see {@link CRCParticleSystemEvent}
 * @see {@link CRCParticleDiagnostic}
 * @see {@link useParticleSystem}
 */
export interface CRCParticleSystemOptions {
  /** Mount-owned field binding; advects emitter positions instead of analytic translation. */
  readonly flow?: CRCFlowField2D;
  /**
   * Whether playback is requested automatically when the owner mounts. See
   * {@link CRCParticleSystemOptions}.
   */
  readonly autoplay?: boolean;
  /**
   * Seed used for deterministic sampling or simulation initialization. See
   * {@link CRCParticleSystemOptions}.
   */
  readonly seed?: number;
  /** Optional label used in diagnostics. See {@link CRCParticleSystemOptions}. */
  readonly debugName?: string;
  /**
   * Receives lifecycle and milestone notifications. See {@link CRCParticleSystemEvent}.
   * @param event - Particle playback or emission event. See {@link CRCParticleSystemEvent}.
   */
  readonly onEvent?: (event: CRCParticleSystemEvent) => void;
  /**
   * Receives failures reported by the owning runtime resource. See
   * {@link CRCParticleSystemOptions}.
   * @param error - Failure reported by the particle system.
   */
  readonly onError?: (error: unknown) => void;
}

/**
 * Per-burst count, position, seed, and parameter overrides.
 *
 * @see {@link CRCParticleSystem}
 */
export interface CRCParticleBurstOverrides {
  /**
   * Number of particles or sources requested by this configuration. See
   * {@link CRCParticleBurstOverrides}.
   */
  readonly count?: number;
  /**
   * Position of the geometry, source, or selected resize handle. See
   * {@link CRCParticleBurstOverrides}.
   */
  readonly position?: readonly [number, number];
  /**
   * Additional seed input distinguishing this burst from otherwise identical requests. See
   * {@link CRCParticleBurstOverrides}.
   */
  readonly seedSalt?: number;
  /**
   * Named parameter definitions or values for this effect instance. See
   * {@link CRCParticleBurstOverrides}.
   */
  readonly parameters?: Readonly<Record<string, number | readonly number[] | string>>;
}

declare const particleSystemBrand: unique symbol;

/**
 * Mount-owned playback and burst controls with reactive status and execution-path information.
 *
 * @see {@link CRCParticleParameterValues}
 * @see {@link Signal}
 * @see {@link CRCParticleSystemStatus}
 * @see {@link CRCParticleExecution}
 * @see {@link CRCParticleBurstOverrides}
 * @see {@link Particles2DProps}
 */
export interface CRCParticleSystem<
  EmitterName extends string = string,
  Parameters extends CRCParticleParameterValues = CRCParticleParameterValues,
> {
  readonly [particleSystemBrand]: {
    readonly parameters: Parameters;
    readonly dimension: 2;
  };
  /**
   * Reactive lifecycle state of this mounted particle system. See {@link Signal},
   * {@link CRCParticleSystemStatus}.
   */
  readonly status: Signal<CRCParticleSystemStatus>;
  /**
   * Reactive execution path selected for the current renderer binding. See {@link Signal},
   * {@link CRCParticleExecution}.
   */
  readonly execution: Signal<CRCParticleExecution>;
  /** Queues a new particle-system run. See {@link CRCParticleSystem}. */
  play(): void;
  /** Queues suspension of particle-system advancement. See {@link CRCParticleSystem}. */
  pause(): void;
  /** Queues resumption of a paused particle-system run. See {@link CRCParticleSystem}. */
  resume(): void;
  /**
   * Queues a fresh run, optionally replacing its deterministic seed. See {@link CRCParticleSystem}
   * .
   * @param options - Optional seed override for the restarted simulation.
   */
  restart(
    options?: Readonly<{
      /**
       * Seed used for deterministic sampling or simulation initialization. See
       * {@link CRCParticleSystem}.
       */
      seed?: number;
    }>,
  ): void;
  /**
   * Queues a manual burst for the named emitter with optional birth overrides. See
   * {@link CRCParticleSystem}.
   * @param emitter - Name of the effect emitter to burst.
   * @param options - Optional per-burst emission overrides. See {@link CRCParticleBurstOverrides}.
   */
  emit(emitter: EmitterName, options?: CRCParticleBurstOverrides): void;
  /**
   * Queues stopping; drain retains live particles until they finish, while clear removes them. See
   * {@link CRCParticleSystem}.
   * @param options - Whether to drain existing particles or clear them immediately.
   */
  stop(
    options?: Readonly<{
      /** Selects the supported mapping, placement, or result policy. See {@link CRCParticleSystem}. */
      mode?: "drain" | "clear";
    }>,
  ): void;
}

/**
 * Shared parameter, interaction, focus, and lifecycle inputs for particle components.
 *
 * @see {@link CRCParticleParameterValues}
 * @see {@link CRCEventHandlers}
 * @see {@link CRCEventParticipationOptions}
 * @see {@link LayoutBox}
 * @see {@link CRCParticleSystemEvent}
 */
export interface CRCParticleCommonProps<Parameters extends CRCParticleParameterValues>
  extends CRCEventHandlers, CRCEventParticipationOptions {
  /**
   * Named parameter definitions or values for this effect instance. See
   * {@link CRCParticleCommonProps}.
   */
  readonly parameters?: Readonly<Partial<Parameters>>;
  /** Whether the target may receive keyboard focus. See {@link CRCParticleCommonProps}. */
  readonly keyboardFocusable?: boolean;
  /** Logical rectangle used for directional keyboard navigation. See {@link LayoutBox}. */
  readonly keyboardNavigationBounds?: Readonly<LayoutBox>;
  /**
   * Receives lifecycle and milestone notifications. See {@link CRCParticleSystemEvent}.
   * @param event - Particle playback or emission event. See {@link CRCParticleSystemEvent}.
   */
  readonly onEvent?: (event: CRCParticleSystemEvent) => void;
  /**
   * Receives failures reported by the owning runtime resource. See {@link CRCParticleCommonProps}
   * .
   * @param error - Failure reported by the particle system.
   */
  readonly onError?: (error: unknown) => void;
}

/**
 * Signal-capable particle inputs while preserving ordinary callbacks and opaque style payloads.
 *
 * @see {@link CRCParticleCommonProps}
 */
export type CRCParticleCommonInputProps<
  Parameters extends CRCParticleParameterValues,
> = {
  readonly [K in keyof CRCParticleCommonProps<Parameters>]:
    SignalValue<CRCParticleCommonProps<Parameters>[K]>;
};

type CRCParticleStyleInput<S extends object> = SignalValue<{
  readonly [K in keyof S]: SignalValue<S[K]>;
}>;

/**
 * Supported geometry and presentation properties for Particles2D.
 *
 * @see {@link SystemStyle}
 * @see {@link BoxStyle}
 * @see {@link LayoutItemStyle}
 * @see {@link CursorStyle}
 * @see {@link Particles2DProps}
 */
export interface Particles2DStyle
  extends SystemStyle, BoxStyle, LayoutItemStyle, CursorStyle {
  /** Opacity of the painted result. See {@link Particles2DStyle}. */
  readonly opacity?: number;
}

/**
 * Authored inputs for Particles2D, including the declared data and presentation options.
 *
 * @see {@link CRCParticleParameterValues}
 * @see {@link Particles2DStyle}
 * @see {@link SignalValue}
 * @see {@link CRCParticleEffect2D}
 * @see {@link CRCParticleSystem}
 * @see {@link Particles2D}
 */
export type Particles2DProps<
  EmitterName extends string = string,
  Parameters extends CRCParticleParameterValues = CRCParticleParameterValues,
> = CRCParticleCommonInputProps<Parameters> & {
  /**
   * Declared presentation and layout properties. See {@link CRCParticleStyleInput},
   * {@link Particles2DStyle}.
   */
  readonly style?: CRCParticleStyleInput<Particles2DStyle>;
} & (
    | {
        /**
         * Particle effect associated with this input or diagnostic. See {@link SignalValue},
         * {@link CRCParticleEffect2D}.
         */
        readonly effect: SignalValue<CRCParticleEffect2D<EmitterName, Parameters>>;
        /**
         * Not accepted in this variant; use the alternative fields instead. See
         * {@link Particles2DProps}.
         */
        readonly system?: never;
        /** Whether playback is requested automatically when the owner mounts. See {@link SignalValue}. */
        readonly autoplay?: SignalValue<boolean>;
        /** Seed used for deterministic sampling or simulation initialization. See {@link SignalValue}. */
        readonly seed?: SignalValue<number>;
      }
    | {
        /**
         * Not accepted in this variant; use the alternative fields instead. See
         * {@link Particles2DProps}.
         */
        readonly effect?: never;
        /**
         * Mounted particle controller supplying this component's simulation. See
         * {@link CRCParticleSystem}.
         */
        readonly system: CRCParticleSystem<EmitterName, Parameters>;
        /**
         * Not accepted in this variant; use the alternative fields instead. See
         * {@link Particles2DProps}.
         */
        readonly autoplay?: never;
        /**
         * Not accepted in this variant; use the alternative fields instead. See
         * {@link Particles2DProps}.
         */
        readonly seed?: never;
      }
  );
