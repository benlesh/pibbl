# Text PathGeometry implementation plan

<<<<<<< HEAD
Status: Planned implementation of the approved design. No implementation tasks
have been completed by this plan.
=======
> **Historical status: IMPLEMENTATION PLAN.** This dated execution record is historical evidence; current contracts and tests define implemented behavior.

Status: Milestones A and B complete. The runtime package and interactive demo
are implemented and verified locally. Optional build-time generation in section 8
remains a separate follow-up. See the completion audit and dated evidence below.
>>>>>>> origin/main

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

<<<<<<< HEAD
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
=======
- [x] Inspect current AGENTS instructions, status, branch, and existing managed
      worktrees. Preserve concurrent changes; use a suitable isolated checkout
      when implementing rather than combining another chat's unfinished work.
- [x] Verify the integrated public PathGeometry builders, revisions, and Path
      input support. Read drawing, scheduling, and ownership contracts.
- [x] Confirm a minimal Node import of core and construction of geometry works
      without DOMMatrix or Path2D. Record any necessary prerequisite fix before
      depending on build-time compatibility.
- [x] Select one redistributable static TrueType fixture with known kerning and
      ligatures. Store its license, source revision/hash, and independently checked
      expected glyph IDs/positions. Do not redistribute system fonts from research.
- [x] Select exact Emscripten and HarfBuzz releases, verify official source hashes,
>>>>>>> origin/main
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

<<<<<<< HEAD
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
=======
- [x] Setup provisions a pinned SDK and upstream source with integrity checks,
      atomic writes, and a concurrency lock. Resolve tools locally in child
      processes; no shell activation or global configuration changes.
- [x] Doctor reports Python/host prerequisites and missing browser provisioning.
      Build ensures setup, caches by all relevant inputs, and works offline after
      provisioning. Clean preserves downloaded SDK/source caches.
- [x] Compile only required shaping, font-table, and draw functionality. Keep
      FreeType, subsetting, platform backends, and rasterization out of the build.
      Do not disable required OpenType shaping tables merely to reduce size.
- [x] Emit an explicitly initialized modular WASM loader. Keep Node filesystem
      loading separate from browser URL loading so browser bundles do not resolve
      Node built-ins. Compile upstream as a dependency, not a fork of its engine.
- [x] Copy WASM, JS/types, version metadata, and license notices into dist.
>>>>>>> origin/main
      Install/postinstall performs no native setup or compilation.

Check: `pnpm text:doctor`, `pnpm text:setup`, and `pnpm text:build`; verify a
second build reuses native output. Add focused tests only for meaningful tooling
failure cases as implemented, such as bad digest and cache invalidation.

## 3. Define the first observable failing contract

<<<<<<< HEAD
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
=======
Create `packages/text/test/text-geometry.test.mjs` and separate Node and Chromium
test entry points. Add `pnpm text:test` to build once and
run the selected package tests. Support narrowing by test name during iteration.

- [x] Write a public-API test using fixture bytes and a short known string. Assert
      expected glyph IDs/positions, baseline coordinates, closed quadratic
      outlines, size scaling, and actual PathGeometry instances.
- [x] Exercise a known kerning pair and a known ligature with feature toggles;
      expected values come from checked fixtures, not from the implementation
      under test generating its own expected result.
- [x] Assert geometry remains editable and usable after the font is disposed.
- [x] Run and record the expected missing-implementation failure before writing
>>>>>>> origin/main
      conversion production code. Keep the fixture matrix narrow until A.

The first contract spans loading, shaping, extraction, and public geometry; do
not substitute isolated wrapper unit tests for it.

## 4. Implement the complete font conversion slice

<<<<<<< HEAD
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
=======
Keep the public facade/types together in `src/index.ts`, with engine, font-byte,
container, bounds, and private profiling helpers under `src/lib/`, browser/Node
loader modules, and the native wrapper. Export only the approved public API and supporting types.

- [x] Define and version the private bulk-result ABI: command opcodes, coordinate
      storage, glyph IDs, UTF-16 cluster indices, placements, segment intervals,
      advances, and bounds. Bounds describe ink, not advance width.
- [x] Implement native font/result handle ownership, explicit release, error
      status, and structured partial-failure cleanup. Use generational IDs or
      equivalent stale-handle protection, not unchecked public raw pointers.
- [x] Shape complete UTF-16 runs with explicit or inferred run properties. Use
      native draw callbacks to accumulate packed commands inside WASM, with no
      per-point JavaScript callbacks. Preserve contours and quadratic/cubic types.
