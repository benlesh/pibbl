# Four-corner path warp implementation plan

> **Historical status: Design or implementation record; current behavior is defined by runtime contracts.**

Status: implemented and focused verification passed, 2026-09-30. Aggregate
feature completion remains pending shared-checkout gate failures recorded below.

## Authorized combined delivery

The user requested full completion, self-review, fixes, commit, merge to main,
and push. When asked about the shared checkout, the user explicitly selected
**all current work** and authorized coordination with the active chats. Preserve
the concurrent work, finish it, then verify a stable combined snapshot before
committing. Do not represent warp-only verification as combined verification.

The accepted warp demo remains unchanged. Additional user acceptance feedback
requires a discoverable standalone Bend Along Path example whose edited guide
updates the bent geometry, plus draggable controls in the Bend Along Arc example.
The path-bending chat owns these changes and their focused interaction tests.

Final delivery evidence must identify the combined commit, integration with the
latest main, a passing aggregate trust gate for the integrated tree, and the
remote main commit after push. No commit, merge, or push is claimed yet.

Combined integration review corrected stale editor declaration and scenario
catalog expectations for textures and Three picking. Both suites passed together
(141 tests). The combined browser checkpoint passed 3,225 tests with four
failures: those two stale expectations, Three application-resource collection
including private picking copies, and the concurrently unfinished flow slice.
The Three owner repaired the resource selection while retaining exact counts and
exactly-once disposal assertions; its eight focused tests passed.

The Filters visual mismatch was reproduced as route-order contamination:
direct Filters capture differed by 1,556 navigation pixels, whereas Learn then
Filters in one page differed by 17,716 pixels including Canvas font changes.
Fresh browser contexts per route remove the 16,160 Canvas-text differences,
confirmed by rerunning Learn then Filters. The remaining 1,556 pixels were
inspected in expected/actual/diff images and are new lesson links and numbering,
with zero changed pixels in the Canvas region. Refresh the navigation baseline
after the final standalone bending examples settle; do not accept font drift.

**Goal:** Deliver public `warpPath()` and an interactive Studio rocket demo with
four draggable corner handles and live Bilinear/Perspective switching.

**Design:** [Approved path warp design](../specs/2026-09-30-path-warp-design.md).

**Architecture:** An explicit, synchronous geometry utility returns independent
Move/Line/Close geometry. Internal homogeneous Bézier spans support bounded
approximation after bilinear or perspective mapping. Existing Path, Clip,
conversion, interaction, revision, and scheduling boundaries remain unchanged.

**Environment:** Node 24.15+ on Node 24 LTS, pnpm 11.21.0, Vitest with Playwright
Chromium. Record actual versions with execution evidence.

## Execution agreements

- Preserve the substantial existing working-tree changes, including the current
  PathGeometry implementation and other plans. Inspect each integration point
  before editing; never reset or commit unrelated work.
- Add a focused failing public-API test before each behavior change. Supplement
  with internal mathematical tests only where they establish a needed bound.
- Work inline by default. Independent review may be delegated after feedback
  when it offers a concrete benefit; do not launch overlapping implementation
  or review work before the first slice is usable.
- Deliver bilinear first, collect hands-on feedback, then deliver perspective.
  A bilinear-only preview is explicitly incomplete. Do not advertise or silently
  substitute an unimplemented perspective mode.
- Keep the first slice mathematically sound. A sampled heuristic or moving
  control points is not an acceptable temporary replacement for the approved
  approximation contract.
- Do not run the aggregate trust gate or polish all documentation before the
  first feedback milestone. No implementation is performed by writing this plan.

## File and integration map

New files, with internal splitting kept proportional to actual complexity:

| File                                                            | Responsibility                                                                |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `packages/core/src/lib/geometry/path-warp.ts`                   | Public types, option validation, mapping, source traversal, output collection |
| `packages/core/src/lib/geometry/path-warp-bezier.ts`            | Private homogeneous span math, composition, conservative bounds, subdivision  |
| `packages/core/test/path-warp.test.ts`                          | Public semantic, numeric, ownership, and failure contracts                    |
| `packages/core/test/path-warp-integration.test.tsx`             | Public rendering, clipping, targeting, and export integration                 |
| `packages/scenarios/src/learning/drawing/path-warp.example.tsx` | Runnable rocket demo through public imports only                              |

