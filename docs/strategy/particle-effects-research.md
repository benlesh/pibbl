# Particle Effects for CRC

- **Status:** Current design research; the product direction is to proceed to a
  formal design, not yet to implementation or a public API commitment. The
  WebGL portion depends on the in-progress `WebGLLayer` settled-scene contract
  and must be reconciled with that approved design before specification.

## Executive finding

Particle effects should be modeled as components backed by immutable effect
definitions, not as style effects.

The component owns a running instance: time, emission, particle storage,
scheduler participation, renderer resources, completion, and teardown. Its
`style` should remain responsible for the same local presentation concerns as
other CRC components—layout box, transforms, compositing, filters, and cursor.
Emission, particle lifetime, forces, over-life curves, sprite or billboard
selection, blending, and capacity belong to an immutable particle-effect
definition supplied through a program prop.

The strongest initial opportunity is not a general particle or physics engine.
It is a focused effects facility covering:

1. UI celebration and feedback: confetti, sparkles, click bursts, success
   moments, and short transitions.
2. Ambient and environmental effects: snow, rain, dust, embers, stars, smoke,
   fire, and drifting backgrounds.
3. Motion-attached effects: exhaust, contrails, speed streaks, dust from moving
   objects, and pointer trails.
4. Impact and energy effects: sparks, explosions, fireworks, magic, pulses,
   and short-lived debris.

Those uses share a compact fixed-function core: time- and distance-based
emission, bursts, seedable ranges, emitter shapes, lifetime curves, simple
forces, sprites or billboards, texture atlases, blending, finite capacity, and
explicit bounds. Established engines expose much broader systems, but the
common core is remarkably stable across Unity, Unreal Niagara, Godot, PixiJS,
and browser-focused particle libraries.[^1][^2][^3][^4]

CRC can make that core unusually efficient by compiling compatible effects to
a stateless representation. A stateless particle is reconstructed from its
spawn index, seed, birth time, and current logical time instead of being
mutated every tick. Unreal's lightweight emitters validate this as a distinct,
substantially cheaper tier with fewer CPU, memory, and tick costs.[^5] For WebGL2,
the same representation can execute almost entirely in a vertex shader and
render many particles with one instanced draw per settled compatible batch.
Canvas2D still
loops over visible particles on the CPU, but it can avoid per-particle objects,
integration state, and allocation.

Stateful simulation remains necessary for moving emitters in world space,
distance emission, collisions, sub-emitters, neighbor interactions, and
arbitrary update logic. It should be a later, explicit tier. WebGL2 transform
feedback can keep such state on the GPU, but it adds a separate resource,
failure, portability, and determinism problem; it should not be the first
implementation merely because it is available.[^6][^7]

CRC's WebGL rendering model is concurrently being redesigned around four
ordered operations: compose a complete frame-local scene, settle its effective
transforms/materials/opacity and render passes, render it, then atomically
commit its bitmap and interaction snapshot. The particle design should treat
that as a prerequisite rather than designing against today's immediate draw
behavior. In particular, a `Particles3D` component should contribute particle
simulation and draw descriptions while the scene is composed; it must not issue
WebGL commands during component traversal.

## Strategic fit

CRC's current [product strategy](./README.md#scope-cautions) explicitly says
that CRC should not pursue particle or physics systems without compelling
evidence. This research reopens that hypothesis but does not supersede it.
There is a plausible narrow exception: a particle-_effects_ primitive can be
an isolated drawing capability rather than a general simulation platform.

That exception is credible only if the design preserves these boundaries:

- Particles are visual effect marks, not arbitrary application entities.
- No retained scene graph, rigid bodies, general collision world, constraints,
  fluid solver, or entity-component system is introduced.
- No JSX element or CRC component is created per particle.
- Individual particles do not acquire lifecycle identity, hooks, focus,
  accessibility semantics, or DOM-aligned event targets.
- Cross-effect communication is restricted to explicit effect-level commands
  and a small set of built-in sub-effect triggers, if those are later proven.
- CPU and GPU behavior may be perceptually equivalent without promising exact
  cross-engine floating-point or pixel identity.
- Custom behavior cannot silently fall off the GPU path. Backend capability and
  cost must be explicit.

The product case is now considered strong enough to proceed to formal design.
Representative CRC applications still provide the architectural and performance
evidence: a celebration effect, a high-count ambient effect, a moving trail,
and a layered fire or smoke effect test four materially different workloads. If
those examples cannot meet CRC's structural performance standards, the design
must narrow before a public surface ships.

## Use-case research

### 1. Amorphous and environmental effects

Particle systems were established to portray things that are awkward to model
as solid geometry: fire, smoke, clouds, liquids, dust, rain, snow, and similar
volumes. Unity describes the basic model as many small images or meshes whose
collective motion produces the effect, with each particle varying in velocity,
color, size, rotation, and opacity over a finite lifetime.[^1]

These effects usually need:

- continuous emission over time;
- point, line, rectangle or box, circle or sphere, ring, and cone emitters;
- random ranges for lifetime, direction, speed, size, rotation, and color;
- gravity or constant acceleration, drag, drift, and mild turbulence;
- size, color, and opacity curves over normalized lifetime;
- normal-alpha and additive blending;
- a sprite or animated texture-sheet renderer;
- fixed or conservative bounds for culling;
- prewarming when an ambient effect should appear already established.

Smoke is a representative composition: an upward velocity, expansion, and
opacity loss over life create the aggregate cloud. Fire commonly combines at
least two emitters—short bright additive particles and slower alpha-blended
smoke. The ability to combine emitters is therefore not an exotic feature, but
it need not imply arbitrary graph execution.

### 2. Bursts, impacts, projectiles, and destruction

Sparks, explosions, muzzle flashes, fireworks, magic impacts, debris, and
confetti are burst-dominant. They need a command that can add particles to an
already allocated system at a position and orientation, rather than requiring a
new component mount for every impact. Epic calls this a “system as a service”
pattern and notes that repeated projectiles and impacts often benefit from
adding work to an existing system rather than repeatedly allocating system
instances.[^8] Browser confetti libraries similarly reuse one canvas and add new
bursts while prior particles remain active.[^9]

These effects usually need:

- manual bursts and scheduled bursts;
- cone or radial emission;
- a per-burst origin, direction, color palette, and count override;
- a hard capacity and a documented overflow policy;
- completion after emission stops and the final particle expires;
- optional multiple emitters for sparks, smoke, flash, and debris;
- deterministic seeds for replay and tests;
- optional burst spreading over a few frames to avoid single-frame hitches.

Large bursts deserve explicit treatment. Epic recommends spreading very large
spawns across frames because doing all spawn work at once can hitch.[^8] CRC
should make that an author-visible option rather than silently changing timing.

### 3. Trails and motion-attached effects

Rocket exhaust, contrails, tire dust, sword streaks, cursor trails, and motion
lines expose requirements that a stationary emitter does not:

- emission by distance as well as by time;
- knowledge of previous emitter position;
- local versus world simulation space;
- inherited emitter velocity;
- stretched sprites or ribbons aligned to velocity;
- conservative bounds that include where already-emitted particles remain.