- [x] Materialize through public PathGeometry builders with numeric scaling and
      Y reflection. Do not use addPath/DOMMatrix, SVG round trips, or private
      typed buffers. Read WASM views after allocation and release results in finally.
- [x] Implement loadOutlineFont for URL, ArrayBuffer, and offset Uint8Array;
      check fetch status, support cancellation, and own input bytes. Coalesce
      lazy engine initialization while keeping each font handle independently owned.
- [x] Implement createTextGeometry with finite positive size, feature options,
      direction/script/language, immutable initial metadata, and independent output.
      Bound inputs/intermediates/output and reject invalid commands/coordinates.
- [x] Implement both disposal methods through one synchronous, idempotent cleanup;
      assert exact native release and rejection of use after disposal. Include a
      compiled `using font = await loadOutlineFont(...)` test before A, including
      an exceptional scope exit. Returned geometry must not hold the font alive.
- [x] Handle empty/space-only text, unsupported containers, and missing visible
>>>>>>> origin/main
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

<<<<<<< HEAD
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
=======
- [x] Load the font outside synchronous component evaluation and show loading
      and failure states. Dispose the owner on teardown, including navigation
      while loading; any font acquired after cancellation must be released.
- [x] Show the converted word, control points, a preserved original, and an editable
      clone. Pointer dragging edits a point and updates a signal for repaint.
      Provide a reset action. Changing a label rebuilds geometry explicitly.
- [x] Display glyph count, advance, and ink bounds to aid semantic inspection.
      A font is not acquired inside a component-local using scope when it must
      survive future edits.
- [x] Add one headless scenario test for visible output, control-point editing,
      reset, and resource cleanup. Assert geometry/state before visual evidence.
- [x] Run focused package/scenario checks and open the actual development server.
>>>>>>> origin/main
      Report its exact origin/port plus `#/examples/drawing/text-geometry` and
      what to inspect; do not assume an available port in advance.

**Milestone A: slice ready for feedback.** Record fresh commands, environment,
and results. Obtain hands-on feedback before expanding the support matrix.

## 6. Harden the accepted behavior after feedback

Add focused suites for shaping, malformed inputs, and ownership.

<<<<<<< HEAD
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
=======
- [x] Add licensed CFF OTF and script fixtures to cover cubic outlines, holes,
      composite glyphs, marks, Arabic/RTL, supplementary characters, and clusters.
      Verify RTL engine order and repeated/shared cluster semantics; never promise
      character or caret indexing from cluster values alone.
- [x] Test font size/coordinates, default ignorables, whitespace, missing glyph
      policy, unsupported color/bitmap presentation, and malformed/truncated fonts.
      Add variable-font axis/face selection only with pinned fixture evidence;
      explicitly reject unsupported configurations otherwise.
- [x] Choose documented font-byte/text/glyph limits using fixture measurements.
      Enforce limits before growth, guard arithmetic, and test native result cleanup
      after limit errors, conversion exceptions, and WASM memory growth.
- [x] Test dispose, Symbol.dispose, mixed/repeated calls, early return, exceptions,
      failed load, canceled load, and load races. Use ownership counters, not GC.
- [x] Verify output independence, mutation/metadata semantics, and retained Path
      snapshot behavior. Add a glyph-copy helper only if accepted feedback needs it.
- [x] Verify load failure recovery and explicit WASM asset URL handling. Never
>>>>>>> origin/main
      mutate global Symbol properties; document supported runtimes/transforms.

WOFF/WOFF2 decoding remains a separate follow-up unless feedback makes it a
release requirement. Do not accidentally advertise it from a generic font URL.

## 7. Integrate package distribution, docs, CI, and measurements

Files include `tooling/verify-packed-text.mjs`, `.github/workflows/trust.yml`,
root trust scripts, public docs under `docs/site/`, and a new implemented behavior
contract under `docs/design/` once behavior is actually implemented.

<<<<<<< HEAD
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
=======
- [x] Test a packed installation outside the checkout: JS/types/WASM/notices,
      NodeNext/Bundler consumers, using declarations, Node execution without DOM,
      and browser bundling with no Node built-in leakage. Consumer install must
      succeed without Emscripten or upstream source present.
- [x] Verify production source/built Studio execution, editor declarations, font
      fixture URLs, lazy chunks, and no engine/WASM requests for core-only users.
- [x] Add text:bench with separate startup, shaping, outline extraction, WASM
      transfer, and geometry materialization timings; report compressed assets,
      repeated/distinct glyphs, and long strings. Avoid default timing assertions.
