# WebGL lighting, materials, and background design

> **Historical status: APPROVED DESIGN RECORD.** This document records the
> approved design; current shipped behavior remains governed by `docs/design/`
> until implementation lands.

Status: design and written specification approved on 2026-09-14.

Date: 2026-09-14

## Summary

CRC will add first-class analytic lighting to the settled `@crc/webgl` scene.
`AmbientLight`, `HemisphereLight`, `DirectionalLight`, `PointLight`, and
`SpotLight` are ordinary `WebGLLayer` children. They compose CPU-only scene
declarations during the existing single child traversal; only after the entire
scene succeeds does CRC settle mesh and light records, plan the frame, issue
WebGL commands, and transactionally commit the resulting bitmap, pick ledger,
and focus metadata.

`Mesh`, `Cube`, and `Sphere` are lit by default with a Lambert material.
`style.lit = false` opts one mesh out of every scene light. Specialized surface
settings live in the local closed `style.material` descriptor, while the
existing `style.color` and `style.opacity` remain the common base-color tint and
alpha controls. A lit surface in a scene with no lights renders black except
for its emissive contribution. The breaking default is intentional for this
local, unpublished package.

The same delivery adds immutable vertex normals, emissive Lambert materials,
and one optional solid-color `WebGLBackground`. It deliberately stops before
textures, image-based environment lighting, metallic-roughness/PBR materials,
HDR, bloom, shadows, rectangular area lights, and many-light rendering. Those
features remain separate because they add asset lifecycles, shader inputs,
render targets, or additional scene passes rather than being prerequisites for
ordinary analytic lighting.

All public lighting demonstrations use the same small base scene, camera,
object geometry, ordinary material colors, and framing. Each example applies
exactly one concept-specific delta: normally a light or background declaration,
or the one mesh-style field required by a material-focused example. This keeps
the effect legible and makes the relevant values directly editable in code.

## Context and dependency on settled scenes

The implemented settled-scene renderer already establishes the required
lifecycle:

```text
beginFrame
  -> execute the WebGLLayer child tree once
  -> compose CPU declarations without WebGL work
  -> close and settle the complete scene
  -> render planned queues
  -> transfer one candidate bitmap
  -> Canvas composite
  -> commit bitmap, pick, and focus generations together
```

Lighting extends that lifecycle rather than creating another authoring or
render path. A light after a mesh in JSX still illuminates that mesh in the
same frame. A light inside `Group3D` snapshots the composed group transform in
the same manner as geometry. Source position establishes component identity
and deterministic diagnostic order, not a scope of illumination or an
immediate GPU command position.

The current geometry contract contains positions and optional indices only.
The current built-in shader consumes one position attribute and a solid color.
Correct directional, point, spot, and hemisphere response therefore requires a
normal-aware geometry contract, an explicit material seam, transformed normal
matrices, a scene-wide light plan, and a closed renderer program family. Light
components by themselves would not be a complete or honest feature.

## Research conclusions

