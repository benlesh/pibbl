# PathGeometry implementation plan

<<<<<<< HEAD
=======
> **Historical status: IMPLEMENTATION PLAN.** This dated execution record is historical evidence; current contracts and tests define shipped behavior.

>>>>>>> origin/main
**Goal:** Deliver editable public path geometry in observable vertical slices.

**Architecture:** Private packed buffers hold canonical geometry; fresh conversion
helpers produce native/SVG output. CRC resolves geometry at its input boundaries.
Mutation revisions allow private native caching after the first slice.

**Tech stack:** TypeScript, Canvas Path2D/DOMMatrix, CRC JSX, Vitest Chromium;
Node 24.15+ and pnpm 11.21.0.

**Spec:** [Approved design](../specs/2026-09-29-path-geometry-design.md).

Execution is inline. Repository slice-first instructions override skill advice
for another approval handoff, per-task reviews, or broad verification before
experiential feedback. Preserve unrelated changes; do not commit them.

## Slice 1: editable cubic outline

Files:

- `packages/core/src/lib/geometry/path-geometry.ts`: packed storage, revision,
  Move/Line/Quadratic/Cubic/Close construction, clone, clear, segment get/set,
  2D affine transform, allocation-free internal traversal.
- `packages/core/src/lib/geometry/path-conversion.ts`: fresh `toPath2D` and
  `toSvgPathData`, with an internal traversal bridge that exposes no buffers.
- `packages/core/src/index.ts`, `lib/style/types.ts`, `lib/components/path.ts`:
  public exports and Path input resolution once for paint and interaction.
- `packages/core/test/path-geometry.test.tsx`: public conversion, editing,
  scheduled paint/hit geometry, and independent old snapshots.
- `packages/scenarios/src/learning/drawing/path-geometry.example.tsx` and
  `learning-catalog.ts`: draggable control point, transform preview, SVG data.

Interfaces: `PathGeometry`, `PathSegment` discriminated by `type` with named
coordinates; `revision`, `segmentCount`, `getSegment`, `setSegment`, `clone`,
`clear`, `transform`; fresh `toPath2D` and `toSvgPathData` functions.

- [x] Add a failing public test: construct closed cubic, export independent native
      and SVG paths, edit control points and transform, then verify scheduled Path
      painting and hit tests use the new geometry while previous snapshots stay put.
- [x] Run the test and observe missing-public-export failure.
- [x] Implement the focused geometry and Path integration. Do not imply that
      Canvas arcs, Clip/hooks, addPath, splice, or utilities are implemented yet.
- [x] Add Studio example and catalog entry, drive its dragging headlessly.
- [x] Run focused browser tests, typecheck and changed-file lint; provide the
      exact URL and ask for experiential feedback before expanding scope.

## Later slices after feedback

- [x] Complete builders and editing: arc basis representation, full CanvasPath
      parity, addPath and splice; test degenerate/self-add/nonfinite cases first.
- [x] Complete native/SVG arc conversion including singular transforms; assert
      reflected/singular traversal, full-circle splitting, and round-trip geometry.
- [x] Add Clip and public hook union inputs with private identity/revision native
      caching. Test independently scheduled roots and registration snapshots, and conversion
      reuse across paint and hit testing; pointer dispatch retains native paths.
- [x] Add flatten, simplify and subdivide utilities with finite-segment error
      bounds, closure preservation, bounded output and explicit failures; test loops,
      backtracking, degenerate contours and error accumulation.
<<<<<<< HEAD
- [ ] Harden docs, packed consumers, NodeNext/Bundler declarations, source/built
=======
- [x] Harden docs, packed consumers, NodeNext/Bundler declarations, source/built
>>>>>>> origin/main
      modes and Studio declarations. Review changed code, then run proportional
      final verification and aggregate trust gate before feature completion.

Review focus: mutable snapshot ownership; failed edits must be atomic; matrix
alias/3D handling; closed-contour current-point semantics; output-limited curve
processing. These belong to the tests in their owning slices above.

## Slice 1 evidence — 2026-09-29

