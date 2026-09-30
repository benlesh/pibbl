# Text PathGeometry implementation plan

Status: Planned implementation of the approved design. No implementation tasks
have been completed by this plan.

Design: [Text conversion to PathGeometry](../specs/2026-09-30-text-path-geometry-design.md).

## Outcome and delivery order

Deliver `@crc/text`, an optional workspace package with a CRC-owned HarfBuzz
WASM wrapper. Load fonts asynchronously, generate editable PathGeometry
synchronously, and release font handles through either dispose or Symbol.dispose.
All setup, build, test, and benchmark operations have pnpm entry points.

Milestone A is **slice ready for feedback**: one font, real shaping, editable
outlines in Studio, and focused passing checks. Stop feature expansion there
for hands-on feedback. Milestone B is **feature complete**: accepted behavior,
format/script evidence, documented ownership, package integration, review, and
proportional final verification. Build-time asset generation is a later milestone,
not a prerequisite for A or B.

Use Node 24.15+ on the Node 24 LTS line and pnpm 11.21.0. Commands below are
proposed until their owning task installs them. Use `corepack pnpm@11.21.0` when
invoking pnpm to match the repository's pinned environment.

## 1. Establish the integration base

- [ ] Inspect current AGENTS instructions, status, branch, and existing managed
      worktrees. Preserve concurrent changes; use a suitable isolated checkout
      when implementing rather than combining another chat's unfinished work.
- [ ] Verify the integrated public PathGeometry builders, revisions, and Path
      input support. Read drawing, scheduling, and ownership contracts.
- [ ] Confirm a minimal Node import of core and construction of geometry works
      without DOMMatrix or Path2D. Record any necessary prerequisite fix before
      depending on build-time compatibility.
- [ ] Select one redistributable static TrueType fixture with known kerning and
      ligatures. Store its license, source revision/hash, and independently checked
      expected glyph IDs/positions. Do not redistribute system fonts from research.
- [ ] Select exact Emscripten and HarfBuzz releases, verify official source hashes,
      and record host support. Start with the current development host and Linux
      CI; document unsupported hosts explicitly rather than claiming universal setup.

Files: new `packages/text/test/fixtures/`, `packages/text/native/toolchain.lock.json`;
existing core public geometry files are inspected, not redesigned.

Exit: exact fixture/toolchain inputs and a working public geometry endpoint.
Do not spend this stage benchmarking alternative engines or building a font corpus.

## 2. Scaffold the package and reproducible native build

Create:

- `packages/text/package.json`, `tsconfig.build.json`, `src/index.ts`.
- `packages/text/native/crc-text.cpp` and the native lock manifest.
- `packages/text/scripts/{setup,doctor,build,clean}.mjs` plus shared tooling helpers.
- A local ignored cache for SDK/source downloads and native intermediates.

Update root scripts and workspace dependencies using existing sibling conventions.
Expose `text:setup`, `text:doctor`, `text:build`, and `text:clean`; package `build`
must perform the same complete build so recursive root builds work.

- [ ] Setup provisions a pinned SDK and upstream source with integrity checks,
      atomic writes, and a concurrency lock. Resolve tools locally in child
      processes; no shell activation or global configuration changes.
- [ ] Doctor reports Python/host prerequisites and missing browser provisioning.
      Build ensures setup, caches by all relevant inputs, and works offline after
      provisioning. Clean preserves downloaded SDK/source caches.
- [ ] Compile only required shaping, font-table, and draw functionality. Keep
      FreeType, subsetting, platform backends, and rasterization out of the build.
      Do not disable required OpenType shaping tables merely to reduce size.
- [ ] Emit an explicitly initialized modular WASM loader. Keep Node filesystem
      loading separate from browser URL loading so browser bundles do not resolve
      Node built-ins. Compile upstream as a dependency, not a fork of its engine.
- [ ] Copy WASM, JS/types, version metadata, and license notices into dist.
      Install/postinstall performs no native setup or compilation.

Check: `pnpm text:doctor`, `pnpm text:setup`, and `pnpm text:build`; verify a
second build reuses native output. Add focused tests only for meaningful tooling
failure cases as implemented, such as bad digest and cache invalidation.

## 3. Define the first observable failing contract

