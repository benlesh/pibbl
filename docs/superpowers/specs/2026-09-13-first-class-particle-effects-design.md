# First-class particle effects design

> **Historical status: APPROVED DESIGN RECORD.** This document records the
> approved design; current shipped behavior remains governed by `docs/design/`
> until implementation lands.

Status: design approved in conversation on 2026-09-13; written-spec review
pending.

Date: 2026-09-13

## Summary

CRC will add an optional official `@crc/particles` package for high-performance
Canvas2D and WebGL particle effects. Particles are components backed by
immutable effect definitions, not style effects and not one component per
particle.

The public model has three layers:

1. immutable 2D or 3D effect definitions describe emitters, ranges, curves,
   motion, appearance, and renderers;
2. an optional component-owned `crcParticleSystem` handle owns one live run,
   commands, status, parameters, and scheduler participation; and
3. `Particles2D` or `Particles3D` binds that run to one visual location and one
   backend.

Simple effects use `<Particles2D effect={effect} />` or
`<Particles3D effect={effect} />`; the component owns an implicit system.
Interactive or observed effects create an explicit `crcParticleSystem(effect)`
and pass it through the mutually exclusive `system` prop.

Canvas2D executes an allocation-free CPU paint path and may use an explicit CRC
`Layer` to isolate unrelated static drawing. WebGL particles are settled-scene
contributors. They issue no WebGL commands during component composition.
`WebGLLayer` settles their effective transform, opacity, material, depth,
transparency, lighting, post-processing, batch, and pass dependencies with the
rest of the scene before rendering and atomically committing the completed
bitmap and interaction snapshot.

The first implementation project proves immutable definitions, component-owned
systems, stateless analytic execution, Canvas shape/sprite drawing, and WebGL
point/billboard instancing. Stateful CPU simulation, GPU transform-feedback
simulation, collisions, trails, sub-emitters, and advanced emission sources are
separate staged projects on the same architecture. Presets are optional
tree-shakable factories returning ordinary definitions, never a second runtime.

## Context and evidence

The supporting use-case and implementation research is recorded in
`docs/strategy/particle-effects-research.md`. The strongest repeated uses are:

- celebration and feedback: confetti, sparkles, click bursts, success moments,
  and short transitions;
- ambient and environmental effects: snow, rain, dust, embers, smoke, fire,
  stars, and drifting backgrounds;
- motion-attached effects: exhaust, contrails, speed streaks, moving dust, and
  pointer trails; and
- impact and energy effects: sparks, explosions, fireworks, magic, pulses, and
  short-lived debris.

These effects share a smaller vocabulary than a general game engine: emission,
seeded ranges, emitter shapes, finite lifetime, simple analytic motion,
over-life curves, sprites or billboards, blending, fixed capacity, and explicit
bounds. The design deliberately stops before entities, a retained simulation
world, arbitrary per-particle callbacks, rigid bodies, fluid simulation, or a
visual graph editor.

The WebGL design depends on the approved
`docs/superpowers/specs/2026-09-13-webgl-settled-scene-rendering-design.md`.
Particles extend its scene-entry and renderer model; they do not restore the
removed immediate raw-GL model. The WebGL particle implementation must follow
the settled-scene implementation and the ordinary unlit/emissive material
contract. Lit mesh particles follow the later lighting/material project.

## Goals

- Cover the common 2D and 3D effects listed above without becoming a general
  physics or entity system.
- Make particles feel like CRC components while keeping individual particles
  outside CRC component identity, hooks, focus, and event semantics.
- Support simple declarative mounting and controlled repeated bursts through
  one runtime model.
- Compile compatible effects to stateless analytic execution on both backends.
- Make stateful execution an explicit capability with predictable CPU and GPU
  costs.
- Allocate declared particle storage once and perform zero steady-state
  per-particle JavaScript allocation.
- Use CRC's realm scheduler and logical time; create no independent animation
  loop.
- Preserve deterministic seeding, command order, completion, ownership, and
  teardown.
- Let `Particles2D` participate in normal Canvas layout, transforms, clipping,
  filtering, layering, and paint order.
- Make `Particles3D` participate in one complete settled WebGL scene, including
  opacity, depth, transparency, culling, lighting/material intent, and
  post-processing.
- Provide explicit quality and execution choices instead of silently changing
  capacity or behavior based on frame timing.
- Support tree-shakable canned configurations after their underlying modules
  have proving scenarios.
- Reserve a narrow future integration seam for collision fields from a separate
  physics package.

## Non-goals

- One JSX element, component instance, hook slot, ref, handler, focus target, or
  semantic node per particle.
- A retained mutable particle scene graph or entity-component system.
- General rigid-body, constraint, joint, collision-world, cloth, fluid, flocking,
  SPH, or arbitrary N-body simulation.
- Arbitrary per-particle JavaScript callbacks in a steady-state hot loop.
- Public raw GLSL, WebGL context access, or render-pass plugins in the first
  surface.
- Synchronous GPU readback, a public mutable particle array, or a universally
  exact GPU `activeCount`.
- Exact Canvas/WebGL, browser/browser, or CPU/GPU pixel and floating-point
  identity.
- Automatic collision against Canvas pixels or arbitrary CRC drawing geometry.
- Automatic hidden WebGL acceleration for a Canvas2D component.
- Automatic worker transfer of a root or Layer Canvas.
- Sampling depth from Canvas content or a different WebGL island.
- An implicit adaptive-quality algorithm that changes output from observed
  wall-clock performance.
- A serialized visual-asset format or particle editor before the runtime model
  is proven.
- Making ordinary CRC animation or `@crc/webgl` responsible for particle-domain
  motion vocabulary.

## Why particles are components, not styles

A style changes the presentation of output produced by a component. A particle
system owns time, emission, a finite population, storage, scheduler requests,
completion, commands, and resources. It may continue running after the values
that mounted it stop changing.

Putting the effect in `style` would make these materially different changes
indistinguishable:

- moving or resizing the mounted component;
- changing a render-only tint or opacity parameter;
- changing a spawn-only value used by future particles;
- changing a live simulation value used by living particles;
- replacing a definition whose storage or shader layout differs;
- restarting the run; and
- stopping emission while allowing live particles to drain.

`style` remains useful at the component boundary. `Particles2D` uses ordinary
box, layout-item, transform, opacity, clip/filter, cursor, and interaction
presentation supported by core. `Particles3D` uses the settled WebGL transform
and opacity style. Emission, lifetime, forces, curves, sprites, billboards,
blend mode, depth behavior, capacity, and overflow belong to the immutable
effect definition.

## Package and export boundaries

One optional workspace package, `packages/particles`, publishes these entry
points:

### `@crc/particles`

Runtime values:

- `defineParticleEffect2D`;
- `particle`;
- `crcParticleSystem`; and
- `Particles2D`.

Public types include the named 2D effect, emitter, emission, shape, value,
curve, gradient, motion, appearance, renderer, parameter, system, status,
execution, diagnostics, component-prop, bounds, burst-override, callback, and
error types defined by this design.

The root entry depends on `@crc/core` and does not import, require, or expose
`@crc/webgl`.

### `@crc/particles/webgl`

Runtime values:

- `defineParticleEffect3D`; and
- `Particles3D`.

It reuses `particle` and `crcParticleSystem` from the root entry and exports the
named 3D effect, emitter, shape, motion, appearance, renderer, bounds,
component-prop, and execution-capability types.

This entry requires the matching official `@crc/webgl` package and participates
through a version-coupled `@crc/webgl/internal` friend seam. That seam is for
matching official CRC renderer packages, is not re-exported from the WebGL root,
and is not an application compatibility promise. It permits CPU-owned scene
submissions and renderer-owned resource recipes; it never exposes a
`WebGL2RenderingContext` during component composition.

### Preset entry points

- `@crc/particles/presets` exports Canvas-compatible preset factories.
- `@crc/particles/presets/webgl` exports WebGL-specific preset factories.

Preset modules remain separately tree-shakable. Importing the base particle
entry does not load preset code or assets. Presets return ordinary frozen effect
definitions and use the same components, controller, validation, execution,
errors, and teardown as handwritten definitions.

The package adds no JSX runtime, element constructor, Fragment, scheduler,
signal vocabulary, event vocabulary, or Canvas/WebGL context surface. Every
entry uses `@crc/core`'s automatic JSX runtime and exact nominal element
identity. Packed Bundler and NodeNext consumers must resolve one `@crc/core`
identity and matching CRC package versions.

## Immutable effect definitions

`defineParticleEffect2D(input)` returns a nominal immutable
`CRCParticleEffect2D<EmitterNames, Parameters>`. `defineParticleEffect3D(input)`
returns the corresponding nominal `CRCParticleEffect3D`.

Construction synchronously:

1. validates the complete input;
2. copies every caller-owned array and mutable record;
3. normalizes defaults and colors;
4. validates curves, gradients, shapes, capacities, and module conflicts;
5. derives emitter-name and parameter metadata;
6. classifies which execution tiers can preserve the declared semantics;
7. derives conservative bounds where possible; and
8. deeply freezes and brands the normalized definition.

Definitions own no clock, scheduler registration, Canvas surface, decoded-image
cache, shader, program, texture, buffer, vertex array, transform-feedback
object, bitmap, or interaction target. Stable source assets may be referenced,
but backend resources belong to the bound executor or owning WebGL context
generation.

An effect contains one or more ordered emitters. Emitter names are nonempty and
unique within the effect. The inferred name union types `system.emit(name)`.
Random streams derive from the effect seed, stable emitter name, spawn ordinal,
and channel identifier; inserting or reordering a different emitter does not
change another named emitter's random sequence.

Each emitter declares:

- `name`;
- `capacity`;
- `overflow`;
- `space`;
- `emission` sources;
- one `shape`;
- initial per-particle values;
- ordered motion modules;
- over-life appearance;
- one renderer in the first delivery; and
- finite explicit or compiler-derived bounds.

One renderer per emitter preserves a simple batching contract. A layered effect
uses multiple named emitters. Multiple renderers over one simulated population,
ribbons, and trails are later extensions.

## Value language, curves, and parameters

The frozen `particle` helper creates closed immutable descriptors. Helpers are
authoring conveniences, not live components and not WebGL primitives.

Spawn values support:

- a finite constant;
- `particle.between(min, max)` for a seeded continuous range;
- `particle.integer(min, max)` for an inclusive seeded integer range; and
- `particle.choice([{ value, weight }, ...])` for a seeded weighted choice.

Over-life values support:

- `particle.curve([[time, value], ...], options?)`; and
- `particle.gradient([[time, color], ...], options?)`.

Curve time is normalized particle lifetime from `0` through `1`. Keys must be
finite and monotonically increasing and must cover both endpoints after
normalization. Duplicate times, empty curves, nonfinite samples, invalid colors,
or incompatible value dimensions reject during definition construction.

Curve segments may use `CRCEasing`. Definition construction samples an easing
into a fixed immutable lookup table, validates every sample, and lets Canvas and
WebGL interpolate that table. No user easing callback runs per particle or in a
shader. The table resolution and interpolation rule are fixed by the public
contract and tested within a numeric tolerance.

The separate animation surface may add generally useful sine, power, back,
elastic, and bounce easing families. Particles consume the same public easing
values but do not require a particle-specific duplicate family.

Definitions may declare named parameters with a finite default, public value
type, and one timing category:

- `"spawn"`: snapshotted only when a new particle is emitted;
- `"simulation"`: read by living particles at each applicable fixed step or
  analytic sample; or
- `"render"`: changes appearance without changing particle state.

A definition references a parameter through `particle.parameter(name)`. The
binding component accepts a type-inferred `parameters` record. Parameters are
ordinary values, so authors expose reactive values through explicit signal
reads:

```tsx
const wind = signal<[number, number]>([0, 0]);

<Particles2D
  effect={snowfall}
  parameters={{ wind: wind.get() }}
  style={{ width: 1280, height: 720 }}
/>;
```

Unknown, missing-required, dimensionally invalid, or nonfinite parameter values
reject before adoption. A successful component render adopts the new parameter
snapshot. A failed render leaves the previous committed snapshot intact.

## Emission and capacity

The initial closed emission vocabulary includes:

- rate over logical time;
- scheduled bursts;
- manual named bursts;
- a finite emission interval;
- finite looping with an explicit repeat count; and
- deterministic probability and value ranges.

Rate is particles per logical second. Burst time is milliseconds from one run's
logical start. A fractional rate accumulator is deterministic and does not
assume a display refresh rate. The definition compiler may replace compatible
rate/burst schedules with a stateless birth-time formula.

Manual emission is addressed by the emitter name:

```ts
system.emit("impact", {
  count: 60,
  position: [event.x, event.y],
});
```

Burst overrides are closed and typed. They may supply count, local/world origin
where supported, seed salt, and declared spawn-parameter overrides. They cannot
replace capacity, renderer, storage layout, arbitrary per-particle attributes,
or shader behavior.

Capacity is a positive finite safe integer and a resource commitment. It is
declared per emitter and allocated once per bound executor. Overflow defaults
to `"reject-newest"`; `"recycle-oldest"` is explicit. A rejected burst is
reported in Complete with requested and accepted counts. It is never partially
hidden from diagnostics.