- [x] Complete setup/doctor verification for supported hosts, offline warm builds,
      concurrent setup, corrupted downloads, and relevant cache changes. Wire CI
      to the same commands and cache keys. No shell-only CI build procedure.
- [x] Document loading, disposal/using, supported formats/scripts, shaping limits,
      mutation scheduling, native memory ownership, and contributor commands.
      Record dependency licenses, pinned inputs, build flags, and release hashes.
- [x] Release CI performs clean builds from pinned inputs and checks reproducible
      artifacts in the same supported environment; account explicitly for any
      host-specific artifacts rather than asserting cross-host identity blindly.
- [x] Integrate tests once into existing trust stages: static/build, packed
      consumers, browser behavior, and ownership. Avoid nested full-suite reruns.
- [x] Review changed implementation and unresolved material findings; rerun only
>>>>>>> origin/main
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
<<<<<<< HEAD
=======

## Execution evidence 2026-09-30

Implementation checkout: `/Users/benlesh/.codex/worktrees/text-geometry/crc`,
branch `codex/text-geometry`, based on origin/main d9c28931. The original
checkout contains unrelated active changes and is untouched by implementation.

- Provisioned Emscripten 4.0.22 and HarfBuzz 14.5.0 using `pnpm text:setup`.
  Source archive hashes are pinned in native/toolchain.lock.json.
- Added a revision-pinned ABeeZee fixture with OFL license and provenance.
- First public conversion test failed for missing dist/index.mjs before runtime
  implementation. It subsequently passed under Node 24.15.0: 1 test, 1 passed.
- `pnpm --filter '@crc/core...' build` built core with its types dependency;
  `pnpm text:build` compiled the custom native wrapper and TS facade; a second
  build reused the native output.
- Implemented initial bulk outline transport, baseline scaling, UTF-16 clusters,
  independent geometry, and both disposal methods. This is not yet slice-ready:
  the interactive demo and browser path have not been implemented or verified.

Next work: feature/direction/script options, exact ink bounds and semantic fixture
expectations; browser-safe WASM loading and interactive typed-text/point-editing
Studio demo; then performance scenarios, native ownership/error hardening, and
full plan verification. Review native allocation failures, bounded draw work,
font format validation, heap-view lifetimes, and metadata validation carefully.
Setup currently verifies source archives but SDK binary integrity, build concurrency,
robust doctor checks, and host/CI coverage still need hardening. Script tests are
not yet integrated into trust. No broad test, performance, or memory-leak result
is claimed from the single passing contract test.

### First interactive slice evidence

- Studio is running in exec session 11140 on
  `http://127.0.0.1:5190/#/examples/drawing/text-geometry`.
  Revalidate the process before reusing or restarting it.
- Users can type up to 36 characters, generate outlines, drag endpoint/control
  handles, and reset the geometry. The demo owns its font outside components
  and releases it on teardown, including late async completion.
- Node 24.15.0: `pnpm text:test` passed (1 focused contract);
  `pnpm text:test:browser` passed input/generate/drag/reset in Chromium, with
  no page errors. Reset restored the exact pre-drag canvas screenshot.
  The browser command currently expects a running Studio at CRC_TEXT_STUDIO_URL
  (default port 5190); automate server ownership for final CI integration.
- `pnpm exec tsc --noEmit` passed. Studio reports no TypeScript issues for the
  example. Browser plugin was unavailable, so repository Playwright was used.
- Added `pnpm text:bench`. Local Node medians: single glyph 0.006 ms;
  9-character label 0.032 ms; 1,000 repeated characters 1.33 ms;
  1,300 varied characters 1.74 ms; 10,000 characters 13.0 ms.
  Native WASM is 882,633 bytes raw / 300,953 gzip. These are single-host
  exploratory measurements, not browser timing or a memory-leak proof.
- User feedback requested through the asynchronous input tool. The first slice
  is ready for feedback; the full feature remains incomplete.

Immediate continuation priorities: add missing feature/script/direction options
and exact ink bounds; deterministic native counters covering repeated successful
and failing conversion, using scopes, limits, and canceled loads; improve native
OOM/exception handling and draw work bounds; validate browser production asset
loading and ensure tooling does not force text assets into unrelated core-only
consumers. Finish format/support fixtures, packed-consumer verification, CI/trust,
review, and documentation. Neither build-time generation nor broad compatibility
is implemented. Toolchain/setup scripts still require the hardening listed above.

### Ownership and metric hardening evidence

- Added a pinned Lato fixture and its OFL license for actual kerning/ligature
  feature-toggle evidence. ABeeZee remains the interactive fixture; it does not
  supply the tested fi ligature.