Existing integration points:

- `packages/core/src/index.ts`: `warpPath` and the five approved types:
  PathWarpPoint, PathWarpRect, PathWarpCorners, PathWarpMode, WarpPathOptions.
- `packages/core/src/lib/geometry/path-geometry.ts`, `path-arc.ts`,
  `path-utilities.ts`: read canonical segment/current-point behavior and existing
  collector conventions; avoid changing these unless a demonstrated need exists.
- `packages/core/src/lib/focus/public-api.test.ts`: explicit public export list.
- `playground/src/crc-editor-types.txt`: matching editor-visible declarations.
- `packages/scenarios/src/learning-catalog.ts`: public example metadata/loader.
- `packages/core/test/learning-examples.test.ts`: manual example driven headlessly.
- `playground/package-consumer/index.ts` and `runtime.mjs`: declaration and
  runtime evidence through package entries; inspect packed verification tooling
  to ensure the same new capability is exercised in packed consumers.
- `docs/site/api/functions/path-geometry.md`: public utility documentation.
- `docs/design/drawing-components-contract.md`: concise implemented contract
  addition only when the capability is implemented.
- `docs/scenario-index.md`: regenerate using the repository catalog command.

Read current drawing, user-event, and scheduling contracts before modifying demo
interaction. Apply the frontend testing skill when implementing browser QA; this
is an addition to the existing CRC Studio, not a new website or React app.

## Slice 1: bilinear warp with a draggable rocket

### 1. Establish the public observable contract

- [x] Add one focused failing test importing `warpPath` from `@crc/core`.
      Use an offset source rectangle and a non-parallelogram destination.
      Include a diagonal line, a cubic, and a diagonal closing edge so a
      vertex-only implementation fails. Assert mapped endpoints, line-only
      output, final Close, unchanged input contents/revision, and independent
      output. Include an analytically known bilinear line midpoint off its chord.
- [x] Run that test and record the expected missing-export/behavior failure.
      Keep fixtures small; defer the broad edge-case matrix until feedback.

### 2. Implement the minimum complete approximation engine

- [x] Add the approved public option/types and finite numeric validation.
      Snapshot numeric options, require positive source dimensions/tolerance,
      and honor a safe-integer segment cap including Move/Close.
- [x] Represent polynomial spans with homogeneous weight 1. Represent ellipse
      arcs as exact rational quadratic spans of at most a quarter turn, including
      arbitrary ellipse bases. Resolve implicit arc connection edges explicitly.
- [x] Normalize coordinates using the supplied rectangle. For homogeneous
      normalized coordinates U, V, W, form bilinear output numerators from
      A(W-U)(W-V) + B U(W-V) + C(W-U)V + D UV, with denominator W².
      Implement Bernstein multiplication and degree elevation locally, without
      introducing a general symbolic algebra framework.
- [x] For each candidate span, compute a conservative error certificate using
      N - W*L and a certified positive lower bound on W as specified in the
      design. Add narrowly scoped mathematical tests for the certificate where
      necessary. Use iterative subdivision, preserve parameter order, and
      detect nonprogress/overflow before accepting a chord.
- [x] Bound work and depth as well as output segments. Choose and document
      internal constants, fail explicitly at a limit, and never weaken tolerance.
- [x] Traverse every source segment type, map isolated Moves, approximate
      closing edges before Close, and preserve post-Close continuation.
      Return independent line geometry; do not mutate input or schedule work.
- [x] Export the public surface and update the export assertion and Studio
      declarations needed to run the slice. Before perspective is delivered,
      reject explicit perspective requests clearly rather than falling back.

### 3. Make the first slice observable

- [x] Build the asymmetric rocket using PathGeometry: curved nose, swept fins,
      circular porthole contour with a deliberate fill rule/winding. Keep the
      immutable original in mount-owned state and recompute from it on changes.
