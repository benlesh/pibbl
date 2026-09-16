---
id: api-types-webgl
title: WebGL types
summary: Camera, orbit, geometry, material, light, shadow, and component contracts for @crc/webgl.
kind: api
slug: webgl
apiCategory: types
typeDomain: webgl
symbols:
  [
    AmbientLightProps,
    AmbientLightStyle,
    CRCWebGLGeometry,
    CRCWebGLGeometryInput,
    CRCWebGLLambertMaterial,
    CRCWebGLMaterial,
    CRCWebGLPerspectiveCamera,
    CRCWebGLShadowQuality,
    CRCWebGLTransformStyle,
    CRCWebGLVector3,
    CubeProps,
    CubeStyle,
    DirectionalLightProps,
    DirectionalLightStyle,
    Group3DProps,
    Group3DStyle,
    HemisphereLightProps,
    HemisphereLightStyle,
    MeshProps,
    MeshStyle,
    PointLightProps,
    PointLightStyle,
    SphereProps,
    SphereStyle,
    SpotLightProps,
    SpotLightStyle,
    WebGLBackgroundProps,
    WebGLBackgroundStyle,
    WebGLLayerProps,
    WebGLLayerStyle,
  ]
keywords: [webgl, camera, geometry, mesh, scene]
---

# WebGL types

Import these public contracts with `type` from `@crc/webgl`. CRC element,
event, node, style-base, and JSX types continue to come from `@crc/core`.
Orbit-camera options, handlers, and results are documented with
[`crcOrbitCamera`](#/api/hooks/crc-orbit-camera).

## AmbientLightProps

`AmbientLightProps` has no component-specific fields.

## AmbientLightStyle

`AmbientLightStyle` provides optional `color` and `intensity`.

## CRCWebGLGeometry

`CRCWebGLGeometry` is an opaque branded immutable descriptor with readonly
`vertexCount` and `triangleCount`. Only descriptors created by the current
`@crc/webgl` package are accepted.

## CRCWebGLGeometryInput

`CRCWebGLGeometryInput` contains `positions`, optional triangle `indices`, and
optional per-vertex `normals`. [`createWebGLGeometry`](#/api/functions/create-webgl-geometry)
validates and copies every supplied array.

## CRCWebGLLambertMaterial

`CRCWebGLLambertMaterial` is the closed material descriptor for mesh lighting.
It requires `type: "lambert"` and may set concrete `emissiveColor` and a finite,
nonnegative `emissiveIntensity`. Emissive color defaults to black and intensity
defaults to `1`; both affect RGB, never raster alpha.

## CRCWebGLMaterial

`CRCWebGLMaterial` is currently the Lambert material union. Omit
`MeshStyle.material` for the default Lambert surface.

## CRCWebGLPerspectiveCamera

`CRCWebGLPerspectiveCamera` is the only initial camera descriptor. It has
`type: "perspective"`, `position`, `lookAt`, `up`, `fieldOfViewDegrees`,
`near`, and `far`. See [`WebGLLayer`](#/api/components/webgl-layer) for defaults
and validation.

## CRCWebGLShadowQuality

`CRCWebGLShadowQuality` is `false | "low" | "medium" | "high"`. It controls
the layer-wide shadow-map resolution and filtering cost; omission selects
`"medium"` and `false` disables shadow generation.

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

## DirectionalLightProps

`DirectionalLightProps` has no component-specific fields.

## DirectionalLightStyle

`DirectionalLightStyle` combines transform fields with optional `color`,
`intensity`, and `castShadow`. Color and intensity default to white and `1`;
direct-light shadow casting defaults to `true`.

## Group3DProps

`Group3DProps` requires recursive `children` and accepts propagation handlers.

## Group3DStyle

`Group3DStyle` is the shared WebGL transform style.

## HemisphereLightProps

`HemisphereLightProps` has no component-specific fields.

## HemisphereLightStyle

`HemisphereLightStyle` combines transform fields with optional `skyColor`,
`groundColor`, and `intensity`.

## MeshProps

`MeshProps` requires `geometry` and accepts event/focus participation.

## MeshStyle

`MeshStyle` adds optional concrete `color`, `opacity`, `lit`, `material`,
`castShadow`, `receiveShadow`, and `cursor` to the shared transform fields.
Meshes are lit by default; set `lit: false` for the unlit path. Color/opacity
default to white/`1`. Fully opaque meshes cast by default, partially transparent
meshes do not, and zero-alpha meshes never cast. Nonzero-alpha lit meshes
receive by default; unlit meshes never receive.

## PointLightProps

`PointLightProps` has no component-specific fields.

## PointLightStyle

`PointLightStyle` combines transform fields with optional `color`, `intensity`,
positive `range`, and `castShadow`, which defaults to `true`.

## SphereProps

`SphereProps` accepts event/focus participation.

## SphereStyle

`SphereStyle` extends mesh style with optional positive `radius`, default
`0.5`.

## SpotLightProps

`SpotLightProps` has no component-specific fields.

## SpotLightStyle

`SpotLightStyle` extends point-light style with optional inner and outer cone
half-angles in degrees, defaulting to `0` and `45`; inner cannot exceed outer.

## WebGLBackgroundProps

`WebGLBackgroundProps` has no component-specific fields.

## WebGLBackgroundStyle

`WebGLBackgroundStyle` requires one concrete `color`.

## WebGLLayerProps

`WebGLLayerProps` requires `children`, accepts one optional perspective
`camera`, propagation handlers, and `pointerEvents`.

## WebGLLayerStyle

`WebGLLayerStyle` combines core box and layout-item style; width/height may be
omitted, `shadows` selects layer-wide shadow quality, and core filters apply to
the completed island.
