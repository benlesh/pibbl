# Path bending implementation plan

Status: feature complete, integrated, and pushed to main, 2026-09-30. The user approved the
[design](../specs/2026-09-30-path-bending-design.md) and requested implementation.
Both Along Arc and Along Path remain the completion target.

## Scope and ownership

Implement the approved public functions and types in `@crc/core`, returning
independent line geometry, with explicit source frame, start/center/end alignment,
source baseline, fitting, offsets, overflow policy, output accuracy, and budgets.
Preserve source contours and complete closing edges, input revisions, and current
paint/clip/hit snapshot and scheduling semantics. Keep sharp guide corners/cusps
outside this approved version, as specified in the design.

The shared checkout contains active PathGeometry, four-corner warp, text geometry,
and verification work. Preserve those changes. Use new bending-specific source,
test, example, and documentation files; make additive edits at shared exports,
catalogs, declarations, and consumers after rereading their current contents.
Do not refactor another thread's geometry engine to get the first slice working.

## Slice 1: Along Arc

- [x] Add and run a focused failing public-API test: a rectangle becomes an
      annular sector, numeric baseline and centered placement are exact, closing
      edge bends, output chord sag stays within tolerance, input is unchanged.
- [x] Implement types and numeric validation, placement formula, analytic circle
      position/normal/length, and error/extend/wrap behavior.
- [x] Traverse canonical source segments including implicit arc connections,
      closing edges, and post-Close continuation. Use conservative source bounds
      and adaptive approximation in output coordinates. Include work/depth and
      numerical-nonprogress guards, in addition to the segment budget.
- [x] Add runtime exports, the export assertion, and Studio editor declarations
      needed to author and execute the slice.
- [x] Add public Studio example `drawing/path-bending` showing original geometry,
      direction, baseline, bent result, alignment/fit/offset controls, errors,
      and Reset. Recompute from original geometry on user changes.
- [x] Drive the same example headlessly; check focused tests and TypeScript;
      inspect the live Studio route and one meaningful interaction in Chromium.
- [x] Provide the actual Studio URL as **slice ready for feedback**.
- [x] Incorporate feedback: separate Along Path discovery and add draggable
      center/radius/sweep controls to Along Arc. Aggregate verification remains separate.

## Slice 2: Along Path

- [x] Establish a conservative numerical feasibility result for regular cubic
      guides: bound length inversion, position, unit normal, and source chord
      error together. Normal error grows with distance from the baseline.
- [x] Add focused failing public tests for uneven-parameter-speed guides and a
      source curved/closing edge, with independent expected geometry.
- [x] Implement one smooth contour measurement, directed tangent continuity,
      zero-length handling, removable stationary points, finite work budgets,
      full guide validation, and explicit rejection of corners/cusps.
- [x] Support canonical guide lines, quadratics, cubics, and general ellipse arcs;
      preserve branch choice by arc length at crossings and closed seams.
- [x] Reuse common placement/source/output infrastructure with specialized guide
      evaluation. Handle nonmonotonic source X across segment/extension/wrap
      boundaries without shortcuts that lose traversal.
- [x] Add editable smooth cubic guide, expose the second public function/types,
      and test the interaction. User feedback subsequently split this into the
      standalone `drawing/along-path` example.
- [x] Show the runnable second slice and incorporate experiential feedback.

## Hardening and delivery

- [x] Cover design evidence matrix: every segment kind, contour/Close semantics,
      fitting and signed offsets, source-frame origins/zero height, source outside
      frame, stationary guides, rejected discontinuities, wrapping/repeated laps,
      folds/collapse, precision extremes, overflow/work budgets, empty inputs,
      option errors, and input/output independence.
- [x] Verify analytical bounds with independent geometric oracles. Dense sampling
      is supplemental; it does not establish a guaranteed tolerance alone.
- [x] Exercise Path paint, Clip, targeting, SVG/native conversion, and existing
      scheduling through the supported public surfaces.
- [x] Synchronize documentation, runtime/types, Studio declarations, export tests,
      Bundler/NodeNext consumers, packed consumers, and source/built browser tests.
- [x] Review changed math and interactions once; resolve material findings and
      re-review only fixes. Measure representative work/output, not uncontrolled
      wall-clock performance as a correctness gate.