Unity explicitly supports rate-over-distance for effects caused by motion, such
as dust from a wheel, alongside timed bursts and rate-over-time emission.[^10]
Godot's 2D particle API likewise includes local coordinates, trails, fixed
simulation frequency, interpolation, seed control, and explicit visibility
bounds.[^3]

This category is the clean dividing line between stateless and stateful modes.
A local-space trail whose whole system follows its parent can be reconstructed
analytically. A moving emitter that leaves old particles behind in world space
must retain transform history or per-particle spawn transforms.

### 4. UI celebration and micro-interaction

The web ecosystem demonstrates a meaningful use beyond games. Common cases are
success confetti, sparkles around a selected control, click or tap bursts,
cursor trails, loading or progress atmosphere, and short decorative
transitions. The widely used `canvas-confetti` API centers on particle count,
origin, angle, spread, velocity, decay, gravity, drift, shapes, scale, color,
and completion; it also exposes custom path and rasterized text or emoji
shapes.[^9]

UI effects add several requirements that game-oriented APIs can underweight:

- coordinates aligned to the logical Canvas allocation;
- easy manual triggering from an existing CRC event handler;
- custom `Path2D`, image, text, and emoji-derived particles;
- correct high-density rasterization without per-frame text or path setup;
- strict paint order with ordinary Canvas and WebGL content;
- a reduced-motion policy and an immediate no-animation outcome;
- no accidental hit testing or focus enrollment;
- predictable completion callbacks for UI state changes.

Reduced motion is not optional design polish. The platform exposes
`prefers-reduced-motion`, and WCAG states that interaction-triggered motion can
be disabled unless it is essential.[^11][^12] A particle facility should make the
application's choice explicit and easy, but it should not guess whether an
effect is essential. This agrees with CRC's existing animation boundary: the
application selects a reduced or alternate definition.

### 5. Decorative and interactive backgrounds

Web particle libraries commonly provide starfields, drifting dots, linked-node
backgrounds, and particles that attract, repel, connect, grow, or disappear in
response to pointer input. tsParticles presents interactive backgrounds as a
distinct simplified bundle and separately exposes hover and click modes such as
repulse, attract, push, bubble, grab, and trail.[^13]

These uses need:

- a persistent, responsive box;
- wrap, bounce, or respawn-at-edge behavior;
- pointer positions as system parameters;
- simple spatial interactions such as repulsion or attraction;
- low-power quality settings and suspension while not visible;
- a system-level event surface at most, not one target per particle.

Particle-to-particle links and collisions change complexity from linear to
potentially quadratic without a spatial index. They should not be in the first
fixed-function tier. Pointer attraction or repulsion is much cheaper because it
has one external point and can be expressed as a built-in force.

### 6. Image, text, path, and mesh emission

Disintegration, reveal, logo assembly, dissolve transitions, surface sparks,
and silhouette effects emit from or converge on sampled geometry. Godot exposes
point, directed-point, and color textures for complex emission shapes; Unity
and Niagara support mesh-oriented emission and external data interfaces.[^2][^4]

CRC already has useful source forms—`Path2D`, SVG paths, images, text, and
immutable WebGL geometry—but sampling them is not one capability:

- A path outline can be sampled by arc length.
- A filled path requires area sampling or a precomputed mask.
- An image or text silhouette requires rasterization and pixel sampling.
- A 3D mesh requires surface-area-weighted triangle sampling and optional
  normals or colors.

The initial design should reserve an emission-shape extension point but ship
only cheap analytic shapes. Path, mask, image, text, and mesh samplers should be
separate immutable, precomputed assets. Sampling during every render would
violate the performance model.

### 7. Data visualization, point clouds, and simulations

Moving marks also appear in force-directed graphs, bubble packing, flow
visualizations, point clouds, flocking, and agent simulations. D3 explicitly
uses particle-style force simulation for networks, hierarchies, and collision
resolution in bubble charts.[^14] These workloads differ from effects in ways
that matter to CRC:

- each mark often maps to durable application data;
- stable identity and individual picking may be essential;
- users may need direct access to positions;
- the simulation may converge rather than emit and expire;
- links and neighbor forces are first-class.

They should not force identity or picking costs into the effects API. A future
`Points`, `Instances`, or force-layout facility may reuse packed rendering and
scheduler internals, but “every particle is an interactive component” is the
wrong contract for effects.

### Use-case capability matrix

| Use case                 | Emission                      | Motion                              | Rendering                         | Control                                  | Expensive or special needs         |
| ------------------------ | ----------------------------- | ----------------------------------- | --------------------------------- | ---------------------------------------- | ---------------------------------- |
| Confetti / celebration   | Manual burst                  | Gravity, drag, drift, rotation      | Shapes, image/text sprites, alpha | Trigger, completion, reduced alternative | High-DPI sprite cache              |
| Sparks / impact          | Manual or scheduled burst     | Cone/radial velocity, gravity, drag | Additive sprite, stretched sprite | Repeated pooled bursts                   | Optional collision/sub-effect      |
| Snow / rain / dust       | Continuous area               | Drift, wind, wrap or respawn        | Sprite or line                    | Pause, quality scale                     | Responsive bounds, culling         |
| Fire / smoke / embers    | Continuous, multiple emitters | Rise, expansion, noise              | Atlas sprites, additive + alpha   | Loop, prewarm                            | Multiple material batches          |
| Exhaust / contrail       | Time and distance             | Inherit velocity, world space       | Stretched sprite or trail         | Start/stop emission                      | Emitter transform history          |
| Fireworks / magic        | Timed and manual bursts       | Radial/orbit/noise                  | Sprite + trail, additive          | Timeline, completion                     | Sub-emitters or linked stages      |
| Interactive background   | Continuous                    | Wrap, pointer attract/repel         | Dots, optional links              | Visibility, quality                      | Spatial index for links/collision  |
| Dissolve / assemble      | Burst from sampled source     | Target attraction                   | Source-colored sprite             | Trigger, completion                      | Precomputed path/mask/mesh sampler |
| Data nodes / point cloud | Usually fixed population      | Forces or supplied positions        | Point, sprite, mesh instance      | Direct mutation, selection               | Stable IDs and individual picking  |

The first eight rows justify an effects API. The final row justifies a separate
packed-data or point-instance API if CRC later chooses to build one.

## Presets, easing, and physics adjacency

### Canned configurations should follow the core

CRC should eventually ship curated configurations for common effects. The
evidence is strong: Niagara uses templates to give beginners a working effect
that remains fully editable, Babylon exposes a one-line default system and
named particle-system sets, and tsParticles maintains separately loadable
presets for confetti, fire, fireworks, snow, stars, and other recurring web
effects.[^23][^24][^25]

The presets should not be special components or a second execution model. Each
should be a pure factory returning the same immutable 2D or 3D effect definition
an application can construct directly. That preserves one compiler, one
playback model, and one set of resource semantics.

A useful eventual split is:

1. **Preset factories** for effects with broad defaults and a small semantic
   option surface, such as palette, intensity, direction, scale, and quality.
2. **Recipes** showing the full low-level definition when an effect is more
   educational than reusable or depends heavily on application assets.
