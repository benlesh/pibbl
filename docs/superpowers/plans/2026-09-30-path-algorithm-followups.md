# Path algorithm follow-ups — 2026-09-30

> **Historical status: IMPLEMENTATION AND EVALUATION RECORD.** This dated record explains decisions and measurements; current public contracts and executable tests define shipped behavior.

## Objective

Complete the closed-contour simplification fix, evaluate and implement useful
algorithm alternatives, and expose independently tree-shakable functions with
editable Playground controls. Deliver separate commits and merge/push main.

## Work and acceptance evidence

1. Correctness: reproduce duplicate-leading-vertex and tolerance failures in
   closed simplification through the public API; retain closure, input ownership,
   endpoints, and at least three distinct vertices where required.
2. Algorithms: implement bounded Wang flattening and budgeted radial-plus-DP
   simplification in independent modules. Compare latency and output counts with
   conservative defaults on deterministic workloads. Assess direct subdivision
   against de Casteljau before deciding whether another public helper is useful.
   Do not weaken tolerance or claim global speed superiority.
3. Integration: root exports, declarations, Bundler/NodeNext and packed consumers,
   source/built/packed tree-shaking evidence, API documentation, and separately
   selectable editable Playground operations.
4. Validation: focused failing tests before fixes/features; browser-visible slice;
   accuracy/degeneracy/contour/output-limit hardening; final repository trust gate.
5. Delivery: individual commits for correctness, algorithms, integration and any
   necessary hardening; merge verified changes to main and verify origin/main.

## Roles

The correctness agent owns the existing simplifier and its focused tests. The
algorithm agent owns new algorithm modules, tests and comparative measurements.
The primary agent owns public/package integration, tree-shaking verification,
Playground, documentation, final review, aggregate verification and delivery.

## Decision policy

Keep adaptive flattening and Douglas–Peucker as defaults until equivalent-contract
measurements justify a change. Expose algorithms as separate functions, not a
runtime dispatcher. Keep de Casteljau unless another subdivision implementation
shows a useful performance/numerical tradeoff for quadratic and cubic curves.
Analytic approximate flattening, area-based simplification, topology preservation,
and arc-length resampling have different guarantees; document disposition rather
than silently adding them under distance-tolerance options.

## Implemented decisions and measured tradeoffs

Measured on 2026-09-30, Apple M5 Max, macOS arm64, Node 24.15.0, pnpm 11.21.0,
and headless Playwright Chromium. Each timed case warms up 20 times, then records
31 batches of 10 operations; the table reports per-operation milliseconds.
Output counts include the initial Move. These are local characterizations, not
performance gates or cross-browser promises. No heap/allocation measurement was
performed. Public geometric tests and the mathematical bounds establish the
accuracy contract separately from these timing workloads.

| Workload / implementation                                | Node median / p95 ms | Chromium median / p95 ms | Output segments |
| -------------------------------------------------------- | -------------------- | ------------------------ | --------------- |
| 200 alternating cubics, adaptive flatten, tolerance 0.25 | 0.253 / 0.274        | 0.250 / 0.280            | 2001            |
| Same cubics, Wang flatten                                | 0.155 / 0.163        | 0.150 / 0.170            | 3401            |
| 10,000 sparse samples, DP, tolerance 0.5                 | 0.272 / 0.344        | Not measured             | 2               |
| Same sparse samples, radial + DP                         | 0.913 / 1.066        | Not measured             | 2               |
| 10,000 dense trace samples, DP, tolerance 0.5            | 4.367 / 4.529        | 3.940 / 4.050            | 75              |
| Same dense trace, radial + DP                            | 0.634 / 0.704        | 0.590 / 0.620            | 101             |
| 200 cubics subdivided into eight, de Casteljau           | 0.128 / 0.144        | Not measured             | 1601            |
| Same cubics, direct polynomial subcurve prototype        | 0.163 / 0.172        | Not measured             | 1601            |

Reproduce from the repository root:

```sh
node --import tsx tooling/benchmark-path-algorithms.mjs
node tooling/benchmark-path-algorithms-browser.mjs
```

- **Keep adaptive flattening as default.** Wang reduces computation on this
  workload but writes substantially more segments, increasing later iteration,
  conversion, drawing and storage costs. It earns a separate `flattenPathWang`
  function with the same distance tolerance. Quadratics/cubics use a uniform
  parameter bound; affine arcs use a conservative maximum-stretch sagitta bound.
