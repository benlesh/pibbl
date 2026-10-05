import type { Signal } from "../signals/types.js";
import type { defineAnimation, keyframes, spring, stepper, tween } from './definition.js';
import type { marker, parallel, repeat } from './program.js';
import type { useAnimatedValue } from '../hooks/use-animated-value.js';
import type { SignalEquals } from '../signals/types.js';
import type { usePlayback } from '../hooks/use-playback.js';
declare const crcAnimationDefinitionBrand: unique symbol;
declare const crcAnimationProgramBrand: unique symbol;

/**
 * Maps normalized animation progress to an interpolation progress.
 *
 * @param progress - Normalized input progress.
 * @returns Eased progress used for interpolation.
 *
 * @see {@link CRCKeyframesOptions}
 * @see {@link CRCTweenOptions}
 * @see {@link CRCTweenAnimatedValueOptions}
 */
export type CRCEasing = (progress: number) => number;

/**
 * Produces an in-between value for a normalized interpolation progress.
 *
 * @param from - Value at the start of the interpolation.
 * @param to - Value at the end of the interpolation.
 * @param progress - Interpolation progress after easing.
 * @returns The interpolated value.
 *
 * @see {@link CRCKeyframesOptions}
 * @see {@link CRCTweenOptions}
 * @see {@link CRCTweenAnimatedValueOptions}
 */
export type CRCInterpolator<T> = (from: T, to: T, progress: number) => T;

/**
 * An opaque, immutable description of an animation value.
 *
 * @see {@link defineAnimation}
 * @see {@link keyframes}
 * @see {@link spring}
 */
export interface CRCAnimationDefinition<T> {
  readonly [crcAnimationDefinitionBrand]: T;
}

/**
 * An opaque, immutable composition of animation definitions.
 *
 * @see {@link marker}
 * @see {@link parallel}
 * @see {@link repeat}
 */
export interface CRCAnimationProgram {
  readonly [crcAnimationProgramBrand]: true;
}

/**
 * Playback direction across iterations, including reversed and alternating runs.
 *
 * @see {@link CRCAnimationRepeatOptions}
 */
export type CRCAnimationRepeatDirection =
  | 'normal'
  | 'reverse'
  | 'alternate'
  | 'alternate-reverse';

/**
 * Count and direction controls for a repeated animation program.
 *
 * @see {@link CRCAnimationRepeatDirection}
 * @see {@link repeat}
 */
export interface CRCAnimationRepeatOptions {
  /** Number of times the program is repeated. See {@link CRCAnimationRepeatOptions}. */
  readonly iterations: number;
  /** Direction in which this operation proceeds. See {@link CRCAnimationRepeatDirection}. */
  readonly direction?: CRCAnimationRepeatDirection;
}

/**
 * Duration, easing, and optional custom interpolation between animation endpoints.
 *
 * @see {@link CRCEasing}
 * @see {@link CRCInterpolator}
 * @see {@link tween}
 */
export interface CRCTweenOptions<T> {
  /** Starting endpoint or value. See {@link CRCTweenOptions}. */
  readonly from?: T;
  /** Destination endpoint or value. See {@link CRCTweenOptions}. */
  readonly to: T;
  /** Duration of the animation or transition in milliseconds. See {@link CRCTweenOptions}. */
  readonly duration: number;
  /** Maps normalized progress before interpolation. See {@link CRCEasing}. */
  readonly easing?: CRCEasing;
  /**
   * Produces a value between two endpoints at the supplied progress. See {@link CRCInterpolator}.
   */
  readonly interpolate?: CRCInterpolator<T>;
  /** Optional label used in diagnostics. See {@link CRCTweenOptions}. */
  readonly debugName?: string;
}

/**
 * Keyframe values, timing, and easing for a seekable animation definition.
 *
 * @see {@link CRCEasing}
 * @see {@link CRCInterpolator}
 * @see {@link keyframes}
 */