- Native font creation now uses local RAII for blob, face, and font through
  wrapper allocation/map insertion. Exception paths cannot abandon the font.
- Shared lazy engine state supports private allocation diagnostics across the
  public facade and tests. A 200-cycle success/limit/missing-glyph test returns
  font/result counts to baseline and checks live malloc usage against a warmed
  baseline with a 4 KiB tolerance; this is not a universal leak proof.
- Added using-scope return/exception, mixed disposal, canceled/invalid load,
  and overflowing whitespace metric tests. The latter failed before the fix:
  whitespace could return infinite advance without any outline coordinate to
  trigger validation. All scaled metrics and glyph segment spans are checked.
- Fresh Node 24.15.0 / darwin arm64: text:build and text:test pass (7 tests).
  text:test:browser passes typing/generation/drag/reset and reports no page errors.
  Existing preview session 11140 was confirmed live before this browser run.
- Fresh text:bench medians, including exact curve bounds and metadata validation:
  1 character 0.012 ms; 9 characters 0.054 ms; 1,000 repeated characters 2.08 ms;
  1,300 varied characters 2.76 ms; 10,000 characters 20.31 ms. Cold load 10.94 ms.
  WASM 923,231 bytes raw / 307,319 gzip. Node-only exploratory samples; browser
  timings, phase-level measurements, distribution verification, broader format
  tests, toolchain hardening, documentation, and final trust remain outstanding.

### Streaming limits, format coverage, and browser performance

- A new oversized-response test first failed by timing out: loading previously
  consumed the full response before checking its size. Loading now rejects an
  oversized Content-Length, bounds chunked reads to 32 MiB, cancels on failure,
  releases the reader, and detaches abort listeners. In-memory input is checked
  before copying; offset views are copied independently before awaiting.
- Added pinned, licensed Source Serif 4 CFF and Noto Naskh Arabic fixtures.
  Tests check cubic curves/two O contours, descending RTL UTF-16 clusters,
  shared clusters and positioned zero-advance marks. These are semantic
  invariants; independently produced exact shaping fixtures remain outstanding.
- Empty text exposed a negative-zero advance. All zero metrics now normalize
  consistently. Focused text:test passes 13 tests on Node 24.15.0.
- Added text:bench:browser with an owned temporary HTTP server and Chromium.
  It serves built artifacts, verifies importing @crc/text does not request
  engine assets, then measures cold load and five text scenarios. Short cases
  use batches of 20 to reduce browser timer quantization; there are no timing
  assertions. Server and browser teardown run in finally.
- Chromium 151.0.7922.34 / darwin arm64: cold font/engine load 5.70 ms;
  medians 1 character 0.005 ms, 9 characters 0.030 ms, 1,000 repeated characters
  1.70 ms, 1,300 varied characters 2.90 ms, 10,000 characters 18.40 ms.
  These local served-asset timings are not real-network startup predictions.
- Package-consumer/production integration, exact reference shaping evidence,
  native draw budget/error handling, adversarial inputs, full algorithm review,
  build/setup hardening, documentation, and aggregate trust are still pending.

### Packed consumer and browser loader evidence

- Added tooling/verify-packed-text.mjs and pnpm test:text-package. The verifier
  packs types/core/text, installs offline outside the checkout with ordinary
  install semantics, checks no install hooks/private entry exposure, verifies
  shared PathGeometry identity and Node conversion, then compiles a using-based
  consumer in Bundler and NodeNext modes with full declaration checks.
- Its first browser build failed: the universal Emscripten loader's conditional
  import of Node module was still resolved by esbuild. Added browser-only glue
  selected by the package browser mapping. Both builds are checked for identical
  WASM bytes and only one binary is retained. Emscripten's license is now staged.
- The verifier bundles the packed package for browsers and executes that bundle
  in Chromium, manually serving the WASM alongside emitted chunks as required
  for plain esbuild. It checks no WASM fetch before font loading, successful
  geometry after using-scope disposal, and no page errors. This is separate
  evidence from the Studio-specific runtime loader.
- Fresh Node 24.15.0: packed verifier passes runtime/declarations/browser checks;
  repository tsc --noEmit passes after synchronizing Studio declarations with
  feature/script/direction options and InkBounds.
- Root text:build now builds the text dependency closure; text:test ensures this
  build before package tests. Aggregate trust/CI integration is still pending.
- Remaining: explicit asset placement guidance and production Vite evidence;
  native draw budgets, unsupported-presentation and malformed-font handling;
  exact shaping reference fixtures, curve-extrema tests, three-pass code review;
  build concurrency/cache integrity/doctor and release reproducibility checks;
  public docs, CI, and the complete trust gate. No completion claim yet.

