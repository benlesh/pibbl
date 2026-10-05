import type { PibblEasing } from "@pibbl/core";
import type { particleChoice, particleCurve, particleGradient, particleInteger, particleRange } from './particle.js';
import type { defineParticleEffect2D } from './definition.js';
import type { useParticleSystem } from './system/hook.js';
import type { Particles2D } from './canvas/component.js';
import type { PibblFlowField2D } from "./flow/hook.js";
import type {
  BoxStyle,
  PathGeometry,
  PibblEventHandlers,
  PibblEventParticipationOptions,
  CursorStyle,
  LayoutBox,
  LayoutItemStyle,
  Signal,
  SignalValue,
  SystemStyle,
} from "@pibbl/core";

/**
 * Whether a parameter is sampled at spawn, simulation, or rendering time.
 *
 * @see {@link PibblParticleParameterDefinition}
 */
export type PibblParticleParameterTiming = "spawn" | "simulation" | "render";

/**
 * A typed default value and sampling phase for a named particle parameter.
 *
 * @see {@link PibblParticleParameterTiming}
 * @see {@link PibblParticleParameterDefinitions}
 * @see {@link PibblParticleValueFor}
 */
export type PibblParticleParameterDefinition =
  | Readonly<{
      /** The literal "number" identifying this variant. See {@link PibblParticleParameterDefinition}. */
      type: "number";
      /**
       * Value used when no parameter override is supplied. See
       * {@link PibblParticleParameterDefinition}.
       */
      default: number;
      /** Phase at which the parameter value is sampled. See {@link PibblParticleParameterTiming}. */
      timing: PibblParticleParameterTiming;
    }>
  | Readonly<{
      /** The literal "vector2" identifying this variant. See {@link PibblParticleParameterDefinition}. */
      type: "vector2";
      /**
       * Value used when no parameter override is supplied. See
       * {@link PibblParticleParameterDefinition}.
       */
      default: readonly [number, number];
      /** Phase at which the parameter value is sampled. See {@link PibblParticleParameterTiming}. */
      timing: PibblParticleParameterTiming;
    }>
  | Readonly<{
      /** The literal "color" identifying this variant. See {@link PibblParticleParameterDefinition}. */
      type: "color";
      /**
       * Value used when no parameter override is supplied. See
       * {@link PibblParticleParameterDefinition}.
       */
      default: string;
      /** Phase at which the parameter value is sampled. See {@link PibblParticleParameterTiming}. */
      timing: PibblParticleParameterTiming;
    }>;

/**
 * Named parameter declarations belonging to a particle effect.
 *
 * @see {@link PibblParticleParameterDefinition}
 * @see {@link PibblParticleEffect2DInput}
 * @see {@link PibblParticleValuesOf}
 */
export type PibblParticleParameterDefinitions = Readonly<
  Record<string, PibblParticleParameterDefinition>
>;

/**
 * Derives a parameter's value type from its declared particle parameter kind.
 *
 * @see {@link PibblParticleParameterDefinition}
 * @see {@link PibblParticleValuesOf}
 */
export type PibblParticleValueFor<
  Definition extends PibblParticleParameterDefinition,
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
 * @see {@link PibblParticleParameterDefinitions}
 * @see {@link PibblParticleValueFor}
 * @see {@link defineParticleEffect2D}
 */
export type PibblParticleValuesOf<
  Definitions extends PibblParticleParameterDefinitions | undefined,
> = Definitions extends PibblParticleParameterDefinitions
  ? Readonly<{
      [Name in keyof Definitions]: PibblParticleValueFor<Definitions[Name]>;
    }>
  : Readonly<Record<never, never>>;

/**
 * A numeric, color, or two-component particle parameter value.
 *
 * @see {@link PibblParticleParameterValues}
 */
export type PibblParticleParameterValue =
  | number
  | string
  | readonly [number, number];

/**
 * Values keyed by a particle effect's parameter names.
 *
 * @see {@link PibblParticleParameterValue}
 * @see {@link PibblParticleCommonProps}
 * @see {@link PibblParticleEffect2D}
 */
export type PibblParticleParameterValues = Readonly<
  Record<string, PibblParticleParameterValue>
>;

/**
 * A continuous numeric interval for particle sampling.
 *
 * @see {@link PibblParticleScalar}
 * @see {@link particleRange}
 */
export interface PibblParticleRange {
  /** The literal "between" identifying this variant. See {@link PibblParticleRange}. */
  readonly type: "between";
  /** Lower bound of the coordinate or sampling interval. See {@link PibblParticleRange}. */
  readonly min: number;
  /** Upper bound of the coordinate or sampling interval. See {@link PibblParticleRange}. */
  readonly max: number;
}

/**
 * An integer-valued random sampling interval.
 *
 * @see {@link PibblParticleEmission}
 * @see {@link PibblParticleScalar}
 * @see {@link particleInteger}
 */
