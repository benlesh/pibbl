# CRC drawing-component contract

Status: current implemented contract, updated for WebGL lighting, orbit-camera,
and genuine-shadow behavior on 2026-09-15.

CRC exports descriptive component values. Authors construct them with JSX or
`createElement`; none is a callable factory. Geometry, paint, cursor, transform,
clip, image source, and layout participation use explicit local `style`. Events
remain props. Drawing leaves reject children, `Text` accepts textual children,
and composition values accept recursive `CRCNode` children.

First-class filters are also explicit local style and use the composition
boundary defined below.

## Shared paint and interaction rules

- Canvas drawing follows Canvas 2D geometry, source paint order, transforms,
  clips, text measurement, image decoding, and `Path2D` parsing. WebGL child
  source order establishes scene identity and exact ties; raster order follows
  the settled opaque and transparent queues below.
- `opacity` multiplies current global alpha. Zero paints nothing but does not
  remove otherwise registered interaction geometry.
- Canvas and WebGL drawing leaves contribute their supported geometry to hit
  resolution by default, even without handlers, cursor, or focus metadata.
  `pointerEvents="none"` removes that leaf from targeting without changing
  paint. Absent visible paint does not by itself remove declared geometry.
- Property changes replace the prior frame's pixels and interaction geometry
  after the scheduled CRC render settles.
- Empty paths, zero-length lines, zero radii, zero ellipse axes, and zero-angle
  sweeps are safe. Signed primitive rectangle/image geometry follows Canvas;
  shape radii and layout allocation remain nonnegative.
- Pixel-grid alignment is optional. `none` preserves the exact input. `round`,
  `ceil`, and `floor` snap opposite rectangle edges or the line coordinate
  using the effective stroke offset, preserving the signed span instead of
  adding one pixel.
- Platform-defined parsing, glyph rasterization, image decoding, CORS/taint,
  and antialiasing remain platform-defined.
- Filters affect pixels only. They do not change measurement, layout boxes,
  hit paths, focus or keyboard-navigation bounds, pointer coordinates, cursor
  regions, or source paint order; visual overflow outside those logical shapes
  is not independently interactive.

## Component matrix

| Export           | Style/content contract                                                                                                                                                                                           | Evidence                                                            |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `Rectangle`      | Required local `width` and `height`; optional `x` and `y` default zero; fill, stroke, opacity, signed geometry, pixel-grid modes, cursor, event/focus regions, and exact update/replacement behavior.            | Direct component suite, rectangle lesson, geometry matrix           |
| `Circle`         | Required nonnegative `radius`; optional `cx`/`cy` default zero; fill, stroke, opacity, cursor, path interaction, and circle keyboard bounds.                                                                     | Direct circle suite, circle lesson, `drawing-shapes` lab            |
| `Ellipse`        | Required nonnegative `radiusX`/`radiusY`; optional `cx`/`cy` and radian `rotation`; fill/stroke interaction and rotation-aware keyboard bounds.                                                                  | Direct ellipse suite, ellipse lesson, `drawing-shapes` lab          |
| `Arc`            | Required nonnegative `radius` and finite radian angles; optional direction; open, stroke-only Canvas arc with sweep-aware keyboard bounds.                                                                       | Direct arc/geometry suites, arc lesson, `drawing-shapes` lab        |
| `Wedge`          | Arc geometry closed to its center for fill/radial strokes; a full turn omits radial edges so its stroke has no seam.                                                                                             | Direct wedge/geometry suites, wedge lesson, `drawing-shapes` lab    |
| `Polygon`        | Required finite ordered numeric coordinate tuples; closes three or more points for fill/stroke and uses point extrema for keyboard bounds.                                                                       | Direct polygon suite, polygon lesson, `drawing-shapes` lab          |
| `Path`           | Required `Path2D` `d`; fill, stroke, opacity, path replacement, expanded stroke interaction width, and empty paths.                                                                                              | Direct component and interaction suites, path lesson                |
| `Line`           | Ordered polyline coordinates; style/update behavior; empty and one-point no-op geometry; transforms/clips; and expanded hit width.                                                                               | Direct line suite, line lesson, geometry matrix                     |
| `HorizontalLine` | Required local `y`; optional `x1` defaults zero and `x2` defaults allocation width; pixel-grid modes and shared line paint/interaction.                                                                          | Direct helper matrix and horizontal-line lesson                     |
| `VerticalLine`   | Required local `x`; optional `y1` defaults zero and `y2` defaults allocation height; pixel-grid modes and parity with `HorizontalLine`.                                                                          | Direct helper matrix and vertical-line lesson                       |
| `SvgPath`        | Required string `d`; browser `Path2D` parsing, fill/stroke/opacity, data updates, interactions, empty/malformed delegation, and transforms.                                                                      | Direct SVG suite, SVG-path lesson, runtime recovery suite           |
| `Text`           | Recursive textual children; local position, font, alignment and baseline; `visible`, `ellipsis`, `squish`, and `clip` fit; wrapping box; paint/opacity/cursor; per-line interaction bounds and pure measurement. | Direct call/interaction suite, text lesson, text measurement suites |
| `Image`          | Required `src`; detachable source generations; success/error/race/removal; natural or explicit dimensions; border, opacity, pixel-grid modes, and stable explicit geometry before/after load.                    | Direct async/component suites, image lesson, cleanup laboratory     |

