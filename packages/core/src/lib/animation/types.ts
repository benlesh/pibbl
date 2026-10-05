import type { Signal } from "../signals/types.js";
import type { defineAnimation, keyframes, spring, stepper, tween } from './definition.js';
import type { marker, parallel, repeat } from './program.js';
import type { useAnimatedValue } from '../hooks/use-animated-value.js';
import type { SignalEquals } from '../signals/types.js';
import type { usePlayback } from '../hooks/use-playback.js';
declare const pibblAnimationDefinitionBrand: unique symbol;
declare const pibblAnimationProgramBrand: unique symbol;

/**
 * Maps normalized animation progress to an interpolation progress.
 *
 * @param progress - Normalized input progress.
 * @returns Eased progress used for interpolation.
 *
 * @see {@link PibblKeyframesOptions}
 * @see {@link PibblTweenOptions}
 */
export type PibblEasing = (progress: number) => number;

/**
 * Produces an in-between value for a normalized interpolation progress.
 *
 * @param from - Value at the start of the interpolation.
 * @param to - Value at the end of the interpolation.
 * @param progress - Interpolation progress after easing.
 * @returns The interpolated value.
 *
 * @see {@link PibblKeyframesOptions}
 * @see {@link PibblTweenOptions}
 */
export type PibblInterpolator<T> = (from: T, to: T, progress: number) => T;

/**
 * An opaque, immutable description of an animation value.
 *
 * @see {@link defineAnimation}
 * @see {@link keyframes}
 * @see {@link spring}
 */
export interface PibblAnimationDefinition<T> {
  readonly [pibblAnimationDefinitionBrand]: T;
}

/**
 * An opaque, immutable composition of animation definitions.
 *
 * @see {@link marker}
 * @see {@link parallel}
 * @see {@link repeat}
 */
export interface PibblAnimationProgram {
  readonly [pibblAnimationProgramBrand]: true;
}

/**
 * Playback direction across iterations, including reversed and alternating runs.
 *
 * @see {@link PibblAnimationRepeatOptions}
 */
export type PibblAnimationRepeatDirection =
  | 'normal'
  | 'reverse'
  | 'alternate'
  | 'alternate-reverse';

/**
 * Count and direction controls for a repeated animation program.
 *
 * @see {@link PibblAnimationRepeatDirection}
 * @see {@link repeat}
 */
export interface PibblAnimationRepeatOptions {
  /** Number of times the program is repeated. See {@link PibblAnimationRepeatOptions}. */
  readonly iterations: number;
  /** Direction in which this operation proceeds. See {@link PibblAnimationRepeatDirection}. */
  readonly direction?: PibblAnimationRepeatDirection;
}

/**
 * Duration, easing, and optional custom interpolation between animation endpoints.
 *
 * @see {@link PibblEasing}
 * @see {@link PibblInterpolator}
 * @see {@link tween}
 */
export interface PibblTweenOptions<T> {
  /** Starting endpoint or value. See {@link PibblTweenOptions}. */
  readonly from?: T;
  /** Destination endpoint; omit when useAnimatedValue supplies the target. See {@link PibblTweenOptions}. */
  readonly to?: T;
  /** Duration of the animation or transition in milliseconds. See {@link PibblTweenOptions}. */
  readonly duration: number;
  /** Maps normalized progress before interpolation. See {@link PibblEasing}. */
  readonly easing?: PibblEasing;
  /**
   * Produces a value between two endpoints at the supplied progress. See {@link PibblInterpolator}.
   */
  readonly interpolate?: PibblInterpolator<T>;
  /** Optional label used in diagnostics. See {@link PibblTweenOptions}. */
  readonly debugName?: string;
}

/**
 * Keyframe values, timing, and easing for a seekable animation definition.
 *
 * @see {@link PibblEasing}
 * @see {@link PibblInterpolator}
 * @see {@link keyframes}
 */
export interface PibblKeyframesOptions<T> {
  /** Ordered values interpolated by the animation. See {@link PibblKeyframesOptions}. */
  readonly values: readonly [T, T, ...T[]];
  /** Duration of the animation or transition in milliseconds. See {@link PibblKeyframesOptions}. */
  readonly duration: number;
  /**
   * Normalized positions of the keyframes along the animation duration. See
   * {@link PibblKeyframesOptions}.
   */
  readonly offsets?: readonly number[];
  /** Maps normalized progress before interpolation. See {@link PibblEasing}. */
  readonly easing?: PibblEasing | readonly PibblEasing[];
  /**
   * Produces a value between two endpoints at the supplied progress. See {@link PibblInterpolator}.
   */
  readonly interpolate?: PibblInterpolator<T>;
  /** Optional label used in diagnostics. See {@link PibblKeyframesOptions}. */
  readonly debugName?: string;
}

/**
 * Physical parameters and completion thresholds for an analytic spring definition.
 *
 * @see {@link spring}
 * @see {@link PibblAnimationDefinition}
 */
