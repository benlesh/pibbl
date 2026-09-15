# First-Class Particle Effects Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

> **Historical status: READY IMPLEMENTATION PLAN.** This plan covers Project 1 of the approved particle-effects design. Stateful CPU execution, stateful GPU execution, advanced effects, and presets require later plans.

**Goal:** Ship the optional @crc/particles package with immutable 2D/3D effect definitions, deterministic component-owned systems, stateless analytic execution, an allocation-stable Canvas2D renderer, and settled-scene WebGL point/billboard rendering.

**Architecture:** One frozen definition compiler produces backend-neutral emitter plans plus explicit capability results. One hook-owned particle system accepts commands in Begin, advances logical run state in Advance, publishes status in Commit, dirties only its bound renderer in Plan, and delivers diagnostics in Complete. Particles2D owns a preallocated analytic birth ledger and draws all particles from one private Canvas primitive. Particles3D contributes immutable instanced recipes during scene composition; @crc/webgl settles transform, opacity, material, depth, culling, and pass order before its renderer touches WebGL.

**Tech Stack:** TypeScript 7, CRC JSX/createElement runtime, CRC signals and realm scheduler, HTML Canvas 2D, OffscreenCanvas Layers and filters, WebGL2 settled scenes, Vitest Browser with Playwright Chromium, esbuild, pnpm 11.21.0, Node 24.15 or newer.

**Spec:** docs/superpowers/specs/2026-09-13-first-class-particle-effects-design.md

**Prerequisites:** The shared definition, controller, and Canvas tasks may begin after this plan review. Tasks 9–11 must not begin until docs/superpowers/plans/2026-09-13-webgl-settled-scene-rendering-implementation.md is complete and a separately approved ordinary WebGL unlit/emissive material-and-submission project has implemented and verified its normative contract.

## Global Constraints

- Preserve unrelated working-tree changes and untracked files. Stage only files named by the active task.
- Add a failing test before each production behavior change and run that test once to observe the expected failure.
- This is Project 1 only. Do not implement world-space particles, moving-emitter history, distance emission, collisions, pointer fields, noise, arbitrary per-particle callbacks, sub-emitters, trails, ribbons, mesh particles, transform feedback, soft particles, automatic adaptive quality, or preset entry points.
- Particles are components. Keep emission, capacity, lifetime, motion, appearance, renderer, depth, and blend settings out of style.
- Keep every individual particle outside CRC component identity, hooks, refs, events, focus, and layout. One mounted system owns one population and one component-level target at most.
- Definitions are deeply frozen nominal values with no clock, scheduler registration, decoded asset, Canvas surface, or GPU handle.
- Use one realm scheduler registration per running system and no independent requestAnimationFrame, timer, worker, or hidden WebGL context.
- Commands enter Begin in realm invocation order. Observable status and execution values publish in Commit. Milestones and isolated errors deliver in Complete after a successful render transaction. For each delivery, the system-option callback runs before the currently bound component callback; one callback failure is collected without suppressing the other or later deliveries.
- Definition, parameter, and binding candidates adopt only after a successful component render. A failed render preserves the previous committed definition, parameter snapshot, execution, resources, bitmap, picker, and focus metadata.
- Time-based stateless motion samples logical time analytically. Do not integrate display-frame deltas.
- Allocate per-capacity storage once. The steady-state Canvas particle loop performs no per-particle object, array, closure, component, or element allocation.
- The Project 1 WebGL path supports automatic rate and scheduled-burst emitters with fixed spawn/simulation parameters plus live render parameters. Definitions using manual births, changing spawn/simulation parameters, or any stateful-only module remain valid but report that they require the later stateful CPU WebGL tier.
- The Project 1 Canvas path supports rate, scheduled burst, and manual emission with exact reject-newest and recycle-oldest behavior.
- Particles2D uses ordinary resolved allocation, layout placement, ancestor Group transforms, Clip, Layer, filter capture, opacity, source paint order, and one declared-box event target. It has no intrinsic measurement.
- Particles3D performs no WebGL work during component composition. It contributes immutable CPU-owned descriptions to the current WebGLLayer scene.
- WebGL settlement, not particle code, finalizes effective transform, opacity, material/pass classification, depth state, transparent ordering, culling, pick/focus projection, and post-processing participation.
- The WebGL renderer owns all programs, textures, buffers, vertex arrays, framebuffers, and context-generation disposal. @crc/particles never exposes or retains a WebGL2RenderingContext.
- Canvas and WebGL may differ in pixels and floating-point rounding. They must agree on seed channels, birth times, normalized lifetime, analytic equations, curve lookup rules, capacity policy, and milestone ordering within documented tolerances.
- Prefer semantic counts, times, bounds, pass order, draw counts, and ownership assertions before screenshot evidence. Inspect expected, actual, and diff output before accepting an intentional visual baseline.
- Use Node 24.15 or newer, pnpm 11.21.0, and Playwright Chromium for final evidence.

## File and Responsibility Map

### Core friend scheduler seam

- Modify packages/core/src/lib/signals/graph.ts: add an internal command-admission guard that reuses the active direct-write policy.
- Modify packages/core/src/lib/scheduler/renderer-participant.ts: add owner-scoped Begin, Advance, Commit, Complete, render-request, render-finish, and paint-target adapters for matching official packages.
- Modify packages/core/src/internal.ts: export only the new version-coupled friend values and types.
- Create packages/core/src/lib/scheduler/renderer-participant-particles.test.tsx: prove phase order, owner liveness, cancellation, transaction adoption, and target participation.
- Modify playground/package-consumer/index.ts and playground/package-consumer/runtime.mjs: lock the expanded internal entry without leaking it from @crc/core.

### Package and public definition language

- Create packages/particles/package.json, packages/particles/tsconfig.build.json, and packages/particles/README.md: optional package metadata, root/webgl exports, exact peers, and build.
- Create packages/particles/src/index.ts and packages/particles/src/webgl.ts: root and WebGL public surfaces with no JSX runtime.
- Create packages/particles/src/lib/types.ts and packages/particles/src/lib/webgl-types.ts: public nominal definitions, emitters, parameters, values, systems, events, diagnostics, props, styles, and capabilities.
- Create packages/particles/src/lib/particle.ts: frozen between, integer, choice, parameter, curve, and gradient authoring descriptors.
- Create packages/particles/src/lib/definition.ts: immutable 2D construction, input copying, validation, branding, metadata, and capability classification.
- Create packages/particles/src/lib/webgl-definition.ts: immutable 3D construction and dimension-specific validation.
- Create packages/particles/src/lib/definition-records.ts: package-private normalized records and nominal lookup.
- Create packages/particles/src/lib/{particle,definition,webgl-definition}.test.ts: public inference, immutability, diagnostics, and capability tests.

### Deterministic compiler and analytic sampling

- Create packages/particles/src/lib/random.ts: stable emitter-name hashing, spawn/channel mixing, and exact unit/integer/choice sampling.
- Create packages/particles/src/lib/curve.ts: fixed easing lookup tables plus scalar/vector/color interpolation.
- Create packages/particles/src/lib/color.ts: concrete particle color normalization into finite sRGB RGBA channels.
- Create packages/particles/src/lib/emission.ts: normalized rate/burst/manual schedules, finite/infinite classification, and exact birth enumeration.
- Create packages/particles/src/lib/compiler.ts: backend-neutral phase ordering, conflict checks, parameter layout, capacity/bounds derivation, and execution capability reasons.
- Create packages/particles/src/lib/sample.ts: allocation-free 2D/3D shape, motion, and appearance sampling into caller-owned numeric registers.
- Create packages/particles/src/lib/{random,curve,emission,compiler,sample}.test.ts: deterministic numeric and rejection evidence.

### System ownership and Canvas execution

- Create packages/particles/src/lib/system/controller.ts: command queue, logical run, binding lease, parameter epochs, status/execution signals, milestones, and exact disposal.
- Create packages/particles/src/lib/system/hook.ts: public crcParticleSystem hook and implicit-system slot.
- Create packages/particles/src/lib/system/binding.ts: backend-neutral binding/executor transaction contract.
- Create packages/particles/src/lib/system/ownership.ts: deterministic counters for controllers, registrations, bindings, queues, ledgers, and caches.
- Create packages/particles/src/lib/system/{controller,hook,binding}.test.tsx: command, adoption, completion, failure, and hook identity tests.
- Create packages/particles/src/lib/canvas/birth-ledger.ts: fixed-capacity spawn records and overflow policy.
- Create packages/particles/src/lib/canvas/raster-cache.ts: bounded executor-owned path/sprite rasters.
- Create packages/particles/src/lib/canvas/executor.ts: analytic live-slot scan and Canvas draw hot loop.
- Create packages/particles/src/lib/canvas/primitive.ts: private resolved-style primitive, filter boundary receiver, and declared-box target.
- Create packages/particles/src/lib/canvas/component.ts: public Particles2D binding, implicit/explicit mode, and successful-render adoption.
- Create packages/particles/src/lib/canvas/{birth-ledger,raster-cache,executor,component}.test.tsx: semantic, structural, and failure evidence.

### Delayed WebGL tranche

- Create packages/webgl/src/internal.ts and modify packages/webgl/package.json plus packages/webgl/tsconfig.build.json: version-coupled @crc/webgl/internal scene-contribution entry.
- Modify packages/webgl/src/lib/scene/{types,composer,settle,renderer}.ts: accept closed instanced submissions and settle them with ordinary scene material/pass behavior.
- Modify packages/webgl/src/lib/gpu/renderer-resources.ts: transactionally own instanced programs, static geometry, curve/gradient textures, sprite textures, and vertex arrays.
- Create packages/webgl/src/lib/scene/instanced-contributor.test.ts and packages/webgl/src/lib/scene/instanced-renderer.test.ts: CPU-only composition plus GPU command/rollback evidence.
- Create packages/particles/src/lib/webgl/{shader,recipe,component}.ts: compile stateless point/billboard recipes and contribute Particles3D descriptions.
- Create packages/particles/src/lib/webgl/{shader,recipe,component}.test.tsx: capability, shader, scene, batching, and interaction tests.

### Public scenarios, consumers, contracts, and trust evidence

- Create packages/scenarios/src/particle-celebration-lab.example.tsx and packages/scenarios/src/particle-celebration-lab.ts: controlled Canvas celebration and system-command laboratory.
- Create packages/scenarios/src/webgl-particle-ambient-lab.example.tsx and packages/scenarios/src/webgl-particle-ambient-lab.ts: high-count stateless WebGL ambient scene.
- Modify packages/scenarios/src/{catalog,learning-catalog,index}.ts and packages/scenarios/package.json: register public examples and package dependency.
- Create packages/scenarios/src/learning/composition/particle-effects.example.tsx: concise component-vs-style, implicit-vs-explicit, and acceleration-vs-general-animation lesson.
- Create packages/core/test/{particle-celebration-lab,webgl-particle-ambient-lab,particle-ownership,particle-performance}.test.ts: public API, lifecycle, and structural evidence.
- Modify package.json, pnpm-lock.yaml, playground/package-consumer/{index.ts,jsx.tsx,runtime.mjs}, tooling/verify-packed-consumer.mjs, playground/src/crc-editor-types.txt, and tooling/verify-studio-types.mjs: workspace, packed, Bundler, NodeNext, runtime, and editor declarations.
- Create docs/site/api/components/{particles-2d,particles-3d}.md, docs/site/api/functions/{define-particle-effect-2d,define-particle-effect-3d,particle}.md, docs/site/api/hooks/crc-particle-system.md, docs/site/api/types/particles.md, and docs/site/learn/guides/particle-effects.md: public API and learning surface.
- Modify docs/design/{animation-contract,signals-and-scheduling-contract,canvas-surface-contract,runtime-hooks-contract,drawing-components-contract,style-system-contract,layout-system-contract,user-events-contract,focus-and-keyboard-navigation-contract,mouse-interaction-contract,event-resource-ownership,runtime-resource-ownership}.md.
- Modify README.md, packages/core/README.md, packages/webgl/README.md, docs/library-status.md, AGENTS.md, docs/scenario-index.md, tooling/verify-docs.mjs, tooling/docs-contract-preservation-baseline.json, tooling/studio-docs/api-exports.ts, tooling/studio-docs/api-exports.check.ts, and a new tooling/studio-docs/fixtures/api/particles.ts.