Every drawing value accepts the supported DOM-aligned event/focus props through
its props type. With default `pointerEvents="auto"`, it owns a stable logical
target and may occlude a registered target painted behind it even when passive.
Empty/unsupported local geometry remains a miss. Handler props on `Group`,
`Clip`, `Layer`, and layout containers are propagation listeners only and add no
structural rectangle target.

## Standard shape geometry

`Circle`, `Ellipse`, `Arc`, `Wedge`, and `Polygon` are dedicated drawing
leaves. They use fresh immediate `Path2D` geometry on each traversal and share
the `Path` paint and event-target pipeline; they do not form a retained shape
graph or cache geometry. Every shape supports `cursor`, `opacity`, `stroke`,
`strokeWidth`, and `lineInteractionWidth`. `Circle`, `Ellipse`, `Wedge`, and
`Polygon` also support `fill`. `Arc` is deliberately stroke-only because
filling its open path would introduce implicit chord geometry.

Named position and radius lengths use the primitive's existing percentage
basis. `cx` and `radiusX` percentages resolve against its width, while `cy` and
`radiusY` percentages resolve against its height. A circular `radius`
percentage resolves against the smaller of those two dimensions. Numeric
geometry is in local logical Canvas units. Missing `cx` and `cy` default to
zero; ellipse `rotation` defaults to zero radians; and Arc/Wedge
`counterclockwise` defaults to `false`. Percentage lengths retain the standard
finite and definite-basis diagnostics, and `"auto"` is not valid shape
geometry.

Circle has required `radius`. Ellipse has required `radiusX` and `radiusY`, and
its optional finite `rotation` is in radians. Arc and Wedge have required
`radius`, `startAngle`, and `endAngle`; their angles are finite radians and
their direction and angle normalization follow `Path2D.arc`. A clockwise
difference of at least `2π`, or a counterclockwise difference of at least
`2π` in that requested direction, is a full turn. Opposite-direction
differences wrap in the requested direction as Canvas specifies.

Arc geometry stays open and exposes only its curved stroke. A partial Wedge
moves from the center to the arc start, follows the circular sweep, and closes
back to the center, so both radial edges participate in stroke targeting. A
full-turn Wedge instead creates closed circular geometry without center or
radial segments; this prevents a visible radial stroke seam. Wedge has no
`innerRadius`.

Polygon takes required `coords: [number, number][]`, connects the points in
order, and closes the path. Every coordinate must be finite; a failure is a
`LayoutDiagnostic` whose property path identifies the offending tuple member.
Polygon coordinates remain numeric because an arbitrary tuple has no
unambiguous percentage basis. Fewer than three points produce empty geometry.

All radii must resolve to finite nonnegative numbers. Negative radii and
non-finite angles or ellipse rotation fail style resolution with a contextual
`LayoutDiagnostic`, rather than exposing a native `Path2D` exception. A zero
circle radius, either zero ellipse radius, or a zero angular span produces
empty geometry and paints nothing. Empty geometry still follows normal update,
replacement, failure-cleanup, removal, and disposal semantics.

