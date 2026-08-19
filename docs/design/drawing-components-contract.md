# CRC drawing-component contract

Status: implemented through the Canvas surface contract on 2026-08-19.

This document defines CRC's drawing and composition exports. Rendered values
use the required local language in the [style-system
contract](./style-system-contract.md); layout participation follows the
[layout-system contract](./layout-system-contract.md). Events remain program
props. Geometry, paint, cursor, clipping, transform, text, and image source are
style. Runtime legacy aliases and top-level visual props are unsupported.

## Shared paint and interaction rules

- Drawing follows Canvas 2D geometry, paint order, transforms, clipping, text measurement, image decoding, and `Path2D` parsing.
- `opacity` multiplies the current Canvas global alpha when supplied. Zero
  opacity paints nothing but does not remove an otherwise interactive geometry
  region.
- Transparent or absent visible paint does not itself remove interaction geometry. Target selection follows the region rules in the mouse contract.
- Property changes replace the prior frame's pixels and interaction geometry after the scheduled CRC render settles.
- Empty paths and zero-length lines are safe no-ops. Signed primitive rectangle
  and image dimensions follow Canvas geometry; layout allocation remains
  nonnegative.
- Pixel-grid alignment is optional. `none` preserves the exact input. `round`, `ceil`, and `floor` snap opposite rectangle edges or the line coordinate using the effective stroke offset, preserving the signed span instead of adding one pixel.
- Browser-defined values remain browser-defined: malformed SVG path data is delegated to `Path2D`; decoded image edge antialiasing and system-font glyph rasterization can vary by platform.

## Component matrix

| Public export    | Supported contract                                                                                                                                                                                                 | Primary evidence                                                      |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| `rect`           | Required local `width` and `height`; optional `x` and `y` default zero; fill, stroke, opacity, signed geometry, pixel-grid modes, cursor, and mouse regions.                                                       | Direct component suite, shapes lesson, geometry matrix                |
| `path`           | Required `Path2D` `d`; fill, stroke, opacity, path replacement, expanded stroke interaction width, and empty paths.                                                                                                | Direct component and interaction suites, shapes lesson                |
| `line`           | Ordered polyline coordinates, style/update behavior, empty and one-point no-op geometry, transforms/clips, and expanded hit width.                                                                                 | Direct line suite, lines lesson, geometry matrix                      |
| `horizontalLine` | Required local `y`; optional `x1` default zero and `x2` default allocation width; pixel-grid modes and shared line paint/interaction.                                                                              | Direct helper matrix and lines lesson                                 |
| `verticalLine`   | Required local `x`; optional `y1` default zero and `y2` default allocation height; pixel-grid modes and parity with `horizontalLine`.                                                                              | Direct helper matrix and lines lesson                                 |
| `svgPath`        | Required string `d`; browser `Path2D` parsing, fill/stroke/opacity, data updates, interactions, empty/malformed delegation, and transforms.                                                                        | Direct SVG suite, shapes lesson, runtime recovery suite               |
| `text`           | Required text; local position, font, alignment and baseline; `visible`, `ellipsis`, `squish`, and `clip` fit modes; wrapping box; paint/opacity/cursor; measured per-line interaction bounds and pure measurement. | Direct call/interaction suite and text lesson                         |
| `img`            | Required `src`; detachable source generations; success/error/race/removal; natural or explicit dimensions; border stroke, opacity, pixel-grid modes, and stable explicit geometry before/after load.               | Direct async/component suites, image lesson, cleanup laboratory       |
| `g`              | Nested scale, rotation/origin, translation, skew, zero/negative scale, updates, and sibling transform isolation.                                                                                                   | Direct group suite, composition lesson, geometry matrix               |
| `clip`           | `nonzero` and `evenodd` fill rules, cumulative intersections, transforms, updates, empty clips, and identical render/hit clipping.                                                                                 | Direct clip suite, composition lesson, geometry matrix                |
| `layer`          | Same-mount root/prop/dimension updates, root-density backing stores, nested and transformed offscreen composition, global paint order, interaction bounds, and cascading cleanup.                                  | Direct layer suite, composition lesson, geometry and cleanup matrices |

Root and layer paint use logical units defined by the
[Canvas surface contract](./canvas-surface-contract.md). Pixel-grid alignment
therefore operates in logical geometry before the root or inherited layer
density transform rasterizes it. Managed layers inherit both root backing
densities and composite their complete physical source into the declared
logical destination.

## Text layout details

`text` lays out one line unless `wrap` is true. Wrapped lines accumulate without
losing the final fitting line. `lineHeight` advances each line. A finite style
height limits complete lines; ellipsis applies to the final visible line when
requested. An ellipsis narrower than three dots resolves to an empty string.

`fit: "squish"` passes the supplied width to Canvas text paint. `fit: "clip"`
creates a finite alignment- and baseline-aware clip rectangle when width is
supplied; omitted height uses the Canvas allocation. Interaction paths union
actual metrics for every rendered line. Paint and pure measurement share this
resolver, so measured wrapping and eventual rendering agree.

Exact Canvas calls are tested with controlled text metrics. Gallery image comparison masks only glyph rasterization, while surrounding cards, clipping, layout, state, and interaction bounds remain exact.

## Image lifetime and geometry

Each `style.src` owns one `Image` generation. Load and error handlers detach on
settlement, source replacement, component removal, or instance disposal. Saved
late callbacks and superseded loads cannot change current state. Successful
natural sizing uses `naturalWidth`/`naturalHeight` independently for omitted
dimensions. Explicit dimensions establish geometry before load and after
failure; this matches CRC's geometry-first transparent-region rule. Natural
image size is unavailable to pure layout measurement because it would acquire
an asynchronous resource.

Pixel alignment produces one adjusted rectangle used by `drawImage`, the optional border, and the interaction path. It does not stretch the image by an extra pixel.

## Visual evidence and limitations

The studio exposes focused learner pages and retains the five stable integration fixtures at:

- `#/examples/drawing/rectangle` through `#/examples/drawing/image`
- `#/examples/composition/group` through `#/examples/composition/layer`
- `#/testing/drawing-shapes`
- `#/testing/drawing-lines`
- `#/testing/drawing-text`
- `#/testing/drawing-images`
- `#/testing/drawing-composition`

Each learner source and test fixture is loaded from its validated catalog path,
and browser checks import the same modules shown by the Studio. Five native
480×240 fixture baselines retain exact geometry outside tight font and
decoded-SVG edge masks. CRC adds its documented layout contexts, but not rich
text, DOM accessibility, image CORS policy, SVG validation, or a complete CSS
formatting engine.