export interface PibblParticleIntegerRange {
  /** The literal "integer" identifying this variant. See {@link PibblParticleIntegerRange}. */
  readonly type: "integer";
  /** Lower bound of the coordinate or sampling interval. See {@link PibblParticleIntegerRange}. */
  readonly min: number;
  /** Upper bound of the coordinate or sampling interval. See {@link PibblParticleIntegerRange}. */
  readonly max: number;
}

/**
 * A weighted collection of candidate values for particle sampling.
 *
 * @see {@link PibblParticleInitial2D}
 * @see {@link PibblParticleScalar}
 * @see {@link particleChoice}
 */
export interface PibblParticleChoice<T> {
  /** The literal "choice" identifying this variant. See {@link PibblParticleChoice}. */
  readonly type: "choice";
  /** Weighted candidate values sampled by the effect. See {@link PibblParticleChoice}. */
  readonly choices: readonly Readonly<{
    /** Value associated with this sample, input, or result. See {@link PibblParticleChoice}. */
    value: T;
    /** Relative sampling weight or source intensity. See {@link PibblParticleChoice}. */
    weight: number;
  }>[];
}

/**
 * A symbolic reference resolved against the owning effect's parameter definitions.
 *
 * @see {@link PibblParticleInitial2D}
 * @see {@link PibblParticleScalar}
 * @see {@link PibblParticleVector2}
 */
export interface PibblParticleParameterReference<Name extends string> {
  /**
   * The literal "parameter" identifying this variant. See {@link PibblParticleParameterReference}.
   */
  readonly type: "parameter";
  /**
   * Name identifying this backend, emitter, or parameter. See
   * {@link PibblParticleParameterReference}.
   */
  readonly name: Name;
}

/**
 * A literal, random distribution, weighted choice, or parameter reference yielding a number.
 *
 * @see {@link PibblParticleRange}
 * @see {@link PibblParticleIntegerRange}
 * @see {@link PibblParticleChoice}
 * @see {@link PibblParticleParameterReference}
 * @see {@link PibblParticleInitial2D}
 */
export type PibblParticleScalar =
  | number
  | PibblParticleRange
  | PibblParticleIntegerRange
  | PibblParticleChoice<number>
  | PibblParticleParameterReference<string>;

/**
 * Two independently sampled scalar values or a reference to a vector parameter.
 *
 * @see {@link PibblParticleScalar}
 * @see {@link PibblParticleParameterReference}
 * @see {@link PibblParticleInitial2D}
 * @see {@link PibblParticleMotion2D}
 */
export type PibblParticleVector2 =
  | readonly [PibblParticleScalar, PibblParticleScalar]
  | PibblParticleParameterReference<string>;

/**
 * A scalar or two-component value supported by particle curves.
 *
 * @see {@link PibblParticleCurve}
 * @see {@link particleCurve}
 */
export type PibblParticleCurveValue = number | readonly [number, number];

/**
 * Easing used to interpolate between particle keyframes.
 *
 * @see {@link PibblParticleCurve}
 * @see {@link PibblParticleGradient}
 * @see {@link particleCurve}
 * @see {@link PibblEasing}
 */
export interface PibblParticleCurveOptions {
  /** Maps normalized progress before interpolation. See {@link PibblParticleCurveOptions}. */
  readonly easing?: import("@pibbl/core").PibblEasing;
}

/**
 * Keyframes describing a numeric or two-component value over particle lifetime.
 *
 * @see {@link PibblParticleCurveValue}
 * @see {@link PibblParticleCurveOptions}
 * @see {@link PibblParticleAppearance}
 * @see {@link particleCurve}
 */
export interface PibblParticleCurve<T extends PibblParticleCurveValue> {
  /** The literal "curve" identifying this variant. See {@link PibblParticleCurve}. */
  readonly type: "curve";
  /** Ordered keyframes at normalized lifetime positions. See {@link PibblParticleCurve}. */
  readonly keys: readonly (readonly [time: number, value: T])[];
  /** Interpolation options applied between keyframes. See {@link PibblParticleCurveOptions}. */
  readonly options?: PibblParticleCurveOptions;
}

/**
 * Color keyframes interpolated across normalized particle lifetime.
 *
 * @see {@link PibblParticleCurveOptions}
 * @see {@link PibblParticleAppearance}
 * @see {@link particleGradient}
 */
export interface PibblParticleGradient {
  /** The literal "gradient" identifying this variant. See {@link PibblParticleGradient}. */
  readonly type: "gradient";
  /** Ordered keyframes at normalized lifetime positions. See {@link PibblParticleGradient}. */
  readonly keys: readonly (readonly [time: number, color: string])[];
  /** Interpolation options applied between keyframes. See {@link PibblParticleCurveOptions}. */
  readonly options?: PibblParticleCurveOptions;
}

/**
 * A timed rate, scheduled burst, or manually triggered particle emission rule.
 *
 * @see {@link PibblParticleIntegerRange}
 * @see {@link PibblParticleEmitter2D}
 */
