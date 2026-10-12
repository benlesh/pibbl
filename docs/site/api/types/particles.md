---
id: api-types-particles
title: Particle types
summary: Definitions, descriptors, execution state, emitters, renderers, component props, and styles for @pibbl/core/particles.
kind: api
slug: particles
apiCategory: types
typeDomain: particles
symbols:
  [
    Particles2DProps,
    Particles2DStyle,
    PibblFlowField2D,
    PibblFlowFieldOptions2D,
    PibblFlowObstacleBatch2D,
    PibblFlowObstacleSource2D,
    PibblFlowSourceOptions2D,
    PibblParticleAppearance,
    PibblParticleBounds2D,
    PibblParticleBurstAcceptedEvent,
    PibblParticleBurstOverrides,
    PibblParticleBurstRejectedEvent,
    PibblParticleChoice,
    PibblParticleCommonProps,
    PibblParticleCurve,
    PibblParticleCurveOptions,
    PibblParticleCurveValue,
    PibblParticleDiagnostic,
    PibblParticleDrainStartEvent,
    PibblParticleEffect2D,
    PibblParticleEffect2DInput,
    PibblParticleEmission,
    PibblParticleEmitter2D,
    PibblParticleExecution,
    PibblParticleFinishEvent,
    PibblParticleGradient,
    PibblParticleInitial2D,
    PibblParticleIntegerRange,
    PibblParticleMotion2D,
    PibblParticleOverflow,
    PibblParticleParameterDefinition,
    PibblParticleParameterDefinitions,
    PibblParticleParameterReference,
    PibblParticleParameterTiming,
    PibblParticleParameterValue,
    PibblParticleParameterValues,
    PibblParticleRange,
    PibblParticleRenderer2D,
    PibblParticleScalar,
    PibblParticleShape2D,
    PibblParticleStartEvent,
    PibblParticleSystem,
    PibblParticleSystemEvent,
    PibblParticleSystemOptions,
    PibblParticleSystemStatus,
    PibblParticleValueFor,
    PibblParticleValuesOf,
    PibblParticleVector2,
  ]
keywords: [particles, types, emitters, canvas, execution]
---

# Particle types

Import these public contracts with `type` from `@pibbl/core/particles`.

## `Particles2DProps`

Exactly one 2D effect or system plus shared interaction and parameter props.

## `Particles2DStyle`

Declared Canvas box, layout-item, cursor, opacity, transform, and filter style.

## `PibblFlowField2D`

A component-owned field handle with a readonly revision signal and batched
velocity sampling into caller-owned numerical buffers.

## `PibblFlowFieldOptions2D`

Mount-only bounds and grid resolution, an optional obstacle source, and a
buoyancy acceleration coefficient (default `-300`).

## `PibblFlowObstacleBatch2D`

A revision, a borrowed `Float64Array` of packed `boxes`, and optional borrowed
`ellipses` and `polygons` arrays. Each box occupies ten
entries: center x/y, half width/height, rotation in radians, linear velocity x/y,
angular velocity in radians/second, and center of mass x/y. All quantities use
field-local logical coordinates. Ellipses use the same layout, with radii instead
of half extents. Each polygon record contains vertex count (at least three),
linear velocity x/y, angular velocity, center of mass x/y, then vertex x/y pairs.
Extents must be positive. Increment revision
whenever geometry or motion changes; unchanged revisions reuse the solid grid.

## `PibblFlowObstacleSource2D`

A `read()` method returning the latest committed obstacle batch. A read must not
advance its upstream simulation. The field copies relevant data into its own
storage and does not retain the batch buffer or assume shared WASM memory.

## `PibblFlowSourceOptions2D`

Signal-valued position, positive radius, optional acceleration, nonnegative
heat injection rate, and enabled state. Sources drive flow independently of
particle emission.

## `PibblParticleAppearance`

Optional size, rotation, color, and opacity values sampled over normalized lifetime.

## `PibblParticleBounds2D`

A conservative local two-dimensional minimum and maximum used for coarse culling.