## Fixed Public Surface for Project 1

The root entry exports four runtime values:

```ts
export { defineParticleEffect2D, particle, crcParticleSystem, Particles2D };
```

The WebGL entry exports two runtime values:

```ts
export { defineParticleEffect3D, Particles3D };
```

Project 1 does not publish @crc/particles/presets or @crc/particles/presets/webgl. Those subpaths are added only by Project 4.

The nominal and inference boundary is:

```ts
declare const particleEffectBrand: unique symbol;

export interface CRCParticleEffect2D<
  EmitterName extends string = string,
  Parameters extends CRCParticleParameterValues = CRCParticleParameterValues,
> {
  readonly dimension: 2;
  readonly [particleEffectBrand]: {
    readonly emitterName: EmitterName;
    readonly parameters: Parameters;
  };
}

export interface CRCParticleEffect3D<
  EmitterName extends string = string,
  Parameters extends CRCParticleParameterValues = CRCParticleParameterValues,
> {
  readonly dimension: 3;
  readonly [particleEffectBrand]: {
    readonly emitterName: EmitterName;
    readonly parameters: Parameters;
  };
}

export type CRCParticleValueFor<
  Definition extends CRCParticleParameterDefinition,
> = Definition["type"] extends "number"
  ? number
  : Definition["type"] extends "vector2"
    ? readonly [number, number]
    : Definition["type"] extends "vector3"
      ? readonly [number, number, number]
      : Definition["type"] extends "color"
        ? string
        : never;

export type CRCParticleValuesOf<
  Definitions extends CRCParticleParameterDefinitions | undefined,
> = Definitions extends CRCParticleParameterDefinitions
  ? Readonly<{
      [Name in keyof Definitions]: CRCParticleValueFor<Definitions[Name]>;
    }>
  : Readonly<Record<never, never>>;

export function defineParticleEffect2D<
  const Input extends CRCParticleEffect2DInput,
>(
  input: Input,
): CRCParticleEffect2D<
  Input["emitters"][number]["name"],
  CRCParticleValuesOf<
    Input extends { readonly parameters: infer Definitions }
      ? Extract<Definitions, CRCParticleParameterDefinitions>
      : undefined
  >
>;
```

The public controller remains hook-owned:

```ts
declare const particleSystemBrand: unique symbol;

export type CRCParticleSystemStatus =
  | "idle"
  | "scheduled"
  | "running"
  | "paused"
  | "draining"
  | "finished"
  | "disposed";

export type CRCParticleExecution =
  | "unbound"
  | "stateless-canvas"
  | "stateful-canvas"
  | "stateless-webgl"
  | "stateful-cpu-webgl"
  | "stateful-gpu-webgl";

export type CRCParticleSystemEvent =
  | CRCParticleStartEvent
  | CRCParticleBurstAcceptedEvent
  | CRCParticleBurstRejectedEvent
  | CRCParticleDrainStartEvent
  | CRCParticleFinishEvent;

export interface CRCParticleSystemOptions {
  readonly autoplay?: boolean;
  readonly seed?: number;
  readonly debugName?: string;
  readonly onEvent?: (event: CRCParticleSystemEvent) => void;
  readonly onError?: (error: unknown) => void;
}

export interface CRCParticleBurstOverrides {
  readonly count?: number;
  readonly position?:
    readonly [number, number] | readonly [number, number, number];
  readonly seedSalt?: number;
  readonly parameters?: Readonly<
    Record<string, number | readonly number[] | string>
  >;
}

export interface CRCParticleSystem<
  EmitterName extends string = string,
  Parameters extends CRCParticleParameterValues = CRCParticleParameterValues,
  Dimension extends 2 | 3 = 2 | 3,
> {
  readonly [particleSystemBrand]: {
    readonly parameters: Parameters;
    readonly dimension: Dimension;
  };
  readonly status: Signal<CRCParticleSystemStatus>;
  readonly execution: Signal<CRCParticleExecution>;
  play(): void;
  pause(): void;
  resume(): void;
  restart(options?: Readonly<{ seed?: number }>): void;
  emit(emitter: EmitterName, options?: CRCParticleBurstOverrides): void;
  stop(options?: Readonly<{ mode?: "drain" | "clear" }>): void;
}

export function crcParticleSystem<
  EmitterName extends string,
  Parameters extends CRCParticleParameterValues,
>(
  effect: CRCParticleEffect2D<EmitterName, Parameters>,
  options?: CRCParticleSystemOptions,
): CRCParticleSystem<EmitterName, Parameters, 2>;
export function crcParticleSystem<
  EmitterName extends string,
  Parameters extends CRCParticleParameterValues,
>(
  effect: CRCParticleEffect3D<EmitterName, Parameters>,
  options?: CRCParticleSystemOptions,
): CRCParticleSystem<EmitterName, Parameters, 3>;
```

The discriminated component modes are:

```ts
export interface CRCParticleCommonProps<
  Parameters extends CRCParticleParameterValues,
>
  extends CRCEventHandlers, CRCEventParticipationOptions {
  readonly parameters?: Readonly<Partial<Parameters>>;
  readonly keyboardFocusable?: boolean;
  readonly keyboardNavigationBounds?: Readonly<LayoutBox>;
  readonly onEvent?: (event: CRCParticleSystemEvent) => void;
  readonly onError?: (error: unknown) => void;
}

export type Particles2DProps<
  EmitterName extends string = string,
  Parameters extends CRCParticleParameterValues = CRCParticleParameterValues,
> = CRCParticleCommonProps<Parameters> & {
  readonly style?: Particles2DStyle;
} & (
    | {
        readonly effect: CRCParticleEffect2D<EmitterName, Parameters>;
        readonly system?: never;
        readonly autoplay?: boolean;
        readonly seed?: number;
      }
    | {
        readonly effect?: never;
        readonly system: CRCParticleSystem<EmitterName, Parameters, 2>;
        readonly autoplay?: never;
        readonly seed?: never;
      }
  );

export interface Particles2DStyle
  extends SystemStyle, BoxStyle, LayoutItemStyle, CursorStyle {
  readonly opacity?: number;
}

export type Particles3DProps<
  EmitterName extends string = string,
  Parameters extends CRCParticleParameterValues = CRCParticleParameterValues,
> = CRCParticleCommonProps<Parameters> & {
  readonly style?: Particles3DStyle;
  readonly execution?: "auto" | "cpu" | "gpu";
  readonly interactionBounds?: CRCParticleBounds3D;
} & (
    | {
        readonly effect: CRCParticleEffect3D<EmitterName, Parameters>;
        readonly system?: never;
        readonly autoplay?: boolean;
        readonly seed?: number;
      }
    | {
        readonly effect?: never;
        readonly system: CRCParticleSystem<EmitterName, Parameters, 3>;
        readonly autoplay?: never;
        readonly seed?: never;
      }
  );

export interface Particles3DStyle extends CRCWebGLTransformStyle {
  readonly opacity?: number;
  readonly cursor?: string;
  readonly filter?: never;
}
```

Runtime validation rejects both/neither effect and system, implicit-only options in explicit mode, nonfinite parameters, unsupported execution capabilities, a second live binding, missing allocation or interaction bounds, and Canvas filters on Particles3D.

## Project 1 Closed Definition Vocabulary

Parameter definitions always contain a default, so omitted binding values use the copied default. Supplying an unknown key, a nonfinite scalar/vector component, or a value of the wrong dimension rejects the candidate before adoption.

```ts
export type CRCParticleParameterTiming = "spawn" | "simulation" | "render";

export type CRCParticleParameterDefinition =
  | Readonly<{
      type: "number";
      default: number;
      timing: CRCParticleParameterTiming;
    }>
  | Readonly<{
      type: "vector2";
      default: readonly [number, number];
      timing: CRCParticleParameterTiming;
    }>
  | Readonly<{
      type: "vector3";
      default: readonly [number, number, number];
      timing: CRCParticleParameterTiming;
    }>
  | Readonly<{
      type: "color";
      default: string;
      timing: CRCParticleParameterTiming;
    }>;

export type CRCParticleScalar =
  | number
  | CRCParticleRange
  | CRCParticleIntegerRange
  | CRCParticleChoice<number>
  | CRCParticleParameterReference<string>;

export type CRCParticleVector2 = readonly [
  CRCParticleScalar,
  CRCParticleScalar,
];
export type CRCParticleVector3 = readonly [
  CRCParticleScalar,
  CRCParticleScalar,
  CRCParticleScalar,
];
```

Emission sources use these exact records. repeat.count is the total number of cycles including the first. A finite rate requires durationMilliseconds. Omitting duration makes the rate infinite. Probability is sampled independently for every potential birth and lies in [0, 1].

```ts
export type CRCParticleEmission =
  | Readonly<{
      type: "rate";
      particlesPerSecond: number;
      startMilliseconds?: number;
      durationMilliseconds?: number;
      probability?: number;
      repeat?: Readonly<{
        everyMilliseconds: number;
        count: number;
      }>;
    }>
  | Readonly<{
      type: "burst";
      atMilliseconds: number;
      count: number | CRCParticleIntegerRange;
      probability?: number;
      repeat?: Readonly<{
        everyMilliseconds: number;
        count: number;
      }>;
    }>
  | Readonly<{
      type: "manual";
      count?: number | CRCParticleIntegerRange;
    }>;
```

Manual count defaults to 1. An emit override replaces that count for the command, offsets the sampled shape by position, mixes seedSalt into that command's random stream, and may override only parameters declared with spawn timing. Count must be a positive safe integer after sampling; seedSalt must be a finite safe integer; position must match the effect dimension.

The Project 1 shape unions are:

```ts
export type CRCParticleShape2D =
  | Readonly<{ type: "point"; position?: readonly [number, number] }>
  | Readonly<{
      type: "line";
      from: readonly [number, number];
      to: readonly [number, number];
    }>
  | Readonly<{
      type: "rectangle";
      width: number;
      height: number;
      sample: "interior" | "edge";
    }>
  | Readonly<{
      type: "circle";
      radius: number;
      sample: "interior" | "circumference";
    }>
  | Readonly<{
      type: "ring";
      innerRadius: number;
      outerRadius: number;
    }>;

export type CRCParticleShape3D =
  | Readonly<{ type: "point"; position?: readonly [number, number, number] }>
  | Readonly<{
      type: "line";
      from: readonly [number, number, number];
      to: readonly [number, number, number];
    }>
  | Readonly<{
      type: "box";
      size: readonly [number, number, number];
      sample: "volume" | "surface";
    }>
  | Readonly<{
      type: "sphere";
      radius: number;
      thickness?: number;
      sample: "volume" | "surface";
    }>
  | Readonly<{
      type: "ring";
      innerRadius: number;
      outerRadius: number;
    }>
  | Readonly<{
      type: "cone";
      direction: readonly [number, number, number];
      spreadDegrees: number;
      length: number;
      sample: "volume" | "surface";
    }>;
```