export type PibblParticleEmission =
  | Readonly<{
      /** The literal "rate" identifying this variant. See {@link PibblParticleEmission}. */
      type: "rate";
      /** Continuous emission rate in particles per second. See {@link PibblParticleEmission}. */
      particlesPerSecond: number;
      /** Delay before the emission rule becomes active. See {@link PibblParticleEmission}. */
      startMilliseconds?: number;
      /** Duration for which the emission rule remains active. See {@link PibblParticleEmission}. */
      durationMilliseconds?: number;
      /**
       * Probability that an eligible emission is accepted by this rule. See
       * {@link PibblParticleEmission}.
       */
      probability?: number;
      /** Whether the browser reported an auto-repeated key press. See {@link PibblParticleEmission}. */
      repeat?: Readonly<{
        /** Interval between repeated emissions. See {@link PibblParticleEmission}. */
        everyMilliseconds: number;
        /**
         * Number of particles or sources requested by this configuration. See
         * {@link PibblParticleEmission}.
         */
        count: number;
      }>;
    }>
  | Readonly<{
      /** The literal "burst" identifying this variant. See {@link PibblParticleEmission}. */
      type: "burst";
      /** Logical time at which a scheduled burst occurs. See {@link PibblParticleEmission}. */
      atMilliseconds: number;
      /**
       * Number of particles or sources requested by this configuration. See
       * {@link PibblParticleIntegerRange}.
       */
      count: number | PibblParticleIntegerRange;
      /**
       * Probability that an eligible emission is accepted by this rule. See
       * {@link PibblParticleEmission}.
       */
      probability?: number;
      /** Whether the browser reported an auto-repeated key press. See {@link PibblParticleEmission}. */
      repeat?: Readonly<{
        /** Interval between repeated emissions. See {@link PibblParticleEmission}. */
        everyMilliseconds: number;
        /**
         * Number of particles or sources requested by this configuration. See
         * {@link PibblParticleEmission}.
         */
        count: number;
      }>;
    }>
  | Readonly<{
      /** The literal "manual" identifying this variant. See {@link PibblParticleEmission}. */
      type: "manual";
      /**
       * Number of particles or sources requested by this configuration. See
       * {@link PibblParticleIntegerRange}.
       */
      count?: number | PibblParticleIntegerRange;
    }>;

/**
 * The point, line, rectangle, circle, or ring used to sample particle birth positions.
 *
 * @see {@link PibblParticleEmitter2D}
 */
export type PibblParticleShape2D =
  | Readonly<{
      /** The literal "point" identifying this variant. See {@link PibblParticleShape2D}. */
      type: "point";
      /**
       * Position of the geometry, source, or selected resize handle. See
       * {@link PibblParticleShape2D}.
       */
      position?: readonly [number, number];
    }>
  | Readonly<{
      /** The literal "line" identifying this variant. See {@link PibblParticleShape2D}. */
      type: "line";
      /** Starting endpoint or value. See {@link PibblParticleShape2D}. */
      from: readonly [number, number];
      /** Destination endpoint or value. See {@link PibblParticleShape2D}. */
      to: readonly [number, number];
    }>
  | Readonly<{
      /** The literal "rectangle" identifying this variant. See {@link PibblParticleShape2D}. */
      type: "rectangle";
      /**
       * Horizontal extent in the units of the containing geometry or surface. See
       * {@link PibblParticleShape2D}.
       */
      width: number;
      /**
       * Vertical extent in the units of the containing geometry or surface. See
       * {@link PibblParticleShape2D}.
       */
      height: number;
      /** Selects `"interior"`, `"edge"` for sample. See {@link PibblParticleShape2D}. */
      sample: "interior" | "edge";
    }>
  | Readonly<{
      /** The literal "circle" identifying this variant. See {@link PibblParticleShape2D}. */
      type: "circle";
      /** Radius in the coordinate system of this geometry or effect. See {@link PibblParticleShape2D}. */
      radius: number;
      /** Selects `"interior"`, `"circumference"` for sample. See {@link PibblParticleShape2D}. */
      sample: "interior" | "circumference";
    }>
  | Readonly<{
      /** The literal "ring" identifying this variant. See {@link PibblParticleShape2D}. */
      type: "ring";
      /** Radius of the inner boundary. See {@link PibblParticleShape2D}. */
      innerRadius: number;
      /** Radius of the outer boundary. See {@link PibblParticleShape2D}. */
      outerRadius: number;
    }>;

/**
 * Particle birth values for lifetime, velocity, size, rotation, color, and opacity.
 *
 * @see {@link PibblParticleScalar}
 * @see {@link PibblParticleVector2}
 * @see {@link PibblParticleChoice}
 * @see {@link PibblParticleParameterReference}
 * @see {@link PibblParticleEmitter2D}
 */
