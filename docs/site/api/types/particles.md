---
id: api-types-particles
title: Particle types
summary: Definitions, descriptors, execution state, emitters, renderers, component props, and styles for @crc/particles.
kind: api
slug: particles
apiCategory: types
typeDomain: particles
symbols:
  [
    CRCParticleAppearance,
    CRCParticleBounds2D,
    CRCParticleBounds3D,
    CRCParticleBurstAcceptedEvent,
    CRCParticleBurstOverrides,
    CRCParticleBurstRejectedEvent,
    CRCParticleChoice,
    CRCParticleCommonProps,
    CRCParticleConeVelocity3D,
    CRCParticleCurve,
    CRCParticleCurveOptions,
    CRCParticleCurveValue,
    CRCParticleDiagnostic,
    CRCParticleDrainStartEvent,
    CRCParticleEffect2D,
    CRCParticleEffect2DInput,
    CRCParticleEffect3D,
    CRCParticleEffect3DInput,
    CRCParticleEmission,
    CRCParticleEmitter2D,
    CRCParticleEmitter3D,
    CRCParticleExecution,
    CRCParticleExecutionCapability,
    CRCParticleFinishEvent,
    CRCParticleGradient,
    CRCParticleInitial2D,
    CRCParticleInitial3D,
    CRCParticleIntegerRange,
    CRCParticleMotion2D,
    CRCParticleMotion3D,
    CRCParticleOverflow,
    CRCParticleParameterDefinition,
    CRCParticleParameterDefinitions,
    CRCParticleParameterReference,
    CRCParticleParameterTiming,
    CRCParticleParameterValue,
    CRCParticleParameterValues,
    CRCParticleRange,
    CRCParticleRenderer2D,
    CRCParticleRenderer3D,
    CRCParticleScalar,
    CRCParticleShape2D,
    CRCParticleShape3D,
    CRCParticleStartEvent,
    CRCParticleSystem,
    CRCParticleSystemEvent,
    CRCParticleSystemOptions,
    CRCParticleSystemStatus,
    CRCParticleValueFor,
    CRCParticleValuesOf,
    CRCParticleVector2,
    CRCParticleVector3,
    Particles2DProps,
    Particles2DStyle,
    Particles3DProps,
    Particles3DStyle,
  ]
keywords: [particles, types, emitters, renderers, execution]
---

# Particle types

Import shared and Canvas types from `@crc/particles`. Import 3D-only effect,
emitter, renderer, bounds, props, and style types from
`@crc/particles/webgl`.

## `CRCParticleAppearance`

Optional size, rotation, color, and opacity values sampled over normalized lifetime.

## `CRCParticleBounds2D`

A conservative local two-dimensional minimum and maximum used for coarse culling.

## `CRCParticleBounds3D`

A conservative local three-dimensional minimum and maximum used for scene culling and interaction.

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

## `CRCParticleConeVelocity3D`

A three-dimensional cone direction, speed, and spread descriptor.

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

## `CRCParticleEffect3D`

A nominal immutable three-dimensional definition carrying emitter and parameter inference.

## `CRCParticleEffect3DInput`

The debug name, parameter definitions, and nonempty 3D emitter input.

## `CRCParticleEmission`

Rate, scheduled burst, or manual emission configuration.

## `CRCParticleEmitter2D`

A fixed-capacity Canvas emitter with shape, initial state, motion, appearance, renderer, and bounds.

## `CRCParticleEmitter3D`

A fixed-capacity WebGL emitter with shape, initial state, motion, appearance, renderer, and bounds.

## `CRCParticleExecution`

The readonly selected backend state published by a particle system.

## `CRCParticleExecutionCapability`

A supported stateless mode or an unsupported stateful mode with exact reasons.

## `CRCParticleFinishEvent`

Marks a drained finite population reaching its completed empty frame.

## `CRCParticleGradient`

An immutable color curve created by `particleGradient`.

## `CRCParticleInitial2D`

Lifetime, velocity, size, rotation, color, and opacity sampled at 2D birth.

## `CRCParticleInitial3D`

Lifetime, vector or cone velocity, size, rotation, color, and opacity sampled at 3D birth.

## `CRCParticleIntegerRange`

An inclusive safe-integer descriptor created by `particleInteger`.

## `CRCParticleMotion2D`

The closed two-dimensional acceleration, drag, drift, radial, orbit, sway, and angular module union.

## `CRCParticleMotion3D`

The closed three-dimensional acceleration, drag, drift, radial, orbit, sway, and angular module union.

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

The number, color string, or two/three-dimensional vector value union.

## `CRCParticleParameterValues`

A readonly named parameter-value record.

## `CRCParticleRange`

A continuous minimum/maximum descriptor created by `particleRange`.

## `CRCParticleRenderer2D`

The circle, rectangle, path, or sprite Canvas renderer union and its blend intent.

## `CRCParticleRenderer3D`

The point or billboard WebGL renderer, material, blend, depth, and sorting intent.

## `CRCParticleScalar`

A fixed number or compiled range, integer, choice, or parameter descriptor.

## `CRCParticleShape2D`

The point, line, rectangle, circle, or ring birth-shape union.

## `CRCParticleShape3D`

The point, line, box, sphere, ring, or cone birth-shape union.

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

## `CRCParticleVector3`

A three-component scalar tuple or compatible named parameter reference.

## `Particles2DProps`

Exactly one 2D effect or system plus shared interaction and parameter props.

## `Particles2DStyle`

Declared Canvas box, layout-item, cursor, opacity, transform, and filter style.

## `Particles3DProps`

Exactly one 3D effect or system plus execution selection and optional interaction bounds.

## `Particles3DStyle`

WebGL transform, opacity, and cursor style; Canvas filters belong on `WebGLLayer`.
