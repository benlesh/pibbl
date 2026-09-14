---
id: api-types-webgl
title: WebGL types
summary: Camera, geometry, transform, and component contracts for @crc/webgl.
kind: api
slug: webgl
apiCategory: types
typeDomain: webgl
symbols:
  [
    CRCWebGLGeometry,
    CRCWebGLGeometryInput,
    CRCWebGLPerspectiveCamera,
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
keywords: [webgl, camera, geometry, mesh, scene]
---

# WebGL types

Import these public contracts with `type` from `@crc/webgl`. CRC element,
event, node, style-base, and JSX types continue to come from `@crc/core`.

## CRCWebGLGeometry

`CRCWebGLGeometry` is an opaque branded immutable descriptor with readonly
`vertexCount` and `triangleCount`. Only descriptors created by the current
`@crc/webgl` package are accepted.

## CRCWebGLGeometryInput

`CRCWebGLGeometryInput` is `{ positions: ArrayLike<number>; indices?:
ArrayLike<number> }`. [`createWebGLGeometry`](#/api/functions/create-webgl-geometry)
validates and copies it.

## CRCWebGLPerspectiveCamera

`CRCWebGLPerspectiveCamera` is the only initial camera descriptor. It has
`type: "perspective"`, `position`, `lookAt`, `up`, `fieldOfViewDegrees`,
`near`, and `far`. See [`WebGLLayer`](#/api/components/webgl-layer) for defaults
and validation.

## CRCWebGLTransformStyle

`CRCWebGLTransformStyle` supplies optional `translateX/Y/Z`,
`rotationXDegrees/YDegrees/ZDegrees`, and `scaleX/Y/Z`. It deliberately declares
Canvas `filter` as unavailable for inner WebGL objects.

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