### Native failure-path and algorithm review

- Inspected pinned HarfBuzz hb_ot_draw_glyph_or_fail and glyf get_path ownership.
  Found that throwing std::bad_alloc from a CRC draw callback could bypass
  HarfBuzz's explicit release_scratch call. CRC callbacks now catch allocation
  failures locally, stop emitting, exhaust the live draw budget, and return
  normally. The wrapper reports failure only after HarfBuzz returns.
- Added a private deterministic fault hook (absent from package exports), with
  a test injecting 100 mid-glyph failures and successful subsequent conversions
  on the same font. Font/result counts stay fixed; allocated native bytes stay
  within 4 KiB of the warmed baseline. This verifies the failure path without
  exhausting host memory; it does not emulate every upstream malloc failure.
- Draw work now shares 2^24 HarfBuzz work units across one run. Output-limit and
  allocation failures exhaust that budget immediately; unsupported/invalid
  native draw results are reported instead of silently returning partial ink.
  This is an extraction-work bound, not a wall-clock shaping timeout.
- A malformed-font test failed before implementation because a truncated font
  was accepted. Added linear sfnt-envelope validation for directory bounds,
  duplicate tags, table ranges, and supported outline-table presence. HarfBuzz
  remains responsible for table contents and shaping; this is not a new parser.
- Added analytic quadratic/cubic extrema tests and 80 deterministic cubic curves
  independently evaluated at 1,001 sample points each. They verify tight bounds,
  inflections, negative coordinates, close segments, and move-only null ink.
- Fresh Node 24.15.0: package build and 20 tests pass. Focused eslint passes for
  all new text runtime/scripts/tests, packed verifier, asset plugin, and demo.
  Downloaded SDK sources and generated text output are excluded from repository
  lint/format scanning; no upstream sources are reformatted.
- Broader malformed/font-presentation policy, exact shaping references,
  setup/build reproducibility, distribution/docs/CI integration, remaining
  review passes, and final trust verification are still outstanding.

### Build orchestration hardening

- Added a shared native-tooling lock for setup/build/clean with owner diagnostics,
  bounded waiting, and finally-based release. Tests verify serialization and
  release after exceptions. Two actual simultaneous offline builds both pass
  and reuse the verified native cache.
- Source extraction records file hashes from the pinned verified archive and
  checks those files on reuse. Existing matching SDK installations are upgraded
  in place without discarding their binary tools. Compiler installation checks
  emcc, clang, wasm-ld, and wasm-opt presence rather than only one Python file.
- Native artifacts are cached under a source/flag/toolchain-derived key and
  checked by hashes before reuse. Native compilation is staged separately;
  JS/declarations/licenses/build-info are assembled in a fresh staging directory.
  dist is replaced only after successful compilation, preventing stale chunks
  and preserving the previous output on compiler errors.
- Doctor now checks cached source files, actual compiler version, native output
  hashes/version metadata, and Chromium availability. Fresh text:doctor passes
  on darwin/arm64. Setup output no longer suggests manual shell activation.
- Added pnpm text:verify-reproducible. Two forced offline native rebuilds produce
  identical hashes for all 16 distributed files on this host. This demonstrates
  same-host reproducibility, not cross-platform identity or Linux execution.
- Fresh Node 24.15.0: offline staged build passes, tooling lint passes, and all
  22 package tests pass. Lock/artifact tests failed for the missing helper module
  before implementation.
- Outstanding tooling evidence: CI host execution and SDK binary-download
  integrity beyond the pinned SDK release/source manifest. The current source
  and output checks do not independently authenticate installed SDK binaries.
  Remaining feature/docs/integration/review work is unchanged by these checks.

### Public policies, documentation, and production integration

- Added explicit missingGlyphs error/notdef policy and OutlineFontOptions with
  monochromeFallback. Both policy tests failed before implementation. Missing
  glyphs still throw by default. Fonts declaring color/bitmap/SVG presentation
  require explicit monochrome fallback, and outline tables remain required.
  The color-envelope test is synthetic; it does not claim color decoding support.
- Protocol manifest is now version 2 for the added native replacement option.
  Fresh build and all 24 focused tests pass on Node 24.15.0.
- Added docs/site/api/functions/text-geometry.md and packages/text/README.md.
  Updated API discovery, learning-import validation, catalog registration,
  source/built checks, and Studio declarations, including a using-based editor
  consumer. Regenerated the scenario index for the new lesson.