export interface PibblSpringOptions {
  /** Starting endpoint or value. See {@link PibblSpringOptions}. */
  readonly from?: number;
  /** Destination endpoint; omit when useAnimatedValue supplies the target. See {@link PibblSpringOptions}. */
  readonly to?: number;
  /** Mass used by the spring or physics calculation. See {@link PibblSpringOptions}. */
  readonly mass?: number;
  /** Spring stiffness controlling acceleration toward the target. See {@link PibblSpringOptions}. */
  readonly stiffness?: number;
  /** Spring damping controlling the loss of velocity. See {@link PibblSpringOptions}. */
  readonly damping?: number;
  /** Starting velocity of the spring. See {@link PibblSpringOptions}. */
  readonly initialVelocity?: number;
  /**
   * Velocity threshold used to determine when the spring has settled. See {@link PibblSpringOptions}
   * .
   */
  readonly restSpeed?: number;
  /**
   * Distance-from-target threshold used to determine when the spring has settled. See
   * {@link PibblSpringOptions}.
   */
  readonly restDelta?: number;
  /**
   * Maximum duration allowed before the spring is forced to complete. See {@link PibblSpringOptions}
   * .
   */
  readonly maxDuration?: number;
  /** Optional label used in diagnostics. See {@link PibblSpringOptions}. */
  readonly debugName?: string;
}

/**
 * Current endpoints and optional committed spring velocity supplied to an animation factory.
 * @see {@link PibblAnimatedValueOptions}
 */
export interface PibblAnimationTarget<T> {
  /** Last presented value, or the explicit mount initial value. See {@link useAnimatedValue}. */
  readonly from: T;
  /** Latest requested target. See {@link useAnimatedValue}. */
  readonly to: T;
  /** Committed analytic spring velocity, when the previous run is a spring. See {@link spring}. */
  readonly velocity?: number;
}

/**
 * Definition-based target animation with mount-owned equality and initial presentation.
 * @see {@link useAnimatedValue}
 * @see {@link PibblAnimationDefinition}
 */
export interface PibblAnimatedValueOptions<T> {
  /**
   * Immutable definition or pure factory receiving the hook-owned endpoints. Factories run
   * synchronously during render and cannot write signals or call hooks.
   * @see {@link PibblAnimationTarget}
   * @see {@link PibblAnimationDefinition}
   * @param target - Current endpoints and previous spring velocity. See {@link PibblAnimationTarget}.
   * @returns A concrete animation definition. See {@link PibblAnimationDefinition}.
   */
  readonly animation: PibblAnimationDefinition<T> | ((target: PibblAnimationTarget<T>) => PibblAnimationDefinition<T>);
  /** Comparison used to suppress equal targets. See {@link SignalEquals}. */
  readonly equals?: SignalEquals<T>;
  /** Initial presented value; omitted initial values present the target without entrance motion. See {@link useAnimatedValue}. */
  readonly initial?: T;
  /** Optional playback diagnostic label. See {@link useAnimatedValue}. */
  readonly debugName?: string;
}

/**
 * Time and endpoint values supplied when sampling a seekable animation definition.
 *
 * @see {@link PibblAnimationOptions}
 */
export interface PibblAnimationSampleInput<T> {
  /**
   * Value captured at the start of this animation sample's run. See
   * {@link PibblAnimationSampleInput}.
   */
  readonly initialValue: T;
  /**
   * Elapsed logical time within the sampled animation, in milliseconds. See
   * {@link PibblAnimationSampleInput}.
   */
  readonly localTime: number;
  /**
   * Normalized progress through the current animation or transition. See
   * {@link PibblAnimationSampleInput}.
   */
  readonly progress: number;
}

/**
 * Duration and sampling callback for a custom seekable animation definition.
 *
 * @see {@link PibblAnimationSampleInput}
 * @see {@link defineAnimation}
 */
export interface PibblAnimationOptions<T> {
  /** Duration of the animation or transition in milliseconds. See {@link PibblAnimationOptions}. */
  readonly duration: number;
  /**
   * Samples a value from the captured initial value, local time, and normalized progress. See
   * {@link PibblAnimationSampleInput}.
   * @param input - Logical sample time, progress, and value captured at the start of the run. See
   * {@link PibblAnimationSampleInput} .
   * @returns The value to publish for this sample.
   */
  readonly sample: (input: PibblAnimationSampleInput<T>) => T;
  /** Optional label used in diagnostics. See {@link PibblAnimationOptions}. */
  readonly debugName?: string;
}

/**
 * Fixed-step state-machine configuration; execution state is playback-owned.
 *
 * @see {@link stepper}
 * @see {@link PibblAnimationDefinition}
 */
