---
id: api-types-particles
title: Particle types
summary: Definitions, descriptors, execution state, emitters, renderers, component props, and styles for @crc/core/particles.
kind: api
slug: particles
apiCategory: types
typeDomain: particles
symbols:
  [
    CRCFlowField2D,
    CRCFlowFieldOptions2D,
    CRCFlowObstacleBatch2D,
    CRCFlowObstacleSource2D,
    CRCFlowSourceOptions2D,
    CRCParticleAppearance,
    CRCParticleBounds2D,
    CRCParticleBurstAcceptedEvent,
    CRCParticleBurstOverrides,
    CRCParticleBurstRejectedEvent,
    CRCParticleChoice,
    CRCParticleCommonProps,
    CRCParticleCurve,
    CRCParticleCurveOptions,
    CRCParticleCurveValue,
    CRCParticleDiagnostic,
    CRCParticleDrainStartEvent,
    CRCParticleEffect2D,
    CRCParticleEffect2DInput,
    CRCParticleEmission,
    CRCParticleEmitter2D,
    CRCParticleExecution,
    CRCParticleFinishEvent,
    CRCParticleGradient,
    CRCParticleInitial2D,
    CRCParticleIntegerRange,
    CRCParticleMotion2D,
    CRCParticleOverflow,
    CRCParticleParameterDefinition,
    CRCParticleParameterDefinitions,
    CRCParticleParameterReference,
    CRCParticleParameterTiming,
    CRCParticleParameterValue,
    CRCParticleParameterValues,
    CRCParticleRange,
    CRCParticleRenderer2D,
    CRCParticleScalar,
    CRCParticleShape2D,
    CRCParticleStartEvent,
    CRCParticleSystem,
    CRCParticleSystemEvent,
    CRCParticleSystemOptions,
    CRCParticleSystemStatus,
    CRCParticleValueFor,
    CRCParticleValuesOf,
    CRCParticleVector2,
    Particles2DProps,
    Particles2DStyle,
  ]
keywords: [particles, types, emitters, canvas, execution]
---

# Particle types

Import these public contracts with `type` from `@crc/core/particles`.

## `CRCFlowField2D`

A component-owned field handle with a readonly revision signal and batched
velocity sampling into caller-owned numerical buffers.

## `CRCFlowFieldOptions2D`

Mount-only bounds and grid resolution, an optional obstacle source, and a
buoyancy acceleration coefficient (default `-300`).

## `CRCFlowObstacleBatch2D`

A revision, a borrowed `Float64Array` of packed `boxes`, and optional borrowed
`ellipses` and `polygons` arrays. Each box occupies ten
entries: center x/y, half width/height, rotation in radians, linear velocity x/y,
angular velocity in radians/second, and center of mass x/y. All quantities use
field-local logical coordinates. Ellipses use the same layout, with radii instead
of half extents. Each polygon record contains vertex count (at least three),
linear velocity x/y, angular velocity, center of mass x/y, then vertex x/y pairs.
Extents must be positive. Increment revision
whenever geometry or motion changes; unchanged revisions reuse the solid grid.

## `CRCFlowObstacleSource2D`

A `read()` method returning the latest committed obstacle batch. A read must not
advance its upstream simulation. The field copies relevant data into its own
storage and does not retain the batch buffer or assume shared WASM memory.

## `CRCFlowSourceOptions2D`

Signal-valued position, positive radius, optional acceleration, nonnegative
heat injection rate, and enabled state. Sources drive flow independently of
particle emission.

## `CRCParticleAppearance`

Optional size, rotation, color, and opacity values sampled over normalized lifetime.

## `CRCParticleBounds2D`

A conservative local two-dimensional minimum and maximum used for coarse culling.

## `CRCParticleBurstAcceptedEvent`

Reports the requested and accepted counts for an admitted manual burst.

## `CRCParticleBurstOverrides`

Overrides count, local position, seed salt, or parameters for one manual birth request.

