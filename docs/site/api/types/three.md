---
id: api-types-three
title: Three.js integration types
summary: Lifecycle resources, context, targets, picking, input, and renderer options for @crc/three.
kind: api
slug: three
apiCategory: types
symbols:
  [
    CRCThreeInputBridge,
    CRCThreeLayerContext,
    CRCThreeLayerDefinition,
    CRCThreeLayerResources,
    CRCThreePicker,
    CRCThreePickResult,
    CRCThreeRendererOptions,
    CRCThreeTarget,
  ]
---

# Three.js integration types

Import these contracts with `type` from `@crc/three`.

## `CRCThreeInputBridge`

Its `connect()` method supplies the input element expected by controls such as
OrbitControls.

## `CRCThreeLayerContext`

Extends the core render-layer context with the owned `THREE.WebGLRenderer` and
input bridge.

## `CRCThreeLayerDefinition`

Defines the synchronous `create`, `update`, `resize`, `render`, `targets`,
`pick`, and `dispose` callbacks used by `defineThreeLayer()`.

## `CRCThreeLayerResources`

Requires the application resource value to expose a Three `scene` and
`camera`.

## `CRCThreePicker`

A custom layer-local point picker that can replace default raycasting.

## `CRCThreePickResult`

The miss, block, or Three-object target result returned by a picker.

## `CRCThreeRendererOptions`

Normal Three renderer parameters except `canvas` and `alpha`; the adapter owns
the OffscreenCanvas and always enables a transparent compositing surface.

## `CRCThreeTarget`

Associates an ordinary `THREE.Object3D` with CRC event handlers, cursor, pointer
policy, focusability, and optional keyboard-navigation bounds.