Changing definition identity may change capacity or storage layout and restarts
the run only after the new component render succeeds. A separate `quality`
parameter or preset option may lower emission and visual density without
silently reallocating capacity.

## Shapes and coordinate spaces

Initial 2D emitter shapes are:

- point;
- line segment;
- rectangle interior or edge;
- circle interior or circumference; and
- ring with finite inner and outer radii.

Initial 3D shapes are:

- point;
- line segment;
- box volume or surface;
- sphere volume or surface;
- ring/disc; and
- cone volume or surface.

Sampling is uniform for the declared measure. Circle and sphere volume sampling
must not cluster toward the center. Invalid dimensions, negative radii, an
inner radius larger than its outer radius, or a zero direction vector reject at
definition construction.

The first stateless delivery supports local simulation space. Local particles
continue following the mounted component's current transform. Stateful CPU work
adds world simulation space, moving-emitter transform history, inherited
velocity, and distance emission. World-space spawn snapshots the emitter
transform at the accepted birth time; later emitter motion does not move
existing particles.

Canvas coordinates use the component's upright local logical space. The 3D
coordinate convention matches the owning WebGL scene and camera contract.

## Particle-domain motion, not WebGL animation

`acceleration`, `gravity`, `drag`, `radialAcceleration`, `orbit`, and `sway` are
particle-effect descriptors. WebGL does not standardize animation, velocity,
acceleration, force, gravity, or a simulation clock. It standardizes the GPU
rendering machinery that CRC may use to execute compiled particle math.

For a compatible constant acceleration, a stateless executor can evaluate:

```text
position(t) = initialPosition + initialVelocity*t + 0.5*acceleration*t*t
```

Canvas evaluates it in a tight numeric loop. A WebGL vertex shader evaluates the
same descriptor per instance from logical time, seed, and birth time. A later
stateful executor integrates position and velocity through bounded fixed steps
on the CPU or through a scheduled transform-feedback pass on the GPU.

CRC uses `acceleration` rather than `force` when no particle mass exists. Calling
the value a force would imply `F = m*a` semantics that this focused effect system
does not model. `gravity` is an ergonomic constant-acceleration alias with
dimension-specific direction rules.

The initial stateless-compatible motion set is:

- constant acceleration/gravity;
- analytic drag;
- linear drift;
- radial velocity or acceleration around a fixed point;
- analytic orbit;
- analytic sway; and
- angular velocity.

Definition construction owns one fixed phase order:

```text
emission -> shape -> initial values -> analytic motion -> appearance -> renderer
```

Modules within a phase retain declaration order only when their operation is
mathematically composable. Two modules that ambiguously write the same
attribute reject instead of using hidden last-write-wins behavior.

Noise/turbulence, changing attractors, pointer fields, collisions, constraints,
sub-emitters, and arbitrary custom integration require a later stateful tier.
The compiler never silently approximates them as stateless motion.

This vocabulary does not expand general CRC animation. Ordinary component,
transform, camera, and material animation continues to use signals with
`tween`, `keyframes`, `spring`, `defineAnimation`, or `stepper`. Core's existing
`stepper` is already the extension point for acceleration, velocity,
constraints, and similar fixed-step integration of a small number of ordinary
application values. Particle execution applies a closed operation over a packed
population and may compile it into shader math; it has different ownership,
storage, observability, and performance constraints.

## Appearance and renderers

Common initial attributes are:

- position and velocity;
- age and lifetime;
- scalar or vector size;
- rotation and angular velocity;
- color and opacity;
- sprite-atlas frame; and
- stable private random channels.

Over-life appearance supports size, rotation, color, opacity, and atlas frame.
Custom public per-particle attributes are deferred because every attribute
changes packed storage, upload layout, shader interfaces, diagnostics, and GPU
capability.

### Canvas2D renderers

The first renderer union includes:

- circle;
- rectangle;
- immutable `Path2D` shape;
- decoded image sprite;
- pre-rasterized text or emoji sprite; and
- texture-atlas frame.

The initial blend modes are `"source-over"` and `"additive"`, which maps to
Canvas `lighter`. The executor groups live particles by renderer, blend mode,
source image, and atlas page while preserving declared emitter order where
blending requires a deterministic tie.

Repeated paths, text, emoji, and complex shapes use tight executor-owned raster
caches. The executor may cache a bounded set of useful sizes. It does not scale
or allocate a new source surface for every particle every frame.

### WebGL renderers

The initial renderer union includes:

- point sprite;
- camera-facing billboard;
- velocity-stretched billboard; and
- texture-atlas frame.

Mesh instances follow after the billboard path and ordinary scene-material
contract are proven. Ribbons, trails, and multiple renderers over one simulated
population are later extensions.

The definition declares material intent rather than executing a material:

- unlit alpha;
- unlit additive;
- cutout; and
- emissive once the scene HDR/emissive contract is available.

The scene owns final interpretation. Effective opacity combines ancestor/group
opacity, component/renderer opacity, and per-particle color alpha exactly once.
Settlement classifies the submission into cutout, alpha-transparent, additive,
or later emissive work; resolves depth test and depth-write behavior; and orders
it relative to all other scene submissions.

Unlit or emissive is the initial particle scope. Smoke, fire, sparks, magic,
stars, and UI-like effects do not need scene lighting. Later lit billboards and
mesh debris use the ordinary scene material and light contracts. Billboard
lighting needs an explicit camera-facing normal; mesh particles require geometry
normals. Particle code never owns a private bloom pass: emissive output feeds the
scene's HDR/bloom pipeline.

## Public component model

`Particles2D` and `Particles3D` accept exactly one of two modes.

### Implicit system mode

```tsx
<Particles2D
  effect={snowfall}
  autoplay
  parameters={{ wind: wind.get() }}
  pointerEvents="none"
  style={{ width: "100%", height: "100%" }}
/>
```

The component owns one implicit run in its hook/component slot. Mounting with
`autoplay` schedules play. Removal tears it down. There is no imperative handle
outside the component.

### Explicit system mode

```tsx
const system = crcParticleSystem(impactSparks, {
  autoplay: false,
  seed: 42,
});

return (
  <Particles2D
    system={system}
    parameters={{ intensity: intensity.get() }}
    pointerEvents="auto"
    onPointerDown={(event) => {
      system.emit("impact", {
        position: [event.x, event.y],
        count: 60,
      });
    }}
    style={{ width: 640, height: 360 }}
  />
);
```

`effect` and `system` are statically and dynamically mutually exclusive.
`autoplay`, seed, and controller-level lifecycle options belong to the implicit
mode or the `crcParticleSystem` options, never both.

