---
id: api-types-canvas-runtime
title: Canvas and runtime types
summary: Surface, controller, signal, animation, and hook-value contracts.
kind: api
slug: canvas-runtime
apiCategory: types
typeDomain: canvas-runtime
symbols:
  [
    Canvas,
    CRCAnimationDefinition,
    CRCAnimationOptions,
    CRCAnimationProgram,
    CRCAnimationRepeatDirection,
    CRCAnimationRepeatOptions,
    CRCAnimationSampleInput,
    CRCConfig,
    CRCController,
    CRCEasing,
    CRCFit,
    CRCFixedViewportConfig,
    CRCInterpolator,
    CRCKeyframesOptions,
    CRCPixelRatio,
    CRCPlayback,
    CRCPlaybackEvent,
    CRCPlaybackOptions,
    CRCPlaybackStatus,
    CRCRef,
    CRCResponsiveViewportConfig,
    CRCSpringOptions,
    CRCSpringTransitionOptions,
    CRCStepperOptions,
    CRCTweenOptions,
    CRCTweenTransitionOptions,
    RenderingContext2D,
    Signal,
    SignalEquals,
    SignalOptions,
    StateUpdater,
    WritableSignal,
  ]
keywords: [canvas, viewport, controller, signals, animation, playback, runtime]
---

# Canvas and runtime types

These contracts describe CRC's Canvas host, root-surface configuration, and
the stable values returned by its runtime and state APIs. Import them with
`type` from `@crc/core`.

## Canvas

`Canvas` is the supported host union: `HTMLCanvasElement | OffscreenCanvas`.
CRC owns at most one live mount for a host Canvas.

## CRCAnimationDefinition

`CRCAnimationDefinition<T>` is an opaque immutable value description without a
clock or output binding.

## CRCAnimationOptions

`CRCAnimationOptions<T>` configures `defineAnimation` with a finite duration,
synchronous sampler, and optional debug name.

## CRCAnimationProgram

`CRCAnimationProgram` is an opaque immutable composition of tracks, sequences,
parallel work, waits, markers, and repeats.

## CRCAnimationRepeatDirection

`CRCAnimationRepeatDirection` is `normal`, `reverse`, `alternate`, or
`alternate-reverse`.

## CRCAnimationRepeatOptions

`CRCAnimationRepeatOptions` supplies a positive iteration count or infinity and
an optional repeat direction.

## CRCAnimationSampleInput

`CRCAnimationSampleInput<T>` gives a custom sampler its activation value, local
time, and normalized progress.

## CRCConfig

`CRCConfig` selects either the fixed logical viewport configuration or the
responsive viewport configuration. The first `crc()` mount owns this choice.

## CRCController

`CRCController` is the stable controller returned by `crc()`. Its `dispose()`
method is idempotent and releases runtime-owned resources for that mount.

## CRCEasing

`CRCEasing` maps normalized progress to interpolation progress.

## CRCFit

`CRCFit` is the fixed-surface fitting mode. Fixed roots use centered `contain`
by default; the logical viewport remains distinct from CSS and backing pixels.

## CRCFixedViewportConfig

`CRCFixedViewportConfig` configures a fixed logical viewport with optional `fit`, `pixelRatio`, and `signal`. Omitting it captures the Canvas's initial logical
dimensions; the signal can abort runtime ownership.

## CRCInterpolator

`CRCInterpolator<T>` produces a typed value between `from` and `to` for a
normalized progress value.

## CRCKeyframesOptions

`CRCKeyframesOptions<T>` supplies at least two values, duration, optional
offsets/easing/interpolator, and a debug name.

## CRCPixelRatio

`CRCPixelRatio` describes the backing-pixel density policy. It keeps logical
geometry independent from the Canvas backing-store density.

## CRCPlayback

`CRCPlayback` exposes readonly `status` and `currentTime` signals plus stable
play, pause, resume, cancel, finish, seek, reverse, and playback-rate controls.

## CRCPlaybackEvent

`CRCPlaybackEvent` describes start, iteration, marker, finish, and cancel
milestones delivered after rendering during Complete.

## CRCPlaybackOptions

`CRCPlaybackOptions` configures autoplay, conflict policy, debug name,
milestone delivery, and isolated error handling.

## CRCPlaybackStatus

`CRCPlaybackStatus` is `idle`, `scheduled`, `running`, `paused`, `finished`,
`cancelled`, or `disposed`.

## CRCRef

`CRCRef<T>` is the stable mutable `{ current }` object returned by `useRef`.
Writing `current` does not schedule rendering and its lifetime is one component
identity.

## CRCResponsiveViewportConfig

`CRCResponsiveViewportConfig` is `{ viewport: "responsive", pixelRatio?,
signal? }`. Its logical root follows CSS content-box pixels instead of a fixed
captured viewport.

## CRCSpringOptions

`CRCSpringOptions` configures a number-only analytic spring and its rest bounds.

## CRCSpringTransitionOptions

`CRCSpringTransitionOptions` configures a number transition with `type:
"spring"`, equality, optional initial value, and spring parameters.

## CRCStepperOptions

`CRCStepperOptions<State, T>` supplies the fixed step, state initialization,
step/read callbacks, optional completion predicate, elapsed clamp, and debug
name.

## CRCTweenOptions

`CRCTweenOptions<T>` supplies `to`, optional `from`, duration, easing,
interpolator, and debug name.

## CRCTweenTransitionOptions

`CRCTweenTransitionOptions<T>` configures a transition with `type: "tween"`,
duration, equality, optional initial value, easing, and interpolation.

## RenderingContext2D

`RenderingContext2D` is the 2D-context union for the supported Canvas hosts.
`useCanvasContext()` exposes it only while a CRC component is rendering.

## Signal

`Signal<T>` is a nominal readonly value with an explicit `get(): T` method.

## SignalEquals

`SignalEquals<T>` compares the previous and candidate values. CRC uses
`Object.is` when no custom equality function is supplied.

## SignalOptions

`SignalOptions<T>` accepts an optional equality function and debug name.

## StateUpdater

`StateUpdater<T>` is the setter returned by `useState`: it accepts a next value
or updater function. A valid update schedules CRC's coalesced animation-frame
render; stale setters safely do nothing after teardown.

## WritableSignal

`WritableSignal<T>` adds `set(value)`, `update(updater)`, and cached
`asReadonly()` to `Signal<T>`. `set()` treats functions as values.
