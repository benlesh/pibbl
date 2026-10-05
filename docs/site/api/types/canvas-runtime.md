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
    PibblAnimationDefinition,
    PibblAnimationOptions,
    PibblAnimationProgram,
    PibblAnimationRepeatDirection,
    PibblAnimationRepeatOptions,
    PibblAnimationSampleInput,
    PibblConfig,
    PibblController,
    PibblEasing,
    PibblFit,
    PibblFixedViewportConfig,
    PibblInterpolator,
    PibblKeyframesOptions,
    PibblPixelRatio,
    PibblPlayback,
    PibblPlaybackEvent,
    PibblPlaybackOptions,
    PibblPlaybackStatus,
    PibblReactionOptions,
    PibblRef,
    PibblRenderLayerComponentProps,
    PibblRenderLayerContext,
    PibblRenderLayerDefinition,
    PibblRenderLayerFrame,
    PibblRenderLayerHit,
    PibblRenderLayerInput,
    PibblRenderLayerInteraction,
    PibblRenderLayerInteractionSnapshot,
    PibblRenderLayerProps,
    PibblRenderLayerSize,
    PibblRenderLayerStyle,
    PibblRenderLayerTarget,
    PibblResponsiveViewportConfig,
    PibblAnimatedValueOptions,
    PibblSpringOptions,
    PibblStepperOptions,
    PibblAnimationTarget,
    PibblTweenOptions,
    RenderingContext2D,
    Signal,
    SignalEquals,
    SignalOptions,
    WritableSignal,
  ]
keywords: [canvas, viewport, controller, signals, animation, playback, runtime]
---

# Canvas and runtime types

These contracts describe Pibbl's Canvas host, root-surface configuration, and
the stable values returned by its runtime and state APIs. Import them with
`type` from `@pibbl/core`.

## Canvas

`Canvas` is the supported host union: `HTMLCanvasElement | OffscreenCanvas`.
Pibbl owns at most one live mount for a host Canvas.

## PibblAnimationDefinition

`PibblAnimationDefinition<T>` is an opaque immutable value description without a
clock or output binding.

## PibblAnimationOptions

`PibblAnimationOptions<T>` configures `defineAnimation` with a finite duration,
synchronous sampler, and optional debug name.

## PibblAnimationProgram

`PibblAnimationProgram` is an opaque immutable composition of tracks, sequences,
parallel work, waits, markers, and repeats.

## PibblAnimationRepeatDirection

`PibblAnimationRepeatDirection` is `normal`, `reverse`, `alternate`, or
`alternate-reverse`.

## PibblAnimationRepeatOptions

`PibblAnimationRepeatOptions` supplies a positive iteration count or infinity and
an optional repeat direction.

## PibblAnimationSampleInput

`PibblAnimationSampleInput<T>` gives a custom sampler its activation value, local
time, and normalized progress.

## PibblConfig

`PibblConfig` selects either the fixed logical viewport configuration or the
responsive viewport configuration. The first `pibbl()` mount owns this choice.

## PibblController

`PibblController` is the stable controller returned by `pibbl()`. Its `dispose()`
method is idempotent and releases runtime-owned resources for that mount.

## PibblEasing

`PibblEasing` maps normalized progress to interpolation progress.

## PibblFit

`PibblFit` is the fixed-surface fitting mode. Fixed roots use centered `contain`
by default; the logical viewport remains distinct from CSS and backing pixels.

## PibblFixedViewportConfig

`PibblFixedViewportConfig` configures a fixed logical viewport with optional `fit`, `pixelRatio`, and `signal`. Omitting it captures the Canvas's initial logical
dimensions; the signal can abort runtime ownership.

## PibblInterpolator

`PibblInterpolator<T>` produces a typed value between `from` and `to` for a
normalized progress value.

## PibblKeyframesOptions

`PibblKeyframesOptions<T>` supplies at least two values, duration, optional
offsets/easing/interpolator, and a debug name.

## PibblPixelRatio

`PibblPixelRatio` describes the backing-pixel density policy. It keeps logical
geometry independent from the Canvas backing-store density.

## PibblPlayback

`PibblPlayback` exposes readonly `status` and `currentTime` signals plus stable
play, pause, resume, cancel, finish, seek, reverse, and playback-rate controls.

## PibblPlaybackEvent