export interface CRCKeyframesOptions<T> {
  /** Ordered values interpolated by the animation. See {@link CRCKeyframesOptions}. */
  readonly values: readonly [T, T, ...T[]];
  /** Duration of the animation or transition in milliseconds. See {@link CRCKeyframesOptions}. */
  readonly duration: number;
  /**
   * Normalized positions of the keyframes along the animation duration. See
   * {@link CRCKeyframesOptions}.
   */
  readonly offsets?: readonly number[];
  /** Maps normalized progress before interpolation. See {@link CRCEasing}. */
  readonly easing?: CRCEasing | readonly CRCEasing[];
  /**
   * Produces a value between two endpoints at the supplied progress. See {@link CRCInterpolator}.
   */
  readonly interpolate?: CRCInterpolator<T>;
  /** Optional label used in diagnostics. See {@link CRCKeyframesOptions}. */
  readonly debugName?: string;
}

/**
 * Physical parameters and completion thresholds for an analytic spring definition.
 *
 * @see {@link spring}
 * @see {@link CRCAnimationDefinition}
 */
export interface CRCSpringOptions {
  /** Starting endpoint or value. See {@link CRCSpringOptions}. */
  readonly from?: number;
  /** Destination endpoint or value. See {@link CRCSpringOptions}. */
  readonly to: number;
  /** Mass used by the spring or physics calculation. See {@link CRCSpringOptions}. */
  readonly mass?: number;
  /** Spring stiffness controlling acceleration toward the target. See {@link CRCSpringOptions}. */
  readonly stiffness?: number;
  /** Spring damping controlling the loss of velocity. See {@link CRCSpringOptions}. */
  readonly damping?: number;
  /** Starting velocity of the spring. See {@link CRCSpringOptions}. */
  readonly initialVelocity?: number;
  /**
   * Velocity threshold used to determine when the spring has settled. See {@link CRCSpringOptions}
   * .
   */
  readonly restSpeed?: number;
  /**
   * Distance-from-target threshold used to determine when the spring has settled. See
   * {@link CRCSpringOptions}.
   */
  readonly restDelta?: number;
  /**
   * Maximum duration allowed before the spring is forced to complete. See {@link CRCSpringOptions}
   * .
   */
  readonly maxDuration?: number;
  /** Optional label used in diagnostics. See {@link CRCSpringOptions}. */
  readonly debugName?: string;
}

/**
 * Target-driven tween configuration for an animated value hook.
 *
 * @see {@link CRCEasing}
 * @see {@link CRCInterpolator}
 * @see {@link SignalEquals}
 */
export interface CRCTweenAnimatedValueOptions<T> {
  /** The literal "tween" identifying this variant. See {@link CRCTweenAnimatedValueOptions}. */
  readonly type: 'tween';
  /**
   * Duration of the animation or transition in milliseconds. See
   * {@link CRCTweenAnimatedValueOptions}.
   */
  readonly duration: number;
  /** Maps normalized progress before interpolation. See {@link CRCEasing}. */
  readonly easing?: CRCEasing;
  /**
   * Produces a value between two endpoints at the supplied progress. See {@link CRCInterpolator}.
   */
  readonly interpolate?: CRCInterpolator<T>;
  /**
   * Compares old and new values to suppress equivalent updates. See
   * {@link CRCTweenAnimatedValueOptions}.
   */
  readonly equals?: import('../signals/types.js').SignalEquals<T>;
  /** Initial animated value used when the hook mounts. See {@link CRCTweenAnimatedValueOptions}. */
  readonly initial?: T;
  /** Optional label used in diagnostics. See {@link CRCTweenAnimatedValueOptions}. */
  readonly debugName?: string;
}

/**
 * Target-driven spring configuration for an animated value hook.
 *
 * @see {@link useAnimatedValue}
 * @see {@link SignalEquals}
 */