export interface PibblParticleInitial2D {
  /** Particle lifetime sampled at birth, in milliseconds. See {@link PibblParticleScalar}. */
  readonly lifetimeMilliseconds: PibblParticleScalar;
  /** Linear velocity used by the particle motion rule. See {@link PibblParticleVector2}. */
  readonly velocity?: PibblParticleVector2;
  /**
   * Scalar or two-component size sampled at particle birth. See {@link PibblParticleScalar},
   * {@link PibblParticleVector2}.
   */
  readonly size?: PibblParticleScalar | PibblParticleVector2;
  /** Rotation in degrees sampled at particle birth. See {@link PibblParticleScalar}. */
  readonly rotationDegrees?: PibblParticleScalar;
  /** Angular velocity in degrees per second. See {@link PibblParticleScalar}. */
  readonly angularVelocityDegreesPerSecond?: PibblParticleScalar;
  /**
   * Color sampled at particle birth. See {@link PibblParticleChoice},
   * {@link PibblParticleParameterReference}.
   */
  readonly color?:
    string | PibblParticleChoice<string> | PibblParticleParameterReference<string>;
  /** Opacity sampled at particle birth. See {@link PibblParticleScalar}. */
  readonly opacity?: PibblParticleScalar;
}

/**
 * An analytic 2D motion rule such as gravity, drag, drift, orbit, or sway.
 *
 * @see {@link PibblParticleVector2}
 * @see {@link PibblParticleScalar}
 * @see {@link PibblParticleEmitter2D}
 */
export type PibblParticleMotion2D =
  | Readonly<{
      /** Selects `"acceleration"`, `"gravity"` for type. See {@link PibblParticleMotion2D}. */
      type: "acceleration" | "gravity";
      /** Value associated with this sample, input, or result. See {@link PibblParticleVector2}. */
      value: PibblParticleVector2;
    }>
  | Readonly<{
      /** The literal "drag" identifying this variant. See {@link PibblParticleMotion2D}. */
      type: "drag";
      /** Magnitude of the filter or motion adjustment. See {@link PibblParticleScalar}. */
      amount: PibblParticleScalar;
    }>
  | Readonly<{
      /** The literal "drift" identifying this variant. See {@link PibblParticleMotion2D}. */
      type: "drift";
      /** Linear velocity used by the particle motion rule. See {@link PibblParticleVector2}. */
      velocity: PibblParticleVector2;
    }>
  | Readonly<{
      /** The literal "radialAcceleration" identifying this variant. See {@link PibblParticleMotion2D}. */
      type: "radialAcceleration";
      /** Center of radial acceleration or orbital motion. See {@link PibblParticleMotion2D}. */
      center: readonly [number, number];
      /** Magnitude of the filter or motion adjustment. See {@link PibblParticleScalar}. */
      amount: PibblParticleScalar;
    }>
  | Readonly<{
      /** The literal "orbit" identifying this variant. See {@link PibblParticleMotion2D}. */
      type: "orbit";
      /** Center of radial acceleration or orbital motion. See {@link PibblParticleMotion2D}. */
      center: readonly [number, number];
      /** Angular motion rate in degrees per second. See {@link PibblParticleScalar}. */
      degreesPerSecond: PibblParticleScalar;
    }>
  | Readonly<{
      /** The literal "sway" identifying this variant. See {@link PibblParticleMotion2D}. */
      type: "sway";
      /** Maximum excursion of the oscillating motion. See {@link PibblParticleScalar}. */
      amplitude: PibblParticleScalar;
      /** Rate at which the pattern or motion repeats. See {@link PibblParticleScalar}. */
      frequency: PibblParticleScalar | readonly [number, number];
    }>
  | Readonly<{
      /** The literal "angularVelocity" identifying this variant. See {@link PibblParticleMotion2D}. */
      type: "angularVelocity";
      /** Angular motion rate in degrees per second. See {@link PibblParticleScalar}. */
      degreesPerSecond: PibblParticleScalar;
    }>;

/**
 * Size, rotation, color, and opacity changes over a particle's lifetime.
 *
 * @see {@link PibblParticleCurve}
 * @see {@link PibblParticleGradient}
 * @see {@link PibblParticleEmitter2D}
 */
export interface PibblParticleAppearance {
  /**
   * Scalar or two-component size curve evaluated over normalized particle lifetime. See
   * {@link PibblParticleCurve}.
   */
  readonly size?: PibblParticleCurve<number | readonly [number, number]>;
  /**
   * Rotation curve in degrees evaluated over normalized particle lifetime. See
   * {@link PibblParticleCurve}.
   */
  readonly rotationDegrees?: PibblParticleCurve<number>;
  /**
   * Color gradient evaluated over normalized particle lifetime. See {@link PibblParticleGradient}.
   */
  readonly color?: PibblParticleGradient;
  /** Opacity curve evaluated over normalized particle lifetime. See {@link PibblParticleCurve}. */
  readonly opacity?: PibblParticleCurve<number>;
}

/**
 * Canvas rendering configuration for circles, rectangles, paths, or sprites.
 *
 * @see {@link PathGeometry}
 * @see {@link PibblParticleEmitter2D}
 */
