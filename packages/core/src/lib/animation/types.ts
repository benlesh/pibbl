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
  readonly values: readonly [T, T, ...T[]];
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

export interface CRCTweenTransitionOptions<T> {
  readonly type: 'tween';
  readonly duration: number;
  readonly easing?: CRCEasing;
  readonly interpolate?: CRCInterpolator<T>;
  readonly equals?: import('../signals/types.js').SignalEquals<T>;
  readonly initial?: T;
  readonly debugName?: string;
}

export interface CRCSpringTransitionOptions {
  readonly type: 'spring';
  readonly mass?: number;
  readonly stiffness?: number;
  readonly damping?: number;
  readonly initialVelocity?: number;
  readonly restSpeed?: number;
  readonly restDelta?: number;
  readonly maxDuration?: number;
  readonly equals?: import('../signals/types.js').SignalEquals<number>;
  readonly initial?: number;
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

export type CRCPlaybackStatus =
  | 'idle'
  | 'scheduled'
  | 'running'
  | 'paused'
  | 'finished'
  | 'cancelled'
  | 'disposed';

export interface CRCPlaybackEvent {
  readonly type: 'start' | 'iteration' | 'marker' | 'finish' | 'cancel';
  readonly logicalTime: number;
  readonly frameId: number;
  readonly programPath: readonly number[];
  readonly iteration: number;
  readonly marker?: string;
}

export interface CRCPlayback {
  readonly status: import('../signals/types.js').Signal<CRCPlaybackStatus>;
  readonly currentTime: import('../signals/types.js').Signal<number>;

  play(options?: { readonly conflict?: 'error' | 'replace' }): void;
  pause(): void;
  resume(): void;
  cancel(): void;
  finish(): void;
  seek(milliseconds: number): void;
  reverse(): void;
  setPlaybackRate(rate: number): void;
}

export interface CRCPlaybackOptions {
  readonly autoplay?: boolean;
  readonly conflict?: 'error' | 'replace';
  readonly debugName?: string;
  readonly onEvent?: (event: CRCPlaybackEvent) => void;
  readonly onError?: (error: unknown) => void;
}