Initial values and analytic modules remain dimension-specific. Vector-valued modules accept a matching constant tuple or parameter reference. Scalar fields accept the scalar language above.

```ts
export interface CRCParticleInitial2D {
  readonly lifetimeMilliseconds: CRCParticleScalar;
  readonly velocity?: CRCParticleVector2;
  readonly size?: CRCParticleScalar | CRCParticleVector2;
  readonly rotationDegrees?: CRCParticleScalar;
  readonly angularVelocityDegreesPerSecond?: CRCParticleScalar;
  readonly color?: string | CRCParticleChoice<string>;
  readonly opacity?: CRCParticleScalar;
}

export interface CRCParticleInitial3D {
  readonly lifetimeMilliseconds: CRCParticleScalar;
  readonly velocity?: CRCParticleVector3 | CRCParticleConeVelocity3D;
  readonly size?: CRCParticleScalar | CRCParticleVector2;
  readonly rotationDegrees?: CRCParticleScalar;
  readonly angularVelocityDegreesPerSecond?: CRCParticleScalar;
  readonly color?: string | CRCParticleChoice<string>;
  readonly opacity?: CRCParticleScalar;
}

export type CRCParticleMotion2D =
  | Readonly<{ type: "acceleration" | "gravity"; value: CRCParticleVector2 }>
  | Readonly<{ type: "drag"; amount: CRCParticleScalar }>
  | Readonly<{ type: "drift"; velocity: CRCParticleVector2 }>
  | Readonly<{
      type: "radialAcceleration";
      center: readonly [number, number];
      amount: CRCParticleScalar;
    }>
  | Readonly<{
      type: "orbit";
      center: readonly [number, number];
      degreesPerSecond: CRCParticleScalar;
    }>
  | Readonly<{
      type: "sway";
      amplitude: CRCParticleScalar;
      frequency: CRCParticleScalar | readonly [number, number];
    }>
  | Readonly<{
      type: "angularVelocity";
      degreesPerSecond: CRCParticleScalar;
    }>;
```

webgl-types.ts defines the same named 3D module variants with vector3 centers/directions. Radial acceleration is analytic only around a fixed center; changing centers require Project 2.

Appearance and renderer records are:

```ts
export interface CRCParticleAppearance {
  readonly size?: CRCParticleCurve<number | readonly [number, number]>;
  readonly rotationDegrees?: CRCParticleCurve<number>;
  readonly color?: CRCParticleGradient;
  readonly opacity?: CRCParticleCurve<number>;
}

export type CRCParticleRenderer2D =
  | Readonly<{ type: "circle"; blend?: "source-over" | "additive" }>
  | Readonly<{
      type: "rectangle";
      aspectRatio?: number;
      blend?: "source-over" | "additive";
    }>
  | Readonly<{
      type: "path";
      path: Path2D;
      blend?: "source-over" | "additive";
    }>
  | Readonly<{
      type: "sprite";
      source: CanvasImageSource;
      anchor?: readonly [number, number];
      blend?: "source-over" | "additive";
    }>;

export type CRCParticleRenderer3D =
  | Readonly<{
      type: "point";
      material: "unlit" | "emissive";
      blend: "alpha" | "additive" | "cutout";
      depthTest?: boolean;
      depthWrite?: boolean;
      sorting?: "none" | "oldest-first" | "youngest-first" | "distance";
    }>
  | Readonly<{
      type: "billboard";
      source?: CanvasImageSource;
      material: "unlit" | "emissive";
      blend: "alpha" | "additive" | "cutout";
      depthTest?: boolean;
      depthWrite?: boolean;
      sorting?: "none" | "oldest-first" | "youngest-first" | "distance";
    }>;
```

Project 1 rejects distance sorting at WebGL binding and does not expose atlas frames, text/emoji sprites, velocity-stretched billboards, mesh instances, or multiple renderers over one population.

## Fixed Stateless Math and Ordering

- Seed values are finite safe integers normalized to unsigned 32-bit values.
- Stable emitter-name hashes use UTF-16 FNV-1a. The hash is mixed with the run seed, spawn ordinal, and a compiler-assigned channel id through the fixed 32-bit avalanche in packages/particles/src/lib/random.ts.
- Unit samples are unsignedHash / 4294967296 and therefore lie in [0, 1).
- particleRange uses min + unit * (max - min).
- particleInteger uses min + floor(unit * (max - min + 1)).
- particleChoice accumulates positive finite weights in source order and selects the first cumulative interval strictly greater than unit * totalWeight.
- Curves and gradients normalize to 257 samples at construction: endpoints plus 255 equally spaced interior samples. Numeric/vector runtime lookup clamps normalized age to [0, 1], multiplies by 256, and linearly interpolates adjacent samples.
- Gradient construction interpolates straight sRGB channels plus alpha into 257 samples. Both backends select round(clampedAge * 256); Canvas stores construction-time CSS strings and WebGL uses texelFetch, avoiding per-particle string creation while preserving the same quantization. Effective renderer alpha multiplies component opacity and sampled color alpha exactly once.
- Circle interior radii use sqrt(unit); sphere-volume radii use cbrt(unit). Angular direction samples are uniform over their declared measure.
- Analytic acceleration uses p = p0 + v0*t + 0.5*a*t*t. Analytic drag uses v(t) = v0*exp(-drag*t) and its closed-form position integral, with the zero-drag limit handled directly.
- Phase order is emission, shape, initial values, analytic motion, appearance, renderer. Ambiguous same-attribute writers reject during definition construction.
- Source emitter order is stable. Canvas draws emitters in definition order. WebGL source index remains the exact equal-depth tie-breaker even when settlement reorders passes.

---

### Task 1: Add the owner-scoped core scheduler and target seam

**Files:**

- Modify: packages/core/src/lib/signals/graph.ts
- Modify: packages/core/src/lib/scheduler/renderer-participant.ts
- Create: packages/core/src/lib/scheduler/renderer-participant-particles.test.tsx
- Modify: packages/core/src/internal.ts
- Modify: playground/package-consumer/index.ts
- Modify: playground/package-consumer/runtime.mjs

**Interfaces:**

```ts
export interface CRCInternalSignalBatch {
  read<T>(signal: WritableSignal<T>): T;
  stage<T>(signal: WritableSignal<T>, value: T, writer: object): void;
  discardWriter(writer: object): void;
}

export interface CRCInternalCommandHandle {
  readonly sequence: number;
  cancel(): void;
}

export function crcInternalAssertCommandAllowed(): void;
export function crcInternalQueueBegin(
  owner: CRCInternalRenderOwner,
  callback: (
    frame: CRCInternalFrame,
    batch: CRCInternalSignalBatch,
    sequence: number,
  ) => void,
): CRCInternalCommandHandle;
export function crcInternalRegisterAdvance(
  owner: CRCInternalRenderOwner,
  callback: (frame: CRCInternalFrame, batch: CRCInternalSignalBatch) => void,
): () => void;
export function crcInternalQueueCurrentCommit(
  owner: CRCInternalRenderOwner,
  callback: (
    frame: CRCInternalFrame,
    outcome: Readonly<{ applied: boolean }>,
  ) => void,
): void;
export function crcInternalQueueCurrentComplete(
  owner: CRCInternalRenderOwner,
  callback: (frame: CRCInternalFrame) => void,
): void;
export function crcInternalRequestRender(owner: CRCInternalRenderOwner): void;
export function crcInternalOnRenderFinish(
  owner: CRCInternalRenderOwner,
  callback: (success: boolean) => void,
): void;
export function crcInternalPaintTarget(
  handlers: CRCEventHandlers,
  options: CRCEventTargetOptions,
  pointerEvents?: CRCPointerEvents,
): CRCEventTargetSnapshot;
```

- [ ] Add failing browser tests proving Begin → Advance → Commit → Plan/Render → Complete ordering, one owner-scoped registration, command cancellation, inert callbacks after owner disposal, current-instance render requests, successful/failed render-finish callbacks, and default paint-target participation with explicit pointerEvents none.

```ts
expect(trace).toEqual([
  "begin:1",
  "advance:1",
  "commit:1:true",
  "render:1",
  "complete:1",
]);
expect(snapshotRealmScheduler()).toMatchObject({
  registeredAdvanceParticipants: 1,
  pendingHostFrames: 1,
});
```

- [ ] Run the focused test and confirm it fails because the new friend exports do not exist.

```sh
corepack pnpm@11.21.0 vitest run packages/core/src/lib/scheduler/renderer-participant-particles.test.tsx --browser.headless --browser.ui=false
```

- [ ] Add assertSignalCommandAllowed in graph.ts. It must invoke the active direct-write policy against one private unleased sentinel node so component, primitive, computed, and Advance guards retain their current messages without mutating a signal.
- [ ] Implement the owner adapters in renderer-participant.ts by resolving the existing active owner state, delegating to the realm scheduler, and checking owner liveness again inside every queued callback. Teardown must cancel queued Begin work and unregister Advance work exactly once.
- [ ] Implement crcInternalOnRenderFinish against the current render transaction and require that the supplied owner is the currently evaluating owner.
- [ ] Implement crcInternalPaintTarget as the narrow friend wrapper over the existing paint-target hook; do not create a second event registration implementation.
- [ ] Export the exact friend functions/types from internal.ts, add compile-only use to package-consumer/index.ts, and update runtime.mjs expectedInternal without changing @crc/core root exports.
- [ ] Re-run the focused browser test and package-consumer checks.

```sh
corepack pnpm@11.21.0 vitest run packages/core/src/lib/scheduler/renderer-participant-particles.test.tsx --browser.headless --browser.ui=false
corepack pnpm@11.21.0 test:package-consumer
```

- [ ] Commit only Task 1 files.

```sh
git add packages/core/src/lib/signals/graph.ts packages/core/src/lib/scheduler/renderer-participant.ts packages/core/src/lib/scheduler/renderer-participant-particles.test.tsx packages/core/src/internal.ts playground/package-consumer/index.ts playground/package-consumer/runtime.mjs
git commit -m "feat(core): expose official scheduled-renderer seam"
```

### Task 2: Scaffold @crc/particles and lock its public types

**Files:**

- Create: packages/particles/package.json
- Create: packages/particles/tsconfig.build.json
- Create: packages/particles/README.md
- Create: packages/particles/src/index.ts
- Create: packages/particles/src/webgl.ts
- Create: packages/particles/src/lib/types.ts
- Create: packages/particles/src/lib/webgl-types.ts
- Create: packages/particles/src/lib/public-types.test.ts
- Modify: package.json
- Modify: pnpm-lock.yaml

**Interfaces:**