- [x] Show the subdued original/source rectangle, contrasting warped shape,
      quadrilateral edges, named handles, and Reset. Start with a convex
      non-parallelogram mapping. Bilinear handles may cross or coincide.
- [x] Use CRC pointer capture and root-logical coordinates, with cancellation
      and lost-capture cleanup. Do not copy example clamps that prevent corners
      crossing. Decorative overlays opt out of pointer targeting.
- [x] Publish derived geometry via existing state/signals. Store the last valid
      preview from the update action; do not write signals during rendering.
      Keep any error message tied to the requested corners/mode.
- [x] Add catalog metadata with slug `path-warp`, category Drawing, and public
      source loading. Regenerate the scenario index as required for catalog
      consistency. Keep test-only metadata out of public search.
- [x] Add a focused headless interaction test using the same mounted example:
      drag a handle, assert changed geometry/visible behavior, release capture,
      and Reset. Prefer semantic assertions over a new full-page baseline.
- [x] Run focused geometry/demo tests, typecheck, changed-file lint, and inspect
      the actual Studio route. Start the existing preview command and report its
      actual origin plus `/#/examples/drawing/path-warp`; do not assume a port.

**Milestone: slice ready for feedback.** Provide the exact live URL and ask the
user to drag corners and inspect the rocket, cutout, and closing-edge behavior.
State that perspective switching follows in slice 2. Incorporate experiential
feedback before broad hardening.

## Slice 2: perspective and complete mode switching

- [x] Add a failing public test from a known independent homography with an
      offset source rectangle. Verify corners and an interior point whose
      expected projection differs from bilinear interpolation; verify straight
      lines remain straight. Do not use the implementation solver as the oracle.
- [x] Implement normalized homography solving and strict-convexity validation
      in perimeter order topLeft, topRight, bottomRight, bottomLeft. Accept both
      orientations. Use scale-aware conditioning checks, not an absolute epsilon
      that silently changes coordinates or discards valid small-scale geometry.
- [x] Compose the homography with homogeneous source spans and reuse the same
      approximation engine. Certify denominator sign per span, including Moves
      and closing edges; subdivide inconclusive spans. Opposite homogeneous
      signs on separate contours are allowed. Mixed-sign control weights are
      not themselves proof of a pole.
- [x] Add focused pole/invalid-quadrilateral tests before implementing each
      failure path. Bounded inability to certify throws RangeError; never emit a
      finite chord across a pole, clamp coordinates, or return partial output.
- [x] Add the live Bilinear/Perspective selector. Switching retains the exact
      current corners; Reset restores initial corners and bilinear mode.
- [x] Retain responsive handles on invalid perspective input, show the reason,
      and explicitly label the last successful shape as a previous valid preview.
      Recover as soon as the corners become valid or the mode becomes bilinear.
- [x] Extend the same headless demo test to switch modes without moving handles,
      drag into an invalid perspective arrangement, recover, and Reset.
      Assert mode/corner state plus geometric or visible results, not only text.
- [x] Inspect both modes in the browser, run focused checks, and provide the
      exact running URL for feedback on the complete interaction.

**Milestone: both-mode slice ready for feedback.** The user can manipulate all
four corners and compare modes on the same rocket. This is still distinct from
feature completion below.

## Hardening after experiential feedback

- [x] Extend public tests for identity, affine destinations, reflection,
      extrapolation, nonzero origins, empty/move-only input, repeated Close,
      continuation after Close, distinct contours, and option snapshots.
- [x] Cover loops, cusps, inflections, collinear reversals, skewed/rank-deficient
      arcs, full turns and signed sweeps. Include strong destination magnification
      and independent analytic error evidence. Dense sampling supplements the
      conservative bound; it cannot be its only validation.
- [x] Cover all finite bilinear corner degeneracies; perspective invalid quads,
      finite near-pole curves, pole crossings/touches, distinct contours across
      the pole, and mixed control-weight signs for a finite curve.
- [x] Cover malformed types/modes, nonfinite/overflowing coordinates, invalid
      dimensions/tolerance/caps, exhausted work/output/depth budgets, numerical
      nonprogress, and unchanged input/revision on every failure category.