- [x] Run proportional final verification and `corepack pnpm@11.21.0 trust`.
      Record actual environment and fresh output. Shared-checkout failures must
      be identified and resolved or reported; never claim an unrun/failed gate.
- [x] Audit every approved requirement before reporting **feature complete**.

## Planned focused verification

```sh
corepack pnpm@11.21.0 exec vitest run packages/core/test/path-bending.test.ts --browser.headless --browser.ui=false
corepack pnpm@11.21.0 exec vitest run packages/core/test/path-bending-integration.test.tsx --browser.headless --browser.ui=false
corepack pnpm@11.21.0 typecheck
corepack pnpm@11.21.0 scenarios:check
corepack pnpm@11.21.0 playground
```

Use ESLint on touched TypeScript and Prettier on touched Markdown. After feedback,
run the expanded tests in source and built modes, package compatibility checks,
then the aggregate gate. Re-run checks only after relevant changes or failures.
Keep temporary screenshots/scripts outside the repository.

## Execution evidence

- Initial inspection: existing PathGeometry utilities return independent geometry;
  Along Arc and Along Path are not exported. Active warp work has its own plan
  and failing test, so bending uses separate files.
- Initial shell environment: Node v26.9.0, pnpm 11.21.0. Locate the documented
  Node 24 LTS runtime before final verification; do not claim the default runtime
  matches the repository's documented environment.
- Located Node v24.15.0 with fnm; subsequent checks use
  `fnm exec --using=24.15.0` and pnpm 11.21.0.
- Public geometry test first failed on the missing `bendPathAlongArc` export.
  The integration test first failed on the missing example module.
- Along Arc implementation now lives in `path-bending.ts` and
  `path-bend-spans.ts`. The second-derivative certificate bounds the full mapped
  curve against its parameter-matched chord, including a curved Close edge.
  Crossings of tangent-extension boundaries use a first-derivative bound.
  Internal guards are 2,000,000 span visits and subdivision depth 52.
- Two focused Chromium tests passed (annular geometry/closing-edge accuracy and
  example baseline/stretch/Reset interaction). ESLint passed on the new source,
  tests, and example. Prettier formatted the three bending Markdown files.
- Typecheck passed after the initial slice. A later rerun caught concurrent
  `path-warp.test.ts:102-103` narrowing errors, with no bending-file errors;
  preserve that other thread's edits and recheck at the next appropriate gate.
- Standard Vitest startup encountered unrelated dependency discovery attempting
  to bundle native `fsevents.node`. Focused verification uses
  `/tmp/crc-path-bending.vitest.config.mts`, importing the normal config with
  **all normal plugins retained**, a separate temporary cache, and test discovery
  restricted to bending tests (plus the public export suite for its check).
  This is focused evidence, not an aggregate trust-gate pass. An earlier red-test
  run also omitted the docs plugin while concurrent warp exports lacked docs;
  that omission is no longer needed or used.
- Catalog generation and verification passed with
  `fnm exec --using=24.15.0 node --import tsx tooling/scenario-catalog.ts --write`
  and the same command without `--write`. Source discovery checks also passed.
  The direct Node/tsx import avoids the CLI's sandbox-blocked IPC listener.
- Live route: <http://127.0.0.1:5175/#/examples/drawing/path-bending>, using an
  existing verified Studio server in this checkout. Chromium inspection found
  the correct title, live preview, no TypeScript issues, no error overlay, and
  no page/console errors. Clicking Baseline changed the live canvas; Reset
  restored its exact initial pixels. Desktop viewport: 1440×1100.
  A 390×844 viewport fits the canvas to 360×279; controls are consequently small
  and this learning example is best inspected on desktop.
- Screenshots are outside the repository at `/tmp/crc-path-bending-before.png`,
  `/tmp/crc-path-bending-after.png`, and `/tmp/crc-path-bending-mobile.png`.
- The first-slice URL and inspection instructions were delivered. Experiential
  feedback is pending; do not equate this slice with full feature completion.
- Final slice rerun: both bending tests passed again. The public export suite
  initially exposed an unsorted `warpPath` entry from the concurrent warp work;
  moving it to its alphabetical position preserved the asserted export set.
  Its focused rerun passed all four tests. Changed shared-file whitespace checks
  also passed. Final aggregate verification remains pending.

