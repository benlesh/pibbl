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
- A scheduled render replaces prior pixels and target geometry.
- Empty paths and zero-length lines are safe. Signed primitive rectangle/image
  geometry follows Canvas; layout allocation remains nonnegative.
- Pixel-grid modes are `none`, `round`, `ceil`, and `floor`. Snapping uses the
  effective stroke offset and preserves signed spans.
- Platform-defined parsing, glyph rasterization, image decoding, CORS/taint,
  and antialiasing remain platform-defined.

## Drawing values

| Export           | Style/content contract                                                                                                | Evidence                                        |
| ---------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `Rectangle`      | Required `width`/`height`; optional local `x`/`y`; fill, stroke, opacity, pixel alignment, cursor, event/focus props  | Rectangle lesson, direct suite, geometry matrix |
| `Path`           | Required `Path2D` `d`; fill/stroke/opacity, cursor, stroke interaction width                                          | Path lesson and interaction suites              |
| `Line`           | Ordered `coords`; shared stroke/opacity/cursor behavior; empty/one-point no-pixel semantics                           | Line lesson and direct suite                    |
| `HorizontalLine` | Required `y`; `x1` defaults zero and `x2` defaults allocation width                                                   | Horizontal-line lesson and helper matrix        |
| `VerticalLine`   | Required `x`; `y1` defaults zero and `y2` defaults allocation height                                                  | Vertical-line lesson and helper matrix          |
| `SvgPath`        | Required string `d`; browser `Path2D` parsing and shared paint/interaction                                            | SVG-path lesson and recovery suite              |
| `Text`           | Recursive textual children; position/font/alignment/baseline; wrap and fit; paint/cursor; line bounds and measurement | Text lesson and text layout suites              |
| `Image`          | Required `src`; natural/explicit geometry; border, opacity, pixel alignment, async generations                        | Image lesson and async cleanup suites           |

Every drawing value accepts the supported DOM-aligned event/focus props through
its props type. It creates a logical target only when interactive metadata
requires one. Purely painted content does not occlude a registered target.

## Text children and layout

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
transaction. The default is one line. `wrap` uses the finite width;
`lineHeight` advances lines; finite height limits complete lines. `fit` accepts
`visible`, `squish`, `ellipsis`, or `clip`. Squish passes a width to Canvas;
clip uses an alignment/baseline-aware rectangle; ellipsis applies to the last
visible line. Interaction bounds union actual metrics for every painted line.

## Composition values

| Export  | Contract                                                                                                                                                                  |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Group` | Applies nested scale, rotation/origin, translation, and skew to all recursive children. Zero/negative scale and sibling isolation retain Canvas semantics.                |
| `Clip`  | Applies required `Path2D` `d` and optional `nonzero`/`evenodd` rule to all children. Nested clips intersect and paint/hit geometry agree.                                 |
| `Layer` | Renders multiple children into one persistent offscreen CRC instance, caches retained content, follows root density, and participates in global paint/target/focus order. |

`Layer` uses children, not a render callback. It installs a stable private keyed
fragment as the offscreen root. Direct child iterables are materialized once;
retained comparisons do not consume opaque nested iterables. Cache hits replay
focus metadata without executing child components. Removal recursively
disposes its controller, targets, frames, images, and nested layers.

Managed layers require `OffscreenCanvas`. Their backing stores inherit both
root densities and composite the complete physical source into the declared
logical destination. Transforms, clips, layout overflow, events, and focus use
the same geometry as paint.

## Image ownership

Each `style.src` creates a source-tagged image generation. Load/error handlers
detach on settlement, source replacement, component removal, or disposal.
Saved late callbacks cannot publish stale state. Omitted dimensions use natural
size only after successful load; explicit dimensions establish geometry before
load and after failure. Natural image size is unavailable to pure measurement
because it would acquire an asynchronous resource.

## Examples and boundaries

The Studio exposes one lesson for each drawing/composition value under
`#/examples/drawing/*` and `#/examples/composition/*`, backed by `.example.tsx`
files also mounted headlessly. Deterministic drawing fixtures retain semantic,
Canvas-call, geometry, interaction, and inspected pixel evidence.

CRC adds no rich text, semantic DOM, accessibility tree, image CORS policy, SVG
validator, retained scene graph, or complete CSS formatting engine. See the
[style](./style-system-contract.md), [layout](./layout-system-contract.md), and
[runtime](./runtime-hooks-contract.md) contracts.