Create `packages/text/test/text-geometry.test.ts` and a package test configuration
with distinct Node and Chromium projects. Add `pnpm text:test` to build once and
run the selected package tests. Support narrowing by test name during iteration.

- [ ] Write a public-API test using fixture bytes and a short known string. Assert
      expected glyph IDs/positions, baseline coordinates, closed quadratic
      outlines, size scaling, and actual PathGeometry instances.
- [ ] Exercise a known kerning pair and a known ligature with feature toggles;
      expected values come from checked fixtures, not from the implementation
      under test generating its own expected result.
- [ ] Assert geometry remains editable and usable after the font is disposed.
- [ ] Run and record the expected missing-implementation failure before writing
      conversion production code. Keep the fixture matrix narrow until A.

The first contract spans loading, shaping, extraction, and public geometry; do
not substitute isolated wrapper unit tests for it.

## 4. Implement the complete font conversion slice

Create `src/lib/{engine,font,text-geometry,types}.ts`, browser/Node loader modules,
and the native wrapper. Export only the approved public API and supporting types.

- [ ] Define and version the private bulk-result ABI: command opcodes, coordinate
      storage, glyph IDs, UTF-16 cluster indices, placements, segment intervals,
      advances, and bounds. Bounds describe ink, not advance width.
- [ ] Implement native font/result handle ownership, explicit release, error
      status, and structured partial-failure cleanup. Use generational IDs or
      equivalent stale-handle protection, not unchecked public raw pointers.
- [ ] Shape complete UTF-16 runs with explicit or inferred run properties. Use
      native draw callbacks to accumulate packed commands inside WASM, with no
      per-point JavaScript callbacks. Preserve contours and quadratic/cubic types.
- [ ] Materialize through public PathGeometry builders with numeric scaling and
      Y reflection. Do not use addPath/DOMMatrix, SVG round trips, or private
      typed buffers. Read WASM views after allocation and release results in finally.
- [ ] Implement loadOutlineFont for URL, ArrayBuffer, and offset Uint8Array;
      check fetch status, support cancellation, and own input bytes. Coalesce
      lazy engine initialization while keeping each font handle independently owned.
- [ ] Implement createTextGeometry with finite positive size, feature options,
      direction/script/language, immutable initial metadata, and independent output.
      Bound inputs/intermediates/output and reject invalid commands/coordinates.
- [ ] Implement both disposal methods through one synchronous, idempotent cleanup;
      assert exact native release and rejection of use after disposal. Include a
      compiled `using font = await loadOutlineFont(...)` test before A, including
      an exceptional scope exit. Returned geometry must not hold the font alive.
- [ ] Handle empty/space-only text, unsupported containers, and missing visible
      glyphs explicitly; initially advertise only the fixture-backed TTF scope.

No eager per-glyph PathGeometry copies, global text cache, worker pool, or custom
font parser. Keep a private test-only native counter interface for ownership
checks; do not expose diagnostics as a public package compatibility surface.

Check: focused `pnpm text:test`, package typecheck, and changed-file lint.

## 5. Make the slice observable in Studio

Create `packages/scenarios/src/learning/drawing/text-geometry.example.tsx` and
add its learning/catalog registration. Update the Studio runtime import mapping,
source/built aliases, and `playground/src/crc-editor-types.txt` sufficiently for
this example to execute and typecheck through public imports.

- [ ] Load the font outside synchronous component evaluation and show loading
      and failure states. Dispose the owner on teardown, including navigation
      while loading; any font acquired after cancellation must be released.
- [ ] Show the converted word, control points, a preserved original, and an editable
      clone. Pointer dragging edits a point and updates a signal for repaint.
      Provide a reset action. Changing a label rebuilds geometry explicitly.
- [ ] Display glyph count, advance, and ink bounds to aid semantic inspection.
      A font is not acquired inside a component-local using scope when it must
      survive future edits.
- [ ] Add one headless scenario test for visible output, control-point editing,
      reset, and resource cleanup. Assert geometry/state before visual evidence.
- [ ] Run focused package/scenario checks and open the actual development server.
      Report its exact origin/port plus `#/examples/drawing/text-geometry` and
      what to inspect; do not assume an available port in advance.

**Milestone A: slice ready for feedback.** Record fresh commands, environment,
and results. Obtain hands-on feedback before expanding the support matrix.

## 6. Harden the accepted behavior after feedback