3. **Ordinary user factories** for product-specific design systems. CRC does
   not need a preset registry, inheritance system, or global name lookup to
   support these.

The first curated set should cover distinct workloads rather than many visual
variations of confetti:

| Preset    | 2D  | 3D       | Architectural coverage                                                     |
| --------- | --- | -------- | -------------------------------------------------------------------------- |
| Confetti  | Yes | Optional | Repeated manual bursts, shape variety, gravity, rotation, completion       |
| Snow      | Yes | Yes      | Continuous area/volume emission, drift, responsive bounds, quality scaling |
| Sparks    | Yes | Yes      | Additive blending, cone bursts, stretched billboards, optional collision   |
| Smoke     | Yes | Yes      | Multiple curves, sprites, drag, layered emitters, alpha ordering           |
| Fireworks | Yes | Yes      | Staged emitters, trails, sub-effect triggers, burst overrides              |
| Embers    | Yes | Yes      | High-count stateless motion, additive rendering, turbulence substitute     |

Preset entry points should be separately importable and tree-shakable. A
plausible package shape is `@crc/core/particles/presets` for Canvas-oriented 2D
factories and `@crc/core/particles/presets/webgl` for 3D factories. Presets should
never fetch remote assets. They should use procedural assets, package-owned
small assets, or explicit caller-supplied decoded sources.

Preset options should be semantic and shallow. `smoke2D({ density: "high",
wind: [12, -4] })` is maintainable; a generic deep override path into a preset's
private emitter structure is not. An author who needs structural changes should
copy the corresponding recipe or build from the low-level vocabulary.

Quality selection, seed, autoplay, and reduced-motion policy belong to the
mounted system rather than the preset definition. This lets the same visual
definition run under application-selected operational policies without
silently adapting its output to frame timing or device heuristics.

Presets should follow—not lead—the low-level API. Ship representative recipes
with the first implementation, then promote only proven recipes into maintained
preset factories after their parameter vocabulary and cross-backend behavior
stabilize.

### Particle curves are not general animation timelines

Particles need substantially more value shaping than CRC's current named
easings appear to offer: opacity ramps, non-monotonic size pulses, sprite-frame
selection, velocity response, and randomized bands between two curves. Unity's
particle value model supports constants, random ranges, one curve, and a random
value between two curves.[^27] CSS Easing Level 2 likewise demonstrates that a
piecewise-linear point list is a useful portable representation for complex
timing shapes, including approximated bounce curves.[^26]

CRC should keep three concepts distinct:

- **Easing** remaps normalized progress for an ordinary animation.
- **Particle curves and gradients** map normalized particle age or another
  particle input to scalar, vector, or color output.
- **Forces and constraints** evolve physical state over time.

Reusing `CRCAnimationDefinition` for a particle curve would be incorrect: it
owns duration semantics and permits arbitrary typed interpolation, while a
particle curve must compile to Canvas numeric code and WebGL shader data.

The particle package should instead offer immutable keyframed curves and
gradients. Construction can accept CRC easing functions per segment, validate
finite results, and compile a fixed lookup table once. Canvas and WebGL then
sample the same table instead of invoking user JavaScript per particle or
attempting to translate arbitrary functions into GLSL. Exact key boundaries
remain metadata so steps and discontinuities do not blur during table sampling.

More core easings are worthwhile only as separate general animation work. The
best candidates are a piecewise-linear factory plus familiar power, sine,
exponential, circular, back, elastic, and bounce families. Particle presets
would benefit from those names, but the particle design does not need to block
on them: cubic Bézier curves, piecewise points, and sampled custom easing cover
the representation already. “Bounce” motion caused by a collision should still
use restitution and velocity, not a bounce easing.

### Particle physics is not a rigid-body world

The majority of particle effects need physically inspired motion, not general
physics. Gravity, constant or radial force, analytic drag, orbit, vortex,
attraction, and simple collision response should be closed particle modules.
They can compile to tight CPU loops or shaders and do not justify a separate
package dependency.

Collision has three materially different tiers:

1. **Analytic effect-local colliders:** planes/lines, boxes/rectangles, and
   spheres/circles with bounce, friction, lifetime loss, kill, or event-count
   response.
2. **Baked or streamed collision fields:** height fields, signed-distance
   fields, and compact collider snapshots suitable for GPU access.
3. **A general physics world:** rigid bodies, broad phase, contacts, joints,
   continuous collision, sleeping, queries, and application-owned events.

GPU particles cannot simply call a CPU physics world's query API. Godot makes
this boundary explicit: GPU particles do not have access to the physical world,
so collision uses dedicated box, sphere, height-field, or signed-distance-field
resources.[^28] Unity similarly distinguishes cheap explicit planes from world
collision and exposes quality and maximum-shape limits.[^29]

If CRC later adds physics, it should be separate work. A plausible
`@crc/core/physics` package would own a component-scoped world, fixed-step execution,
body/collider lifetime, and committed read-only snapshots. Box2D recommends a
fixed timestep and exposes collision queries separately from simulation;
Rapier likewise separates its world solver from filtered scene queries.[^30][^31]
Those are appropriate precedents, but choosing or abstracting an engine is too
large a decision to hide inside the particle design.

Particle interoperability should be one-way by default:

- a physics integration can publish a bounded analytic-collider snapshot or
  GPU-ready field consumed by a particle collision module;
- particle systems may publish bounded aggregate events such as collision
  counts or a capped event sample in Complete;
- particles do not become rigid bodies and do not synchronously apply one
  impulse per particle back into the physics world;
- application code can turn an aggregate particle event into an ordinary
  physics command on the next Begin phase when that feedback is genuinely
  needed.

The current scheduler orders Advance participants by registration rather than
declared dependency. A future physics integration must therefore define either
a shared fixed-step coordinator or an explicit previous-committed-snapshot
rule. Particle correctness must never depend accidentally on component mount
order.

The particle package need not publish a speculative physics interface now. Its
internal collision compiler should accept backend-neutral analytic colliders
and backend-specific field resources behind one private boundary. A future
official sibling can use a version-coupled internal entry, just as `@crc/webgl`
uses `@crc/core/internal`, once real physics behavior supplies the contract.

## Style, component, and definition boundaries

### Why this is not a style effect

CRC filters are appropriately styles because they transform the pixels
produced by an existing primitive. They do not own a clock, generate geometry,
emit events, or remain alive after their input stops changing. Particles do all
of those things.

Putting particles in `style` would also create poor update semantics. A style
object is re-resolved during render; a particle system must distinguish:

- changing the component's layout or transform;
- changing a dynamic effect parameter;
- changing the compiled particle state layout or shader;
- restarting a run;
- stopping new emission while allowing existing particles to drain.

Those operations cannot be inferred safely from arbitrary nested style-object
changes. A style surface would also invite unsupported combinations on every
primitive and make resource ownership ambiguous.

### Recommended split

The public model should have three layers:

1. **Immutable definitions.** Factories create branded, deeply snapshotted
   descriptions of emitters, ranges, curves, renderers, and complete effects.
   They have no clock and own no runtime resources, matching CRC animation
   definitions.