One live system may bind to only one backend component. A second concurrent
binding rejects before acquiring storage or renderer resources. This avoids
undefined multiple-renderer, multiple-scene, and simulation ownership. A system
may bind again after the previous binding is successfully removed.

`Particles2D` has no intrinsic size and requires a finite declared allocation.
Its effect bounds are local paint/culling bounds, not layout measurement. It
participates in ordinary Canvas source paint order. A nonempty core filter
captures the combined particle raster as one primitive output.

`Particles3D` is valid only inside `WebGLLayer`. It participates in current
`Group3D` ancestry and the scene camera. It accepts no Canvas filter; authors
filter the completed `WebGLLayer` from core. A high-count screen-space WebGL
particle surface may be designed later, but CRC does not create an implicit
hidden WebGL context behind `Particles2D`.

## System handle, commands, and status

The stable handle is:

```ts
interface CRCParticleSystem<EmitterName extends string> {
  readonly status: Signal<CRCParticleSystemStatus>;
  readonly execution: Signal<CRCParticleExecution>;

  play(): void;
  pause(): void;
  resume(): void;
  restart(options?: { seed?: number }): void;
  emit(emitter: EmitterName, options?: CRCParticleBurstOverrides): void;
  stop(options?: { mode?: "drain" | "clear" }): void;
}
```

Status values are:

- `"idle"`;
- `"scheduled"`;
- `"running"`;
- `"paused"`;
- `"draining"`;
- `"finished"`; and
- `"disposed"`.

Execution values are capability-qualified:

- `"unbound"`;
- `"stateless-canvas"`;
- `"stateful-canvas"`;
- `"stateless-webgl"`;
- `"stateful-cpu-webgl"`; and
- `"stateful-gpu-webgl"`.

Commands use the same admission discipline as animation playback commands. They
enter the next eligible Begin phase in invocation order and do not mutate
signals or particle storage synchronously. Calling a command from a forbidden
component, computed, primitive-render, or Advance evaluation reports the
corresponding guarded-write error.

`pause` freezes effect logical time and accepts no automatic rate/scheduled
births. The contract for manual bursts while paused is reject with a Complete
diagnostic; callers resume before emitting. `restart` clears all living
particles, resets deterministic ordinals, adopts the supplied or original seed,
and begins a fresh run. `stop({ mode: "drain" })` closes every future emission
source and finishes after the live population reaches zero.
`stop({ mode: "clear" })` clears the population at the next transaction and
finishes immediately after that successful commit.

A finite scheduled effect finishes when no future automatic birth exists and
all accepted particles have expired. A looping rate is infinite until stopped.
A manual emitter remains command-capable and does not finish implicitly;
`stop` closes it. A system with only manual emitters may remain idle until its
first accepted burst.

Stale controls become inert after disposal. Commands queued by a removed or
replaced owner are canceled exactly once. No command can resurrect a disposed
system.

## Callbacks and diagnostics

Component props or system options may observe effect-level milestones:

- start;
- accepted or rejected manual burst;
- drain start;
- finish; and
- isolated runtime error.

Callbacks are queued in deterministic order and delivered in Complete after the
corresponding successful frame transaction. Application callbacks cannot
interrupt Advance, settlement, simulation passes, rendering, or publication.
There are no per-particle birth, update, death, or collision callbacks in the
base surface.

The base handle deliberately has no exact `activeCount`. Canvas and CPU-stateful
executors may expose an opt-in exact diagnostic. Stateless and GPU-stateful
executors may expose capacity, conservative live range, accepted/rejected burst
counts, selected execution, draw/batch counts, and capability reasons. They do
not perform readback to satisfy diagnostics.

Errors distinguish:

- invalid frozen definition construction;
- unsupported definition capability for the required execution tier;
- invalid or missing assets;
- binding the same live system twice;
- backend/context mismatch;
- capacity or burst rejection;
- scene composition or settlement failure;
- Canvas or GPU execution failure; and
- disposed/stale ownership.

Messages identify the effect, emitter, module, parameter, renderer, component,
and JSX source where available. Errors never expose raw platform shader logs
without the existing sanitization rules.

## Scheduler integration

Particle work uses the existing realm Begin, Advance, Commit, Plan, Render, and
Complete phases:

| Phase    | Particle responsibility                                                                                                                                                           |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Begin    | Accept ordered play, pause, resume, restart, emit, stop, clear, and parameter-adoption commands.                                                                                  |
| Advance  | Advance logical time; update stateful CPU candidate storage or stage the interval required by WebGL simulation.                                                                   |
| Commit   | Atomically publish status, execution, and observable CPU-side results.                                                                                                            |
| Plan     | Dirty only the bound root or managed Layer/WebGLLayer and its required composition ancestors.                                                                                     |
| Render   | Draw Canvas particles. For WebGL, compose submissions, settle the complete scene, execute simulation dependencies and scene passes, and produce one candidate island transaction. |
| Complete | Adopt successful resource/state generations and deliver milestones or isolated errors in stable order.                                                                            |

One running system owns one scheduler registration, never one per emitter or
particle. All timing uses CRC's realm logical timestamp. Time-based stateless
effects sample that timestamp directly; dropped display frames jump to the
correct analytic sample. Stateful effects consume bounded fixed steps, retain
or explicitly discard the remainder according to the public step policy, and
never integrate an unbounded hidden-tab gap.

Active systems request future frames only while automatic emission, living
particles, draining, or pending commands require work. A finished, cleared,
paused-without-pending-work, or unbound system does not keep the realm awake.

## Stateless execution

The preferred first tier assigns each potential particle a stable slot and
spawn ordinal. Seeded hashes derive private random channels. The emission
schedule derives birth time and lifetime. At logical time `t`, a particle is
live when its birth time is not later than `t` and `t` is earlier than birth plus
lifetime.

Compatible position, rotation, size, color, opacity, and atlas frame are
reconstructed from birth data and normalized lifetime. This provides:

- no per-frame integration storage;
- no free-list churn for looping effects;
- no accumulated numeric drift;
- deterministic replay and cheap restart;
- straightforward prewarm;
- zero per-particle CPU update and dynamic upload for WebGL; and
- the same semantic definition for Canvas and WebGL.

The compiler exposes whether a definition is stateless-compatible. It rejects,
rather than approximates, world-space transform history, distance emission,
collisions, arbitrary callbacks, changing attractors, neighbor interactions, or
other stateful requirements.

## Canvas2D execution

Canvas does not provide a portable contract that CRC can use to require,
measure, or report GPU acceleration. `Particles2D` therefore promises algorithmic
efficiency rather than a GPU execution label.

The stateless Canvas executor:

- loops over the conservative potentially-live slot range;
- derives each live particle into local numeric registers;
- performs no steady-state per-particle object or array allocation;
- groups renderer state where it preserves paint semantics;
- uses cached tight rasters for repeated complex sources;
- draws only within finite conservative bounds; and
- restores Canvas state in `finally` after success or failure.