- Node v26.9.0 was available (not the documented Node 24 LTS environment).
- `corepack pnpm@11.21.0 exec vitest run packages/core/test/path-geometry.test.tsx packages/core/src/lib/components/path.test.ts --browser.headless --browser.ui=false`: 2 files, 6 tests passed in Chromium. Initial run failed for missing PathGeometry export as expected.
- `corepack pnpm@11.21.0 exec tsc --noEmit`: passed.
- Changed TypeScript/TSX files passed ESLint; changed Markdown passed Prettier.
- Studio's separate `playground/src/crc-editor-types.txt` declarations required
  extending for the new class, segment type, helpers, and Path input union.
- Preview: `http://127.0.0.1:5184/#/examples/drawing/path-geometry`.
- Deferred: arcs/other builders, splice/addPath, Clip/hooks, native caching,
  geometry utilities, full package-consumer evidence and trust gate.
- `corepack pnpm@11.21.0 --filter @crc/core build`: passed.
- `node tooling/verify-studio-pivot.mjs`: passed after rebuilding core; source,
  built, and editor declarations have exact public export-name parity.
- Studio was inspected in the in-app browser: live canvas renders both shapes,
  SVG text is visible, and the editor reports no TypeScript issues.

## Post-feedback implementation and evidence — 2026-09-29

The user accepted the runnable first slice. Completed Canvas builders, affine arc
representation/conversion, segment splicing, private revision caching, Clip/event/
cursor inputs, particle asset snapshots, and flatten/simplify/subdivide utilities.
The live example now cycles through all three utilities. Public docs and Studio
declarations cover the completed API. Review found and fixed post-close
simplification continuation; re-review found no remaining material issues.

Fresh verification used Node v24.15.0 and pnpm 11.21.0:

- Focused source-mode geometry/integration/particle tests: 4 files, 48 passed.
- Built-mode geometry plus smoke: 4 files, 18 passed.
- Learning-example catalog and execution: 209 passed; public export surface: 4 passed.
- Typecheck, package builds, strict Bundler/NodeNext consumers, runtime consumer,
  packed consumer gate and package entries: passed.
- Lifecycle: 31 passed. Structural performance: 48 passed, 4 intentionally skipped.
- Studio production build, public documentation/navigation/search acceptance,
  and changed-code ESLint: passed.
- Documentation preservation validation: approved additions recorded without
  changing historical units; 974 mutation probes passed.

Aggregate verification is not green in this shared checkout. Independent agent-
verification work currently fails browser import of node:crypto and a capture-drag
action test, and two unrelated Markdown files fail formatting. Documentation check
also encounters an unrelated component-manipulation plan without a historical
banner. Those files were preserved. The initial full browser run had 3041 passing
tests; PathGeometry-related catalog/export failures were corrected and rerun.

Studio visuals: inspected and updated only the Filters baseline for the new
Path geometry navigation row and lesson number 21 → 22 (1,841 changed pixels).
Filters passes in isolation; the other seven routes pass together. The full
sequence still exposes Canvas-text drift in the Filters gallery (16,160 pixels,
within x401–1163/y659–1211), absent in its isolated run. That additional drift
was not accepted into the baseline. Aggregate feature completion remains pending
resolution of these shared-checkout verification failures.
<<<<<<< HEAD
=======

## Final integration — 2026-09-30

Feature complete. Isolated PathGeometry from the shared checkout and integrated
origin/main at 6d372f0d, preserving component manipulation, positioning, and pie
APIs. Updated the example to use left/top positioning. Resolved documentation
snapshots, declaration inventories, and catalog counts for the combined surface.

The Filters visual mismatch was reproduced after earlier routes in the same page;
iframe font/paint waiting and forced redraw did not remove it. Capturing that
sandboxed Canvas route in a fresh page did. The baseline contains only the
inspected navigation-row and lesson-number change. SPA navigation remains covered
by Studio documentation acceptance. Full eight-route visual runs now pass.

Fresh aggregate verification: `corepack pnpm@11.21.0 trust`, Node v24.15.0, exited 0. This includes 979 documentation mutation probes, typecheck and formatting,
source/built Studio and package builds, packed consumers, 3,148 browser tests
(4 intentionally skipped), documentation/search acceptance, visual safeguards,
all eight Studio baselines, built smoke, 43 lifecycle tests, and 49 structural
performance tests (4 intentionally skipped). No visual mismatch was waived.
>>>>>>> origin/main