export type PibblParticleRenderer2D =
  | Readonly<{
      /** The literal "circle" identifying this variant. See {@link PibblParticleRenderer2D}. */
      type: "circle";
      /** Selects `"source-over"`, `"additive"` for blend. See {@link PibblParticleRenderer2D}. */
      blend?: "source-over" | "additive";
    }>
  | Readonly<{
      /** The literal "rectangle" identifying this variant. See {@link PibblParticleRenderer2D}. */
      type: "rectangle";
      /** Width-to-height ratio of the particle rectangle. See {@link PibblParticleRenderer2D}. */
      aspectRatio?: number;
      /** Selects `"source-over"`, `"additive"` for blend. See {@link PibblParticleRenderer2D}. */
      blend?: "source-over" | "additive";
    }>
  | Readonly<{
      /** The literal "path" identifying this variant. See {@link PibblParticleRenderer2D}. */
      type: "path";
      /** Path geometry used by this operation. See {@link PathGeometry}. */
      path: Path2D | PathGeometry;
      /** Selects `"source-over"`, `"additive"` for blend. See {@link PibblParticleRenderer2D}. */
      blend?: "source-over" | "additive";
    }>
  | Readonly<{
      /** The literal "sprite" identifying this variant. See {@link PibblParticleRenderer2D}. */
      type: "sprite";
      /** Image used to paint each sprite particle. See {@link PibblParticleRenderer2D}. */
      source: CanvasImageSource;
      /**
       * Logical point to which the content or result is anchored. See
       * {@link PibblParticleRenderer2D}.
       */
      anchor?: readonly [number, number];
      /** Selects `"source-over"`, `"additive"` for blend. See {@link PibblParticleRenderer2D}. */
      blend?: "source-over" | "additive";
    }>;

/**
 * Conservative minimum and maximum particle extents used for emitter culling.
 *
 * @see {@link PibblParticleEmitter2D}
 */
export interface PibblParticleBounds2D {
  /** Lower bound of the coordinate or sampling interval. See {@link PibblParticleBounds2D}. */
  readonly min: readonly [number, number];
  /** Upper bound of the coordinate or sampling interval. See {@link PibblParticleBounds2D}. */
  readonly max: readonly [number, number];
}

/**
 * Whether a full emitter rejects new particles or recycles its oldest particles.
 *
 * @see {@link PibblParticleEmitter2D}
 */
export type PibblParticleOverflow = "reject-newest" | "recycle-oldest";

/**
 * Capacity, emission, spawn geometry, motion, appearance, and rendering of one named emitter.
 *
 * @see {@link PibblParticleOverflow}
 * @see {@link PibblParticleEmission}
 * @see {@link PibblParticleShape2D}
 * @see {@link PibblParticleInitial2D}
 * @see {@link PibblParticleMotion2D}
 * @see {@link PibblParticleAppearance}
 * @see {@link PibblParticleRenderer2D}
 * @see {@link PibblParticleBounds2D}
 * @see {@link PibblParticleEffect2DInput}
 */
export interface PibblParticleEmitter2D {
  /** Name identifying this backend, emitter, or parameter. See {@link PibblParticleEmitter2D}. */
  readonly name: string;
  /** Maximum number of particles retained by this emitter. See {@link PibblParticleEmitter2D}. */
  readonly capacity: number;
  /**
   * Rejects newly emitted particles or recycles the oldest particles when capacity is exhausted.
   * See {@link PibblParticleOverflow}.
   */
  readonly overflow?: PibblParticleOverflow;
  /** The literal "local" identifying this variant. See {@link PibblParticleEmitter2D}. */
  readonly space?: "local";
  /** Timed and manual emission rules for the emitter. See {@link PibblParticleEmission}. */
  readonly emission: readonly PibblParticleEmission[];
  /** Immutable collision geometry or particle spawn shape. See {@link PibblParticleShape2D}. */
  readonly shape: PibblParticleShape2D;
  /**
   * Distributions and parameters sampled when a particle is born. See {@link PibblParticleInitial2D}
   * .
   */
  readonly initial: PibblParticleInitial2D;
  /** Motion rules applied over particle lifetime. See {@link PibblParticleMotion2D}. */
  readonly motion?: readonly PibblParticleMotion2D[];
  /** Lifetime-dependent visual properties of the particles. See {@link PibblParticleAppearance}. */
  readonly appearance?: PibblParticleAppearance;
  /**
   * Canvas mark or sprite configuration used to paint this emitter's particles. See
   * {@link PibblParticleRenderer2D}.
   */
  readonly renderer: PibblParticleRenderer2D;
  /**
   * Conservative emitter bounds used for culling; required when they cannot be derived. See
   * {@link PibblParticleBounds2D}.
   */
  readonly bounds?: PibblParticleBounds2D;
}

/**
 * Authored parameters and nonempty emitter definitions used to create a 2D effect.
 *
 * @see {@link PibblParticleParameterDefinitions}
 * @see {@link PibblParticleEmitter2D}
 * @see {@link PibblParticleDiagnostic}
 * @see {@link defineParticleEffect2D}
 */
export interface PibblParticleEffect2DInput {
  /** Optional label used in diagnostics. See {@link PibblParticleEffect2DInput}. */
  readonly debugName?: string;
  /**
   * Named parameter definitions or values for this effect instance. See
   * {@link PibblParticleParameterDefinitions}.
   */
  readonly parameters?: PibblParticleParameterDefinitions;
  /** Named emitters forming the reusable effect. See {@link PibblParticleEmitter2D}. */
  readonly emitters: readonly [PibblParticleEmitter2D, ...PibblParticleEmitter2D[]];
}