Paint and coordinate targeting use the exact same generated path. Fill targets
use filled shape geometry when fill interaction is active; stroke targets use
the existing `strokeWidth` and `lineInteractionWidth` rules. Explicit
`keyboardNavigationBounds` always wins. Otherwise Circle uses center/radius
bounds, rotated Ellipse uses its axis-aligned rotated extrema, Arc uses its
endpoints and swept cardinal extrema, Wedge additionally includes its center,
and Polygon uses point extrema. Existing Group transforms, clips, layers,
focus policies, and global paint order continue to apply.

These five leaves have no intrinsic measurement: drawing radius or coordinates
do not claim a layout size. Percentage geometry resolves against parent
allocation, and a layout path that needs measurement must receive a declared
box. Curved and arbitrary edges also do not support pixel-grid alignment.

## Text layout details

`Text` concatenates strings and numbers, including zero, from recursive arrays
or finite synchronous iterables. Booleans and nullish values add nothing. It
rejects CRC elements, Promises, async iterables, functions, symbols, foreign
elements, and unsupported objects. Text content is not a style member.

```tsx
<Text style={{ x: 40, y: 80, fill: "black" }}>
  Hello {name} — {0} unread
</Text>
```

The materialized value is reused by measurement and paint in one receiving
transaction. The default is one line. When `wrap` is true, wrapped lines
accumulate without losing the final fitting line. `lineHeight` advances each
line. A finite style height limits complete lines; ellipsis applies to the
final visible line when requested. An ellipsis box narrower than three dots
resolves to an empty string.

`fit: "squish"` passes the supplied width to Canvas text paint. `fit: "clip"`
creates a finite alignment- and baseline-aware clip rectangle when width is
supplied; omitted height uses the Canvas allocation. Interaction paths union
actual metrics for every rendered line. Paint and pure measurement share this
resolver, so measured wrapping and eventual rendering agree.

Exact Canvas calls are tested with controlled text metrics. Image comparison
masks only glyph rasterization; surrounding cards, clipping, layout, state, and
interaction bounds remain exact.

## Composition values