## Along Path numerical feasibility and implemented certificate

For a regular smooth guide, a useful extension of the implemented arc bound is
available directly in arc-length coordinates. Write `F(t)=B(s(t))+d(t)N(s(t))`.
If `K` bounds absolute guide curvature and `J` bounds its derivative with respect
to guide distance, then:

```text
|F''| <= (1 + D*K)*|s''| + |d''| + 2*K*|d'|*|s'|
         + (K + D*(J + K*K))*|s'|²
```

Here `D` bounds absolute displacement from the baseline. The source polynomial
or arc span machinery already bounds `s'`, `s''`, `d'`, and `d''`. The output
chord error is at most this bound divided by eight on a local [0,1] span.
Endpoint evaluation error must be added; it cannot be hidden in this bound.

For polynomial guide speed bounded below by `m>0`, acceleration bounded by A,
and third derivative bounded by Q, sufficient regular-span bounds are
`K <= A/m²` and `J <= Q/m³ + 3*A²/m⁴`. These are conservative and may need local
refinement. Matching tangent joins may have discontinuous curvature, so intervals
crossing such joins need a piecewise/Lipschitz certificate rather than applying
the smooth second-derivative bound blindly.

The implementation now uses those regular-span bounds together with a measured
piecewise-linear position/normal field. This avoids unstable direct inversion near
stationary endpoints while retaining an explicit error bound. The approximation
is internal: the public contract remains distance along the actual guide.

### Certified guide leaves

For each leaf, the derivative lies in a positive cone about its chord. Polynomial
Bézier derivative control vectors bound that cone by convexity. For ellipse spans
of at most a quarter turn, the interior derivative is a positive combination of
the endpoint derivatives; their cone therefore supplies the same bound. Zero
endpoint derivative controls can be ignored when taking a limiting direction.
Collinear monotonic polynomials, including removable stationary points, reduce
exactly to a straight guide span. Reversals are rejected.

Let c be chord length, r the maximum absolute perpendicular/parallel derivative
ratio, and h=hypot(1,r). The true leaf length l satisfies:

```text
c <= l <= c*h
length excess <= c*r*r/(h+1)
eta = r*sqrt(2/(h*(h+1)))
```

Here eta bounds distance between any unit tangent in the cone and the chord's
unit direction. At equal fractional arc distance q, the true guide position
and the chord interpolant differ by at most `l*eta/2`: subtract the chord-axis
vector from both tangent integrals and use `2*q*(1-q) <= 1/2`.

The normal differs from the linear interpolation of endpoint normals by at most
the cone diameter `2*r/h`. Regular leaves use the smaller of that bound and
`(Q/m^3 + 4*A^2/m^4)*l^2/8`, which bounds the second arc-distance derivative
of the unit normal. The cone certificate still works at a stationary endpoint
where a positive speed lower bound cannot be established.

Directed tangents are validated both at original segment joins and between
adaptive leaves. The latter check is essential: an internal cusp can split into
two separately regular leaves. Closed seams share one endpoint field after the
smoothness check. Geometric self-crossings do not alter distance traversal.

### Combined length, fitting, and normal error

Let C be total chord length and delta bound accumulated length excess (including
numerical allowance). The monotone map phi from chord distance to true arc
distance maps each leaf fraction q to that same fraction of the true leaf length.
Its inverse is 1-Lipschitz because every true leaf length is at least its chord.
On a single traversal, `|phi(s)-s| <= delta`.

The requested placement uses true guide length L. Replacing L by C changes the
placed distance by at most `beta*delta`, where beta is the alignment fraction for
unfitted input or the maximum absolute normalized source X for stretched input.
Wrapping adds a bound for complete unwrapped laps. The implementation uses a
conservative distance factor `2 + beta + ceil(maxAbsDistance/C)` for wrapping,
with the lap term zero otherwise. Endpoint tangent extension has the same bound.

Let eS be that distance error, Khat the maximum slope of the piecewise-linear
normal field, D the maximum absolute source normal displacement, eP the maximum
leaf positional error, and eN the maximum leaf normal error. A sufficient bound
on the exact bend versus the internal surrogate field is:

```text
eGuide <= eP + D*eN + (1 + D*Khat)*eS + numerical allowance
```

Measurement refines until this uses at most one quarter of the requested
output tolerance. Refinement has finite depth, leaf, pass, and work budgets;
uncertifiable cases throw. This accounts for normal error growing with thickness,
source-frame fitting/alignment, and multiple closed-guide laps.

### Continuous source versus output chord

The surrogate guide position G(s) and normal Nhat(s) are continuous and piecewise
linear. Normals are intentionally not renormalized. For each source span, build
affine reference fields through its two mapped endpoint fields (constant fields
if endpoint distances coincide). Over the complete source-distance range, inspect
every guide-field breakpoint as well as the range endpoints. Convexity bounds
the position/normal residuals eG/eN on each intervening linear interval. This is
an exhaustive interval certificate, not a finite sampling heuristic.

If V and Q are the reference position/normal slopes, the reference bend's
second-derivative bound is:

```text
M <= (|V| + D*|Q|)*|s''| + max|Nref|*|d''| + 2*|Q|*|s'|*|d'|
output error <= eGuide + M/8 + eG + D*eN + numerical allowance
```

The reference fields agree with the surrogate fields at both source endpoints,
so the parameter-matched chord is the emitted chord. Polynomial and analytic
source-arc derivative bounds feed this calculation. Nonmonotonic source X,
repeated wraps, source closure, and coincident endpoints retain their full range
and traversal. No distance-to-infinite-line shortcut is used.

The analytic Along Arc mapper has its own second-derivative bound; tangent
extension crossings use a first-derivative bound. A phase-precision guard rejects
unwrapped angles whose division/modulo uncertainty could exceed tolerance after
multiplication by the displaced radius.

### Limits and current evidence

The output limit remains the approved default of 1,000,000 Move/Line/Close
segments. Source subdivision permits 2,000,000 visits and depth 52. Guide work
permits 2,000,000 visits, 131,072 leaves, depth 48, and 24 measurement passes.
Limits throw instead of weakening tolerance. These internal constants are not
public compatibility promises.

- Along Path's focused public test first failed on its missing export. Its oracle
  uses the closed-form arc length of B(t)=(100t,100t²), independently of the guide
  implementation. A second oracle inverts that analytic formula for a curved,
  nonmonotonic source. Analytic-circle comparisons test both traversal directions.
- The Along Path demo test first failed before mode switching existed. It now
  verifies mode switching, guide-handle dragging, release, and absence of an error
  preview. The Arc demo test also verifies invalid-offset retention and Reset.
- Live Chromium verification at the existing Studio URL passed title, nonblank
  page, compilation, console, and guide-drag checks. Images:
  `/tmp/crc-along-path-before.png` and `/tmp/crc-along-path-after.png`.
- The second slice URL was delivered. No changed semantics were requested during
  the feedback opportunity; implementation continues using the approved design.
- Source focused verification after the internal-cusp fix: 27 tests passed across
  geometry, public integration/example interactions, and public exports. The
  preceding built-package check passed 26 tests; rebuild and repeat with the cusp
  regression before completion.
- Typecheck, changed-file ESLint, and package builds passed. Packed consumer
  verification initially found the separate literal export-count check still at
  88; the exact export set already matched. Updated the count to 89 for the two
  public bending functions. Packed rerun and aggregate trust remain pending.
- Review found and reproduced four issues: explicit null options taking defaults,
  excessive guide subdivision for large normal displacement, insufficient phase
  precision checks for huge wrapped angles, and a cusp hidden at an adaptive
  subdivision boundary. Each has a focused regression and a verified correction.
- Corrected two test assumptions to match canonical PathGeometry behavior:
  repeated builder Close is a no-op (explicit segment editing can retain repeats),
  and rect() preserves a trailing Move after Close. The bending implementation
  preserves those source semantics instead of changing the builders.


## Final feedback and focused handoff, 2026-09-30

