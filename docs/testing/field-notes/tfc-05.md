# TFC-05 field note — event geometry and composition

> **Historical status: COMPLETED FIELD RECORD.** Results are dated evidence and are not current API guidance or current test totals.

Date: 2026-08-11

## Scenario and risk

The cataloged Geometry composition matrix drives the same public-API scene through root fill boundaries, half-size CSS presentation, nested translation/rotation/scale/skew, intersecting clips and an `evenodd` hole, root/layer paint order, transformed custom-size nested layers, and a transformed stroke interaction width. Every case supplies positive, boundary where applicable, and negative probes whose expected target and exact RGBA pixel come from the shared scenario definition.

The risks were disagreement between rendered and interactive coordinates, CSS pixels leaking into `PibblMouseEvent.x/y`, nested clips behaving as a union, transforms being applied in the wrong order, independent layer dispatchers double-firing or competing for hover/cursor state, layer dimensions failing to crop descendants, and a visually unpainted interaction width becoming nondeterministic at its boundary.

## Manual and headless method

The gallery and browser suite both lazily load `geometry-composition-matrix`. The scenario keeps a 480×240 intrinsic Canvas, changes only the documented CSS presentation size, exposes the selected case and root coordinates, records ordered event routes, and offers case selection, trace clearing, and reset controls.

Manual review used the Codex in-app Chromium browser on macOS at a 1280×720 viewport and device-pixel ratio 1. The complete gallery path was exercised:

- root and CSS-scaled fill centers and left edges selected `fill` with a pointer cursor; the immediate outside probes stayed inert;
- the blue transformed quadrilateral selected only `transformed`; its clipped-away and clear-background probes emitted no hit;
- only the visible nested-clip intersection selected `clipped`; the outer-only, inner-only, and central-hole probes stayed inert;
- the left-to-right layer sweep produced `root-under → layer-one → root-middle → layer-two`, with `mouseout` before each `mouseover`, then `mousemove`, and `default → pointer → crosshair → grab` cursor parity;
- the nested green layer selected and clicked `nested-layer` exactly once; its cropped continuation and orange base selected `layer-base`, while the original unshifted location stayed inert;
- the stroke's painted center and the manually reachable inside neighbor selected `stroke`; the outside neighbor missed without painting any wider line;
- Reset restored Root fill boundaries, an empty trace, no target or coordinates, the 480×240 CSS size, and a blank cursor.

The first gallery attempt exposed a missing static source adapter for the new scenario; commit `3d75b9d` added it. After a clean restart, the gallery produced no warning or error logs. Its visible Canvas, case label, trace, target, coordinates, dimensions, action, and cursor were inspected together rather than treating interaction output as a hidden test value. The Baseline smoke scenario was also dragged from Canvas background `(460, 210)` to its rectangle `(120, 108)`; click count remained 0 and last action remained `mount`.

Headlessly, `packages/core/test/geometry-composition.test.ts` imports that same scenario. Eight semantic tests drive every matrix case through raw Chromium input, assert the exact route and intrinsic coordinates, check cursor ownership, and compare every declared pixel probe with exact RGBA. The completing session repeated those eight interaction tests in 20 independent runs: 160/160 passed, with zero retries or assertion failures. The combined semantic/visual file passes 15/15 after the visual comparisons described below were added.

The current same-target activation rule was also checked against the reported background-start gesture. Raw Chromium input that presses on Canvas background and releases on the target does not emit Pibbl `click`, in both the interaction laboratory and baseline smoke scenario. The regression asserts that the stored down target is absent, the up target is the region, the click is rejected, and activation state is cleared; no production exception was added.

## Visual strategy and stabilization

All seven matrix cases have separately named, text-free PNG baselines. The captures compare the Canvas element itself, so gallery typography and diagnostic layout are outside the image contract. Stabilization comes from the repository browser configuration and scenario:

- 900×700 test viewport, device-pixel ratio 1, light color scheme, reduced motion, UTC, `en-US`, sRGB, and disabled font-render hinting;
- fixed 480×240 intrinsic dimensions and either 480×240 or 240×120 CSS dimensions;
- solid fixed colors, no text, fonts, animation, clock, random input, or external fixture;
- zero ignored regions, zero channel tolerance, and an exact-pixel comparison;
- per-case expected, actual, and diff paths under the TFC-05 scenario/case name.

Every initial candidate was inspected before approval. The images showed the expected blue root rectangle and half-scale equivalent, clipped blue quadrilateral, blue intersection with a transparent `evenodd` hole, four global paint-order color bands, cropped green nested layer over orange, and the two-pixel painted blue stroke. Those reviewed candidates became the committed baselines; the test never writes or updates the source baseline.

Targeted Canvas probes remain the primary boundary proof. The screenshot catches composition-wide drift, while exact RGBA and target/state assertions distinguish visible paint from wider interaction geometry.

## Deliberate visual-diff drill

After a green exact comparison, one test-only drill painted a 60×50 pink rectangle at intrinsic `(210, 20)` in the compound-transform case without changing the approved baseline:

```sh
VITE_PIBBL_GEOMETRY_VISUAL_DRILL=1 corepack pnpm@11.21.0 exec vitest run packages/core/test/geometry-composition.test.ts --browser.headless --browser.ui=false
```

The run failed only that case: 14 passed, 1 failed, 3,000 pixels differed, and the maximum channel delta was 178. The expected artifact showed only the blue clipped quadrilateral; actual added the pink rectangle; diff preserved the quadrilateral in gray and marked precisely the new 60×50 area red. All three artifacts were inspected. The drill output was not accepted, the environment flag was unset, and the normal command returned to 15/15 green.

## Completed evidence

