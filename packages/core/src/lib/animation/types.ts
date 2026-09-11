declare const crcAnimationDefinitionBrand: unique symbol;

/** Maps normalized animation progress to an interpolation progress. */
export type CRCEasing = (progress: number) => number;

/** Produces an in-between value for a normalized interpolation progress. */
export type CRCInterpolator<T> = (from: T, to: T, progress: number) => T;

/** An opaque, immutable description of an animation value. */
export interface CRCAnimationDefinition<T> {
  readonly [crcAnimationDefinitionBrand]: T;
}

export interface CRCTweenOptions<T> {
  readonly from?: T;
  readonly to: T;
  readonly duration: number;
  readonly easing?: CRCEasing;
  readonly interpolate?: CRCInterpolator<T>;
  readonly debugName?: string;
}

export interface CRCKeyframesOptions<T> {
  readonly values: readonly T[];
  readonly duration: number;
  readonly offsets?: readonly number[];
  readonly easing?: CRCEasing | readonly CRCEasing[];
  readonly interpolate?: CRCInterpolator<T>;
  readonly debugName?: string;
}

export interface CRCSpringOptions {
  readonly from?: number;
  readonly to: number;
  readonly mass?: number;
  readonly stiffness?: number;
  readonly damping?: number;
  readonly initialVelocity?: number;
  readonly restSpeed?: number;
  readonly restDelta?: number;
  readonly maxDuration?: number;
  readonly debugName?: string;
}

export interface CRCAnimationSampleInput<T> {
  readonly initialValue: T;
  readonly localTime: number;
  readonly progress: number;
}

export interface CRCAnimationOptions<T> {
  readonly duration: number;
  readonly sample: (input: CRCAnimationSampleInput<T>) => T;
  readonly debugName?: string;
}

/** Construction-only state-machine configuration; execution is internal. */
export interface CRCStepperOptions<T> {
  readonly initialState: T;
  readonly step: (state: T, delta: number) => T;
  readonly done?: (state: T) => boolean;
  readonly fixedDelta?: number;
  readonly debugName?: string;
}