| Export  | Contract                                                                                                                                                                   |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Group` | Applies nested scale, rotation/origin, translation, and skew to all recursive children. Updates, zero/negative scale, and sibling isolation retain Canvas semantics.       |
| `Clip`  | Applies required `Path2D` `d` and optional `nonzero`/`evenodd` rule to all children. Nested intersections, transforms, updates, empty clips, and paint/hit geometry agree. |
| `Layer` | Renders multiple children into one persistent offscreen CRC instance, caches retained content, follows root density, and participates in global paint/target/focus order.  |

## WebGL island values

`@crc/webgl` supplies one Canvas composition boundary and these scene
declarations:

| Export             | Contract                                                                                                                                                                                                                         |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `WebGLLayer`       | Resolves a finite positive logical box; composes and settles one frame-local WebGL scene, reuses or renders its shadow-depth generations, renders its color queues, then transfers and transactionally commits one Canvas entry. |
| `Group3D`          | Scopes translation × Z/Y/X degree rotations × scale for recursive WebGL declarations and contributes listener ancestry without paint, a scene submission, or hit geometry.                                                       |
| `Mesh`             | Submits one immutable triangle geometry, composed model transform, local material/shadow settings, final color, and target participation shared by settlement, raster, ray-pick, and focus records.                              |
| `Cube`             | Uses centered per-face normal geometry; positive `size` defaults to one and drives the same submitted model scale for raster and pick.                                                                                           |
| `Sphere`           | Uses deterministic centered geometry with canonical outward normals; positive `radius` defaults to `0.5` and drives the same submitted model scale for raster and pick.                                                          |
| `AmbientLight`     | Adds uniform color × intensity to every lit mesh in the complete settled scene; it has no transform or shadow projection.                                                                                                        |
| `HemisphereLight`  | Blends ground/sky colors by each world normal and transformed local `+Y` sky axis; it has no direct-light shadow projection.                                                                                                     |
| `DirectionalLight` | Emits parallel light along transformed local `-Z`; translation is optically inert and one genuine 2D shadow view is eligible by default.                                                                                         |
| `PointLight`       | Emits from the transformed local origin with inverse-square attenuation and an optional smooth finite range; six cube shadow views are eligible by default.                                                                      |
| `SpotLight`        | Adds a transformed local `-Z` cone to point attenuation; one outer-cone 2D shadow view is eligible by default.                                                                                                                   |
| `WebGLBackground`  | Supplies one solid or alpha clear behind the scene without illuminating geometry, drawing another pass, or creating a target.                                                                                                    |

`WebGLLayer` accepts one optional perspective camera; omission uses position
`[0, 0, 5]`, look-at `[0, 0, 0]`, up `[0, 1, 0]`, field of view `50`, near
`0.1`, and far `1000`. Camera aspect follows logical layer dimensions and CRC
does not auto-fit scene bounds. `Mesh`, `Cube`, and `Sphere` accept the shared
3D transform, concrete color (default white), opacity (default one), cursor,
event, pointer-participation, and focus props. Geometry-backed focus bounds are
projected from the committed model/camera state unless a layer-local 2D override
is supplied.

`useOrbitCamera()` is a component-owned pose hook, not another camera type. It
returns current `position` and `lookAt` snapshots plus a stable bundle of
ordinary pointer/wheel handlers. The author passes those snapshots into the
plain perspective descriptor and attaches the handlers to a mesh, a structural
listener ancestor, or an explicit viewport-sized Canvas target. A structural
component alone never creates draggable hit geometry. Primary-pointer capture,
root-logical drag deltas, wheel cancellation, scheduling, and teardown use the
ordinary CRC event and hook contracts; the hook owns no animation loop or GL
resource.

`createWebGLGeometry` validates and copies a finite nonempty XYZ triangle list
plus optional per-position finite nonzero XYZ normals and optional in-range
triangle indices into an immutable branded descriptor. A lit custom mesh
requires normals; an unlit mesh and a shadow-depth caster do not.
An application-defined shape is an ordinary component that returns `Mesh` with
one of these descriptors. `@crc/webgl` exposes no application shader/draw
callback, analytic hit callback, mutable scene draft, GPU handle, or context
resource operation.

`Mesh`, `Cube`, and `Sphere` are Lambert-lit by default. Their local closed
`style.material` is omitted-Lambert or `{ type: "lambert",
emissiveColor?, emissiveIntensity? }`; it never inherits through `Group3D`.
`style.color` remains base RGB/alpha, `style.opacity` remains the final alpha
multiplier, and `style.lit = false` opts one mesh out of every scene light. A
non-emissive lit mesh with no illumination is black. Emission adds to lit or
unlit RGB but does not light neighboring geometry or imply bloom. Light and
emissive color alpha scale RGB contribution only; they do not change mesh
output alpha.

All lights contribute globally and additively to lit meshes regardless of JSX
position. The limit is eight total light declarations, including zero-intensity
ones. Ambient is uniform; hemisphere blends by normal; directional is parallel;
point and spot use independent inverse-square attenuation with a `0.01` minimum
effective distance and optional smooth range cutoff. Spot additionally applies
its inner/outer half-angle cone. Containing `Group3D` transforms light pose, but
scale never changes optical intensity, range, cone angles, or shadow quality.

For one dirty scene, core traverses the child tree exactly once to compose
mesh, light, material, and background declarations without framebuffer mutation
or GPU-resource construction. After successful composition, the backend closes
and settles the complete draft, derives raster queues, shadow participants,
plus geometry pick/focus records from the same immutable submissions, reuses or
renders the required shadow-depth generations, and then renders the main color
queues. It transfers one candidate bitmap for Canvas composite and
transactional bitmap/pick/focus commit. A failed composition is discarded
without settlement or GL work.

Omitted `WebGLLayer.style.shadows` resolves to `"medium"`; accepted values are
`false`, `"low"`, `"medium"`, and `"high"`. The enabled tiers request square
depth views of 512/1024/2048 pixels and use 1/4/9 comparisons respectively;
device limits may clamp resolution without changing comparison count. `false`
allocates no shadow targets and performs no depth pass. Directional, point, and
spot lights default `castShadow` to true. Ambient and hemisphere lights expose
no such field. Each shadow factor attenuates only its matching direct diffuse
contribution; ambient, hemisphere, other direct lights, and emission remain
independent.

Final-alpha-one meshes cast and, when lit, receive by default. Final alpha
strictly between zero and one does not cast by default but does receive when
lit. Explicit `castShadow: true` makes such a mesh write an opaque depth
silhouette. Final-alpha-zero meshes never write color or shadow depth even when
explicitly enabled. `castShadow` is independent of `lit`, so an opaque unlit or
emissive mesh still occludes direct light by default. `receiveShadow` affects
only lit direct contributions.

Final alpha is parsed color alpha multiplied by `style.opacity`. Alpha `1`
enters the opaque queue in ascending source order with depth test and writes.
Alpha strictly between `0` and `1` enters an object-level bounds-center sort
back-to-front with depth test and no writes; equal depths retain ascending
source order. Alpha `0` enters neither raster queue but retains geometry-backed
pick and focus participation. Intersecting or very large transparent objects
can expose the limits of object-level sorting. Raster queue order never changes
component identity, event ancestry, focus order, or nearest-depth picking.

Canvas primitives inside a WebGL island and WebGL primitives outside one are
backend errors. One island is flattened: its individual objects cannot
alternate around an external Canvas sibling. Authors use two `WebGLLayer`
passes for `WebGL back -> Canvas -> WebGL front`.

Shadow maps are renderer-owned and cached independently of the presentation
camera. Camera-only orbit rerenders the color queues while reusing valid depth.
Light pose/projection, caster depth inputs, relevant automatic receiver extent,
quality/resolved resolution, context, or shadow-program generation changes
invalidate the affected generation. Directional and spot lights use one 2D
view; each invalidated point light uses six 90-degree cube views.

## Filter composition

A nonempty `style.filter` turns the receiving primitive into one immediate-mode
composition boundary. CRC renders that primitive and every descendant it
returns once into one upright local source surface, then applies the complete
filter list in one native Canvas operation. Fill and stroke, multiline text,
transparent image content and borders, custom primitive paint, layout output,
and overlapping descendants therefore contribute one combined alpha
silhouette. In particular, `dropShadow` derives one shadow from that combined
silhouette rather than one shadow per draw or child.

List functions consume the preceding result in declaration order. Nested
filtered primitives are separate boundaries and resolve inside out: the inner
filtered result becomes ordinary source paint for its parent before the parent
filter runs. Component functions and primitive callbacks still execute once;
filters add bitmap composition, not a second tree traversal or retained drawing
commands.

Runtime-owned layout placement and the receiving `Group` transform are applied
after the receiving filter. The subtree is filtered upright in local
coordinates, then scaled, rotated, translated, or skewed at composite time, so
a circular local blur may become elliptical under nonuniform scale and a local
shadow offset rotates with its Group. An unfiltered descendant Group is already
transformed inside an ancestor's source; a descendant Group with its own filter
filters in its own local space before its transform reaches the ancestor source.

The receiving `Clip` also applies after its receiving filter. Descendant clips
are captured inside the source, while ancestor clips constrain the completed
filtered result. The composition order is:

```text
local subtree paint -> receiving filter -> receiving clip -> receiving transform
-> ancestor clip/alpha/compositing -> parent target
```

`Layer` remains the persistent cache boundary; filter scratch surfaces are
transient and do not create nested CRC mounts. A filter on a Layer consumes its
combined cached bitmap. Changing only an outer or Layer filter can recomposite
that bitmap without rerunning retained child components. Filters inside a Layer
belong to the child CRC instance and its scratch pool, while the existing bridge
keeps their interaction entries in global paint order.

`WebGLLayer` is another persistent cache boundary. Its settled opaque and
transparent passes produce one committed bitmap, and a receiving core filter
consumes that whole island bitmap before the outer
clip/transform/presentation. Inner WebGL object styles reject Canvas filters.
Filter pixels do not alter the island's committed pick or projected focus
geometry.

Nonempty filters require browser `OffscreenCanvas`, an Offscreen Canvas 2D
context, and its native `filter` state to accept the compiled chain. CRC has no
DOM-canvas fallback, JavaScript pixel loop, tiling, or silent resolution
reduction. An empty list stays on the direct path and has no such requirement.

`Layer` uses children, not a render element/descriptor prop. It installs a stable private keyed
fragment as the offscreen root. Direct child iterables are materialized once;
retained comparisons do not consume opaque nested iterables. Cache hits replay
focus metadata without executing child components. Removal recursively
disposes its controller, targets, frames, images, and nested layers.

On one persistent mount, a `Layer` invalidates and rerenders when its retained
child root type/key, child props (including enumerable symbol keys), specified
style, direct-child sequence, or layer dimensions change.
Same-mount root, prop, and dimension updates replace the prior offscreen content; an
unchanged retained tree reuses the cached backing store. Root density changes
independently resize and rerender that backing store.

Managed layers require `OffscreenCanvas`. Their backing stores inherit both
root densities and composite the complete physical source into the declared
logical destination. Transforms, clips, layout overflow, events, and focus use
the same geometry as paint.

## Image lifetime and geometry

Each `style.src` creates a source-tagged image generation. Load/error handlers
detach on settlement, source replacement, component removal, or disposal.
Saved late callbacks cannot publish stale state. Successful natural sizing uses
`naturalWidth` and `naturalHeight` independently for whichever dimension is
omitted. Explicit dimensions establish geometry before load and after failure;
this matches CRC's geometry-first transparent-region rule. Natural image size
is unavailable to pure measurement because it would acquire an asynchronous
resource.

Pixel alignment produces one adjusted rectangle used by `drawImage`, the
optional border, and the interaction path. It does not stretch the image by an
extra pixel.

## Visual evidence and limitations

The Studio exposes one lesson for each drawing/composition value under
`#/examples/drawing/rectangle` through `#/examples/drawing/image`, including the
five standard-shape lessons, and `#/examples/composition/group` through
`#/examples/composition/layer`. It also retains the five stable
`#/testing/drawing-*` integration fixtures. Their `.example.tsx` modules are
loaded by both Studio and browser tests. The stable 480×240 baselines retain
semantic, Canvas-call, geometry, interaction, and inspected-pixel evidence.
Image comparison masks only glyph rasterization and decoded-SVG edges where
documented; surrounding cards, clipping, layout, state, and interaction bounds
remain exact.

