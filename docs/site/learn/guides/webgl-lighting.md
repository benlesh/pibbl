---
id: guide-webgl-lighting
title: Light WebGL scenes
summary: Add Lambert materials, transformed lights, orbit controls, solid backgrounds, and genuine shadows to WebGL islands.
kind: guide
slug: webgl-lighting
order: 66
keywords: [webgl, lighting, materials, orbit camera, shadows, background]
exampleSlug: multiple-lights
---

# Light WebGL scenes

`@crc/webgl` supplies a closed, deterministic lighting system for each
[`WebGLLayer`](#/api/components/webgl-layer). Meshes are Lambert-lit by default;
ambient, hemisphere, directional, point, and spot declarations contribute to
the whole settled scene; a solid background controls the island clear; and
direct lights can cast genuine depth-map shadows. The optional
[`crcOrbitCamera`](#/api/hooks/crc-orbit-camera) hook turns ordinary CRC pointer
and wheel events into a perspective-camera pose.

## Build an orbitable lit scene

```tsx
import { Group, Rectangle, crc } from "@crc/core";
import {
  AmbientLight,
  Cube,
  DirectionalLight,
  Group3D,
  Mesh,
  PointLight,
  Sphere,
  WebGLBackground,
  WebGLLayer,
  crcOrbitCamera,
  createWebGLGeometry,
} from "@crc/webgl";

const floor = createWebGLGeometry({
  positions: [-4, 0, -4, 4, 0, -4, 4, 0, 4, -4, 0, 4],
  normals: [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],
  indices: [0, 2, 1, 0, 3, 2],
});

function Scene() {
  const orbit = crcOrbitCamera({
    orbitPoint: [0, 0.5, 0],
    initialPosition: [4.5, 3.2, 6.5],
    minDistance: 3,
    maxDistance: 14,
  });

  return (
    <Group {...orbit.handlers}>
      {/* The backing target paints first, underneath the WebGL island. */}
      <Rectangle
        style={{ width: 720, height: 420, fill: "rgba(0, 0, 0, 0)" }}
      />
      <WebGLLayer
        camera={{
          type: "perspective",
          position: orbit.position,
          lookAt: orbit.lookAt,
          up: [0, 1, 0],
          fieldOfViewDegrees: 45,
          near: 0.1,
          far: 100,
        }}
        style={{ width: 720, height: 420, shadows: "medium" }}
      >
        <WebGLBackground style={{ color: "#07111f" }} />
        <AmbientLight style={{ color: "#9fb8ff", intensity: 0.18 }} />
        <DirectionalLight
          style={{
            rotationXDegrees: -50,
            rotationYDegrees: -25,
            color: "#fff4dc",
            intensity: 1.4,
          }}
        />
        <PointLight
          style={{
            translateX: -2,
            translateY: 2.8,
            translateZ: 1.5,
            color: "#60a5fa",
            intensity: 10,
            range: 9,
          }}
        />
        <Group3D style={{ rotationYDegrees: 18 }}>
          <Cube
            style={{
              size: 1.5,
              translateX: -1,
              translateY: 0.75,
              color: "#f97316",
              material: {
                type: "lambert",
                emissiveColor: "#7c2d12",
                emissiveIntensity: 0.08,
              },
            }}
          />
          <Sphere
            style={{
              radius: 0.8,
              translateX: 1,
              translateY: 0.8,
              color: "#22c55e",
            }}
          />
        </Group3D>
        <Mesh
          geometry={floor}
          style={{ color: "#334155", receiveShadow: true }}
        />
      </WebGLLayer>
    </Group>
  );
}

crc(document.querySelector("canvas")!, <Scene />);
```

The transparent `Rectangle` paints first and supplies full-viewport hit
geometry; the `WebGLLayer` paints second. CRC targets in reverse paint order, so
a WebGL mesh remains the topmost target and keeps its own picking, focus,
cursor, and handlers before the event bubbles through the shared `Group` to the
orbit handlers. When the island picker misses empty space, targeting falls
through to the backing rectangle and then bubbles through the same group. The
structural `Group` provides common propagation ancestry, not rectangular hit
geometry of its own.

## Understand the orbit contract

`crcOrbitCamera` stores one spherical pose around `orbitPoint`.
`initialPosition` is mount-only; `orbitPoint`, distance bounds, and speed
options are live and are adopted only after a successful render. Its returned
handler bundle is stable, and unchanged `position`, `lookAt`, and result objects
retain identity.

Primary-pointer drag captures that pointer and rotates by
`0.01 * rotateSpeed` radians per root-logical pixel. Polar motion clamps just
short of either pole. Wheel zoom is exponential, normalizing line deltas as 16
pixels and page deltas as the logical viewport height. It calls
`preventDefault()` only when the bounded distance actually changes. Interaction
requests ordinary CRC renders; an idle camera owns no animation loop.
The handler bundle itself creates no target or focus candidate and does not
replace mesh target identity or ownership. A changed camera pose does change
ray-pick geometry and projected focus bounds when the next scene commits.

## Choose lights and materials

All light colors are concrete Canvas colors. Their alpha scales RGB
contribution; it does not make mesh pixels transparent. Intensity is finite,
nonnegative, dimensionless, and linear.

| Declaration        | Contribution and transform behavior                                                           | Shadows                                |
| ------------------ | --------------------------------------------------------------------------------------------- | -------------------------------------- |
| `AmbientLight`     | Uniform whole-scene contribution; ignores `Group3D` transforms                                | Never casts                            |
| `HemisphereLight`  | Blends ground to sky across the transformed local `+Y` direction                              | Never casts                            |
| `DirectionalLight` | Parallel rays along transformed local `-Z`; translation is irrelevant                         | Casts by default; one 2D depth view    |
| `PointLight`       | Transformed origin, inverse-square attenuation, optional positive `range`                     | Casts by default; six cube depth views |
| `SpotLight`        | Point attenuation inside transformed local `-Z` cone; half-angles default to `0`/`45` degrees | Casts by default; one 2D depth view    |

Containing `Group3D` transforms affect a light's pose. Group scale can move a
translated local origin through the group transform, but never changes
intensity, range, cone angles, shadow quality, or shadow-map resolution.
One layer accepts at most eight light declarations. A ninth light rejects during
settlement instead of being silently truncated; light JSX order does not limit
which earlier or later meshes it illuminates.

Every mesh uses the default `{ type: "lambert" }` material and `lit: true`.
With no lights, a normally lit surface is black except for emission. Set
`lit: false` when a mesh should use its color directly and ignore lighting.
`emissiveColor` defaults to black, and `emissiveIntensity` defaults to `1`; an
emissive surface is still Lambert-lit unless `lit` is false. Custom lit geometry
must supply one finite, nonzero normal per vertex. Built-in cubes and spheres
already include normals.

## Control alpha and shadows

`style.color` alpha multiplied by `style.opacity` remains the final raster
alpha. Lighting, emission, and shadows change RGB only. Shadow participation is
resolved independently:

- zero-alpha geometry never casts, even with `castShadow: true`, but remains
  pick/focus eligible unless pointer participation is disabled;
- fully opaque geometry casts by default, including unlit or emissive meshes;
- partially transparent geometry does not cast by default, but can opt in;
- every nonzero-alpha lit mesh receives by default; unlit meshes never receive,
  even with `receiveShadow: true`.

Each shadow affects only the matching direct light's diffuse contribution.
Ambient, hemisphere, emissive, and other-light contributions remain intact.

`WebGLLayer style.shadows` is `false | "low" | "medium" | "high"` and defaults
to `"medium"`:

| Quality    | Requested map size | Comparisons per sample |
| ---------- | -----------------: | ---------------------: |
| `"low"`    |                512 |                      1 |
| `"medium"` |               1024 |                      4 |
| `"high"`   |               2048 |                      9 |

The actual map size clamps to the device limit. Shadow depth is reused when the
light, casters, quality, context generation, and relevant projection inputs are
unchanged, so an orbit-only camera update can rerender color without redrawing
unchanged shadow maps.

## Set the island background

Omitting `WebGLBackground` preserves the transparent-island default. One
background changes the existing clear color and alpha without adding a draw
call, participating in lighting, or creating hit geometry. Even an opaque
background remains an interaction miss. A layer accepts at most one background.

## Follow the settled render lifecycle

A dirty island evaluates children once into a CPU-only draft, settles immutable
mesh/light/background plus pick/focus/shadow records, executes required shadow
depth passes, renders the opaque and transparent color queues, transfers one
bitmap, then composites and commits bitmap/pick/focus state together. Validation
or render failure publishes no partial Canvas-visible generation. Context loss
abandons the lost generation, removes stale paint and targeting, then rebuilds
the complete pipeline from component declarations after restoration. Removal
and disposal release bitmaps, listeners, programs, geometry buffers, and shadow
resources exactly once while their context is valid.

Invalid colors, non-finite transforms/intensities, invalid ranges or cone
angles, missing normals on lit custom geometry, duplicate backgrounds, excess
lights, and unsupported shadow-quality values fail before partial publication.

This package deliberately has no texture/image material, environment map or
IBL, PBR workflow, area light, transparent/colored/contact shadow, cascaded
shadow, public bias/map/camera control, glow/bloom, post-processing API, public
shader callback, or raw WebGL context. Explore the
[multiple-lights example](#/examples/webgl/multiple-lights), the
[WebGL islands guide](#/learn/guides/webgl-islands), and the
[`@crc/webgl` API types](#/api/types/webgl).