2. **Component-owned system.** A hook-owned controller owns one logical run,
   seed, commands, parameters, status, scheduler registration, executor binding,
   and callbacks.
3. **Backend binding component.** A Canvas2D or WebGL component binds that
   system at one visual location and owns its execution lease. `Particles2D`
   executes its Canvas paint there. `Particles3D` instead contributes simulation
   work and render submissions to its owning scene; context-generation GPU
   resources and final draw execution remain owned by the `WebGLLayer` scene
   renderer.

This split supports both simple declarative mounting and the high-value pooled
burst pattern. A single running system can accept many `emit(...)` commands
without allocating a component for each impact. Niagara's system/emitter/module
model provides a useful precedent for separating a composed effect from its
emitters and ordered behavior modules.[^22]

### API approaches considered

#### A. A large component prop object

```tsx
<ParticleSystem2D
  capacity={1000}
  emission={{ rate: 80 }}
  lifetime={{ min: 600, max: 1200 }}
  gravity={{ x: 0, y: 900 }}
  // ...
/>
```

This is approachable for one emitter but scales poorly to layered effects,
module reuse, precompilation, runtime controls, and backend capability checks.
Inline objects also make adoption and restart semantics harder to explain.

#### B. A JSX module tree

```tsx
<ParticleSystem2D>
  <Emitter rate={80}>
    <Cone spread={60} />
    <Gravity y={900} />
    <ColorOverLife values={["white", "orange", "transparent"]} />
  </Emitter>
</ParticleSystem2D>
```

This is visually appealing, but it makes configuration values look like live
components. It risks implying lifecycle identity, events, or render traversal
for every module, and makes effect sharing or WebGL shader compilation depend
on re-walking an element tree. PixiJS's optimized particle container draws a
restricted set of simple, shared-texture particles and deliberately excludes
ordinary child features such as filters, masks, and interaction; that is a
useful warning against disguising a batched renderer as an unrestricted
component subtree.[^20]

#### C. Immutable effect programs plus a component

```tsx
const sparks = defineParticleEffect2D({
  emitters: [
    {
      name: "sparks",
      capacity: 1000,
      emission: [{ type: "burst", at: 0, count: 120 }],
      shape: { type: "point" },
      initial: {
        lifetime: particle.between(600, 1200),
        velocity: {
          type: "cone",
          directionDegrees: -90,
          spreadDegrees: 60,
          speed: particle.between(280, 520),
        },
      },
      motion: [
        { type: "acceleration", value: [0, 900] },
        { type: "drag", amount: 0.12 },
      ],
      renderers: [{ type: "sprite", source: sparkAtlas }],
    },
  ],
});

function SparkEffect() {
  const system = crcParticleSystem(sparks, {
    autoplay: true,
    seed: 42,
  });

  return (
    <Particles2D
      system={system}
      pointerEvents="none"
      style={{ width: 320, height: 180 }}
    />
  );
}
```

This is the recommended direction. The names are illustrative rather than an
approved API. It aligns with CRC's immutable animation definitions, lets
definitions be cached and reused, lets WebGL compile a pipeline once, and keeps
the live component surface small.

The convenience layer can come later. A preset such as `confettiEffect()` may
return an ordinary definition; it should not create a second runtime model.

## Proposed conceptual API

### Definitions

Use explicit 2D and 3D nominal types. They have different vector types,
emission shapes, renderer modes, coordinate spaces, and backend capabilities;
pretending they are one generic type would move errors to runtime.

Candidate concepts:

- `defineParticleEffect2D({ parameters, emitters, bounds })`
- `defineParticleEffect3D({ parameters, emitters, bounds })`
- ordered named emitter records with per-emitter `capacity`, `overflow`,
  `emission`, `shape`, `initial`, `motion`, `collision`, `appearance`,
  `renderers`, and `triggers` sections
- `particle.between(min, max)` and weighted selection helpers
- `particle.curve(...)` and `particle.gradient(...)` over normalized lifetime
- typed `particle.parameter` tokens for spawn, live-simulation, and render inputs
- renderer descriptors for 2D shape/sprite and 3D point/billboard/mesh modes

Definitions should be copied, validated, frozen, branded, and independent of a
Canvas or GPU context. Asset-backed definitions may hold stable source values,
but decoded image, raster cache, shader, buffer, and texture resources belong
to the mounted backend component.

### Playback and commands

A stable component-owned system handle is warranted because repeated manual
bursts are a primary use case. Its playback controls should be smaller than
`CRCPlayback` because stateful particles generally cannot reverse or seek
cheaply.

Candidate surface:

```ts
interface CRCParticleSystem<EmitterName extends string> {
  readonly status: Signal<
    | "idle"
    | "scheduled"
    | "running"
    | "paused"
    | "draining"
    | "finished"
    | "disposed"
  >;
  readonly execution: Signal<
    | "unbound"
    | "stateless-canvas"
    | "stateful-canvas"
    | "stateless-webgl"
    | "stateful-cpu-webgl"
    | "stateful-gpu-webgl"
  >;

  play(): void;
  pause(): void;
  resume(): void;
  restart(options?: { seed?: number }): void;
  emit(emitter: EmitterName, options?: CRCParticleBurstOverrides): void;
  stop(options?: { mode?: "drain" | "clear" }): void;
}
```

Commands should enter the scheduler's Begin phase in invocation order. Advance
updates internal simulation. Successful render plans paint the newest state.
Completion, burst rejection, and errors should deliver in Complete so
application callbacks cannot interrupt simulation or rendering.

Exact population belongs behind opt-in, capability-qualified diagnostics.
Stateful GPU execution cannot promise an exact synchronous `activeCount`
without readback, so the base system handle must not imply that cost or
availability.

### Backend components

The recommended optional package exposes:

- `Particles2D`, shared value helpers, definitions, and `crcParticleSystem` from
  `@crc/core/particles`.
- `Particles3D` and 3D definition/rendering vocabulary from
  `@crc/core/particles/webgl`, valid only inside `WebGLLayer`.
- eventual tree-shakable preset factories from `@crc/core/particles/presets` and
  `@crc/core/particles/presets/webgl`.

The package uses the core automatic JSX runtime and adds no competing element
protocol. Its Canvas root entry does not import or require `@crc/webgl`.

`Particles2D` needs a declared box and has no intrinsic size. It accepts normal
core box and layout-item style, transforms, cursor, and `style.filter`. A filter
applies to the combined particle raster, just as it does to the recursive output
of another core primitive.

`Particles3D` accepts the settled WebGL transform style and contributes one or
more scene submissions under the current `Group3D` ancestry. It participates in
the island camera, effective group opacity, culling, depth and transparency
planning, lighting/material resolution, and post-processing. It cannot accept a
Canvas filter; authors apply a filter to `WebGLLayer`. A later orthographic
camera or explicitly screen-space WebGL particle component may be justified for
high-count 2D effects, but an implicit hidden WebGL context inside a Canvas
primitive would violate CRC's explicit backend boundary.