Add focused suites for shaping, malformed inputs, and ownership.

- [ ] Add licensed CFF OTF and script fixtures to cover cubic outlines, holes,
      composite glyphs, marks, Arabic/RTL, supplementary characters, and clusters.
      Verify RTL engine order and repeated/shared cluster semantics; never promise
      character or caret indexing from cluster values alone.
- [ ] Test font size/coordinates, default ignorables, whitespace, missing glyph
      policy, unsupported color/bitmap presentation, and malformed/truncated fonts.
      Add variable-font axis/face selection only with pinned fixture evidence;
      explicitly reject unsupported configurations otherwise.
- [ ] Choose documented font-byte/text/glyph limits using fixture measurements.
      Enforce limits before growth, guard arithmetic, and test native result cleanup
      after limit errors, conversion exceptions, and WASM memory growth.
- [ ] Test dispose, Symbol.dispose, mixed/repeated calls, early return, exceptions,
      failed load, canceled load, and load races. Use ownership counters, not GC.
- [ ] Verify output independence, mutation/metadata semantics, and retained Path
      snapshot behavior. Add a glyph-copy helper only if accepted feedback needs it.
- [ ] Verify load failure recovery and explicit WASM asset URL handling. Never
      mutate global Symbol properties; document supported runtimes/transforms.

WOFF/WOFF2 decoding remains a separate follow-up unless feedback makes it a
release requirement. Do not accidentally advertise it from a generic font URL.

## 7. Integrate package distribution, docs, CI, and measurements

Files include `tooling/verify-packed-text.mjs`, `.github/workflows/trust.yml`,
root trust scripts, public docs under `docs/site/`, and a new implemented behavior
contract under `docs/design/` once behavior is actually implemented.

- [ ] Test a packed installation outside the checkout: JS/types/WASM/notices,
      NodeNext/Bundler consumers, using declarations, Node execution without DOM,
      and browser bundling with no Node built-in leakage. Consumer install must
      succeed without Emscripten or upstream source present.
- [ ] Verify production source/built Studio execution, editor declarations, font
      fixture URLs, lazy chunks, and no engine/WASM requests for core-only users.
- [ ] Add text:bench with separate startup, shaping, outline extraction, WASM
      transfer, and geometry materialization timings; report compressed assets,
      repeated/distinct glyphs, and long strings. Avoid default timing assertions.
- [ ] Complete setup/doctor verification for supported hosts, offline warm builds,
      concurrent setup, corrupted downloads, and relevant cache changes. Wire CI
      to the same commands and cache keys. No shell-only CI build procedure.
- [ ] Document loading, disposal/using, supported formats/scripts, shaping limits,
      mutation scheduling, native memory ownership, and contributor commands.
      Record dependency licenses, pinned inputs, build flags, and release hashes.
- [ ] Release CI performs clean builds from pinned inputs and checks reproducible
      artifacts in the same supported environment; account explicitly for any
      host-specific artifacts rather than asserting cross-host identity blindly.
- [ ] Integrate tests once into existing trust stages: static/build, packed
      consumers, browser behavior, and ownership. Avoid nested full-suite reruns.
- [ ] Review changed implementation and unresolved material findings; rerun only
      affected checks after fixes. Then run `corepack pnpm@11.21.0 trust` on Node
      24 and record fresh results. Do not infer success from the design research.

**Milestone B: feature complete.** Accepted behavior is documented, reviewed,
verified, and packaged. Any deferred format/variation capability is stated clearly.
Commit/publish/merge follow the user's delivery instructions when implementation
is requested; creating this plan performs none of those actions.

## 8. Optional later build-time generation

After runtime behavior is accepted, implement `@crc/text/build` and
`pnpm text:generate -- <configuration>` using the same Node-capable engine.

- [ ] Test a fixed string's generated factory against runtime geometry/metadata.
- [ ] Emit deterministic ESM using public PathGeometry builder calls; each factory
      invocation returns independent editable geometry.
- [ ] Key generation by font hash, engine/generator version, and all shaping options.
- [ ] Verify generated-only browser consumers load neither engine nor font bytes.
- [ ] Compare generated asset size against runtime loading for actual label sets;
      preserve licenses and document that an atlas does not replace shaping.

Do not add a bundler plugin, binary path format, subsetting system, or worker
infrastructure before an observed need.
