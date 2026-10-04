---
id: api-hook-use-visibility-transition
title: useVisibilityTransition
summary: Controls a mounted subject's visual entrance and exit with request-scoped completion.
kind: api
slug: use-visibility-transition
apiCategory: hook
symbols:
  [
    defineTransition,
    CRCTransitionDefinition,
    CRCTransitionRenderFrame,
    slide,
    zoom,
    wipe,
    blurReveal,
    dissolve,
    CRCSlideOptions,
    CRCZoomOptions,
    CRCWipeOptions,
    CRCBlurRevealOptions,
    CRCDissolveOptions,
    hologram,
    CRCHologramOptions,
    bifrost,
    CRCBifrostOptions,
    embers,
    CRCEmbersOptions,
    CRCEmbersPhysicsOptions,
    CRCEmberCollision,
    useVisibilityTransition,
    fade,
    CRCTransitionBinding,
    CRCTransitionEffect,
    CRCVisibilityTransition,
    CRCVisibilityTransitionOptions,
    CRCVisibilityTransitionResult,
    CRCVisibilityTransitionStatus,
  ]
---

# useVisibilityTransition

Experimental first slice. `useVisibilityTransition({ initial, enter, exit, duration })`
returns a stable controller. Bind `controller.binding` to one primitive's
`style.transition`. `fade()` creates an inert, reusable effect definition.
`exit` defaults to `enter`, `initial` defaults to true, and duration defaults to
300 milliseconds. Zero duration commits the requested endpoint without material
animation; an effect's configured tail still runs. Configuration is mount-time in
this slice; rerendering does not reconfigure an existing controller.

A binding belongs to its hook owner and CRC root, and supports one mounted
receiver. Wrap multiple children in a `Group` to transition them together. Managed
Layers within that root are supported. Removing the receiver releases its binding;
removing the hook owner disposes the controller. Effect definitions can be shared
between independent controllers.

`show()` and `hide()` return promises with a unique `requestId`, `phase`
(`enter` or `exit`), and `status` (`finished`, `cancelled`, or `disposed`). A new
request cancels the previous pending request. Reversing an active fade preserves
its current progress. Finished results follow the final committed frame; removing
the owner settles pending requests as disposed. `finish()` reaches the requested
endpoint. Already-settled requests finish immediately.

The readonly `visible` signal is the requested state; `progress` is the current
material reveal fraction. It can reach its endpoint while particles remain airborne.
`status` stays entering or exiting until the effect tail finishes, then becomes
visible or hidden; removal changes it to disposed.

The fade captures the receiving primitive and its descendants as one subject,
so overlapping children fade uniformly. Ordinary native filters run before the
fade. A fully visible fade adds no filter boundary. Mixing boundary executors,
such as displacement with native filters, follows the existing filter restriction.

This first slice does not change layout, pointer targeting, focus, or unmount
semantics. Applications must explicitly disable input while hiding. Keep the
subject mounted until `hide()` finishes, then remove it if it is still requested
hidden. Canvas transitions do not support native HtmlBox content.

`embers({ region, charDepth?, burnWidth?, wind?, seed?, linger? })` is an experimental second effect. Its region is explicit in local coordinates; it burns upward and captures arbitrary Canvas children. The region must enclose all subject paint. It uses reusable Canvas surfaces without pixel readback. The jagged edge evolves within a narrow band. Particles keep their emission positions and advance on an independent forward clock, including during reversal. `linger` is their maximum lifetime in milliseconds (default 700; zero disables the tail). Material motion uses the controller duration; airborne particles can outlive it. Completion waits for the tail, so awaiting `hide()` before unmounting preserves the ash. `finish()` skips the remaining material motion and tail. The Bifrost, Embers, and Hologram visual reference
remains in Energy Transitions. Automatic visibility binding and automatic unmount retention are not yet implemented.

`hologram({ region, entry?, hue?, brightness?, fog?, glitch?, seed? })` reconstructs the captured subject with a diffuse scan ring, fog, and interference that settles as it materializes.

`bifrost({ region, entry?, brightness?, hue?, stretch?, glow?, seed? })` stretches a blurred white subject toward the entry point, compresses it into place, flashes, then restores its original colors. Both definitions require an enclosing local region and leave exact visible/hidden endpoints.

Common definitions use the same binding, reversal, and completion behavior:

- `slide({ x?, y? })` translates from an offset while fading (default 24 downward).
- `zoom({ origin, from? })` fades and scales from a factor around a local origin (default 0.8).
- `wipe({ region, direction? })` reveals from left, right, top, or bottom (default left).
- `blurReveal({ radius? })` fades from blur into sharp content (default 16).
- `dissolve({ region, cellSize?, seed? })` uses a repeatable scattered cell mask. Cell size is a minimum; the grid is bounded to 128 cells per axis.

These change captured pixels only. Presentation transforms and regions do not alter layout, focus bounds, or pointer geometry. All numeric parameters must be finite; intensity, blur, and scale parameters must be nonnegative. Definitions snapshot options when created.