The later stateful Canvas executor uses preallocated structure-of-arrays storage,
free/live index structures without `Array.splice`, and bounded fixed steps.

An animated top-level `Particles2D` causes an ordinary immediate-mode root
repaint. Authors may place it in an explicit core `Layer` to preserve unrelated
static content, but the particle layer itself still repaints and composites.
CRC never auto-promotes a particle component to a Layer. Tight and full-viewport
scenarios determine whether isolation is beneficial.

Workers are deferred. A transferred `OffscreenCanvas` conflicts with the
current synchronous scheduler, paint order, event ownership, and surface
contract. A future worker design needs its own bitmap transaction and exact
teardown semantics.

## WebGL settled-scene execution

`Particles3D` is an official scene contributor. During component composition it
validates CPU values, obtains its logical target slot when requested, snapshots
its current model ancestry, and appends one or more CPU-owned particle
submissions. It performs no framebuffer clear, program compilation, resource
creation, buffer upload, texture upload, simulation pass, or draw.

A submission contains or owns:

- diagnostic component/effect/emitter identity;
- stable source index;
- copied composed model matrix;
- finite conservative bounds;
- interaction participation and explicit navigation bounds, if any;
- definition and compiled-plan keys;
- logical time, seed, capacity, and parameter snapshot;
- renderer/material intent;
- texture/atlas source identity;
- depth, blend, and per-particle sorting policy; and
- an optional renderer-owned stateful simulation dependency.

Settlement closes the scene and resolves:

- effective transforms and opacity;
- frustum culling;
- unlit/emissive material and light bindings;
- cutout, alpha-transparent, additive, and later emissive pass classification;
- depth-test and depth-write state;
- particle-internal and scene-object transparent ordering;
- compatible batch keys;
- simulation-before-draw pass dependencies;
- pick/focus metadata from explicit system bounds; and
- post-processing participation.

Only the completed immutable scene snapshot reaches the renderer. Lights or
environment declarations appearing later in JSX can affect a particle
submission. Component source order remains identity, event ancestry, focus
order, and an exact tie-breaker—not the default 3D visibility model.

The stateless WebGL path uses a static point or quad and one instance per
potential particle. The vertex shader receives logical time, seed, birth data,
effect parameters, and instance index and reconstructs live state. Compatible
submissions use one instanced draw per settled batch. Only small effect-level
uniforms change per frame.

The first implementation does not promise batching across distinct mounted
systems. The planner may merge compatible submissions later only when ownership,
transforms, material behavior, deterministic order, and diagnostics remain
exact. It never merges merely to satisfy a draw-count metric.

Continuous particles invalidate their owning `WebGLLayer` every required frame.
The completed WebGL image still transfers as one `ImageBitmap` into Canvas paint
order, so scene composition, settlement, simulation/draw, bitmap transfer, and
Canvas composition all belong in performance measurement.

## Stateful CPU and GPU execution

Stateful CPU execution is the second implementation project. It adds:

- packed position, velocity, age, lifetime, size, rotation, color, and private
  module storage;
- world-space moving emitters and transform history;
- inherited emitter velocity;
- distance emission;
- pointer attract/repel fields;
- bounded/wrap behavior;
- simple analytic colliders; and
- velocity-stretched sprites.

Canvas draws that packed state directly. WebGL performs one packed dynamic
upload per settled compatible batch. CPU state remains exactly inspectable
without GPU readback.

Stateful GPU execution is a separate third project. It uses ping-pong
transform-feedback generations and supported built-in modules only. The scene
planner registers simulation as an explicit pre-draw dependency. The renderer
writes a candidate generation, draws from it, and promotes it only when the
complete island bitmap/pick transaction commits.

GPU execution is not universally preferred. The binding option is
`execution="auto" | "cpu" | "gpu"` for stateful WebGL-capable effects:

- `"gpu"` requires an exact supported GPU plan and rejects before publication
  when unavailable;
- `"cpu"` requires the CPU plan; and
- `"auto"` may select either only when both preserve the declared public
  semantics and capacity.

Automatic selection cannot lower capacity, remove modules, change quality,
disable collisions, or otherwise modify visible semantics. The selected result
is published through `system.execution` with capability-qualified diagnostics.

## Transparency, sorting, and soft particles

Per-particle sorting is explicit:

- `"none"` is fastest and recommended for additive or order-insensitive marks;
- `"oldest-first"` and `"youngest-first"` use stable particle ordinals; and
- `"distance"` is optional, capacity-limited, and reports its CPU/GPU support.

The particle executor owns order inside one submission. The settled scene owns
order between particle submissions and every other transparent object. Alpha
submissions sort through the scene's transparent policy; additive submissions
usually require no internal sort. An explicit scene render-order escape hatch
may be designed with the ordinary WebGL renderer for overlays and ambiguous
coplanar content, not particles alone.

Soft particles against geometry depth in the same `WebGLLayer` are technically
possible after the scene deliberately exposes a sampleable resolved-depth
resource. They remain an advanced feature. A particle cannot sample depth from
Canvas content, an ancestor Canvas Layer, or another WebGL island.

## Bounds, culling, and interaction

Every emitter has finite conservative bounds, either derived by the compiler
for supported analytic shapes/motion or explicitly supplied by the author.
Definitions that require dynamic or unbounded motion and lack explicit bounds
reject. GPU bounds never perform implicit readback.

`Particles2D` defaults to `pointerEvents="none"`. If enabled, its target is the
declared component box or explicit fixed interaction path, never the changing
visible particle silhouette. `Particles3D` also defaults to decorative
participation. If enabled, it requires an explicit local bounds volume whose
projected scene bounds participate as one logical target.

There is no per-particle hit test, target, cursor, pointer capture, focus target,
or navigation item. A pointer-driven force reads root-logical coordinates from
an ordinary component listener into a parameter or stateful field; it is not
particle hit testing.

Particle systems are not focusable or semantic by default. If particles depict
individually selectable data, the application needs a retained data-mark
component with stable identity and accessibility semantics instead.

## Resource ownership and failure transactions

The component-owned system owns:

- command queue and status signals;
- logical run, seed, ordinals, and parameter snapshot;
- scheduler registration;
- one binding lease;
- component callbacks; and
- CPU-side stateful storage where selected.

`Particles2D` owns its Canvas executor, decoded/raster asset caches, and any
backend-local scratch storage. One CRC instance owns reusable transient surfaces
where existing core composition already provides them.

`WebGLLayer` owns all programs, textures, buffers, vertex arrays,
transform-feedback objects, framebuffers, and render targets through its exact
context generation and transactional renderer cache. `Particles3D` owns no raw
GPU handle reachable from application or component code.