The settled-scene redesign must provide a scene-aware extension seam for an
official sibling such as `@crc/core/particles/webgl`. Whether that seam is public or
version-coupled internal belongs to the WebGL design, but it must let particles
submit immutable frame descriptions and renderer-owned resource recipes without
exposing raw GL commands during composition. The particle package must not add
a private immediate-render bypass.

The system may bind to one backend component at a time. Binding the same live
system to two components should reject until shared simulation/multiple
renderer semantics are deliberately designed.

### Emission

The initial closed emission vocabulary should cover:

- rate over logical time;
- scheduled bursts;
- manual named bursts;
- point, line, rectangle or box, circle or sphere volume/surface, ring, and
  cone shapes;
- deterministic probability and ranges;
- an explicit per-emitter maximum capacity;
- overflow policy: reject newest by default, with recycle-oldest opt-in;
- local simulation space initially.

Distance emission, world-space moving emitters, inherited velocity, and source
samplers require stored history and belong in the stateful tier.

### Per-particle values

The common value language needs three forms:

- constant;
- deterministic random range or weighted choice sampled at spawn;
- curve or gradient sampled over normalized particle lifetime.

Curves should use prevalidated keyframes and compile to compact lookup data.
They may reuse CRC's `CRCEasing` type, but should not reuse
`CRCAnimationDefinition`: particle curves have normalized lifetime semantics,
no independent duration, and may execute in GLSL.

The common attributes are position, velocity, age, lifetime, size, rotation,
angular velocity, color, opacity, sprite frame, and stable random channels.
Custom per-particle data should wait until a use case proves both its public
shape and its GPU layout implications.

### Motion modules

Names such as `acceleration`, `gravity`, `drag`, and `orbit` are particle-domain
descriptors, not WebGL primitives. WebGL provides programmable shaders,
buffers, transform feedback, and draw operations; it does not define time,
animation, velocity, acceleration, forces, or a simulation loop. The same
particle descriptor therefore has backend-independent meaning and compiles
differently:

- a compatible constant acceleration can use the analytic position
  `p(t) = p0 + v0*t + 0.5*a*t*t` in Canvas code or a vertex shader;
- a stateful execution tier can integrate velocity and position over CRC's
  bounded fixed steps on the CPU or in a scheduled GPU simulation pass.

CRC should prefer the name `acceleration` when the value directly changes
velocity and no particle mass is modeled. Calling that value a `force` would
imply `F = m*a` semantics the focused effects system does not provide. `gravity`
is an ergonomic constant-acceleration alias with dimension-specific direction
and coordinate-space rules.

The first stateless-compatible set should be deliberately small:

- constant acceleration or gravity;
- analytic drag;
- linear drift;
- radial velocity or acceleration;
- orbit around a point;
- color, opacity, size, and rotation over lifetime;
- sprite-sheet frame over lifetime.

Noise, turbulence, collisions, attractors that move every frame, and custom
update callbacks should be a separately costed tier. Godot explicitly warns
that turbulence carries a high GPU cost, particularly for mobile and web
targets.[^4]

Module order must be specified. Niagara's ordered module stack is powerful,
but CRC can avoid a full graph by defining a small phase order: spawn shape,
spawn initializers, analytic motion, over-life appearance, renderer. If two
modules write the same attribute ambiguously, definition construction should
reject instead of relying on hidden last-write-wins behavior.

This vocabulary should not be added to CRC's general animation surface. Core
animation moves a small number of application values through tweens, keyframes,
analytic springs, custom seekable definitions, or the existing fixed-step
`stepper`. Particle motion evaluates the same restricted operation across a
packed population and may compile it into shader math. The two systems share
the realm clock and may share easing/math internals, but they have different
ownership, storage, compilation, and observability contracts. A later physics
package remains the appropriate owner for mass, forces, rigid bodies,
constraints, and collision-world integration.

### Appearance and rendering

Canvas2D modes:

- circle and rectangle;
- immutable `Path2D` shape;
- decoded image or pre-rasterized text/emoji sprite;
- texture-atlas frame;
- source-over and additive (`lighter`) blending initially.

WebGL modes:

- point sprite for the cheapest distant or tiny marks;
- camera-facing billboard;
- velocity-stretched billboard;
- mesh instance later, after the sprite path is proven;
- texture-atlas frame;
- alpha, additive, or cutout material intent;
- explicit depth test/write and per-particle sorting policy.

The particle definition supplies local appearance, but the settled scene owns
the final rendering interpretation. Effective opacity combines ancestor/group
opacity, particle-system or renderer opacity, and per-particle color alpha
exactly once. The scene classifies the resulting submission into opaque,
cutout, alpha-transparent, or additive work and decides its pass ordering
relative to every other scene object.

The initial sprite and billboard renderers should be unlit or emissive by
default. That matches smoke, fire, sparks, magic, and most UI-like effects and
avoids making a lighting model a prerequisite for the first useful particle
release. Later lit billboards and mesh particles should use the ordinary scene
material and light contracts: camera-facing billboards can supply a defined
surface normal, while mesh particles require geometry normals. Emissive
particles should feed the scene's bloom/HDR pipeline instead of owning a
particle-specific bloom pass.

Unity's render modes demonstrate why billboard, stretched billboard, and mesh
are meaningfully different authoring choices.[^15] One simulated particle may
eventually feed multiple renderers—for example, a spark sprite and a ribbon—but
that should be added only after the one-renderer batching contract is stable.

## Performance architecture

### Shared principles

- Allocate each emitter's declared capacity once per bound executor; never
  allocate per particle in a steady-state frame.
- Use packed structure-of-arrays storage where state is required.
- Maintain free/live indices without `Array.splice`, linked JS objects, or
  component instances.
- Compile immutable definitions to backend-specific execution plans once per
  definition and capability set.
- Keep one scheduler registration per running effect, not per emitter or
  particle.
- Never read pixels back from Canvas or GPU during normal simulation.
- Keep fixed bounds or author-supplied conservative bounds whenever possible.
- Group particles by renderer/material and issue the minimum number of state
  changes and draws.
- Clamp elapsed time after a delayed frame; stateful simulation uses bounded
  fixed substeps and retains or explicitly discards the remainder by contract.
- Stop requesting frames as soon as a non-looping system has drained.

Existing browser emitters reinforce the value of pooling, but CRC should prefer
packed numeric storage over an object-linked particle pool because its CPU and
GPU execution plans need predictable layouts.[^21]

The host timestamp must be used rather than assuming 60 Hz. Browsers run at
different refresh rates and commonly pause `requestAnimationFrame` in hidden
tabs.[^16] CRC's existing logical realm clock is the correct source; particle
simulation should not add an independent loop.

### Stateless execution

A stateless effect assigns each potential particle a stable index. Seeded hash
functions derive its random channels. Emission rules derive a birth time and
lifetime. At logical time `t`, a particle is alive when `birth <= t < birth +
lifetime`; its analytic modules derive position and appearance directly.

Advantages:

- no per-frame integration state;
- no free-list churn for ordinary looping emitters;
- no cumulative numeric drift;
- cheap restart and deterministic replay;
- straightforward prewarm;
- GPU execution without dynamic per-particle uploads;
- Canvas execution with reads from immutable tables and tight numeric loops.