## Custom effects and WASM

`defineTransition({ render, linger? })` makes an inert reusable definition. CRC owns capture, scheduling, completion, and pooled surfaces. `render(frame)` is synchronous and receives `progress`, `phase`, a forward `elapsed` clock, historical `progressAt(time)`, the borrowed `context` and `source`, local `sourceBounds`, and `drawSource()`. Settled endpoints bypass the callback. With a nonzero tail, the callback also runs at progress 0 or 1 until the tail finishes; it must keep the material hidden or visible appropriately while drawing its remaining particles.

```ts
import { defineTransition } from "@crc/core";

const effect = defineTransition({
  render({ context, progress, drawSource }) {
    context.globalAlpha = progress * progress;
    drawSource();
  },
});
```

The numeric calculation can call an already-initialized WASM export instead. WASM initialization happens before creating the definition; buffers/modules belong to the application. The browser Canvas drawing bridge remains JavaScript. Bifrost, Embers, and Hologram lazily load embedded WASM kernels for their patch, burn/particle, and fog/glitch calculations. Each used definition owns fixed memory with reused views and no network fetch: 128 KiB for Embers, 64 KiB for Bifrost and Hologram. Embers uses 1,200 airborne particle slots, with bright starts and gradual cooling and fading. Embers batches particle birth times into the JavaScript controller’s history lookup before sampling its WASM descriptors. Simple built-in effects remain JavaScript. WASM is not claimed to accelerate native Canvas drawing. Environments with a restrictive Content Security Policy must permit WebAssembly compilation (for example, `wasm-unsafe-eval`); compilation errors follow normal render failure cleanup.

Callbacks must not write signals, start clocks, return promises, retain borrowed frames/surfaces, mutate the source canvas, or rely on an exact callback count. Keep computation seekable from the supplied inputs. When drawing `source` directly, map its pixels to `sourceBounds` in the local context. Pixels outside the current capture window are not available. Exceptions propagate through CRC's normal render failure handling. Layout and event geometry remain unchanged.

`elapsed` and `progressAt(time)` use milliseconds from the current run's start.
Reversals preserve the run clock and all earlier progress segments, including any
hold until the scheduler accepts the reversal. A fresh run resets that history.
Negative history times return the initial progress; inputs must be finite.
Different enter and exit definitions use their own tail durations. A repeated
request during a tail cancels the previous request and restarts that tail.

Transitions compose with ordinary filters, clipping, transforms, and nested
managed Layers under the existing filter executor restrictions. A custom-renderer
failure follows normal CRC failure cleanup: the hook owner is torn down, pending
requests resolve as `disposed`, and its animation participants are released.

## Opt-in Ember physics

`embers({ region, linger: 1400, physics: { gravity: [0, 500], wind: [60, 0], drag: 4, restitution: 0.5, collide } })`
opts into a controller-owned fixed-step particle simulation. Coordinates are local
to the receiving primitive; forces use units/second², wind uses units/second, and
drag uses inverse seconds. `linger` must be positive. Gravity defaults to `[0,-60]`,
wind to `[0,-45]`, drag to 4, and restitution to 0.5.

For a local physics world, use `physics: { obstacles: physicsObstacles2D(world) }`
with `physicsObstacles2D` imported from `@crc/core/physics/2d`. The receiver and
world must share local coordinates. The source is read once per advancing frame;
changed packed geometry is copied directly into fixed WASM memory. All 1,200
particle sweeps and bounce calculations run in one WASM call per substep. Boxes,
ellipses, polygons, and boxes with equal rounded corners are supported, with a maximum of 8,192 packed numbers;
unsupported world shapes or capacity overflow report an error. Sensors are excluded.
The source supplies committed geometry; particles do not push bodies or inherit
obstacle velocity. A custom source must increment its `revision` when geometry
changes. Its typed arrays are borrowed synchronously and never retained.

The optional synchronous `collide(from, to)` callback receives a swept point segment
and returns the closest `{ fraction, normal }` hit or `undefined`. It runs during
Advance and must not write signals or retain borrowed data. Normal is a local
outward vector, fraction is in `[0,1]`. Query a local physics world in this callback
for custom obstacle interaction, but that performs JavaScript work per particle;
prefer `obstacles` for large populations. `collide` and `obstacles` are mutually
exclusive. This is one-way point collision: particles do not push
bodies. Keep the receiver and queried world in the same coordinate space or
explicitly convert points and normals. No physics-world import occurs implicitly.

The simulation takes 1/60-second steps with at most four catch-up steps per frame;
excess wall time is dropped. Reversal preserves existing motion; a fresh settled
run starts a fresh simulation. Completion still waits for the particle tail, and
owner disposal stops simulation. Physics owns 256 KiB fixed WASM memory per used
controller. The existing analytic effect remains the default when physics is omitted.