GPU simulation uses committed and candidate generations. Failed component
composition discards submissions without GPU work. Failed settlement,
simulation, drawing, bitmap transfer, or Canvas composition:

- closes the candidate scene and resource transaction;
- deletes candidate-only GPU handles;
- does not promote candidate particle state;
- does not publish the candidate bitmap, picker, or focus metadata;
- retains the previous committed generation where the broader fail-closed root
  contract permits; and
- releases every queued target, callback, and resource lease exactly once.

Definition or parameter candidates adopt only after successful component
render. Removal, key replacement, failed root render, context loss, layer
removal, or disposal releases scheduler registration, queued commands, CPU
storage, Canvas rasters, GPU candidate/resident references, target participation,
callbacks, and binding leases in `finally`-backed idempotent paths.

Context restoration creates a new WebGL executor generation from the immutable
definition and committed CPU/system state. A stateless effect reconstructs from
logical time and seed. A GPU-stateful effect follows its explicit restoration
policy: restart deterministically from its run seed or restore from a maintained
CPU checkpoint if that later capability is deliberately implemented. No hidden
GPU readback is introduced to preserve state.

## Presets

CRC should ship presets only after the required base modules have public proving
scenarios. Each preset is a pure factory returning an ordinary definition.

Target Canvas-compatible presets:

- `confetti`;
- `snow`;
- `sparks`;
- `embers`;
- `smoke`;
- `fireworks`; and
- `cursorTrail`.

Target WebGL presets:

- `embers3D`;
- `smoke3D`;
- `fireworks3D`;
- `exhaust3D`; and
- `starfield3D`.

Factories accept a small stable semantic option set such as origin, palette,
intensity, duration, seed, explicit quality tier, and reduced-motion mode. They
do not expose every underlying module property under a second naming scheme.
Authors needing full control use the returned definition language directly.

```tsx
import { confetti } from "@crc/particles/presets";

const celebration = confetti({
  palette: ["#7c3aed", "#22c55e", "#f59e0b"],
  quality: "high",
  motion: "full",
});

<Particles2D
  effect={celebration}
  autoplay
  style={{ left: 0, top: 0, width: "100%", height: "100%" }}
/>;
```

Quality tiers are deterministic mappings to concrete capacity, emission,
renderer, and optional module choices. They never auto-switch based on frame
timing. Reduced motion is explicit. Decorative presets may produce an immediate
static/no-emission result; essential status feedback should use a smaller,
lower-motion alternative rather than disappearing without replacement.

Initial presets use procedural marks or caller-supplied stable sprite assets.
The base entry never eagerly downloads, decodes, or bundles a large texture
library.

## Physics integration boundary

Particle-native constant acceleration, drag, fixed attractors, simple analytic
colliders, and bounds are part of particle execution. They are closed visual
effect operations, not a general physics world.

A future `@crc/physics` package would independently own bodies, mass, forces,
constraints, broad/narrow phase collision, queries, fixed-step execution, and
its own exact resource lifecycle. Particles must not create one rigid body per
particle.

The future integration seam is a read-only immutable collision-field or query
snapshot:

- CPU particle execution may sample analytic primitives or a stable spatial
  query snapshot;
- GPU particle execution may sample an uploaded height field, signed-distance
  field, or other explicitly supported texture/buffer representation; and
- scheduler dependencies must guarantee the field snapshot is committed before
  the particle simulation pass that consumes it.

No CPU physics callback runs once per GPU particle. Cross-system collision
events remain aggregate and capability-qualified. The particle package has no
dependency on `@crc/physics` in its initial releases.

## Reduced motion and accessibility

The runtime does not inspect media queries or unilaterally decide that an effect
is decorative. Applications select a full or reduced definition through an
ordinary signal, policy component, or preset option.

```tsx
const celebration = reducedMotion.get()
  ? confetti({ motion: "reduced", quality: "low" })
  : confetti({ motion: "full", quality: "high" });

return <Particles2D effect={celebration} autoplay />;
```

Definitions should be memoized or created outside component evaluation when
possible. Recreating a definition produces a new identity and intentionally
restarts the implicit system after successful adoption.

Particles create no accessibility tree. An effect communicating essential
state needs an ordinary semantic mechanism outside Canvas; the visual particles
are supplemental.

## Representative authoring examples

These examples define the intended reach of the architecture. The named public
values, discriminated records, ownership, and behavior are normative. The
implementation plan may refine overload spelling only where required by
TypeScript inference and must lock the result through public consumer tests
without changing these semantics.

### Ambient Canvas snow

```tsx
const snowfall = defineParticleEffect2D({
  parameters: {
    wind: { type: "vector2", default: [0, 0], timing: "simulation" },
  },
  emitters: [
    {
      name: "snow",
      capacity: 1_200,
      overflow: "recycle-oldest",
      space: "local",
      emission: [{ type: "rate", particlesPerSecond: 90 }],
      shape: {
        type: "rectangle",
        width: 1_280,
        height: 20,
        sample: "interior",
      },
      initial: {
        lifetimeMilliseconds: particle.between(6_000, 11_000),
        velocity: [particle.between(-12, 12), particle.between(35, 75)],
        size: particle.between(1, 4),
      },
      motion: [
        { type: "acceleration", value: particle.parameter("wind") },
        { type: "sway", amplitude: 18, frequency: [0.1, 0.25] },
      ],
      appearance: {
        opacity: particle.curve([
          [0, 0],
          [0.08, 1],
          [0.85, 1],
          [1, 0],
        ]),
      },
      renderer: { type: "circle", blend: "source-over" },
      bounds: { x: -40, y: -20, width: 1_360, height: 820 },
    },
  ],
});
```

### Reusable Canvas impact bursts

```tsx
function ImpactSurface() {
  const sparks = crcParticleSystem(impactSparks, {
    autoplay: false,
    seed: 42,
  });

  return (
    <Particles2D
      system={sparks}
      pointerEvents="auto"
      onPointerDown={(event) => {
        sparks.emit("impact", {
          position: [event.x, event.y],
          count: 60,
        });
      }}
      style={{ width: 640, height: 360 }}
    />
  );
}
```

One mounted system accepts every burst and reuses its declared storage. The
application does not mount one component per click or one component per spark.

### Layered Canvas smoke and flame