The visual work ran on macOS 26.5.1 arm64 with Node 24.19.0, pnpm 11.21.0, Vitest 4.1.10, Playwright 1.62.1, and Chrome for Testing 151.0.7922.34.

Exact commands and results for this slice, after selecting Node 24.19.0, were:

```sh
corepack pnpm@11.21.0 exec vitest run packages/core/test/geometry-composition.test.ts --browser.headless --browser.ui=false
# 1 file, 15 tests passed

corepack pnpm@11.21.0 exec eslint packages/core/test/geometry-composition.test.ts
# passed with no output
```

The focused exact comparison passed before and after the deliberate failure drill. No tolerance, ignored region, baseline rewrite, retry, or snapshot-update mode was used. The final complete browser suite passed 19 files with 148 tests passed and 2 pre-existing Layer render-optimization skips. Full lint/format, TypeScript, package builds with source maps, Bundler and NodeNext consumer checks, and both source-mode and built-package gallery builds also passed.

## Platform evidence and decisions

The current [WHATWG Canvas specification](https://html.spec.whatwg.org/multipage/canvas.html) makes each new clip an intersection with the current clipping region, applies the current transform to paths and drawn images, treats path/stroke boundary points as inside, and defines hit-test coordinates in Canvas space rather than retroactively transforming the supplied point. The [CSSOM View MouseEvent coordinate definition](https://drafts.csswg.org/cssom-view/#extensions-to-the-mouseevent-interface) keeps `clientX/Y` in viewport CSS coordinates. Pibbl therefore maps the root client point through the Canvas bounding box into intrinsic width/height space once, then composes transforms, clips, and layer bounds during target resolution.

Pibbl-specific composition decisions are:

- every active clip must contain the point, including `evenodd` holes;
- one root dispatcher owns hover, activation, observer, and cursor state across root and nested layers;
- each Canvas instance retains stable local paint entries, and layer entries are recursively composed at their actual `drawImage` slot;
- target selection walks the global composition in reverse paint order and returns one stable leaf region;
- layer bounds crop interaction exactly as they crop pixels;
- root intrinsic coordinates remain public even when the winning target lives in a transformed nested layer.

These choices preserve TFC-04's approved exit-before-entry and same-live-target activation behavior instead of creating a second event model for layers.

## Surprises, flakes, and browser differences

- The in-app pointer controller quantizes screen coordinates to integer pixels. The gallery Canvas sat at a fractional vertical offset (`.375` CSS pixel), so the half-scale center requested at intrinsic y=120 reported y=119, and an exact stroke-boundary request at y=110 landed 0.375 intrinsic pixel outside even though the rounded diagnostic displayed 110. The manual run therefore verified y=111 inside and y=109 outside; the raw-CDP headless driver, which accepts fractional screen coordinates, remains the exact inclusive y=110 oracle. This is manual-controller precision, not a Pibbl behavior difference.
- CSS scaling changes the screenshot dimensions from 480×240 to 240×120. Keeping that case separate avoids silently resizing images before comparison and proves the gallery actually presents the smaller Canvas.
- The 20-run interaction loop occasionally selected another available local server port. Case assertions and artifacts were unchanged; this was port allocation, not a test retry or product flake.
- The user-reported background-down/target-up activation was not reproducible on the current dispatcher. Exact raw-input regressions now make that invariant visible in both the laboratory and smoke test.
- No browser rendering flake, comparison drift, or ordering variation occurred in the reviewed runs.

## Failed or rejected approaches

- Rejected one full-gallery screenshot because diagnostic text introduces font variability and makes a single mismatch hard to attribute. Per-case text-free Canvas images preserve exact comparison and useful case names.
- Rejected screenshot-only confidence. Pixel probes assert the geometry at the exact hit/miss coordinates, and route/state assertions prove non-visible ordering, coordinates, and cursor ownership.
- Rejected a broad visual tolerance or ignored antialiasing region. The fixed-color Canvas output compared exactly in the controlled Chromium environment.
- Rejected accepting the deliberate pink drill as a new baseline. It exists only to prove the failure path and useful diff.
- Rejected independent layer event bridges and per-layer hover state because they cannot preserve one global target, route, activation identity, and cursor.
- Rejected cloning projected child regions into a root registry. Recursive composition keeps stable leaf identity and avoids synchronization between projected copies and live layer entries.

## Helper and tooling friction

The visual helper requires four related paths for every case, and bootstrapping a legitimate baseline still means running once for candidates, inspecting each image, and then copying only approved files. That ceremony is useful as a safeguard but repetitive for a matrix. The browser screenshot clip API also used page-relative rather than viewport-relative coordinates during the scrolled manual review, so state/cursor checks and the existing exact Canvas captures were more reliable than an extra clipped manual artifact.

Candidate tools:

1. a table-driven scenario visual helper that expands one scenario/case ID into expected, actual, and diff paths without adding baseline-update behavior;
2. a contact-sheet reviewer for initial text-free candidates that preserves access to each original-resolution image;
3. a manual probe overlay that displays requested client, actual client, and derived intrinsic coordinates so pointer-controller quantization is explicit;
4. a shared geometry probe driver that records pixel, target, cursor, and ordered route from one public scenario point.

## Decisions and follow-ups

- The implemented behavior is recorded in the [Pibbl mouse interaction contract](../../design/mouse-interaction-contract.md).
- Exact, per-case text-free images are the composition contract; exact RGBA/state probes remain the boundary contract.
- The matrix is a trusted test laboratory rather than a documentation candidate, but its source remains presentation-neutral for the gallery, browser tests, and future diagnostics.
- TFC-06 should benchmark the recursive global resolver as implemented and optimize only measured hot paths without weakening composition or activation identity.
- TFC-07 should keep the root-owned interaction state and nested paint-entry ledgers at baseline through repeated layer removal and whole-runtime cleanup.
