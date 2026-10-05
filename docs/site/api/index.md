---
id: api-overview
title: API overview
summary: The supported @pibbl/core, @pibbl/three, @pibbl/core/particles, @pibbl/core/physics, and @pibbl/core/viz APIs, arranged by authoring role.
kind: api
slug: overview
apiCategory: overview
symbols: [Fragment, JSX, jsx, jsxDEV, jsxs]
keywords: [canvas, three.js, JSX, createElement, API]
---

# API overview

Import Canvas components, signals, animation, events, layout, focus, and the
generic render-layer lifecycle from `@pibbl/core`. Optional official packages add
thin Three.js integration, Canvas particle effects, physics, and visualization:

```ts
import { Rectangle, Text, pibbl, defineRenderLayer } from "@pibbl/core";
import { defineThreeLayer } from "@pibbl/three";
import { Particles2D } from "@pibbl/core/particles";
import { PhysicsWorld2D } from "@pibbl/core/physics/2d";
import { Axis, LineSeries, Scale } from "@pibbl/core/viz";
```

Package source paths and `lib/*` paths are not supported.

## Authoring

Use automatic JSX with `@pibbl/core/jsx-runtime`, or use
[`createElement`](#/api/functions/create-element) for the equivalent explicit
form. `Fragment` is the explicit fragment value; JSX shorthand is usually more
readable, while `Fragment` is useful when a fragment needs a key.

- [Components](#/api/components/absolute) draw, compose, lay out, and add focus
  policy.
- [Functions](#/api/functions/pibbl) mount scenes and define paths, animation,
  measurement, render layers, particles, and geometry.
- [Hooks](#/api/hooks/use-canvas-context) own component state, lifecycle,
  interaction, paths, layout, playback, particles, and 2D physics handles.
- Type pages group the props, events, filters, layout, signals, animation, and
  package-specific contracts used by those values.

## External render layers and Three.js

[`defineRenderLayer`](#/api/functions/define-render-layer) creates one
composited external-raster component with explicit create, update, resize,
render, interaction, and dispose callbacks.

`@pibbl/three` adds only
[`defineThreeLayer`](#/api/functions/define-three-layer) and its
[Three integration types](#/api/types/three). Applications use ordinary
`three` and `three/addons/*` APIs for scenes, cameras, geometry, materials,
lights, loaders, controls, animation mixers, post-processing, and exporters.
Pibbl owns the surrounding Canvas composition, scheduler, hit arbitration, focus,
and teardown; it does not mirror Three as Pibbl JSX components.

## Particle effects

`@pibbl/core/particles` adds
[`Particles2D`](#/api/components/particles-2d),
[`useParticleSystem`](#/api/hooks/use-particle-system),
[`defineParticleEffect2D`](#/api/functions/define-particle-effect-2d), and the
direct [particle descriptor functions](#/api/functions/particle-descriptors).
See the grouped [particle types](#/api/types/particles) and
[particle effects guide](#/learn/guides/particle-effects).

## Physics

`@pibbl/core/physics/2d` provides the Pibbl-scheduled 2D runtime, components, body
handles, commands, events, and queries. Pure geometry is available from
`@pibbl/core/physics/2d/geometry`.

There is no root `@pibbl/core/physics` barrel and no independent physics clock.

## Visualization

`@pibbl/core/viz` provides allocation-relative
[`Scale`](#/api/components/scale), [`Axis`](#/api/components/axis),
[`LineSeries`](#/api/components/line-series),
[`PointSeries`](#/api/components/point-series),
[`PlotSeries`](#/api/components/plot-series),
[`ScaleAdjust`](#/api/components/scale-adjust), and
[`useScale`](#/api/hooks/use-scale).

Compose inspection with [`HoverData`](#/api/components/hover-data),
[`HoverCard`](#/api/components/hover-card),
[`AnchoredLayout`](#/api/components/anchored-layout),
[`defineSeries`](#/api/functions/define-series),
[`closestPoint`](#/api/functions/closest-point),
[`closestX`](#/api/functions/closest-x),
[`interpolateX`](#/api/functions/interpolate-x), and
[`linearInterpolation`](#/api/functions/linear-interpolation). Plain snapshot
helpers [`nearestPoint`](#/api/functions/nearest-point) and
[`nearestDomainValue`](#/api/functions/nearest-domain-value) are also
available.

## Compiler entries

`@pibbl/core/jsx-runtime` exports `Fragment`, `jsx`, and `jsxs`; its local `JSX`
namespace exports `Element`, `ElementType`, `ElementChildrenAttribute`,
`IntrinsicAttributes`, `IntrinsicElements`, and `LibraryManagedAttributes`.
`Element` is the branded `PibblElement`; `ElementType` is a synchronous Pibbl
component; `ElementChildrenAttribute` names `children`; `IntrinsicAttributes`
admits a string or numeric `key`; `IntrinsicElements` is empty; and
`LibraryManagedAttributes` maps primitive values to their specified-style input.

`@pibbl/core/jsx-dev-runtime` exports `Fragment` and `jsxDEV` plus the same local
`JSX` namespace. `jsxDEV` carries development-only filename, line, and column
metadata for diagnostics. These compiler-facing constructors are not normal
application APIs: use JSX or `createElement`, never call them directly.

`@pibbl/core/types` preserves the explicit type-only package entry. Most authors
can import types from `@pibbl/core` beside the corresponding runtime values.

## A small scene

```tsx
function Poster() {
  return (
    <>
      <Rectangle
        style={{ left: 24, top: 24, width: 240, height: 100, fill: "#164e9b" }}
      />
      <Text
        style={{
          left: 48,
          top: 78,
          fill: "white",
          font: "600 28px sans-serif",
        }}
      >
        Hello, Pibbl
      </Text>
    </>
  );
}

pibbl(document.querySelector("canvas")!, <Poster />);
```

Start with the [Getting started guide](#/learn/guides/configure-jsx). Add an
ordinary Three scene with [Use Three.js inside Pibbl](#/learn/guides/three-js),
then explore the
[Three.js instancing example](#/examples/three/three-instancing).

## State machines and sprites

- [Machine functions](#/api/functions/machines) and [useMachine](#/api/hooks/use-machine) coordinate general application state and owned work.
- [playAnimation](#/api/functions/play-animation) integrates optional state-owned playback.
- [Sprite](#/api/components/sprite) and [sprite sheets](#/api/functions/sprite-sheets) draw shared atlas frames.
- [Machine types](#/api/types/machines) and [sprite types](#/api/types/sprites) describe their public contracts.