```tsx
const campfire2D = defineParticleEffect2D({
  emitters: [
    {
      name: "smoke",
      capacity: 320,
      emission: [{ type: "rate", particlesPerSecond: 24 }],
      shape: { type: "line", from: [-12, 0], to: [12, 0] },
      initial: {
        lifetimeMilliseconds: particle.between(1_800, 3_500),
        velocity: [particle.between(-10, 10), particle.between(-55, -32)],
        size: particle.between(16, 30),
      },
      motion: [{ type: "sway", amplitude: 12, frequency: [0.4, 0.8] }],
      appearance: {
        size: particle.curve([
          [0, 0.6],
          [1, 1.8],
        ]),
        color: particle.gradient([
          [0, "rgb(80 70 65 / 45%)"],
          [1, "rgb(30 30 35 / 0%)"],
        ]),
      },
      renderer: { type: "sprite", source: smokeSprite },
      bounds: smokeBounds,
    },
    {
      name: "flame",
      capacity: 240,
      emission: [{ type: "rate", particlesPerSecond: 42 }],
      shape: { type: "circle", radius: 10, sample: "interior" },
      initial: flameInitial,
      motion: flameMotion,
      appearance: flameAppearance,
      renderer: { type: "sprite", source: flameSprite, blend: "additive" },
      bounds: flameBounds,
    },
  ],
});

<Layer style={{ width: 320, height: 240 }}>
  <Particles2D effect={campfire2D} autoplay style={{ left: 160, top: 210 }} />
</Layer>;
```

### Canvas pointer trail with live parameters

```tsx
function PointerTrail() {
  const pointer = crcSignal<[number, number]>([0, 0]);
  const trail = crcParticleSystem(pointerTrailEffect, { autoplay: true });

  return (
    <Particles2D
      system={trail}
      parameters={{ pointer: pointer.get() }}
      pointerEvents="auto"
      onPointerMove={(event) => pointer.set([event.x, event.y])}
      style={{ width: 800, height: 500 }}
    />
  );
}
```

Distance-based births and world-space history make the full trail a stateful CPU
scenario. A simpler rate-based trail may remain stateless.

### WebGL ambient embers

```tsx
const embers3D = defineParticleEffect3D({
  emitters: [
    {
      name: "embers",
      capacity: 20_000,
      emission: [{ type: "rate", particlesPerSecond: 700 }],
      shape: { type: "sphere", radius: 0.35, sample: "volume" },
      initial: {
        lifetimeMilliseconds: particle.between(1_500, 4_000),
        velocity: {
          type: "cone",
          direction: [0, 1, 0],
          spreadDegrees: 28,
          speed: particle.between(0.8, 2.4),
        },
        size: particle.between(0.02, 0.05),
      },
      motion: [
        { type: "acceleration", value: [0, 0.25, 0] },
        { type: "drag", amount: 0.04 },
      ],
      appearance: {
        size: particle.curve([
          [0, 1],
          [0.7, 0.55],
          [1, 0],
        ]),
        color: particle.gradient([
          [0, "#fff4c2"],
          [0.45, "#ff7a18"],
          [1, "rgb(125 23 4 / 0%)"],
        ]),
      },
      renderer: {
        type: "billboard",
        material: "emissive",
        blend: "additive",
        depthTest: true,
        depthWrite: false,
        sorting: "none",
      },
      bounds: { type: "sphere", center: [0, 2, 0], radius: 4 },
    },
  ],
});

function CampfireScene() {
  return (
    <WebGLLayer camera={camera}>
      <Group3D style={{ translateY: 0.4 }}>
        <Particles3D effect={embers3D} autoplay />
      </Group3D>
      <Cube
        pointerEvents="none"
        style={{ size: 0.6, translateY: -0.3, color: "#4b3528" }}
      />
    </WebGLLayer>
  );
}
```

The component contributes descriptions during composition. Scene settlement
finalizes its group transform, effective opacity, emissive/additive pass,
depth behavior, culling, and batch before any draw.

### WebGL starfield

```tsx
const stars = defineParticleEffect3D({
  emitters: [
    {
      name: "stars",
      capacity: 80_000,
      emission: [{ type: "burst", atMilliseconds: 0, count: 80_000 }],
      shape: {
        type: "sphere",
        radius: 120,
        thickness: 40,
        sample: "volume",
      },
      initial: {
        lifetimeMilliseconds: 60_000,
        size: particle.between(0.02, 0.08),
      },
      appearance: {
        opacity: particle.curve([
          [0, 0],
          [0.02, 1],
          [0.98, 1],
          [1, 0],
        ]),
      },
      renderer: {
        type: "point",
        material: "unlit",
        blend: "additive",
        depthWrite: false,
        sorting: "none",
      },
      bounds: { type: "sphere", center: [0, 0, 0], radius: 160 },
    },
  ],
});

<WebGLLayer camera={camera}>
  <Particles3D effect={stars} autoplay pointerEvents="none" />
  <Spacecraft />
</WebGLLayer>;
```

The preferred execution reconstructs the star state from index, seed, and time
in the vertex shader with no dynamic particle upload.

### Stateful world-space exhaust

```tsx
function Ship({ thrust }: { thrust: Signal<number> }) {
  return (
    <Group3D style={shipTransform.get()}>
      <ShipMesh />
      <Particles3D
        effect={exhaust3D}
        parameters={{ thrust: thrust.get() }}
        execution="auto"
      />
    </Group3D>
  );
}
```

The exhaust definition uses world simulation space, emitter transform history,
distance emission, and inherited velocity. Existing exhaust remains behind as
the group moves. This is a stateful CPU proving scenario before the equivalent
GPU plan is approved.

### Controlled 3D fireworks

```tsx
function Fireworks() {
  const system = crcParticleSystem(fireworks3D, {
    autoplay: false,
    seed: 7,
  });
  const nextCue = cue.get();

  crcWhenChanged(() => {
    if (nextCue) {
      system.emit("shell", {
        position: nextCue.position,
        seedSalt: nextCue.id,
      });
    }
  }, [nextCue]);

  return <Particles3D system={system} execution="gpu" />;
}
```

The full preset eventually uses a shell emitter, a burst emitter, and a smoke
emitter. A later aggregate sub-emitter trigger may connect shell completion to
the burst entirely inside the executor; it does not surface one callback per
particle.

## Delivery decomposition

The work is too broad for one implementation plan. The approved architecture is
delivered as separate projects with their own failing tests, public scenarios,
verification, and written plans.

### Project 1: definitions, systems, and stateless executors

- package/export/consumer scaffolding;
- immutable 2D/3D definitions and validation;
- value/range/curve/gradient compilation;
- rate, scheduled burst, and manual emission;
- local analytic shapes and motion;
- implicit and explicit system ownership;
- Canvas circle/rectangle/path/sprite rendering;
- WebGL point/billboard settled-scene contribution and instancing;
- component-level interaction bounds;
- scheduler, completion, failure, and teardown; and
- one Canvas celebration plus one high-count WebGL ambient scenario.