export interface PibblStepperOptions<State, T> {
  /** Fixed integration step in milliseconds. See {@link PibblStepperOptions}. */
  readonly stepMilliseconds: number;
  /**
   * Maximum elapsed time admitted to fixed-step integration per frame. See
   * {@link PibblStepperOptions}.
   */
  readonly maxElapsedMilliseconds?: number;
  /**
   * Creates playback-owned integration state from the current output value. See
   * {@link PibblStepperOptions}.
   * @param currentValue - Output signal value at the start of this run.
   * @returns Initial integration state for the run.
   */
  readonly initial: (currentValue: T) => State;
  /**
   * Advances the integration state by the supplied fixed timestep in milliseconds. See
   * {@link PibblStepperOptions}.
   * @param state - Integration state before this step.
   * @param deltaMilliseconds - Fixed step duration in milliseconds.
   * @returns Integration state after this step.
   */
  readonly step: (state: State, deltaMilliseconds: number) => State;
  /**
   * Extracts the output value from the current integration state. See {@link PibblStepperOptions}.
   * @param state - Current integration state.
   * @returns The output value represented by that state.
   */
  readonly read: (state: State) => T;
  /**
   * Reports whether the integration state has reached completion. See {@link PibblStepperOptions}.
   * @param state - Current integration state.
   * @returns True when the stepper has completed.
   */
  readonly done?: (state: State) => boolean;
  /** Optional label used in diagnostics. See {@link PibblStepperOptions}. */
  readonly debugName?: string;
}

/**
 * The current lifecycle state of an animation playback.
 *
 * @see {@link PibblPlayback}
 */
export type PibblPlaybackStatus =
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
 * @see {@link PibblPlaybackOptions}
 */
export interface PibblPlaybackEvent {
  /**
   * Selects `"start"` , `"iteration"` , `"marker"` , `"finish"` , `"cancel"` for type. See
   * {@link PibblPlaybackEvent}.
   */
  readonly type: 'start' | 'iteration' | 'marker' | 'finish' | 'cancel';
  /** Logical scheduler time in milliseconds. See {@link PibblPlaybackEvent}. */
  readonly logicalTime: number;
  /** Identifier of the shared scheduler frame. See {@link PibblPlaybackEvent}. */
  readonly frameId: number;
  /**
   * Indices identifying the program node that produced this event. See {@link PibblPlaybackEvent}.
   */
  readonly programPath: readonly number[];
  /** Index of the current repetition. See {@link PibblPlaybackEvent}. */
  readonly iteration: number;
  /** Name or source marker identifying this milestone. See {@link PibblPlaybackEvent}. */
  readonly marker?: string;
}

/**
 * Mount-owned playback controls and reactive status/time for an animation program.
 *
 * @see {@link PibblPlaybackStatus}
 * @see {@link usePlayback}
 * @see {@link Signal}
 */
export interface PibblPlayback {
  /** Reactive lifecycle state of the mounted playback. See {@link PibblPlaybackStatus}. */
  readonly status: import('../signals/types.js').Signal<PibblPlaybackStatus>;
  /** Reactive logical playback position in milliseconds. See {@link PibblPlayback}. */
  readonly currentTime: import('../signals/types.js').Signal<number>;

  /**
   * Queues playback startup with an optional conflicting-writer replacement policy. See
   * {@link PibblPlayback}.
   * @param options - Writer-conflict policy; replacement must be explicitly requested.
   */
  play(options?: {
    /** Selects `"error"`, `"replace"` for conflict. See {@link PibblPlayback}. */
    readonly conflict?: 'error' | 'replace';
  }): void;
  /** Queues a pause without discarding the current playback position. See {@link PibblPlayback}. */
  pause(): void;
  /** Queues resumption from the paused playback position. See {@link PibblPlayback}. */
  resume(): void;
  /** Queues cancellation and release of the program's writer leases. See {@link PibblPlayback}. */
  cancel(): void;
  /** Queues completion at the program's terminal value when supported. See {@link PibblPlayback}. */
  finish(): void;
  /**
   * Queues a change to the playback's logical position in milliseconds. See {@link PibblPlayback}.
   * @param milliseconds - Logical playback position in milliseconds.
   */
  seek(milliseconds: number): void;
  /** Queues reversal of the playback direction. See {@link PibblPlayback}. */
  reverse(): void;
  /**
   * Queues a change to the rate at which logical playback time advances. See {@link PibblPlayback}.
   * @param rate - Playback speed multiplier.
   */
  setPlaybackRate(rate: number): void;
}

/**
 * Playback startup, writer replacement, and lifecycle callback configuration.
 *
 * @see {@link PibblPlaybackEvent}
 */
export interface PibblPlaybackOptions {
  /**
   * Whether playback is requested automatically when the owner mounts. See
   * {@link PibblPlaybackOptions}.
   */
  readonly autoplay?: boolean;
  /** Selects `"error"`, `"replace"` for conflict. See {@link PibblPlaybackOptions}. */
  readonly conflict?: 'error' | 'replace';
  /** Optional label used in diagnostics. See {@link PibblPlaybackOptions}. */
  readonly debugName?: string;
  /**
   * Receives lifecycle and milestone notifications. See {@link PibblPlaybackEvent}.
   * @param event - Playback milestone or lifecycle event delivered during Complete. See
   * {@link PibblPlaybackEvent} .
   */
  readonly onEvent?: (event: PibblPlaybackEvent) => void;
  /**
   * Receives failures reported by the owning runtime resource. See {@link PibblPlaybackOptions}.
   * @param error - Failure reported by playback.
   */
  readonly onError?: (error: unknown) => void;
}