```json
{
  "name": "@crc/particles",
  "type": "module",
  "version": "0.0.1",
  "sideEffects": false,
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.mjs"
    },
    "./webgl": {
      "types": "./dist/webgl.d.ts",
      "default": "./dist/webgl.mjs"
    },
    "./package.json": "./package.json"
  },
  "peerDependencies": {
    "@crc/core": "0.0.1",
    "@crc/webgl": "0.0.1"
  },
  "peerDependenciesMeta": {
    "@crc/webgl": {
      "optional": true
    }
  }
}
```

- [ ] Add failing compile tests that import every named Project 1 type from the correct root or webgl entry, prove emitter-name inference narrows system.emit, prove parameter keys/value dimensions infer, prove the two component modes are mutually exclusive, and prove Particles3DStyle has no filter field.

```ts
const effect = defineParticleEffect2D({
  parameters: {
    wind: { type: "vector2", default: [0, 0], timing: "simulation" },
  },
  emitters: [impactEmitter, smokeEmitter],
});
const system = crcParticleSystem(effect);
system.emit("impact");
// @ts-expect-error emitter names come from the frozen definition
system.emit("unknown");
```

- [ ] Run the focused TypeScript build and confirm it fails because the package and exports are absent.

```sh
corepack pnpm@11.21.0 tsc -p packages/particles/tsconfig.build.json
```

- [ ] Create the package manifest with root and webgl entries, exact core peer, optional exact webgl peer, and build externalization for @crc/core, @crc/core/internal, @crc/webgl, and @crc/webgl/internal. Include only dist in packed files.
- [ ] Add public closed unions for parameters, spawn values, curves, gradients, 2D/3D emissions, shapes, analytic motion, appearances, renderers, bounds, events, diagnostics, systems, props, and styles. Do not export normalized records or compiler plans.
- [ ] Use readonly tuples and const generics so 2D and 3D vector dimensions cannot mix. Include named error classes only where callers can reasonably branch; otherwise publish discriminated diagnostic records.
- [ ] Export type declarations from index.ts and webgl.ts. Tasks 3, 5, 7, and 11 add the six runtime values after their implementations exist. Add no jsx-runtime subpath.
- [ ] Add @crc/particles as a root development dependency, regenerate only the lockfile changes caused by the workspace package, and run typecheck.

```sh
corepack pnpm@11.21.0 install --lockfile-only
corepack pnpm@11.21.0 typecheck
```

- [ ] Commit only Task 2 files.

```sh
git add packages/particles/package.json packages/particles/tsconfig.build.json packages/particles/README.md packages/particles/src/index.ts packages/particles/src/webgl.ts packages/particles/src/lib/types.ts packages/particles/src/lib/webgl-types.ts packages/particles/src/lib/public-types.test.ts package.json pnpm-lock.yaml
git commit -m "feat(particles): scaffold public package and types"
```

### Task 3: Implement immutable particle values and effect definitions

**Files:**

- Create: packages/particles/src/lib/particle.ts
- Create: packages/particles/src/lib/definition-records.ts
- Create: packages/particles/src/lib/definition.ts
- Create: packages/particles/src/lib/webgl-definition.ts
- Create: packages/particles/src/lib/particle.test.ts
- Create: packages/particles/src/lib/definition.test.ts
- Create: packages/particles/src/lib/webgl-definition.test.ts
- Modify: packages/particles/src/index.ts
- Modify: packages/particles/src/webgl.ts

**Interfaces:**

```ts
export const particle = Object.freeze({
  between(min: number, max: number): CRCParticleRange;
  integer(min: number, max: number): CRCParticleIntegerRange;
  choice<const T>(
    choices: readonly Readonly<{ value: T; weight: number }>[],
  ): CRCParticleChoice<T>;
  parameter<const Name extends string>(
    name: Name,
  ): CRCParticleParameterReference<Name>;
  curve<const T extends CRCParticleCurveValue>(
    keys: readonly (readonly [time: number, value: T])[],
    options?: CRCParticleCurveOptions,
  ): CRCParticleCurve<T>;
  gradient(
    keys: readonly (readonly [time: number, color: string])[],
    options?: CRCParticleCurveOptions,
  ): CRCParticleGradient;
});
```

- [ ] Add failing tests for valid helpers, invalid/nonfinite ranges, inclusive integers, zero/negative choice weights, empty choice lists, unknown parameter names, duplicate emitter names, empty emitters, invalid capacity, invalid shapes/bounds, ambiguous motion writers, caller mutation after construction, deep freezing, and nominal cross-dimension rejection.
- [ ] Add capability assertions for stateless Canvas, stateless WebGL, and requires-stateful reasons. A 3D manual emitter remains a valid definition record but lacks Project 1 stateless-webgl capability.
- [ ] Run the focused tests and confirm missing runtime constructors.

```sh
corepack pnpm@11.21.0 vitest run packages/particles/src/lib/particle.test.ts packages/particles/src/lib/definition.test.ts packages/particles/src/lib/webgl-definition.test.ts --browser.headless --browser.ui=false
```

- [ ] Implement descriptor constructors that synchronously validate, copy caller arrays/records, freeze nested storage, and brand through private WeakMap records rather than writable public fields.
- [ ] Implement definition construction as validate → normalize → classify → derive bounds → deep-freeze → brand. Preserve stable emitter source order and derive FNV-1a name hashes independently of emitter insertion order.
- [ ] Validate the Project 1 closed module set: local space; rate/burst/manual emission; point/line/rectangle/circle/ring in 2D; point/line/box/sphere/ring/cone in 3D; acceleration/gravity/drag/drift/radial acceleration/orbit/sway/angular velocity; circle/rectangle/path/sprite in Canvas; point/billboard in WebGL.
- [ ] Validate renderer assets without taking ownership: clone every supplied Path2D with new Path2D(source) during definition construction so later caller mutation cannot change the hidden renderer path. Sprite descriptors retain source identity, and the binding requires a decoded CanvasImageSource before acquiring an executor.
- [ ] Reject dynamic or unbounded motion without explicit finite bounds. Store compiler-derived bounds only when the supported shape, maximum lifetime, initial speed, and analytic motion yield a finite conservative result.
- [ ] Implement exact error paths containing effect debugName when present plus emitter, module, property, and value.
- [ ] Export particle and defineParticleEffect2D from index.ts and defineParticleEffect3D from webgl.ts. Run the focused tests and package build.

```sh
corepack pnpm@11.21.0 vitest run packages/particles/src/lib/particle.test.ts packages/particles/src/lib/definition.test.ts packages/particles/src/lib/webgl-definition.test.ts --browser.headless --browser.ui=false
corepack pnpm@11.21.0 --filter @crc/particles build
```

- [ ] Commit only Task 3 files.

```sh
git add packages/particles/src/lib/particle.ts packages/particles/src/lib/definition-records.ts packages/particles/src/lib/definition.ts packages/particles/src/lib/webgl-definition.ts packages/particles/src/lib/particle.test.ts packages/particles/src/lib/definition.test.ts packages/particles/src/lib/webgl-definition.test.ts packages/particles/src/index.ts packages/particles/src/webgl.ts
git commit -m "feat(particles): add immutable effect definitions"
```

### Task 4: Compile deterministic random values, curves, schedules, and shapes

**Files:**

- Create: packages/particles/src/lib/random.ts
- Create: packages/particles/src/lib/color.ts
- Create: packages/particles/src/lib/curve.ts
- Create: packages/particles/src/lib/emission.ts
- Create: packages/particles/src/lib/compiler.ts
- Create: packages/particles/src/lib/sample.ts
- Create: packages/particles/src/lib/random.test.ts
- Create: packages/particles/src/lib/color.test.ts
- Create: packages/particles/src/lib/curve.test.ts
- Create: packages/particles/src/lib/emission.test.ts
- Create: packages/particles/src/lib/compiler.test.ts
- Create: packages/particles/src/lib/sample.test.ts

**Interfaces:**

```ts
export function hashEmitterName(name: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < name.length; index += 1) {
    hash = Math.imul(hash ^ name.charCodeAt(index), 0x01000193);
  }
  return hash >>> 0;
}

export function mix32(value: number): number {
  value = (value ^ (value >>> 16)) >>> 0;
  value = Math.imul(value, 0x7feb352d) >>> 0;
  value = (value ^ (value >>> 15)) >>> 0;
  value = Math.imul(value, 0x846ca68b) >>> 0;
  return (value ^ (value >>> 16)) >>> 0;
}

export function sampleHash(
  seed: number,
  emitterHash: number,
  ordinal: number,
  channel: number,
): number {
  let value = mix32((seed >>> 0) ^ emitterHash);
  value = mix32(value ^ mix32(ordinal >>> 0));
  return mix32(value ^ Math.imul(channel >>> 0, 0x9e3779b1)) >>> 0;
}

export const enum Particle2DRegister {
  Live,
  X,
  Y,
  VelocityX,
  VelocityY,
  SizeX,
  SizeY,
  Rotation,
  Red,
  Green,
  Blue,
  Alpha,
  AtlasFrame,
}

export function sampleParticle2D(
  plan: CompiledEmitter2D,
  birth: ParticleBirthView,
  effectTimeMilliseconds: number,
  parameters: Readonly<Float64Array>,
  output: Float64Array,
): boolean;
```

- [ ] Add failing golden-vector tests for name hashes, seed/channel samples, inclusive integer endpoints, weighted choices, 257-entry easing tables, curve interpolation, gradient colors, rate fractional accumulation, scheduled bursts, repeat boundaries, finite/infinite completion, shape distributions, and analytic motion.

```ts
expect(sampleUnit(42, hashEmitterName("snow"), 7, 3)).toBeCloseTo(
  0.11817239224910736,
  15,
);
expect(sampleCircleRadius(0.25, 10)).toBe(5);
expect(sampleSphereRadius(0.125, 8)).toBe(4);
```

- [ ] Run the focused tests and observe missing compiler/sampler failures.

```sh
corepack pnpm@11.21.0 vitest run packages/particles/src/lib/random.test.ts packages/particles/src/lib/color.test.ts packages/particles/src/lib/curve.test.ts packages/particles/src/lib/emission.test.ts packages/particles/src/lib/compiler.test.ts packages/particles/src/lib/sample.test.ts --browser.headless --browser.ui=false
```

- [ ] Implement FNV-1a plus mix32 using Math.imul and unsigned shifts. Assign channel ids from normalized property paths, never from traversal-time object identity.
- [ ] Normalize colors with a pure portable parser during definition construction into finite [0, 1] sRGB RGBA. Accept hex forms, modern and legacy rgb()/rgba(), hsl()/hsla(), transparent, and the CSS named-color table; reject contextual currentColor/system references and color syntaxes outside this Project 1 grammar. Cache identical source strings and never read pixels.
- [ ] Sample every CRCEasing into 257 immutable points during construction. No easing, choice, or user callback may run inside a particle hot loop or WebGL shader.
- [ ] Compile rate sources into exact birth intervals and scheduled bursts into sorted stable records. Repeat count means total finite cycles; equal timestamps retain declaration order. Probability rejects a potential birth without renumbering later potential ordinals.
- [ ] Classify completion as finite, automatic-infinite, or manual-open. Store maximum lifetime, earliest/latest automatic birth, conservative potentially-live ordinal window, and explicit reasons for every unavailable execution tier.
- [ ] Compile parameter references into fixed numeric offsets and separate spawn, simulation, and render masks. Unknown references or dimension mismatches fail before a definition is published.
- [ ] Implement 2D and 3D uniform-measure shape sampling and the fixed analytic phase equations into caller-owned Float64Array registers. Avoid returning particle objects.
- [ ] Add a loop of 100,000 samples that proves sampler counters report zero sample-time array/object allocation and that seeded results repeat after restart.
- [ ] Run focused tests and build.