- [x] Add public integration evidence for Path painting/targeting, Clip, and
      native/SVG export using warped output. Reuse existing integration patterns;
      no new runtime cache or scheduling behavior is needed.
- [x] Measure representative repeated rocket/outline dragging: work, allocation
      where observable, output segment counts, and timing as diagnostic evidence.
      Avoid unstable wall-clock correctness assertions or speculative caching.
- [x] Review the implemented math and changed interaction code once, focusing
      on conservative error bounds, numerical guards, closure, pole handling,
      and immutable ownership. Re-review only fixes or unresolved findings.

## Public compatibility and documentation

- [x] Synchronize runtime exports, declarations, public export tests, and Studio
      editor declarations. Exercise both modes in Bundler/NodeNext and packed
      consumers; ensure built browser tests resolve package builds.
- [x] Extend public PathGeometry documentation with both modes, named corner
      correspondence, destination-space tolerance, extrapolation, line-only
      output, explicit failures, original-geometry recomputation, and demo link.
- [x] Add implemented contract text without claiming topology or stroke-outline
      preservation. Update source-preservation tooling only through its existing
      workflow; do not weaken checks or rewrite history to admit new text.
- [ ] Finish aggregate catalog/docs/search and visual-baseline verification;
      source/built editor parity passed.
      If a navigation addition affects visual baselines, inspect expected,
      actual, and diff images and record the intentional change before updating.

## Verification commands and evidence recording

Run in the documented environment. These are planned commands, not results.
Adapt the focused file list only when actual implementation organization changes.

First-slice focused checks:

```sh
corepack pnpm@11.21.0 exec vitest run packages/core/test/path-warp.test.ts --browser.headless --browser.ui=false
corepack pnpm@11.21.0 exec vitest run packages/core/test/learning-examples.test.ts -t 'path-warp' --browser.headless --browser.ui=false
corepack pnpm@11.21.0 typecheck
corepack pnpm@11.21.0 playground
```

Ensure the demo test name matches the filter and the run actually executes it.
Run ESLint on changed TypeScript files and Prettier on changed documentation.
Run focused export/catalog checks when those integration points change. Once
focused checks pass, avoid repeats without new changes or unresolved failures.

After accepted behavior is hardened, run the geometry/integration files in source
and built modes, then the repository aggregate gate:

```sh
corepack pnpm@11.21.0 build
corepack pnpm@11.21.0 exec vitest run packages/core/test/path-warp.test.ts packages/core/test/path-warp-integration.test.tsx --mode built --browser.headless --browser.ui=false
corepack pnpm@11.21.0 trust
```

Record commands, actual environment, fresh counts/results, manual URL and
observations, review findings/resolutions, and any outstanding limitations here.
Historical PathGeometry verification counts are not evidence for this feature.
If shared-checkout failures block the aggregate gate, isolate and report their
fresh evidence while preserving unrelated work; do not claim a green gate or
feature completion. After corrections, rerun the affected checks and complete
required final verification without repeated speculative broad runs.

## Completion checklist

- [x] Approved public API implements both modes for every canonical segment type.
- [x] Draggable rocket demo supports mode switching, error recovery, and Reset.
- [ ] Final acceptance and aggregate verification; accuracy, numeric limits, ownership, and integration
      evidence complete; review findings resolved.
- [x] Public docs, source/built/packed consumers, and Studio declarations agree.
- [ ] Aggregate trust gate passes in the recorded environment.

Only report **feature complete** after the outstanding aggregate checks pass.
The record below distinguishes verified warp behavior from shared-checkout gaps.

## Implementation evidence — 2026-09-30

### User acceptance and resumed verification

The user accepted the complete interactive demo ("This looks great! Continue").
The visual direction and both-mode interaction are accepted for this feature.
Fresh verification after that feedback used Node 24.15.0 and pnpm 11.21.0:

- Standard repository configuration, all three focused warp suites: 17 tests
  passed. Whole-project `typecheck` also passed.