declare const particleEffectBrand: unique symbol;

/**
 * A validated, branded 2D effect carrying its emitter-name and parameter types.
 *
 * @see {@link PibblParticleParameterValues}
 * @see {@link Particles2DProps}
 * @see {@link defineParticleEffect2D}
 * @see {@link useParticleSystem}
 */
export interface PibblParticleEffect2D<
  EmitterName extends string = string,
  Parameters extends PibblParticleParameterValues = PibblParticleParameterValues,
> {
  /** The literal 2 identifying this variant. See {@link PibblParticleEffect2D}. */
  readonly dimension: 2;
  readonly [particleEffectBrand]: {
    readonly emitterName: EmitterName;
    readonly parameters: Parameters;
  };
}

/**
 * The lifecycle state of a mounted particle system, including draining and disposal.
 *
 * @see {@link PibblParticleSystem}
 */
export type PibblParticleSystemStatus =
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
 * @see {@link PibblParticleSystem}
 */
export type PibblParticleExecution =
  | "unbound"
  | "stateless-canvas"
  | "flow-canvas";

/**
 * Notifies that a particle system has started a run.
 *
 * @see {@link PibblParticleSystemEvent}
 */
export interface PibblParticleStartEvent {
  /** The literal "start" identifying this variant. See {@link PibblParticleStartEvent}. */
  readonly type: "start";
}

/**
 * Reports the requested and accepted particle counts for an emitter burst.
 *
 * @see {@link PibblParticleSystemEvent}
 */
export interface PibblParticleBurstAcceptedEvent {
  /**
   * The literal "burst-accepted" identifying this variant. See
   * {@link PibblParticleBurstAcceptedEvent}.
   */
  readonly type: "burst-accepted";
  /**
   * Name of the emitter associated with this notification. See
   * {@link PibblParticleBurstAcceptedEvent}.
   */
  readonly emitter: string;
  /** Number of particles requested by the burst. See {@link PibblParticleBurstAcceptedEvent}. */
  readonly requested: number;
  /** Number of particles admitted by the burst. See {@link PibblParticleBurstAcceptedEvent}. */
  readonly accepted: number;
}

/**
 * Reports a burst rejection and whether capacity or system state prevented admission.
 *
 * @see {@link PibblParticleSystemEvent}
 */
export interface PibblParticleBurstRejectedEvent {
  /**
   * The literal "burst-rejected" identifying this variant. See
   * {@link PibblParticleBurstRejectedEvent}.
   */
  readonly type: "burst-rejected";
  /**
   * Name of the emitter associated with this notification. See
   * {@link PibblParticleBurstRejectedEvent}.
   */
  readonly emitter: string;
  /** Number of particles requested by the burst. See {@link PibblParticleBurstRejectedEvent}. */
  readonly requested: number;
  /** Number of particles admitted by the burst. See {@link PibblParticleBurstRejectedEvent}. */
  readonly accepted: number;
  /**
   * Reason the operation could not produce its ordinary result. See
   * {@link PibblParticleBurstRejectedEvent}.
   */
  readonly reason: "capacity" | "paused" | "stopped" | "disposed";
}

/**
 * Notifies that emission has stopped while existing particles finish their lifetimes.
 *
 * @see {@link PibblParticleSystemEvent}
 */
export interface PibblParticleDrainStartEvent {
  /** The literal "drain-start" identifying this variant. See {@link PibblParticleDrainStartEvent}. */
  readonly type: "drain-start";
}

/**
 * Notifies that a particle system has finished its active run.
 *
 * @see {@link PibblParticleSystemEvent}
 */
export interface PibblParticleFinishEvent {
  /** The literal "finish" identifying this variant. See {@link PibblParticleFinishEvent}. */
  readonly type: "finish";
}

/**
 * The lifecycle and burst-admission notifications emitted by a particle system.
 *
 * @see {@link PibblParticleStartEvent}
 * @see {@link PibblParticleBurstAcceptedEvent}
 * @see {@link PibblParticleBurstRejectedEvent}
 * @see {@link PibblParticleDrainStartEvent}
 * @see {@link PibblParticleFinishEvent}
 * @see {@link PibblParticleCommonProps}
 */
export type PibblParticleSystemEvent =
  | PibblParticleStartEvent
  | PibblParticleBurstAcceptedEvent
  | PibblParticleBurstRejectedEvent
  | PibblParticleDrainStartEvent
  | PibblParticleFinishEvent;

/**
 * Structured validation, capability, asset, execution, or ownership failure from a particle system.
 *
 * @see {@link PibblParticleSystemOptions}
 * @see {@link PibblParticleEffect2DInput}
 */