The Studio additionally exposes `#/examples/composition/filters` and the
deterministic `#/testing/filters` laboratory. Filter evidence covers every
function, ordered lists, inside-out nesting, combined silhouettes,
Group/Clip/Layer order, local transforms and density, custom paint, edge
expansion, unchanged interaction geometry, pool ownership/failure cleanup, and
structural cost. Its image comparison masks only browser-sensitive filter
regions where documented.

The Studio's `#/examples/composition/webgl-islands` lesson and
`#/testing/webgl-islands` laboratory cover default/explicit cameras,
Cube/Sphere/Mesh/Group3D composition, Canvas/WebGL order, transparent
pass-through and object sorting, default participation and opt-out,
propagation, depth, projected focus, animation, filters outside the island,
constant-time clean cache reuse, context restoration, and deterministic
renderer-resource/bitmap ownership. Twelve same-scene WebGL lighting lessons
and `#/testing/webgl-lighting` additionally cover all light families,
normal-aware geometry, lit/unlit/emissive surfaces, background alpha, orbit
input, default and explicit shadow participation, all four quality settings,
genuine directional/spot/point shadows, camera-only cache reuse, failure, and
teardown.

CRC adds no rich text, semantic DOM, accessibility tree, image CORS policy, SVG
validator, retained scene graph, generic `Shape` component or registry, or
complete CSS formatting engine. The standard shapes add no line smoothing,
spline selection, data-to-mark conversion, `Pie`, charts, scales, axes,
legends, annular wedges, new paint effects, or intrinsic geometry measurement.
See the
[style](./style-system-contract.md), [layout](./layout-system-contract.md), and
[runtime](./runtime-hooks-contract.md) contracts.