The compiler must reject effects it cannot represent statelessly. It must not
silently approximate world-space moving emitters, collisions, or arbitrary
callbacks.

### Canvas2D path

Canvas2D may be hardware accelerated by a browser, but the API does not give
CRC a portable way to require or inspect GPU execution. “Use the GPU” cannot be
a Canvas2D contract. The reliable optimizations are algorithmic:

- pre-rasterize repeated paths, text, emoji, and complex sprites to tight
  offscreen images;
- cache a small number of useful raster sizes rather than scaling expensive
  sources repeatedly;
- batch identical shapes and minimize Canvas state changes;
- group by blend mode, image, and atlas page;
- avoid filters and oversized intermediate surfaces in the hot path;
- draw only live particles inside conservative bounds.

MDN specifically recommends pre-rendering repeated objects offscreen and
caching image sizes instead of scaling on every draw.[^17] Canvas supports
additive and other blend operations through `globalCompositeOperation`, so the
common fire/spark appearance does not require a custom pixel loop.[^18]

An animated `Particles2D` at the top-level root causes normal immediate-mode
root repaint. Placing it inside an explicit CRC `Layer` may isolate unrelated
static work, but the particle layer itself still repaints and composites each
frame. A large full-surface layer can cost more than it saves; scenarios must
measure tight and full-viewport cases.

Workers should not be part of the first design. A worker must own an
`OffscreenCanvas`; browser libraries warn that transferred canvas control can
no longer be used normally on the main thread.[^9] That conflicts with CRC's one
synchronous realm scheduler, shared paint order, events, and explicit Canvas
ownership. A future dedicated particle worker would need a deliberate bitmap
transaction and teardown contract, not a boolean optimization flag.

### WebGL2 settled-scene path

The first WebGL renderer should use one static quad (or point) plus instanced
attributes. WebGL2 directly supports attribute divisors and instanced draw
operations.[^6] The structural target is one draw per settled compatible batch,
not one draw initiated by each `Particles3D` component. The scene renderer may
merge compatible submissions when doing so preserves ownership, transforms,
material behavior, and diagnostics.

For stateless effects, the vertex shader receives effect parameters, logical
time, seed, and instance index and reconstructs particle state. Only small
effect-level uniforms change per frame. This is the preferred high-count path.

During WebGL composition, `Particles3D` should register:

- an immutable renderer/material description;
- its transform ancestry, conservative bounds, and interaction policy;
- effect-level time, seed, parameters, capacity, and definition identity;
- any renderer-owned GPU simulation job that must precede drawing; and
- resource recipes keyed to the owning context generation.

Scene settlement then resolves effective transforms and opacity, culling,
material/light bindings, depth behavior, render passes, batch keys, and ordering.
Only the completed snapshot can issue GL commands. This keeps later lights,
environment components, and ancestor opacity capable of affecting particle
submissions regardless of JSX source position.

For stateful effects, two implementation levels are possible:

1. CPU simulation plus one packed dynamic buffer upload and instanced draw.
   This is simpler, debuggable, and useful for modest counts or features that
   need CPU-visible state.
2. GPU simulation through ping-pong transform-feedback buffers, followed by an
   instanced or point draw from the candidate buffer. WebGL2 transform feedback
   records vertex-shader outputs into buffers; Babylon uses it to move particle
   animation and rendering to the GPU.[^7] In the settled scene this is an
   explicit pre-draw dependency, not a side effect of composing `Particles3D`.

The second level is not a universal replacement. GPU particles can lose
features, consume resources in coarse groups, be a poor choice when the GPU is
already saturated, and make CPU-visible events or exact inspection expensive.
Epic recommends measuring CPU versus GPU against the actual platform and
workload rather than assuming GPU always wins.[^8]

All programs, textures, buffers, vertex arrays, and transform-feedback objects
must be acquired through the owning `WebGLLayer` context generation and
released on dependency change, context loss, component removal, render failure,
layer removal, or root disposal. Context restoration recreates a valid effect
generation from the immutable definition and current committed system state.

CRC's WebGL islands transfer a completed `ImageBitmap` into Canvas paint order.
Continuous particles invalidate that island every frame, so the transfer and
Canvas composite are part of the unavoidable cost. `OffscreenCanvas` can
produce an `ImageBitmap` without a transfer copy, but a fresh completed frame
still crosses the island boundary.[^19] Performance work must measure the entire
island transaction, not just shader time.

### Sorting, opacity, and transparency

Transparent particle sorting is expensive and underspecified if treated as an
automatic detail. The definition should make it explicit:

- `none`: fastest; recommended for additive effects and order-insensitive
  sprites;
- `oldestFirst` or `youngestFirst`: stable index/order traversal;
- `distance`: optional and capacity-limited, with clear CPU/GPU behavior;
- emitter order: stable definition order where two compatible particle batches
  still require a deterministic tie break.

There are two distinct ordering problems. The particle executor owns ordering
among particles within one submission. The settled scene owns ordering between
that submission and other transparent scene objects; ordinary JSX source order
must not accidentally become the 3D visibility model. An explicit scene render
order may remain as an expert escape hatch for overlays or ambiguous coplanar
content.

Depth testing and depth writing are separate WebGL renderer settings. The new
scene model makes soft particles technically possible against depth produced by
objects in the same `WebGLLayer`, provided the renderer deliberately exposes a
sampleable resolved-depth resource. They remain a later feature. Particles
cannot sample depth from Canvas content or a different WebGL island.

### Bounds, culling, and quality

Every effect needs finite conservative bounds or a compiler-derived bound for
analytic shapes and forces. Dynamic GPU bounds would require readback and should
not be the default. Godot notes that capturing live GPU particle bounds can
synchronize rendering and hurt performance.[^3]

Capacity is a resource commitment, not a visual hint. Changing it may recreate
storage and restart the system. A separate emission or quality scale can reduce
active work without reallocating. Quality adaptation should be explicit and
deterministic—application-selected tiers or a signal—not an invisible algorithm
that changes output based on timing.

## CRC scheduler and lifecycle integration

Particle work belongs in the existing Begin, Advance, Commit, Plan, Render, and
Complete frame:

| Phase    | Particle work                                                                                                                                                                     |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Begin    | Accept ordered play, pause, restart, emit, stop, and clear commands.                                                                                                              |
| Advance  | Advance component-owned logical time; update stateful CPU simulations or stage the render-time interval.                                                                          |
| Commit   | Publish observed status and active-count changes atomically where needed.                                                                                                         |
| Plan     | Mark only the owning root or managed Layer and required ancestors dirty.                                                                                                          |
| Render   | Draw Canvas particles. For WebGL, compose particle submissions, settle the completed scene, execute simulation dependencies and scene passes, then commit the island transaction. |
| Complete | Deliver start, burst, drain, finish, and error callbacks in stable order.                                                                                                         |

GPU state mutation occurs in a scene-renderer simulation pass rather than
pretending that WebGL commands executed during Advance can be rolled back like
staged signals. The contract must state what happens after failed composition,
settlement, simulation, or drawing. The safest model is transactional double
buffering: do not publish the candidate particle generation, bitmap, or picking
snapshot until the full island render succeeds. If any part fails, retain the
last committed transaction where possible, then follow the owning WebGL
failure and teardown rules.

