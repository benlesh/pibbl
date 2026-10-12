---
id: guide-signals-animation
title: Use signals and animation
summary: Drive signal-valued inputs, computed barriers, transitions, and component-owned animation through Pibbl's shared scheduler.
kind: guide
slug: signals-and-animation
order: 62
keywords: [signals, computed, animation, transitions, playback, scheduler]
---

# Signals and animation

Pibbl animation writes ordinary signals. Definitions describe values, programs
bind those definitions to writable signals, and `usePlayback` owns a running
program for one mounted component. Everything advances through the same realm
scheduler used by state, roots, and Layers.

## Pass signals to their receivers

Pibbl drawing components accept signals directly at declared inputs:

```tsx
function Card({ targetX }: { targetX: number }) {
  const x = useAnimatedValue(targetX, {
    animation: spring(),
    initial: 0,
  });

  return <Rectangle style={{ x, width: 80, height: 48 }} />;
}
```

`Rectangle` performs the read and owns the dependency. Use `x.get()` when the
enclosing component intentionally needs the value for arithmetic, branching,
or aggregation. This receiver-owned form is declared and shallow; Pibbl does not
search application objects for nested signals.

On mount, a transition with no `initial` presents its target immediately. A
different explicit `initial` is painted by the mounting render, then movement
is queued only if that render succeeds. Later unequal targets retarget from the
last committed value. Tween retargeting receives a new full duration; spring
retargeting carries its committed velocity.

## Definitions and programs

Use `tween`, `keyframes`, or `spring` for built-in seekable motion. A tween or
keyframe definition interpolates numbers without extra configuration. Supply
an interpolator for colors, points, objects, and every other value type:

```ts
const pointTween = tween({
  from: { x: 0, y: 10 },
  to: { x: 120, y: 40 },
  duration: 240,
  interpolate: (from, to, progress) => ({
    x: from.x + (to.x - from.x) * progress,
    y: from.y + (to.y - from.y) * progress,
  }),
});
```

The frozen `easing` object provides `linear`, `easeIn`, `easeOut`,
`easeInOut`, `cubicBezier(...)`, and `steps(...)`. `defineAnimation` accepts a
synchronous seekable sampler. `stepper` is the stateful escape hatch for fixed-
step acceleration, velocity, constraints, and similar integrations.

A program binds definitions to writable outputs and composes their timing:

```ts
function entrance(x: WritableSignal<number>, opacity: WritableSignal<number>) {
  return sequence(
    parallel(
      drive(
        x,
        tween({ from: -24, to: 0, duration: 180, easing: easing.easeOut }),
      ),
      drive(opacity, tween({ from: 0, to: 1, duration: 140 })),
    ),
    marker("arrived"),
  );
}
```

Definitions and programs are immutable. A program contains its exact writable
signal bindings, so a factory is the clearest reusable component pattern.
`sequence` runs in source order, `parallel` shares one local origin, `wait`
adds time, `marker` records a milestone, and `repeat` adds finite or infinite
iteration with an explicit direction.

## Event-triggered playback

Create playback while rendering, then call its stable controls from events:

```tsx
function AnimatedCard() {
  const x = useSignal(0);
  const opacity = useSignal(0);
  const player = usePlayback(entrance(x, opacity), {
    onEvent: (event) => {
      if (event.type === "marker" && event.marker === "arrived") {
        console.log("the arrived frame has rendered");
      }
    },
  });

  return (
    <Rectangle
      style={{
        x,
        width: 120,
        height: 72,
        opacity,
      }}
      onClick={() => player.play({ conflict: "replace" })}
    />
  );
}
```

Controls include `play`, `pause`, `resume`, `seek`, `reverse`,
`setPlaybackRate`, `finish`, and `cancel`. They queue for the next Begin phase
in invocation order. The readonly `status` and `currentTime` signals can flow
directly into declared inputs or be read with `.get()` when the enclosing
component needs a snapshot.

An active run reserves every output it may write for its entire lifetime,
including waits. Competing playback fails by default. Explicit
`conflict: "replace"` performs an atomic handoff. Do not call `set` or `update`
on a leased output; cancel or replace its player first. Cancel and failure keep
the last committed user value.

Milestones are collected while sampling and delivered in Complete after the
committed values have been planned and rendered. Commands or signal writes in
a milestone handler affect a later frame. When its component disappears, a
playback releases its commands, registration, leases, callbacks, and stepper
state; retained controls become inert.

## One frame transaction

Every animation and every affected root follows the same order:

1. **Begin** captures one logical time and drains accepted commands.
2. **Advance** samples every registered playback in stable order.
3. **Commit** atomically publishes outputs, status, and current time.
4. **Plan** validates computed dependencies and determines dirty boundaries.
5. **Render** repaints retained children before ancestors and then roots.
6. **Complete** finalizes ownership, delivers milestones and isolated errors,
   and requests another frame only when work remains.

Tween, keyframe, spring, and custom seekable definitions calculate from logical
time rather than accumulating display-frame deltas. A skipped display frame
jumps to the right value. Stateful steppers alone consume clamped fixed-step
elapsed input and replay those steps when seeking.

Pibbl exposes playback `seek`, not a public realm clock or history recorder.
Internal traces can explain phase, command, sample, invalidation, milestone,
and error order without changing behavior. Logical values and ordering are
deterministic within the documented bounds; browser Canvas pixels, fonts,
images, filters, shaders, GPU drivers, and cross-engine floating point remain
platform-owned.

## Rendering and Layer choices

For ordinary Canvas 2D content, a changed signal schedules one coalesced
immediate-mode root repaint. This is usually the fastest choice for simple
geometry because it avoids allocating and copying an offscreen bitmap.

Add an explicit `Layer` only when measurement shows that a repeatedly drawn
subtree is expensive and its child content is usually stable. A dirty Layer can
repaint before ancestor composition while clean sibling bitmaps are reused; a
parent-only placement, transform, alpha, or outer-filter animation may reuse
the Layer's clean bitmap. Pibbl never automatically promotes components to
offscreen surfaces. Diagnostics may recommend a boundary, but code retains the
decision.

External render layers, including `@pibbl/three`, use the same signals and
scheduler in lockstep. Continuous values belong in signals; sparse renderer
facts can become semantic events delivered in Complete. An embedded renderer
does not create a second animation loop. Worker or WASM numeric execution
remains future work and may ship only if its results, Commit atomicity,
stale-result rejection, lifecycle, and main-thread fallback remain
observationally identical.

Particle `acceleration`, `gravity`, `drag`, and related modules from
`@pibbl/core/particles` are closed population-domain descriptors. They tell a particle
executor how each emitted member moves; they are not a new general animation
system. Continue to drive component transforms, cameras, materials, lights,
and ordinary application values with signals and the animation definitions
described above. See [Create particle
effects](#/learn/guides/particle-effects).

For exact defaults, validation, repeat/overlap budgets, error isolation, and
teardown rules, read the [animation contract](../../../design/animation-contract.md)
and [signals and scheduling
contract](../../../design/signals-and-scheduling-contract.md).