- `trust` still stops at texture-contract historical provenance registration;
  the new texture contract is absent from the pinned baseline commit.
- `test:studio-visual` built the Studio and reached the Filters comparison,
  which still differs by 17,716 pixels, matching the previously inspected
  shared failure. This run did not change the visual baseline.

Hands-on acceptance is now recorded. Aggregate completion remains pending the
separate documentation and visual gate failures; focused passes do not replace
that gate.

Implemented both modes, all canonical segment types, destination-space error
bounds, pole/conditioning validation, independent output, and bounded failure.
The rocket example has four draggable corners, mode switching that preserves
corners, Reset, a source reference, a warped grid, and an explicitly labeled
previous-valid preview during errors. The bilinear slice was offered for feedback;
no visual change was requested, so the documented visual direction was retained.
The complete preview was inspected at
<http://127.0.0.1:5175/#/examples/drawing/path-warp>.

Fresh verification used Node v24.15.0 and pnpm 11.21.0, Chromium:

- Initial test failed at the missing public `warpPath` export before production
  changes. Perspective, mode-switch, allocation reuse, and exact-line efficiency
  tests were each observed failing before their corresponding implementation.
- Source and built warp suites: 3 files, 17 tests passed in each mode (geometry, public
  paint/clip/target/export integration, structural allocation/work limits).
- Standard-viewport learning-example run filtered to `path-warp`: 3 passed,
  213 skipped. This includes catalog execution plus drag/reset and
  mode-switch/invalid-state-recovery interaction tests.
- All package builds passed. Bundler and NodeNext consumers and runtime probes
  passed. Packed-package verification passed, including both warp modes through
  the installed public entry and runtime export boundaries.
- Changed warp/consumer files passed ESLint. Markdown formatting and diff
  whitespace checks passed. Source/built/Studio editor export parity passed.
- Studio production build passed. Browser QA at 1440 × 1100 and 390 × 844
  showed a rendered canvas without an overlay or console errors. The actual
  sandboxed canvas was exercised through mode switching, crossed corners,
  recovery, and Reset. The narrow view scales the existing fixed-size lesson
  canvas; desktop is preferable for manipulating its handles.
- Lifecycle phase: 32 passed. Existing structural performance phase: 48 passed,
  4 intentionally skipped. These are fresh results, not historical totals.
- Approved contract-preservation addition validated directly: 667 historical
  baseline units, 824 current units, 56 evidence mappings. That direct check did
  not claim Git provenance verification. No historical unit was replaced.

Focused early runs used `/tmp/crc-warp-vitest.config.mts`, inheriting repository
configuration with isolated discovery/cache, because unrestricted discovery tried
to bundle a native fsevents dependency from unrelated work. Later demo checks ran
with the unmodified repository config. The focused temporary configuration also
used a 1200 × 850 viewport; final demo tests passed the normal 800 × 600 viewport
by clicking a visible point inside Reset rather than outside the viewport.

### Algorithmic performance and effectiveness

For fixed maximum degree six, composition and subdivision cost is linear in
input spans plus visited subdivision nodes. Accepted balanced trees visit roughly
twice their output chord count. Numerical certification may add depth near poles;
both depth and total work have hard limits. Output storage grows geometrically.

Review identified fresh-array allocation at every split. It was replaced with a
call-owned depth-first pool of at most 53 curve frames, reusing each frame's three
coordinate buffers across all input spans, plus one scratch buffer. No pooled
references escape or persist across calls. An executable test processes over
10,000 emitted chords while checking exact buffer identities remain unchanged.
The work cap is min(4,000,000, 2 × maxSegments + 53); depth is capped at 52.
The demo also requests a 20,000-segment cap per artwork path.

Perspective degree-one spans take an exact chord shortcut only after checking
finite endpoints and same-sign weights: this preserves the locus and monotonic
traversal without subdividing nonlinear parameter spacing. Bilinear diagonals
still subdivide. A public test locks a two-segment budget for a projected line.
An analytic test bounds the entire amplified bilinear diagonal rather than merely
sampling it. Arc/cubic sampling supplements the conservative Bernstein proof.