The filter surface does not accept raw CSS strings, `url()`/SVG graphs,
backdrop sampling, or a box-shadow model.

WebGL islands add no textures, image environments/IBL, PBR, glow/bloom, area
lights, cascaded/soft/contact/transparent shadows, public shadow cameras or
map/bias/filter controls, or post-processing API. They remain one-camera,
flattened Canvas entries rather than retained public scene graphs.

## Rounded shapes and public path creators

`Rectangle`, `Polygon`, `RegularPolygon`, and `Star` accept the shared
`cornerRadius` and `cornerRadii` vocabulary. At actual corner index `i`, CRC
uses the exact nullish fallback expression:

```ts
const specified = cornerRadii?.[i] ?? cornerRadius ?? 0;
```

Thus a literal `0` preserves a sharp corner, while a sparse array hole,
`undefined`, or `null` falls back to `cornerRadius`. Omitting both properties
keeps the existing sharp path. `cornerRadii` cannot be longer than the actual
corner count, even when the extra entries are nullish. Component percentage
radii resolve against the smaller dimension of that shape's current percentage
basis; creator radii are finite numeric logical Canvas units only.

Corner indices are directed: Rectangle uses `(x, y)`, `(x + width, y)`,
`(x + width, y + height)`, and `(x, y + height)`; Polygon uses `coords` order;
RegularPolygon uses generated vertex order; and Star uses generated traversal
order, where even indices are outer tips and odd indices are inner valleys.
`Rectangle` first applies its existing pixel-grid adjustment, then delegates
the effective signed box and expanded radii to Canvas `roundRect`. Canvas owns
signed-box physical-corner remapping and native radius scaling. Rounded closed
polygons instead apply one global scale factor to all requested nonzero radii
when adjacent tangent demands exceed an edge, preserving their proportions;
duplicate or exactly collinear vertices remain sharp. Rounding never expands a
rectangle box or coordinate/vertex extrema.