export type PibblParticleDiagnostic =
  | Readonly<{
      /**
       * The literal "definition-invalid" identifying this variant. See
       * {@link PibblParticleDiagnostic}.
       */
      type: "definition-invalid";
      /** Human-readable diagnostic explanation. See {@link PibblParticleDiagnostic}. */
      message: string;
      /**
       * Particle effect associated with this input or diagnostic. See
       * {@link PibblParticleDiagnostic}.
       */
      effect?: string;
      /** Name of the emitter associated with this notification. See {@link PibblParticleDiagnostic}. */
      emitter?: string;
      /** Name of the affected input property. See {@link PibblParticleDiagnostic}. */
      property?: string;
    }>
  | Readonly<{
      /**
       * The literal "capability-unsupported" identifying this variant. See
       * {@link PibblParticleDiagnostic}.
       */
      type: "capability-unsupported";
      /** Human-readable diagnostic explanation. See {@link PibblParticleDiagnostic}. */
      message: string;
      /** Name of the unsupported runtime capability. See {@link PibblParticleDiagnostic}. */
      capability: string;
      /**
       * Particle effect associated with this input or diagnostic. See
       * {@link PibblParticleDiagnostic}.
       */
      effect?: string;
      /** Name of the emitter associated with this notification. See {@link PibblParticleDiagnostic}. */
      emitter?: string;
    }>
  | Readonly<{
      /**
       * Selects `"asset-invalid"` , `"binding-conflict"` , `"backend-mismatch"` for type. See
       * {@link PibblParticleDiagnostic}.
       */
      type: "asset-invalid" | "binding-conflict" | "backend-mismatch";
      /** Human-readable diagnostic explanation. See {@link PibblParticleDiagnostic}. */
      message: string;
      /**
       * Particle effect associated with this input or diagnostic. See
       * {@link PibblParticleDiagnostic}.
       */
      effect?: string;
      /** Name of the emitter associated with this notification. See {@link PibblParticleDiagnostic}. */
      emitter?: string;
    }>
  | Readonly<{
      /**
       * Selects `"capacity-rejected"` , `"execution-failed"` , `"disposed"` for type. See
       * {@link PibblParticleDiagnostic}.
       */
      type: "capacity-rejected" | "execution-failed" | "disposed";
      /** Human-readable diagnostic explanation. See {@link PibblParticleDiagnostic}. */
      message: string;
      /**
       * Particle effect associated with this input or diagnostic. See
       * {@link PibblParticleDiagnostic}.
       */
      effect?: string;
      /** Name of the emitter associated with this notification. See {@link PibblParticleDiagnostic}. */
      emitter?: string;
    }>;

/**
 * Autoplay, deterministic seed, flow binding, and lifecycle callbacks for a mounted system.
 *
 * @see {@link PibblFlowField2D}
 * @see {@link PibblParticleSystemEvent}
 * @see {@link PibblParticleDiagnostic}
 * @see {@link useParticleSystem}
 */
export interface PibblParticleSystemOptions {
  /** Mount-owned field binding; advects emitter positions instead of analytic translation. */
  readonly flow?: PibblFlowField2D;
  /**
   * Whether playback is requested automatically when the owner mounts. See
   * {@link PibblParticleSystemOptions}.
   */
  readonly autoplay?: boolean;
  /**
   * Seed used for deterministic sampling or simulation initialization. See
   * {@link PibblParticleSystemOptions}.
   */
  readonly seed?: number;
  /** Optional label used in diagnostics. See {@link PibblParticleSystemOptions}. */
  readonly debugName?: string;
  /**
   * Receives lifecycle and milestone notifications. See {@link PibblParticleSystemEvent}.
   * @param event - Particle playback or emission event. See {@link PibblParticleSystemEvent}.
   */
  readonly onEvent?: (event: PibblParticleSystemEvent) => void;
  /**
   * Receives failures reported by the owning runtime resource. See
   * {@link PibblParticleSystemOptions}.
   * @param error - Failure reported by the particle system.
   */
  readonly onError?: (error: unknown) => void;
}

/**
 * Per-burst count, position, seed, and parameter overrides.
 *
 * @see {@link PibblParticleSystem}
 */
export interface PibblParticleBurstOverrides {
  /**
   * Number of particles or sources requested by this configuration. See
   * {@link PibblParticleBurstOverrides}.
   */
  readonly count?: number;
  /**
   * Position of the geometry, source, or selected resize handle. See
   * {@link PibblParticleBurstOverrides}.
   */
  readonly position?: readonly [number, number];
  /**
   * Additional seed input distinguishing this burst from otherwise identical requests. See
   * {@link PibblParticleBurstOverrides}.
   */
  readonly seedSalt?: number;
  /**
   * Named parameter definitions or values for this effect instance. See
   * {@link PibblParticleBurstOverrides}.
   */
  readonly parameters?: Readonly<Record<string, number | readonly number[] | string>>;
}

declare const particleSystemBrand: unique symbol;

/**
 * Mount-owned playback and burst controls with reactive status and execution-path information.
 *
 * @see {@link PibblParticleParameterValues}
 * @see {@link Signal}
 * @see {@link PibblParticleSystemStatus}
 * @see {@link PibblParticleExecution}
 * @see {@link PibblParticleBurstOverrides}
 * @see {@link Particles2DProps}
 */
export interface PibblParticleSystem<
  EmitterName extends string = string,
  Parameters extends PibblParticleParameterValues = PibblParticleParameterValues,
