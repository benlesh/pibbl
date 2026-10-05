---
id: api-function-text-geometry
title: Text geometry
summary: Shape text into editable PathGeometry with explicitly owned font resources.
kind: api
slug: text-geometry
apiCategory: function
symbols:
  [
    loadOutlineFont,
    createTextGeometry,
    OutlineFont,
    OutlineFontOptions,
    TextGeometryOptions,
    TextGeometryResult,
    TextGlyph,
    InkBounds,
  ]
---

# Text geometry

The optional `@pibbl/text` package converts one text run into editable
[`PathGeometry`](#/api/functions/path-geometry). HarfBuzz shapes the whole run,
including kerning, ligatures, and mark positioning, before Pibbl copies its outlines
into independent geometry. Importing the package does not initialize WASM.

```ts
import { loadOutlineFont, createTextGeometry } from "@pibbl/text";

async function label(bytes: Uint8Array) {
  using font = await loadOutlineFont(bytes);
  return createTextGeometry(font, "Hello Pibbl", {
    fontSize: 96,
    features: { kern: true, liga: true },
  });
}
```

The returned geometry remains usable after the font is disposed. Pass it to
`<Path style={{ d: result.geometry, fill: "teal" }} />`, inspect its segments,
or edit its control points. Geometry mutation does not schedule a repaint;
update a signal or state after editing, as in the
[editable text example](#/examples/drawing/text-geometry).

## Load and own a font

`loadOutlineFont(source, options?)` accepts a URL string, `URL`, `ArrayBuffer`,
or `Uint8Array`. Strings mean URLs; Node callers read filesystem bytes themselves.
An offset typed-array view is respected and copied before asynchronous work.
`OutlineFontOptions.signal` cancels a download. Failed or canceled acquisition
returns no font owner.

`OutlineFont` implements `dispose()` and `[Symbol.dispose]()` with the same
synchronous, idempotent cleanup. Use `using font = await loadOutlineFont(...)`
for a local conversion or retain one font across edits and call `dispose()` on
teardown. A retained font must outlive every conversion that uses it. Loading
belongs outside Pibbl's synchronous component evaluation.

`using` requires runtime `Symbol.dispose` support and a compatible syntax target
or compiler transform. TypeScript consumers include `ESNext.Disposable` (or
`ESNext`) in their configured libraries. Pibbl does not install a global polyfill. Explicit
`dispose()` works without `using` syntax. Generated paths and metrics hold no
borrowed WASM views. Disposing a font releases its native resources; the shared
WASM memory may retain its high-water capacity for later reuse.

Supported containers are outline TTF and OTF (quadratic TrueType and cubic CFF
outlines). WOFF, WOFF2, collections, and system-font/CSS lookup are not supported.
No font fallback is performed. Variable fonts use their default instance; there
is no axis or face-selection API in this release.

Fonts declaring COLR, SVG, sbix, CBDT, or EBDT presentation tables are rejected by
default. Set `monochromeFallback: true` to explicitly request their ordinary
outlines. This does not convert colors, bitmap images, or SVG artwork; a usable
outline is still required. The check is conservative for the entire font.

## Convert one run

`createTextGeometry(font, text, options)` is synchronous. `TextGeometryOptions`
requires a finite positive `fontSize` in logical units. Optional fields are:

| Option          | Meaning                                                                              |
| --------------- | ------------------------------------------------------------------------------------ |
| `features`      | Up to 64 four-character OpenType tags mapped to booleans, such as `{ liga: false }`. |
| `direction`     | `"ltr"` or `"rtl"`; otherwise inferred by HarfBuzz.                                  |
| `script`        | Four-character ISO 15924 script tag, such as `"Arab"`.                               |
| `language`      | ASCII language tag, such as `"ar"` or `"en-US"`, up to 63 characters.                |
| `missingGlyphs` | `"error"` (default) or explicit `"notdef"` substitution.                             |
| `maxSegments`   | Integer output limit from 1 to 1,000,000; default 1,000,000.                         |

The origin is baseline `(0, 0)`, with positive Y down. Negative bearings are
preserved. RTL glyphs remain in HarfBuzz's output order. There is no paragraph
bidi algorithm, line wrapping, vertical layout, rich text, caret mapping, or
font fallback. Tabs and line breaks are rejected.

## Results and editing

`TextGeometryResult` contains:

- `geometry`: a new mutable `PathGeometry`, preserving curves and closed contours.
- `advance`: readonly X/Y layout advance, including whitespace.
- `inkBounds`: readonly `InkBounds` (`x`, `y`, `width`, `height`) using curve
  extrema, or `null` for empty ink. This differs from the advance.
- `glyphs`: readonly `TextGlyph` records with `glyphId`, UTF-16 `cluster`,
  `segmentStart`, `segmentCount`, `x`, `y`, `xAdvance`, and `yAdvance`.

Clusters are source string indices, not character, grapheme, or caret indices.
Several glyphs may share a cluster, and RTL cluster indices can descend.
Whitespace may have advance and zero segments. Metadata describes the initial
conversion: later edits do not update its segment ranges, metrics, or bounds.
No per-glyph path copies are created eagerly.

Font inputs are limited to 32 MiB, text to 100,000 UTF-16 units, shaped output to
200,000 glyphs, and extraction to a shared 2²⁴ native work-unit budget. Malformed
inputs, missing glyphs, nonfinite results, and exceeded limits throw without
returning partial geometry. These bounds do not guarantee a shaping timeout.
Reuse fonts and generated paths; do not reshape static text every frame.

## Browser assets

The published package includes precompiled WASM; consumers need no native SDK.
Browser bundlers select browser-only loader code. Bundlers that process
`new URL(..., import.meta.url)` should emit the WASM asset. For a plain esbuild
pipeline, copy `dist/engine.wasm` from the installed package beside the emitted
engine chunk and serve it as `application/wasm`. Test the production output,
including any application base path. Node loading resolves the packaged binary
relative to the installed loader.

Build-time generation is a planned follow-up; the runtime package does not yet
provide a generator or compressed-webfont decoder.

HarfBuzz interns language tags for the shared engine lifetime. To bound that
memory, an engine accepts at most 256 distinct explicit language tags, compared
case-insensitively. Existing tags and inferred language remain usable after that
limit; disposing a font does not reset it.
