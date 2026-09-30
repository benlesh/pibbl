# Text conversion to PathGeometry

> **Historical status: APPROVED DESIGN.** This dated record captures the approved direction; current contracts and tests define implemented behavior.

Status: Approved by the user, including pnpm tooling and Symbol.dispose support.
Not an implemented contract.

Date: 2026-09-30

## Recommendation

Build a small CRC-owned text-to-geometry module over a pinned native HarfBuzz
build compiled to WASM. Own its loading, explicit lifetime, packed output, and
PathGeometry integration. Reuse HarfBuzz's font parsing, shaping, and outline
extraction. A separate FreeType renderer is unnecessary for ordinary unhinted
OpenType outlines because HarfBuzz exposes a draw API.

This recommendation assumes willingness to maintain a small native wrapper and
reproducible WASM build, as raised in the design conversation. Fontkit 2.0.4 is
the preferred ready-made JavaScript fallback if that maintenance cost is
undesirable. The weaknesses found in HarfBuzz.js belong to that JavaScript
binding, not to HarfBuzz's native ownership model.

The strongest Rust alternative to evaluate is HarfRust for shaping with Skrifa
for outlines, sharing read-fonts parsing infrastructure. RustyBuzz now declares
itself archived; ttf-parser is in maintenance mode and recommends Fontations
for new projects. Do not select those older projects from familiarity alone.
HarfRust documents remaining conformance differences from HarfBuzz. Prefer the
native HarfBuzz reference engine until a measured Rust prototype offers a
concrete advantage for CRC.

No custom WASM build has been benchmarked yet. The choice above is an
architecture recommendation based on capabilities and ownership, not a claim
of proven smaller downloads or faster execution.

## Intended behavior

Given explicit font bytes and a single text run, return editable PathGeometry
with shaped glyph positions, preserved contours, and quadratic/cubic curves.
Text is one geometry source; along-path and between-path deformation remain
separate operations on the resulting geometry.

Ordinary Canvas Text remains independent. No new scheduler, component runtime,
retained scene graph, or automatic font fallback is introduced.

The initial support target is horizontal monochrome outline text, one font,
script/direction/language configuration per call. Ligatures, kerning, combining
marks, and contextual forms are engine responsibilities. Paragraph bidi,
line-breaking, rich text, CSS font selection, and automatic fallback are outside
this first contract. Reject tabs and line breaks rather than guessing layout.

## Workspace package and command workflow

Ship this as `packages/text`, published as `@crc/text`, with a matching-version
core peer dependency and workspace development dependency, following the sibling
package convention. Keep the native wrapper, toolchain/source lock manifest,
build orchestration, tests, and WASM asset ownership in this package. Core has
no dependency on it. Publish compiled JavaScript, declarations, WASM, and required
license notices. Application consumers never need a compiler or native SDK.

All supported developer operations have pnpm entry points. Proposed root aliases
delegate to package scripts; orchestration uses Node scripts rather than requiring
manual shell activation or globally configured compiler paths:

| Root command       | Responsibility                                                                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm text:setup`  | Idempotently provision the pinned Emscripten toolchain and HarfBuzz source into a local ignored cache; verify download hashes and report host prerequisites. |
| `pnpm text:doctor` | Check versions, host prerequisites, cache integrity, and required browser-test availability without modifying the machine.                                   |
| `pnpm text:build`  | Ensure setup, compile the wrapper and selected HarfBuzz features, then build JS/types and stage the WASM and notices.                                        |
| `pnpm text:test`   | Ensure the package build, then run focused geometry, browser/Node loading, and ownership tests.                                                              |
| `pnpm text:bench`  | Measure cold initialization, warm shaping/extraction, conversion, and artifact sizes; performance timing is separate from correctness.                       |
| `pnpm text:clean`  | Remove this package's generated output and intermediate build artifacts; retain the downloaded SDK/source cache.                                             |

The package's ordinary `build` script performs the same complete build as
`text:build`, so the existing recursive root `pnpm build` works. A contributor
can explicitly run setup first or let the first build provision the cache.
Normal `pnpm install` installs JS dependencies only: do not hide SDK downloads,
compiler installation, or native compilation in install/postinstall hooks.
Published consumers install prebuilt assets through normal pnpm installation.

Pin the SDK version, HarfBuzz revision/archive digest, compile flags, and wrapper
protocol in a checked-in manifest. Invoke tools by resolved local paths with a
child-process environment; no manual `source emsdk_env.sh`, global PATH changes,
Homebrew installation, or unpinned “latest” fetches. If a host prerequisite such
as Python is unavailable, doctor/setup must give a concrete actionable diagnostic.
The setup wrapper cannot promise to eliminate operating-system prerequisites.

Use a content-derived build key covering native sources, pinned upstream inputs,
toolchain, and flags. Reuse matching outputs; rebuild after relevant changes.
Provision atomically and guard concurrent setup/build processes. Warm builds
must work offline; missing cache entries in offline mode fail clearly. CI invokes
the same pnpm commands and caches verified inputs under that key.

Integrate focused tests into the existing browser, lifecycle, and packed-consumer
trust stages without rerunning the complete package suite in every stage. Test
the published tarball, including WASM URL resolution, browser and Node exports,
declarations, notices, and no install-time native tool requirement. Before publish,
run the package build and artifact verification using pnpm scripts. Add reproducible
clean-build verification to release CI, recording pinned inputs and artifact hashes.

Future offline generation will use `pnpm text:generate -- <configuration>` and
the same Node-capable package pipeline. This command remains deferred until
the generation feature is implemented; these script names are a design contract,
not commands already present in the repository.

## Existing PathGeometry integration

Inspected the local implementation and the chat “Add a compact Path primitive.”
That feature was still undergoing integration at research time; recheck its
merged public surface before implementation.

PathGeometry uses private typed arrays and a mutation revision. Path and Clip
accept it directly and CRC caches native snapshots by identity/revision.
Mutation itself does not schedule a frame. Applications notify CRC through
existing state/signals after editing.

Convert native output using public moveTo, lineTo, quadraticCurveTo,
bezierCurveTo, and closePath. Preserve Move/Close boundaries and curves. Avoid
SVG serialization/parsing, eager flattening, and private storage access.

The current addPath/transform implementation requires DOMMatrix and clones
geometry during addition. Apply scale/translation while writing commands
instead, which avoids those intermediate copies and supports build-time Node
use without DOMMatrix or Path2D. Validate the core package import and builders
in a real Node consumer before promising that compatibility.

## Native boundary and efficient data flow

Use a small C ABI with opaque font and result handles:

```text
create_font(bytes, face_index) -> font_handle
shape_outline(font_handle, utf16_text, options) -> result_handle
result_buffers(result_handle) -> lengths and memory offsets
release_result(result_handle)
release_font(font_handle)
```

This is a proposed protocol, not a finalized export list. Return explicit error
codes and diagnostics; validate handles and reject use after release. The JS
facade makes disposal idempotent. Native RAII/structured cleanup releases partial
work on errors. Avoid exposing arbitrary WASM pointers as public JavaScript API.

Keep shaping and glyph draw callbacks inside WASM. Accumulate results in packed
opcode, coordinate, and glyph-metadata buffers, then cross into JavaScript once
per run. Do not make a WASM-to-JS callback for every curve point. Keep draw
callbacks, scratch buffers, and parsed font resources reusable with clear owners.

Suggested transport is Uint8 opcodes plus Float64 coordinates and integer glyph
metadata. This protocol is versioned independently of PathGeometry's private
storage. Float64 storage does not manufacture precision absent in the engine's
outline callbacks. Use unhinted outlines and document numerical tolerances.

Read the final WASM views only after all allocating native calls finish. Memory
growth invalidates old views; never cache a view across calls. Iterate and write
into a new caller-owned PathGeometry, then release the native result in finally.
Do not expose borrowed WASM memory through returned geometry or metadata.
This is a deliberate copy, not a zero-copy promise.

Shape each entire run once. For glyph offsets and pen position in font units:

```text
s = fontSize / unitsPerEm
x = (penX + xOffset + glyphX) * s
y = -(penY + yOffset + glyphY) * s
```

Transform control points identically. Advance the pen using shaped advances
and follow the engine's output order without reversing RTL a second time.
The uniform Y reflection preserves relative contour winding. Whitespace has
advance but may have no outline. Device pixel ratio never enters this mapping.

Repeated glyph outlines may be cached per face, variation coordinates, and
glyph ID under a bounded byte budget. Scale/placement is applied when emitting
each occurrence. Defer that additional cache until measuring the first slice;
reuse font handles and already-created label geometry immediately. Do not
reshape static labels during every component render.

## Proposed JavaScript API

An optional @crc/text package exposes a small facade:

```ts
const font = await loadOutlineFont("/fonts/Example.ttf");
const label = createTextGeometry(font, "AVATAR office", {
  fontSize: 96,
  features: { kern: true, liga: true },
});
// <Path style={{ d: label.geometry, fill: '#fff' }} />
font.dispose(); // generated geometry remains usable
```

Font handles implement `Disposable` and expose both `dispose(): void` and
`[Symbol.dispose](): void`, delegating to the same synchronous, idempotent
cleanup. Mixing or repeating either entry point releases each owned resource
exactly once. Normal cleanup must not throw, including automatic scope exit
while another exception is propagating. Acquisition is asynchronous; release
is synchronous, so callers use `using font = await loadOutlineFont(...)`:

```ts
async function makeLabel() {
  using font = await loadOutlineFont("/fonts/Example.ttf");
  return createTextGeometry(font, "Hello", { fontSize: 96 });
} // font is released; returned geometry and metadata remain usable
```

`Symbol.asyncDispose` is unnecessary for this synchronous release contract.
Declare Disposable support in published types and Studio declarations, and
verify `using` in Node, browser builds, and packed TypeScript consumers.
Document the required Symbol.dispose runtime support (or consumer-provided
polyfill) and syntax transformation for older targets; do not silently modify
global Symbol properties. Explicit dispose remains available to callers that
do not use using syntax. A font shared across frames must have an owner whose
lifetime spans those frames, rather than a component-local using declaration.

Ownership tests cover explicit disposal, scope exit, early return, exceptions,
mixed/repeated entry points, rejection of use after release, and continued use
of geometry returned from a using scope. Failed loading cleans up partial
resources internally because no disposable handle has yet been returned.

Loading accepts a URL, ArrayBuffer, or Uint8Array, with AbortSignal for fetch.
Check HTTP status, preserve typed-view boundaries, and copy into owned native
storage once. Node users pass filesystem bytes explicitly; string inputs mean
URLs. A font handle fixes face and variation configuration, so cache identity
is stable. Async loading happens before synchronous component evaluation.

createTextGeometry is synchronous after load. Require finite positive size;
accept explicit direction, script, language, and feature tags. Start with
outline TTF/OTF. WOFF/WOFF2 decoding is a separate capability and payload:
compile or separately lazy-load an established decoder when adding those
formats. Do not assume HarfBuzz accepts compressed webfont containers directly.

Return independent geometry, initial glyph records, advance, and ink bounds.
Use a baseline origin (0,0), positive Y down, with negative bearings preserved.
Ink bounds differ from layout advance, and empty ink has null bounds.

Glyph records contain glyph ID, origin, advance, initial segment interval, and
source cluster index. Feed UTF-16 to HarfBuzz so public indices use JavaScript
string units. Preserve engine cluster semantics: multiple glyphs may share a
cluster; RTL indices need not increase; a cluster is not a character or caret
position. Cluster end ranges require explicit ordering logic rather than using
the next visual glyph's index.

Metadata describes conversion-time geometry. Later geometry edits do not update
bounds or metrics. If exposing a glyph-copy helper, initially reject changed
source revisions conservatively, so segment edits cannot silently select the
wrong outline. Avoid eagerly allocating both combined and per-glyph paths.

Fontkit remains an alternative adapter, but it cannot provide this same source
cluster contract from its public run API. Selecting it would explicitly narrow
the first public API to glyph identity/order; do not invent text indices from
codePoints or glyph counts.

## Loading, ownership, and failure handling

Dynamically load the engine/WASM only on the first font request, with an optional
preload function. Start fetching font bytes concurrently. Core-only and generated
geometry consumers must fetch no engine assets. Package a versioned WASM asset
and explicit URL resolution compatible with browser bundlers and Node; verify
real production output and MIME/loading behavior.

Coalesce engine initialization but do not create an unbounded global font/text
cache. Applications explicitly reuse font handles. On dispose, release native
font/face/blob references, caches, and owned input allocations deterministically.
Module memory may remain at its allocated high-water mark for reuse; disposal
is not a promise to shrink WebAssembly.Memory or force OS reclamation.

Return geometry only after complete successful conversion. Validate metadata,
positions, commands, and all coordinates before passing them to PathGeometry,
since some of its builders intentionally ignore nonfinite inputs. Expose
limits for input bytes, text length, glyph count, and output segments. Default
output limit is one million segments, consistent with current path utilities;
select remaining defaults against the fixture corpus before release. Synchronous
limits do not imply a hard shaping timeout; workers can be considered for
untrusted workloads or measured interaction stalls.

Missing visible glyphs produce an error by default, with explicit .notdef
replacement as an option. Whitespace/default ignorables are not automatically
missing. Color/bitmap/SVG glyph appearance is outside the monochrome contract;
reject unsupported presentation unless a monochrome fallback is explicitly
requested and available. Bound intermediate allocations and always release
partial native results after malformed input, limits, or conversion failures.

## Build-time generation

A future @crc/text/build entry runs the same engine and conversion pipeline in
Node, emitting deterministic ESM factories using public PathGeometry builders.
Each invocation creates independent mutable geometry plus optional metadata.
Consumers need neither font bytes nor a runtime font engine. No new binary path
format or bundler plugin is needed initially.

Cache generated artifacts by font content hash, engine/generator version, text,
face/variations, size, direction, script, language, and features. Test runtime
and generated output equivalence. Retain appropriate font/dependency notices.
Generated outlines may be larger than a font plus engine for many strings;
measure before assuming a download win. Precomputed glyphs alone do not replace
shaping for arbitrary future text.

## Building the entire engine ourselves

A deliberately restricted static TrueType extractor is feasible: parse the sfnt
directory and cmap/head/maxp/loca/glyf/hhea/hmtx tables, reconstruct contours and
implied quadratic points, handle composite glyph transforms, and emit paths.
That delivers useful nominal glyph geometry with advances. Pair spacing might
add legacy kern support, but many fonts use GPOS instead.

Reliable general text requires much more: GSUB/GPOS lookup machinery, script
shapers, mark attachment, Unicode properties and normalization behavior, CFF/CFF2
charstrings, variation tables, compressed font containers, and hostile-input
validation. Bidi/run segmentation still exists outside shaping. A narrow parser
must reject unsupported cases rather than silently producing plausible but
incorrect text.

Owning all of this is possible, but the maintenance/testing commitment becomes a
font-engine project. It is not required to achieve CRC's geometry goal. The
recommended custom work is the small bulk-output/lifetime wrapper and geometry
API; adopt a full custom parser/shaper only if creating a font engine is itself
an explicit product goal. Differential tests against existing engines and
fuzzing would be mandatory before calling it reliable.

## Research evidence and comparison

Public npm artifacts were inspected on 2026-09-30 in a temporary directory;
project dependencies were unchanged. Browser measurements used esbuild 0.25.12,
minified ESM, browser platform, esnext, gzip level 9. Font bytes are excluded.

| Candidate                 | Measurement                                                                                                       | Meaning                                                                                        |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Fontkit 2.0.4             | create entry plus dependencies: 365,813 bytes minified, 149,344 gzip (145.8 KiB)                                  | Best turnkey JS candidate.                                                                     |
| OpenType.js 2.0.0         | parse entry: 245,924 bytes minified, 67,731 gzip (66.1 KiB)                                                       | Smaller; narrower documented shaping coverage and separate WOFF2 decoding.                     |
| HarfBuzz.js 1.6.2         | Published runtime JS files total 114,456 raw / 23,521 separately gzipped; shaping WASM 433,766 raw / 174,406 gzip | Distribution sizes, not an equivalent successful browser bundle or prediction for our wrapper. |
| Custom HarfBuzz WASM      | Not measured                                                                                                      | Must measure chosen features and wrapper.                                                      |
| HarfRust plus Skrifa WASM | Not measured                                                                                                      | Rust alternative requiring its own conformance and size probe.                                 |

HarfBuzz.js's separate subset WASM is not needed for conversion. Its public
wrappers use FinalizationRegistry with no explicit release methods; a normal
esbuild browser probe also failed on a conditional Node module import. Our own
native wrapper can address both, at the cost of maintaining that wrapper/build.
Do not call raw destructors behind existing finalizer-owned wrappers.

A small Node v26.9.0 probe loaded Fontkit in approximately 20.5 ms. Local
SFNS.ttf and “AVATAR office” yielded 259 outline commands; parse/shape/extract
was about 28.0 ms and median repeated shape/outline access over 100 iterations
was 0.053 ms. Local SFArabicRounded.ttf and “سلام” yielded three glyphs and 147
commands, approximately 13.2 ms initially and 0.025 ms warm. These system fonts
were read locally, not copied into the repository or redistributed.

These are exploratory observations, not browser timings, PathGeometry conversion
benchmarks, or proof of shaping correctness. WASM is not automatically faster
or smaller. Measure initialization, shaping, extraction, boundary transfer, and
JS PathGeometry materialization separately. The compiler language alone cannot
establish a performance advantage.

## Delivery and validation

First slice: pinned native engine, minimal deterministic ownership wrapper,
one redistributable TTF font, shaped Latin text including kerning/ligature
fixtures, PathGeometry output, and a Studio example with editable outlines.
Add one focused failing public-API test before production code. Provide the
exact runnable Studio URL for experiential feedback before broad hardening.

Then cover cubic fonts, holes, composite glyphs, marks, Arabic/RTL, supplementary
characters, clusters, empty/space input, failures, limits, disposal, and independent
mutability. Validate supported shaping against checked engine/reference fixtures,
not just screenshots. Add browser/Node/lazy-loading and generated-output tests.
Use native ownership counters for teardown; do not infer release from GC timing.

Benchmark cold and warm browser cases, long text, large fonts, repeated/distinct
glyphs, and variations. Inspect production chunk/network output. Pin toolchain,
engine revision, compile flags, licenses, and artifact hashes for reproducibility.
Harden package exports, declarations, Studio types, packed consumers, and the
aggregate trust gate under the repository's documented Node 24 environment.
No runtime code was changed or aggregate trust gate run for this design.

## Sources

- [TypeScript explicit resource management](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-2.html)

- [HarfBuzz native engine and draw API](https://github.com/harfbuzz/harfbuzz)
- [Native draw callbacks and ownership](https://harfbuzz.github.io/harfbuzz-hb-draw.html)
- [HarfBuzz layout boundaries](https://harfbuzz.github.io/what-harfbuzz-doesnt-do.html)
- [HarfRust scope and conformance](https://github.com/harfbuzz/harfrust)
- [Skrifa outline support](https://github.com/googlefonts/fontations/tree/main/skrifa)
- [Fontations shared parsing architecture](https://github.com/googlefonts/fontations)
- [RustyBuzz maintenance status](https://github.com/harfbuzz/rustybuzz)
- [ttf-parser maintenance status](https://github.com/harfbuzz/ttf-parser)
- [Fontkit API](https://github.com/foliojs/fontkit)
- [Fontkit 2.0.4 package metadata](https://registry.npmjs.org/fontkit/2.0.4)
- [OpenType.js API](https://github.com/opentypejs/opentype.js)
- [OpenType.js 2.0.0 package metadata](https://registry.npmjs.org/opentype.js/2.0.0)
- [HarfBuzz.js ownership helpers](https://github.com/harfbuzz/harfbuzzjs/blob/main/src/helpers.ts)
- [HarfBuzz.js 1.6.2 package metadata](https://registry.npmjs.org/harfbuzzjs/1.6.2)
- [PathGeometry design](2026-09-29-path-geometry-design.md)
- [Local PathGeometry API](../../site/api/functions/path-geometry.md)