- **Keep ordinary Douglas–Peucker as default.** `simplifyPathRadial` earns a
  separate function for densely sampled traces. Its half-budget prepass improves
  this dense case substantially, but adds overhead on sparse samples and can
  retain more points. The two error budgets compose within the caller's
  tolerance. If the positive tolerance cannot be halved without underflow, use
  the original simplifier directly. Neither function promises topology.
- **Keep de Casteljau subdivision without another public alternative.** The
  cubic-only direct polynomial prototype is checked against sampled de
  Casteljau subcurves and endpoints before timing, but is slower in this run.
  That prototype is not a full replacement for line/arc/closed-contour handling.
  There is no demonstrated reason to expand the API. Equal parameter steps
  remain distinct from equal arc-length spacing.

## Research disposition

The implementation choices follow the research, rather than a universal claim
that one algorithm is fastest:

- [Skia's Wang implementation](https://skia.googlesource.com/skia/+/401c397f7235/src/gpu/tessellate/WangsFormula.h)
  supplies the second-difference bound used for the uniform Bézier alternative.
- [Levien's analytic quadratic method](https://raphlinus.github.io/graphics/curves/2019/12/23/flatten-quadbez.html)
  is a promising segment-placement strategy, but
  [Kurbo's flatten contract](https://docs.rs/kurbo/latest/kurbo/fn.flatten.html)
  does not absolutely guarantee its requested tolerance. A certified variant
  remains a separate research project; this change does not weaken CRC's bound.
- [Simplify.js](https://github.com/mourner/simplify-js/blob/master/simplify.js)
  demonstrates the radial-prefilter pattern. CRC explicitly divides the error
  budget rather than applying the full tolerance twice.
- [Hershberger and Snoeyink](https://www.cs.ubc.ca/tr/1992/tr-92-07)
  give an asymptotically faster DP approach. A path-hull implementation and its
  distance-model equivalence are not justified by these workloads; ordinary DP
  retains its quadratic worst case.
- [Mapshaper's Visvalingam comparison](https://github.com/mbloch/mapshaper/blob/master/docs/guides/simplification.md)
  describes useful area/point-budget and visual-smoothing choices. They do not
  preserve the distance-tolerance semantics, so no misleading alternate under
  `SimplifyPathOptions` is added.
- [CGAL topology preservation](https://doc.cgal.org/latest/Polyline_simplification_2/index.html)
  requires contour-aware geometric bookkeeping. It remains a distinct future
  capability, not an implied property of this simplifier.
- [Fast subdivision of Bézier curves](https://arxiv.org/abs/2509.15691)
  improves asymptotic dependence on degree. CRC's degree-two/degree-three curves
  do not justify FFT machinery. The direct cubic prototype above tests a more
  relevant constant-factor alternative.

## Tree-shaking and public integration

Separate public named functions have independent source modules; the defaults
never dispatch to alternate implementations. Radial intentionally depends on
ordinary DP. `tooling/verify-path-tree-shaking.mjs` makes real minified bundles
for each selected export, asserts the absence of other algorithm names (with
names preserved for inspection), executes each resulting bundle, and checks
fresh output/input ownership. The check runs against source and built entries;
the packed-consumer verifier invokes it against an installed tarball. The
aggregate package gate includes both checks. This proves alternate elimination,
not that the existing shared core runtime has zero bundle overhead.

The editable public example adds independent Wang and radial buttons and a dense
preset. Click tests cover their outputs; the live Studio check exercises Wang,
Reset, dense preset, and radial with captured paint state. Public declarations,
Bundler/NodeNext consumers, runtime exports, editor declarations, API symbols,
and learning catalog all include the new functions.

## Correctness hardening

Closed simplification now chooses three ordered distinct anchors and simplifies
between them, avoiding the old first-three fallback's duplicate and tolerance
failures. Retained-index markers avoid sorting; distinctness stops after three
points. Distance comparisons normalize finite deltas to avoid squared overflow
and tiny-segment/remote-point NaNs; unrepresentable differences fail explicitly.
Wang preserves endpoints, preflights counts, and handles straight/collapsed
curves, affine arcs, implicit connections, closure and continuations. Radial
checks the composed budget on sampled input linework, preserves closed-ring
minimum distinctness, and delegates DP to share the corrected implementation.