```sh
corepack pnpm@11.21.0 vitest run packages/particles/src/lib/random.test.ts packages/particles/src/lib/color.test.ts packages/particles/src/lib/curve.test.ts packages/particles/src/lib/emission.test.ts packages/particles/src/lib/compiler.test.ts packages/particles/src/lib/sample.test.ts --browser.headless --browser.ui=false
corepack pnpm@11.21.0 --filter @crc/particles build
```

- [ ] Commit only Task 4 files.

```sh
git add packages/particles/src/lib/random.ts packages/particles/src/lib/color.ts packages/particles/src/lib/curve.ts packages/particles/src/lib/emission.ts packages/particles/src/lib/compiler.ts packages/particles/src/lib/sample.ts packages/particles/src/lib/random.test.ts packages/particles/src/lib/color.test.ts packages/particles/src/lib/curve.test.ts packages/particles/src/lib/emission.test.ts packages/particles/src/lib/compiler.test.ts packages/particles/src/lib/sample.test.ts
git commit -m "feat(particles): compile deterministic analytic effects"
```

### Task 5: Implement the component-owned particle system controller

**Files:**

- Create: packages/particles/src/lib/system/binding.ts
- Create: packages/particles/src/lib/system/ownership.ts
- Create: packages/particles/src/lib/system/controller.ts
- Create: packages/particles/src/lib/system/hook.ts
- Create: packages/particles/src/lib/system/binding.test.ts
- Create: packages/particles/src/lib/system/controller.test.ts
- Create: packages/particles/src/lib/system/hook.test.tsx
- Modify: packages/particles/src/index.ts

**Interfaces:**

```ts
export interface ParticleBindingCandidate {
  readonly owner: CRCInternalRenderOwner;
  readonly backend: "canvas" | "webgl";
  readonly execution: CRCParticleExecution;
  readonly compiled: CompiledParticleEffect;
  readonly parameters: Readonly<Float64Array>;
  requestRender(): void;
  adoptFrame(frame: ParticleSystemFrame): void;
  clear(): void;
  dispose(): void;
}

export interface ParticleSystemFrame {
  readonly generation: number;
  readonly frameId: number;
  readonly logicalTime: number;
  readonly effectTimeMilliseconds: number;
  readonly previousEffectTimeMilliseconds: number;
  readonly seed: number;
  readonly status: CRCParticleSystemStatus;
}
```

- [ ] Add failing controlled-driver tests for play, autoplay, pause, resume, restart seed, manual emit, drain, clear, exact status/execution transitions, finite finish, automatic infinite runs, manual-open runs, queued command cancellation, stale handles, and one scheduler registration.
- [ ] Add failing tests for same-system double binding, bind-after-removal, effect replacement, failed definition/parameter adoption rollback, spawn/simulation/render parameter timing, capacity diagnostics, callback order, callback isolation, and no command resurrection after disposal.
- [ ] Run focused tests and verify the controller is absent.

```sh
corepack pnpm@11.21.0 vitest run packages/particles/src/lib/system/binding.test.ts packages/particles/src/lib/system/controller.test.ts packages/particles/src/lib/system/hook.test.tsx --browser.headless --browser.ui=false
```

- [ ] Implement a stable handle around private writable status/execution signals exposed through asReadonly. Controller methods first call crcInternalAssertCommandAllowed, validate arguments synchronously, then queue one owner-scoped Begin command.
- [ ] Apply play/pause/resume/restart/emit/stop only in Begin. Stage status and execution through CRCInternalSignalBatch. Queue commit acknowledgement and deliver events/errors only from Complete when the corresponding transaction applied. A manual emit while paused queues a burst-rejected diagnostic with accepted count zero and does not touch birth storage.
- [ ] Track effect logical time as an anchor pair rather than accumulated deltas. Pause preserves effect time. Resume establishes a new logical-time anchor. Restart returns time and ordinals to zero with the original or explicit normalized seed.
- [ ] Keep one Advance registration only while automatic emission, live particles, draining, or pending accepted work requires future frames. Paused, cleared, finished, and unbound systems release it.
- [ ] Add a compact effect-level parameter epoch ledger. Spawn values bind to the epoch active at birth, simulation values affect current analytic sampling, and render values affect the next successful draw. Prune epochs once no accepted live birth references them.
- [ ] Acquire a binding lease only after candidate validation and successful render finish. Reject a second concurrent backend before allocating its ledger/executor. Release and balance binding ownership on removal, key replacement, failure, and disposal.
- [ ] Define events as immutable start, burst-accepted, burst-rejected, drain-start, finish, and error records containing frameId/logicalTime plus effect/emitter diagnostics. Invoke the system-option observer before the current bound component observer for each event/error, isolate failures from both observers, and do not add per-particle events or activeCount to the base handle.
- [ ] Implement crcParticleSystem with useInternalHookSlot, successful-render candidate adoption, current-callback forwarding, and idempotent controller disposal. Export it from index.ts.
- [ ] Re-run focused tests and verify exact ownership counters return to baseline.

```sh
corepack pnpm@11.21.0 vitest run packages/particles/src/lib/system/binding.test.ts packages/particles/src/lib/system/controller.test.ts packages/particles/src/lib/system/hook.test.tsx --browser.headless --browser.ui=false
```

- [ ] Commit only Task 5 files.

```sh
git add packages/particles/src/lib/system/binding.ts packages/particles/src/lib/system/ownership.ts packages/particles/src/lib/system/controller.ts packages/particles/src/lib/system/hook.ts packages/particles/src/lib/system/binding.test.ts packages/particles/src/lib/system/controller.test.ts packages/particles/src/lib/system/hook.test.tsx packages/particles/src/index.ts
git commit -m "feat(particles): add scheduled particle systems"
```

### Task 6: Add the fixed-capacity Canvas birth ledger

**Files:**

- Create: packages/particles/src/lib/canvas/birth-ledger.ts
- Create: packages/particles/src/lib/canvas/birth-ledger.test.ts
- Modify: packages/particles/src/lib/system/binding.ts
- Modify: packages/particles/src/lib/system/controller.ts
- Modify: packages/particles/src/lib/system/controller.test.ts

**Interfaces:**

```ts
interface CanvasEmitterLedger {
  readonly capacity: number;
  readonly birthTimes: Float64Array;
  readonly deathTimes: Float64Array;
  readonly ordinals: Float64Array;
  readonly sourceIds: Uint32Array;
  readonly seedSalts: Uint32Array;
  readonly origins: Float64Array;
  readonly spawnEpochs: Uint32Array;
  readonly occupied: Uint8Array;
  readonly freeSlots: Uint32Array;
  readonly ageOrder: Uint32Array;
}
```

- [ ] Add failing tests for fixed allocation, source-order rate/burst/manual acceptance, exact reject-newest counts, recycle-oldest replacement, lifetime expiry, equal-time ties, capacity-one behavior, restart clearing, drain closure, and failure rollback.
- [ ] Assert that 10,000 births reuse the same typed-array identities and produce zero Array.splice calls.
- [ ] Run the focused test and confirm the ledger is missing.

```sh
corepack pnpm@11.21.0 vitest run packages/particles/src/lib/canvas/birth-ledger.test.ts --browser.headless --browser.ui=false
```

- [ ] Allocate each emitter ledger once from declared capacity. Use free-slot and intrusive age-order indices; never search with Array.splice or allocate a record per birth.
- [ ] Enumerate automatic births for the half-open interval (previousEffectTime, effectTime], preserving emission declaration order at equal time. Include births at zero exactly once on start/restart. Fast-forward ordinals whose maximum possible death is not later than the new effect time, then enumerate only the compiler's conservative potentially-live window so a hidden-tab gap does not loop over the entire missed duration.
- [ ] For reject-newest, reject only when no expired/free slot exists and report requested/accepted/rejected counts in Complete. For recycle-oldest, replace the oldest live ordinal and retain deterministic tie order.
- [ ] Store compact birth data and spawn-parameter epoch id per accepted slot. The analytic sampler derives every other attribute during draw.
- [ ] Allocate committed and candidate ledger generations once per executor. Copy only live metadata and touched slots into the candidate generation, draw from it, and swap generation roles after successful Commit/Render completion; on failure retain the committed generation without allocating a rollback journal.
- [ ] Connect controller frame adoption and completion classification to the ledger's exact next birth and latest death.
- [ ] Run the focused controller and ledger tests.

```sh
corepack pnpm@11.21.0 vitest run packages/particles/src/lib/canvas/birth-ledger.test.ts packages/particles/src/lib/system/controller.test.ts --browser.headless --browser.ui=false
```

- [ ] Commit only Task 6 files.

```sh
git add packages/particles/src/lib/canvas/birth-ledger.ts packages/particles/src/lib/canvas/birth-ledger.test.ts packages/particles/src/lib/system/binding.ts packages/particles/src/lib/system/controller.ts packages/particles/src/lib/system/controller.test.ts
git commit -m "feat(particles): add fixed-capacity canvas births"
```

### Task 7: Render Particles2D through one private Canvas primitive

**Files:**

- Create: packages/particles/src/lib/canvas/raster-cache.ts
- Create: packages/particles/src/lib/canvas/executor.ts
- Create: packages/particles/src/lib/canvas/primitive.ts
- Create: packages/particles/src/lib/canvas/component.ts
- Create: packages/particles/src/lib/canvas/raster-cache.test.ts
- Create: packages/particles/src/lib/canvas/executor.test.ts
- Create: packages/particles/src/lib/canvas/component.test.tsx
- Modify: packages/particles/src/index.ts

**Interfaces:**

```ts
export function Particles2D<
  EmitterName extends string,
  Parameters extends CRCParticleParameterValues,
>(props: Particles2DProps<EmitterName, Parameters>): CRCNode {
  // Own or bind the system and adopt candidates transactionally.
  // Return exactly one private drawing primitive.
}

const ParticleCanvasPrimitive = definePrimitive<
  ParticleCanvasPrimitiveProps,
  Particles2DStyle,
  Particles2DStyle,
  ResolvedParticles2DStyle
>(renderParticleCanvas, { resolveStyle: resolveParticles2DStyle });
```

- [ ] Add failing tests for implicit/explicit modes, root and layout-parent allocation, missing/nonfinite allocation, source paint order, opacity, Group transform, Clip, Layer cache invalidation, nonempty filter capture, default pointerEvents none, pointerEvents auto declared-box targeting, and no per-particle targets.
- [ ] Add failing Canvas command tests for circle, rectangle, Path2D, decoded sprite, source-over/additive mapping, emitter order, bounds culling, state restoration after success, and state restoration after injected draw failure.
- [ ] Run focused tests and observe missing component/executor behavior.

```sh
corepack pnpm@11.21.0 vitest run packages/particles/src/lib/canvas/raster-cache.test.ts packages/particles/src/lib/canvas/executor.test.ts packages/particles/src/lib/canvas/component.test.tsx --browser.headless --browser.ui=false
```