The user reported that guide edits left the bent preview unchanged, requested a
standalone discoverable Along Path example, and requested draggable Arc controls.
Those changes are implemented. Along Arc remains at
`http://127.0.0.1:5175/#/examples/drawing/path-bending` with center, radius, and
sweep handles. Along Path is independently listed at
`http://127.0.0.1:5175/#/examples/drawing/along-path`; it starts with stretch fitting
so the entire guide visibly affects the ribbon. Both examples explicitly use
endpoint tangent extension to keep offset/radius exploration responsive. If a
transformation fails, geometry and guide controls retain the same valid generation.

The first on-canvas Arc radius test failed before implementation. The initial
integer-coordinate Path drag passed, but live Studio verification reproduced the
reported failure at fractional coordinates from a scaled canvas. A new public
regression with fractional cubic controls failed before the correction.

The cause was applying the original segment-join roundoff threshold to internal
subdivision endpoints, where subtracting small control edges amplifies rounding.
Original guide joins still use the strict smoothness validation. Internal halves
of a polynomial/ellipse have matching limiting tangents or a reversal at a cusp;
the subdivision check rejects reversed normals. The measured shared-knot normal
difference is included in the guide error certificate (`D * joinError`) instead
of being silently discarded. Existing genuine internal-cusp regressions continue
to pass. Live before/after fill masks now change for both examples with no runtime
errors, and the rendered source and dragged states were visually inspected.

Fresh evidence, Node 24.15.0 / pnpm 11.21.0 / Playwright Chromium:

- Focused source suite: **32 passed**, three files; includes 21 geometry tests,
  seven integration/interaction tests, and four public export tests.
- Rebuilt public package focused suite: **32 passed**, three files.
- TypeScript, changed-file ESLint, package build, and diff whitespace checks pass.
- Packed verification passes isolated tarball boundaries, Bundler/NodeNext types,
  runtime exports, package identity, and both bending runtime probes.
- Catalog verification passes **69 lessons, 12 tutorial snapshots, 28 test labs**.
- Live Studio editor reports no TypeScript issues. Radius and guide drags change
  the actual green filled output; screenshots are `/tmp/crc-arc-ready.png`,
  `/tmp/crc-arc-dragged.png`, `/tmp/crc-path-ready.png`, and
  `/tmp/crc-path-dragged.png`. Integration tests cover center/sweep dragging,
  continuous movement, release, cancellation, and Reset.
- Representative deterministic structure: 40 calls from an original 27-segment
  ribbon produce exactly 40 result writes. Twenty varying arcs produce 138 output
  segments each; twenty fractional cubic guides produce 98–152 segments. There
  is no uncontrolled wall-clock correctness threshold.
- Drawing contract additions c0083–c0086 have explicit approved bending-design
  provenance; preexisting units/mappings were preserved. Public type and semantic
  inventory totals were refreshed to the actual 211 types and 828 units.

The aggregate trust attempt stopped on the concurrently added textures provenance
mapping. After that mapping was corrected, the drawing contract preservation gate
was updated and passed. The latest `docs:check` now reaches a separate outstanding
failure: `Acceptance matrix does not map docs/site/learn/guides/procedural-textures.md`.
This is reported to the coordinating workflow rather than weakening preservation
checks or claiming aggregate success. The coordinator owns final combined trust,
commit, merge, and push. Bending changes are held for that verification; no separate
commit or push was made. **Feature complete** remains contingent on the combined
gate. The approved requirements audit found no remaining bending behavior gaps.


## Verified combined delivery — 2026-09-30

This record supersedes the earlier aggregate blockers. The isolated combined
checkout completed `corepack pnpm@11.21.0 trust` with exit 0 on Node 24.15.0.
The actual completed command and `/tmp/crc-final-trust.log` were inspected:
3,429 browser tests passed (six skipped), all eight Studio visual baselines
matched, and package, documentation, lifecycle, and performance gates passed.
A final documentation-only completion update also passed `docs:check`.

Remote main was verified at `c6f35d02011bb997007982482a03065dc02e1c96` after
fast-forward and push. Inspection of that commit confirms both public bending
operations, the fractional-coordinate tangent fix and regression, and separate
Along Arc and Along Path catalog entries. The original checkout is preserved;
this completion note records delivered evidence without creating another commit.

Both approved operations, alignment/placement/overflow/accuracy contracts,
public integration and packaged exports, and the requested interactive feedback
are delivered. No bending implementation requirement remains outstanding.
