---
id: api-overview
title: API overview
summary: The supported @crc/core and @crc/webgl APIs, arranged by authoring role.
kind: api
slug: overview
apiCategory: overview
symbols: [Fragment, JSX, jsx, jsxDEV, jsxs]
keywords: [canvas, webgl, JSX, createElement, API]
---

# API overview

Import Canvas/runtime values and types from `@crc/core`. Import optional WebGL2
island values and types from `@crc/webgl`. Subpaths below `@crc/core/lib/*`,
`@crc/core/src/*`, and `@crc/webgl/lib/*` are not supported.

```ts
import { Fragment, Rectangle, Text, crc } from "@crc/core";
import { Cube, WebGLLayer } from "@crc/webgl";
```

## Authoring

Use automatic JSX with `@crc/core/jsx-runtime`, or use
[`createElement`](#/api/functions/create-element) for the equivalent explicit
form. `Fragment` is the explicit fragment value; JSX shorthand is usually more
readable, while `Fragment` is useful when a fragment needs a key. Unkeyed
fragments are transparent; a keyed fragment creates an identity scope.

## Browse the runtime

- [Components](#/api/components/absolute) draw, compose, lay out, and add
  focus policy. They are alphabetized in the sidebar.
- [Functions](#/api/functions/crc) mount scenes, build paths, measure, and
  resolve the public style/layout helpers.
- [Hooks](#/api/hooks/crc-canvas-context) are render-only APIs for state,
  lifecycle, paths, interaction, and allocated layout.

Type contracts are grouped by domain in the API sidebar. They describe the
props, local styles, event facades, filters, layout, and element protocol used
by these runtime values.

## WebGL islands

`@crc/webgl` adds [`WebGLLayer`](#/api/components/webgl-layer),
[`Group3D`](#/api/components/group-3d), [`Mesh`](#/api/components/mesh),
[`Cube`](#/api/components/cube), and [`Sphere`](#/api/components/sphere).
[`createWebGLGeometry`](#/api/functions/create-webgl-geometry) builds immutable
triangle descriptors for `Mesh`, the custom-shape extension path;
[`crcAnimationFrame`](#/api/hooks/crc-animation-frame) uses the shared
scheduler. A layer's children declare one frame-local scene that is settled and
rendered only after composition succeeds. See the grouped [WebGL
types](#/api/types/webgl).

Both packages use the one `@crc/core/jsx-runtime` configured for the source
file. `@crc/webgl` does not publish a second JSX runtime or hook/event system.
The version-coupled `@crc/core/internal` export exists only for matching
official CRC packages. It is intentionally absent from this application API
inventory and carries no compatibility promise.

## Compiler entries

`@crc/core/jsx-runtime` exports `Fragment`, `jsx`, and `jsxs`; its local `JSX`
namespace exports `Element`, `ElementType`, `ElementChildrenAttribute`,
`IntrinsicAttributes`, `IntrinsicElements`, and `LibraryManagedAttributes`.
`Element` is the branded `CRCElement`; `ElementType` is a synchronous CRC
component; `ElementChildrenAttribute` names `children`; `IntrinsicAttributes`
admits a string or numeric `key`; `IntrinsicElements` is empty; and
`LibraryManagedAttributes` maps primitive values to their specified-style input.

`@crc/core/jsx-dev-runtime` exports `Fragment` and `jsxDEV` plus the same local
`JSX` namespace. `jsxDEV` carries development-only filename, line, and column
metadata for diagnostics. These compiler-facing constructors are not normal
application APIs: use JSX or `createElement`, never call them directly.

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

Start with the [Getting started guide](#/learn/guides/configure-jsx).
Add 3D content with the [WebGL islands guide](#/learn/guides/webgl-islands).