- [ ] Resolve the current finite allocation through crcLayoutBox. Forward BoxStyle/LayoutItemStyle/filter to the private primitive, multiply style.opacity into sampled alpha once, and return unsupported measurement from the primitive so particles never claim intrinsic size.
- [ ] Always reserve the same hook order. In the private primitive, register one memoized resolved-border-box target with crcInternalPaintTarget; pass empty handlers and pointerEvents none for decorative mode, and pass current handlers plus cursor/focus options for auto mode. Draw particles inside the resolved content box and never derive target geometry from current particle pixels.
- [ ] Give each binding one reusable Float64Array sampler register file. Iterate only occupied or conservatively potentially-live slots and draw without per-particle arrays/objects.
- [ ] Implement circle and rectangle with direct path commands. Draw immutable Path2D directly for low reuse and use the bounded raster cache for repeated complex paths/sprites at quantized useful sizes.
- [ ] Bound each executor cache to 16 raster entries per distinct renderer source. Use deterministic least-recently-used eviction, close owned ImageBitmap values, and never close caller-owned source assets.
- [ ] Group Canvas state changes by adjacent compatible renderer/blend/source while preserving emitter order where source-over blending is order-dependent. Map additive to lighter and restore transform, globalAlpha, globalCompositeOperation, image smoothing, fill/stroke state, and clipping through the surrounding save/restore in finally.
- [ ] Cull only through finite conservative effect bounds. Do not derive hit geometry from current pixels.
- [ ] Implement transactional definition/parameter/executor replacement: prepare the new executor before render, adopt after successful render finish, and dispose candidates on failure.
- [ ] Export Particles2D from index.ts and run focused tests plus the package build.

```sh
corepack pnpm@11.21.0 vitest run packages/particles/src/lib/canvas/raster-cache.test.ts packages/particles/src/lib/canvas/executor.test.ts packages/particles/src/lib/canvas/component.test.tsx --browser.headless --browser.ui=false
corepack pnpm@11.21.0 --filter @crc/particles build
```

- [ ] Commit only Task 7 files.

```sh
git add packages/particles/src/lib/canvas/raster-cache.ts packages/particles/src/lib/canvas/executor.ts packages/particles/src/lib/canvas/primitive.ts packages/particles/src/lib/canvas/component.ts packages/particles/src/lib/canvas/raster-cache.test.ts packages/particles/src/lib/canvas/executor.test.ts packages/particles/src/lib/canvas/component.test.tsx packages/particles/src/index.ts
git commit -m "feat(particles): render canvas particle components"
```

### Task 8: Add the Canvas celebration proving scenario

**Files:**

- Create: packages/scenarios/src/particle-celebration-lab.example.tsx
- Create: packages/scenarios/src/particle-celebration-lab.ts
- Create: packages/scenarios/src/learning/composition/particle-effects.example.tsx
- Create: packages/core/test/particle-celebration-lab.test.ts
- Modify: packages/scenarios/src/catalog.ts
- Modify: packages/scenarios/src/learning-catalog.ts
- Modify: packages/scenarios/src/index.ts
- Modify: packages/scenarios/package.json
- Modify: pnpm-lock.yaml
- Modify: docs/scenario-index.md

**Interfaces:**

```ts
export interface ParticleCelebrationLabState {
  readonly status: CRCParticleSystemStatus;
  readonly execution: CRCParticleExecution;
  readonly acceptedBursts: number;
  readonly rejectedParticles: number;
  readonly lastEvent: CRCParticleSystemEvent["type"] | "mount";
  readonly owner: "mounted" | "removed";
  readonly staleHandleInert: boolean;
}
```

- [ ] Add a failing headless public-API test that mounts the scenario, emits two pointer-positioned bursts, pauses/resumes, restarts with the same seed, drains, clears, removes the owner, and verifies status/events/geometry without importing package internals.
- [ ] Run the scenario test and confirm catalog/source modules are absent.

```sh
corepack pnpm@11.21.0 vitest run packages/core/test/particle-celebration-lab.test.ts --browser.headless --browser.ui=false
```

- [ ] Author a visible 640×360 celebration using one explicit system, one impact emitter, circle and rectangle renderers in separate named emitters, a 300-particle combined capacity, pointerEvents auto, an outer Clip, and a toggleable core filter/Layer.
- [ ] Expose laboratory actions for burst, pause, resume, restart, drain, clear, remove-owner, and reset. State publication must use public signals/events only.
- [ ] Author the learning example with one autoplay ambient effect and one explicit click-burst system. Explain in source comments that acceleration is particle-domain math, while moving the component itself uses ordinary CRC animation/signals.
- [ ] Register validated public metadata, add the workspace particle dependency to @crc/scenarios, update its lockfile importer, and keep lab-only controls out of the learning catalog. Regenerate the scenario index with the repository tool.

```sh
corepack pnpm@11.21.0 scenarios:write-index
corepack pnpm@11.21.0 scenarios:check
corepack pnpm@11.21.0 vitest run packages/core/test/particle-celebration-lab.test.ts --browser.headless --browser.ui=false
```

- [ ] Manually inspect the scenario at seed 42 and record only stable semantic assertions before adding any visual baseline.
- [ ] Commit only Task 8 files.

```sh
git add packages/scenarios/src/particle-celebration-lab.example.tsx packages/scenarios/src/particle-celebration-lab.ts packages/scenarios/src/learning/composition/particle-effects.example.tsx packages/core/test/particle-celebration-lab.test.ts packages/scenarios/src/catalog.ts packages/scenarios/src/learning-catalog.ts packages/scenarios/src/index.ts packages/scenarios/package.json pnpm-lock.yaml docs/scenario-index.md
git commit -m "test(particles): add canvas celebration scenario"
```

### Task 9: Pass the WebGL dependency checkpoint and add @crc/webgl/internal

**Files:**

- Create: packages/webgl/src/internal.ts
- Create: packages/webgl/src/lib/scene/instanced-contributor.test.ts
- Modify: packages/webgl/package.json
- Modify: packages/webgl/tsconfig.build.json
- Modify: packages/webgl/src/lib/scene/types.ts
- Modify: packages/webgl/src/lib/scene/composer.ts
- Modify: packages/webgl/src/lib/scene/settle.ts
- Modify: playground/package-consumer/index.ts
- Modify: playground/package-consumer/runtime.mjs

**Hard checkpoint:**

- [ ] Verify the settled-scene plan and ordinary unlit/emissive material plan are implemented, their focused tests pass, and docs/design contains the current scene material/pass contract. Stop this tranche if composition still performs GL work, if effective opacity is not settled once, or if emissive/post-processing ownership is not explicit.

```sh
corepack pnpm@11.21.0 vitest run packages/webgl/src/lib/scene/composer.test.ts packages/webgl/src/lib/scene/settle.test.ts packages/webgl/src/lib/scene/renderer.test.ts --browser.headless --browser.ui=false
```

**Interfaces:**

```ts
export interface CRCWebGLInstancedRecipe {
  readonly key: object;
  readonly topology: "points" | "triangles";
  readonly vertexSource: string;
  readonly fragmentSource: string;
  readonly verticesPerInstance: number;
  readonly capacity: number;
  readonly staticVertexData?: Readonly<Float32Array>;
  readonly lookupTables: readonly CRCWebGLLookupTableRecipe[];
  readonly sprite?: CRCWebGLSpriteRecipe;
}

export interface CRCWebGLInstancedSubmission {
  readonly kind: "instanced";
  readonly componentName: string;
  readonly source: CRCElementSource | undefined;
  readonly localModel: Readonly<Float32Array>;
  readonly localBounds: CRCWebGLBounds;
  readonly opacity: number;
  readonly material: CRCWebGLSceneMaterialIntent;
  readonly depthTest: boolean;
  readonly depthWrite: boolean;
  readonly sorting: "none" | "oldest-first" | "youngest-first";
  readonly target: CRCEventTargetRegistration | undefined;
  readonly recipe: CRCWebGLInstancedRecipe;
  readonly frameUniforms: Readonly<Float32Array>;
}

export function submitWebGLInstanced(input: CRCWebGLInstancedSubmission): void;
```

- [ ] Add failing CPU-only tests proving an instanced submission snapshots model ancestry, source metadata, bounds, target, material intent, opacity, depth, recipe identity, and frame uniforms without GL calls or mutable-array aliasing.
- [ ] Add failing settlement tests proving frustum culling, effective opacity multiplication once, ordinary unlit/emissive pass classification, stable source ties, projected component-level interaction bounds, and batching only within one submission.
- [ ] Run focused tests and confirm the internal entry/submission kind are missing.
- [ ] Add @crc/webgl/internal as an official version-coupled export with declaration/runtime files and no public-root re-export. Build it alongside index.ts and externalize @crc/core/internal.
- [ ] Extend the settled scene entry union with the closed instanced record. Composer assigns sourceIndex and copies arrays. Settlement uses the ordinary material/pass functions rather than a particle-only pass.
- [ ] Validate shader/recipe records as trusted official-package data without making them public application APIs. No callback in the recipe receives a WebGL context.
- [ ] Update package consumer compile/runtime expectations and prove @crc/webgl/internal resolves one packed @crc/webgl identity without leaking into @crc/webgl root.

```sh
corepack pnpm@11.21.0 vitest run packages/webgl/src/lib/scene/instanced-contributor.test.ts --browser.headless --browser.ui=false
corepack pnpm@11.21.0 test:package-consumer
```

- [ ] Commit only Task 9 files.

```sh
git add packages/webgl/src/internal.ts packages/webgl/src/lib/scene/instanced-contributor.test.ts packages/webgl/package.json packages/webgl/tsconfig.build.json packages/webgl/src/lib/scene/types.ts packages/webgl/src/lib/scene/composer.ts packages/webgl/src/lib/scene/settle.ts playground/package-consumer/index.ts playground/package-consumer/runtime.mjs
git commit -m "feat(webgl): add official instanced scene submissions"
```

### Task 10: Render transactional instanced recipes in settled WebGL scenes

**Files:**

- Create: packages/webgl/src/lib/scene/instanced-renderer.test.ts
- Modify: packages/webgl/src/lib/scene/renderer.ts
- Modify: packages/webgl/src/lib/gpu/renderer-resources.ts
- Modify: packages/webgl/src/lib/gpu/renderer-resources.test.ts
- Modify: packages/webgl/src/lib/backend.test.ts
- Modify: packages/webgl/src/lib/layer-controller.test.ts

**Interfaces:**

```ts
interface ResidentInstancedResources {
  readonly program: WebGLProgram;
  readonly vertexArray: WebGLVertexArrayObject;
  readonly staticVertexBuffer?: WebGLBuffer;
  readonly lookupTextures: readonly WebGLTexture[];
  readonly spriteTexture?: WebGLTexture;
}
```

- [ ] Add failing fake-GL tests for lazy program creation, one static point/quad upload, LUT/sprite texture creation, uniform update, drawArraysInstanced capacity count, ordinary pass state, one draw per settled submission, cache reuse, and no readback.
- [ ] Add failure tests for shader creation, partial buffer/texture/VAO construction, uniform upload, draw, bitmap transfer, context loss, rollback, resident generation reuse, and exact disposal.
- [ ] Run focused tests and confirm instanced entries are not rendered.

```sh
corepack pnpm@11.21.0 vitest run packages/webgl/src/lib/scene/instanced-renderer.test.ts packages/webgl/src/lib/gpu/renderer-resources.test.ts packages/webgl/src/lib/backend.test.ts packages/webgl/src/lib/layer-controller.test.ts --browser.headless --browser.ui=false
```