## `CRCParticleBurstRejectedEvent`

Reports a capacity, pause, stop, or disposal rejection and its accepted count.

## `CRCParticleChoice`

An immutable weighted-selection descriptor created by `particleChoice`.

## `CRCParticleCommonProps`

Shared parameter, event, error, pointer, and keyboard props for particle components.

## `CRCParticleCurve`

An immutable scalar or two-dimensional curve over normalized lifetime.

## `CRCParticleCurveOptions`

Optional CRC easing applied within curve or gradient key intervals.

## `CRCParticleCurveValue`

The scalar or two-dimensional value accepted by `particleCurve`.

## `CRCParticleDiagnostic`

The closed definition, capability, asset, binding, capacity, execution, and disposal diagnostic union.

## `CRCParticleDrainStartEvent`

Marks the committed transition that closes new emission while existing particles finish.

## `CRCParticleEffect2D`

A nominal immutable two-dimensional definition carrying emitter and parameter inference.

## `CRCParticleEffect2DInput`

The debug name, parameter definitions, and nonempty 2D emitter input.

## `CRCParticleEmission`

Rate, scheduled burst, or manual emission configuration.

## `CRCParticleEmitter2D`

A fixed-capacity Canvas emitter with shape, initial state, motion, appearance, renderer, and bounds.

## `CRCParticleExecution`

The readonly selected backend state published by a particle system.

## `CRCParticleFinishEvent`

Marks a drained finite population reaching its completed empty frame.

## `CRCParticleGradient`

An immutable color curve created by `particleGradient`.

## `CRCParticleInitial2D`

Lifetime, velocity, size, rotation, color, and opacity sampled at 2D birth.

## `CRCParticleIntegerRange`

An inclusive safe-integer descriptor created by `particleInteger`.

## `CRCParticleMotion2D`

The closed two-dimensional acceleration, drag, drift, radial, orbit, sway, and angular module union.

## `CRCParticleOverflow`

Either deterministic `"reject-newest"` or `"recycle-oldest"` capacity behavior.

## `CRCParticleParameterDefinition`

A typed number, vector, or color default with spawn, simulation, or render timing.

## `CRCParticleParameterDefinitions`

The named parameter-definition record accepted by an effect.

## `CRCParticleParameterReference`

An immutable named reference created by `particleParameter`.

## `CRCParticleParameterTiming`

The `"spawn"`, `"simulation"`, or `"render"` parameter adoption category.

## `CRCParticleParameterValue`

The number, color string, or two-dimensional vector value union.

## `CRCParticleParameterValues`

A readonly named parameter-value record.

## `CRCParticleRange`

A continuous minimum/maximum descriptor created by `particleRange`.

## `CRCParticleRenderer2D`

The circle, rectangle, path, or sprite Canvas renderer union and its blend intent.

## `CRCParticleScalar`

A fixed number or compiled range, integer, choice, or parameter descriptor.

## `CRCParticleShape2D`

The point, line, rectangle, circle, or ring birth-shape union.

## `CRCParticleStartEvent`

Marks a committed system start.

## `CRCParticleSystem`

Stable controls plus readonly status and execution signals for one owned population.

## `CRCParticleSystemEvent`

The start, burst acceptance/rejection, drain, and finish event union.

## `CRCParticleSystemOptions`

Autoplay, seed, debug name, event, and error options for `useParticleSystem`.

## `CRCParticleSystemStatus`

The idle, scheduled, running, paused, draining, finished, or disposed lifecycle state.

## `CRCParticleValueFor`

Maps one parameter definition to its accepted runtime value type.

## `CRCParticleValuesOf`

Maps a named parameter-definition record to its inferred value record.

## `CRCParticleVector2`

A two-component scalar tuple or compatible named parameter reference.

## `Particles2DProps`

Exactly one 2D effect or system plus shared interaction and parameter props.

## `Particles2DStyle`

Declared Canvas box, layout-item, cursor, opacity, transform, and filter style.
