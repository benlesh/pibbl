# TFC-09 field note — drawing-component confidence

Date: 2026-08-11

## Scenario and risk

Five cataloged documentation candidates now teach every drawing export through readable public API examples: `drawing-shapes`, `drawing-lines`, `drawing-text`, `drawing-images`, and `drawing-composition`. The gallery and headless suite load the same definitions, controller actions, catalog metadata, raw source markers, and 480×240 Canvases.

The largest risks were silent visual errors hidden by screenshot-only tests and geometry disagreements between paint and interaction. The sweep found real defects in alpha zero, text wrapping/clipping/hit bounds, image alignment, pixel snapping, group props, and same-mount layer updates. It also replaced the four historical supported-behavior skips: nested clip and multi-layer targeting were closed by TFC-05, and both layer-update skips were enabled here.

## Manual evidence

The five lessons were exercised in the Codex in-app Chromium browser at `http://127.0.0.1:5193`, desktop viewport, DPR 1.

- **Draw shapes:** the initial rectangle, custom triangle, and SVG diamond rendered with distinct fill/stroke styles. Alpha-zero and transparent examples exposed their red/green underlays; empty geometry painted nothing; the signed rectangle extended left. **Update shapes** changed all three top shapes and revision `0 → 1`; **Reset** restored the initial scene.
- **Draw lines:** the polyline, crisp horizontal rule, crisp vertical rule, and empty no-op rendered as described. **Update lines** changed coordinates, width, color, and rule positions with no stale pixels; **Reset** restored the initial state.
- **Draw text:** visible, centered/middle, ellipsis, squish, wrap, clip, and alpha-zero cards remained contained. Clicking the visibly painted left half of the centered label changed centered clicks `0 → 1`, proving the interaction region follows alignment rather than the raw anchor. **Update copy** preserved that click count and advanced revision; **Reset** restored copy and counters.
- **Draw images:** primary/secondary, natural/explicit, alpha-zero, and half-alpha bordered images rendered. The sequence **Change image → Natural size → Explicit size → Broken image → Remove image → Show image → Reset** produced the documented source, sizing, failure, absence, recovery, and revision states.
- **Compose a scene:** the transformed group, `nonzero` clip, `evenodd` hole, and offscreen layer were distinct. **Update composition** changed the layer and composition state; **Reset** restored exact initial pixels.

The visible source panels matched the exercised `*.example.ts` files. Navigation grouped the lessons at learning orders 20–60. No warning or error appeared in the browser console.

## Headless method

`drawing-gallery.test.ts` validates catalog ordering, documentation visibility, exact API-tag coverage, action identity, lazy definitions, and raw-source adapters. It drives every public action and reset against the same scenarios. Exact pixels cover shape fills/styles/bounds, line positions, text card containment and alpha, image source/sizing/blending/failure/removal, group/clip fill rules, and layer updates.

Focused tests supplement the teaching source with all four line pixel-grid modes and default bounds, empty/single-point lines, valid/update/malformed SVG delegation, zero/negative scale and signed geometry, sibling transform isolation, empty clips, nested geometry, async image races, and exact text overflow calls. The text call test uses controlled metrics to pin ellipsis output, height-truncated wrapped ellipsis, squish `maxWidth`, and aligned clip geometry independently of fonts.

Independent completion verification under Node 24.19.0 and pnpm 11.21.0 produced:

- 33 browser files, 250 passed and 2 intentionally skipped opt-in timing benchmarks after the final text call assertions;
- 77/77 focused drawing-export tests before the final four text assertions, then 20/20 focused text tests;
- TypeScript 7 typecheck, ESLint, and Prettier checks green;
- package ESM/declaration build green;
- source and built gallery production builds green;
- strict Bundler/NodeNext and runtime package consumer green.

The TFC-10 trust gate keeps this complete suite and its structural performance assertions in the permanent contributor and CI sequence.

## Visual strategy

Five reviewed native-Canvas baselines replace one composite gallery screenshot. The original composite capture was downscaled/resampled by the browser surface during repeated runs, creating false differences unrelated to Canvas output. Comparing each 480×240 Canvas at native pixels removed that flake and made failures local to one lesson.