export interface CRCSpringAnimatedValueOptions {
  /** The literal "spring" identifying this variant. See {@link CRCSpringAnimatedValueOptions}. */
  readonly type: 'spring';
  /** Mass used by the spring or physics calculation. See {@link CRCSpringAnimatedValueOptions}. */
  readonly mass?: number;
  /**
   * Spring stiffness controlling acceleration toward the target. See
   * {@link CRCSpringAnimatedValueOptions}.
   */
  readonly stiffness?: number;
  /** Spring damping controlling the loss of velocity. See {@link CRCSpringAnimatedValueOptions}. */
  readonly damping?: number;
  /** Starting velocity of the spring. See {@link CRCSpringAnimatedValueOptions}. */
  readonly initialVelocity?: number;
  /**
   * Velocity threshold used to determine when the spring has settled. See
   * {@link CRCSpringAnimatedValueOptions}.
   */
  readonly restSpeed?: number;
  /**
   * Distance-from-target threshold used to determine when the spring has settled. See
   * {@link CRCSpringAnimatedValueOptions}.
   */
  readonly restDelta?: number;
  /**
   * Maximum duration allowed before the spring is forced to complete. See
   * {@link CRCSpringAnimatedValueOptions}.
   */
  readonly maxDuration?: number;
  /**
   * Compares old and new values to suppress equivalent updates. See
   * {@link CRCSpringAnimatedValueOptions}.
   */
  readonly equals?: import('../signals/types.js').SignalEquals<number>;
  /** Initial animated value used when the hook mounts. See {@link CRCSpringAnimatedValueOptions}. */
  readonly initial?: number;
  /** Optional label used in diagnostics. See {@link CRCSpringAnimatedValueOptions}. */
  readonly debugName?: string;
}

/**
 * Time and endpoint values supplied when sampling a seekable animation definition.
 *
 * @see {@link CRCAnimationOptions}
 */
export interface CRCAnimationSampleInput<T> {
  /**
   * Value captured at the start of this animation sample's run. See
   * {@link CRCAnimationSampleInput}.
   */
  readonly initialValue: T;
  /**
   * Elapsed logical time within the sampled animation, in milliseconds. See
   * {@link CRCAnimationSampleInput}.
   */
  readonly localTime: number;
  /**
   * Normalized progress through the current animation or transition. See
   * {@link CRCAnimationSampleInput}.
   */
  readonly progress: number;
}

/**
 * Duration and sampling callback for a custom seekable animation definition.
 *
 * @see {@link CRCAnimationSampleInput}
 * @see {@link defineAnimation}
 */
export interface CRCAnimationOptions<T> {
  /** Duration of the animation or transition in milliseconds. See {@link CRCAnimationOptions}. */
  readonly duration: number;
  /**
   * Samples a value from the captured initial value, local time, and normalized progress. See
   * {@link CRCAnimationSampleInput}.
   * @param input - Logical sample time, progress, and value captured at the start of the run. See
   * {@link CRCAnimationSampleInput} .
   * @returns The value to publish for this sample.
   */
  readonly sample: (input: CRCAnimationSampleInput<T>) => T;
  /** Optional label used in diagnostics. See {@link CRCAnimationOptions}. */
  readonly debugName?: string;
}

/**
 * Fixed-step state-machine configuration; execution state is playback-owned.
 *
 * @see {@link stepper}
 * @see {@link CRCAnimationDefinition}
 */
export interface CRCStepperOptions<State, T> {
  /** Fixed integration step in milliseconds. See {@link CRCStepperOptions}. */
  readonly stepMilliseconds: number;
  /**
   * Maximum elapsed time admitted to fixed-step integration per frame. See
   * {@link CRCStepperOptions}.
   */
  readonly maxElapsedMilliseconds?: number;
  /**
   * Creates playback-owned integration state from the current output value. See
   * {@link CRCStepperOptions}.
   * @param currentValue - Output signal value at the start of this run.
   * @returns Initial integration state for the run.
   */
  readonly initial: (currentValue: T) => State;
  /**
   * Advances the integration state by the supplied fixed timestep in milliseconds. See
   * {@link CRCStepperOptions}.
   * @param state - Integration state before this step.
   * @param deltaMilliseconds - Fixed step duration in milliseconds.
   * @returns Integration state after this step.
   */
  readonly step: (state: State, deltaMilliseconds: number) => State;
  /**
   * Extracts the output value from the current integration state. See {@link CRCStepperOptions}.
   * @param state - Current integration state.
   * @returns The output value represented by that state.
   */
  readonly read: (state: State) => T;
  /**
   * Reports whether the integration state has reached completion. See {@link CRCStepperOptions}.
   * @param state - Current integration state.
   * @returns True when the stepper has completed.
   */
  readonly done?: (state: State) => boolean;
  /** Optional label used in diagnostics. See {@link CRCStepperOptions}. */
  readonly debugName?: string;
}

/**
 * The current lifecycle state of an animation playback.
 *
 * @see {@link CRCPlayback}
 */