`RegularPolygon` requires an integer `sides >= 3` and exactly one size field.
For `n = sides`, CRC normalizes `circumradius`, `inradius`, or `sideLength` to
the circumradius `R` as `R = circumradius`,
`R = inradius / Math.cos(Math.PI / n)`, or
`R = sideLength / (2 * Math.sin(Math.PI / n))`. Its finite `rotation` defaults
to `-Math.PI / 2`; increasing angles generate vertices clockwise in Canvas
coordinates. `Star` requires an integer `points >= 3`, finite nonnegative
`outerRadius` and `innerRadius`, and `innerRadius <= outerRadius`. `points`
counts outer tips. With the same default rotation, Star emits clockwise,
alternating outer/even and inner/odd vertices. It is one concave silhouette:
a six-point star has twelve alternating corners, not two crossing triangles.

All components use the canonical creator-generated path for paint, stroke,
events, clipping intersections, transforms, layers, and focus. Explicit
`keyboardNavigationBounds` wins. Otherwise rounded Rectangle uses its resolved
box, rounded Polygon uses coordinate extrema, and RegularPolygon and Star use
generated vertex extrema. These drawing components do not infer intrinsic
measurement from geometric dimensions; layouts that require measurement need a
declared box.

The root exports ten standalone creators: `createRectanglePath`,
`createCirclePath`, `createEllipsePath`, `createArcPath`, `createWedgePath`,
`createLinePath`, `createPolygonPath`, `createRegularPolygonPath`,
`createStarPath`, and `createSvgPath`. Each accepts one dedicated options object
and returns a fresh `Path2D`; geometric option fields are numeric-only, while
`createSvgPath` accepts its `d` path data as a string. Creators own no runtime
resources, event registration, cache, or render state. Rectangle width and
height remain signed; shape radii and size fields are nonnegative. Creator
structural or numeric validation throws `RangeError` naming the offending option
path, while component style resolution reports the contextual `LayoutDiagnostic`
family.
`createSvgPath` intentionally delegates malformed path-data failure to the
browser `Path2D` constructor.

Zero geometry is valid: zero circle/arc/wedge radius, either zero ellipse axis,
or zero angular span; fewer than three polygon points; zero normalized regular
polygon size; and either zero Star radius produce empty paths. Zero corner
radii keep otherwise valid geometry sharp. This feature does not add rounded
Arc, Wedge, Line, HorizontalLine, or VerticalLine joins; corner behavior for
Circle/Ellipse; automatic rounded clipping for arbitrary leaves; elliptical or
CSS slash radii; smoothing/splines; compound/crossing stars; a generic shape
registry; a retained geometry graph/cache; intrinsic geometry measurement; or
per-shape memo hooks.

## First-class 3D physics components

Inside one `WebGLLayer`, `PhysicsWorld3D` establishes a 3D world and the optional physics package augments `Cube`, `Sphere`, `Mesh`, and `Group3D` with typed immutable attachments. Cube infers a box; uniform and nonuniform Sphere scale infer sphere and ellipsoid; static Mesh infers a triangle mesh; dynamic or kinematic Mesh infers a deterministic convex hull; Group3D hosts a compound body without a self collider. `PhysicsShape3D`, `Box3D`, `Ellipsoid3D`, `Capsule3D`, `Cylinder3D`, `Cone3D`, `ConvexHull3D`, and `Heightfield3D` render the remaining immutable shapes. Explicit shapes override inference, descendant `collider3D()` values form compounds, sensors are ordinary colliders, and moving triangle-mesh or heightfield use produces a runtime diagnostic.