System-font glyph rectangles are tightly masked because glyph rasterization varies by platform; exact controlled Canvas calls, text interaction, and card pixels cover their semantics. Two decoded/scaled SVG image boxes receive tight edge masks; stable interior colors, blending, sources, dimensions, and failure/removal pixels remain exact.

A deliberate `VITE_CRC_DRAWING_VISUAL_DRILL=1` run changed the three top-row shapes and failed on 20,694 pixels with maximum channel delta 234. The expected, actual, and diff images were inspected and showed only the intended changed shapes. A normal rerun returned all six drawing-gallery tests to green. Baselines were never updated by CI or by the drill.

## Proven fixes and decisions

- `path`, `img`, and `text` honor `alpha: 0`; invisible paint retains geometry-driven interaction.
- Wrapped text flushes its final line, preserves the current line at height limits, avoids non-finite clip rectangles, supports narrow ellipsis, and uses actual per-line metrics for aligned/baseline-aware hits.
- Image generations own detachable load/error handlers and source-tagged state; natural dimensions prefer `naturalWidth`/`naturalHeight`.
- Image drawing, border, and hit testing share one aligned rectangle.
- Pixel-grid `none` is an exact no-op. Active modes snap opposite edges without adding one pixel or discarding signed dimensions.
- Horizontal and vertical helper defaults are symmetric.
- The unused `GProps.clipFillRule` declaration was removed; clipping belongs to `clip`.
- Layer prop and dimension changes are tested on one persistent mounted Canvas.
- Empty paths/lines paint nothing. Negative geometry and malformed SVG strings follow the browser Canvas/`Path2D` implementation rather than a CRC validation layer.

These decisions are summarized in the [drawing-component contract](../../design/drawing-components-contract.md).

## Legacy branch review

The committed line tests were retained and strengthened with deterministic empty/single-point, update, pixel, and helper-default assertions. `origin/jess/tests-for-utils` was reviewed selectively rather than merged: its old runner/config/lock changes and unrelated component edits are stale, while useful intent around line construction, transparent paint, pixel alignment, and shallow dependencies was recreated against the current public contracts. The branch's skipped single-point line expectation became an explicit safe move-only/no-pixel contract.

## Surprises, flakes, and rejected approaches

- `alpha: 0` failed in three different ways: truthiness checks in `path`/`img`, and no application at all in `text`.
- A fitting wrapped line could render nothing because only overflow boundaries flushed lines.
- `Path2D.rect(..., Infinity)` creates no useful clip subpath, so the old default clip height could hide all text.
- Text looked correct but its hit rectangle began at the raw center anchor, missing visible glyphs to the left and above.
- The old image alignment changed only border/hit geometry, and the rectangle helper added an extra pixel even for `none`.
- The first combined visual was rejected after repeat runs exposed presentation-level resampling. Native Canvas baselines were smaller, more stable, and easier to diagnose.
- Screenshot-only ellipsis/wrap checks were rejected as sufficient evidence once the glyph masks were reviewed. Controlled Canvas-call assertions now pin exact layout output.
- Exhaustive pixel modes, nested clips/layers, destructive image races, and malformed boundaries remain focused tests or trusted laboratories rather than cluttering readable teaching examples.

## Helper and tooling opportunities

Recurring friction reinforces four TFC-10 candidates:

1. a shared controlled Canvas-command recorder for `Path2D`, text, transforms, and image arguments;
2. a native-Canvas visual helper that standardizes per-scenario naming, font/decoded-image masks, drills, and expected/actual/diff paths;
3. a catalog contract helper that asserts API-tag completeness, action/source parity, and documentation-candidate organization;
4. a deterministic decoded-image fixture with explicit settlement and interior-pixel helpers.

The five lessons themselves are product examples, not test tooling. Any reusable helper should remain internal until its call shape recurs across multiple future steps.

## Follow-ups

- TFC-10 owns CI enforcement, catalog indexing, current supported-status prose, and the final clean-checkout trust command.
- Canvas text remains system-font/platform rasterized and has no DOM accessibility or rich-text semantics.
- Image CORS/taint policy remains the browser's responsibility.
- The two `RUN_TIMING` cases remain intentionally opt-in because noisy wall-clock budgets are governed by the documented performance cadence; their structural assertions run on every normal suite.