- Studio source/built/editor export parity passes. Public docs metadata, API
  coverage, routes, search, and links pass. docs:check passed its 979 RED mutation
  probes after dated records received the required in-progress status banner.
  Repository typechecking and focused code lint also pass.
- Browser test now owns and closes an ephemeral development or preview server
  unless CRC_TEXT_STUDIO_URL is supplied. Both source-production and built-package
  production Studio builds passed typing/generation/drag/reset with no page errors.
  Built Studio build log: /tmp/crc-text-built-studio.log (local transient evidence).
- Demo status now shows advance and ink dimensions. Public docs explain immutable
  conversion metadata, UTF-16 clusters, format/paragraph boundaries, native limits,
  lazy initialization, and browser asset placement.
- Added text checks to aggregate pnpm trust stages and a dedicated Linux CI job
  for package tests, doctor, packed consumers, reproducibility, interactive editing,
  and performance reports. The workflow is wired but has not run remotely.
- Remaining: exact independently generated shaping fixtures; SDK binary integrity
  evidence; complete ABI/recovery, memory-growth and demo teardown checks; final
  algorithm/ownership/integration review; implemented contract and final aggregate
  trust verification. Optional build-time generation remains a later milestone.

### Independent shaping and ownership evidence

- Added native/reference.cpp, a direct native HarfBuzz harness independent of
  CRC's WASM wrapper/geometry implementation, and pnpm text:reference to build
  it with a host C++17 compiler and generate checked-in expectations.
- Nine font-hash-pinned cases now check exact glyph IDs, UTF-16 clusters,
  advances, and offsets: kerning and ligature switches, Arabic marks/RTL, CFF
  accents, combining accents, supplementary-code-point indices via explicit
  .notdef, and default ignorables. All match the public API exactly in font units.
- A 50,000-glyph conversion demonstrably grows WASM memory while preserving
  previous geometry, releasing native result storage, and retaining independent
  mutability after disposal. A canceled partial HTTP response closes its socket
  and acquires no native font owner.
- Packed Chromium verification now rejects a simulated WASM download failure
  and then successfully retries in the same page. The production interactive
  test instruments only the loader wrapper to observe actual native counters;
  navigating away releases the demo's font and leaves zero native results.
- Fresh Node 24.15.0: 35 package tests and focused lint pass. Packed browser
  recovery and production demo typing/generation/drag/reset/teardown pass.
- SDK integrity follow-up is in progress: official compiler archive sizes were
  checked for darwin/linux arm64/x64 at the pinned Emscripten release build.
  Download/hash process is exec session 10538; revalidate before reusing it.
  Outputs are under packages/text/.cache/sdk-archives (not yet a checked-in pin).

SDK archive hashing finished successfully (exec 10538 is terminal). SHA-256,
size, official URL, and release build identity for all four compiler archives
are now pinned in native/toolchain.lock.json. The downloaded archives are in
.cache/sdk-archives. Setup still needs to consume these pins before claiming
SDK binary verification. CI cache paths now exclude transient lock/staging
files so canceled jobs cannot restore an abandoned tooling lock.

### Verification follow-up: contract inventory and bounded languages

- Registered all 13 text contract units against exact approved design clauses.
  Preserved historical baseline records; updated the current inventory to 18
  contracts and 187 post-baseline units. Documentation checks and all 979 RED
  mutation probes passed on Node 24.15.0 / pnpm 11.21.0.
- Corrected compiler-cache recovery so missing executable permissions cause
  replacement from the verified archive, even if file bytes still match.
- Ownership review confirmed HarfBuzz retains interned language tags for module
  lifetime. A new public-API test failed before the fix. Explicit tags are now
  case-normalized and capped at 256 per engine. The test passes: 1,000 additional
  tags reject without native allocation growth; existing tags and inferred
  language remain usable across font lifetimes.
- The aggregate gate exposed stale catalog/editor expectations and Chromium
  discovery of the downloaded SDK and separately owned Node tests. Updated the
  catalog to include the text lesson/API, editor inventory to include @crc/text,
  and excluded those non-Chromium inputs. The aggregate run failed and is not
  final verification; focused integration re-verification is in progress.
- Remaining work includes phase-level performance reporting, final aggregate
  verification, reproducibility after the latest changes, and completion audit.

### Final review follow-up: native failures, profiling, and bounded plans

- Added opt-in private phase instrumentation. Normal conversions do not read a
  clock. Node/Chromium benchmarks separately report input preparation, native
  setup, shaping, outline extraction, bulk view creation, path/metadata writing,
  bounds, and end-to-end measurements. Browser sub-clock-resolution phases can
  round to zero; phase medians are not additive. Runtime asset reporting now
  includes every JS chunk and both loaders rather than only the entry module.