Definitions and option candidates are adopted only after a successful component
render. A changed definition identity should restart the effect because it may
change particle storage layout, renderer grouping, or shaders. Dynamic
parameters need explicit spawn/update/render categories so authors can know
whether changes affect future particles, living particles, or only appearance.

Removal, failed root render, abort, context loss, layer removal, or disposal
must release scheduler registration, queued commands, buffers, textures,
surfaces, callbacks, and playback bindings exactly once. Stale controls become
inert, matching `CRCPlayback`.

## Interaction and accessibility

Effects should default to decorative participation. Per-particle hit testing is
incompatible with the intended batching model and would create identity,
readback, and accessibility expectations the system cannot satisfy.

If a particle component accepts `pointerEvents="auto"`, the target should be
the declared system box or an explicit author-supplied interaction path. It
must never infer a changing target from the visible particle silhouette.
Pointer-driven forces should consume root-logical pointer coordinates through
an ordinary CRC listener or signal parameter; they are not hit testing.

Particle effects should not be keyboard-focusable by default and should not
create logical accessibility children. If particles represent individually
selectable data, the author needs a different component designed around stable
marks and semantics.

Reduced motion needs an authoring path from the first release. A practical CRC
pattern is to choose between full and reduced effect definitions from an
application signal or policy. Decorative effects can resolve immediately with
no emission; essential status feedback can use opacity, color, or a smaller
static/low-motion alternative. The particle API should not unilaterally inspect
media queries inside an `OffscreenCanvas` or decide that all particles are
nonessential.

## Deliberate exclusions

The focused effects design should initially exclude:

- arbitrary per-particle JSX or component children;
- per-particle handlers, focus, refs, or semantic nodes;
- general rigid-body, constraint, collision-world, or fluid simulation;
- neighbor forces, flocking, SPH, and arbitrary N-body behavior;
- automatic collisions against Canvas pixels or arbitrary CRC geometry;
- exact CPU/GPU or cross-browser pixel equivalence;
- synchronous GPU readback or public mutable particle arrays;
- automatic hidden WebGL acceleration for a Canvas2D component;
- automatic worker transfer of the root or Layer Canvas;
- soft particles against Canvas content or a different WebGL island;
- dynamic GPU bounds readback;
- arbitrary GLSL snippets in the first public surface;
- silent backend fallback that changes capacity or behavior;
- a visual effect editor or serialized asset format before the runtime model is
  proven.

Sub-emitters, simple colliders, path/mesh/mask emission, trails, multiple
renderers, custom modules, and stateful GPU simulation belong to later staged
projects. The umbrella design should reserve coherent semantics for them
without implying that the first package release implements every tier.

## Recommended delivery sequence

### WebGL prerequisite: settled-scene rendering

The WebGL particle tranche must follow an approved and implemented
`WebGLLayer` compose-settle-render-commit contract. That work needs to define
the scene-aware submission seam, effective opacity and material resolution,
pass dependencies, transparent ordering, transactional publication, context
generation ownership, and interaction snapshot timing. Particle work may
continue on the shared definition language and Canvas2D executor in parallel,
but it must not implement an immediate raw-GL compatibility path while waiting
for the scene contract.

### Study 0: prove the execution architecture

Before freezing the public API, define four public-API scenarios and success
criteria:

1. Canvas celebration: repeated confetti bursts with custom cached shapes,
   completion, and a reduced-motion alternative.
2. WebGL ambient field: a high-count snow, ember, or star effect using one
   stateless settled-scene submission and one compatible instanced batch.
3. Moving trail: world-space exhaust or dust that proves distance emission and
   exposes the stateless/stateful boundary.
4. Layered effect: firework or fire/smoke composition with stable emitter order
   and two blend modes.

Collect raw Canvas2D and WebGL2 baselines before choosing capacity targets. The
goal is not one universal “particles per second” number; it is predictable
scaling and bounded overhead on a documented desktop/mobile matrix.

### Stage 1: immutable definitions and stateless renderers

Ship only if Study 0 supports the product case:

- immutable 2D and 3D effect/emitter definitions;
- seedable constants, ranges, curves, and gradients;
- time rate, scheduled burst, and manual named burst;
- analytic emitter shapes;
- local-space analytic motion;
- shape/sprite Canvas renderer;
- point/billboard WebGL renderer with instancing;
- per-emitter capacity and overflow, bounds, blend mode, and explicit sorting
  policy;
- component-owned play/pause/restart/emit/stop controls;
- status, selected execution, completion, errors, capability-qualified
  diagnostics, and exact teardown;
- reduced-definition example and guidance.

### Stage 2: stateful CPU effects

- packed fixed-step simulation;
- world-space moving emitters and inherited velocity;
- distance emission;
- pointer attract/repel and simple bounds/wrap behavior;
- velocity-stretched sprites;
- precomputed path or mask sampling if scenarios justify it.

Canvas2D and WebGL2 can share this simulation, with WebGL receiving one packed
dynamic upload per material group.

### Stage 3: stateful GPU effects

- transform-feedback simulation behind an explicit capability;
- supported built-in stateful modifiers only;
- transactional ping-pong generations and context restoration;
- structural evidence for no readback, bounded draws, and exact resource
  release;
- CPU/GPU perceptual-equivalence scenarios with numeric tolerances.

### Stage 4: advanced extensions and presets

Add sub-emitters, trails or ribbons, multiple renderers, simple colliders, mesh
emission, custom CPU module definition, and capability-qualified inspection as
their proving scenarios require. Promote stable confetti, snow, sparks, embers,
smoke, fireworks, exhaust, and starfield recipes into tree-shakable preset
factories. Keep point clouds, data marks, and general force layouts separate
unless shared internals clearly justify a common lower-level packed-instance
abstraction.

## Verification and performance gates

Before a public surface is approved, require:

### Semantic evidence

- exact seeded emission counts and lifetimes under a controlled frame driver;
- rate, burst, pause, resume, drain, clear, overflow, and completion behavior;
- local/world transform semantics and moving-emitter history;
- definition-change and parameter-change adoption rules;
- hidden-tab or large-delta clamping behavior;
- reduced-effect selection and immediate decorative completion;
- stable emitter/render order and layout/filter/clip composition;
- context loss, render failure, removal, and disposal behavior.

### Structural evidence

- zero steady-state per-particle JS allocation;
- one realm frame regardless of the number of running roots and Layers;
- one scheduler registration per running effect;
- no CRC element/component traversal per particle;
- one WebGL instanced draw per settled compatible batch in the base path;
- zero WebGL commands during component composition;
- particle submissions finalized by the same opacity, material, depth,
  transparency, lighting, and post-processing planner as ordinary scene
  objects;
- zero per-particle CPU update and zero dynamic particle upload in the stateless
  WebGL path;
- no pixel or GPU readback during normal execution;
- exact counters for buffers, textures, programs, vertex arrays,
  transform-feedback objects, sprite rasters, and system registrations;