> {
  readonly [particleSystemBrand]: {
    readonly parameters: Parameters;
    readonly dimension: 2;
  };
  /**
   * Reactive lifecycle state of this mounted particle system. See {@link Signal},
   * {@link PibblParticleSystemStatus}.
   */
  readonly status: Signal<PibblParticleSystemStatus>;
  /**
   * Reactive execution path selected for the current renderer binding. See {@link Signal},
   * {@link PibblParticleExecution}.
   */
  readonly execution: Signal<PibblParticleExecution>;
  /** Queues a new particle-system run. See {@link PibblParticleSystem}. */
  play(): void;
  /** Queues suspension of particle-system advancement. See {@link PibblParticleSystem}. */
  pause(): void;
  /** Queues resumption of a paused particle-system run. See {@link PibblParticleSystem}. */
  resume(): void;
  /**
   * Queues a fresh run, optionally replacing its deterministic seed. See {@link PibblParticleSystem}
   * .
   * @param options - Optional seed override for the restarted simulation.
   */
  restart(
    options?: Readonly<{
      /**
       * Seed used for deterministic sampling or simulation initialization. See
       * {@link PibblParticleSystem}.
       */
      seed?: number;
    }>,
  ): void;
  /**
   * Queues a manual burst for the named emitter with optional birth overrides. See
   * {@link PibblParticleSystem}.
   * @param emitter - Name of the effect emitter to burst.
   * @param options - Optional per-burst emission overrides. See {@link PibblParticleBurstOverrides}.
   */
  emit(emitter: EmitterName, options?: PibblParticleBurstOverrides): void;
  /**
   * Queues stopping; drain retains live particles until they finish, while clear removes them. See
   * {@link PibblParticleSystem}.
   * @param options - Whether to drain existing particles or clear them immediately.
   */
  stop(
    options?: Readonly<{
      /** Selects the supported mapping, placement, or result policy. See {@link PibblParticleSystem}. */
      mode?: "drain" | "clear";
    }>,
  ): void;
}

/**
 * Shared parameter, interaction, focus, and lifecycle inputs for particle components.
 *
 * @see {@link PibblParticleParameterValues}
 * @see {@link PibblEventHandlers}
 * @see {@link PibblEventParticipationOptions}
 * @see {@link LayoutBox}
 * @see {@link PibblParticleSystemEvent}
 */
export interface PibblParticleCommonProps<Parameters extends PibblParticleParameterValues>
  extends PibblEventHandlers, PibblEventParticipationOptions {
  /**
   * Named parameter definitions or values for this effect instance. See
   * {@link PibblParticleCommonProps}.
   */
  readonly parameters?: Readonly<Partial<Parameters>>;
  /** Whether the target may receive keyboard focus. See {@link PibblParticleCommonProps}. */
  readonly keyboardFocusable?: boolean;
  /** Logical rectangle used for directional keyboard navigation. See {@link LayoutBox}. */
  readonly keyboardNavigationBounds?: Readonly<LayoutBox>;
  /**
   * Receives lifecycle and milestone notifications. See {@link PibblParticleSystemEvent}.
   * @param event - Particle playback or emission event. See {@link PibblParticleSystemEvent}.
   */
  readonly onEvent?: (event: PibblParticleSystemEvent) => void;
  /**
   * Receives failures reported by the owning runtime resource. See {@link PibblParticleCommonProps}
   * .
   * @param error - Failure reported by the particle system.
   */
  readonly onError?: (error: unknown) => void;
}

/**
 * Signal-capable particle inputs while preserving ordinary callbacks and opaque style payloads.
 *
 * @see {@link PibblParticleCommonProps}
 */
export type PibblParticleCommonInputProps<
  Parameters extends PibblParticleParameterValues,
> = {
  readonly [K in keyof PibblParticleCommonProps<Parameters>]:
    SignalValue<PibblParticleCommonProps<Parameters>[K]>;
};

type PibblParticleStyleInput<S extends object> = SignalValue<{
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
 * @see {@link PibblParticleParameterValues}
 * @see {@link Particles2DStyle}
 * @see {@link SignalValue}
 * @see {@link PibblParticleEffect2D}
 * @see {@link PibblParticleSystem}
 * @see {@link Particles2D}
 */
export type Particles2DProps<
  EmitterName extends string = string,
  Parameters extends PibblParticleParameterValues = PibblParticleParameterValues,
> = PibblParticleCommonInputProps<Parameters> & {
  /**
   * Declared presentation and layout properties. See {@link PibblParticleStyleInput},
   * {@link Particles2DStyle}.
   */
  readonly style?: PibblParticleStyleInput<Particles2DStyle>;
} & (
    | {
        /**
         * Particle effect associated with this input or diagnostic. See {@link SignalValue},
         * {@link PibblParticleEffect2D}.
         */
        readonly effect: SignalValue<PibblParticleEffect2D<EmitterName, Parameters>>;
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
         * {@link PibblParticleSystem}.
         */
        readonly system: PibblParticleSystem<EmitterName, Parameters>;
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
