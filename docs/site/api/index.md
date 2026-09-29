---
id: api-overview
title: API overview
summary: The supported @crc/core, @crc/three, @crc/particles, @crc/physics, and @crc/viz APIs, arranged by authoring role.
kind: api
slug: overview
apiCategory: overview
symbols: [Fragment, JSX, jsx, jsxDEV, jsxs]
keywords: [canvas, three.js, JSX, createElement, API]
---

# API overview

Import Canvas components, signals, animation, events, layout, focus, and the
generic render-layer lifecycle from `@crc/core`. Optional official packages add
thin Three.js integration, Canvas particle effects, physics, and visualization:

```ts
import { Rectangle, Text, crc, defineRenderLayer } from "@crc/core";
import { defineThreeLayer } from "@crc/three";
import { Particles2D } from "@crc/particles";
import { PhysicsWorld2D } from "@crc/physics/2d";
import { raycast3D } from "@crc/physics/3d/geometry";
import { Axis, LineSeries, Scale } from "@crc/viz";
```

Package source paths and `lib/*` paths are not supported.

## Authoring

Use automatic JSX with `@crc/core/jsx-runtime`, or use
[`createElement`](#/api/functions/create-element) for the equivalent explicit
form. `Fragment` is the explicit fragment value; JSX shorthand is usually more
readable, while `Fragment` is useful when a fragment needs a key.

- [Components](#/api/components/absolute) draw, compose, lay out, and add focus
  policy.
- [Functions](#/api/functions/crc) mount scenes and define paths, animation,
  measurement, render layers, particles, and geometry.
- [Hooks](#/api/hooks/use-canvas-context) own component state, lifecycle,
  interaction, paths, layout, playback, particles, and 2D physics handles.
- Type pages group the props, events, filters, layout, signals, animation, and
  package-specific contracts used by those values.

## External render layers and Three.js

[`defineRenderLayer`](#/api/functions/define-render-layer) creates one
composited external-raster component with explicit create, update, resize,
render, interaction, and dispose callbacks.

`@crc/three` adds only
[`defineThreeLayer`](#/api/functions/define-three-layer) and its
[Three integration types](#/api/types/three). Applications use ordinary
`three` and `three/addons/*` APIs for scenes, cameras, geometry, materials,
lights, loaders, controls, animation mixers, post-processing, and exporters.
CRC owns the surrounding Canvas composition, scheduler, hit arbitration, focus,
and teardown; it does not mirror Three as CRC JSX components.

## Particle effects

`@crc/particles` adds
[`Particles2D`](#/api/components/particles-2d),
[`useParticleSystem`](#/api/hooks/use-particle-system),
[`defineParticleEffect2D`](#/api/functions/define-particle-effect-2d), and the
direct [particle descriptor functions](#/api/functions/particle-descriptors).
See the grouped [particle types](#/api/types/particles) and
[particle effects guide](#/learn/guides/particle-effects).

## Physics

`@crc/physics/2d` provides the CRC-scheduled 2D runtime, components, body
handles, commands, events, and queries. Pure geometry is available from
`@crc/physics/2d/geometry`.

Renderer-independent 3D shapes and pure bounds, mass, containment, distance,
overlap, contact, ray-cast, shape-cast, and transform operations remain
available from `@crc/physics/3d/geometry`. CRC does not currently publish a
Three object binding or 3D runtime component surface.

There is no root `@crc/physics` barrel and no independent physics clock.

## Visualization

`@crc/viz` provides allocation-relative
[`Scale`](#/api/components/scale), [`Axis`](#/api/components/axis),
[`LineSeries`](#/api/components/line-series),
[`ScaleAdjust`](#/api/components/scale-adjust), and
[`useScale`](#/api/hooks/use-scale).

## Compiler entries

`@crc/core/jsx-runtime` exports `Fragment`, `jsx`, and `jsxs`; its local
`JSX` namespace describes CRC elements and synchronous component types.
`@crc/core/jsx-dev-runtime` exports `Fragment` and `jsxDEV` plus the same
local namespace. These compiler-facing constructors are not normal application
APIs: use JSX or `createElement`, never call them directly.

`@crc/core/types` preserves the explicit type-only package entry. Most authors
can import types from `@crc/core` beside the corresponding runtime values.

## A small scene

```tsx
function Poster() {
  return (
    <>
      <Rectangle
        style={{ x: 24, y: 24, width: 240, height: 100, fill: "#164e9b" }}
      />
      <Text
        style={{ x: 48, y: 78, fill: "white", font: "600 28px sans-serif" }}
      >
        Hello, CRC
      </Text>
    </>
  );
}

crc(document.querySelector("canvas")!, <Poster />);
```

Start with the [Getting started guide](#/learn/guides/configure-jsx). Add an
ordinary Three scene with [Use Three.js inside CRC](#/learn/guides/three-js),
then explore the
[Three.js instancing example](#/examples/three/three-instancing).
