---
id: api-types-webgl
title: WebGL types
summary: Camera, geometry, primitive, component, and render-context contracts for @crc/webgl.
kind: api
slug: webgl
apiCategory: types
typeDomain: webgl
symbols:
  [
    CRCWebGLCameraSnapshot,
    CRCWebGLContext,
    CRCWebGLGeometry,
    CRCWebGLGeometryInput,
    CRCWebGLHitCapability,
    CRCWebGLPerspectiveCamera,
    CRCWebGLPrimitiveCapabilities,
    CRCWebGLPrimitiveHitInput,
    CRCWebGLPrimitiveInput,
    CRCWebGLPrimitiveRender,
    CRCWebGLProgramProps,
    CRCWebGLTransformStyle,
    CRCWebGLVector3,
    CubeProps,
    CubeStyle,
    Group3DProps,
    Group3DStyle,
    MeshProps,
    MeshStyle,
    SphereProps,
    SphereStyle,
    WebGLLayerProps,
    WebGLLayerStyle,
  ]
keywords: [webgl, camera, geometry, mesh, primitive, context]
---

# WebGL types

Import these public contracts with `type` from `@crc/webgl`. CRC element,
event, node, style-base, and JSX types continue to come from `@crc/core`.

## CRCWebGLCameraSnapshot

`CRCWebGLCameraSnapshot` is the readonly per-frame resolved camera supplied to
custom primitives and hit resolvers. It contains the descriptor, logical
`aspect`, and readonly `Float32Array` view, projection, projection-view, and
inverse-projection-view matrices.

## CRCWebGLContext

`CRCWebGLContext` is the immutable render snapshot available during one custom
WebGL primitive callback. It exposes:

- `gl: WebGL2RenderingContext` and `contextGeneration`;
- resolved `camera` and current `modelMatrix`;
- logical/backing viewport sizes and independent X/Y density;
- the shared frame `timestamp`;
- `resources.use(create, release, deps)` for component-owned context resources.

The release callback receives the owning `gl` and whether its generation was
lost. Values are retained for equal dependency arrays and released before a
dependency/generation change or component teardown.

## CRCWebGLGeometry

`CRCWebGLGeometry` is an opaque branded immutable descriptor with readonly
`vertexCount` and `triangleCount`. Only descriptors created by the current
`@crc/webgl` package are accepted.

## CRCWebGLGeometryInput

`CRCWebGLGeometryInput` is `{ positions: ArrayLike<number>; indices?:
ArrayLike<number> }`. [`createWebGLGeometry`](#/api/functions/create-webgl-geometry)
validates and copies it.

## CRCWebGLHitCapability

`CRCWebGLHitCapability` is the generic `geometry`, `custom`, or `none`
discriminated union documented by
[`defineWebGLPrimitive`](#/api/functions/define-webgl-primitive).

## CRCWebGLPerspectiveCamera

`CRCWebGLPerspectiveCamera` is the only initial camera descriptor. It has
`type: "perspective"`, `position`, `lookAt`, `up`, `fieldOfViewDegrees`,
`near`, and `far`. See [`WebGLLayer`](#/api/components/webgl-layer) for defaults
and validation.

## CRCWebGLPrimitiveCapabilities

`CRCWebGLPrimitiveCapabilities` requires `hit` and optionally provides pure
`normalizeStyle` and allocation-aware `resolveStyle` callbacks.

## CRCWebGLPrimitiveHitInput

`CRCWebGLPrimitiveHitInput` is the generic frozen snapshot passed to a custom
hit resolver. It contains readonly props/style clones, layer-local X/Y, normalized
device X/Y, world-space ray origin/direction, the committed model matrix, and
camera snapshot. The resolver returns `null` or a finite nonnegative distance
along the ray and must not retain the input.

## CRCWebGLPrimitiveInput

`CRCWebGLPrimitiveInput` is the complete generic JSX/`createElement` input for a
WebGL primitive, including its capability-derived props and specified style.

## CRCWebGLPrimitiveRender

`CRCWebGLPrimitiveRender` is the generic `(props, style, context) => CRCNode |
void` callback. It runs synchronously under the active WebGL backend.

## CRCWebGLProgramProps

`CRCWebGLProgramProps` derives a custom primitive's public props from its hit
capability. Geometry/custom hits add event handlers, focus options, and
normal pointer participation; `none` permits only `pointerEvents?: "none"`.

## CRCWebGLTransformStyle

`CRCWebGLTransformStyle` supplies optional `translateX/Y/Z`,
`rotationXDegrees/YDegrees/ZDegrees`, and `scaleX/Y/Z`. It deliberately declares
Canvas `filter` as unavailable for inner WebGL primitives.

## CRCWebGLVector3

`CRCWebGLVector3` is the readonly tuple `[x, y, z]`.

## CubeProps

`CubeProps` accepts event/focus participation.

## CubeStyle

`CubeStyle` extends mesh style with optional positive `size`, default `1`.

## Group3DProps

`Group3DProps` requires recursive `children` and accepts propagation handlers.

## Group3DStyle

`Group3DStyle` is the shared WebGL transform style.

## MeshProps

`MeshProps` requires `geometry` and accepts event/focus participation.

## MeshStyle

`MeshStyle` adds optional concrete `color`, `opacity`, and `cursor` to the
shared transform fields.

## SphereProps

`SphereProps` accepts event/focus participation.

## SphereStyle

`SphereStyle` extends mesh style with optional positive `radius`, default
`0.5`.

## WebGLLayerProps

`WebGLLayerProps` requires `children`, accepts one optional perspective
`camera`, propagation handlers, and `pointerEvents`.

## WebGLLayerStyle

`WebGLLayerStyle` combines core box and layout-item style; width/height may be
omitted and core filters apply to the completed island.
