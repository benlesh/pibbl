declare const crcAnimationDefinitionBrand: unique symbol;
declare const crcAnimationProgramBrand: unique symbol;

/** Maps normalized animation progress to an interpolation progress. */
export type CRCEasing = (progress: number) => number;

/** Produces an in-between value for a normalized interpolation progress. */
export type CRCInterpolator<T> = (from: T, to: T, progress: number) => T;

/** An opaque, immutable description of an animation value. */
export interface CRCAnimationDefinition<T> {
  readonly [crcAnimationDefinitionBrand]: T;
}

/** An opaque, immutable composition of animation definitions. */
export interface CRCAnimationProgram {
  readonly [crcAnimationProgramBrand]: true;
}

export type CRCAnimationRepeatDirection =
  | 'normal'
  | 'reverse'
  | 'alternate'
  | 'alternate-reverse';

export interface CRCAnimationRepeatOptions {
  readonly iterations: number;
  readonly direction?: CRCAnimationRepeatDirection;
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

/** Fixed-step state-machine configuration; execution state is playback-owned. */
export interface CRCStepperOptions<State, T> {
  readonly stepMilliseconds: number;
  readonly maxElapsedMilliseconds?: number;
  readonly initial: (currentValue: T) => State;
  readonly step: (state: State, deltaMilliseconds: number) => State;
  readonly read: (state: State) => T;
  readonly done?: (state: State) => boolean;
  readonly debugName?: string;
}
