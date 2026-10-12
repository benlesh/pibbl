# Matter and motion

Pibbl gives Moose Riot something no CSS design system has: real particles, a real 2D solver,
flow fields that bend around physics bodies, and one scheduler that owns every frame. That
makes the brand's motion rules executable rather than aspirational — and it makes decorative
motion inexcusable, because the system is capable of meaning instead.

## The encoding test

**Each particle stands for something.** An event, a token, an execution, an evidence item, a
state, a relationship. Before writing an emitter, finish this sentence:

> One particle in this effect is one ______.

If you cannot finish it, you do not want particles. You want a texture (`@pibbl/core/textures`), a
chart (`@pibbl/core/viz`), or nothing. Decorative swirling fairy dust fails the brand contract no
matter how good it looks, and it quietly teaches the reader that the system's motion is
untrustworthy — which then costs you the effects that _do_ mean something.

Three consequences:

- **Count is a claim.** `capacity` and emission rate are quantitative statements. If 240
  particles stand for 2,400 events, say the ratio in a mono caption. Never generate a
  plausible-looking history by scaling a template to a current total.
- **Colour is the role.** Particles take the **fill** grades from `tokens.md`:
  observation `#F44F5D`, model `#F438A6`/`#FF5CB8`, healthy `#C8E928`, uncertain `#D89700`,
  anomaly `#FD7466`, inert `#A7A5A1`/`#7C7B77`. Use `particleGradient` for colour over life
  only when the _state_ changes over that life — uncertain resolving to healthy is a
  legitimate gradient; pretty-to-prettier is not.
- **`blend: "additive"` means light.** Reserve it for energy, inference and model
  internals. It also behaves very differently on a light canvas than a dark one, so if you
  use it, look at both modes before deciding it works.

## The seven behaviours

Every motion in this system is one of these. Name it in the decision record.

### Attraction — things gather toward a conclusion

```ts
motion: [
  {
    type: "radialAcceleration",
    center: [cx, cy],
    amount: particleRange(-260, -180),
  },
];
```

Negative amount pulls inward. Means: evidence converging on a finding, requests routing to
a service, tokens gathering into a model. Add `{ type: "drag", amount: 2.5 }` so arrivals
settle instead of overshooting and orbiting forever. `{ type: "orbit", center, degreesPerSecond }`
is the bound variant — something captured but not yet resolved.

### Repulsion — one cause, many consequences

```ts
emission: [{ type: "burst", count: 36, at: 0 }],
motion: [{ type: "radialAcceleration", center: [cx, cy], amount: particleRange(140, 320) }]
```

Positive amount pushes outward from the origin. Means: fan-out, rejection, a fork pushing
apart, a change propagating. Burst emission, not a rate — repulsion is an event, and a
continuous outward spray reads as decoration.

### Flow — throughput through a system

```ts
const field = useFlowField2D({
  bounds: { width, height },
  resolution: [48, 30],
  buoyancy: 0.4,
});
useFlowSource2D({
  position: [vx, vy],
  radius: 40,
  acceleration: [0, -120],
  heat: 0.6,
});
const system = useParticleSystem(effect, { flow: field });
```

Flow-bound particles use the field for translation, so put wind and lift on the **source**,
not on particle initial velocity or translational motion modules. Means: a pipeline carrying
work, load moving through a topology, anything where the _path_ is the information.

With `@pibbl/core/physics/2d`, `physicsObstacles2D(pibblPhysicsWorld2D())` feeds committed box,
ellipse and polygon geometry into the field, so flow bends around real bodies. Both systems
must use the same coordinates. The adapter copies numbers and does not push smoke forces
back into the world — it is one-way coupling, not a fluid solver. This is the strongest
"observable complexity" tool in the box: structure you cannot see becomes visible because
something flowing is deflected by it.

### Branching — a decision with outcomes

Several emitters sharing an origin with divergent initial velocity, or one `manual` emitter
fired per branch as the decision resolves:

```ts
system.emit("accepted", { position: [x, y] });
system.emit("retried", { position: [x, y] });
```

Means: a decision tree, retries, routing, a trace splitting. Label the branches in mono
near their paths, so the picture is readable without watching it happen. A degraded system
in this brand reads as a **trace you can no longer follow** — gaps, forks, lost edges — so
branching is also how failure should look. Not alarms.

### Collapse — many reduce to one

```ts
motion: [{ type: "radialAcceleration", center: [cx, cy], amount: -420 }, { type: "drag", amount: 4 }],
appearance: {
  size: particleCurve([[0, 9], [0.7, 8], [1, 0]]),      // PIXELS, not a multiplier
  opacity: particleCurve([[0, 1], [0.75, 1], [1, 0]]),
}
```

**An appearance curve replaces `initial.size`; it does not scale it.** The sampler returns
the curve value directly, in pixels, discarding the random initial size entirely - so a
`0.55 -> 1 -> 0.35` curve meant as a percentage draws sub-pixel dots. The repo's own
`particle-celebration-lab.example.tsx` has exactly this bug, so do not copy it. The same
applies to `appearance.opacity` and `appearance.rotationDegrees`. If you want variation in
final size, vary it through a parameter rather than `initial.size`.

Means: aggregation, resolution, a set reducing to an answer, a dismissal. The size and
opacity curves are what make it read as _becoming one thing_ rather than flying away. Keep
lifetimes short; collapse is a conclusion, and a slow one looks like indecision.

### Focus — the instrument resolving

High drag plus convergence, with opacity rising as the arrangement becomes legible:

```ts
motion: [{ type: "radialAcceleration", center: [cx, cy], amount: -200 }, { type: "drag", amount: 6 }],
appearance: { opacity: particleCurve([[0, 0.15], [0.6, 0.9], [1, 1]]) }
```

Means: uncertainty collapsing into a reading, a point cloud becoming a shape, the instrument
achieving a lock. This is the signature behaviour of **opaque → observable → intelligible**,
and the one place where a particle field is allowed to resolve into recognizable form — the
moose fill is its canonical use. The form must be _the_ form; the outline is invariant and
only its fill varies, so never approximate the mark with particles that nearly make it.

### Perturbation — a system under load

```ts
motion: [
  {
    type: "sway",
    amplitude: particleRange(3, 9),
    frequency: particleRange(0.4, 1.1),
  },
  { type: "drift", velocity: [particleRange(-6, 6), particleRange(-10, -2)] },
];
```

Means: noise, instability, load, unresolved uncertainty. Small amplitude, irregular
frequency. This behaviour should look slightly **uneasy** — that is its job. If you have
tuned it until it looks soothing, it is no longer reporting anything. It is also the honest
way to show an unknown: visible movement that has not settled, rather than a falsely precise
number.

## Physics is matter, not garnish

Use a body when weight, collision, contact or settling **is** the information: items with
real mass accumulating, a load-bearing comparison, a constraint you can feel. A decorative
bouncing ball spends the solver's credibility on nothing.

```tsx
const body = crcPhysicsBody2D();
<PhysicsWorld2D space="local" gravity={[0, 600]}>
  <Rectangle
    physics={staticBody2D()}
    style={{ left: 0, top: 320, width: 480, height: 12, fill: "#403F3C" }}
  />
  <Group
    physics={dynamicBody2D({ handle: body, mass: 1, collider: false })}
    style={{ translateX: 120, translateY: 40 }}
  >
    <Circle
      physics={collider2D({ restitution: 0.2, friction: 0.5 })}
      style={{ radius: 12, fill: "#F44F5D" }}
    />
  </Group>
</PhysicsWorld2D>;
```

The things that trip people up:

- **Pibbl owns the clock.** 60 fixed ticks/second with bounded catch-up. Never start another
  `requestAnimationFrame` loop and never step the engine yourself.