Diagnostic benchmark: 40 elliptical contours, 160 input segments, 30 warmups,
200 changed-corner evaluations per mode, tolerance 0.3. Final output counts were
1,281 bilinear and 1,306 perspective; median/p95 times were approximately
0.6/0.7 ms and 0.4/0.5 ms respectively. These are local observations, not portable
performance guarantees or correctness thresholds. Pooling did not measurably
improve this small workload's timing; its verified benefit is bounded transient
storage. The small rocket's initial bilinear preview uses 182 total segments.

One independent math/performance review found the allocation concern above;
re-review of the buffer reuse, aliasing, limits, and exact-line shortcut found no
remaining material issue. Expanded tests cover arcs, pole contact, mixed control
weights, collinear reversals, overflow, budgets, and post-Close continuation.

### Outstanding shared-checkout verification

`corepack pnpm@11.21.0 trust` was run and is not green. Its initial static phase
stopped at documentation classification for concurrently added path-bending and
texture pages. A later Studio build passed after their type links were supplied.
The complete browser phase ran 274 files: 268 passed, 6 failed; 3,172 tests passed,
7 failed, and 4 skipped. Warp Reset checks initially clicked outside the default
viewport; those tests were fixed and passed a focused rerun. Other failures
involved in-progress path-bending exports, editor declaration counts, catalog
entries for new features, and Three instancing cleanup. A subsequent whole-project
typecheck still saw the in-progress `bendPathAlongPath` export missing.

Shared export/catalog expectation lists were reconciled with the features present
at the time of checking; ongoing unrelated implementation can change them again.
No unrelated implementation was reset or removed. Aggregate verification and
visual baseline review still need to complete once the shared checkout stabilizes;
focused evidence above must not be described as a green aggregate trust gate.

Final visual inspection found 17,716 differing pixels on Filters: 1,556 in
navigation/lesson numbering from the two new drawing entries, and 16,160 in
Canvas text within x401–1163/y659–1211. Expected, actual, and a generated diff
were inspected. The Canvas-text drift matches the previously recorded shared
Filters issue; no baseline was rewritten to accept it. The visual command reached
this comparison after a successful Studio build and tutorial-teaser check.

Final edge-case tests also cover implicit arc connections, rank-zero arcs,
extreme coordinate scales, and redundant closes. A redundant Close previously
consumed output budget although PathGeometry ignores the duplicate; output
accounting now follows canonical emitted segments. Its failing test was observed
before the correction. No mapping algorithm changed in that fix.

### Completion recheck — 2026-09-30

The next goal turn re-read the live checkout and reran the aggregate gate and
whole-project typecheck. The existing path-bending API page was added to the
explicit public-document classification list; this preserves the classification
check and resolves that integration omission. Documentation validation then
stopped because the new `docs/design/textures-contract.md` is being treated as a
historical baseline file even though it does not exist at the pinned baseline
commit. Correctly incorporating that separate contract requires its own approved
post-baseline mapping; provenance checks were not disabled.

Typecheck now reports five missing `ComponentObservation.layout` properties in
`agent-signal-observation.test.tsx`, an observation feature outside path warp.
The preview listener at 127.0.0.1:5175 was confirmed live. Warp completion remains
unclaimed until the aggregate gate passes; the warp implementation/performance
and focused test evidence above is unchanged.

### Blocked completion audit — 2026-09-30

On the third consecutive goal turn encountering the shared aggregate-verification
blocker, whole-project typecheck now passes. The documentation gate still fails
while loading `docs/design/textures-contract.md` from the pinned historical
baseline commit, where that new file does not exist. This requires the separate
texture contract's approved post-baseline integration; the warp's approved
mapping is already validated. No provenance check or baseline was weakened.
The previously inspected Filters visual drift also remains unaccepted.

The warp code, demo, focused source/built tests, package evidence, and performance
review are delivered. Goal status is blocked on shared aggregate verification,
not complete. Resume after the texture-contract integration and outstanding
shared visual/gate issues are resolved. The preview listener was confirmed live
at 127.0.0.1:5175 in this audit.