## `PibblParticleBurstAcceptedEvent`

Reports the requested and accepted counts for an admitted manual burst.

## `PibblParticleBurstOverrides`

Overrides count, local position, seed salt, or parameters for one manual birth request.

## `PibblParticleBurstRejectedEvent`

Reports a capacity, pause, stop, or disposal rejection and its accepted count.

## `PibblParticleChoice`

An immutable weighted-selection descriptor created by `particleChoice`.

## `PibblParticleCommonProps`

Shared parameter, event, error, pointer, and keyboard props for particle components.

## `PibblParticleCurve`

An immutable scalar or two-dimensional curve over normalized lifetime.

## `PibblParticleCurveOptions`

Optional Pibbl easing applied within curve or gradient key intervals.

## `PibblParticleCurveValue`

The scalar or two-dimensional value accepted by `particleCurve`.

## `PibblParticleDiagnostic`

The closed definition, capability, asset, binding, capacity, execution, and disposal diagnostic union.

## `PibblParticleDrainStartEvent`

Marks the committed transition that closes new emission while existing particles finish.

## `PibblParticleEffect2D`

A nominal immutable two-dimensional definition carrying emitter and parameter inference.

## `PibblParticleEffect2DInput`

The debug name, parameter definitions, and nonempty 2D emitter input.

## `PibblParticleEmission`

Rate, scheduled burst, or manual emission configuration.

## `PibblParticleEmitter2D`

A fixed-capacity Canvas emitter with shape, initial state, motion, appearance, renderer, and bounds.

## `PibblParticleExecution`

The readonly selected backend state published by a particle system.

## `PibblParticleFinishEvent`

Marks a drained finite population reaching its completed empty frame.

## `PibblParticleGradient`

An immutable color curve created by `particleGradient`.

## `PibblParticleInitial2D`

Lifetime, velocity, size, rotation, color, and opacity sampled at 2D birth.

## `PibblParticleIntegerRange`

An inclusive safe-integer descriptor created by `particleInteger`.

## `PibblParticleMotion2D`

The closed two-dimensional acceleration, drag, drift, radial, orbit, sway, and angular module union.

## `PibblParticleOverflow`

Either deterministic `"reject-newest"` or `"recycle-oldest"` capacity behavior.

## `PibblParticleParameterDefinition`

A typed number, vector, or color default with spawn, simulation, or render timing.

## `PibblParticleParameterDefinitions`

The named parameter-definition record accepted by an effect.

## `PibblParticleParameterReference`

An immutable named reference created by `particleParameter`.

## `PibblParticleParameterTiming`

The `"spawn"`, `"simulation"`, or `"render"` parameter adoption category.

## `PibblParticleParameterValue`

The number, color string, or two-dimensional vector value union.

## `PibblParticleParameterValues`

A readonly named parameter-value record.

## `PibblParticleRange`

A continuous minimum/maximum descriptor created by `particleRange`.

## `PibblParticleRenderer2D`

The circle, rectangle, path, or sprite Canvas renderer union and its blend intent.

## `PibblParticleScalar`

A fixed number or compiled range, integer, choice, or parameter descriptor.

## `PibblParticleShape2D`

The point, line, rectangle, circle, or ring birth-shape union.

## `PibblParticleStartEvent`

Marks a committed system start.

## `PibblParticleSystem`

Stable controls plus readonly status and execution signals for one owned population.

## `PibblParticleSystemEvent`

The start, burst acceptance/rejection, drain, and finish event union.

## `PibblParticleSystemOptions`

Autoplay, seed, debug name, event, and error options for `useParticleSystem`.

## `PibblParticleSystemStatus`

The idle, scheduled, running, paused, draining, finished, or disposed lifecycle state.

## `PibblParticleValueFor`

Maps one parameter definition to its accepted runtime value type.

## `PibblParticleValuesOf`

Maps a named parameter-definition record to its inferred value record.

## `PibblParticleVector2`

A two-component scalar tuple or compatible named parameter reference.
