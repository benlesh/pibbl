# CRC drawing-component contract

Status: current implemented contract, updated for external render layers and the
official Three.js adapter on 2026-09-28.

CRC exports descriptive component values. Authors construct them with JSX or
`createElement`; none is a callable factory. Geometry, paint, cursor, transform,
clip, image source, and layout participation use explicit local `style`. Events
remain props. Drawing leaves reject children, `Text` accepts textual children,
and composition values accept recursive `CRCNode` children.

First-class filters are also explicit local style and use the composition
boundary defined below.

## Shared paint and interaction rules

- Canvas drawing follows Canvas 2D geometry, source paint order, transforms,
  clips, text measurement, image decoding, and `Path2D` parsing. External
  renderer internals remain application-owned and are flattened at the layer
  boundary.
- `opacity` multiplies current global alpha. Zero paints nothing but does not
  remove otherwise registered interaction geometry.
- Canvas leaves and committed render-layer targets contribute their supported
  geometry to hit resolution by default, even without handlers, cursor, or
  focus metadata.
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

`CRCTextInput` additionally accepts signals at positions in that declared
recursive grammar. Each directly encountered signal is read by the receiving
`Text` component and may replace one complete `CRCTextChild` structure. CRC
does not perform another signal-unwrapping pass inside the structure returned
by that signal. Structural `CRCNodeInput` follows the same rule for roots,
containers, arrays, and finite iterables.

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

## External render layers and Three.js

`defineRenderLayer()` creates one Canvas composition primitive for an
application-owned external renderer. `defineThreeLayer()` specializes that
public lifecycle for an ordinary Three.js scene and camera. The layer resolves a
finite logical box, renders one private surface, and transactionally publishes
one bitmap plus matching interaction metadata at its Canvas source position.

The layer is flattened: its internal objects cannot alternate around a Canvas
sibling. Parent `Group` transforms, `Clip` geometry, layout, opacity, and
filters apply to the completed bitmap. Three objects are ordinary Three values,
not CRC elements; CRC does not mirror their geometry, material, lighting,
camera, loader, shadow, control, particle, or post-processing APIs.

Default Three raycasting distinguishes visible blocks, registered CRC targets,
and empty-pixel misses. The complete lifecycle, event/focus arbitration, input
bridge, ownership, and deliberate boundaries are defined by the [external
render-layer and Three.js contract](./render-layer-and-three-contract.md).

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

An external render layer is another persistent cache boundary. A receiving core
filter consumes its whole committed bitmap before outer
clip/transform/presentation. Filter pixels do not alter the layer's committed
pick or focus geometry.

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

The Studio's `#/examples/three/three-layer` lesson covers blocking geometry,
registered CRC targets, empty-pixel pass-through, focus, and outer Canvas
filters. `#/examples/three/three-instancing` adapts Three's instancing/raycasting
example and additionally covers direct Three imports, controls input, scheduled
animation, camera updates, and deterministic resource ownership.

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

CRC adds no 3D scene graph, material, lighting, shadow, loader, controls,
particle, or post-processing vocabulary. An external render layer remains one
flattened Canvas entry; applications use Three objects and facilities directly
inside `defineThreeLayer()` when they need them.

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

## Renderer-independent 3D geometry

`@crc/physics/3d/geometry` provides pure immutable shapes and collision
queries. It does not add drawing components, Three bindings, a world runtime, or
a scheduler participant.

## Editable path geometry (2026-09-29 extension)

`PathGeometry` adds mutable, packed canonical geometry to the public core entry.
Path and Clip accept `PathGeometry | Path2D` in `style.d`; this extends the native
path-only inputs described above. Existing path creators and memoized hooks still
return Path2D. Native browser context methods still require native paths.

The class supports Canvas path builders, copying, affine transforms, canonical
segment editing and a read-only mutation revision. Public `toPath2D` conversion
always returns a fresh snapshot; `toSvgPathData` exports absolute SVG data.
CRC privately resolves an unchanged instance/revision to one native snapshot and
replaces that snapshot after edits. Paint and hit/clip geometry share the same
consumed snapshot. Conversion does not occur during pointer dispatch. Old root
or retained-Layer generations keep their previous native paths until updated.

Geometry edits do not schedule rendering. No content-equality/hash API or SVG
parser is implied. `flattenPath`, `simplifyPath`, and `subdividePath` return new
geometry, with explicit accuracy/output limits. Simplification accepts polylines
only and does not promise topology preservation. Singular ellipse transforms
preserve traversal through explicit lines, whose turning-point stroke joins may
differ from a browser's degenerate native conics.

Public evidence lives in `path-geometry.test.tsx`,
`path-geometry-builders.test.ts`, `path-geometry-utilities.test.ts`, and the
editable path learning example. The approved design is
[mutable path geometry](../superpowers/specs/2026-09-29-path-geometry-design.md).

## Component manipulation

`ManipulationFrame` binds one writable finite box signal to a positioned local
allocation. `DragHandle` is a structural listener: only participating descendant
hit geometry can start a move. `ResizeHandle`, `ResizeHandles`, and
`RotationHandle` retain explicit control geometry. No frame infers bounds from
content. Resize and rotation controls keep CSS-pixel visual and hit geometry
while their centers follow the frame. See the
[component-manipulation contract](./component-manipulation-contract.md).