export type CRCPlaybackStatus =
  | 'idle'
  | 'scheduled'
  | 'running'
  | 'paused'
  | 'finished'
  | 'cancelled'
  | 'disposed';

/**
 * Playback milestone information delivered after the scheduler completes the frame.
 *
 * @see {@link CRCPlaybackOptions}
 */
export interface CRCPlaybackEvent {
  /**
   * Selects `"start"` , `"iteration"` , `"marker"` , `"finish"` , `"cancel"` for type. See
   * {@link CRCPlaybackEvent}.
   */
  readonly type: 'start' | 'iteration' | 'marker' | 'finish' | 'cancel';
  /** Logical scheduler time in milliseconds. See {@link CRCPlaybackEvent}. */
  readonly logicalTime: number;
  /** Identifier of the shared scheduler frame. See {@link CRCPlaybackEvent}. */
  readonly frameId: number;
  /**
   * Indices identifying the program node that produced this event. See {@link CRCPlaybackEvent}.
   */
  readonly programPath: readonly number[];
  /** Index of the current repetition. See {@link CRCPlaybackEvent}. */
  readonly iteration: number;
  /** Name or source marker identifying this milestone. See {@link CRCPlaybackEvent}. */
  readonly marker?: string;
}

/**
 * Mount-owned playback controls and reactive status/time for an animation program.
 *
 * @see {@link CRCPlaybackStatus}
 * @see {@link usePlayback}
 * @see {@link Signal}
 */
export interface CRCPlayback {
  /** Reactive lifecycle state of the mounted playback. See {@link CRCPlaybackStatus}. */
  readonly status: import('../signals/types.js').Signal<CRCPlaybackStatus>;
  /** Reactive logical playback position in milliseconds. See {@link CRCPlayback}. */
  readonly currentTime: import('../signals/types.js').Signal<number>;

  /**
   * Queues playback startup with an optional conflicting-writer replacement policy. See
   * {@link CRCPlayback}.
   * @param options - Writer-conflict policy; replacement must be explicitly requested.
   */
  play(options?: {
    /** Selects `"error"`, `"replace"` for conflict. See {@link CRCPlayback}. */
    readonly conflict?: 'error' | 'replace';
  }): void;
  /** Queues a pause without discarding the current playback position. See {@link CRCPlayback}. */
  pause(): void;
  /** Queues resumption from the paused playback position. See {@link CRCPlayback}. */
  resume(): void;
  /** Queues cancellation and release of the program's writer leases. See {@link CRCPlayback}. */
  cancel(): void;
  /** Queues completion at the program's terminal value when supported. See {@link CRCPlayback}. */
  finish(): void;
  /**
   * Queues a change to the playback's logical position in milliseconds. See {@link CRCPlayback}.
   * @param milliseconds - Logical playback position in milliseconds.
   */
  seek(milliseconds: number): void;
  /** Queues reversal of the playback direction. See {@link CRCPlayback}. */
  reverse(): void;
  /**
   * Queues a change to the rate at which logical playback time advances. See {@link CRCPlayback}.
   * @param rate - Playback speed multiplier.
   */
  setPlaybackRate(rate: number): void;
}

/**
 * Playback startup, writer replacement, and lifecycle callback configuration.
 *
 * @see {@link CRCPlaybackEvent}
 */
export interface CRCPlaybackOptions {
  /**
   * Whether playback is requested automatically when the owner mounts. See
   * {@link CRCPlaybackOptions}.
   */
  readonly autoplay?: boolean;
  /** Selects `"error"`, `"replace"` for conflict. See {@link CRCPlaybackOptions}. */
  readonly conflict?: 'error' | 'replace';
  /** Optional label used in diagnostics. See {@link CRCPlaybackOptions}. */
  readonly debugName?: string;
  /**
   * Receives lifecycle and milestone notifications. See {@link CRCPlaybackEvent}.
   * @param event - Playback milestone or lifecycle event delivered during Complete. See
   * {@link CRCPlaybackEvent} .
   */
  readonly onEvent?: (event: CRCPlaybackEvent) => void;
  /**
   * Receives failures reported by the owning runtime resource. See {@link CRCPlaybackOptions}.
   * @param error - Failure reported by playback.
   */
  readonly onError?: (error: unknown) => void;
}