- Canvas state and WebGL baseline restoration after success and failure.

### Measured evidence

- p50 and p95 frame cost across increasing capacities;
- CPU advance, WebGL scene composition/settlement, Canvas draw, WebGL
  simulation/draw passes, bitmap transfer, and Canvas composite measured
  separately where possible;
- high-density and responsive resize behavior;
- a current desktop and mobile browser/device matrix;
- comparison with direct raw Canvas2D and direct WebGL2 implementations of the
  same effect;
- explicit quality thresholds chosen only after baselines exist.

Do not make controlled wall-clock measurements part of the deterministic
correctness gate. Keep them opt-in and record the exact environment.

## Recommendation

Proceed to a formal architectural design, followed by a proving implementation
tranche before the full surface is considered stable.

The design should specify an optional `@crc/core/particles` package with immutable
effect definitions, a component-owned system, a Canvas2D `Particles2D`
component, and a `@crc/core/particles/webgl` `Particles3D` scene contributor. The
WebGL portion should be specified only after the settled-scene contract exposes
the required official extension seam. The first
implementation tranche should exercise one stateless effect in each backend and
measure the whole CRC frame transaction. The WebGL probe should reconstruct
particles from time, index, and seed in the vertex shader; the Canvas probe
should use the same effect definition with a tight allocation-free loop and
cached sprites.

The key go/no-go questions are:

1. Does a focused particle-effects feature unlock compelling CRC applications
   without becoming a general simulation engine?
2. Can one shared definition language remain honest about Canvas2D and WebGL2
   capability differences?
3. Does stateless compilation cover enough real effects to justify the feature?
4. Can repeated bursts reuse one mounted system cleanly within CRC's component
   ownership model?
5. Does the WebGL island bitmap transaction leave enough headroom for the GPU
   advantage to matter?
6. Can Canvas2D provide a useful lower-count tier without promising GPU
   execution?
7. Can the settled-scene extension seam express particle simulation
   dependencies, batching, effective opacity, and transparent ordering without
   allowing GL work during component composition?

The architectural design should answer these questions and name the exact
public types, contracts, capability errors, and staged extension seams. Until
that design is approved, the API sketches here remain hypotheses.

## Sources

[^1]: Unity Technologies. “[Particle effects](https://docs.unity3d.com/Manual/ParticleSystems.html).” Unity 6.6 Manual, 2026.

[^2]: Unity Technologies. “[Particle System module component reference](https://docs.unity3d.com/Manual/ParticleSystemModules.html).” Unity 6.6 Manual, 2026.

[^3]: Godot Engine. “[GPUParticles2D](https://docs.godotengine.org/en/4.5/classes/class_gpuparticles2d.html).” Godot 4.5 documentation.

[^4]: Godot Engine. “[ParticleProcessMaterial](https://docs.godotengine.org/en/stable/classes/class_particleprocessmaterial.html).” Stable documentation.

[^5]: Epic Games. “[Niagara Lightweight Emitters Overview](https://dev.epicgames.com/documentation/unreal-engine/niagara-lightweight-emitters-overview).” Unreal Engine 5.8 documentation.

[^6]: Khronos Group. “[WebGL 2.0 Specification](https://registry.khronos.org/webgl/specs/latest/2.0/).” Sections covering instanced drawing and transform feedback.

[^7]: Babylon.js. “[GPU Particles](https://github.com/BabylonJS/Documentation/blob/master/content/features/featuresDeepDive/particles/particle_system/gpu_particles.md).” Babylon.js documentation.

[^8]: Epic Games. “[Scalability and Best Practices for Niagara](https://dev.epicgames.com/documentation/unreal-engine/scalability-and-best-practices-for-niagara).” Unreal Engine 5.8 documentation.

[^9]: Colin Ihrig. “[canvas-confetti](https://github.com/catdad/canvas-confetti).” API and implementation guidance.

[^10]: Unity Technologies. “[Emission Module](https://docs.unity3d.com/6000.0/Documentation/ScriptReference/ParticleSystem.EmissionModule.html).” Unity 6 scripting API.

[^11]: MDN Web Docs. “[prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion).” 2026.

[^12]: W3C. “[Web Content Accessibility Guidelines 2.1, Success Criterion 2.3.3](https://www.w3.org/TR/WCAG21/#animation-from-interactions).” Updated Recommendation.

[^13]: tsParticles. “[Particles bundle](https://particles.js.org/guide/bundles-particles).” 2026 documentation.

[^14]: Observable. “[d3-force](https://d3js.org/d3-force).” D3 documentation.

[^15]: Unity Technologies. “[Particle System Renderer Module](https://docs.unity3d.com/Manual/PartSysRendererModule.html).” Unity Manual.

[^16]: MDN Web Docs. “[Window: requestAnimationFrame()](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame).” 2026.

[^17]: MDN Web Docs. “[Optimizing canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas).” 2026.

[^18]: MDN Web Docs. “[CanvasRenderingContext2D: globalCompositeOperation](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/globalCompositeOperation).” 2026.

[^19]: MDN Web Docs. “[OffscreenCanvas](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas).” 2026.

[^20]: PixiJS. “[ParticleContainer](https://pixijs.download/dev/docs/scene.ParticleContainer.html).” Development documentation.

[^21]: PixiJS Particle Emitter. “[Emitter](https://particle-emitter.pixijs.io/docs/classes/Emitter.html).” API documentation.

[^22]: Epic Games. “[Niagara Overview](https://dev.epicgames.com/documentation/en-us/unreal-engine/niagara-overview?application_version=4.27).” Unreal Engine 4.27 documentation.

[^23]: Epic Games. “[Overview of Niagara Effects](https://dev.epicgames.com/documentation/unreal-engine/overview-of-niagara-effects-for-unreal-engine).” Unreal Engine 5.8 documentation.

[^24]: Babylon.js. “[ParticleHelper](https://github.com/BabylonJS/Babylon.js/blob/master/packages/dev/core/src/Particles/particleHelper.ts).” Babylon.js source documentation.

[^25]: tsParticles. “[Official presets](https://github.com/tsparticles/presets).” Preset catalog and usage guidance, archived April 15, 2026.

[^26]: W3C. “[CSS Easing Functions Level 2](https://www.w3.org/TR/css-easing-2/).” Working Draft, August 29, 2024.

[^27]: Unity Technologies. “[ParticleSystem.MinMaxCurve](https://docs.unity3d.com/cn/6000.0/ScriptReference/ParticleSystem.MinMaxCurve.html).” Unity 6 scripting API.

[^28]: Godot Engine. “[3D particle collisions](https://docs.godotengine.org/en/stable/tutorials/3d/particles/collision.html).” Stable documentation.

[^29]: Unity Technologies. “[Collision module reference](https://docs.unity3d.com/ja/6000.0/Manual/PartSysCollisionModule.html).” Unity 6 Manual.

[^30]: Box2D. “[Simulation](https://box2d.org/documentation/md_simulation.html).” Box2D 3.1 documentation.

[^31]: Dimforge. “[Scene queries](https://rapier.rs/docs/user_guides/javascript/scene_queries/).” Rapier JavaScript documentation.
