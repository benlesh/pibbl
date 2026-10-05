---
id: api-types-three
title: Three.js integration types
summary: Lifecycle resources, context, targets, picking, input, and renderer options for @pibbl/three.
kind: api
slug: three
apiCategory: types
symbols:
  [
    PibblThreeInputBridge,
    PibblThreeLayerContext,
    PibblThreeLayerDefinition,
    PibblThreeLayerResources,
    PibblThreePicker,
    PibblThreePickResult,
    PibblThreeRendererOptions,
    PibblThreeTarget,
  ]
---

# Three.js integration types

Import these contracts with `type` from `@pibbl/three`.

## `PibblThreeInputBridge`

Its `connect()` method supplies the input element expected by controls such as
OrbitControls.

## `PibblThreeLayerContext`

Extends the core render-layer context with the owned `THREE.WebGLRenderer` and
input bridge.

## `PibblThreeLayerDefinition`

Defines the synchronous `create`, `update`, `resize`, `render`, `targets`,
`pick`, and `dispose` callbacks used by `defineThreeLayer()`.

## `PibblThreeLayerResources`

Requires the application resource value to expose a Three `scene` and
`camera`.

## `PibblThreePicker`

A custom layer-local point picker that can replace default raycasting.

## `PibblThreePickResult`

The miss, block, or Three-object target result returned by a picker.

## `PibblThreeRendererOptions`

Normal Three renderer parameters except `canvas` and `alpha`; the adapter owns
the OffscreenCanvas and always enables a transparent compositing surface.

## `PibblThreeTarget`

Associates an ordinary `THREE.Object3D` with Pibbl event handlers, cursor, pointer
policy, focusability, and optional keyboard-navigation bounds.
