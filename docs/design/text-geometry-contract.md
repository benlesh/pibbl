# Text geometry contract

`@crc/text` is an optional sibling package. It uses HarfBuzz through a CRC-owned
bulk WASM bridge to produce ordinary, independently owned `PathGeometry`.
Core has no dependency on the font engine and Canvas `Text` is unchanged.

## Ownership and loading

`loadOutlineFont` asynchronously accepts an explicit URL or font bytes. Typed
array view boundaries are respected and input bytes are copied. Network reads
are bounded and abortable. The shared engine initializes lazily; failed
initialization may be retried. A protocol check rejects mismatched JS/WASM.

Each `OutlineFont` owns one native font handle and its face/blob references.
`dispose()` and `Symbol.dispose` invoke the same synchronous idempotent cleanup.
A conversion after disposal throws. No finalizer or garbage-collection timing
is part of the lifetime contract. `using` scope exit, early return, exceptions,
and mixed disposal calls release exactly once. Returned geometry and metadata
remain usable independently of the font and WASM memory growth.

Native result handles are private, monotonically allocated, and never reused.
The wrapper reads bulk buffers only after native allocation finishes, validates
commands/coordinates/metrics, and releases the result in `finally`. No returned
object borrows WASM memory. Font/result construction failures use explicit
cleanup. Draw callbacks catch allocation exceptions internally so HarfBuzz can
return its scratch-buffer leases normally. Font disposal does not promise to
shrink the shared WASM memory capacity.

## Geometry and shaping

Each call shapes a complete single horizontal run once. HarfBuzz handles font
mapping, OpenType substitution/positioning, ligatures, kerning, and combining
marks. CRC preserves glyph order and UTF-16 cluster indices; clusters are not
characters, graphemes, or caret positions. RTL indices may descend or repeat.
CRC does not implement paragraph bidi, fallback fonts, wrapping, or rich text.

Native outline callbacks accumulate packed move/line/quadratic/cubic/close
commands inside WASM. One run is copied through public PathGeometry builders;
there is no per-point JS callback, SVG round trip, or eager flattening. Coordinates
are scaled by fontSize/unitsPerEm and reflected to positive-Y-down at the baseline
origin. Negative bearings and contour relationships are preserved.

Results contain one mutable path, readonly conversion-time glyph records, layout
advance, and curve-extrema ink bounds (null for no ink). Metadata never updates
in response to later path edits. CRC's ordinary identity/revision path caching
applies, and applications schedule repaint through state/signals after mutation.
No text cache, per-glyph path copies, retained scene graph, or second scheduler
is introduced.

## Supported inputs and failures

The API supports outline TTF and OTF, with fixtures for TrueType and CFF, Latin
features, accents, and Arabic marks. Collections and compressed webfont
containers are rejected. Variable fonts use their default instance only.
Color/bitmap/SVG table presence is rejected unless monochromeFallback is explicit;
that opt-in still requires ordinary outlines and never converts color artwork.
Missing glyphs throw by default; missingGlyphs=notdef explicitly requests glyph 0.
Default ignorables and ordinary whitespace follow HarfBuzz shaping semantics.

Limits are 32 MiB of font bytes, 100,000 UTF-16 units per run, 200,000 shaped
glyphs, up to 1,000,000 output segments, 64 boolean feature overrides, and
2²⁴ shared native outline-work units per conversion. HarfBuzz interns language
tags for the shared engine lifetime, so at most 256 distinct explicit tags are
accepted per engine (case-insensitive); existing tags and inferred language remain
usable after the limit. Font disposal does not reset that bounded shared state. Size and all resulting
coordinates/metrics must be finite. No partial geometry is returned on failure.
Limits do not promise a wall-clock shaping timeout. Fonts are reused across
calls; static geometry should be generated once rather than every render.

## Package and tooling

Published output contains JS, declarations, one WASM binary with Node/browser
loaders, build metadata, and dependency notices. Consumers do not install a native
SDK. Package import alone does not fetch the engine. Plain esbuild consumers
must deploy the binary alongside the emitted engine chunk; URL-aware bundlers
may emit it automatically. The public API page documents asset placement.

Setup, build, test, benchmarks, reference generation, doctor, clean, and
reproducibility checks have pnpm commands. Setup pins source and host compiler
archives, checks SHA-256 before extraction, verifies extracted files/symlinks,
and uses the project's existing Node runtime. A shared lock protects mutations;
complete output is staged before replacing dist. Offline warm builds use checked
inputs, and normal dependency installation performs no native provisioning.

## Evidence boundaries

Public conversion tests compare against a separate native HarfBuzz reference
harness and checked font hashes. Curve bounds have analytic and independently
sampled tests. Native counters and allocation fault injection verify deterministic
cleanup; memory-growth tests verify copy independence. Packed Node/TypeScript/
Chromium consumers test exports, using, lazy loading, and failure recovery.
The Studio test covers typed input, generation, point dragging, reset, and native
font release on navigation. Benchmarks report short/long Node and browser cases
without machine-dependent default timing assertions.

Same-host artifact reproducibility is tested separately from performance. CI
configuration is not evidence of a completed remote run. Current execution
results and remaining validation are recorded in the
[implementation plan](../superpowers/plans/2026-09-30-text-path-geometry-implementation.md).
Build-time generation, WOFF/WOFF2 decoding, font fallback, custom variation axes,
and worker execution remain separate follow-ups.