- [ ] Extend the existing renderer resource transaction with recipe-keyed instanced records. Candidate-only handles delete on rollback; successfully referenced records promote with the whole scene; unreachable committed records sweep only after successful commit.
- [ ] Compile and link only trusted recipe sources after scene composition closes. Sanitize shader failures through the existing WebGL diagnostic policy.
- [ ] Upload static vertex data and immutable lookup/sprite data once per context generation. Per frame, upload only the fixed small frameUniforms block.
- [ ] Render instanced entries through the already settled ordinary pass order and state baseline. Use drawArraysInstanced with instance count equal to capacity; the shader clips nonliving instances without CPU readback.
- [ ] Include instanced resource generations in the existing candidate scene/bitmap transaction. Context loss invalidates them with all other scene resources.
- [ ] Prove one completed dirty island still performs one transferToImageBitmap and one outer Canvas composite.
- [ ] Re-run focused tests.

```sh
corepack pnpm@11.21.0 vitest run packages/webgl/src/lib/scene/instanced-renderer.test.ts packages/webgl/src/lib/gpu/renderer-resources.test.ts packages/webgl/src/lib/backend.test.ts packages/webgl/src/lib/layer-controller.test.ts --browser.headless --browser.ui=false
```

- [ ] Commit only Task 10 files.

```sh
git add packages/webgl/src/lib/scene/instanced-renderer.test.ts packages/webgl/src/lib/scene/renderer.ts packages/webgl/src/lib/gpu/renderer-resources.ts packages/webgl/src/lib/gpu/renderer-resources.test.ts packages/webgl/src/lib/backend.test.ts packages/webgl/src/lib/layer-controller.test.ts
git commit -m "feat(webgl): render transactional instanced recipes"
```

### Task 11: Compile and contribute stateless Particles3D

**Files:**

- Create: packages/particles/src/lib/webgl/shader.ts
- Create: packages/particles/src/lib/webgl/recipe.ts
- Create: packages/particles/src/lib/webgl/component.ts
- Create: packages/particles/src/lib/webgl/shader.test.ts
- Create: packages/particles/src/lib/webgl/recipe.test.ts
- Create: packages/particles/src/lib/webgl/component.test.tsx
- Modify: packages/particles/src/webgl.ts

**Interfaces:**

```ts
interface StatelessWebGLParticlePlan {
  readonly execution: "stateless-webgl";
  readonly topology: "points" | "triangles";
  readonly capacity: number;
  readonly shaderKey: object;
  readonly curveTable: Readonly<Float32Array>;
  readonly gradientTable: Readonly<Float32Array>;
  readonly frameUniforms: Float32Array;
}
```

- [ ] Add failing shader golden tests that compare CPU and GPU-equivalent hash, birth, shape, acceleration, drag, age, curve, gradient, point-size, and billboard math within documented tolerance.
- [ ] Add failing component tests for use outside WebGLLayer, Group3D ancestry, fixed render parameters, definition replacement, unsupported manual/dynamic-spawn capability, point and billboard recipes, unlit alpha/additive/emissive intent, depth state, culling, pointerEvents none, explicit interaction bounds, failed scene adoption, and removal.
- [ ] Run focused tests and confirm the WebGL implementation is absent.

```sh
corepack pnpm@11.21.0 vitest run packages/particles/src/lib/webgl/shader.test.ts packages/particles/src/lib/webgl/recipe.test.ts packages/particles/src/lib/webgl/component.test.tsx --browser.headless --browser.ui=false
```

- [ ] Generate shader source only from closed compiler records. User input never contributes GLSL identifiers, statements, snippets, defines, or callbacks.
- [ ] Use gl_InstanceID plus seed/emitter/channel hashes to reconstruct scheduled births and analytic state. Clip dead instances before rasterization. Use one vertex for points and one immutable six-vertex quad for billboards.
- [ ] Pack the 257-sample curve and gradient tables into immutable lookup recipes. Keep fixed spawn/simulation parameters in the recipe key and live render parameters in the reusable frameUniforms array.
- [ ] Reject Project 1 stateless-webgl binding before resource acquisition when the definition contains manual emission, changing spawn/simulation parameters, distance sorting, world space, or another stateful-only feature. Publish execution unbound and deliver a capability diagnostic.
- [ ] Implement Particles3D as a component-owned binding that snapshots its successful parameter candidate, current Group3D model ancestry, current system frame, material intent, bounds, and one optional backend event target before submitWebGLInstanced.
- [ ] Require explicit finite local interaction bounds when pointerEvents auto. Project them during ordinary scene settlement; never perform per-particle ray tests.
- [ ] Reuse one recipe identity per compiled definition/renderer/context-independent layout. Do not merge separate mounted systems in Project 1.
- [ ] Export Particles3D from webgl.ts, then run focused tests and the package build.

```sh
corepack pnpm@11.21.0 vitest run packages/particles/src/lib/webgl/shader.test.ts packages/particles/src/lib/webgl/recipe.test.ts packages/particles/src/lib/webgl/component.test.tsx --browser.headless --browser.ui=false
corepack pnpm@11.21.0 --filter @crc/particles build
```

- [ ] Commit only Task 11 files.

```sh
git add packages/particles/src/lib/webgl/shader.ts packages/particles/src/lib/webgl/recipe.ts packages/particles/src/lib/webgl/component.ts packages/particles/src/lib/webgl/shader.test.ts packages/particles/src/lib/webgl/recipe.test.ts packages/particles/src/lib/webgl/component.test.tsx packages/particles/src/webgl.ts
git commit -m "feat(particles): contribute settled webgl particles"
```

### Task 12: Add the high-count WebGL ambient proving scenario

**Files:**

- Create: packages/scenarios/src/webgl-particle-ambient-lab.example.tsx
- Create: packages/scenarios/src/webgl-particle-ambient-lab.ts
- Create: packages/core/test/webgl-particle-ambient-lab.test.ts
- Modify: packages/scenarios/src/catalog.ts
- Modify: packages/scenarios/src/index.ts
- Modify: docs/scenario-index.md

**Interfaces:**

- [ ] Add a failing public-API test for a 20,000-capacity ember system beside an ordinary opaque mesh and a later-declared light/environment input from the implemented material project. Assert scene classification, effective opacity, source tie behavior, projected bounds, one instanced draw, zero per-particle CPU updates/uploads, one bitmap transfer, and deterministic restart.
- [ ] Run the focused test and confirm scenario/catalog support is absent.

```sh
corepack pnpm@11.21.0 vitest run packages/core/test/webgl-particle-ambient-lab.test.ts --browser.headless --browser.ui=false
```

- [ ] Author a visible ambient scene using the approved embers shape: sphere-volume emission, seeded lifetime/velocity/size, acceleration plus drag, over-life size/color, additive billboard material, finite sphere bounds, and seed 42.
- [ ] Keep the effect stateless-WebGL compatible: automatic rate only, fixed spawn/simulation parameters, render-only intensity control, no manual emission, no distance sorting, and no world space.
- [ ] Expose pause, resume, restart, opacity, remove-owner, context-loss/recovery, and reset laboratory actions. Publish public status/execution plus scenario-owned structural counters.
- [ ] Register the public example metadata, regenerate the scenario index, and verify source/built catalog consistency.

```sh
corepack pnpm@11.21.0 scenarios:write-index
corepack pnpm@11.21.0 scenarios:check
corepack pnpm@11.21.0 vitest run packages/core/test/webgl-particle-ambient-lab.test.ts --browser.headless --browser.ui=false
```

- [ ] Inspect the seed-42 scene visually and add/update a baseline only after comparing expected, actual, and diff images.
- [ ] Commit only Task 12 files.

```sh
git add packages/scenarios/src/webgl-particle-ambient-lab.example.tsx packages/scenarios/src/webgl-particle-ambient-lab.ts packages/core/test/webgl-particle-ambient-lab.test.ts packages/scenarios/src/catalog.ts packages/scenarios/src/index.ts docs/scenario-index.md
git commit -m "test(particles): add webgl ambient scenario"
```

### Task 13: Lock lifecycle, failure, and structural performance

**Files:**

- Create: packages/core/test/particle-ownership.test.ts
- Create: packages/core/test/particle-performance.test.ts
- Modify: packages/particles/src/lib/system/ownership.ts
- Modify: packages/particles/src/lib/canvas/executor.ts
- Modify: packages/particles/src/lib/canvas/raster-cache.ts
- Modify: packages/particles/src/lib/webgl/recipe.ts
- Modify: package.json

**Interfaces:**

```ts
export interface ParticleOwnershipSnapshot {
  readonly activeSystems: number;
  readonly createdSystems: number;
  readonly releasedSystems: number;
  readonly activeBindings: number;
  readonly acquiredBindings: number;
  readonly releasedBindings: number;
  readonly schedulerRegistrations: number;
  readonly queuedCommands: number;
  readonly canvasLedgers: number;
  readonly canvasRasterEntries: number;
  readonly webglRecipes: number;
}
```

- [ ] Add failing lifecycle tests that balance every counter across autoplay, repeated bursts, pause/resume, definition replacement, parameter replacement, removal, key replacement, failed root render, Canvas draw failure, WebGL settlement/draw/transfer failure, context loss/restoration, and root disposal.
- [ ] Add failing structural tests proving one host callback across multiple systems/roots, one Advance registration per active system, zero particle component traversals, fixed capacity storage, zero steady-state Canvas sample allocation, bounded Canvas state/raster changes, no readback, zero composition-time GL calls, zero WebGL per-particle CPU update/dynamic upload, and one instanced draw per submission.
- [ ] Add opt-in timing reports for Canvas 100/1,000/10,000 and WebGL 1,000/20,000/80,000 capacities, separating Advance, Canvas draw, scene composition/settlement, WebGL draw, bitmap transfer, and outer composite where instrumentation allows.
- [ ] Run the focused tests and confirm missing counters or structural invariants fail.

```sh
corepack pnpm@11.21.0 vitest run packages/core/test/particle-ownership.test.ts packages/core/test/particle-performance.test.ts --browser.headless --browser.ui=false
```

- [ ] Add counters at acquisition/release sites, not inferred from heap or garbage collection. Make every release idempotent and assert zero live ownership after each injected failure.
- [ ] Add particle tests to test:lifecycle and test:performance. Keep wall-clock thresholds opt-in; deterministic counts remain in the default gate.
- [ ] Run the lifecycle and performance gates.

```sh
corepack pnpm@11.21.0 test:lifecycle
corepack pnpm@11.21.0 test:performance
```

- [ ] Commit only Task 13 files.

```sh
git add packages/core/test/particle-ownership.test.ts packages/core/test/particle-performance.test.ts packages/particles/src/lib/system/ownership.ts packages/particles/src/lib/canvas/executor.ts packages/particles/src/lib/canvas/raster-cache.ts packages/particles/src/lib/webgl/recipe.ts package.json
git commit -m "test(particles): lock ownership and structural cost"
```

### Task 14: Complete consumers, Studio declarations, and packed-package evidence

**Files:**

- Modify: playground/package-consumer/index.ts
- Modify: playground/package-consumer/jsx.tsx
- Modify: playground/package-consumer/runtime.mjs
- Modify: playground/package-consumer/tsconfig.bundler.json
- Modify: playground/package-consumer/tsconfig.nodenext.json
- Modify: tooling/verify-packed-consumer.mjs
- Modify: playground/src/crc-editor-types.txt
- Modify: tooling/verify-studio-types.mjs
- Modify: packages/particles/package.json
- Modify: packages/particles/README.md