`PibblPlaybackEvent` describes start, iteration, marker, finish, and cancel
milestones delivered after rendering during Complete.

## PibblPlaybackOptions

`PibblPlaybackOptions` configures autoplay, conflict policy, debug name,
milestone delivery, and isolated error handling.

## PibblPlaybackStatus

`PibblPlaybackStatus` is `idle`, `scheduled`, `running`, `paused`, `finished`,
`cancelled`, or `disposed`.

## PibblReactionOptions

`PibblReactionOptions` accepts an optional debug name for a component-owned
`useReaction` lifecycle.

## PibblRef

`PibblRef<T>` is the stable mutable `{ current }` object returned by `useRef`.
Writing `current` does not schedule rendering and its lifetime is one component
identity.

## PibblRenderLayerComponentProps

`PibblRenderLayerComponentProps` supplies the style and normal Pibbl event, focus,
and participation fields reserved by a render layer.

## PibblRenderLayerContext

`PibblRenderLayerContext` exposes the layer's owned `OffscreenCanvas`, current
resolved size, and a coalesced invalidation callback.

## PibblRenderLayerDefinition

`PibblRenderLayerDefinition` describes synchronous create, update, resize,
render, and optional disposal callbacks for an external raster layer.

## PibblRenderLayerFrame

`PibblRenderLayerFrame` provides Pibbl logical frame time, delta, and next-frame
invalidation to one render callback.

## PibblRenderLayerHit

`PibblRenderLayerHit<Target>` reports a layer-local miss, an occluding block, or
a registered application target identity.

## PibblRenderLayerInput

`PibblRenderLayerInput<Target>` delivers coordinate input only after the layer
wins global reverse-paint arbitration, with layer-local coordinates and
winner-owned pointer capture controls.

## PibblRenderLayerInteraction

`PibblRenderLayerInteraction<Props, Resources, Target>` settles the interaction
snapshot that commits transactionally with a candidate bitmap.

## PibblRenderLayerInteractionSnapshot

`PibblRenderLayerInteractionSnapshot<Target>` contains one generation's target
declarations, hit test, and optional winner input handler.

## PibblRenderLayerProps

`PibblRenderLayerProps<Props>` combines custom layer props with the reserved Pibbl
component fields and rejects reserved custom names.

## PibblRenderLayerSize

`PibblRenderLayerSize` records logical and backing dimensions plus effective
pixel ratios for one layer frame.

## PibblRenderLayerStyle

`PibblRenderLayerStyle` is the local box, layout, and filter style accepted by a
render layer.

## PibblRenderLayerTarget

`PibblRenderLayerTarget<Target>` associates a stable application identity with
Pibbl handlers, cursor participation, and optional focus geometry.

## PibblResponsiveViewportConfig

`PibblResponsiveViewportConfig` is `{ viewport: "responsive", pixelRatio?,
signal? }`. Its logical root follows CSS content-box pixels instead of a fixed
captured viewport.

## PibblAnimatedValueOptions

`PibblAnimatedValueOptions<T>` supplies an animation definition or pure factory,
optional initial value, equality comparison, and diagnostic label.

## PibblSpringOptions

`PibblSpringOptions` configures a number-only analytic spring and its rest bounds.

## PibblStepperOptions

`PibblStepperOptions<State, T>` supplies the fixed step, state initialization,
step/read callbacks, optional completion predicate, elapsed clamp, and debug
name.

## PibblAnimationTarget

`PibblAnimationTarget<T>` provides `from`, `to`, and optional committed spring
`velocity` to a custom animation factory.

## PibblTweenOptions

`PibblTweenOptions<T>` supplies `to`, optional `from`, duration, easing,
interpolator, and debug name.

## RenderingContext2D

`RenderingContext2D` is the 2D-context union for the supported Canvas hosts.
`useCanvasContext()` exposes it only while a Pibbl component is rendering.

## Signal

`Signal<T>` is a nominal readonly value with an explicit `get(): T` method.

## SignalEquals

`SignalEquals<T>` compares the previous and candidate values. Pibbl uses
`Object.is` when no custom equality function is supplied.

## SignalOptions

`SignalOptions<T>` accepts an optional equality function and debug name.

## WritableSignal

`WritableSignal<T>` adds `set(value)`, `update(updater)`, and cached
`asReadonly()` to `Signal<T>`. `set()` treats functions as values.