- Reproduced HarfBuzz's empty-buffer/draw-function allocation singleton behavior
  with deterministic fault injection: conversion previously returned blank
  geometry instead of rejecting. Explicit checks now reject those allocations;
  font/result counters return to baseline and subsequent conversion works.
- Verified the official compiler archive's `4.0.22-git` version suffix against
  its hash-checked receipt. Doctor now accepts that official release spelling.
  The SDK archive integrity work described as pending in earlier notes is done.
- Two clean offline native rebuilds passed for all 17 emitted files before the
  subsequent shaping-cache change below. Reproducibility must be rerun for the
  final cache implementation; earlier results are not substituted for it.
- The aggregate run passed static/build/packed checks and 3,180 browser tests
  (four skipped). An occupied fixed preview port interrupted documentation
  acceptance. A fresh run with existing per-run port overrides passed that
  stage, then identified the filters visual baseline change below.
- Inspected both filters screenshots and a focused pixel diff: exactly 56 pixels
  at x=467..473, y=61..70 change the lesson ordinal from 22 to 23. Adding the text
  lesson intentionally shifts that catalog position; all other pixels match.
  Updated only `studio-filters.expected.png` to reflect that intentional change.
- A second cache probe found that 2,000 distinct feature configurations retained
  about 1.8 MiB of native shaping plans until font disposal, with linked-list
  lookup cost growing with the configuration count. A public regression test
  failed before the fix. The wrapper now tracks at most 64 configurations per
  font and renews the internal face with shared blob bytes at that boundary.
  Further configurations remain accepted; the public font identity is stable.
  Shaping failure invalidates that internal cache for the next attempt.
- The current demo was loaded and visually inspected at the recorded port 5190:
  editable Hello CRC outlines, white endpoints, gold controls, input/generate/
  reset controls, metrics, and segment count are present. The server was verified
  live; it was not restarted based on old notes.

The bounded-cache regression and all other focused package tests now pass
(40 tests on Node 24.15.0). Native review checked font/blob transfer, map insertion,
result ownership, callback exception boundaries, singleton allocation failures,
cache renewal, and WASM view invalidation. Algorithm review checked bounded
configuration lookup, one whole-run shape, bulk transfer, amortized path-builder
growth, and a linear analytic bounds pass. Integration review checked public
exports/declarations, packed Node/browser execution, lazy loading/retry, and the
interactive demo's mutation and teardown paths. These are scoped source reviews
and deterministic tests, not a proof against every upstream engine defect.

### Final performance and tooling measurements

Measured sequentially on darwin/arm64 with Node 24.15.0, pnpm 11.21.0,
and Chromium 151.0.7922.34. These are local observations, not portable timing
guarantees or default correctness thresholds. The ABeeZee fixture uses size 100.

| Scenario      | UTF-16 units | Segments | Node median / p95 (ms) | Chromium median / p95 (ms) |
| ------------- | -----------: | -------: | ---------------------: | -------------------------: |
| Single glyph  |            1 |       15 |          0.013 / 0.035 |              0.005 / 0.020 |
| Short label   |            9 |      174 |          0.065 / 0.142 |              0.030 / 0.040 |
| Long repeated |        1,000 |   17,400 |          2.722 / 3.219 |              2.300 / 2.300 |
| Long varied   |        1,300 |   26,860 |          3.668 / 4.999 |              3.400 / 3.800 |
| Very long     |       10,000 |  174,000 |        27.266 / 28.308 |            23.100 / 27.900 |

Node cold loading was 11.73 ms including imports and local fixture reading.
Browser cold loading was 4.50 ms after importing the facade, including font and
engine loading from localhost. Neither is a remote-network startup estimate.

The instrumented Node 10,000-unit case measured median shaping at 0.238 ms,
outline extraction at 10.385 ms, buffer-view creation at 0.001 ms, geometry and
metadata materialization at 8.489 ms, and analytic bounds at 5.570 ms. Input
preparation and native setup were 0.018 and 0.032 ms. Instrumented phase medians
come from separate runs and need not sum to the uninstrumented total.

The final WASM is 936,219 bytes raw / 312,549 gzip. The browser distribution
upper bound, including all shared JS chunks and the browser loader, is 972,453
bytes raw / 323,025 separately gzipped (about 315.5 KiB), excluding core and font
bytes. Both runtime probes verify that importing the facade does not fetch WASM.