**Interfaces:**

- Proves the exact @crc/particles and @crc/particles/webgl runtime/type entry points in workspace, Bundler, NodeNext, packed, source-Studio, and built-Studio consumers while retaining one core and one WebGL nominal identity.

- [ ] Add failing consumer coverage for all six runtime values, the named public types, JSX implicit/explicit modes, emitter inference, optional WebGL peer behavior, root-only tree shaking, and runtime nominal identity.
- [ ] Make the packed verifier install one particles tarball first without @crc/webgl and prove @crc/particles root works, then with matching @crc/webgl and prove @crc/particles/webgl plus @crc/webgl/internal resolve one official package/core identity.
- [ ] Assert tarballs contain dist declarations/runtime/maps and no src tree. Assert the particles root bundle does not include WebGL shader strings, @crc/webgl, preset code, a second scheduler, or a second core element identity.
- [ ] Run consumer checks and observe the expected failures before updating build/export declarations.

```sh
corepack pnpm@11.21.0 test:package-consumer
corepack pnpm@11.21.0 test:package-consumer:packed
```

- [ ] Complete package build entries and declarations, add all public types to the Studio declaration snapshot, and update the exact declaration verifier counts.
- [ ] Run Bundler, NodeNext, packed, Studio type, source build, and built build checks.

```sh
corepack pnpm@11.21.0 test:package-consumer
corepack pnpm@11.21.0 test:package-consumer:packed
node tooling/verify-studio-types.mjs
corepack pnpm@11.21.0 build
corepack pnpm@11.21.0 playground:build:built
```

- [ ] Commit only Task 14 files.

```sh
git add playground/package-consumer/index.ts playground/package-consumer/jsx.tsx playground/package-consumer/runtime.mjs playground/package-consumer/tsconfig.bundler.json playground/package-consumer/tsconfig.nodenext.json tooling/verify-packed-consumer.mjs playground/src/crc-editor-types.txt tooling/verify-studio-types.mjs packages/particles/package.json packages/particles/README.md
git commit -m "test(particles): verify package consumers"
```

### Task 15: Update normative contracts and public documentation

**Files:**

- Create: docs/site/api/components/particles-2d.md
- Create: docs/site/api/components/particles-3d.md
- Create: docs/site/api/functions/define-particle-effect-2d.md
- Create: docs/site/api/functions/define-particle-effect-3d.md
- Create: docs/site/api/functions/particle-descriptors.md
- Create: docs/site/api/hooks/crc-particle-system.md
- Create: docs/site/api/types/particles.md
- Create: docs/site/learn/guides/particle-effects.md
- Modify: docs/site/api/index.md
- Modify: docs/design/animation-contract.md
- Modify: docs/design/signals-and-scheduling-contract.md
- Modify: docs/design/canvas-surface-contract.md
- Modify: docs/design/runtime-hooks-contract.md
- Modify: docs/design/drawing-components-contract.md
- Modify: docs/design/style-system-contract.md
- Modify: docs/design/layout-system-contract.md
- Modify: docs/design/user-events-contract.md
- Modify: docs/design/event-resource-ownership.md
- Modify: docs/design/runtime-resource-ownership.md
- Modify: README.md
- Modify: packages/core/README.md
- Modify: packages/webgl/README.md
- Modify: docs/library-status.md
- Modify: AGENTS.md
- Modify: tooling/verify-docs.mjs
- Modify: tooling/docs-contract-preservation-baseline.json
- Modify: tooling/studio-docs/api-exports.ts
- Modify: tooling/studio-docs/api-exports.check.ts
- Create: tooling/studio-docs/fixtures/api/particles.ts

**Interfaces:**

- Documents every Project 1 value and named public type exactly once, keeps the root/WebGL package boundary visible, and updates the 12 affected normative contracts without treating the research record as current behavior.

- [ ] Add documentation-check expectations first for all six runtime values, public type groups, package/subpath boundaries, Learn/API links, scenario links, and preserved contract statements; run docs checks and observe missing pages/registrations.

```sh
corepack pnpm@11.21.0 docs:check
corepack pnpm@11.21.0 studio-docs:check
```

- [ ] Update normative contracts with the implemented phase ordering, logical-time equations, command/status semantics, definition/parameter adoption, capacity policy, component ownership, Canvas paint/filter/layout/event behavior, WebGL scene submission/material/pass behavior, and exact failure/teardown rules.
- [ ] State explicitly in the animation contract and guide that particle acceleration/gravity/drag are closed population-domain descriptors, WebGL does not standardize them, and ordinary transforms/cameras/materials continue to use CRC signals plus tween/keyframes/spring/defineAnimation/stepper.
- [ ] Document the Project 1 capability boundary: Canvas manual births work; stateless WebGL accepts automatic rate/scheduled births with fixed spawn/simulation parameters; stateful-only definitions produce actionable capability diagnostics until Project 2.
- [ ] Document performance guidance without claiming Canvas GPU acceleration: tight Layer isolation is situational, WebGL uses instancing, capacity is a resource commitment, bounds are required, additive/none sorting is the fast path, and wall-clock results are environment-specific.
- [ ] Keep docs/strategy/particle-effects-research.md non-normative. This task does not rewrite the approved historical spec; current shipped behavior is expressed by docs/design and docs/site.
- [ ] Update README/library status/AGENTS.md source-of-truth and package maps. Register only docs/site content for public Studio search.
- [ ] Extend crcPublicEntryPaths with particles and particlesWebgl, add the fixture and coverage assertions, and register every new page in verify-docs.mjs. Update the preservation baseline only after reviewing each deliberately changed normative sentence.
- [ ] Run docs, catalog, links, formatting, and type inventory checks.

```sh
corepack pnpm@11.21.0 docs:check
corepack pnpm@11.21.0 studio-docs:check
corepack pnpm@11.21.0 scenarios:check
corepack pnpm@11.21.0 lint:format
```

- [ ] Commit only Task 15 files plus exact generated documentation inventory changes.

```sh
git add docs/site/api/components/particles-2d.md docs/site/api/components/particles-3d.md docs/site/api/functions/define-particle-effect-2d.md docs/site/api/functions/define-particle-effect-3d.md docs/site/api/functions/particle-descriptors.md docs/site/api/hooks/crc-particle-system.md docs/site/api/types/particles.md docs/site/learn/guides/particle-effects.md docs/site/api/index.md docs/design/animation-contract.md docs/design/signals-and-scheduling-contract.md docs/design/canvas-surface-contract.md docs/design/runtime-hooks-contract.md docs/design/drawing-components-contract.md docs/design/style-system-contract.md docs/design/layout-system-contract.md docs/design/user-events-contract.md docs/design/focus-and-keyboard-navigation-contract.md docs/design/mouse-interaction-contract.md docs/design/event-resource-ownership.md docs/design/runtime-resource-ownership.md README.md packages/core/README.md packages/webgl/README.md docs/library-status.md AGENTS.md tooling/verify-docs.mjs tooling/docs-contract-preservation-baseline.json tooling/studio-docs/api-exports.ts tooling/studio-docs/api-exports.check.ts tooling/studio-docs/fixtures/api/particles.ts
git commit -m "docs(particles): publish first-class particle effects"
```

### Task 16: Run final visual, browser, package, lifecycle, and aggregate gates

**Files:**

- Create only after intentional visual review: packages/core/test/visual-baselines/first-class-particle-celebration.expected.png
- Create only after intentional visual review: packages/core/test/visual-baselines/webgl-particle-ambient.expected.png
- Create: docs/testing/field-notes/2026-09-13-first-class-particle-effects.md

**Interfaces:**

- Produces fresh semantic, visual, ownership, package, documentation, and aggregate evidence for the six public runtime values and both renderer paths on the documented toolchain.

- [ ] Run focused semantic suites before visual evidence.

```sh
corepack pnpm@11.21.0 vitest run packages/particles/src packages/core/test/particle-celebration-lab.test.ts packages/core/test/webgl-particle-ambient-lab.test.ts packages/core/test/particle-ownership.test.ts packages/core/test/particle-performance.test.ts --browser.headless --browser.ui=false
```

- [ ] Run scenario, documentation, type, lint, package, lifecycle, performance, source-browser, built-browser, and Studio gates.

```sh
corepack pnpm@11.21.0 scenarios:check
corepack pnpm@11.21.0 docs:check
corepack pnpm@11.21.0 studio-docs:check
corepack pnpm@11.21.0 typecheck
corepack pnpm@11.21.0 lint
corepack pnpm@11.21.0 test:package-consumer:packed
corepack pnpm@11.21.0 test:lifecycle
corepack pnpm@11.21.0 test:performance
corepack pnpm@11.21.0 test:ci
corepack pnpm@11.21.0 test:smoke:built
corepack pnpm@11.21.0 test:studio-visual
```

- [ ] Inspect every particle expected/actual/diff image. Accept a baseline only when semantic counts/bounds/pass order already pass and the pixel change matches the approved effect.
- [ ] Run the aggregate trust gate on the documented environment.

```sh
node --version
corepack pnpm@11.21.0 --version
corepack pnpm@11.21.0 trust
```

- [ ] Record exact commands, environment, fresh results, intentional visual decisions, known browser variance, and opt-in benchmark observations in the field note. Do not copy historical test totals.
- [ ] Run a final public-surface scan proving no raw GL context, preset subpath, stateful execution implementation, particle callback, per-particle target, or source-path import leaked.

```sh
rg -n "WebGL2RenderingContext|requestAnimationFrame|setInterval|setTimeout|onParticle|activeCount|@crc/core/lib|@crc/webgl/src|presets" packages/particles/src packages/particles/dist playground/package-consumer
```

- [ ] Commit final evidence and any inspected intentional particle baselines.

```sh
git add docs/testing/field-notes/2026-09-13-first-class-particle-effects.md packages/core/test/visual-baselines/first-class-particle-celebration.expected.png packages/core/test/visual-baselines/webgl-particle-ambient.expected.png
git commit -m "test(particles): record aggregate verification"
```

## Completion Criteria

Project 1 is complete only when:

- @crc/particles root works without @crc/webgl installed, while @crc/particles/webgl requires the matching official WebGL peer;
- immutable definitions, seeded values, curves, gradients, emission, bounds, and capability reasons are covered by public and internal tests;
- one system owns every command, scheduler registration, population, binding, callback, and teardown;
- Particles2D passes layout, transform, clip, Layer, filter, paint-order, opacity, interaction, failure, and allocation evidence;
- Particles3D composes no GL work, settles with the complete scene, renders point/billboard instances transactionally, and participates in ordinary opacity/material/depth/culling/post-processing behavior;
- Canvas celebration and high-count WebGL ambient scenarios are both manually usable and headlessly driven;
- structural tests prove bounded storage, no per-particle components/targets, no steady-state Canvas allocation, no WebGL per-particle CPU update/upload, one instanced draw per submission, one dirty-island bitmap transfer, and zero live ownership after failure/disposal;
- Bundler, NodeNext, packed, Studio, source, built, lifecycle, performance, visual, documentation, and aggregate trust gates pass freshly; and
- the field note records the actual environment and results without treating this plan or old documentation as verification evidence.
