# CRC drawing-component contract

Status: implemented and verified by TFC-09 on 2026-08-11.

This document defines the supported behavior of CRC's existing drawing exports. It complements the [runtime and hook contract](./runtime-hooks-contract.md), [mouse interaction contract](./mouse-interaction-contract.md), and [runtime resource ownership contract](./runtime-resource-ownership.md). The five documentation-candidate drawing lessons are the public-API integration oracle; focused component tests own exhaustive and destructive boundary cases that would make teaching examples harder to read.

## Shared paint and interaction rules

- Drawing follows Canvas 2D geometry, paint order, transforms, clipping, text measurement, image decoding, and `Path2D` parsing.
- `alpha` multiplies the current Canvas alpha whenever it is supplied. `alpha: 0` is supported and paints nothing; it does not remove an otherwise interactive geometry region.
- Transparent or absent visible paint does not itself remove interaction geometry. Target selection follows the region rules in the mouse contract.
- Property changes replace the prior frame's pixels and interaction geometry after the scheduled CRC render settles.
- Empty paths and zero-length lines are safe no-ops. Negative rectangle/image dimensions are delegated to Canvas geometry rather than normalized into positive dimensions.
- Pixel-grid alignment is optional. `none` preserves the exact input. `round`, `ceil`, and `floor` snap opposite rectangle edges or the line coordinate using the effective stroke offset, preserving the signed span instead of adding one pixel.
- Browser-defined values remain browser-defined: malformed SVG path data is delegated to `Path2D`; decoded image edge antialiasing and system-font glyph rasterization can vary by platform.

## Component matrix

| Public export    | Supported contract                                                                                                                                                                                                | Primary evidence                                                      |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `rect`           | Fill, stroke, alpha, signed geometry, all pixel-grid modes, property updates, cursor, and mouse regions.                                                                                                          | Direct component suite, shapes lesson, geometry matrix                |
| `path`           | Fill, stroke, combined paint, transparent paint, alpha, path replacement, expanded stroke interaction width, and empty paths.                                                                                     | Direct component and interaction suites, shapes lesson                |
| `line`           | Ordered polyline coordinates, style/update behavior, empty and one-point no-op geometry, transforms/clips, and expanded hit width.                                                                                | Direct line suite, lines lesson, geometry matrix                      |
| `horizontalLine` | Optional full-Canvas left/right bounds, all pixel-grid modes, updates, and the shared line paint/interaction behavior.                                                                                            | Direct helper matrix and lines lesson                                 |
| `verticalLine`   | Optional full-Canvas top/bottom bounds, all pixel-grid modes, updates, and parity with `horizontalLine`.                                                                                                          | Direct helper matrix and lines lesson                                 |
| `svgPath`        | Browser `Path2D` parsing, fill/stroke/alpha, data updates, interactions, valid/empty/malformed delegation, and transforms.                                                                                        | Direct SVG suite, shapes lesson, runtime recovery suite               |
| `text`           | Fill/stroke/alpha; Canvas font, alignment, and baseline; `visible`, `ellipsis`, `squish`, and `clip`; word wrapping and height truncation; measured per-line interaction bounds.                                  | Direct call/interaction suite and text lesson                         |
| `img`            | Detachable source generations; success/error/race/removal; independently natural or explicit dimensions; alpha, border, all pixel-grid modes, and stable geometry before/after load when dimensions are explicit. | Direct async/component suites, image lesson, cleanup laboratory       |
| `g`              | Nested scale, rotation/origin, translation, skew, zero/negative scale, updates, and sibling transform isolation.                                                                                                  | Direct group suite, composition lesson, geometry matrix               |
| `clip`           | `nonzero` and `evenodd` fill rules, cumulative intersections, transforms, updates, empty clips, and identical render/hit clipping.                                                                                | Direct clip suite, composition lesson, geometry matrix                |
| `layer`          | Same-mount root/prop/dimension updates, nested and transformed offscreen composition, global paint order, interaction bounds, and cascading cleanup.                                                              | Direct layer suite, composition lesson, geometry and cleanup matrices |

## Text layout details

`text` lays out one unwrapped line unless `wordWrap` is set. Wrapped lines are accumulated without losing the final fitting line. `lineHeight` advances each line. A finite `maxHeight` limits the number of complete lines; ellipsis is applied to the final visible line when requested. An ellipsis narrower than `...` resolves to an empty string rather than overflowing.

`overflow: 'squish'` passes the supplied `maxWidth` to Canvas `fillText`/`strokeText`. `overflow: 'clip'` creates a finite alignment- and baseline-aware clip rectangle when `maxWidth` is supplied; omitting `maxHeight` uses the Canvas height. Interaction paths union the actual bounding metrics for every rendered line, including center/right alignment, all baselines, and squished horizontal scaling.

Exact Canvas calls are tested with controlled text metrics. Gallery image comparison masks only glyph rasterization, while surrounding cards, clipping, layout, state, and interaction bounds remain exact.

## Image lifetime and geometry

Each `src` owns one `Image` generation. Load and error handlers detach on settlement, source replacement, component removal, or instance disposal. Saved late callbacks and superseded loads cannot change current state. Successful natural sizing uses `naturalWidth`/`naturalHeight` independently for omitted dimensions. Explicit dimensions establish geometry before load and after failure; this intentionally matches CRC's geometry-first transparent-region rule.

Pixel alignment produces one adjusted rectangle used by `drawImage`, the optional border, and the interaction path. It does not stretch the image by an extra pixel.

## Visual evidence and limitations

The local gallery exposes five stable lessons at:

- `#/scenarios/drawing-shapes`
- `#/scenarios/drawing-lines`
- `#/scenarios/drawing-text`
- `#/scenarios/drawing-images`
- `#/scenarios/drawing-composition`

Each lesson is loaded through the same catalog definition and readable source adapter used by headless Chromium. Five native 480×240 baselines retain exact geometry outside tight font and decoded-SVG edge masks; exact semantic pixels and controlled Canvas-call assertions cover those masked regions. CRC does not add DOM layout, rich text, accessibility, image CORS policy, or SVG validation beyond what the existing Canvas API exposes.