- **The attachment owns the transform.** Do not read a position and write it into `style`
  each frame; Pibbl writes the interpolated pose into the component's presentation. For
  out-of-band reads use `inspectPhysics2D(world)`, which returns a frozen snapshot.
- **No joints or constraints exist.** Compose with a compound body — a `Group` carrying
  `dynamicBody2D({ collider: false })` with child `collider2D` attachments. If a design needs
  a hinge or a spring between bodies, that is a real gap: say so rather than faking it with
  per-frame forces.
- **Restitution is a material claim.** Glass is light and rigid: it slides, it does not
  bounce. Keep restitution low on anything that represents a Glass object. High restitution
  belongs to things that are explicitly not glass.
- Queries — `raycast2D`, `shapeCast2D`, `overlapShape2D`, `queryPoint2D` — and the pure
  `@pibbl/core/physics/2d/geometry` helpers let a scene _answer_ a question about its own matter.
  That is observability, and it is usually more interesting than more motion.

## Choreograph one event

Specify **trigger → owner → meaning → settle** for every motion, and write it in the
decision record.

- **Trigger:** a user action or a state change. Never "on load" for anything that isn't a
  one-time introduction.
- **Owner:** the single element the motion belongs to. Hover strengthens an edge _within its
  owner_; it does not light the header, the parent card and every child control together.
- **Meaning:** the specific change being expressed. A nudge for direction, a brief pulse for
  confirmation, a slide for selection, a loop **only** while something is unresolved.
- **Settle:** the resting state it returns to. At rest the picture is quiet.

Coordinate timings instead of starting unrelated animations. `sequence`, `parallel`, `wait`
and `marker` exist so one playback can own a whole short event, and `marker` is how a later
step keys off an earlier one rather than guessing with a delay:

```tsx
const player = usePlayback(
  sequence(
    parallel(
      drive(
        x,
        tween({
          from: -24,
          to: 0,
          duration: 200,
          easing: easing.cubicBezier(0, 0, 0.2, 1),
        }),
      ),
      drive(opacity, tween({ from: 0, to: 1, duration: 200 })),
    ),
    marker("arrived"),
  ),
  {
    onEvent: (event) => {
      if (event.type === "marker") system.emit("confetti");
    },
  },
);
```

**`system.emit()` is illegal from a reaction.** Emission asserts the active signal-write
policy, and reaction setup runs under `withSignalWriteForbidden`, so emitting there throws.
`playback.play()` only queues a Begin command and is legal, so the working chain is
reaction -> `usePlayback` -> a Complete-phase `marker` event -> `system.emit`. Also:
`emit` with `count: 0` throws, so guard empty buckets, and `stop({ mode: "clear" })` leaves
the system finished - `restart()` is the revive path.

Use `play({ conflict: "replace" })` for a re-triggerable event, and prefer `spring` for any
value a person can interrupt — it resolves from current velocity, where a tween restarts and
reads as a glitch. Durations and curves are in `tokens.md`. Continuous motion belongs only to
a continuing state: a busy loop stops when the operation resolves, and an ambient drift
belongs to a field that is genuinely still being observed.

## Reduced motion

**Pibbl does not handle this for you.** Size queries explicitly exclude reduced-motion
detection, so read it yourself and branch:

```tsx
const still = useConst(() =>
  matchMedia("(prefers-reduced-motion: reduce)"),
).matches;
```

Then: jump to final values instead of tweening, do not autoplay particle effects (`autoplay:
false`, or `pause()` after a single settled frame), pause texture fields, and keep physics
either static or absent. What must **survive**: state, selection, focus, and the meaning the
motion was carrying. If a particle field was the only thing communicating uncertainty, the
reduced-motion version needs a static distribution or range that says the same thing. An
instrument that only works when animated is not an instrument.

A screenshot cannot certify any of this. Use timed captures or computed state — see
`evidence.md`.
