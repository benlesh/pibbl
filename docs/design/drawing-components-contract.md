# CRC drawing-component contract

Status: current implemented contract, updated for JSX-era authoring on
2026-09-03.

CRC exports descriptive component values. Authors construct them with JSX or
`createElement`; none is a callable factory. Geometry, paint, cursor, transform,
clip, image source, and layout participation use explicit local `style`.
Events remain props. Drawing leaves reject children, `Text` accepts textual
children, and composition values accept recursive `CRCNode` children.

## Shared paint and interaction rules

- Drawing follows Canvas 2D geometry, source paint order, transforms, clips,
  text measurement, image decoding, and `Path2D` parsing.
- `opacity` multiplies current global alpha. Zero paints nothing but does not
  remove otherwise registered interaction geometry.
- Absent visible paint does not by itself remove geometry. Target selection is
  governed by the [user-event contract](./user-events-contract.md).
- Property changes replace the prior frame's pixels and interaction geometry
  after the scheduled CRC render settles.
- Empty paths and zero-length lines are safe. Signed primitive rectangle/image
  geometry follows Canvas; layout allocation remains nonnegative.
- Pixel-grid alignment is optional. `none` preserves the exact input. `round`,
  `ceil`, and `floor` snap opposite rectangle edges or the line coordinate
  using the effective stroke offset, preserving the signed span instead of
  adding one pixel.
- Platform-defined parsing, glyph rasterization, image decoding, CORS/taint,
  and antialiasing remain platform-defined.

## Component matrix

| Export           | Style/content contract                                                                                                                                                                                           | Evidence                                                            |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `Rectangle`      | Required local `width` and `height`; optional `x` and `y` default zero; fill, stroke, opacity, signed geometry, pixel-grid modes, cursor, event/focus regions, and exact update/replacement behavior.            | Direct component suite, rectangle lesson, geometry matrix           |
| `Path`           | Required `Path2D` `d`; fill, stroke, opacity, path replacement, expanded stroke interaction width, and empty paths.                                                                                              | Direct component and interaction suites, path lesson                |
| `Line`           | Ordered polyline coordinates; style/update behavior; empty and one-point no-op geometry; transforms/clips; and expanded hit width.                                                                               | Direct line suite, line lesson, geometry matrix                     |
| `HorizontalLine` | Required local `y`; optional `x1` defaults zero and `x2` defaults allocation width; pixel-grid modes and shared line paint/interaction.                                                                          | Direct helper matrix and horizontal-line lesson                     |
| `VerticalLine`   | Required local `x`; optional `y1` defaults zero and `y2` defaults allocation height; pixel-grid modes and parity with `HorizontalLine`.                                                                          | Direct helper matrix and vertical-line lesson                       |
| `SvgPath`        | Required string `d`; browser `Path2D` parsing, fill/stroke/opacity, data updates, interactions, empty/malformed delegation, and transforms.                                                                      | Direct SVG suite, SVG-path lesson, runtime recovery suite           |
| `Text`           | Recursive textual children; local position, font, alignment and baseline; `visible`, `ellipsis`, `squish`, and `clip` fit; wrapping box; paint/opacity/cursor; per-line interaction bounds and pure measurement. | Direct call/interaction suite, text lesson, text measurement suites |
| `Image`          | Required `src`; detachable source generations; success/error/race/removal; natural or explicit dimensions; border, opacity, pixel-grid modes, and stable explicit geometry before/after load.                    | Direct async/component suites, image lesson, cleanup laboratory     |

Every drawing value accepts the supported DOM-aligned event/focus props through
its props type. It creates a logical target only when interactive metadata
requires one. Purely painted content does not occlude a registered target.

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
`#/examples/drawing/rectangle` through `#/examples/drawing/image` and
`#/examples/composition/group` through `#/examples/composition/layer`. It also
retains the five stable `#/testing/drawing-*` integration fixtures. Their
`.example.tsx` modules are loaded by both Studio and browser tests. The stable
480×240 baselines retain semantic, Canvas-call, geometry, interaction, and
inspected-pixel evidence. Image comparison masks only glyph rasterization and
decoded-SVG edges where documented; surrounding cards, clipping, layout,
state, and interaction bounds remain exact.

CRC adds no rich text, semantic DOM, accessibility tree, image CORS policy, SVG
validator, retained scene graph, or complete CSS formatting engine. See the
[style](./style-system-contract.md), [layout](./layout-system-contract.md), and
[runtime](./runtime-hooks-contract.md) contracts.