The portable real-time analytic-light baseline is directional, point, and spot
lighting. The glTF 2.0
[`KHR_lights_punctual`](https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Khronos/KHR_lights_punctual/README.md)
extension standardizes exactly those three families, transformed local `-Z`
for directional and spot orientation, inverse-square local-light attenuation,
optional range, and inner/outer spot half-angles. Ambient and hemisphere lights
are widely used artist-friendly fill lights, including separate
[`AmbientLight`](https://threejs.org/docs/pages/AmbientLight.html) and
[`HemisphereLight`](https://threejs.org/docs/pages/HemisphereLight.html) values
in Three.js. CRC exposes both because their authoring intent is meaningfully
different even though equal hemisphere colors can reproduce flat ambient fill.

Physically named candela and lux values require a world-scale contract plus
exposure and tone mapping. CRC currently promises neither, so this release
defines `intensity` as a nonnegative dimensionless linear multiplier. It adopts
the stable shape of inverse-square falloff and smooth range cutoff without
claiming photometric units.

Visible background and image-based environment lighting are independent scene
inputs. Three.js exposes them separately as `Scene.background` and
`Scene.environment`; neither is required for ordinary analytic lights.
[`Scene`](https://threejs.org/docs/pages/Scene.html) documents that separation.
CRC follows it: a color background may be visible without illuminating
geometry, and a future environment light may illuminate geometry without being
visible.

Emission and bloom are also distinct. A material's emissive term is independent
of analytic lights and does not automatically illuminate other geometry.
[`KHR_materials_emissive_strength`](https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Khronos/KHR_materials_emissive_strength/README.md)
describes open-ended emissive strength and its potential relationship to later
tone mapping and bloom. Bloom itself requires scene render targets, bright
extraction, blur, and composition passes; this delivery includes emission but
not the halo effect.

Rectangular area lighting is deferred. Production implementations commonly
couple it to PBR and an LTC or other approximation, and real-time shadow support
is inconsistent. Three.js's
[`RectAreaLight`](https://threejs.org/docs/pages/RectAreaLight.html), for
example, is restricted to physical materials, requires LTC initialization, and
does not support shadows.

## Goals

- Make ambient, hemisphere, directional, point, and spot lights ordinary
  composable `WebGLLayer` children.
- Let a complete settled scene determine lighting independently of JSX order.
- Make every mesh Lambert-lit by default and provide the explicit local
  `style.lit = false` escape hatch.
- Put specialized surface behavior under `style.material` while preserving
  top-level `style.color` and `style.opacity`.
- Add immutable, validated geometry normals and correct transformed normal
  matrices, including nonuniform and negative scale.
- Give built-in Cube and Sphere geometry correct normals.
- Add self-lit emissive color and intensity without promising light bounce or
  bloom.
- Add an optional solid-color `WebGLBackground` while preserving transparent
  islands by default.
- Use deterministic inverse-square local-light falloff, smooth finite range,
  and explicit spot cone half-angles in degrees.
- Apply containing `Group3D` transforms to light pose without scaling optical
  intensity, range, or cone angles.
- Enforce one deterministic eight-light limit per `WebGLLayer` and reject
  overflow rather than silently truncating by device capability.
- Preserve opaque/transparent queue semantics, interaction geometry, focus,
  scheduling, caching, bitmap transactions, context restoration, and exact GPU
  ownership.
- Supply public-API, structural, semantic, visual, failure, ownership, package,
  and documentation evidence.
- Teach every light against one identical, directly editable demonstration
  scene.

## Non-goals

- Textures, UV coordinates, tangents, normal maps, image loading, samplers, or
  CORS policy.
- Metallic-roughness, Blinn-Phong, specular, clear-coat, transmission, or any
  other material family beyond Lambert.
- A one-unit-equals-one-meter world scale, candela, lux, lumens, exposure,
  radiometric accuracy, HDR render targets, or tone mapping.
- Image, cubemap, or equirectangular backgrounds.
- Image-based environment lighting, irradiance maps, spherical harmonics,
  reflection probes, or BRDF lookup tables.
- Bloom, selective glow, general post-processing, or an effect graph.
- Shadows, shadow cameras, maps, bias, filtering, cascades, or point-light cube
  maps.
- Rectangle, disk, line, tube, cookie, IES, or finite-source area lights.
- Light masks, layers, per-light mesh inclusion/exclusion, or a public light-ref
  identity. `style.lit` is deliberately a boolean in this release, while its
  location leaves room for a later separately approved selection design.
- Configurable decay exponents, linear falloff, hard cutoff, or custom light
  equations.
- More than eight analytic light declarations or clustered/tiled/forward-plus
  rendering.
- Multiple backgrounds, cameras, or viewports in one `WebGLLayer`.
- Application shaders, raw WebGL access, render-pass plugins, or a retained
  cross-frame scene graph.
- Making lights, backgrounds, materials, or visual shading participate in hit
  testing or focus geometry.
- Replacing object-level transparent sorting or promising physically linear
  transparent blending in the default Canvas bitmap path.

## Alternatives considered

### Selected: scene-child light declarations

Lights are leaf components under `WebGLLayer`. This preserves one authoring
model, ordinary component composition, signal-driven style values, and
`Group3D` pose composition. It also ensures the existing compose → settle →
render boundary sees every mesh and light before drawing.

### Rejected: a `lights` property on `WebGLLayer`

A layer-owned list would create a second authoring channel, prevent natural
component and group composition, and revive the pre-settlement idea that lights
must be processed separately from the scene. It would not generalize to later
backgrounds, environments, shadow passes, or post effects.

### Rejected: scoped `<Lighting>` wrappers

Tree-scoped illumination would make wrapper insertion and reparenting change
visual meaning and identity. CRC styles are local and closed rather than
inherited. In this release every settled light affects every settled mesh whose
local `style.lit` is true.

### Selected: default-lit meshes with an explicit opt-out

Authors commonly expect geometry in a lit 3D scene to respond to all lights.
`style.lit = true` is therefore the default. This intentionally changes the
old unlit default: without a light, a non-emissive mesh is black. Existing
scenes explicitly choose `lit: false` to preserve their prior output or add
lights to adopt the new model.

### Rejected: preserve unlit by default

Opt-in lit materials would preserve pixels but make the ordinary scene model
surprising and require repeated material declarations. The package is local
and unpublished, so the compatibility advantage does not outweigh the clearer
default.

### Selected: common fields flat, specialized material nested

`style.color`, `style.opacity`, and `style.lit` remain common mesh fields.
Shader-model-specific fields live under `style.material`. Flattening emission,
future texture slots, roughness, metallic response, and every later material
field into `MeshStyle` would grow one ambiguous namespace and permit many
meaningless combinations.

### Rejected: material outside `style`

Materials determine appearance and rendering behavior. A separate component
prop would conflict with CRC's existing rule that geometry, paint, transform,
cursor, and local render behavior belong to the closed `style` vocabulary.

### Selected: transform-driven light pose

Point and spot positions come from their transformed local origin. Directional
and spot emission direction comes from transformed local `-Z`. Hemisphere sky
orientation comes from transformed local `+Y`. This composes with existing
degree rotations and `Group3D` without target objects or a second direction
system.

### Rejected: target objects or competing direction vectors

Retained target objects conflict with CRC's component and frame-local scene
model. Supporting both transform orientation and an explicit `direction`
vector would require precedence and composition rules without adding a
necessary capability.

### Selected: fixed eight-light forward loop

One closed fixed-capacity shader loop and an active count give deterministic
portable behavior and avoid compiling a new shader for each current light
count. Overflow is a visible scene error. Device-dependent silent truncation or
an unbounded per-fragment loop would make behavior and performance unstable.

## Public authoring model

One representative scene is:

```tsx
<WebGLLayer camera={camera}>
  <WebGLBackground style={{ color: "#08111f" }} />

  <AmbientLight style={{ color: "#ffffff", intensity: 0.1 }} />
  <HemisphereLight
    style={{
      skyColor: "#b9dcff",
      groundColor: "#302418",
      intensity: 0.3,
    }}
  />
  <DirectionalLight
    style={{
      color: "#ffffff",
      intensity: 1.2,
      rotationXDegrees: -35,
      rotationYDegrees: 45,
    }}
  />
  <PointLight
    style={{
      color: "#ff8a4c",
      intensity: 4,
      range: 12,
      translateX: 3,
      translateY: 4,
      translateZ: 2,
    }}
  />
  <SpotLight
    style={{
      color: "#80c8ff",
      intensity: 5,
      range: 20,
      innerConeAngleDegrees: 15,
      outerConeAngleDegrees: 28,
      translateX: -3,
      translateY: 5,
      translateZ: 4,
      rotationXDegrees: -40,
    }}
  />

  <Sphere
    style={{
      color: "#d7dde8",
      material: {
        type: "lambert",
        emissiveColor: "#102040",
        emissiveIntensity: 0.4,
      },
    }}
  />
  <Cube
    style={{
      color: "#ff4d6d",
      lit: false,
      translateX: 2,
    }}
  />
</WebGLLayer>
```

Lights are declarations, not drawable geometry. They accept no event, focus,
cursor, `pointerEvents`, or children props. They do not add pick-ledger entries
or projected bounds. A light component may appear before or after any mesh.
All eight-or-fewer settled light declarations contribute additively to all lit
meshes in the same layer.

## Public surface

`@crc/webgl` adds these public runtime values:

- `AmbientLight`;
- `HemisphereLight`;
- `DirectionalLight`;
- `PointLight`;
- `SpotLight`; and
- `WebGLBackground`.

It adds the matching component prop/style types plus:

```ts
export interface CRCWebGLLambertMaterial {
  readonly type: "lambert";
  readonly emissiveColor?: string;
  readonly emissiveIntensity?: number;
}

export type CRCWebGLMaterial = CRCWebGLLambertMaterial;
```

`MeshStyle` adds:

```ts
readonly lit?: boolean;
readonly material?: CRCWebGLMaterial;
```

`CubeStyle` and `SphereStyle` inherit those fields. `style.lit` defaults to
`true`. Omitted `style.material` is equivalent to `{ type: "lambert" }`.
`style.color` remains the base color and defaults to white. `style.opacity`
remains the final mesh alpha multiplier. There is no public `UnlitMaterial` or
`material.type = "unlit"`; `style.lit` is the single light-participation switch.

This delivery exports no generic `Material`, `Background`, or `Environment`
name. The explicit `WebGLBackground` name avoids collisions in the Studio's
combined `@crc/core`/`@crc/webgl` module and leaves room for independently named
future environment lighting.

## Closed light styles and defaults

All colors must be concrete Canvas colors under the existing WebGL color
validation. Parsed alpha on a light, sky, ground, or emissive color multiplies
that color's RGB contribution; it never changes mesh output alpha. Background
and base mesh colors retain their separately documented alpha semantics.
Intensity is a dimensionless linear multiplier. It must be finite and
nonnegative. Zero is allowed and still counts toward the eight-declaration
limit so a later signal update cannot unexpectedly cross the capacity boundary.

The exact component styles are:

| Component          | Style fields                                                                                         | Defaults and semantics                                                                            |
| ------------------ | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `AmbientLight`     | `color`, `intensity`                                                                                 | White and `1`; uniform fill; transforms are not accepted                                          |
| `HemisphereLight`  | shared 3D transform, `skyColor`, `groundColor`, `intensity`                                          | Both colors white and intensity `1`; transformed local `+Y` is the sky axis                       |
| `DirectionalLight` | shared 3D transform, `color`, `intensity`                                                            | White and `1`; transformed local `-Z` is the emitted-ray direction; translation does not alter it |
| `PointLight`       | shared 3D transform, `color`, `intensity`, `range`                                                   | White and `1`; transformed local origin is its position; omitted range is unbounded               |
| `SpotLight`        | shared 3D transform, `color`, `intensity`, `range`, `innerConeAngleDegrees`, `outerConeAngleDegrees` | White, `1`, unbounded, `0°`, and `45°`; transformed origin and local `-Z` supply pose             |
| `WebGLBackground`  | `color`                                                                                              | Required concrete color; transforms are not accepted                                              |

Point rotation and scale have no direct optical effect, although a containing
group transform can reposition a translated point-light origin. Directional
translation and every light's scale have no effect on intensity, range, or cone
angles. These no-op transform cases are explicitly documented rather than
silently reinterpreted as optical values.

Containing group transforms always compose light pose. In particular:

```tsx
<Group3D style={{ scaleX: 2, scaleY: 2, scaleZ: 2 }}>
  <PointLight
    style={{
      translateX: 3,
      range: 10,
      intensity: 2,
    }}
  />
</Group3D>
```

The point settles six world units from the group origin. Its range remains ten
and its intensity remains two. A direction or hemisphere axis is transformed
through the composed linear matrix and normalized. If that produces a zero or
non-finite vector, settlement rejects the scene. Settled point/spot positions
and every component of every derived direction, axis, and normal matrix must be
finite before renderer submission. Float32 composition or inversion overflow
therefore rejects even when every author input was finite.

## Geometry normals

`CRCWebGLGeometryInput` adds one optional array:

```ts
export interface CRCWebGLGeometryInput {
  readonly positions: ArrayLike<number>;
  readonly normals?: ArrayLike<number>;
  readonly indices?: ArrayLike<number>;
}
```

`createWebGLGeometry` validates and copies normals into the same immutable,
opaque descriptor as positions and indices. When supplied:

- length must exactly match `positions.length`;
- every source component must be finite;
- every component must remain finite after conversion into the stored
  `Float32Array`; and
- every XYZ normal vector must remain nonzero with finite length after that
  conversion.

Input normals need not already be unit length. Settlement first scales the
complete inverse-transpose normal matrix by its largest absolute component.
Multiplying a normal matrix by one positive scalar does not change any resulting
normal direction, while this removes uniform object-scale magnitude from the
shader inputs. The largest component must be finite and strictly positive, and
every scaled Float32 matrix component must remain finite.

Before matrix multiplication, the vertex shader safely normalizes the
object-space normal by first dividing it by its largest absolute component. It
then multiplies by the already scale-normalized normal matrix and applies the
same max-component safe normalization to the result. This bounds the operands
before multiplication rather than attempting to repair overflow afterward.

Settlement validates every distinct lit geometry/normal-matrix pairing with
the same ordered Float32 operations used by the shader. Every vertex normal
must produce a finite, nonzero transformed vector; an extreme nonuniform
transform whose representable scaled matrix loses the required direction
therefore rejects before WebGL work. Ordinary uniform scale cannot trigger that
failure because the common matrix magnitude has already been removed.

The fragment shader applies max-component safe normalization again after
interpolation because valid normalized vertex normals can still cancel to exact
zero. An exact zero interpolated vector remains zero: directional, point, and
spot diffuse terms are then zero, hemisphere receives its defined midpoint,
and ambient/emissive terms remain defined. A lit mesh whose geometry lacks
normals rejects during settlement with its component name and JSX source when
available. The same geometry remains valid for `style.lit = false`.

Cube changes internally from eight shared corner vertices to duplicated
per-face vertices so every face has one exact flat normal. Sphere normals are
the normalized canonical vertex positions. These are internal geometry changes;
the public size, radius, bounds, triangle count, picking shape, and focus bounds
remain unchanged.

Settlement derives an inverse-transpose normal matrix from each lit mesh's
fully composed model matrix, scale-normalizes it as defined above, and validates
it against that mesh's geometry normals. This preserves correct normal
orientation under representable nonuniform and negative scale. A singular
matrix on an unlit mesh retains the existing render/pick behavior; a singular
matrix on a lit mesh rejects because it cannot define a normal transform.

UV coordinates and tangents are not added speculatively. Future texture support
extends the geometry descriptor through a separately validated immutable
contract.

## Material and color semantics

The initial Lambert descriptor is closed. Unknown `type` values or fields
reject through TypeScript statically and receive clear runtime diagnostics for
untyped callers. `style.lit` accepts booleans only. `emissiveColor` defaults to
black and `emissiveIntensity` defaults to one. Emissive intensity must be
finite and nonnegative. Supplying intensity without a color is allowed and has
no visible effect, which supports ordinary signal-driven property changes
without changing descriptor shape.

`style.material` is an immutable-by-contract nested style value. CRC snapshots
and validates its scalar fields whenever the mesh component executes. Retained
Layer/WebGLLayer equality continues to compare that top-level nested value by
identity: replacing a descriptor is the supported way to change it, and a
fresh but equivalent object may conservatively invalidate the layer. Mutating
a previously supplied descriptor in place is unsupported and need not
invalidate a cached layer. This preserves the existing backend-neutral retained
tree comparison instead of adding material-specific knowledge to core.

For a lit mesh, the conceptual RGB calculation is:

```text
linearSurface =
  linearBaseColor * (
    ambientContribution
    + hemisphereContribution
    + sum(directionalContribution)
    + sum(pointContribution)
    + sum(spotContribution)
  )
  + linearEmissiveColor * emissiveIntensity
```

For `style.lit = false` with nonblack emission:

```text
linearSurface = linearBaseColor + linearEmissiveColor * emissiveIntensity
```

The unlit path preserves the current concrete CSS color output and alpha
behavior. When emission is omitted, black, or has zero effective intensity, the
unlit program passes the parsed sRGB base color through exactly as the existing
shader does. When unlit emission contributes, CRC decodes both base and
emissive RGB with the standard sRGB transfer function, adds them in linear
space, clamps to `[0, 1]`, and re-encodes with the inverse standard sRGB
transfer. The lit path likewise decodes base, light, sky, ground, and emissive
RGB before arithmetic, clamps the final LDR RGB to `[0, 1]`, and encodes it for
display. Parsed light/emissive color alpha multiplies its decoded RGB before
the contribution. Values above one may visibly saturate, but no HDR, exposure,
tone mapping, or bloom is implied.

`style.color` alpha multiplied by `style.opacity` remains the final raster
alpha. Lighting and emission change RGB only. Queue classification therefore
continues to use that final alpha exactly as the settled-scene contract
specifies. Alpha zero retains pick and focus participation while omitting raster
work.

V1 retains the default framebuffer and existing source-alpha transparency
path. Lighting math is linear, but CRC does not promise physically linear
multi-object transparent blending until a later explicit offscreen output
pipeline exists.

## Exact light equations

All contribution vectors use settled world-space values and per-fragment world
position and normal. Colors are linear RGB and intensities are nonnegative
dimensionless scalars.

Ambient contribution is:

```text
ambient = lightColor * intensity
```

Hemisphere contribution is:

```text
t = clamp(dot(worldNormal, skyAxis) * 0.5 + 0.5, 0, 1)
hemisphere = mix(groundColor, skyColor, t) * intensity
```

Directional `direction` is the direction in which rays travel. Its Lambert
contribution is:

```text
toLight = -direction
diffuse = max(dot(worldNormal, toLight), 0)
directional = lightColor * intensity * diffuse
```

Point and spot lights use:

```text
toLightVector = lightPosition - worldPosition
distanceSquared = dot(toLightVector, toLightVector)
safeDistanceSquared = max(distanceSquared, 0.0001)
toLight = normalize(toLightVector) // stable fallback at exact origin
diffuse = max(dot(worldNormal, toLight), 0)
distanceAttenuation = 1 / safeDistanceSquared
```

The `0.0001` squared-distance floor corresponds to a minimum effective distance
of `0.01` world units and avoids an infinite value at the light origin.

When range is present, CRC multiplies by the glTF-style smooth cutoff:

```text
ratio = distance / range
rangeAttenuation = clamp(1 - ratio^4, 0, 1)^2
```

When range is omitted, `rangeAttenuation` is one. A finite range must be finite
and strictly positive.

Point contribution is:

```text
point = lightColor * intensity * diffuse
      * distanceAttenuation * rangeAttenuation
```

For a spot light, `direction` is its emitted-ray direction and:

```text
lightToSurface = normalize(worldPosition - lightPosition)
cosTheta = dot(lightToSurface, direction)
cone = smoothstep(cos(outerHalfAngle), cos(innerHalfAngle), cosTheta)
spot = point * cone
```

Both cone values are half-angles expressed by author-facing degree fields.
They must be finite and satisfy
`0 <= innerConeAngleDegrees <= outerConeAngleDegrees <= 90`. When inner is
strictly less than outer, the outer boundary is zero contribution, the inner
boundary and interior are full contribution, and the interval between them
falls smoothly. When inner equals outer, CRC does not call GLSL `smoothstep`
with equal edges; it evaluates an explicit hard cone whose boundary and
interior are full contribution and whose exterior is zero.

At the exact point/spot origin, CRC uses a stable zero diffuse contribution
rather than allowing a NaN direction to enter the shader.

## Background semantics

`WebGLBackground` is a scene declaration, not a mesh or Canvas child. Omission
clears the island to transparent black exactly as today. One declaration changes
the color clear value for the scene's single default-framebuffer clear; it does
not require a draw, texture, event target, or additional pass.

The background color may include alpha. It remains behind all opaque and
transparent meshes and participates in the final Canvas bitmap alpha. It never
blocks pointer targeting: pixels not covered by participating geometry remain a
WebGL nested-resolver miss even when the background is visually opaque.

Its JSX position is irrelevant. More than one `WebGLBackground` in a scene
rejects during settlement before WebGL mutation. A background under `Group3D`
is structurally allowed as an ordinary descendant declaration but ignores the
composed transform; public guidance places it directly under `WebGLLayer`.

Image backgrounds are deferred. Their later `source` will be an immutable
CRC-owned descriptor rather than a raw `WebGLTexture` or mutable unowned
`TexImageSource`.

## Scene composition and settlement

The private frame draft expands from a mesh-only list into distinct ordered
mesh, light, and background declarations. It retains a mesh-only source counter
for raster and interaction tie-breaking so inserting or removing a light cannot
renumber otherwise unchanged meshes.

Each light submission snapshots:

- its discriminant and component diagnostic/source information;
- concrete parsed color values, including contribution alpha, and normalized
  intensity;
- an owned copy of the fully composed model matrix where applicable;
- optional range; and
- spot cone values where applicable.

Submission performs only CPU validation, transform composition, target-free
declaration capture, and immutable copies. It cannot query WebGL capabilities,
compile programs, create buffers, clear, upload, draw, or transfer a bitmap.

Settlement closes the complete draft and derives:

- copied immutable mesh records;
- material family, base/emissive colors, and final alpha;
- scale-normalized inverse-transpose normal matrices for lit meshes, validated
  against every referenced vertex normal;
- transformed, normalized world light positions, directions, and axes;
- one ordered fixed-capacity light array;
- zero or one background clear record;
- existing opaque and transparent raster queues; and
- existing geometry-derived pick and focus records.

All light declarations are global to that settled scene. Their source order is
retained only for deterministic validation, uniform packing, diagnostics, and
floating-point addition order. It never scopes which mesh receives a light.

The limit is eight declared lights total across ambient, hemisphere,
directional, point, and spot. Zero-intensity declarations count. The ninth
declaration rejects during settlement with its component/source context and the
documented limit. CRC does not inspect device-specific larger capacity and
silently vary public behavior.

Background uniqueness, light count, transformed directions, lit normal
availability, normal-matrix invertibility, material fields, ranges, cone
relationships, intensities, and colors all settle successfully before the
renderer begins a candidate resource transaction or issues a framebuffer
mutation.

## Render planning and shader programs

The renderer expands its one built-in-program slot into a closed
`ProgramKey -> Program` map. Initial material program keys are `unlit` and
`lambert`; keys encode material/pass family rather than component name or the
current light count. One fixed-capacity light layout plus an active count avoids
shader recompilation when a scene changes among zero through eight lights.

Opaque meshes retain ascending mesh source order. Transparent meshes retain the
implemented bounds-center back-to-front order with ascending mesh source index
as the exact equal-depth tie-breaker. CRC does not batch or reorder either queue
by program or material. The renderer switches programs inside those queues when
needed.

The exact initial render plan remains one default-framebuffer pass:

1. install the complete framework WebGL baseline;
2. bind the default framebuffer and clear once using the settled background or
   transparent black, plus depth;
3. open one renderer-resource candidate transaction;
4. acquire the required unlit/Lambert programs and referenced geometry;
5. bind camera and fixed light data;
6. draw opaque meshes with depth test/writes and blending disabled;
7. draw transparent meshes back-to-front with depth test, no depth writes, and
   existing source-alpha blending;
8. restore the baseline; and
9. commit or roll back the resource transaction.

There is no shadow prepass, environment preprocessing, HDR scene target, bright
extraction, blur, output/tone-map pass, pixel readback, or second component
traversal.

The Lambert vertex path consumes position and normal attributes and outputs
world position plus a normal transformed by the settled normal matrix. The
fragment path normalizes that interpolated normal, loops over the fixed light
array up to the active count, evaluates the equations above, adds emission,
clamps, encodes, and preserves settled alpha. The unlit path remains available
for `style.lit = false` and does not require a normal attribute.

## GPU-resource ownership

One `WebGLLayer` renderer and context generation continue to own every GPU
resource. The transactional resident cache now covers:

- the unlit program;
- the Lambert program;
- position/index geometry resources; and
- optional normal buffers and their vertex-array bindings.

At most one GPU handle exists for one program key or immutable geometry
descriptor in a context generation. Geometry without normals may be uploaded
for unlit use. Geometry with normals owns its normal buffer as part of the same
transactional geometry resource; sharing the descriptor across meshes shares
the complete resource.

Candidate creation, commit, rollback, resident sweep, render failure, disposal,
context loss, and restoration retain the implemented ownership rules. Partial
normal-buffer or Lambert-program construction cleans up every successfully
created candidate handle when the context remains valid. Lost-generation
handles are abandoned without deletion. No light or material component owns a
GPU handle, and no application value exposes one.

Adding or changing a light invalidates the containing layer through normal
retained-child comparison and scheduled rendering. It does not invalidate or
recreate geometry buffers. Clean layers continue to reuse the previously
committed bitmap without component evaluation, settlement, light upload, draw,
or transfer.

## Picking, events, and focus

Lighting changes pixels only. Mesh picking and projected focus bounds continue
to derive from committed geometry, model matrix, camera, mesh source index, and
participation data. Normals, material, lights, background, and emission do not
alter ray intersection or logical bounds.

Lights and background declarations expose no logical target. An opaque
background is still click-through within the WebGL nested resolver. Existing
mesh `pointerEvents`, keyboard focus, cursor, propagation ancestry, pointer
capture, nearest-depth selection, equal-depth tie behavior, and zero-alpha
interaction remain unchanged.

Raster light order, shader switching, and future pass planning cannot reorder
component identity, event ancestry, Tab order, pick source indices, or focus
metadata.

## Failure, caching, and context restoration

A component-composition or settlement failure performs no WebGL mutation and
publishes no completed scene. A render failure rolls back candidate-only
resources and cannot publish a mismatched bitmap/pick/focus generation. The
broader root fail-closed contract and teardown behavior remain authoritative.

Diagnostics identify the component and field and include JSX source when
available. Required cases include:

- non-finite or negative intensity;
- non-finite or nonpositive supplied range;
- invalid cone values or ordering;
- invalid or unknown material descriptor;
- non-finite, Float32-overflowed, length-mismatched, or zero normals;
- a lit mesh with no normals;
- a singular or non-finite lit normal matrix;
- a collapsed/non-finite transformed light direction or axis;
- a non-finite transformed point/spot position;
- a ninth light; and
- a second background.

The previous committed bitmap/pick/focus pair is not overwritten by a partial
candidate. If the error propagates through the root, normal root failure cleanup
may release that prior committed generation, as existing contracts specify.

Context loss invalidates all program and geometry handles, including normal
buffers, without deleting lost handles. Restoration rebuilds a new generation
from immutable geometry and ordinary component/style inputs. A restored lit
scene becomes visible and interactive only after one complete compose, settle,
render, transfer, Canvas composite, and transaction commit.

## Future texture, environment, and glow seam

The nested material descriptor intentionally reserves a clean future shape:

```tsx
<Cube
  style={{
    color: "#ffffff",
    material: {
      type: "lambert",
      baseColorTexture: brickColor,
      normalTexture: brickNormal,
      emissiveTexture: brickEmission,
      emissiveColor: "#ffb347",
      emissiveIntensity: 2,
    },
  }}
/>
```

Texture values will be immutable CPU-side CRC descriptors, not raw context
handles. A separate texture design must define URL/source input, decoding,
CORS, cancellation, color-space roles, UVs/tangents, sampler state, per-context
uploads, sharing, stale completion, disposal, and restoration.

Visible image backgrounds and image-based environment illumination remain
separate declarations even when they share one asset:

```tsx
<WebGLBackground source={nightSky} />
<EnvironmentLight
  source={nightSky}
  style={{ intensity: 0.8, rotationYDegrees: 30 }}
/>
```

`EnvironmentLight` is only a reserved explanatory name in this design, not a
public export in this delivery. PBR environment response will require
prefiltered specular radiance, diffuse irradiance, view/normal data, roughness,
metallic response, and an output contract.

True glow remains a scene-level effect rather than a material synonym:

```tsx
<BloomEffect style={{ threshold: 1, intensity: 0.8, radius: 0.6 }} />
```

`BloomEffect` is likewise illustrative and not exported here. A later bloom
design must define an HDR scene target, transparent-island alpha behavior,
bright or emissive selection, downsample/blur targets, additive composition,
tone mapping, display encoding, resource pooling, capability checks, failure,
and transactional publication.

The renderer keeps material-family program keys and a pass-planning seam so
those later designs can add resources and passes without weakening compose →
settle → render → commit. It does not add unused texture/framebuffer code or a
premature public abstraction now.

## Demonstration design

Every public lighting demonstration uses the same directly editable base scene.
It contains:

- one perspective camera and fixed framing;
- one Cube with flat faces;
- one Sphere with curved normals;
- one small custom ground-plane Mesh with explicit upward normals;
- fixed transforms, base colors, opacity, and ordinary Lambert material
  declarations; and
- a dark solid `WebGLBackground`, except where the background itself is the
  feature under study.

The learning-example source remains self-contained so a user can edit both the
light declaration and object values in the Studio. Shared constants or a
catalog verifier may prevent accidental drift, but the visible example must not
hide the scene behind an inaccessible fixture. The camera, geometry—including
the ground plane's explicit normals—transforms, framing, and unaffected styles
are identical across examples. Each example has exactly one named concept
delta: normally a light/background declaration, or the one mesh-style change
necessary to demonstrate `lit` or emission. The custom-normal example changes
no geometry; it calls attention to and lets the user edit the same ground-plane
normal array already present in every example.

Focused examples are:

1. lit versus `lit: false`, including the no-light black result;
2. ambient light;
3. hemisphere light;
4. directional light;
5. point light, inverse-square response, and range;
6. spot light, transform-driven direction, and cone angles;
7. emissive material behavior without halo or light bounce;
8. solid `WebGLBackground` versus the transparent default;
9. custom geometry normals using the unchanged shared ground plane; and
10. a composed multi-light scene proving that late siblings illuminate earlier
    meshes and all light families add globally.

An animated example uses the same objects and camera. Signals and the existing
animation scheduler change a containing `Group3D` transform so a nested point
or spot light moves/orients with the group. It explicitly demonstrates that
group scale can reposition a nested translated origin but does not scale range,
intensity, or cone values.

Learning examples remain separate from one dense deterministic lighting test
laboratory. The laboratory may share internal fixtures and test-only controls;
those are not indexed or documented as public examples.

## Evidence and verification

### Public contract and component evidence

Focused tests must prove:

- runtime and declaration exports for every new component and named type;
- automatic JSX and equivalent `createElement` construction;
- styles remain closed, local, non-inherited, and filter-free inside WebGL;
- default-lit, explicit-unlit, material defaulting, and emissive normalization;
- every light's defaults and validation;
- transform-driven point/spot position, directional/spot local `-Z`, and
  hemisphere local `+Y`;
- containing-group transform composition and documented scale semantics;
- light order independence and a later sibling affecting an earlier mesh;
- exactly eight declarations accepted and the ninth rejected; and
- zero-intensity lights still count.

### Geometry and lighting semantics

Tests must prove:

- normal arrays are copied, immutable by ownership, length matched, finite, and
  nonzero;
- Cube face duplication produces exact flat normals without changing bounds or
  triangles;
- Sphere normals match normalized canonical positions;
- unlit geometry may omit normals while lit geometry cannot;
- inverse-transpose normals under uniform, nonuniform, and negative scale,
  including scale-independent safe normalization and rejected unrepresentable
  pairings;
- singular lit transform rejection;
- exact ambient, hemisphere, directional, point, range, spot-cone, and
  emissive equations at representative semantic points;
- no-light lit black and unlit old-color behavior;
- linear-light arithmetic and display encoding;
- alpha queue classification remains independent from lighting; and
- solid/alpha/transparent background behavior.

Semantic state, submitted records, settled vectors/matrices, uniform values,
and representative pixels precede visual screenshot evidence.

### Structural renderer evidence

Structural tests must prove:

- all components finish before the first clear, program/buffer construction,
  upload, uniform binding, or draw;
- every component executes once per required frame;
- one fixed light program handles zero through eight declarations without
  recompilation by light count;
- unlit and Lambert programs switch without reordering opaque or transparent
  queues;
- geometry buffers persist when only lighting changes;
- no background draw or extra framebuffer pass is introduced for a solid
  background;
- one dirty scene clears once and transfers at most one bitmap;
- a clean scene performs no traversal, settlement, light upload, render, or
  transfer; and
- no WebGL framebuffer/pixel readback, shadow, hidden ID, HDR, bloom, or texture
  path runs. The existing Canvas 2D color parser may continue using its current
  browser-authoritative color-resolution readback.

### Interaction, ownership, and failure evidence

Tests and browser scenarios must prove:

- lighting, normals, emission, shader selection, and background do not change
  picking/focus geometry or ordering;
- an opaque background remains a nested-resolver miss;
- existing pointer, cursor, capture, focus, keyboard, and listener ancestry;
- partial Lambert shader/program and normal-buffer creation cleanup;
- resource transaction commit, rollback, and resident sweep;
- geometry sharing across lit and unlit submissions;
- settlement failure before WebGL mutation;
- render failure without candidate publication;
- context loss during candidate construction/render and new-generation rebuild;
- removal, root failure, and disposal release all live owned handles exactly
  once; and
- no light/background component acquires an event target or GPU owner.

### Public examples and package evidence

The implementation updates and verifies:

- `@crc/webgl` runtime exports and declarations;
- Bundler, NodeNext, and packed-tarball consumers;
- the Studio editor declaration snapshot and runtime inventory;
- source and built Studio modes;
- one self-contained same-scene example per concept;
- deterministic example/catalog metadata and public search indexing;
- the separate lighting laboratory;
- Chromium semantic and visual scenarios;
- lifecycle cleanup and structural performance evidence;
- documentation links and export inventories; and
- the aggregate repository trust gate under the documented toolchain.

Visual baselines are inspected, never rewritten merely to pass. If lighting
intentionally changes a baseline, expected, actual, and diff output are reviewed
and the reason is recorded.

Per the approved delivery policy, intermediate tasks run only the narrow checks
needed for their own change. The complete aggregate gate runs once at the final
verification step after all implementation and branch-wide review fixes are
present.

## Required documentation and contract updates

Implementation updates at least:

- `docs/design/drawing-components-contract.md`;
- `docs/design/style-system-contract.md`;
- `docs/design/canvas-surface-contract.md` where background alpha/composite is
  described;
- `docs/design/user-events-contract.md` and
  `docs/design/focus-and-keyboard-navigation-contract.md` for explicit
  light/background nonparticipation;
- `docs/design/event-resource-ownership.md`;
- `docs/design/runtime-resource-ownership.md`;
- the public WebGL API pages and learning guides under `docs/site/`;
- `packages/webgl/README.md`;
- Studio declarations and export inventories;
- scenario catalogs and presentation metadata;
- package-consumer examples and verifiers; and
- the repository `AGENTS.md` public-surface and deliberate-boundary summary
  after implementation is shipped.

The implemented 2026-09-13 settled-scene design remains authoritative for the
composition lifecycle, queue ordering, picking/focus derivation, bitmap
transactions, context generations, and renderer ownership that this design
preserves. This document supersedes only its future-lighting project sketch and
the current shipped boundary that lighting, normals, emission, materials, and
backgrounds are absent.

## Implementation boundary and sequence

The implementation plan will preserve this dependency order:

1. Add failing public/type/geometry tests for normals, material styles, and the
   new component surface.
2. Implement immutable geometry normals and correct built-in normals.
3. Extend the CPU composer with material, light, and background declarations.
4. Extend settlement with normal matrices, transformed light data, complete
   validation, light capacity, and background uniqueness.
5. Generalize transactional renderer resources for unlit/Lambert programs and
   optional normal buffers.
6. Implement the exact light equations and solid-background clear behavior
   without changing existing queue or interaction ordering.
7. Add browser semantic evidence, context-loss/ownership evidence, and the
   deterministic lighting laboratory.
8. Add the same-scene learning examples, public API documentation, package
   consumers, Studio declarations, catalogs, and visual evidence.
9. Perform branch-wide review, address findings, and run the one final aggregate
   trust gate.

Every production behavior change receives failing observable evidence before
implementation. Execution uses an isolated `codex/` worktree and focused
implementer/reviewer subagents. Intermediate work avoids aggregate verification;
the full repository gate is reserved for the final step.