`text:clean` removed dist and native intermediates while preserving downloaded
SDK/source inputs. An offline rebuild reproduced every prior output file. The
subsequent `text:verify-reproducible` command again matched all 17 distributed
files across two forced native builds. This is same-host evidence only.

A pnpm test-name-filter probe exposed Node flags landing after expanded test
paths. The package now uses a small pnpm-invoked runner that places flags before
paths; the focused filter executes only its matching case. The unfiltered runner
passed all 40 tests in the lifecycle stage. Sandbox-denied local-server probes
were rerun with the required host permissions; they are not runtime regressions.

The final aggregate attempt passed static/package checks, 3,180 Chromium tests
(four skipped), documentation acceptance, and the diagram-editor teaser. Node
24.15 then raised an intermittent `setTypeOfService EINVAL` during the visual
server readiness fetch. A fresh-port rerun passed all eight visual baselines.
The remaining exact gate commands passed: built smoke (one test), both source
and production interactive text tests, lifecycle (43 tests), structural
performance (49 passed, four skipped), and the 40 text tests. A final uninterrupted
aggregate run is still required before recording the gate itself as passed.

### Completion audit

Milestones A and B are complete. The final runtime remains scoped to a single
horizontal, monochrome outline run, as approved. Section 8 is optional future
work; no generation command or build-time entry is advertised as implemented.

| Requirement                                               | Current evidence                                                                                                                                                                                                                      |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Optional package, lazy engine, public PathGeometry output | `packages/text/package.json`, `src/index.ts`, packed Node/Bundler/NodeNext/Chromium consumers, source/built/editor export parity.                                                                                                     |
| Correct shaping and editable curves                       | Nine independent native-reference cases, TTF/CFF fixtures, kerning/ligatures/Arabic/UTF-16 assertions, analytic and sampled bounds checks, independent mutation after disposal.                                                       |
| Deterministic ownership and using                         | Explicit and Symbol.dispose tests, return/exception paths, native counters, 200 load/convert/dispose cycles, allocation fault injection, actual WASM growth, bounded language and shaping-plan retention.                             |
| Async input ownership                                     | Regression tests for offset views, Node Buffer mutation, partial-download cancellation, and options-object mutation without retaining the original abort listener.                                                                    |
| Interactive demo                                          | Typed input, generation, actual point dragging, reset, native teardown on navigation, source and production browser checks, and visual inspection of the running lesson.                                                              |
| Performance                                               | Five short/long scenarios in Node and Chromium; opt-in phase timings, cold loading, emitted asset sizes, and lazy network checks.                                                                                                     |
| pnpm tooling and artifacts                                | Setup/doctor, clean plus offline rebuild, concurrent tooling checks, download/cache corruption tests, and two forced native rebuilds with all 18 final distributed files matching. Packed artifacts include upstream runtime notices. |
| Integration and final verification                        | Aggregate trust exited 0; subsequent focused verification covers the final async-ownership and notice changes, as detailed below.                                                                                                     |

The uninterrupted `corepack pnpm@11.21.0 trust` run passed with exit code 0 on
Node 24.15.0, darwin/arm64, using the existing preview-port environment overrides
to avoid unrelated local servers. It included 3,180 main Chromium tests (four
skipped), all eight Studio visual baselines, packed consumers, source/built
Studio checks, interactive text editing in both modes, lifecycle and structural
performance checks, and 41 text tests at that point.

The final async-ownership audit then reproduced an abort-listener leak when a
caller replaced `options.signal` while loading. The loader now snapshots the
original signal and monochrome policy before awaiting. The earlier Node Buffer
regression likewise reproduced aliasing through Buffer.slice; explicit Uint8Array
construction now guarantees the promised copy. After those fixes, all 42 text
tests, packed consumers, the interactive demo, doctor, reproducibility, and lint
passed. A final packaging audit added the separately referenced Microsoft
shaping-data, musl, and LLVM runtime notices. The packed-notice test failed before
that addition and passes afterward; the WASM binary is byte-identical. The final
18-file reproducibility check, packed consumer check, doctor, and lint all passed.

These post-gate changes were verified with their affected checks; unrelated
passing suites were not repeated. CI is configured to run the same pnpm commands
on Linux; no remote CI execution or cross-host binary identity is claimed. The
macOS arm64 execution evidence above is the tested host evidence; other pinned
host archives remain explicit build targets rather than additional tested hosts.

Current behavior is documented in the [text geometry contract](../../design/text-geometry-contract.md)
and [public API](../../site/api/functions/text-geometry.md). The live lesson was
verified at `http://127.0.0.1:5190/#/examples/drawing/text-geometry`; server lifetime
is local to this development session.
>>>>>>> origin/main