This project may begin its shared and Canvas work after written-spec review. Its
WebGL tranche begins only after settled-scene rendering and the required
unlit/emissive scene material/submission seam are implemented and verified.

### Project 2: stateful CPU execution

- packed fixed-step storage;
- world space and moving-emitter history;
- inherited velocity and distance emission;
- pointer fields, simple bounds/wrap, and analytic colliders;
- velocity-stretched sprites;
- Canvas draw and WebGL packed-upload paths; and
- pointer-trail and world-space exhaust scenarios.

### Project 3: stateful GPU execution

- transform-feedback plan/compiler;
- explicit `auto`/`cpu`/`gpu` selection;
- renderer dependency scheduling;
- candidate/committed ping-pong generations;
- context restoration policy;
- no-readback diagnostics; and
- CPU/GPU perceptual-equivalence evidence.

### Project 4: advanced effects and presets

- aggregate sub-emitter triggers;
- trails and ribbons;
- multiple renderers over one population;
- mesh/path/mask emission;
- simple same-scene soft particles;
- carefully bounded custom CPU modules if proven; and
- tree-shakable confetti, snow, sparks, embers, smoke, fireworks, exhaust,
  cursor-trail, and starfield factories.

The easing-family expansion is a separate small animation project. A general
physics package, if pursued, is a separate architectural project.

## Verification and evidence

### Public semantic evidence

Tests and public scenarios must prove:

- exact seeded rate, burst, and lifetime results under a controlled frame
  driver;
- unique named emitters and typed manual burst routing;
- play, pause, resume, restart, drain, clear, overflow, and completion;
- finite versus infinite/manual completion classification;
- parameter timing for spawn, simulation, and render categories;
- definition-change restart and failed-adoption rollback;
- local/world transform semantics and moving-emitter history at the appropriate
  project stage;
- hidden-tab and large-delta clamping;
- explicit reduced-motion selection;
- Canvas layout, transform, clip, filter, Layer, and paint order;
- WebGL scene composition, opacity, depth, transparency, light/material, culling,
  and post-processing participation;
- component-level interaction with no per-particle targets; and
- context loss, render failure, removal, key replacement, and disposal.

Every new public capability has a representative scenario usable manually and
driven headlessly. Internal tests supplement but do not replace public-API
evidence.

### Structural evidence

Deterministic instrumentation must prove:

- zero steady-state per-particle JavaScript allocation;
- one realm host frame across all active roots and managed Layers;
- one scheduler registration per running system;
- no CRC component or element traversal per particle;
- fixed storage bounded by declared emitter capacity;
- no Canvas pixel readback and no normal GPU readback;
- bounded Canvas state changes and raster-cache entries;
- zero GL calls, uploads, shader compilation, or GPU resource construction
  during WebGL component composition;
- zero per-particle CPU update and dynamic upload for the stateless WebGL path;
- one instanced draw per settled compatible batch in the initial path;
- exact simulation-before-draw dependency order for GPU state;
- one completed bitmap transfer per dirty WebGL island;
- cache hits with no child traversal, settlement, GPU draw, or bitmap transfer;
- exact ownership counters for scheduler registrations, CPU blocks, Canvas
  rasters/surfaces, programs, textures, buffers, vertex arrays,
  transform-feedback objects, framebuffers, bitmaps, targets, and binding
  leases; and
- baseline/state restoration and zero live ownership after every success and
  injected failure path.

### Measured evidence

Opt-in controlled benchmarks record:

- p50 and p95 frame cost across increasing capacities;
- CPU Advance, Canvas draw, WebGL scene composition/settlement, WebGL
  simulation/draw, bitmap transfer, and Canvas composite separately where
  possible;
- tight versus full-viewport Canvas Layers;
- high-density and responsive resize behavior;
- additive versus alpha-sorted workloads;
- a documented current desktop and mobile browser/device matrix; and
- equivalent raw Canvas2D and WebGL2 reference implementations.

Targets are chosen only after baseline collection. Wall-clock performance is
not part of the deterministic correctness gate and is never inferred from old
documentation totals.

### Package and documentation evidence

Each public tranche updates and verifies:

- root and subpath runtime exports and declarations;
- Bundler and NodeNext consumers;
- packed tarball consumers with and without the optional WebGL peer;
- one shared `@crc/core` identity and matching official package versions;
- source and built Studio modes plus editor declarations;
- public Learn, API, and Examples catalogs without exposing laboratory-only
  metadata;
- Chromium Canvas2D/WebGL2 browser scenarios and intentional visual baselines;
- lifecycle cleanup and structural-performance suites; and
- the aggregate repository trust gate on the documented environment.

Visual baselines are inspected rather than rewritten merely to pass. Semantic
state, counts, geometry, scene pass order, and ownership assertions precede
pixel evidence.

## Required contract updates

Implementation updates the normative contracts whose current boundaries are
affected. At minimum:

- `docs/design/animation-contract.md` for the shared clock/easing distinction;
- `docs/design/signals-and-scheduling-contract.md` for particle/friend scheduler
  participation;
- `docs/design/canvas-surface-contract.md` for Canvas/WebGL composition and
  transaction behavior;
- `docs/design/runtime-hooks-contract.md` for `crcParticleSystem` ownership;
- `docs/design/drawing-components-contract.md` for `Particles2D` and
  `Particles3D`;
- `docs/design/style-system-contract.md` for supported component style and
  filter behavior;
- `docs/design/layout-system-contract.md` for the no-intrinsic-size 2D box;
- `docs/design/user-events-contract.md` and mouse/focus guidance for
  component-level interaction only;
- `docs/design/event-resource-ownership.md`;
- `docs/design/runtime-resource-ownership.md`;
- the settled-scene WebGL contract produced by its implementation;
- public package README, Learn, API, Examples, and Studio declarations; and
- package-consumer and catalog verifiers.

The research artifact remains non-normative evidence. This approved design and
the eventual implemented contracts supersede its hypotheses where they differ.

## Approval decisions captured

The approved product and architecture decisions are:

- particle effects are components, not styles;
- effect configuration is immutable data, not a JSX module subtree;
- simple `effect` and controlled `system` component modes share one runtime;
- Canvas2D and WebGL use one conceptual effect language with explicit
  dimension/backend capabilities;
- `Particles3D` is a settled-scene contributor and never an immediate GL draw;
- the initial WebGL appearance scope is unlit/emissive, with lit particle
  materials later;
- particle acceleration is domain vocabulary rather than a WebGL or general
  animation primitive;
- general CRC animation retains tween/keyframe/spring/custom/stepper semantics;
- general physics remains a separate optional future package;
- presets are ordinary tree-shakable definition factories; and
- implementation is decomposed into independently verified projects rather
  than one all-at-once plan.
